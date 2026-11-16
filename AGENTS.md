# Asset Displayer workflow

Preserve owner decisions, private review notes, original provider files, native
canvas geometry, source-frame mappings and exact animation timing.

## Kept animation transparency

Owner instruction (2026-11-10): on the next and subsequent handoff-based AD
updates, apply the established transparency workflow to animations marked
**Keep candidate** before publication. Kept animations should preview with real
alpha, not an opaque magenta/green rectangle. Keep entries remain collapsed in
Owner approved and remain present in handoff downloads.

- Inspect existing alpha; preserve already-transparent approved frames.
- Use the pinned Lanternwake Dune2 matte-then-despill helpers in
  `../lanternwake/tools/bot_cleanup_helpers.py`. Preserve their provenance.
- For raw native video, decode every frame at native resolution and timing.
  For repaired previews, use the approved repaired source rather than undoing
  its matte fixes. For selected cuts, retain the exact selected frames.
- Call the cleanup functions on native RGBA frames. Do not use the square
  runtime adapter's default 60-frame/12-fps/128-cell resampling for AD previews.
  Set the actual matte color; preserve camera, common canvas and anchors.
- Keep original MP4s and reviewed source media; publish lossless RGBA previews.
  Do not crop, reframe, stabilize, retime, fill alpha holes or redraw anatomy as
  part of transparency processing.
- Validate edges, hair, weapon, colored equipment and light details against
  originals on dark/light/checker backgrounds. Maintain exact frame order,
  duration and source mappings. Resolve cleanup defects before publishing.
- Preserve Keep and private notes through the authorized presentation change;
  ensure handoff fingerprints/provenance describe the actual displayed version.
  Do not silently discard browser notes or reset approved motion to Undecided.

Owner instruction (2026-11-16): publish all future generated animation candidates
to this repository's GitHub Pages for shared review, including candidates that
need further work. Unapproved generation trials remain raw and Undecided; a
technical rejection does not replace the owner's review. Preserve originals and
label edits truthfully. An explicit request to publish only fixed versions takes
precedence: the current Jane combo repair update publishes repaired versions only,
because the owner already reviewed the originals in MJ Web.

Redo slots reserve their original numbers and receive versioned replacements
when the requested replacement candidate is available.
