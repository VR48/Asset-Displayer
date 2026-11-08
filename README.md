# Asset Displayer

A static, shareable animation review gallery for Lanternwake. The original
collection has 34 cleaned animation sets from 25 Midjourney source jobs,
alongside Seb standing references and the currently retained raw video candidates.

Open the published GitHub Pages site, select a character or package category,
and play, pause, scrub or step through the frames. Original frame durations,
repeated frames and reversed sequences are preserved. Dark, light and checker
backgrounds help inspect alpha edges; the anchor overlay helps inspect pivots.
The Repeat preview checkbox repeats playback for inspection; it does not certify
that a sequence is a seamless gameplay loop.

**Compare** appears for the nine candidates with a verified existing character,
action, direction and (where applicable) attack-phase destination. It opens the
current original beside the cleaned candidate. Both use the same elapsed clock,
playback controls, anchor location and world scale; each retains its own frame
durations. Repeating previews loop independently. The original gait preview uses
nominal gameplay cadence; in-game movement speed changes that cadence.

The current comparison set is Rook sprint-right / walk-up / walk-down, Kest
standing fire-right, Vale walk-right, Mica walk-down-right, and Mica's standing
up-right weapon raise / fire / lower phases. Mica's diagonal art maps to the
runtime's `down` / `up` keys. Raising and lowering replace attack phases, not
standalone ready-state features. Kest's full repaired take still needs shot/phase
segmentation before integration. New-feature candidates have an explanation and
no Compare button: no approximate walk, attack or other slot is substituted.

The **Authorize replacing** checkbox records approval of the named slot and
phase against an exact original fingerprint in the downloaded handoff. Keep
candidate alone does not authorize replacement. Changing to Hold, Do not add or
Undecided clears that approval. Source or target changes invalidate old approval
and preserve notes for re-review. Nothing is installed or removed by the viewer.

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
- `assets/` stores 2,754 original collection frames, four Seb MASTER
  candidates and the decoded frames of four raw Seb walks and one sneak. Shared frames are stored once
  and referenced in the intended timeline order.
- `videos/` retains the unchanged Midjourney walking and sneaking MP4s. **Download
  original MP4** appears for these clips. The private handoff identifies each
  video, generation UUID and input master by fingerprint.
- `comparisons.json` identifies the ASUS checkout's Original runtime bank
  snapshot, with source commit, manifest/page hashes and attack-phase semantics.
  `baselines/` contains 282 native-size RGBA PNGs decoded from those existing
  KTX2 runtime pages with the pinned official Basis decoder, retaining each
  clip's fixed rectangle. This is the existing game's delivered artwork, not
  the raw Pika movie or a claim that another PC's checkout is synchronized.
- `node tools/build-comparisons.mjs /absolute/path/to/lanternwake` rebuilds only
  these review exports by reading the game; it never writes into its banks.
  This requires the game's pinned decoder and is not needed to host the viewer.
- Local filesystem paths, Discord links, transfer credentials, sender identity,
  internal evidence identifiers and original private manifests are excluded.
- Artwork and character rights remain with their respective owners. Publication
  for review does not grant a general asset reuse license.

This viewer is independent of both Lanternwake game runtimes. It does not alter
Web or Godot gameplay, and it does not request new Midjourney generations.

## New character candidates

Choose a character or the **New character candidates** package category.
Standing references are clearly distinguished from animation clips, and their
animation controls are disabled. The character filter is derived from catalog
metadata rather than a fixed roster.

Seb's standing references cover front, rear, left and right. The front keeps
the original low-sword source. Rear v4 retains its MJ origin and ImageGen repair
provenance. Side v3 stills correct the body build against the canonical front,
while preserving the liked facial likeness and relaxed body language. Their new
proportions remain subject to visual review before side video generation.

The current raw videos are the retained front/down walk, the undecided rear
walk and the separate rear/up sneak candidate. The rear walk still identifies
its actual v6 input; the sneak retains its v3 input. Neither is relabeled as
having used the displayed rear v4 still. Retired side v1/v2 masters and walks
remain archived locally and absent from the live catalog.

All current raw MJ videos used low motion and `--bs 1`. Their unchanged MP4s
remain available to download. The viewer preserves every decoded frame and its
native timestamp duration. Magenta and generation defects remain visible;
seamless foot contact, loop timing and new likeness/proportion judgments are
review decisions. These assets are independent of both game runtimes.

`tools/import-seb-masters.py` imports active references while excluding rejected
selections. `tools/import-seb-walks.py` imports only completed, locally reviewed
video records with original-file hashes; rejection flags prevent reintroducing
retired takes.

## Local verification and hosting

Node.js 20+ is enough to run `node verify.mjs`, which checks every published frame
hash, allowed path, timing and metadata boundary. No package installation is
required. Serve this directory with an ordinary local static web server to
preview it; opening index.html directly may block JSON loading in browsers.

GitHub Pages publishes `main` from the repository root. `.nojekyll` preserves the
static files directly. Relative asset URLs also support a project subdirectory
such as `/Asset-Displayer/`.

## Seb review update

Five rejected first-pass Seb entries (left/right standing masters and front/left/right walks) were removed from the live catalog after a checksum-verified local archive was made. Their original files and decisions remain on ASUS. The rear/up sneak remains available, and the displayed rear standing reference is the owner-accepted v4 image. The undecided rear walk still records its actual v6 generation source. Replacement side references and walks receive new v2 asset IDs; previous rejected IDs stay retired.

The replacement v2 walking trials prioritize calmer everyday motion and low
foot clearance. Their technical/OMP review leaves naturalness, remaining
stiffness, profile likeness and seamless foot contact for owner playback review.
The public review metadata identifies the exact newly uploaded source, while
rejected v1 IDs remain absent.

The redo publication includes new left/right reference stills and front/left/right
walking candidates. The right job had an inconclusive acceptance receipt; its
completed UUID was recovered by matching the actual uploaded source and prompt.
It was downloaded without submitting a duplicate generation.

## Body consistency review

The exact front/down v2 walk is retained. Side v2 stills and walks were
retired after review found a weaker body build than the canonical front. Their
originals are archived locally. New left/right v3 MASTER candidates preserve
the liked face and relaxed body language while correcting torso, arm, hip and
leg mass against the front. These are body-review stills; replacement side
videos await the owner’s judgment of those proportions. Rear v4 and the retained
rear sneak remain available, and the undecided rear walk keeps its historical
v6 input identity.
