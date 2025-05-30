import express from 'express';
import cors from 'cors';
import { exec, execFile } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { promisify } from 'util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);
const app = express();
const port = process.env.PORT || 5000;
const BASE_URL = process.env.BASE_URL ;

const allowedOrigins = [
    'https://yt-download-fron.vercel.app',  // Your production frontend
    'http://localhost:3000'  // Your local frontend
];

app.use(cors({
    origin: function(origin, callback) {
        // allow requests with no origin (like mobile apps or curl requests)
        if(!origin) return callback(null, true);
        
        if(allowedOrigins.indexOf(origin) === -1){
            return callback(new Error('The CORS policy for this site does not allow access from the specified Origin.'), false);
        }
        return callback(null, true);
    },
    credentials: true
}));
app.use(express.json());

const downloadsPath = path.join(__dirname, 'downloads');
const tempPath = path.join(__dirname, 'temp');

// Create directories if they don't exist
[downloadsPath, tempPath].forEach(dir => {
    if (!fs.existsSync(dir)) {
        try {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created directory: ${dir}`);
        } catch (err) {
            console.error(`Error creating directory ${dir}:`, err);
        }
    }
});

// Serve static files with proper headers and error handling
app.use('/downloads', (req, res, next) => {
    console.log('Download request for:', req.url);
    const filePath = path.join(downloadsPath, req.url);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        console.error('File not found:', filePath);
        return res.status(404).json({ error: 'File not found' });
    }

    // Log file details
    const stats = fs.statSync(filePath);
    console.log('Serving file:', {
        path: filePath,
        size: stats.size,
        created: stats.birthtime
    });

    // Set headers for file download
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(req.url)}"`);
    
    // Stream the file
    const stream = fs.createReadStream(filePath);
    stream.on('error', (error) => {
        console.error('Error streaming file:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Error streaming file' });
        }
    });
    
    stream.pipe(res);
});

// Helper function to ensure directory exists
function ensureDirectoryExists(dir) {
    if (!fs.existsSync(dir)) {
        try {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`Created directory: ${dir}`);
            return true;
        } catch (err) {
            console.error(`Error creating directory ${dir}:`, err);
            return false;
        }
    }
    return true;
}

// Clean up temporary files with logging
function cleanupTempFiles(files) {
    files.forEach(file => {
        if (fs.existsSync(file)) {
            try {
                fs.unlinkSync(file);
                console.log(`Cleaned up file: ${file}`);
            } catch (err) {
                console.error(`Error deleting file ${file}:`, err);
            }
        }
    });
}

