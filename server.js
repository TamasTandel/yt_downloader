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
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

app.use(cors({ origin: '*' }));
app.use(express.json());

const downloadsPath = path.join(__dirname, 'downloads');
const tempPath = path.join(__dirname, 'temp');

// Create directories if they don't exist
[downloadsPath, tempPath].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use('/downloads', express.static(downloadsPath));

// Helper function to download file from URL
async function downloadFile(url, outputPath) {
    return new Promise((resolve, reject) => {
        https.get(url, response => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            const fileStream = fs.createWriteStream(outputPath);
            response.pipe(fileStream);
            fileStream.on('finish', () => {
                fileStream.close();
                resolve();
            });
        }).on('error', reject);
    });
}

// Clean up temporary files
function cleanupTempFiles(files) {
    files.forEach(file => {
        if (fs.existsSync(file)) {
            try {
                fs.unlinkSync(file);
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

    const timestamp = Date.now();
    const videoFile = path.join(tempPath, `video_${timestamp}.mp4`);
    const audioFile = path.join(tempPath, `audio_${timestamp}.m4a`);
    const outputFile = `merged_${timestamp}.mp4`;
    const outputPath = path.join(downloadsPath, outputFile);

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

        // Download video file using yt-dlp with the specific format
        console.log('Downloading video file...');
        const baseUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const videoCmd = `yt-dlp -f ${videoFormatId} -o "${videoFile}" "${baseUrl}"`;
        console.log('Video download command:', videoCmd);
        await execAsync(videoCmd);
        
        if (!fs.existsSync(videoFile)) {
            throw new Error('Failed to download video file');
        }

        // Download audio file using yt-dlp with the specific format
        console.log('Downloading audio file...');
        const audioCmd = `yt-dlp -f ${audioFormatId} -o "${audioFile}" "${baseUrl}"`;
        console.log('Audio download command:', audioCmd);
        await execAsync(audioCmd);

        if (!fs.existsSync(audioFile)) {
            throw new Error('Failed to download audio file');
        }

        // Get video information
        console.log('Getting video information...');
        const videoInfo = await execAsync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate -of json "${videoFile}"`);
        const videoData = JSON.parse(videoInfo.stdout);
        const videoStream = videoData.streams[0];

        // Calculate optimal bitrate for audio (based on video quality)
        const height = videoStream?.height || 720;
        const audioBitrate = height >= 1080 ? '192k' : '128k';

        // Merge files using FFmpeg with optimal settings
        console.log('Merging files...');
        const mergeCmd = `ffmpeg -i "${videoFile}" -i "${audioFile}" -c:v copy -c:a aac -b:a ${audioBitrate} -movflags +faststart -y "${outputPath}"`;
        console.log('Merge command:', mergeCmd);
        await execAsync(mergeCmd);

        // Verify the output file exists and has a non-zero size
        if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
            throw new Error('Failed to create merged video file');
        }

        // Get the size of the merged file
        const stats = fs.statSync(outputPath);
        const fileSizeInBytes = stats.size;
        const fileSizeInMB = fileSizeInBytes / (1024 * 1024);

        // Clean up temporary files
        cleanupTempFiles([videoFile, audioFile]);

        console.log('Merge successful:', {
            outputFile,
            size: fileSizeInMB.toFixed(2) + ' MB'
        });

        res.json({ 
            downloadUrl: `${BASE_URL}/downloads/${outputFile}`,
            message: 'Merge successful',
            fileSize: fileSizeInBytes,
            fileSizeMB: fileSizeInMB.toFixed(2),
            fileName: outputFile
        });
    } catch (error) {
        console.error('Merge error:', error);
        // Clean up any temporary files if they exist
        cleanupTempFiles([videoFile, audioFile, outputPath]);
        res.status(500).json({ 
            error: 'Failed to merge video and audio', 
            details: error.message,
            command: error.cmd // Include the failed command for debugging
        });
    }
});

// ✅ Extract video/audio stream info using yt-dlp
app.post('/api/video-info', (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required.' });
    }

    console.log('Processing video info request:', { url });

    // Use the full path to Python executable
    const pythonPath = 'C:\\Users\\tamas\\AppData\\Local\\Programs\\Python\\Python314\\python.exe';
    
    execFile(pythonPath, ['controllers/youtubeController.py', url], (error, stdout, stderr) => {
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

            // Validate the required fields
            if (!result.title || !result.video_only_formats || !result.audio_only_formats) {
                console.error('Invalid response format:', result);
                return res.status(500).json({ 
                    error: 'Invalid video information format',
                    details: 'The video information is incomplete or invalid.'
                });
            }

            console.log('Successfully processed video:', {
                title: result.title,
                formats: {
                    video: result.video_only_formats.length,
                    audio: result.audio_only_formats.length,
                    combined: result.video_audio_formats.length
                }
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
