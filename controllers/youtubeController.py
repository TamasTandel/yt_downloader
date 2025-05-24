import sys
import os
import json
from yt_dlp import YoutubeDL
import re

def is_valid_youtube_url(url):
    # YouTube URL patterns
    patterns = [
        r'^https?://(?:www\.)?youtube\.com/watch\?v=[\w-]+',
        r'^https?://(?:www\.)?youtube\.com/v/[\w-]+',
        r'^https?://youtu\.be/[\w-]+',
        r'^https?://(?:www\.)?youtube\.com/embed/[\w-]+',
        r'^https?://(?:www\.)?youtube\.com/shorts/[\w-]+'
    ]
    return any(re.match(pattern, url) for pattern in patterns)

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No URL provided'}))
        return

    url = sys.argv[1].strip()
    
    # Validate URL
    if not url:
        print(json.dumps({'error': 'Empty URL provided'}))
        return

    if not is_valid_youtube_url(url):
        print(json.dumps({'error': 'Invalid YouTube URL format'}))
        return

    print(json.dumps({'status': 'Processing URL', 'url': url}), file=sys.stderr)
    
    cookies_path = os.getenv('COOKIES_PATH', os.path.join(os.path.dirname(__file__), '../controllers/cookies_txt'))
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False,
        'forcejson': True,
        'cookies': cookies_path if os.path.exists(cookies_path) else None,
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            print(json.dumps({'status': 'Extracting video info'}), file=sys.stderr)
            info = ydl.extract_info(url, download=False)

            if not info:
                print(json.dumps({'error': 'Could not extract video information'}))
                return

            video_audio_formats = []
            video_only_formats = []
            audio_only_formats = []

            print(json.dumps({'status': 'Processing formats'}), file=sys.stderr)
            
            for f in info.get('formats', []):
                # Get file size or approximate size
                filesize = f.get('filesize') or f.get('filesize_approx')
                
                format_info = {
                    'format_id': f['format_id'],
                    'ext': f['ext'],
                    'url': f['url'],
                    'filesize': filesize,
                    'format_note': f.get('format_note', ''),
                    'tbr': f.get('tbr')  # Total bit rate
                }

                if f.get('ext') == 'mp4' and f.get('height') and f.get('width'):
                    if f.get('acodec') != 'none' and f.get('vcodec') != 'none':
                        format_info.update({
                            'resolution': f"{f['height']}x{f['width']}",
                            'fps': f.get('fps', 'N/A'),
                            'vcodec': f.get('vcodec', 'N/A'),
                            'acodec': f.get('acodec', 'N/A')
                        })
                        video_audio_formats.append(format_info)
                    elif f.get('vcodec') != 'none' and f.get('acodec') == 'none':
                        format_info.update({
                            'resolution': f"{f['height']}x{f['width']}",
                            'fps': f.get('fps', 'N/A'),
                            'vcodec': f.get('vcodec', 'N/A')
                        })
                        video_only_formats.append(format_info)
                elif f.get('acodec') != 'none' and f.get('vcodec') == 'none':
                    format_info.update({
                        'abr': f.get('abr', 'N/A'),
                        'acodec': f.get('acodec', 'N/A')
                    })
                    audio_only_formats.append(format_info)

            result = {
                'title': info.get('title', 'Unknown Title'),
                'thumbnail': info.get('thumbnail'),
                'duration': info.get('duration'),
                'filesize_approx': info.get('filesize_approx'),
                'view_count': info.get('view_count'),
                'url': url,  # Add the original URL
                'video_audio_formats': video_audio_formats,
                'video_only_formats': video_only_formats,
                'audio_only_formats': audio_only_formats
            }

            print(json.dumps({'status': 'Success'}), file=sys.stderr)
            print(json.dumps(result))

    except Exception as e:
        error_message = str(e)
        if 'Video unavailable' in error_message:
            error_message = 'This video is unavailable. It might be private or deleted.'
        elif 'Sign in' in error_message:
            error_message = 'This video requires sign-in. Please try a different video.'
        
        print(json.dumps({
            'error': 'Failed to extract video info',
            'details': error_message,
            'url': url
        }))

if __name__ == '__main__':
    main()