// ✅ Merge video and audio using FFmpeg
app.post('/api/merge', async (req, res) => {
    const { videoUrl, audioUrl } = req.body;

    if (!videoUrl || !audioUrl) {
        return res.status(400).json({ error: 'Both videoUrl and audioUrl are required.' });
    }

    console.log('Received merge request:', { videoUrl, audioUrl });

    // Ensure temp directory exists
    if (!ensureDirectoryExists(tempPath)) {
        return res.status(500).json({ error: 'Failed to create temporary directory' });
    }

    const timestamp = Date.now();
    const videoFile = path.join(tempPath, `video_${timestamp}.mp4`);
    const audioFile = path.join(tempPath, `audio_${timestamp}.m4a`);
    const outputFile = path.join(tempPath, `merged_${timestamp}.mp4`);

    try {
        // Extract video ID from the URL
        const videoId = new URL(videoUrl).searchParams.get('v');
        if (!videoId) {
            throw new Error('Invalid YouTube URL');
        }

        // Get format IDs from the URLs
        const videoFormatId = new URL(videoUrl).searchParams.get('itag');
        const audioFormatId = new URL(audioUrl).searchParams.get('itag');

        if (!videoFormatId || !audioFormatId) {
            throw new Error('Format IDs are required in the URLs');
        }

        console.log('Processing video:', {
            videoId,
            videoFormatId,
            audioFormatId,
            videoFile,
            audioFile,
            outputFile
        });

        // Download video file
        console.log('Downloading video file...');
        const baseUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const videoCmd = `yt-dlp -f ${videoFormatId} -o "${videoFile}" "${baseUrl}"`;
        await execAsync(videoCmd);
        
        if (!fs.existsSync(videoFile)) {
            throw new Error('Failed to download video file');
        }
        console.log('Video file downloaded successfully');

        // Download audio file
        console.log('Downloading audio file...');
        const audioCmd = `yt-dlp -f ${audioFormatId} -o "${audioFile}" "${baseUrl}"`;
        await execAsync(audioCmd);

        if (!fs.existsSync(audioFile)) {
            throw new Error('Failed to download audio file');
        }
        console.log('Audio file downloaded successfully');

        // Merge files using FFmpeg
        console.log('Starting merge...');
        const mergeCmd = `ffmpeg -i "${videoFile}" -i "${audioFile}" -c:v copy -c:a aac -strict experimental -b:a 128k -shortest "${outputFile}"`;
        try {
            await execAsync(mergeCmd);
            console.log('Merge completed successfully');

            if (!fs.existsSync(outputFile)) {
                throw new Error('Failed to create merged file');
            }

            const stats = fs.statSync(outputFile);
            if (stats.size === 0) {
                throw new Error('Merged file is empty');
            }

            console.log('Output file created:', {
                path: outputFile,
                size: `${(stats.size / (1024 * 1024)).toFixed(2)} MB`
            });

            // Set response headers
            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Content-Disposition', `attachment; filename="merged_${timestamp}.mp4"`);
            res.setHeader('Content-Length', stats.size);

            // Stream the file to response
            const fileStream = fs.createReadStream(outputFile);
            
            // Add error handler for the file stream
            fileStream.on('error', (error) => {
                console.error('File stream error:', error);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Streaming failed', details: error.message });
                }
                cleanupTempFiles([videoFile, audioFile, outputFile]);
            });

            // Stream the file
            fileStream.pipe(res);

            // Clean up when streaming is done
            res.on('finish', () => {
                console.log('Streaming completed successfully');
                cleanupTempFiles([videoFile, audioFile, outputFile]);
            });

            // Handle client disconnect
            res.on('close', () => {
                console.log('Client disconnected');
                cleanupTempFiles([videoFile, audioFile, outputFile]);
                fileStream.destroy();
            });

        } catch (ffmpegError) {
            console.error('FFmpeg error:', ffmpegError);
            cleanupTempFiles([videoFile, audioFile, outputFile]);
            throw new Error(`FFmpeg merge failed: ${ffmpegError.message}`);
        }

    } catch (error) {
        console.error('Merge error:', error);
        // Clean up any temporary files
        cleanupTempFiles([videoFile, audioFile, outputFile]);
        
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Failed to merge video and audio', 
                details: error.message,
                command: error.cmd
            });
        }
    }
});

// ✅ Extract video/audio stream info using yt-dlp
app.post('/api/video-info', (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required.' });
    }

    console.log('Processing video info request:', { url });

    // Use 'python3' command which should be available in both local and production
    const pythonCommand = process.env.NODE_ENV === 'production' ? 'python3' : 'python';
    
    execFile(pythonCommand, ['controllers/youtubeController.py', url], (error, stdout, stderr) => {
        // Log progress messages from stderr
        if (stderr) {
            try {
                const statusMessages = stderr.split('\n')
                    .filter(line => line.trim())
                    .map(line => JSON.parse(line));
                console.log('Processing status:', statusMessages);
            } catch (e) {
                console.error('Error parsing status messages:', stderr);
            }
        }

        if (error) {
            console.error('Python execution error:', error);
            return res.status(500).json({ 
                error: 'Failed to extract video info', 
                details: error.message,
                stderr: stderr
            });
        }

        try {
            const result = JSON.parse(stdout);
            
            // Check if there's an error in the result
            if (result.error) {
                return res.status(400).json(result);
            }

            console.log('Successfully processed video:', {
                title: result.title,
                formats: result.formats?.length || 0
            });

            res.json(result);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            console.error('Raw output:', stdout);
            res.status(500).json({ 
                error: 'Failed to parse video information', 
                details: parseError.message,
                stdout: stdout
            });
        }
    });
});

// ✅ Check if FFmpeg is installed
app.get('/api/check-ffmpeg', (req, res) => {
    exec('ffmpeg -version', (error, stdout, stderr) => {
        if (error) {
            console.error('FFmpeg check error:', error);
            return res.status(500).json({ error: 'FFmpeg is not installed', details: stderr });
        }
        res.json({ message: 'FFmpeg is installed', version: stdout.split('\\n')[0] });
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        error: 'Internal server error', 
        details: err.message 
    });
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
