"""Import completed, reviewed raw MJ walks and their original MP4s for review.
Usage: python tools/import-seb-walks.py /absolute/path/to/lanternwake
"""
from pathlib import Path
import hashlib
import json
import re
import shutil
import sys

root = Path(__file__).resolve().parent.parent
game = Path(sys.argv[1]).resolve()
source = (game / (sys.argv[2] if len(sys.argv) > 2 else 'art-source/seb/walk-v1')).resolve()
assert source.is_relative_to((game / 'art-source/seb').resolve())
plan_file = source / (sys.argv[3] if len(sys.argv) > 3 else 'manifest.json')
assert plan_file.resolve().parent == source
plan = json.loads(plan_file.read_text(encoding='utf-8'))
assert plan['status'] == 'draft-ready-for-owner-review'
assert 1 <= len(plan['directions']) <= 4
data = json.loads((root / 'data.json').read_text(encoding='utf-8'))
existing = {s['name']: s['number'] for s in data['sets']}
next_number = max(existing.values()) + 1
sha = lambda b: hashlib.sha256(b).hexdigest()
(root / 'videos').mkdir(exist_ok=True)
labels = {'front': 'Front / down', 'rear': 'Rear / up', 'left': 'Left', 'right': 'Right'}
entries = []
for item in plan['directions'] + plan.get('additionalCandidates', []):
    if item.get('ownerReview', {}).get('decision') == 'do-not-add':
        continue
    direction = item['direction']
    assert direction in labels and item['status'] == 'completed'
    assert item['filesCount'] == 1 and item['providerBatchOneConfirmed'] is True
    review_dir = item.get('reviewDirectory', direction)
    assert re.fullmatch(direction + r'(?:-v[1-9][0-9]*)?', review_dir)
    clip = json.loads((source / 'review' / review_dir / 'manifest.json').read_text(encoding='utf-8'))
    assert clip['videoSha256'] == item['outputSha256']
    master_sha = item.get('masterSha256', item['sourceSha256'])
    assert clip['sourceMasterSha256'] == master_sha
    assert clip.get('uploadedSourceSha256', item['sourceSha256']) == item['sourceSha256']
    assert item.get('reviewStatus') == 'candidate'
    video = game / item['outputFile']
    assert sha(video.read_bytes()) == item['outputSha256']
    video_url = f"videos/{item['outputSha256']}.mp4"
    shutil.copyfile(video, root / video_url)
    frames = []
    for frame in clip['frames']:
        local = (source / frame['file']).resolve()
        assert local.is_relative_to((source / 'review' / review_dir / 'frames').resolve())
        payload = local.read_bytes()
        assert sha(payload) == frame['sha256']
        url = f"assets/{frame['sha256']}.png"
        (root / url).write_bytes(payload)
        frames.append(dict(url=url, sha256=frame['sha256'], source_frame=frame['source_frame'],
                           duration_numerator=frame['duration_numerator'], duration_denominator=frame['duration_denominator']))
    name = item.get('assetId', f'seb-walk-{direction}-low-sword-v1')
    assert re.fullmatch(r'seb-(walk|sneak)-' + direction + r'-low-sword-v[1-9][0-9]*', name)
    number = existing.get(name)
    if number is None:
        number = next_number
        next_number += 1
    caveats = ['Raw Midjourney walking candidate from the updated standing master; exactly one --bs 1 video requested and confirmed.',
               'Original MP4 retained unchanged and available to download. PNG review frames preserve chronological timestamps; no trimming, retiming, mirroring or reversed playback.',
               'Magenta background retained. Not cleaned, alpha-keyed, stabilized or integrated into gameplay.',
               'Loop/start-end reference requested; seamless foot contact and loop continuity are not certified by matching endpoints.',
               'Low right-hand sword carry was requested; inspect its actual angle and consistency throughout playback. Left forearm projector remains attached with shield off.']
    caveats.extend(item.get('reviewCaveats', []))
    if item.get('sourceTransform'):
        transform = item['sourceTransform']
        caveats.append(f"Input canvas padded from {transform['originalSize']} to {transform['outputSize']} with solid magenta margins; original character pixels unchanged and unscaled.")
    entries.append(dict(name=name, number=number, approval_category='06_NEW_CHARACTER_CANDIDATES', media_kind='animation',
                        actual_dimensions=[[clip['width'], clip['height']]], unique_png_files=len({f['sha256'] for f in frames}),
                        duration_verified_ms=clip['duration_ms'], durations=clip['durations'], frames=frames,
                        geometry=dict(canvas=[clip['width'], clip['height']]), caveats=caveats,
                        source=dict(provider='Midjourney', mj_job_uuid=item['providerIds'][0], preview_basis='decoded-original-video',
                                    video_sha256=item['outputSha256'], master_sha256=master_sha,
                                    uploaded_source_sha256=item['sourceSha256'],
                                    source_transform=item.get('sourceTransform'),
                                    master_revision=item.get('selectedRevision', 1),
                                    master_asset_id=item.get('masterAssetId', f'seb-master-{direction}-low-sword-v1'), batch_size=1,
                                    speed=plan['speed'], motion=plan['motion'], loop_requested=plan['loop']),
                        original_video=dict(url=video_url, sha256=item['outputSha256'], mime_type='video/mp4'),
                        usage=dict(character='Seb', action=item.get('action', 'Walk in place · low sword'), direction=labels[direction], attacking=False,
                                   status='new-feature', reason='Seb has no existing runtime character bank. This is a new animation candidate for visual review, not authorization to install a new character or replace a gameplay slot.')))
assert len({e['name'] for e in entries}) == len(entries)
names = {s['name'] for s in entries}
data['sets'] = [s for s in data['sets'] if s['name'] not in names] + entries
assert len({s['name'] for s in data['sets']}) == len(data['sets'])
assert len({s['number'] for s in data['sets']}) == len(data['sets'])
(root / 'data.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print(json.dumps(dict(imported=len(entries), frameEntries=sum(len(s['frames']) for s in entries), originalVideos=len(entries), totalSets=len(data['sets']))))
