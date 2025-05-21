# Use an official Node.js image with Python and FFmpeg support
FROM python:3.10-slim

# Install Node.js, FFmpeg, and other dependencies
RUN apt-get update && \
    apt-get install -y ffmpeg curl gnupg && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g npm

# Set working directory
WORKDIR /app

# Copy package files and install Node dependencies
COPY package*.json ./
RUN npm install

# Copy Python requirements and install them
COPY controllers/youtubeController.py ./controllers/
RUN pip install yt-dlp

# Copy the rest of the app
COPY . .

# Expose the port
EXPOSE 5000

# Start the server
CMD ["node", "server.js"]
