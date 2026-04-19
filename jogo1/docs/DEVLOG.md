# Devlog

## 2026-04-19 - Initial Prototype Build

Implemented:
- Base web project structure in `jogo1`
- Canvas action gameplay loop
- Hub flow with patient selection
- Multi-layer run progression
- Fragment and relic acquisition events
- Morality choice events and hidden stat mutation
- Final abyss decision and alternate resolution path
- Persistent meta progression via localStorage

Next priorities:
1. Add room graph generation and special room types
2. Add more enemy archetypes with unique behavior
3. Add synergy bonuses between fragments
4. Build patient-specific visual/audio signatures
5. Add save-slot and settings UI (accessibility options)

## 2026-04-19 - Systems Expansion Pass

Implemented:
- Deterministic seeded run generation
- Layer plans with special room types:
	- memory
	- choice
	- merchant (Archivist)
	- challenge (multi-wave)
	- corrupted
	- shortcut portal
- Enemy archetype AI behaviors:
	- Echo
	- Guardian
	- Ego Shadow
	- Deleted Archive (visibility mechanic)
- Fragment synergies and new scan fragment
- Accessibility and difficulty settings in hub:
	- speed: 0.5x / 0.75x / 1x
	- difficulty: narrative / normal / abyss
	- color palettes including colorblind presets
