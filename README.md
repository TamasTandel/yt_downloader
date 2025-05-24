# YouTube Video Downloader Backend

A Node.js backend service for downloading and processing YouTube videos.

## Features

- Download YouTube videos in various qualities
- Extract audio from videos
- Merge video and audio streams
- Temporary file management
- RESTful API endpoints

## Prerequisites

- Node.js 18 or higher
- FFmpeg
- Docker (optional, for containerized deployment)

## Installation

### Local Development

1. Clone the repository
2. Navigate to the backend directory:
   ```bash
   cd backend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   npm start
   ```

### Using Docker

1. Build the Docker image:
   ```bash
   docker build -t youtube-downloader-backend .
   ```
2. Run the container:
   ```bash
   docker run -p 5000:5000 -v $(pwd)/downloads:/app/downloads -v $(pwd)/temp:/app/temp youtube-downloader-backend
   ```

## API Endpoints

### Download Video
- **URL**: `/api/download`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "videoUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
    "quality": "highest"
  }
  ```
- **Response**: Video file or error message

### Merge Video and Audio
- **URL**: `/api/merge`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "videoUrl": "https://www.youtube.com/watch?v=VIDEO_ID&itag=VIDEO_ITAG",
    "audioUrl": "https://www.youtube.com/watch?v=VIDEO_ID&itag=AUDIO_ITAG"
  }
  ```
- **Response**: Merged video file or error message

## Environment Variables

- `PORT`: Server port (default: 5000)
- `NODE_ENV`: Environment mode (development/production)
- `TEMP_DIR`: Directory for temporary files
- `DOWNLOAD_DIR`: Directory for downloaded files

## Project Structure

```
backend/
├── controllers/     # Route controllers
├── temp/           # Temporary files
├── downloads/      # Downloaded videos
├── server.js       # Main application file
├── package.json    # Dependencies and scripts
└── Dockerfile      # Docker configuration
```

## Error Handling

The API includes comprehensive error handling for:
- Invalid YouTube URLs
- Download failures
- Processing errors
- File system errors

## Development

1. Install development dependencies:
   ```bash
   npm install --save-dev
   ```

2. Run in development mode:
   ```bash
   npm run dev
   ```

## Docker Deployment

1. Build the image:
   ```bash
   docker build -t your-username/youtube-downloader-backend .
   ```

2. Push to Docker Hub:
   ```bash
   docker push your-username/youtube-downloader-backend
   ```

3. Pull and run on another machine:
   ```bash
   docker pull your-username/youtube-downloader-backend
   docker run -p 5000:5000 your-username/youtube-downloader-backend
   ```

## Troubleshooting

Common issues and solutions:

1. **FFmpeg Missing**
   - Install FFmpeg using your package manager
   - Verify installation: `ffmpeg -version`

2. **Permission Issues**
   - Ensure proper permissions for temp and downloads directories
   - Run with sudo if necessary (not recommended for production)

3. **Memory Issues**
   - Increase Node.js memory limit if needed
   - Clean temp directory regularly

## License

MIT License 