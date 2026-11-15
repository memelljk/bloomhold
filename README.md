# Bloomhold — a garden tower-defense

The blight bugs are marching on the Heartbloom. Plant a living wall of
flower towers along their winding dirt path and hold **all 24 waves**.

![cover](screenshots/1-title.jpg)

## How to play

- **Plant**: pick a flower card in the sidebar, then click a grass tile.
- **Send the wave** with the orange button (or Space) when you're ready.
- **Grow** towers to level 3 and **sell** them from the selection panel.
- Pollen comes from bounties, a wave-clear bonus plus interest, and
  Sunblooms. If 20 bugs reach the Heartbloom, the garden falls.

## The garden

- **6 flower towers** — Petal Archer (fast, hits air), Frostbloom
  (slowing splash), Thorn Mortar (heavy splash), Beehive (poison bees),
  Storm Orchid (chain lightning), Sunbloom (pollen income) — each with
  3 growth levels.
- **8 bug kinds** — Aphids, Mites, armored Shell Beetles, Gloom Snails,
  flying Wasps (Mortars and Sunblooms can't reach them), Splitters that
  burst into Mites, and two bosses: the **Blight Brute** (wave 12) and
  the **Rot Pumpkin** (wave 24), both shedding smaller bugs as they walk.
- Full HUD (pollen, lives, wave, score, kills), wave previews, pause and
  ×1/×2/×3 speed, procedural WebAudio sound, and win/lose screens with a
  score breakdown and restart.

## Run it

```
node serve.ts        # then open http://localhost:8080
```

The game is plain static files under `game/` — no build step, no network
requests, everything drawn in code on a canvas.

## Hand-in (make.fun best-game-01)

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

copies `game/` + `screenshots/` to the output directory and writes
`dossier.json` via the vendored `vendor/makefun-game.ts`.
