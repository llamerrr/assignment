# syntax=docker/dockerfile:1
FROM node:20-bullseye

# Install ffmpeg
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY src ./src
COPY public ./public

# Create data directories
RUN mkdir -p /data/uploads /data/videos /data/tmp \
  && chown -R node:node /data /app

USER node

ENV NODE_ENV=production \
    UPLOAD_DIR=/data/uploads \
    VIDEO_DIR=/data/videos \
    TMP_DIR=/data/tmp

EXPOSE 3000

CMD ["node", "src/server.js"]
