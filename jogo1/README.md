# Echo Abyss - Playable Prototype

This folder contains a playable prototype inspired by the game design document for Echo Abyss.

## Current Scope

- Top-down real-time action loop
- Hub (NEXMIND Clinic) with patient selection
- Procedural-ish room combat across 4 layers
- Memory fragments (active and passive build system)
- Relics with run modifiers
- Morality choices affecting outcomes
- Sanity system with mental collapse pressure
- Boss resolution via dialog choice (pacify vs extraction)
- Permanent progression between runs (Echoes + upgrades)

## Run It

Because this is plain HTML/CSS/JS, run with any static server.

Option 1 (VS Code Live Server extension):
- Open this folder and click "Go Live"

Option 2 (Python):
- `python -m http.server 5500`
- Open `http://localhost:5500`

## Controls

- Move: WASD
- Basic attack: Left mouse click
- Dodge roll: Space
- Active ability slot 1: Q
- Active ability slot 2: E
- Fragment choice overlay: keys 1, 2, 3

## Project Layout

- `index.html`: shell and HUD/panel/overlay containers
- `src/style.css`: visual theme and responsive UI
- `src/content.js`: patients, fragments, relics, morality choices
- `src/game.js`: game loop, combat, progression, hub flow
- `docs/GDD.md`: compact game design
- `docs/DEVLOG.md`: implementation log and next milestones

## Notes

This is an MVP foundation. It is intentionally modular so new patients, enemies, rooms, events, and narrative systems can be expanded in future commits.
