import importlib.util
from pathlib import Path
import unittest
from fractions import Fraction

import numpy as np
from PIL import Image, ImageDraw

spec = importlib.util.spec_from_file_location('keep_transparency', Path(__file__).with_name('keep-transparency.py'))
kt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(kt)
BOT = kt.load_helper()


class NativeTransparencyTests(unittest.TestCase):
    def test_real_alpha_is_preserved_but_opaque_rgba_is_cleaned(self):
        source = Image.new('RGBA', (80, 120), (255, 0, 255, 255))
        ImageDraw.Draw(source).rectangle((20, 20, 59, 99), fill=(80, 70, 60, 255))
        self.assertFalse(kt.inspect_alpha(np.array(source))['genuine_alpha'])
        cleaned, metric = kt.clean_frame(source, BOT)
        self.assertEqual(cleaned.size, source.size)
        self.assertEqual(cleaned.getpixel((0, 0)), (0, 0, 0, 0))
        self.assertFalse(metric['preserved'])
        again, metric = kt.clean_frame(cleaned, BOT)
        self.assertTrue(metric['preserved'])
        self.assertEqual(again.tobytes(), cleaned.tobytes())

    def test_tiny_alpha_hole_does_not_disguise_an_opaque_matte(self):
        source = Image.new('RGBA', (80, 120), (255, 0, 255, 255))
        source.putpixel((0, 0), (0, 0, 0, 0))
        ImageDraw.Draw(source).rectangle((20, 20, 59, 99), fill=(80, 70, 60, 255))
        self.assertFalse(kt.inspect_alpha(np.array(source))['genuine_alpha'])
        cleaned, metric = kt.clean_frame(source, BOT)
        self.assertFalse(metric['preserved'])
        self.assertEqual(cleaned.getpixel((79, 119))[3], 0)

    def test_protected_white_blue_green_and_red_interiors_remain_exact(self):
        for matte in ((255, 0, 255), (0, 255, 0)):
            source = Image.new('RGBA', (120, 160), matte + (255,))
            draw = ImageDraw.Draw(source)
            draw.rectangle((15, 15, 104, 144), fill=(80, 70, 60, 255))
            colors = [(240, 240, 240, 255), (20, 90, 240, 255), (40, 140, 70, 255), (210, 50, 40, 255)]
            for i, color in enumerate(colors):
                draw.rectangle((40, 30 + i * 25, 70, 45 + i * 25), fill=color)
            # An edge composited over matte must be unmixed, not falsely claimed unchanged.
            spill = tuple(round(.6 * c + .4 * m) for c, m in zip((80, 80, 80), matte)) + (255,)
            source.putpixel((15, 80), spill)
            cleaned, metric = kt.clean_frame(source, BOT)
            for i, color in enumerate(colors):
                self.assertEqual(cleaned.getpixel((50, 35 + i * 25)), color)
            self.assertNotEqual(cleaned.getpixel((15, 80)), spill)
            self.assertEqual(metric['protected_changed'], 0)
            self.assertEqual(metric['protected_before_sha256'], metric['protected_after_sha256'])

    def test_pts_differences_and_last_duration_are_rational(self):
        probe = {'streams': [{'time_base': '1/1000'}], 'frames': [
            {'best_effort_timestamp': 100, 'pkt_duration': 42},
            {'best_effort_timestamp': 142, 'pkt_duration': 41},
            {'best_effort_timestamp': 183, 'pkt_duration': 42}]}
        self.assertEqual(kt.video_timing(probe), [Fraction(42, 1000), Fraction(41, 1000), Fraction(42, 1000)])
        probe['frames'][-1].pop('pkt_duration')
        with self.assertRaisesRegex(ValueError, 'final native frame duration'):
            kt.video_timing(probe)

    def test_repaired_webm_rounding_retains_authoritative_native_cadence(self):
        native = {'streams': [{'time_base': '1/24'}], 'frames': [
            {'best_effort_timestamp': i, 'pkt_duration': 1} for i in range(3)]}
        repaired = {'streams': [{'time_base': '1/1000'}], 'frames': [
            {'best_effort_timestamp': t, 'pkt_duration': 42} for t in (0, 42, 83)]}
        durations, proof = kt.repaired_timing(repaired, native)
        self.assertEqual(durations, [Fraction(1, 24)] * 3)
        self.assertLess(proof['max_pts_rounding_seconds'], .001)
        repaired['frames'][1]['best_effort_timestamp'] = 45
        with self.assertRaisesRegex(ValueError, 'beyond container quantization'):
            kt.repaired_timing(repaired, native)

    def test_nonmonotonic_pts_and_unknown_mattes_stop_the_source(self):
        with self.assertRaisesRegex(ValueError, 'PTS'):
            kt.video_timing({'streams': [{'time_base': '1/24'}], 'frames': [
                {'best_effort_timestamp': 0}, {'best_effort_timestamp': 0}]})
        with self.assertRaisesRegex(ValueError, 'Unrecognized border matte'):
            kt.clean_frame(Image.new('RGBA', (20, 30), (80, 80, 80, 255)), BOT)


if __name__ == '__main__':
    unittest.main()
