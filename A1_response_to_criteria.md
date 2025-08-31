Assignment 1 - REST API Project - Response to Criteria

Overview
------------------------------------------------

- **Name:** Liam_Ross  
- **Student number:** N11961279
- **Application name:** AwesomeShare
- **Two line description:** A Node.js REST API with a simple web UI for uploading videos, managing metadata, and streaming/processing media. Users authenticate with JWT; admin endpoints support bulk operations.

Core criteria
------------------------------------------------

### Containerise the app

- **ECR Repository name:** 11961279-image
- **Video timestamp:** [00:30]
- **Relevant files:**
  - Dockerfile
  - package.json
  - src/server.js

### Deploy the container

- **EC2 instance ID:** i-0d43503e76e7f7c3f
- **Video timestamp:** [00:00]

### User login

- ****One line description:**** Username/password login issues a JWT; admin role gates admin endpoints.
- **Video timestamp:** [01:50]
- **Relevant files:**
  - src/routes/authRoutes.js
  - src/services/AuthService.js
  - src/middleware/AuthMiddleware.js

### REST API

- **One line description:** JSON REST API served under /api with proper methods, headers, and status codes.
- **Video timestamp:** [02:40]
- **Relevant files:**
  - src/server.js
  - src/controllers/AppController.js
  - src/routes/authRoutes.js, videoRoutes.js, adminRoutes.js

Endpoints (summary)
- Auth
  - POST /api/register – create user
  - POST /api/login – returns { token, user }
  - GET  /api/me – current user (JWT required)
- System
  - GET  /api/health – { ok: true }
- Videos (JWT required unless stated)
  - GET  /api/videos – list
  - POST /api/videos – upload (multipart/form-data)
  - GET  /api/videos/:id – details
  - PUT/PATCH /api/videos/:id – update metadata
  - DELETE /api/videos/:id – delete
  - GET  /api/videos/:id/stream – progressive stream
  - GET  /api/videos/:id/download – download file
  - GET  /api/videos/:id/versions – transcoded variants (if present)
- Admin
  - POST /api/bulk-transcode – multiple transcodes (admin only)

### Data types

- **One line description:** Stores structured metadata in MariaDB and unstructured media files on disk.
- **Video timestamp:** [04:29]
- **Relevant files:**
  - src/services/DatabaseService.js
  - src/services/VideoService.js

#### First kind

- **One line description:** Users, videos, and job metadata
- **Type:** Structured (relational)
- **Rationale:** Querying, relations, and constraints for users/videos/jobs
- **Storage:** MariaDB/MySQL (connection configured in src/config/config.js)
- **Video timestamp:** [04:29]
- **Relevant files:**
  - src/config/config.js
  - src/services/DatabaseService.js

#### Second kind

- **One line description:** Raw uploaded video files (and thumbnails/variants)
- **Type:** Unstructured (blobs on filesystem)
- **Rationale:** Large binary data best handled as files for streaming/transcoding
- **Storage:** Host disk mounted into the container
- **Video timestamp:** [04:29]
- **Relevant files:**
  - src/services/VideoService.js

### CPU intensive task

- **One line description:** Video transcoding (and thumbnail generation) using ffmpeg over uploaded files; jobs tracked in DB.
- **Video timestamp:** [04:09]
- **Relevant files:**
  - src/services/VideoService.js
  - src/routes/adminRoutes.js

### CPU load testing

- **One line description:** Video transcoding (in general), bulk transcode
- **Video timestamp:** [04:29]
- **Relevant files:**
  - src/services/VideoService.js
  - call to POST /api/bulk-transcode with admin token

Additional criteria
------------------------------------------------

### Extensive REST API features

- **One line description:** Many endpoints and test suite for hoppscotch
- **Video timestamp:** [02:58]
- **Relevant files:** js/services/ApiService.js

### External API(s)

- **One line description:** Not attempted
- **Video timestamp:**                          
- **Relevant files:**

### Additional types of data

- **One line description:** Not attempted
- **Video timestamp:**
- **Relevant files:**

### Custom processing

- **One line description:** FFMPEG video transcoding - change format and size
- **Video timestamp:** [04:05]
- **Relevant files:** src/services/VideoService.js

### Infrastructure as code
 
- **One line description:** Docker compose, AWS services
- **Video timestamp:** [02:35]
- **Relevant files:** docker-compose.yml, dockerfile

### Web client

- **One line description:** Static web UI in /public uses the API for login and upload/management.
- **Video timestamp:** [1:50]
- **Relevant files:**
  - public/js/components/AuthComponent.js
  - public/js/components/UploadComponent.js
  - public/js/services/ApiService.js