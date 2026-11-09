# Asset Displayer

## Jane front-anchored rebuild · 1.20.0

All previous non-front Jane masters are retired. New rear, left and right v6
candidates use the unchanged front MASTER, original concept standing views and
native front face/weapon crops. Seb and every other asset are unchanged.

Python material measurements confirmed the old brighter/warmer drift. Fresh
renders restore the substantial stepped upper and split lower weapon casing;
targeted repairs address right upper-section length, rear wrist and left resting
arm. A material-aware CIELab grade matches front paint/metal/skin at fixed pixel
coordinates, with separately reviewed face/ear/neck masks. Magenta and blue
emission remain unchanged from each raw render. OMP reviewed whole carries,
weapon proportions, texture/color and mask coverage; all are candidates for owner
review. Hidden mount/opposite-face geometry and exact lighting remain inferred.
The front is byte-identical. Old masters, raw renders, prompts, Python reports
and superseded catalog entries remain local. New v6 decisions begin Undecided.

## Jane rear-guided left carry · 1.19.2

Left v4 replaces the rejected left v3. The preferred rear v3 is unchanged.
The whole carrying arm, horizontal fore-aft grip and prop side projection were
checked together by OMP. A second redraw replaced the rear-facing rail façade
with angular side casing/channels while preserving the low cupped wrist and
forward placement. OMP found no remaining visible mandatory correction for
owner review. Hidden mount/opposite casing details remain inferred; this is not
a certified exact 3D turnaround. All other assets and saved statuses are retained.

## Jane visible-handle repairs · 1.19.1

Rear/left v3 supersede the rejected v2 drafts. Left now has a clenched grip
occluding the handle instead of a silver bar across finger faces. Rear returns
to the narrower wrist pose with an end-on handle in the cupped fist. OMP found
both suitable for owner review; the rear circular end can still resemble a
bolt/button because the shaft is mostly hidden. It is a review uncertainty,
not a certified mechanical solution. Original/v2/intermediate art remains local;
front/right, other characters and saved review statuses are unchanged.

## Jane rear/left carry repairs · 1.19.0

New v2 rear and left standing candidates replace the deleted v1 entries for
review. Retained front/right artwork and all saved decisions are unchanged.
Left carries the weapon visibly forward with a low right-hand grip; rear uses
the free hand's relaxed wrist orientation to guide the redesigned handle/grip.
OMP found no clear remaining anatomy/framing blocker for owner review. The rear
finger-to-grip contact and exact weapon projection remain uncertain. These are
new undecided candidates; deleted versions and rejected intermediate attempts
remain local. No animations or game integration were performed.

The **Redo** choice replaces the former “Do not add” label. It requests another
version; use the notes field to describe the repair. Existing grey choices stay
grey. Handoff files retain the legacy `skip` code for compatibility and include
`decisionLabels.skip: "Redo"`. Undecided leaves a candidate awaiting a decision.

Jane’s rear and left v1 candidates were removed from AD by the supplied explicit
Delete decisions. Their originals and private weapon-orientation/carry notes
remain local for future redrawing. Front and right remain available.

## Jane directional candidates · 1.18.2

Four new standing references—front, rear, left and right—use the supplied
red-armor character sheet, its native standing/face crops and original palette.
The character filter label is **Jane**. The malformed crouch panel was
excluded as an anatomy reference. The corrected complete sheet remains local.
These are ImageGen review candidates with magenta backgrounds, not animations
or gameplay replacements. OMP flagged cross-view face, equipment and registration
variation; a follow-up redraw raised the right-profile weapon to upper-torso
height. Profiles overlap far-side limbs and pods. Review grip, likeness and
palette before animation. Existing assets and applied review colors are retained.

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
candidate alone does not authorize replacement. Changing to Hold, Redo, Delete or
Undecided clears that approval. Source or target changes invalidate old approval
and preserve notes for re-review. Nothing is installed or removed by the viewer.

New choices and notes stay in the viewer's browser until the downloaded handoff
is shared. Applied Keep choices are green, Redo choices grey, and pending
Delete choices red. Grey entries stay selectable and their artwork is not recolored.
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

## Applying a handoff and persistent status colors

`review-state.json` publishes only decision enums and exact asset/source version
identifiers. It contains no notes, reviewer identity or replacement approvals.
Its pinned statuses initialize every browser and persist across AV releases.
Private local edits remain editable until the next handoff is applied. A new
published review revision takes precedence over stale browser decisions while
preserving private notes. Changed asset versions return to Undecided for review.

After receiving an owner handoff, use:

```text
node tools/apply-handoff.mjs /absolute/path/to/asset-displayer-handoff.json --dry-run
node tools/apply-handoff.mjs /absolute/path/to/asset-displayer-handoff.json
```

The preview validates the exact source/target fingerprints and shows the planned
status counts, candidate deletions and unused resource removals. Applying the
handoff updates `review-state.json`; only explicit **Delete** choices remove
catalog entries and unshared AV PNG/MP4 files. **Redo** requests a revised candidate and remains grey until a new version is reviewed; it never instructs deletion. Shared candidate files and original
comparison resources are protected. Removed input masters leave their exact
source hash history on retained videos. No game/runtime or source-master files
are deleted. Replaying an applied handoff is safe.

