#!/usr/bin/env python3
"""Native-canvas Keep-only Dune2 transparency. Offline; one frame in memory.

prepare archives and stages only; apply resumes a hash-checked two-file journal.
Requires Pillow, NumPy, OpenCV, ffmpeg, ffprobe, Node. No runtime adapter imports.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from fractions import Fraction

import cv2
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT.parent / 'lanternwake/tools/bot_cleanup_helpers.py'
PIN = '2a0754d3e9b899aeb90002533ddb75d2cd110f47'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def file_hash(path):
    with open(path, 'rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + '.tmp')
    with open(tmp, 'wb') as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    os.replace(tmp, path)


def save_json(path, value):
    atomic(path, (json.dumps(value, indent=2, ensure_ascii=False) + '\n').encode())


def load_helper(path=HELPER):
    spec = importlib.util.spec_from_file_location('ad_pinned_cleanup', path)
    module = importlib.util.module_from_spec(spec)
    bytecode = sys.dont_write_bytecode
    sys.dont_write_bytecode = True
    try:
        spec.loader.exec_module(module)
    finally:
        sys.dont_write_bytecode = bytecode
    if module.SOURCE_COMMIT != PIN:
        raise ValueError('Cleanup provenance changed; inspect the pinned helper first')
    return module


def border(a):
    return np.concatenate((a[0], a[-1], a[1:-1, 0], a[1:-1, -1]))


def inspect_alpha(a):
    alpha = a[:, :, 3]
    edge = border(a)
    transparent = alpha == 0
    # RGBA containers with opaque mattes are not transparent artwork. Require
    # real exterior alpha and reject a substantial residual chroma border.
    rgb = edge[:, :3].astype(np.int16)
    chroma = np.minimum(np.max(np.abs(rgb - [255, 0, 255]), axis=1),
                        np.max(np.abs(rgb - [0, 255, 0]), axis=1)) <= 92
    opaque_chroma = (edge[:, 3] > 0) & chroma
    genuine = bool(transparent.any() and np.mean(edge[:, 3] == 0) >= .95
                   and np.mean(opaque_chroma) < .005)
    return {'transparent_pixels': int(transparent.sum()),
            'partial_pixels': int(((alpha > 0) & (alpha < 255)).sum()),
            'opaque_pixels': int((alpha == 255).sum()),
            'transparent_border_fraction': float(np.mean(edge[:, 3] == 0)),
            'opaque_chroma_border_pixels': int(opaque_chroma.sum()),
            'genuine_alpha': genuine}


def choose_matte(a):
    edge = border(a)
    visible = edge[edge[:, 3] > 0, :3]
    if not len(visible):
        raise ValueError('No opaque border from which to establish a matte')
    middle = np.median(visible, axis=0)
    options = [(255, 0, 255), (0, 255, 0)]
    matte = min(options, key=lambda c: np.max(np.abs(middle - c)))
    if np.max(np.abs(middle - matte)) > 92:
        raise ValueError(f'Unrecognized border matte {middle.tolist()}; source needs review')
    return matte


def clean_frame(image, bot):
    before = np.array(image.convert('RGBA'))
    alpha = inspect_alpha(before)
    if alpha['genuine_alpha']:
        return image.convert('RGBA'), {'input_alpha': alpha, 'preserved': True, 'counts': {}}
    matte = choose_matte(before)
    result, counts = bot._dune2_apply_cleanup_stack_frame(
        image.convert('RGBA'), cleanup_order=('matte', 'despill'), matte_rgb=matte,
        global_matte_tolerance=92, outline_cleanup_depth=4)
    after = np.array(result)
    key = (np.max(np.abs(before[:, :, :3].astype(np.int16) - matte), axis=2) <= 92) & (before[:, :, 3] > 0)
    band = cv2.dilate(key.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)), iterations=4).astype(bool)
    protected = (before[:, :, 3] > 0) & ~band
    changed = np.any(before != after, axis=2)
    violations = int((protected & changed).sum())
    if violations:
        raise ValueError(f'{violations} protected interior pixels changed')
    output_alpha = inspect_alpha(after)
    if not output_alpha['genuine_alpha']:
        raise ValueError('Cleanup did not establish transparent exterior')
    rgb = before[:, :, :3].astype(np.int16)
    colors = {'white': rgb.min(axis=2) >= 200,
              'blue': (rgb[:, :, 2] >= 150) & (rgb[:, :, 0] < 120),
              'green': (rgb[:, :, 1] >= 130) & (rgb[:, :, 0] < 150),
              'red_gear': (rgb[:, :, 0] >= 130) & (rgb[:, :, 1] < 120) & (rgb[:, :, 2] < 140)}
    metrics = {}
    for name, mask in colors.items():
        mask &= before[:, :, 3] > 0
        metrics[name] = {'pixels': int(mask.sum()), 'protected': int((mask & protected).sum()),
                         'changed': int((mask & changed).sum()),
                         'removed': int((mask & (after[:, :, 3] == 0)).sum()),
                         'protected_changed': int((mask & protected & changed).sum())}
    return result, {'input_alpha': alpha, 'output_alpha': output_alpha, 'preserved': False,
                    'matte_rgb': matte, 'counts': counts, 'protected_pixels': int(protected.sum()),
                    'protected_changed': violations, 'protected_before_sha256': digest(before[protected].tobytes()),
                    'protected_after_sha256': digest(after[protected].tobytes()), 'colors': metrics,
                    'changed_pixels': int(changed.sum()), 'keyed_pixels': int(key.sum())}


def video_timing(probe):
    stream = probe['streams'][0]
    time_base = Fraction(stream['time_base'])
    frames = probe['frames']
    points = [int(f['best_effort_timestamp']) for f in frames]
    if any(b <= a for a, b in zip(points, points[1:])):
        raise ValueError('Video PTS is not strictly increasing')
    durations = []
    for i, frame in enumerate(frames):
        ticks = points[i + 1] - points[i] if i + 1 < len(points) else int(frame.get('duration', frame.get('pkt_duration', 0)))
        if ticks <= 0:
            raise ValueError('Missing final native frame duration')
        durations.append(Fraction(ticks) * time_base)
    return durations


def repaired_timing(review_probe, original_probe):
    """Use authoritative native PTS only for a one-to-one quantized repair."""
    review = video_timing(review_probe)
    original = video_timing(original_probe)
    if len(review) != len(original):
        raise ValueError('Repair changed native frame count')
    tick = Fraction(review_probe['streams'][0]['time_base'])
    def points(probe):
        base = Fraction(probe['streams'][0]['time_base'])
        first = int(probe['frames'][0]['best_effort_timestamp'])
        return [(int(f['best_effort_timestamp']) - first) * base for f in probe['frames']]
    errors = [abs(a - b) for a, b in zip(points(review_probe), points(original_probe))]
    if max(errors) > tick or any(abs(a - b) > tick for a, b in zip(review, original)):
        raise ValueError('Repair timing differs beyond container quantization')
    return original, {'mapping': 'one-to-one-original-native-PTS', 'repair_time_base': str(tick),
                      'max_pts_rounding_seconds': float(max(errors)),
                      'repair_container_seconds': float(sum(review)),
                      'authoritative_native_seconds': float(sum(original))}


def probe_video(path):
    return json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0',
        '-show_frames', '-show_streams', '-show_entries',
        'stream=width,height,time_base,avg_frame_rate,duration_ts:frame=best_effort_timestamp,duration,pkt_duration',
        '-of', 'json', str(path)], text=True))


def native_frames(path, size, count):
    command = ['ffmpeg', '-nostdin', '-v', 'error', '-threads', '1', '-i', str(path), '-map', '0:v:0',
               '-fps_mode', 'passthrough', '-threads', '1', '-f', 'rawvideo', '-pix_fmt', 'rgba', 'pipe:1']
    process = subprocess.Popen(command, stdout=subprocess.PIPE)
    length = size[0] * size[1] * 4
    try:
        for _ in range(count):
            raw = process.stdout.read(length)
            if len(raw) != length:
                raise ValueError('Native decoder produced too few frames')
            yield Image.frombytes('RGBA', size, raw)
        if process.stdout.read(1):
            raise ValueError('Native decoder produced extra frames')
        if process.wait() != 0:
            raise ValueError('Native decoder failed')
    finally:
        process.stdout.close()
        if process.poll() is None:
            process.kill()
            process.wait()


def resource(root, url):
    path = root / url
    if path.resolve().parent not in [(root / 'assets').resolve(), (root / 'videos').resolve()] or path.is_symlink():
        raise ValueError('Unsafe media path')
    if file_hash(path) != path.stem:
        raise ValueError('Media hash mismatch: ' + url)
    return path


def archive(root, work, data_bytes, state_bytes, selected):
    for name, content in [('before-data.json', data_bytes), ('before-review-state.json', state_bytes)]:
        target = work / name
        if target.exists() and target.read_bytes() != content:
            raise ValueError('Conflicting before snapshot')
        atomic(target, content)
    refs = {}
    for candidate in selected:
        for item in candidate['frames'] + [candidate[k] for k in ('original_video', 'review_video') if k in candidate]:
            refs[item['url']] = item['sha256']
    for url, expected in refs.items():
        source = resource(root, url)
        dest = work / 'before-media' / url
        dest.parent.mkdir(parents=True, exist_ok=True)
        if not dest.exists():
            temporary = dest.with_name(dest.name + '.tmp')
            shutil.copyfile(source, temporary)
            if file_hash(temporary) != expected:
                raise ValueError('Archive copy hash mismatch')
            os.replace(temporary, dest)
        if file_hash(dest) != expected:
            raise ValueError('Archive hash mismatch')
    save_json(work / 'before-hashes.json', {'data.json': digest(data_bytes), 'review-state.json': digest(state_bytes), 'media': refs})


def sample_sheet(path, samples):
    width, height = 256, 384
    sheet = Image.new('RGB', (width * 6, (height + 24) * len(samples)))
    draw = ImageDraw.Draw(sheet)
    for row, (number, source, output) in enumerate(samples):
        for col, background in enumerate(('light', 'dark', 'checker')):
            base = Image.new('RGBA', output.size, (238, 238, 238, 255) if background == 'light' else (24, 24, 24, 255))
            if background == 'checker':
                yy, xx = np.indices((output.height, output.width))
                a = np.where(((yy // 24 + xx // 24) % 2)[..., None], [190, 190, 190, 255], [100, 100, 100, 255]).astype(np.uint8)
                base = Image.fromarray(a, 'RGBA')
            for side, image in enumerate((source, output)):
                composed = Image.alpha_composite(base, image)
                composed.thumbnail((width, height), Image.Resampling.LANCZOS)
                x, y = (col * 2 + side) * width, row * (height + 24)
                sheet.paste(composed.convert('RGB'), (x, y + 24))
                draw.text((x + 4, y + 4), f'{number} {background} {"before" if side == 0 else "after"}', fill='white')
    sheet.save(path)


def prepare(root, work, data, selected, bot):
    staged = work / 'staged'
    staged.mkdir(exist_ok=True)
    reports = []
    for candidate in selected:
        output_candidate = json.loads(json.dumps(candidate))
        name = candidate['name']
        report_file = work / (name + '.json')
        result_file = work / (name + '.candidate.json')
        if result_file.exists():
            cached = json.loads(result_file.read_text(encoding='utf-8'))
            evidence = json.loads(report_file.read_text(encoding='utf-8'))
            if evidence['helper_sha256'] != file_hash(HELPER):
                raise ValueError('Helper changed during interrupted processing')
            for frame in cached['frames']:
                target = staged / Path(frame['url']).name
                if not target.exists():
                    target = root / frame['url']
                if file_hash(target) != frame['sha256']:
                    raise ValueError('Cached output changed')
            reports.append(evidence)
            data['sets'][data['sets'].index(candidate)] = cached
            continue
        print('Processing ' + name, flush=True)
        native = candidate.get('review_mode') == 'native-video'
        video = candidate.get('review_video', candidate.get('original_video')) if native else None
        probe = probe_video(resource(root, video['url'])) if native else None
        timing = video_timing(probe) if native else None
        timing_probe, timing_mapping = None, None
        if native and candidate.get('review_video'):
            timing_probe = probe_video(resource(root, candidate['original_video']['url']))
            timing, timing_mapping = repaired_timing(probe, timing_probe)
        size = tuple(candidate.get('geometry', {}).get('canvas', candidate['actual_dimensions'][0]))
        if native:
            stream = probe['streams'][0]
            if (stream['width'], stream['height']) != size or len(timing) != candidate['native_frame_count']:
                raise ValueError('Native video geometry/count disagrees with approved catalog')
            if abs(float(sum(timing)) * 1000 - candidate['duration_verified_ms']) > .01:
                raise ValueError('Native video duration disagrees with approved catalog')
            images = native_frames(root / video['url'], size, len(timing))
            originals = [{'source_frame': i + 1, 'duration_numerator': t.numerator, 'duration_denominator': t.denominator} for i, t in enumerate(timing)]
        else:
            def existing():
                for frame in candidate['frames']:
                    with Image.open(resource(root, frame['url'])) as image:
                        yield image.convert('RGBA')
            images = existing()
            originals = candidate['frames']
        metrics, frames, samples = [], [], []
        preserve_bank = True
        for index, (image, original) in enumerate(zip(images, originals, strict=True)):
            if image.size != size:
                raise ValueError('Frame canvas differs from approved geometry')
            output, metric = clean_frame(image, bot)
            raw_hash = digest(image.tobytes())
            output_hash = digest(output.tobytes())
            preserve = metric['preserved'] and not native
            preserve_bank &= preserve
            frame = dict(original)
            if not preserve:
                buffer = io.BytesIO()
                output.save(buffer, format='WEBP', lossless=True, method=0, exact=True)
                encoded = buffer.getvalue()
                with Image.open(io.BytesIO(encoded)) as check:
                    if check.convert('RGBA').tobytes() != output.tobytes():
                        raise ValueError('Lossless encoder changed RGBA')
                sha = digest(encoded)
                atomic(staged / (sha + '.webp'), encoded)
                frame.update(url='assets/' + sha + '.webp', sha256=sha, rgba_sha256=output_hash)
            frames.append(frame)
            metric.update(index=index + 1, source_frame=original.get('source_frame'),
                          input_file_sha256=original.get('sha256'), input_rgba_sha256=raw_hash,
                          output_file_sha256=frame['sha256'], output_rgba_sha256=output_hash,
                          size=list(size), duration_ms=float(timing[index]) * 1000 if native else candidate['durations'][index])
            metrics.append(metric)
            if index in {0, len(originals) // 2, len(originals) - 1}:
                samples.append((original.get('source_frame', index + 1), image.copy(), output.copy()))
        report = {'schema': 'ad-keep-transparency-evidence-v1', 'asset': name, 'helper_commit': PIN,
                  'helper_sha256': file_hash(HELPER), 'processor_sha256': file_hash(Path(__file__)),
                  'input_video': video, 'probe': probe, 'timing_probe': timing_probe,
                  'timing_mapping': timing_mapping, 'preserved_bank': preserve_bank,
                  'frames': metrics, 'sample_sheet': name + '.samples.png'}
        sample_sheet(work / report['sample_sheet'], samples)
        save_json(report_file, report)
        if not preserve_bank:
            output_candidate['frames'] = frames
            if native:
                output_candidate.pop('review_mode')
                output_candidate['durations'] = [float(t) * 1000 for t in timing]
                output_candidate['duration_verified_ms'] = float(sum(timing)) * 1000
            output_candidate['unique_frame_files'] = len({f['sha256'] for f in frames})
            output_candidate.pop('unique_png_files', None)
            transparency = {'schema': 'ad-keep-transparency-v1', 'method': 'native-matte-despill',
                            'helper_commit': PIN, 'helper_sha256': file_hash(HELPER),
                            'tolerance': 92, 'edge_depth': 4, 'matte_rgb': list(choose_matte(np.array(samples[0][1]))),
                            'evidence_sha256': file_hash(report_file),
                            'input_basis': 'review-video' if video and candidate.get('review_video') else 'original-video' if native else 'approved-frames'}
            if video:
                transparency['input_video_sha256'] = video['sha256']
                if timing_probe:
                    transparency['timing_video_sha256'] = candidate['original_video']['sha256']
            source = output_candidate['source']
            prior = {k: source.pop(k) for k in ('protected_component_rgba_unchanged', 'review_rgb_lossless_verified') if k in source}
            if prior:
                transparency['prior_repair'] = {**prior, 'review_video_sha256': candidate['review_video']['sha256'],
                                                'processing_evidence_sha256': source['processing_evidence_sha256']}
            if source.get('processing'):
                source['processing'] = source['processing'].replace('Unchanged native RGB frames', 'Selected native source frames') + ' Subsequent native matte/despill changes preview boundary RGB/alpha; prior repair proofs describe retained source media.'
            source['preview_basis'] = 'transparent-native-frames'
            source['review_frame_encoding'] = 'webp-lossless-rgba'
            output_candidate['transparency'] = transparency
        save_json(result_file, output_candidate)
        data['sets'][data['sets'].index(candidate)] = output_candidate
        reports.append(report)
        print(json.dumps({'asset': name, 'frames': len(frames), 'preserved_bank': preserve_bank,
                          'genuine_alpha_inputs': sum(m['input_alpha']['genuine_alpha'] for m in metrics)}), flush=True)
    save_json(work / 'proposed-data.json', data)
    summary = {'animations': len(reports), 'preserved_banks': sum(r['preserved_bank'] for r in reports),
               'timeline_frames': sum(len(r['frames']) for r in reports),
               'genuine_alpha_input_frames': sum(m['input_alpha']['genuine_alpha'] for r in reports for m in r['frames']),
               'converted_banks': [r['asset'] for r in reports if not r['preserved_bank']]}
    save_json(work / 'summary.json', summary)
    print(json.dumps(summary, indent=2))
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['prepare', 'apply'])
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--work', type=Path, help='Resume an existing private transaction')
    args = parser.parse_args()
    root = args.root.resolve()
    data_bytes = (root / 'data.json').read_bytes()
    state_bytes = (root / 'review-state.json').read_bytes()
    data, state = json.loads(data_bytes), json.loads(state_bytes)
    work = args.work.resolve() if args.work else root / '.local/transparency' / (digest(data_bytes)[:16] + '-' + digest(state_bytes)[:16])
    if not work.is_relative_to(root / '.local/transparency'):
        raise ValueError('Work must remain in the private AD transparency archive')
    if (work / 'transaction.json').exists():
        if args.command == 'apply':
            subprocess.run(['node', str(ROOT / 'tools/apply-transparency.mjs'), '--root', str(root), '--work', str(work)], check=True)
        print(str(work))
        return
    selected = [s for s in data['sets'] if state['decisions'].get(s['name'], {}).get('decision') == 'keep'
                and s.get('media_kind', 'animation') == 'animation' and not s.get('transparency')]
    if not selected:
        print('No unprocessed Keep animations.'); return
    archive(root, work, data_bytes, state_bytes, selected)
    summary = prepare(root, work, data, selected, load_helper())
    print('Private evidence: ' + str(work))
    if args.command == 'apply' and summary['converted_banks']:
        subprocess.run(['node', str(ROOT / 'tools/apply-transparency.mjs'), '--root', str(root), '--work', str(work)], check=True)


if __name__ == '__main__':
    main()
