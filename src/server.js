import AppController from './controllers/AppController.js';

const appController = new AppController();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await appController.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await appController.stop();
  process.exit(0);
});

// Start the application
appController.start();
