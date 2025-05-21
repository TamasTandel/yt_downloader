import sys
import json
from yt_dlp import YoutubeDL

url = sys.argv[1]

ydl_opts = {
    'quiet': True,
    'skip_download': True,
    'forcejson': True,
    'cookiefile': 'controllers/cookies.txt'
}

with YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info(url, download=False)
    video_audio_formats = []
    video_only_formats = []
    audio_only_formats = []

    for f in info['formats']:
        if f.get('ext') == 'mp4' and f.get('height') and f.get('width'):
            if f.get('acodec') != 'none' and f.get('vcodec') != 'none':
                video_audio_formats.append({
                    'format_id': f['format_id'],
                    'ext': f['ext'],
                    'resolution': f"{f['height']}x{f['width']}",
                    'url': f['url'],
                    'filesize': f.get('filesize')
                })
            elif f.get('vcodec') != 'none' and f.get('acodec') == 'none':
                video_only_formats.append({
                    'format_id': f['format_id'],
                    'ext': f['ext'],
                    'resolution': f"{f['height']}x{f['width']}",
                    'url': f['url'],
                    'filesize': f.get('filesize')
                })
        elif f.get('acodec') != 'none' and f.get('vcodec') == 'none':
            audio_only_formats.append({
                'format_id': f['format_id'],
                'ext': f['ext'],
                'abr': f.get('abr', 'N/A'),
                'url': f['url'],
                'filesize': f.get('filesize')
            })

    result = {
        'title': info['title'],
        'thumbnail': info['thumbnail'],
        'video_audio_formats': video_audio_formats,
        'video_only_formats': video_only_formats,
        'audio_only_formats': audio_only_formats,
        'video_filename': f"{info['title'].replace(' ', '_')}.mp4",
        'filesize': f.get('filesize')
    }

    print(json.dumps(result))
