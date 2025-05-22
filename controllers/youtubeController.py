import sys
import os
import json
from yt_dlp import YoutubeDL

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No URL provided'}))
        return

    url = sys.argv[1]
    cookies_path = '/etc/secrets/cookies_txt'

    ydl_opts = {
        'quiet': True,
        'skip_download': True,
        'forcejson': True,
        'cookies': cookies_path if os.path.exists(cookies_path) else None
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            video_audio_formats = []
            video_only_formats = []
            audio_only_formats = []

            for f in info.get('formats', []):
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
                'title': info.get('title', 'Unknown Title'),
                'thumbnail': info.get('thumbnail'),
                'video_audio_formats': video_audio_formats,
                'video_only_formats': video_only_formats,
                'audio_only_formats': audio_only_formats
            }

            print(json.dumps(result))

    except Exception as e:
        print(json.dumps({'error': 'Failed to extract video info', 'details': str(e)}))

if __name__ == '__main__':
    main()
