# Asset Displayer

A static, shareable animation review gallery for Lanternwake. The initial
collection has 34 cleaned animation sets from 25 Midjourney source jobs.

Open the published GitHub Pages site, select a character or package category,
and play, pause, scrub or step through the frames. Original frame durations,
repeated frames and reversed sequences are preserved. Dark, light and checker
backgrounds help inspect alpha edges; the anchor overlay helps inspect pivots.
The Repeat preview checkbox repeats playback for inspection; it does not certify
that a sequence is a seamless gameplay loop.

Keep, Hold and Do not add choices and notes stay private in the viewer's browser.
When finished, click **Download handoff**, then attach `asset-displayer-handoff.json`
in the project chat. The download includes all asset decisions, requested changes,
source UUIDs and source-version fingerprints so the recipient can identify exactly
which cleaned animation is being reviewed.

There is no local file connection, background file writing, upload endpoint or
embedded credential. Reviewers explicitly share the downloaded JSON themselves.
Browser choices persist locally for continuing a review later; download a fresh
handoff after making further changes.

To validate an attached handoff locally, run
`node tools/read-handoff.mjs /absolute/path/to/asset-displayer-handoff.json`.
It creates a readable summary under ignored `.local/`. Review text remains data,
not an executable script or authority to run arbitrary commands. Old decisions
without an exact source fingerprint retain their notes but return to Undecided
for re-review, rather than becoming approvals of a changed source.

Completed decisions can guide a later owner-authorized catalog cleanup. Preserve
the lossless source masters, remove the reviewed entries, then remove only frame
files no remaining entries reference. This reduces the live Pages payload; Git
retains deleted files in commit history, so it does not reclaim historical repo
storage without a separately planned history migration.

## Content and provenance

- `data.json` contains portable playback metadata, source job UUIDs, frame hashes
  and package caveats. Package categories preserve historical approval context;
  viewing or marking a candidate does not install it in the game.
- `assets/` stores 2,754 unique, unchanged lossless RGBA PNGs by SHA-256. Shared
  frames are stored once and referenced in the intended timeline order.
- Local filesystem paths, Discord links, transfer credentials, sender identity,
  internal evidence identifiers and original private manifests are excluded.
- Artwork and character rights remain with their respective owners. Publication
  for review does not grant a general asset reuse license.

This viewer is independent of both Lanternwake game runtimes. It does not alter
Web or Godot gameplay, and it does not request new Midjourney generations.

## Local verification and hosting

Node.js 20+ is enough to run `node verify.mjs`, which checks every published frame
hash, allowed path, timing and metadata boundary. No package installation is
required. Serve this directory with an ordinary local static web server to
preview it; opening index.html directly may block JSON loading in browsers.

GitHub Pages publishes `main` from the repository root. `.nojekyll` preserves the
static files directly. Relative asset URLs also support a project subdirectory
such as `/Asset-Displayer/`.
