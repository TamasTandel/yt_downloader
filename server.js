const express = require('express');
const cors = require('cors');
const { execFile } = require('child_process');
const path = require('path');
const app = express();
const port = process.env.PORT || 5000;
const fs = require('fs');

app.use(cors());
app.use(express.json());
const { exec } = require('child_process');

app.post('/api/merge', (req, res) => {
    const { videoUrl, audioUrl } = req.body;
    const outputFile = `downloads/merged_${Date.now()}.mp4`;
    const outputPath = path.join(__dirname, outputFile);

const command = `ffmpeg -i "${videoUrl}" -i "${audioUrl}" -c:v copy -c:a aac -strict experimental "${outputPath}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error('FFmpeg error:', stderr);
            return res.status(500).json({ error: 'Failed to merge video and audio' });
        }
        res.json({ downloadUrl: `http://localhost:5000/${outputFile}` });
    });
});

const downloadsPath = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsPath)) fs.mkdirSync(downloadsPath);
app.use('/downloads', express.static(downloadsPath));

app.post('/api/video-info', (req, res) => {
    const { url } = req.body;
    execFile('C:/Users/tamas/AppData/Local/Programs/Python/Python314/python.exe', ['controllers/youtubeController.py', url], (error, stdout, stderr) => {
        if (error) {
            console.error('Python error:', stderr);
            return res.status(500).json({ error: stderr });
        }
        try {
            const result = JSON.parse(stdout);
            result.downloadUrl = `http://localhost:5000/downloads/${encodeURIComponent(result.video_filename)}`;
            res.json(result);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            res.status(500).json({ error: 'Failed to parse Python output' });
        }
    });
});

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
