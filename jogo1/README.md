# Echo Abyss - Playable Prototype

This folder contains a playable prototype inspired by the game design document for Echo Abyss.

## Current Scope

- Top-down real-time action loop
- Hub (NEXMIND Clinic) with patient selection
- 10 patient profiles with unique themes
- Seeded dungeon generation across 4 layers
- Special room types (memory, choice, merchant, challenge, corrupted, shortcut)
- Memory fragments (active and passive build system)
- Fragment synergy system
- Relics with run modifiers
- Morality choices affecting outcomes
- Enemy archetypes (Echo, Guardian, Ego Shadow, Deleted Archive)
- Sanity system with mental collapse pressure
- Boss resolution via dialog choice (pacify vs extraction)
- Permanent progression between runs (Echoes + upgrades)
- Clinic Ressonance progression with NPC trust dialogues
- Optional Arquivo Corrompido mode with layer mutators
- Accessibility settings (speed, difficulty presets, colorblind palettes)
- Per-patient ending classification based on moral axes
- Story act progression in clinic hub (Act 1 -> 2 -> 3)
- New Game+ run mode with meta progression

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

## New Systems In This Build

- Shareable seeds: enter a seed in the Hub before selecting a patient
- The Archivist merchant room: buy/sacrifice for build shaping
- Challenge rooms with multiple combat waves
- Corrupted rooms with extra sanity pressure
- Shortcut portals to skip layers with reward tradeoff
- Narrative / Normal / Abyss difficulty scaling
- Clinic NPC conversations (Lyra, Ordan, Mira)
- Corrupted mutators per layer (Frenzy, Brittle, Static, Blackout)
- New Game+ unlock tied to clinic resonance

## Project Layout

- `index.html`: shell and HUD/panel/overlay containers
- `src/style.css`: visual theme and responsive UI
- `src/content.js`: patients, fragments, relics, morality choices
- `src/game.js`: game loop, combat, progression, hub flow
- `docs/GDD.md`: compact game design
- `docs/DEVLOG.md`: implementation log and next milestones

## Notes

This is an MVP foundation. It is intentionally modular so new patients, enemies, rooms, events, and narrative systems can be expanded in future commits.
