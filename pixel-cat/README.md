# Pixel Cat — Vibe's Endless Run

A colorful, pixel-art 2D endless runner built for tablets. You play as **Vibe**, a
pixel cat (with a little headset, because the cat is an AI) racing through a world
that cycles through day, dusk, night and dawn — forever. There is no ending: every
run is procedurally generated, the speed keeps ramping up, and fish you collect are
banked forever so you can buy permanent upgrades and chase a new best score.

## Play

Open `index.html` in any modern browser (works great on tablets, portrait or
landscape). If GitHub Pages is enabled for this repo, it is also served at:

`https://<your-username>.github.io/Random-number-generator2025/pixel-cat/`

No build step, no dependencies, no network needed — plain HTML/CSS/JS.

## Controls

| Action | Touch | Keyboard |
|---|---|---|
| Jump (hold for higher) | tap / hold anywhere | Space / ↑ / W |
| Slide under drones (fast-fall in air) | swipe down | ↓ / S |
| Pause | ⏸ button top-right | P / Esc |
| Mute | ♪ button top-right | M |
| Start / retry | tap | Enter |

## How a run works

- The cat runs automatically; speed increases the longer you survive.
- **Jump** over trash cans, traffic cones, hydrants, dogs and towers of cans.
- **Slide** under flying drones.
- **Fish** = points and banked currency. Chain pickups to build a combo
  multiplier (up to ×5).
- Power-ups: **yarn** (magnet — fish fly to you), **milk** (shield against one
  hit), **star** (slow-motion).
- Getting hit without a shield ends the run. Your score, best score and fish bank
  are saved locally (`localStorage`).

## Shop (on the title screen)

Spend banked fish on permanent upgrades:

- **9 LIVES** (150 fish) — start every run with a milk shield.
- **MAGNET** (250 / 500 fish, 2 levels) — bigger fish-attraction radius.
- **GOLD COLLAR** (300 fish) — fish are worth double points.

## Tech notes

- Everything is rendered on a low-resolution buffer (270px tall, width adapts to
  the screen aspect) and scaled up with `image-rendering: pixelated`, so all art
  stays crisp.
- All sprites are defined as pixel-string maps in `js/sprites.js` and pre-rendered
  to canvases; the world (parallax hills, houses, trees, clouds, day/night sky,
  stars, sun/moon) is drawn procedurally each frame.
- Sound effects and the chiptune music loop are synthesized live with WebAudio
  (`js/audio.js`) — no audio files.
- Game code: `js/game.js` (state machine, physics, spawner, collisions, UI),
  tiny bitmap font in `js/font.js`.

## Tests

A dependency-free Node harness mocks the DOM/canvas/WebAudio, rasterizes real
frames, encodes PNG screenshots, and plays the game with an automated bot:

```bash
node test/harness.js          # 45 assertions: boot, bot playthrough, collisions,
                              # powerups, shop, persistence, portrait mode, ...
DUMP_SPRITES=1 node test/harness.js   # also dumps every sprite as PNG
PC_SHOTS=/tmp/my-shots node test/harness.js   # custom screenshot output dir
```

Screenshots are written to `$PC_SHOTS` (default: `<tmpdir>/pc-shots`).
