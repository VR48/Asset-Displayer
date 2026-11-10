#!/usr/bin/env python3
"""Check published decoded RGBA, exact frame mappings and the private before proof."""
import argparse
import importlib.util
import json
from pathlib import Path

import numpy as np
from PIL import Image

spec = importlib.util.spec_from_file_location('keep_transparency', Path(__file__).with_name('keep-transparency.py'))
kt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kt)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--work', type=Path, required=True)
    parser.add_argument('--root', type=Path, default=kt.ROOT)
    args = parser.parse_args()
    root, work = args.root.resolve(), args.work.resolve()
    before = json.loads((work / 'before-data.json').read_bytes())
    old_state = json.loads((work / 'before-review-state.json').read_bytes())
    after = json.loads((root / 'data.json').read_bytes())
    state = json.loads((root / 'review-state.json').read_bytes())
    current = {s['name']: s for s in after['sets']}
    assert len(current) == len(before['sets'])
    hashes = json.loads((work / 'before-hashes.json').read_bytes())
    assert kt.file_hash(work / 'before-data.json') == hashes['data.json']
    assert kt.file_hash(work / 'before-review-state.json') == hashes['review-state.json']
    for url, sha in hashes['media'].items():
        assert kt.file_hash(work / 'before-media' / url) == sha
    counts = {'animations': 0, 'frames': 0, 'preserved_frames': 0, 'converted_frames': 0,
              'native_video_frames': 0, 'protected_changed': 0, 'images_unchanged': 0}
    for original in before['sets']:
        candidate = current[original['name']]
        entry = old_state['decisions'].get(original['name'])
        assert state['decisions'].get(original['name'], {}).get('decision') == (entry or {}).get('decision')
        if original.get('media_kind') == 'image' or not entry or entry['decision'] != 'keep':
            assert candidate == original
            if original.get('media_kind') == 'image':
                counts['images_unchanged'] += 1
            continue
        counts['animations'] += 1
        report_path = work / (original['name'] + '.json')
        report = json.loads(report_path.read_bytes())
        if candidate.get('transparency'):
            assert candidate['transparency']['evidence_sha256'] == kt.file_hash(report_path)
        assert candidate['geometry'] == original['geometry']
        assert candidate['actual_dimensions'] == original['actual_dimensions']
        assert candidate.get('original_video') == original.get('original_video')
        assert candidate.get('review_video') == original.get('review_video')
        assert abs(candidate['duration_verified_ms'] - original['duration_verified_ms']) < .01
        if original.get('review_mode') == 'native-video':
            assert len(candidate['frames']) == original['native_frame_count']
            timing = kt.repaired_timing(report['probe'], report['timing_probe'])[0] if report.get('timing_probe') else kt.video_timing(report['probe'])
            assert candidate['durations'] == [float(t) * 1000 for t in timing]
            assert [f['source_frame'] for f in candidate['frames']] == list(range(1, original['native_frame_count'] + 1))
            counts['native_video_frames'] += len(candidate['frames'])
        else:
            assert candidate['durations'] == original['durations']
            for old, new in zip(original['frames'], candidate['frames'], strict=True):
                assert {k: v for k, v in old.items() if k not in ('url', 'sha256', 'rgba_sha256')} == {k: v for k, v in new.items() if k not in ('url', 'sha256', 'rgba_sha256')}
        for frame, metric, duration in zip(candidate['frames'], report['frames'], candidate['durations'], strict=True):
            path = kt.resource(root, frame['url'])
            with Image.open(path) as decoded:
                rgba = decoded.convert('RGBA')
                assert list(rgba.size) == metric['size']
                assert kt.digest(rgba.tobytes()) == metric['output_rgba_sha256']
                assert kt.inspect_alpha(np.array(rgba))['genuine_alpha']
            assert frame['sha256'] == metric['output_file_sha256']
            assert frame.get('rgba_sha256', metric['output_rgba_sha256']) == metric['output_rgba_sha256']
            assert frame.get('source_frame') == metric['source_frame']
            assert duration == metric['duration_ms']
            assert metric.get('protected_changed', 0) == 0
            if metric['preserved']:
                assert kt.file_hash(path) == metric['input_file_sha256']
                assert metric['input_rgba_sha256'] == metric['output_rgba_sha256']
                counts['preserved_frames'] += 1
            else:
                assert metric['protected_before_sha256'] == metric['protected_after_sha256']
                counts['converted_frames'] += 1
            counts['frames'] += 1
        print(original['name'] + ': decoded alpha/geometry/timing verified')
    rear = current.get('jane-walk-rear-v2')
    if rear:
        for name in ('jane-walk-rear-cycle-cut-v1', 'jane-walk-rear-stop-cut-v1'):
            cut = current.get(name)
            if cut:
                for f in cut['frames']:
                    parent = rear['frames'][f['source_frame'] - 1]
                    assert f['sha256'] == parent['sha256']
                    assert f['rgba_sha256'] == parent['rgba_sha256']
    for candidate in after['sets']:
        for key in ('original_video', 'review_video'):
            if key in candidate:
                kt.resource(root, candidate[key]['url'])
    counts['keep'] = sum(e['decision'] == 'keep' for e in state['decisions'].values())
    counts['undecided'] = sum(e['decision'] == 'undecided' for e in state['decisions'].values())
    counts['revision'] = state['revision']
    kt.save_json(work / 'decoded-verification.json', counts)
    print(json.dumps(counts, indent=2))


if __name__ == '__main__':
    main()
