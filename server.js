require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { exec, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 5000;
const BASE_URL = process.env.BASE_URL;

app.use(cors({
    origin: 'https://yt-download-fron.vercel.app'
}));
app.use(express.json());

const downloadsPath = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsPath)) fs.mkdirSync(downloadsPath);
app.use('/downloads', express.static(downloadsPath));

app.post('/api/merge', (req, res) => {
    const { videoUrl, audioUrl } = req.body;
    const outputFile = `merged_${Date.now()}.mp4`;
    const outputPath = path.join(downloadsPath, outputFile);

    const command = `ffmpeg -i "${videoUrl}" -i "${audioUrl}" -c:v copy -c:a aac -strict experimental "${outputPath}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error('FFmpeg error:', stderr);
            return res.status(500).json({ error: 'Failed to merge video and audio' });
        }
        res.json({ downloadUrl: `${BASE_URL}/downloads/${outputFile}` });
    });
});

app.post('/api/video-info', (req, res) => {
    const { url } = req.body;
    execFile('python3', ['controllers/youtubeController.py', url], (error, stdout, stderr) => {
        if (error) {
            console.error('Python error:', stderr);
            return res.status(500).json({ error: stderr });
        }
        try {
            const result = JSON.parse(stdout);
            result.downloadUrl = `${BASE_URL}/downloads/${encodeURIComponent(result.video_filename)}`;
            res.json(result);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            res.status(500).json({ error: 'Failed to parse Python output' });
        }
    });
});

app.listen(port, () => {
    console.log(`Server running on ${BASE_URL}`);
});
