"""Import existing, reviewed Denis previews without modifying source artwork.

Usage: python tools/import-denis.py /absolute/path/to/lanternwake
Pillow is needed only for import, not for hosting the viewer.
"""
import hashlib
import io
import json
from pathlib import Path
import sys
from PIL import Image

root = Path(__file__).resolve().parent.parent
game = Path(sys.argv[1]).resolve()
data = json.loads((root / 'data.json').read_text(encoding='utf-8'))
sha = lambda b: hashlib.sha256(b).hexdigest()
read = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
idle = game / 'art-source/denis/idle-v5-rear'
previous = game / 'art-source/denis/idle-v4'
stills = game / 'art-source/denis-v6-weathered'
other = read(previous / 'pika-other-results.json')
directions = {'down': 'Front / down', 'left': 'Left', 'right': 'Right', 'up': 'Rear / up'}
category = '06_NEW_CHARACTER_CANDIDATES'
sets = []

def base(name, number, direction, kind, dimensions, geometry, source, caveats):
    return dict(name=name, number=number, approval_category=category,
                media_kind=kind, actual_dimensions=[dimensions], geometry=geometry,
                source=source, caveats=caveats,
                usage=dict(character='Denis', action='Idle' if kind == 'animation' else 'Still reference · shield off',
                           direction=directions[direction], attacking=False, status='new-feature',
                           reason='New character candidate: Denis has no existing playable animation bank or replacement slot.'))

for offset, (direction, label) in enumerate(directions.items()):
    file = idle / f'preview-{direction}.webp'
    original = idle / f'idle-{direction}.mp4'
    if direction != 'up':
        assert file.read_bytes() == (previous / file.name).read_bytes(), 'Retained v4 preview changed'
        assert original.read_bytes() == (previous / original.name).read_bytes(), 'Retained v4 source video changed'
    result = read(idle / 'pika-result.json')['result'] if direction == 'up' else read(previous / 'pika-result.json')['result'] if direction == 'down' else other[direction]['result']
    source = dict(provider='Pika', job_id=result['job_id'], model='Pika 2.5',
                  sha256=sha(original.read_bytes()), preview_sha256=sha(file.read_bytes()),
                  collection='Denis cleaned idle v5 rear' if direction == 'up' else 'Denis cleaned idle v4 retained')
    caveats = ['New character review only; not integrated into Web or Godot.',
               'Existing transparent preview decoded losslessly to PNG; fixed 512px canvas, chronological order and WebP frame durations retained.',
               'The original green-background video is preserved locally. Repeat preview is not a new seamless-loop approval.',
               'These idles use earlier animation masters; the weathered v6 still references are a separate design revision, not new versions of these clips.',
               'Weapon is a pile bunker; energy shield is off. These are idle posture adjustments, not attack animations.']
    caveats.append('New rear take: weapon-supporting arm remains ready; no local lighting correction.' if direction == 'up' else 'Retained v4 preview; left uses its existing local lighting stabilization, with alpha unchanged.' if direction == 'left' else 'Retained v4 preview, with no local lighting correction.')
    with Image.open(file) as image:
        assert image.n_frames == 120 and image.size == (512, 512)
        entry = base(f'denis-idle-{direction}-v5-review', 35 + offset, direction, 'animation',
                     [512, 512], dict(canvas=[512, 512], anchor=[256, 448], renderScale=1), source, caveats)
        frames, durations = [], []
        for i in range(image.n_frames):
            image.seek(i)
            rgba = image.convert('RGBA')
            duration = image.info['duration']
            assert duration > 0
            stream = io.BytesIO()
            rgba.save(stream, format='PNG')
            payload = stream.getvalue()
            frame_sha = sha(payload)
            url = f'assets/{frame_sha}.png'
            (root / url).write_bytes(payload)
            frames.append(dict(url=url, sha256=frame_sha, source_frame=i + 1, duration_ms=duration))
            durations.append(duration)
        assert sum(durations) == 5000
        entry.update(frames=frames, durations=durations, duration_verified_ms=sum(durations),
                     unique_png_files=len({f['sha256'] for f in frames}))
        sets.append(entry)

for offset, sprite in enumerate(read(stills / 'idle-manifest.json')['sprites']):
    direction = sprite['direction']
    payload = (stills / sprite['file']).read_bytes()
    frame_sha = sha(payload)
    assert frame_sha == sprite['sha256']
    with Image.open(stills / sprite['file']) as image:
        assert image.mode == 'RGBA' and list(image.size) == sprite['size']
    url = f'assets/{frame_sha}.png'
    (root / url).write_bytes(payload)
    entry = base(f'denis-reference-{direction}-weathered-v6', 39 + offset, direction, 'image',
                 sprite['size'], dict(canvas=sprite['size'], anchor=sprite['approximateFootAnchor'], renderScale=1),
                 dict(provider='ImageGen', sha256=frame_sha, collection='Denis weathered basic directions v6'),
                 ['Single still character reference, not an animation or gameplay idle loop.',
                  'Original 1024 × 1536 RGBA PNG copied unchanged. Energy shield is off.',
                  'Front retained unchanged; left, right and rear are weathered redraws matching that front.',
                  'Foot anchor is approximate source-review metadata, not runtime calibration.',
                  'New character review only; not integrated into Web or Godot.'])
    entry.update(frames=[dict(url=url, sha256=frame_sha, source_frame=1, duration_ms=1000)],
                 durations=[1000], duration_verified_ms=1000, unique_png_files=1)
    sets.append(entry)

names = {s['name'] for s in sets}
data['sets'] = [s for s in data['sets'] if s['name'] not in names] + sets
assert len({s['name'] for s in data['sets']}) == len(data['sets'])
assert len({s['number'] for s in data['sets']}) == len(data['sets'])
(root / 'data.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print(json.dumps(dict(imported=len(sets), animations=4, stillReferences=4, totalSets=len(data['sets']))))
