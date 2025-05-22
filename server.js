require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { exec, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 5000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${port}`;

app.use(cors({ origin: '*' }));
app.use(express.json());

// Create downloads folder if it doesn't exist
const downloadsPath = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsPath)) fs.mkdirSync(downloadsPath);
app.use('/downloads', express.static(downloadsPath));

// ✅ Merge video and audio using FFmpeg
app.post('/api/merge', (req, res) => {
    const { videoUrl, audioUrl } = req.body;

    if (!videoUrl || !audioUrl) {
        return res.status(400).json({ error: 'Both videoUrl and audioUrl are required.' });
    }

    const outputFile = `merged_${Date.now()}.mp4`;
    const outputPath = path.join(downloadsPath, outputFile);
    const command = `ffmpeg -i "${videoUrl}" -i "${audioUrl}" -c:v copy -c:a aac -strict experimental "${outputPath}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error('FFmpeg error:', stderr);
            return res.status(500).json({ error: 'Failed to merge video and audio', details: stderr });
        }
        res.json({ downloadUrl: `${BASE_URL}/downloads/${outputFile}` });
    });
});

// ✅ Extract video/audio stream info using yt-dlp
app.post('/api/video-info', (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required.' });
    }

    execFile('python3', ['controllers/youtubeController.py', url], (error, stdout, stderr) => {
        if (error) {
            console.error('Python execution error:', stderr);
            return res.status(500).json({ error: 'Failed to extract video info', details: stderr });
        }

        try {
            const result = JSON.parse(stdout);
            res.json(result);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            res.status(500).json({ error: 'Failed to parse Python output', details: parseError.message });
        }
    });
});

// ✅ Check if FFmpeg is installed
app.get('/api/check-ffmpeg', (req, res) => {
    exec('ffmpeg -version', (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({ error: 'FFmpeg not installed', details: stderr });
        }
        res.json({ message: 'FFmpeg is installed', version: stdout.split('\n')[0] });
    });
});

app.listen(port, () => {
    console.log(`Server running on ${BASE_URL}`);
});
