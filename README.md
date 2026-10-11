# Coil

A browser arcade game about a neon serpent, tight turns, and efficient routes. Eat amber pellets to grow. Eat again within 3.5 seconds to build a multiplier up to x5. Walls and your own body end the round; your best score lasts for the session.

## Run

Requires Node.js 22.12 or newer and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. No backend, account, or API key is needed.

```sh
npm run build
npm run preview
```

The complete production site is in `dist/`. Serve that directory on any static host, including under a sub-path. Art and audio are committed files; the build only bundles them and does not require asset-generation tools. `public/assets` links to the authored `assets/` directory so Vite includes its files without duplicating the source assets.

## Controls

| Action | Keys |
| --- | --- |
| Steer | Arrow keys or WASD |
| Select menu item | Up / Down |
| Confirm | Enter / Space |
| Back / pause | Escape |
| Pause / resume | P |
| Mute / unmute | M |
| Engine diagnostics | Backtick |

Menus also accept mouse and touch. Touching the game reveals the engine's directional controls. Steering uses press edges rather than repeating held keys, and you can queue two turns ahead.

## Verify

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

Tests run the actual Simple 2D engine with a deterministic clock and a canvas in Node. They cover movement, tail collisions, growth, combos, the board-cleared ending, menu input, mute, and the debug poses. The engine exposes Coil's debug surface through `engine.debug`; nothing is published on the game page.

The committed `assets/recipes/` files record the original pixel-art and sound synthesis operations. `generate.py` documents the one-time authoring step and needs the supplied generation tools if deliberately rerun; it is never called by npm. The snake is authored in one facing per piece, rotated at rendering, with a four-frame bite. Three synth cues and an eight-second electronic music loop share its sound palette.

See `showcase/` for screenshots and a four-second recording of live play made with the engine's draw recorder.
