# Use Node.js 18 as the base image
FROM node:18-slim

# Install FFmpeg for video processing
RUN apt-get update && \
    apt-get install -y ffmpeg && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Create necessary directories with proper permissions
RUN mkdir -p temp downloads && \
    chown -R node:node /app

# Switch to non-root user for security
USER node

# Expose the port the app runs on
EXPOSE 5000

# Command to run the application
CMD ["npm", "start"]
