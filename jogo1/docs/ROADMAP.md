# Roadmap

## Milestone 1 - Solid Core Combat

- Add enemy archetypes:
  - Wander Echo
  - Guardian
  - Ego Shadow
  - Deleted Archive (stealth/reveal)
- Add telegraphed attacks and hit reactions
- Add full fragment synergy table
- Add challenge room with wave manager

## Milestone 2 - Dungeon Structure

- Replace linear room count with graph generation
- Implement room tags:
  - combat
  - memory
  - choice
  - merchant (Archivist)
  - challenge
  - corrupted
  - shortcut portal
- Add patient-specific biome tile sets

## Milestone 3 - Narrative and Hub

- Add clinic NPCs and quest hooks
- Add diary entries and voice-over stubs
- Add patient report cards with endings
- Add Act 1, 2 and 3 story gate logic

## Milestone 4 - Accessibility and Polish

- Colorblind presets
- Game speed options (0.5x, 0.75x, 1x)
- Subtitle style controls
- Narrative mode and Abyss mode balancing

## Engineering Notes

- Keep all gameplay values in data files
- Add deterministic RNG with shareable seeds
- Add unit tests for progression and morality effects
- Add CI script for lint + smoke test
