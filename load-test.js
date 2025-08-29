#!/usr/bin/env node

// Load testing script for VideoShare app
// Usage: node load-test.js <server-url> <username> <password> <concurrent-requests>

const args = process.argv.slice(2);
const [serverUrl = 'http://localhost:3000', username = 'admin', password = 'supersecret2024!', concurrency = '10'] = args;
const concurrent = parseInt(concurrency);

console.log(`Load testing ${serverUrl} with ${concurrent} concurrent requests`);

let token = '';

async function authenticate() {
  const response = await fetch(`${serverUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  
  if (!response.ok) {
    throw new Error(`Authentication failed: ${response.statusText}`);
  }
  
  const data = await response.json();
  token = data.token;
  console.log('Authenticated successfully');
}

async function getVideos() {
  const response = await fetch(`${serverUrl}/api/videos`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const videos = await response.json();
  return videos.map(v => v.id);
}

async function triggerTranscode(videoIds) {
  const response = await fetch(`${serverUrl}/api/bulk-transcode`, {
    method: 'POST',
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      videoIds,
      format: 'mp4',
      resolution: '720p',
      count: concurrent * 2 // Create more jobs than concurrent requests
    })
  });
  
  if (!response.ok) {
    throw new Error(`Transcode failed: ${response.statusText}`);
  }
  
  return response.json();
}

async function runLoadTest() {
  try {
    await authenticate();
    
    const videoIds = await getVideos();
    if (videoIds.length === 0) {
      console.log('No videos found. Upload some videos first.');
      return;
    }
    
    console.log(`Found ${videoIds.length} videos`);
    
    // Start load test
    console.log(`Starting load test with ${concurrent} concurrent transcode jobs...`);
    
    const startTime = Date.now();
    let completedRequests = 0;
    let totalRequests = 0;
    
    // Function to make continuous requests
    const makeRequests = async () => {
      while (true) {
        try {
          totalRequests++;
          const result = await triggerTranscode(videoIds);
          completedRequests++;
          
          if (completedRequests % 10 === 0) {
            const elapsed = (Date.now() - startTime) / 1000;
            const rate = completedRequests / elapsed;
            console.log(`${completedRequests} requests completed (${rate.toFixed(2)} req/s)`);
          }
          
          // Small delay to prevent overwhelming
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error('Request failed:', error.message);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    };
    
    // Start concurrent request streams
    const promises = Array(concurrent).fill().map(() => makeRequests());
    
    // Let it run for 5 minutes or until interrupted
    console.log('Load test running... Press Ctrl+C to stop');
    
    // Wait indefinitely (until Ctrl+C)
    await Promise.race(promises);
    
  } catch (error) {
    console.error('Load test failed:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nLoad test stopped');
  process.exit(0);
});

runLoadTest();
