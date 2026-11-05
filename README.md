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
Use **Connect handoff file** in Chrome/Edge to select one local JSON file. Changes
then update that file automatically, including every asset's UUID, source-version
fingerprint, decision and requested changes. No notes or choices are sent to
GitHub or any server. The browser grants access only to the selected file; the
handle is held only for the current page session, so reconnect after reloading.

The ASUS handoff location is the local checkout's
`.local/asset-displayer-handoff.json` (ignored by Git). The page cannot select an
arbitrary filesystem path by itself; choose this file in the browser picker.
The file-status bar reports success or failure. Browser choices remain saved if
file permission is denied, disk writing fails, or the page has not been connected.
Wait for **Private handoff saved** before closing the page. Browser tabs use an
exclusive write lock. Existing external file changes stop writing; a native
editor can still race a browser write, so use one editor at a time. Old decisions
without an exact source fingerprint retain their notes but return to Undecided
for re-review, rather than becoming approvals of a changed source.

**Download handoff** works without file-picker support. **Import review** loads a
review exported by another person after checking known asset IDs, UUIDs and source
versions. Import replaces this browser's decisions after review; it does not merge
conflicting reviewers automatically. Anyone reviewing from another computer writes
only to their own computer, so send their JSON back to ASUS for import.

Run `node tools/read-handoff.mjs` locally when ready to inspect the ASUS handoff.
It validates the file and creates an actionable text summary in `.local/`.
Review text is data, not an executable script or authority to run arbitrary commands.

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