Full handoffs, notes and removal reports are archived under ignored
`.local/reviews/<handoff-sha256>/`. Review text is inert data. Keep alone still
does not authorize game replacement, and the public status baseline never grants
that authorization. After applying, run the checks, bump release cache versions,
commit the status/catalog/media changes and publish the next Pages version.
Update cache versions in the app, HTML and versioned module imports when those
modules change. No browser click writes to GitHub or deletes server files.

Cleanup reduces the current Pages payload. Git retains old files in history;
history rewriting is a separate task.

## Content and provenance

- `data.json` contains portable playback metadata, source job UUIDs, frame hashes
  and package caveats. Package categories preserve historical approval context;
  viewing or marking a candidate does not install it in the game.
- `assets/` stores native lossless review frames and stills. Shared frames are
  stored once and referenced in the intended timeline order.
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

Seb's standing references cover front, rear, oblique left/right and near-profile left/right. The front keeps
the original low-sword source. Rear v4 retains its MJ origin and ImageGen repair
provenance. Side v6 displays an exact supplied existing left render and a right material redraw.
The right uses separate longer-proportion and restored-texture references with
the original front armor authority; its complete likeness/material result remains
subject to visual review before side video generation.

The current raw videos are the retained front/down walk, the undecided rear
walk, the separate rear/up sneak candidate and the shallow diagonal-left walk. The rear walk still identifies
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

## Proportion refinement

The v3 side strength was accepted, but the silhouettes still read too short.
Side v4 masters redraw length below the head while retaining the stronger build,
likeness and relaxed pose. The left correction is stronger; the right remains
more compact. These are proportion-review stills. V3 sources remain archived
locally as strength references; new side motion awaits the proportion judgment.

## Fresh armor and texture redraw

Side v5 replaces the edited v4 stills with fresh reference-guided renders. The
final inputs are the original front for armor/material and the clean head
reference for likeness; prior edited side bodies are excluded. Two main chest
courses meet the black fabric flank, with two separate central abdominal shields
below. OMP found the extra lateral rib tier absent and surface detail improved.
Brighter bevel edging, a busier right chevron wrap and oblique torso presentation
remain visible review caveats. Full hidden-plate equivalence is not asserted.
Earlier edited and failed redraw attempts remain archived locally.

## Side selection and material redraw v6

The supplied left image is preserved exactly; its RGB pixels match the first
fresh left render from the v5 work, with no further edits. The final v5 pair is
archived locally as face/material references after body-proportion review.
The right v6 redraw combines the supplied longer-proportion reference with the
restored v5 texture reference. Its richer surface variation, face, plate contours
and steeper low-sword angle remain reviewable. No new videos or runtime changes.
Private review decisions remain outside the published catalog.

## AV diagonal walk and profile candidates

The v6 left walk is classified **Diagonal left (shallow)**, with its original
MP4 and all 122 chronological frames retained. It is a tentative motion candidate,
not a horizontal-left walk. Its opening/closing stance may create a cadence
hesitation; blade shape and foot contact still need playback review. A stronger
diagonal sprite/run will be handled separately.

The v6 right original remains local: sword-tip contact with the canvas edge
around 2.96–3.00 seconds prevents recommending its framing. It is not published.

Both v6 standing sources remain as oblique references, with their exact pixels
and video-source provenance unchanged. New v7 left/right stills improve whole-body
profile alignment. Some chest frontage, boot-top visibility and foot stagger
remain; exact 90-degree projection is not certified. They await master review
before any new horizontal walking generation. No game runtime changes.

## Material-aware color correction v8

All five current non-front Seb stills have a direct material-aware CIELab grade
against the unchanged front MASTER: rear, oblique left/right and near-profile
left/right. Skin moves toward the front's restrained reddish rose-brown;
graphite, oxblood paint and wear use the same reference hierarchy. The grade
changes colors at original pixel coordinates; it does not redraw features,
resample geometry or synthesize texture. Magenta and green emitters remain
byte-identical to each input. Original sources and superseded exports are
archived locally. New tones await review; numerical material samples do not
certify visual equivalence. Historical videos remain unchanged and still name
the exact original input hashes, available through their master history.

## Explicit oblique head references v9

All five non-front full-body stills were regenerated with separately attached
native oblique head close-ups alongside full-body and front references. Each
visible-face direction used the corresponding oblique head; rear used both for
hair/horns/ear/nape identity while remaining back-facing. Color restoration
followed the redraws. The original reference faces remain recognizable; this
is continuity rather than a claimed novel facial redesign. Near-profile body
alignment remains, with sharper right-profile nose/chin and horn overlap, plus
inherited rear sword foreshortening, left for review. Final head previews are
exact crops of the published full-body PNGs. Front and videos are unchanged.

## V9 side-profile walking candidates

Two new side-facing raw MJ walks use the exact explicit-head v9 profile masters,
with Relax / low motion and exactly one `--bs 1` confirmed per request. Left uses
the targeted second take for improved boot/contact contours; the first take is
held locally. Both final originals are 512×768 H.264, 125 frames, 5.208 seconds.
Every decoded frame and native timestamp is retained. These are continuous
walking trials (`loop_requested: false`), with no forced closing standing pose.

OMP found recognizable near-profile walking, low sword carry and no obvious
sampled progressive zoom/cutoff. Deliberate leading steps, small sole/shadow
slivers, green contact residue and blade-angle variation remain review points.
Contact, cadence and a usable cycle are subject to playback judgment. The old
shallow diagonal-left candidate remains separate; front, rear and static masters
are unchanged. No game runtime changes.
