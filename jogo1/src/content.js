export const patients = [
  {
    id: "mara",
    name: "Mara",
    age: 34,
    role: "Painter",
    symptom: "Creative collapse",
    mood: "vibrant-fade",
    layers: ["Studio", "Broken Gallery", "Color Grave", "Abyss Canvas"],
    bossName: "The Last Brushstroke",
  },
  {
    id: "tomas",
    name: "Tomas",
    age: 67,
    role: "Ex-military",
    symptom: "Combat guilt",
    mood: "ash-war",
    layers: ["Barracks", "No Man's Mind", "Court of Echoes", "Silent Trench"],
    bossName: "The Unfired Order",
  },
  {
    id: "luna",
    name: "Luna",
    age: 9,
    role: "Child",
    symptom: "Night terror",
    mood: "toy-horror",
    layers: ["Toy Room", "Mirror Playground", "Basement Lullaby", "Dark Carousel"],
    bossName: "The Forgotten Friend",
  },
  {
    id: "edgar",
    name: "Edgar",
    age: 45,
    role: "NEXMIND Scientist",
    symptom: "Paranoia",
    mood: "neon-lab",
    layers: ["Clean Lab", "Backdoor Archive", "Cryo Chamber", "Core Blackbox"],
    bossName: "Protocol Zero",
  },
  {
    id: "reina",
    name: "Reina",
    age: 28,
    role: "Musician",
    symptom: "Identity fracture",
    mood: "sonic-glass",
    layers: ["Rehearsal Hall", "Feedback Tunnel", "Broken Stage", "Final Note"],
    bossName: "The Dissonant Chorus",
  },
];

export const fragments = [
  {
    id: "firewall",
    name: "Firewall",
    type: "active",
    desc: "Spawn a short fire barrier around you.",
    onUse: (state) => {
      state.effects.push({ type: "ring", time: 0.35, radius: 70, damage: 10, color: "#ff6f3d" });
    },
  },
  {
    id: "sonic-wave",
    name: "Sonic Wave",
    type: "active",
    desc: "Push enemies back in a cone.",
    onUse: (state) => {
      state.effects.push({ type: "wave", time: 0.25, radius: 130, damage: 8, push: 220, color: "#58e0ff" });
    },
  },
  {
    id: "glass-step",
    name: "Glass Step",
    type: "passive",
    desc: "Dodge cooldown reduced by 15%.",
    apply: (state) => {
      state.stats.dodgeCdMult *= 0.85;
    },
  },
  {
    id: "stable-breath",
    name: "Stable Breath",
    type: "passive",
    desc: "Recover sanity slowly between rooms.",
    apply: (state) => {
      state.stats.sanityRegen += 2;
    },
  },
  {
    id: "echo-fangs",
    name: "Echo Fangs",
    type: "active",
    desc: "Dash slash that pierces through enemies.",
    onUse: (state) => {
      if (state.player.dodgeTimer <= 0) {
        state.player.dodgeTimer = 0.14;
        state.player.invulnTimer = 0.2;
        state.player.vx += Math.cos(state.player.facing) * 340;
        state.player.vy += Math.sin(state.player.facing) * 340;
        state.effects.push({ type: "ring", time: 0.2, radius: 40, damage: 16, color: "#ffe07a" });
      }
    },
  },
  {
    id: "analyst-lens",
    name: "Analyst Lens",
    type: "passive",
    desc: "Reveal enemy health bars.",
    apply: (state) => {
      state.flags.showEnemyHp = true;
    },
  },
];

export const relics = [
  {
    id: "cassette",
    name: "Cassette Tape",
    desc: "Sonic effects stun 0.2s longer.",
    apply: (state) => {
      state.stats.stunBonus += 0.2;
    },
  },
  {
    id: "analyst-glasses",
    name: "Analyst Glasses",
    desc: "See elite spawn chance in panel.",
    apply: (state) => {
      state.flags.showRoomForecast = true;
    },
  },
  {
    id: "drift-heart",
    name: "Drift Heart",
    desc: "+15 max sanity, -10 max hp.",
    apply: (state) => {
      state.player.maxSanity += 15;
      state.player.sanity += 15;
      state.player.maxHp = Math.max(35, state.player.maxHp - 10);
      state.player.hp = Math.min(state.player.maxHp, state.player.hp);
    },
  },
];

export const moralityChoices = [
  {
    id: "save-or-extract",
    title: "A memory shard is unstable",
    a: {
      label: "Stabilize it (Empathy + Preservation)",
      effect: { empathy: 1, efficiency: -1, preservation: 1, extraction: -1, sanity: 8 },
    },
    b: {
      label: "Extract fast for power (Efficiency + Extraction)",
      effect: { empathy: -1, efficiency: 1, preservation: -1, extraction: 1, hp: 10 },
    },
  },
  {
    id: "orders",
    title: "NEXMIND asks for the corrupted core",
    a: {
      label: "Follow protocol (Loyalty + Efficiency)",
      effect: { loyalty: 1, rebellion: -1, efficiency: 1, extraction: 1, echo: 6 },
    },
    b: {
      label: "Hide data from NEXMIND (Rebellion + Empathy)",
      effect: { loyalty: -1, rebellion: 1, empathy: 1, preservation: 1, fragment: 1 },
    },
  },
];
