# VideoShare - Video Upload & Transcoding Platform

A modern video sharing platform with CPU-intensive transcoding capabilities, built for AWS deployment.

## 🎯 Assessment Compliance

This application meets all CAB432 core criteria:
- ✅ CPU intensive task (video transcoding with ffmpeg)
- ✅ Load testing script (`load-test.js`)
- ✅ Multiple data types (binary files + structured database)
- ✅ Docker containerization 
- ✅ EC2 deployment ready
- ✅ Complete REST API
- ✅ JWT user authentication with meaningful roles

See `ASSESSMENT-COMPLIANCE.md` for detailed breakdown.

## 🚀 Features

- **Video Upload & Management**: Upload videos with titles, view counts, public/private controls
- **CPU-Intensive Transcoding**: Convert videos to MP4/WebM/AVI in multiple resolutions
- **User Authentication**: Secure registration/login with JWT tokens
- **Admin Controls**: Single admin account with global video management
- **Modern Web UI**: Responsive SPA with video player and upload progress
- **Load Testing**: Automated script for generating CPU load across multiple servers

## 🏗️ Architecture

- **Backend**: Node.js + Express.js REST API
- **Database**: MariaDB for metadata and user data
- **Processing**: ffmpeg for video transcoding
- **Storage**: Local volumes for video files
- **Auth**: JWT with bcrypt password hashing
- **Container**: Docker + Docker Compose

## 🔧 Local Development

```bash
# Clone and setup
git clone <repository>
cd videoshare

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Run with Docker Compose
docker compose build
docker compose up -d

# Check logs
docker compose logs -f app
```

Visit http://localhost:3000

## 🔑 Default Admin Account

- **Username**: `admin`
- **Password**: `supersecret2024!`

Regular users can register via the web interface.

## ⚡ Load Testing

Test CPU load generation (for auto-scaling demos):

```bash
# Basic load test (10 concurrent requests)
node load-test.js http://your-ec2-ip:3000 admin supersecret2024! 10

# High load test (50 concurrent requests)
node load-test.js http://your-ec2-ip:3000 admin supersecret2024! 50
```

The script will:
- Authenticate with the server
- Queue multiple transcode jobs continuously
- Monitor and report request rates
- Run until stopped (Ctrl+C)

## 🌩️ AWS EC2 Deployment

### Step 1: Launch EC2 Instance

1. **AWS Console** → EC2 → Launch Instance
2. **AMI**: Ubuntu Server 22.04 LTS
3. **Instance Type**: t3.medium (recommended for transcoding)
4. **Security Group**: 
   - SSH (22) from your IP
   - HTTP (3000) from anywhere or your IP
5. **Storage**: 30+ GB (for video storage)

### Step 2: Install Docker on EC2

SSH into your instance and run:

```bash
# Update system
sudo apt update

# Install Docker
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | \
sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start Docker
sudo systemctl enable --now docker
sudo usermod -aG docker ubuntu
```

### Step 3: Deploy Application

```bash
# Create app directory
sudo mkdir -p /opt/videoshare
sudo chown ubuntu:ubuntu /opt/videoshare
cd /opt/videoshare

# Copy project files (choose one method):

# Method A: Git clone
git clone <your-repository> .

# Method B: SCP from local machine
# On your local machine:
# scp -i your-key.pem -r ./* ubuntu@EC2-IP:/opt/videoshare/

# Create production environment file
cat > .env << 'EOF'
JWT_SECRET=your-super-long-random-jwt-secret-here
DB_ROOT_PASSWORD=strong-db-root-password
DB_PASSWORD=strong-app-db-password
ADMIN_USERNAME=admin
ADMIN_PASSWORD=supersecret2024!
EOF

# Build and start services
docker compose build
docker compose up -d

# Verify deployment
docker compose ps
docker compose logs app
```

### Step 4: Test Deployment

```bash
# Check application health
curl http://localhost:3000/api/health

# Test from your local machine
curl http://EC2-PUBLIC-IP:3000/api/health
```

Visit `http://EC2-PUBLIC-IP:3000` in your browser.

## 📊 Performance Testing

Monitor CPU usage during load testing:

1. **AWS Console** → EC2 → Instance → Monitoring tab
2. Watch "CPU Utilization" graph
3. Run load test: `node load-test.js http://EC2-IP:3000 admin supersecret2024! 20`
4. CPU should reach 80-90%+ during active transcoding

## 🛡️ Security Notes

- Change default admin password in production
- Use strong JWT secrets (64+ characters)
- Restrict security group access as needed
- Consider using AWS Secrets Manager for production secrets

## 📁 Project Structure

```
videoshare/
├── src/
│   └── server.js          # Main Express.js application
├── public/
│   ├── index.html         # Single-page web application
│   ├── app.js            # Frontend JavaScript
│   └── styles.css        # Modern CSS styling
├── docker-compose.yml    # Multi-container orchestration
├── Dockerfile           # Node.js + ffmpeg container
├── load-test.js         # CPU load testing script
├── package.json         # Node.js dependencies
└── .env.example         # Environment configuration template
```

## 🔗 API Endpoints

### Authentication
- `POST /api/register` - Create user account
- `POST /api/login` - Authenticate user
- `GET /api/me` - Get current user info

### Videos
- `POST /api/upload` - Upload video with title
- `GET /api/videos` - List videos (public + owned)
- `GET /api/videos/:id` - Get video details
- `GET /api/videos/:id/download` - Stream/download video
- `DELETE /api/videos/:id` - Delete video (owner/admin)

### Transcoding
- `POST /api/videos/:id/transcode` - Queue transcode job
- `GET /api/transcodes/:id/status` - Check job status
- `POST /api/bulk-transcode` - Bulk processing (load testing)

### Admin (admin only)
- `POST /api/videos/:id/toggle-public` - Toggle video visibility

## 🎬 Demo Video Script

1. **Show login/registration** (different user types)
2. **Upload video** with progress indicator
3. **Demonstrate transcoding** to different formats/resolutions
4. **Admin controls** (toggle public, delete videos)
5. **Load testing** showing CPU utilization spike
6. **API testing** with Postman/curl

## 📝 Assessment Deliverables

1. ✅ **Source Code**: Complete codebase in this repository
2. ✅ **5-minute Demo Video**: Record functionality demonstration
3. ✅ **Compliance Document**: See `ASSESSMENT-COMPLIANCE.md`

Built for CAB432 Cloud Computing Assignment 1 - QUT 2025