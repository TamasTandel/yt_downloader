// File: server.js
const express = require('express');
const cors = require('cors');
const { exec, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 5000;

// ✅ Allow frontend from Vercel
app.use(cors({
  origin: 'https://yt-download-fron.vercel.app'
}));

app.use(express.json());

// ✅ Ensure downloads directory exists
const downloadsPath = path.join(__dirname, 'downloads');
if (!fs.existsSync(downloadsPath)) fs.mkdirSync(downloadsPath);

// ✅ Serve static files
app.use('/downloads', express.static(downloadsPath));

// 🎬 Merge video and audio
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

    const fullUrl = `${req.protocol}://${req.get('host')}/downloads/${outputFile}`;
    res.json({ downloadUrl: fullUrl });
  });
});

// 📹 Get video info
app.post('/api/video-info', (req, res) => {
  const { url } = req.body;
  execFile('python3', ['controllers/youtubeController.py', url], (error, stdout, stderr) => {
    if (error) {
      console.error('Python error:', stderr);
      return res.status(500).json({ error: stderr });
    }

    try {
      const result = JSON.parse(stdout);
      result.downloadUrl = `${req.protocol}://${req.get('host')}/downloads/${encodeURIComponent(result.video_filename)}`;
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
