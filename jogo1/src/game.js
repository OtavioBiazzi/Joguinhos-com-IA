import { fragments, moralityChoices, patients, relics } from "./content.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const hud = document.getElementById("hud");
const panel = document.getElementById("panel");
const overlay = document.getElementById("overlay");

const keys = new Set();
const pointer = { x: canvas.width / 2, y: canvas.height / 2 };

const saveKey = "echo-abyss-save-v2";
const roomTypeNames = {
  combat: "Combat",
  memory: "Memory",
  choice: "Choice",
  merchant: "Merchant",
  challenge: "Challenge",
  corrupted: "Corrupted",
  shortcut: "Shortcut",
  abyss: "Abyss",
  bossFight: "Boss",
};

const mutatorNames = {
  none: "None",
  frenzy: "Frenzy Pulse",
  brittle: "Brittle Mind",
  static: "Static Noise",
  blackout: "Blackout",
};

const baseSave = {
  echoes: 0,
  unlockedPatients: ["mara", "tomas", "luna"],
  upgrades: { hp: 0, sanity: 0, dodge: 0 },
  journal: [],
  clinic: {
    resonance: 0,
    npcTrust: { lyra: 0, ordan: 0, mira: 0 },
  },
  progression: {
    ngPlusLevel: 0,
    ngPlusWins: 0,
  },
  settings: {
    speed: 1,
    difficulty: "normal",
    colorMode: "default",
    corruptedMode: false,
    runMode: "standard",
  },
};

const state = {
  mode: "hub",
  save: loadSave(),
  rng: Math.random,
  runSeed: "",
  patient: null,
  layers: [],
  layerMutators: [],
  layerIndex: 0,
  roomIndex: 0,
  currentRoom: null,
  maxLayers: 4,
  enemies: [],
  effects: [],
  fragments: [],
  relics: [],
  synergies: [],
  cooldowns: { active1: 0, active2: 0, attack: 0, dodge: 0 },
  stats: {
    dodgeCdMult: 1,
    sanityRegen: 0,
    stunBonus: 0,
    baseDamage: 14,
    attackCdMult: 1,
    contactDamageMult: 1,
  },
  flags: {
    showEnemyHp: false,
    showRoomForecast: false,
    revealInvisible: false,
  },
  runFlags: {
    revealTimer: 0,
    awaitingRoomResolution: false,
    skipRewardsThisRoom: false,
    challengeWavesLeft: 0,
    ngPlus: false,
  },
  morality: {
    empathy: 0,
    efficiency: 0,
    loyalty: 0,
    rebellion: 0,
    preservation: 0,
    extraction: 0,
  },
  player: {
    x: 200,
    y: 200,
    vx: 0,
    vy: 0,
    r: 16,
    speed: 210,
    facing: 0,
    hp: 100,
    maxHp: 100,
    sanity: 100,
    maxSanity: 100,
    invulnTimer: 0,
    dodgeTimer: 0,
  },
};

function loadSave() {
  try {
    const raw = localStorage.getItem(saveKey);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      ...baseSave,
      ...parsed,
      upgrades: { ...baseSave.upgrades, ...(parsed.upgrades || {}) },
      progression: { ...baseSave.progression, ...(parsed.progression || {}) },
      clinic: {
        ...baseSave.clinic,
        ...(parsed.clinic || {}),
        npcTrust: { ...baseSave.clinic.npcTrust, ...((parsed.clinic || {}).npcTrust || {}) },
      },
      settings: { ...baseSave.settings, ...(parsed.settings || {}) },
    };
  } catch {
    return structuredClone(baseSave);
  }
}

function saveGame() {
  localStorage.setItem(saveKey, JSON.stringify(state.save));
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createRng(seedString) {
  let t = hashSeed(seedString);
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function rrand(min, max) {
  return state.rng() * (max - min) + min;
}

function rpick(items) {
  return items[Math.floor(state.rng() * items.length)];
}

function openOverlay(html) {
  overlay.innerHTML = `<div class="card">${html}</div>`;
  overlay.classList.add("show");
}

function closeOverlay() {
  overlay.classList.remove("show");
}

function getPatientById(id) {
  return patients.find((p) => p.id === id);
}

function getAvailablePatients() {
  return patients.filter((p) => state.save.unlockedPatients.includes(p.id));
}

function fragmentById(id) {
  return fragments.find((f) => f.id === id);
}

function hasFragment(id) {
  return state.fragments.some((f) => f.id === id);
}

function getDifficultyConfig() {
  if (state.save.settings.difficulty === "narrative") {
    return {
      hpMult: state.runFlags.ngPlus ? 0.85 : 0.7,
      damageMult: state.runFlags.ngPlus ? 0.8 : 0.65,
      sanityDrainMult: state.runFlags.ngPlus ? 0.9 : 0.7,
      rewardMult: state.runFlags.ngPlus ? 1.05 : 0.9,
    };
  }
  if (state.save.settings.difficulty === "abyss") {
    return {
      hpMult: state.runFlags.ngPlus ? 1.55 : 1.35,
      damageMult: state.runFlags.ngPlus ? 1.55 : 1.35,
      sanityDrainMult: state.runFlags.ngPlus ? 1.55 : 1.35,
      rewardMult: state.runFlags.ngPlus ? 1.6 : 1.35,
    };
  }
  return {
    hpMult: state.runFlags.ngPlus ? 1.2 : 1,
    damageMult: state.runFlags.ngPlus ? 1.2 : 1,
    sanityDrainMult: state.runFlags.ngPlus ? 1.2 : 1,
    rewardMult: state.runFlags.ngPlus ? 1.25 : 1,
  };
}

function getColorPreset() {
  if (state.save.settings.colorMode === "deuteranopia") {
    return { enemy: "#f0ad4e", elite: "#ffdf88", player: "#b8f1ff", accent: "#7ec7ff" };
  }
  if (state.save.settings.colorMode === "protanopia") {
    return { enemy: "#84b6ff", elite: "#dbc35c", player: "#b8f1ff", accent: "#9ecbff" };
  }
  return { enemy: "#9bc5ff", elite: "#ff7d66", player: "#d0f2ff", accent: "#7ad9ff" };
}

function generateLayerPlan(layer) {
  const roomCount = 5 + (layer >= 3 ? 1 : 0);
  const specialPool = ["memory", "choice", "merchant", "challenge", "corrupted", "shortcut"];
  const plan = [];

  plan.push({ type: "combat", cleared: false });
  while (plan.length < roomCount - 1) {
    const type = rpick(specialPool);
    plan.push({ type, cleared: false });
  }
  if (layer === state.maxLayers) {
    plan.push({ type: "abyss", cleared: false });
  } else {
    plan.push({ type: "combat", cleared: false });
  }

  // Force at least one choice and one challenge in deeper layers.
  if (layer >= 2 && !plan.some((r) => r.type === "choice")) plan[1].type = "choice";
  if (layer >= 2 && !plan.some((r) => r.type === "challenge")) plan[2].type = "challenge";
  return plan;
}

function buildDungeon(seedText) {
  state.runSeed = seedText;
  state.rng = createRng(seedText);
  state.layers = [];
  state.layerMutators = [];

  const mutatorPool = ["none", "frenzy", "brittle", "static", "blackout"];
  for (let layer = 1; layer <= state.maxLayers; layer += 1) {
    state.layers.push(generateLayerPlan(layer));
    if (state.save.settings.corruptedMode || state.runFlags.ngPlus) {
      const weights = [0.1, 0.25, 0.25, 0.25, 0.15];
      const roll = state.rng();
      let acc = 0;
      let chosen = "none";
      for (let i = 0; i < weights.length; i += 1) {
        acc += weights[i];
        if (roll <= acc) {
          chosen = mutatorPool[i];
          break;
        }
      }
      state.layerMutators.push(chosen);
    } else {
      state.layerMutators.push("none");
    }
  }
}

function getLayerMutator() {
  return state.layerMutators[state.layerIndex] || "none";
}

function getEnemySpeedMult() {
  return getLayerMutator() === "frenzy" ? 1.25 : 1;
}

function getSanityDrainBonus() {
  return getLayerMutator() === "static" ? 1.8 : 0;
}

function getContactDamageMult() {
  return getLayerMutator() === "brittle" ? 1.35 : 1;
}

function getResonanceTier() {
  const r = state.save.clinic.resonance;
  if (r >= 12) return { level: 4, name: "Inner Archive" };
  if (r >= 8) return { level: 3, name: "Lower Wing" };
  if (r >= 4) return { level: 2, name: "Recovery Hall" };
  return { level: 1, name: "Base Clinic" };
}

function getStoryAct() {
  const res = state.save.clinic.resonance;
  const ng = state.save.progression.ngPlusWins;
  if (res >= 10 && ng >= 1) return { id: 3, name: "Act 3 - Renegade or Accomplice" };
  if (res >= 5) return { id: 2, name: "Act 2 - Investigator" };
  return { id: 1, name: "Act 1 - Employee" };
}

function canStartNgPlus() {
  return state.save.clinic.resonance >= 12;
}

function getNpcLine(npcId) {
  const trust = state.save.clinic.npcTrust[npcId] || 0;
  const res = getResonanceTier().level;
  const moralityShift = state.morality.rebellion - state.morality.loyalty;

  if (npcId === "lyra") {
    if (trust >= 4) return "I rerouted a file for you. NEXMIND is tracking extraction anomalies.";
    if (res >= 3) return "Patients from Wing C mention the same symbol in their dreams.";
    return "You should listen to what memories are refusing to show you.";
  }
  if (npcId === "ordan") {
    if (moralityShift > 1) return "Careful. Rebels disappear fast in this clinic.";
    if (trust >= 4) return "I can keep security logs off your back... for now.";
    return "Protocol keeps people alive. Deviations do not.";
  }
  if (npcId === "mira") {
    if (trust >= 4) return "Your own chart has been opened from a sealed terminal.";
    if (res >= 2) return "Some comas are induced, not accidental.";
    return "Every patient hears the same whisper near the abyss layer.";
  }
  return "...";
}

function resetRunFor(patient, customSeed, useNgPlus = false) {
  state.mode = "run";
  state.patient = patient;
  state.layerIndex = 0;
  state.roomIndex = 0;
  state.fragments = [];
  state.relics = [];
  state.effects = [];
  state.synergies = [];
  state.enemies = [];
  state.stats = {
    dodgeCdMult: 1,
    sanityRegen: 0,
    stunBonus: 0,
    baseDamage: 14,
    attackCdMult: 1,
    contactDamageMult: 1,
  };
  state.flags = { showEnemyHp: false, showRoomForecast: false, revealInvisible: false };
  state.runFlags = {
    revealTimer: 0,
    awaitingRoomResolution: false,
    skipRewardsThisRoom: false,
    challengeWavesLeft: 0,
    ngPlus: useNgPlus && canStartNgPlus(),
  };
  state.morality = {
    empathy: 0,
    efficiency: 0,
    loyalty: 0,
    rebellion: 0,
    preservation: 0,
    extraction: 0,
  };

  const hpBonus = state.save.upgrades.hp * 8;
  const sanityBonus = state.save.upgrades.sanity * 10;
  const dodgeBonus = state.save.upgrades.dodge * 0.06;
  state.player.maxHp = 100 + hpBonus;
  state.player.hp = state.player.maxHp;
  state.player.maxSanity = 100 + sanityBonus;
  state.player.sanity = state.player.maxSanity;
  state.player.speed = 210 + dodgeBonus * 150;
  state.player.x = canvas.width * 0.2;
  state.player.y = canvas.height * 0.5;
  state.cooldowns = { active1: 0, active2: 0, attack: 0, dodge: 0 };

  const generatedSeed = customSeed?.trim() || `${patient.id}-${Date.now().toString(36).slice(-6)}`;
  buildDungeon(generatedSeed);
  if (state.runFlags.ngPlus) {
    state.save.progression.ngPlusLevel = Math.max(1, state.save.progression.ngPlusLevel);
    // NG+ starts with one random passive fragment to accelerate build identity.
    const passivePool = fragments.filter((f) => f.type === "passive");
    if (passivePool.length > 0) state.fragments.push(rpick(passivePool));
    applyPassives();
  }
  enterCurrentRoom();
  closeOverlay();
}

function registerSynergy(name) {
  if (!state.synergies.includes(name)) state.synergies.push(name);
}

function applySynergies() {
  state.synergies = [];
  if (hasFragment("firewall") && hasFragment("sonic-wave")) {
    registerSynergy("Thermal Resonance (+25% active damage)");
    state.stats.baseDamage += 4;
  }
  if (hasFragment("echo-fangs") && hasFragment("glass-step")) {
    registerSynergy("Slipstream Lunge (+dodge invuln)");
    state.stats.dodgeCdMult *= 0.88;
  }
  if (hasFragment("stable-breath") && hasFragment("analyst-lens")) {
    registerSynergy("Clinical Calm (reveal archives)");
    state.flags.revealInvisible = true;
  }
}

function applyPassives() {
  state.stats = {
    dodgeCdMult: 1,
    sanityRegen: 0,
    stunBonus: 0,
    baseDamage: 14,
    attackCdMult: 1,
    contactDamageMult: 1,
  };
  state.flags = { showEnemyHp: false, showRoomForecast: false, revealInvisible: false };

  for (const frag of state.fragments) {
    if (frag.type === "passive" && frag.apply) frag.apply(state);
  }
  for (const relic of state.relics) {
    if (relic.apply) relic.apply(state);
  }
  applySynergies();
}

function makeEnemy(archetype, layer, elite = false, boss = false) {
  const diff = getDifficultyConfig();
  const colors = getColorPreset();
  const baseHp = 26 + layer * 11;
  const baseDamage = 8 + layer * 2.5;

  const enemy = {
    x: rrand(140, canvas.width - 100),
    y: rrand(120, canvas.height - 110),
    r: 14,
    speed: 74,
    hp: baseHp,
    maxHp: baseHp,
    damage: baseDamage,
    stun: 0,
    elite,
    boss,
    archetype,
    phase: 0,
    dashCd: rrand(1.5, 3.2),
    blinkCd: rrand(1.4, 2.4),
    visible: true,
    color: elite ? colors.elite : colors.enemy,
  };

  if (archetype === "guardian") {
    enemy.r = elite ? 22 : 18;
    enemy.speed = 62;
    enemy.hp *= 2.2;
    enemy.maxHp = enemy.hp;
    enemy.damage *= 1.5;
  }
  if (archetype === "ego") {
    enemy.r = 15;
    enemy.speed = 88;
    enemy.damage *= 1.25;
  }
  if (archetype === "archive") {
    enemy.r = 13;
    enemy.speed = 82;
    enemy.damage *= 1.2;
    enemy.visible = false;
  }
  if (boss) {
    enemy.r = 34;
    enemy.speed = 82;
    enemy.hp = 260 * diff.hpMult;
    enemy.maxHp = enemy.hp;
    enemy.damage = 20 * diff.damageMult;
    enemy.color = "#ffc07a";
    enemy.archetype = "boss";
  }

  enemy.hp *= diff.hpMult;
  enemy.maxHp = enemy.hp;
  enemy.damage *= diff.damageMult;
  return enemy;
}

function spawnCombatPack(layer, roomType) {
  const baseCount = 3 + layer + Math.floor(roomType === "challenge" ? 2 : 0);
  state.enemies = [];

  for (let i = 0; i < baseCount; i += 1) {
    const roll = state.rng();
    const elite = state.rng() < 0.12 + layer * 0.05;
    let archetype = "echo";
    if (roll > 0.72) archetype = "guardian";
    if (roll > 0.84) archetype = "ego";
    if (roll > 0.93) archetype = "archive";
    state.enemies.push(makeEnemy(archetype, layer, elite));
  }
}

function currentLayerRooms() {
  return state.layers[state.layerIndex] || [];
}

function getCurrentRoom() {
  return currentLayerRooms()[state.roomIndex] || null;
}

function offerFragments(onComplete) {
  const options = [...fragments].sort(() => state.rng() - 0.5).slice(0, 3);
  openOverlay(`
    <h2>Memory Fragments</h2>
    <p>Choose one fragment for this run. Keys: 1, 2 or 3.</p>
    <div class="grid">
      ${options
        .map(
          (f, i) => `
        <button data-frag="${f.id}">
          <strong>${i + 1}. ${f.name}</strong><br />
          <small>${f.type.toUpperCase()}</small><br />
          ${f.desc}
        </button>`
        )
        .join("")}
    </div>
  `);
  overlay.querySelectorAll("[data-frag]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const picked = fragmentById(btn.getAttribute("data-frag"));
      if (!picked) return;
      if (state.fragments.length >= 6) state.fragments.shift();
      state.fragments.push(picked);
      applyPassives();
      closeOverlay();
      if (onComplete) onComplete();
    });
  });
}

function applyChoice(effect) {
  for (const [k, value] of Object.entries(effect)) {
    if (k in state.morality) state.morality[k] += value;
    if (k === "hp") state.player.hp = clamp(state.player.hp + value, 0, state.player.maxHp);
    if (k === "sanity") state.player.sanity = clamp(state.player.sanity + value, 0, state.player.maxSanity);
    if (k === "echo") state.save.echoes += Math.max(0, value);
    if (k === "fragment" && value > 0) {
      const randomFrag = rpick(fragments);
      if (state.fragments.length >= 6) state.fragments.shift();
      state.fragments.push(randomFrag);
    }
  }
  applyPassives();
}

function offerChoice(onComplete) {
  const c = rpick(moralityChoices);
  openOverlay(`
    <h2>Choice Room</h2>
    <p>${c.title}</p>
    <div class="grid">
      <button data-choice="a">${c.a.label}</button>
      <button data-choice="b">${c.b.label}</button>
    </div>
  `);
  overlay.querySelector("[data-choice='a']").addEventListener("click", () => {
    applyChoice(c.a.effect);
    closeOverlay();
    if (onComplete) onComplete();
  });
  overlay.querySelector("[data-choice='b']").addEventListener("click", () => {
    applyChoice(c.b.effect);
    closeOverlay();
    if (onComplete) onComplete();
  });
}

function offerRelic(onComplete) {
  const pick = rpick(relics);
  openOverlay(`
    <h2>Relic Found</h2>
    <p><strong>${pick.name}</strong></p>
    <p>${pick.desc}</p>
    <button id="take-relic">Take relic</button>
  `);
  overlay.querySelector("#take-relic").addEventListener("click", () => {
    state.relics.push(pick);
    applyPassives();
    closeOverlay();
    if (onComplete) onComplete();
  });
}

function openMerchant(onComplete) {
  const fragA = rpick(fragments);
  const fragB = rpick(fragments);
  const relicPick = rpick(relics);
  openOverlay(`
    <h2>The Archivist</h2>
    <p>"I trade echoes and regrets."</p>
    <div class="grid">
      <button data-buy="frag-a">Buy ${fragA.name} (12 echoes)</button>
      <button data-buy="frag-b">Buy ${fragB.name} (12 echoes)</button>
      <button data-buy="relic">Buy ${relicPick.name} (18 echoes)</button>
      <button data-buy="sacrifice">Sacrifice 1 active fragment for random relic</button>
      <button data-buy="leave">Leave</button>
    </div>
  `);

  overlay.querySelectorAll("[data-buy]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-buy");
      if (action === "frag-a" || action === "frag-b") {
        if (state.save.echoes >= 12) {
          state.save.echoes -= 12;
          if (state.fragments.length >= 6) state.fragments.shift();
          state.fragments.push(action === "frag-a" ? fragA : fragB);
        }
      }
      if (action === "relic" && state.save.echoes >= 18) {
        state.save.echoes -= 18;
        state.relics.push(relicPick);
      }
      if (action === "sacrifice") {
        const actives = state.fragments.filter((f) => f.type === "active");
        if (actives.length > 0) {
          const toRemove = actives[0];
          state.fragments = state.fragments.filter((f) => f !== toRemove);
          state.relics.push(rpick(relics));
        }
      }
      applyPassives();
      closeOverlay();
      if (onComplete) onComplete();
    });
  });
}

function openMemoryRoom(onComplete) {
  const layerName = state.patient.layers[state.layerIndex] || "Unnamed Echo";
  const prompts = [
    `A frozen scene from ${layerName} repeats every few seconds.`,
    `A voice whispers: "Do not let them sell this."`,
    `You glimpse your own reflection wearing a patient tag.`,
  ];
  openOverlay(`
    <h2>Memory Diorama</h2>
    <p>${rpick(prompts)}</p>
    <p>You gain insight and recover sanity.</p>
    <button id="mem-continue">Continue</button>
  `);
  overlay.querySelector("#mem-continue").addEventListener("click", () => {
    state.player.sanity = clamp(state.player.sanity + 12, 0, state.player.maxSanity);
    closeOverlay();
    if (onComplete) onComplete();
  });
}

function useShortcut(onComplete) {
  const canSkip = state.layerIndex < state.maxLayers - 2;
  openOverlay(`
    <h2>Shortcut Portal</h2>
    <p>Jump one layer deeper but lose this room rewards.</p>
    <div class="grid">
      <button id="portal-skip" ${canSkip ? "" : "disabled"}>Use portal</button>
      <button id="portal-decline">Stay</button>
    </div>
  `);
  overlay.querySelector("#portal-skip").addEventListener("click", () => {
    closeOverlay();
    state.runFlags.skipRewardsThisRoom = true;
    state.layerIndex += 1;
    state.roomIndex = 0;
    enterCurrentRoom();
  });
  overlay.querySelector("#portal-decline").addEventListener("click", () => {
    closeOverlay();
    if (onComplete) onComplete();
  });
}

function enterCurrentRoom() {
  state.currentRoom = getCurrentRoom();
  if (!state.currentRoom) {
    finishRun(true);
    return;
  }

  state.enemies = [];
  state.effects = [];
  state.runFlags.awaitingRoomResolution = false;
  state.runFlags.challengeWavesLeft = 0;

  const roomType = state.currentRoom.type;
  if (roomType === "combat") {
    spawnCombatPack(state.layerIndex + 1, roomType);
    return;
  }
  if (roomType === "corrupted") {
    spawnCombatPack(state.layerIndex + 1, roomType);
    state.runFlags.challengeWavesLeft = 0;
    return;
  }
  if (roomType === "challenge") {
    state.runFlags.challengeWavesLeft = 2;
    spawnCombatPack(state.layerIndex + 1, roomType);
    return;
  }
  if (roomType === "memory") {
    openMemoryRoom(() => resolveNonCombatRoom());
    return;
  }
  if (roomType === "choice") {
    offerChoice(() => resolveNonCombatRoom());
    return;
  }
  if (roomType === "merchant") {
    openMerchant(() => resolveNonCombatRoom());
    return;
  }
  if (roomType === "shortcut") {
    useShortcut(() => resolveNonCombatRoom());
    return;
  }
  if (roomType === "abyss") {
    showBossDecision();
  }
}

function resolveNonCombatRoom() {
  state.currentRoom.cleared = true;
  state.save.echoes += Math.floor((3 + state.layerIndex) * getDifficultyConfig().rewardMult);
  moveNextRoom();
}

function moveNextRoom() {
  state.roomIndex += 1;
  const layerRooms = currentLayerRooms();
  if (state.roomIndex < layerRooms.length) {
    enterCurrentRoom();
    return;
  }
  state.layerIndex += 1;
  state.roomIndex = 0;
  if (state.layerIndex >= state.maxLayers) {
    finishRun(true);
    return;
  }
  enterCurrentRoom();
}

function rewardAfterCombat(callback) {
  if (state.runFlags.skipRewardsThisRoom) {
    state.runFlags.skipRewardsThisRoom = false;
    callback();
    return;
  }
  state.player.sanity = clamp(state.player.sanity + state.stats.sanityRegen + 2, 0, state.player.maxSanity);
  state.save.echoes += Math.floor((4 + state.layerIndex) * getDifficultyConfig().rewardMult);

  const sequence = [];
  if (state.rng() < 0.68) sequence.push((next) => offerFragments(next));
  if (state.rng() < 0.25) sequence.push((next) => offerRelic(next));
  if (state.rng() < 0.35) sequence.push((next) => offerChoice(next));

  const runSeq = (i) => {
    if (i >= sequence.length) {
      callback();
      return;
    }
    sequence[i](() => runSeq(i + 1));
  };
  runSeq(0);
}

function evaluatePatientOutcome(success) {
  if (!success) return "morte";

  const empathyVector = state.morality.empathy + state.morality.preservation;
  const extractionVector = state.morality.extraction + state.morality.efficiency;
  const rebellionBonus = state.morality.rebellion > state.morality.loyalty ? 1 : 0;
  const score = empathyVector - extractionVector + rebellionBonus;

  if (score >= 3) return "recuperacao total";
  if (score >= 1) return "recuperacao parcial";
  if (score >= -1) return "estado vegetal";
  return "morte";
}

function finishRun(success) {
  state.mode = "hub";
  const reward = success ? 25 + state.layerIndex * 10 : 10 + state.layerIndex * 4;
  state.save.echoes += Math.floor(reward * getDifficultyConfig().rewardMult);
  const patientState = evaluatePatientOutcome(success);
  state.save.journal.unshift({
    at: new Date().toISOString(),
    patient: state.patient?.name || "Unknown",
    state: patientState,
    seed: state.runSeed,
    morality: { ...state.morality },
  });
  state.save.journal = state.save.journal.slice(0, 20);

  if (success) {
    state.save.clinic.resonance += 1;
    if (state.runFlags.ngPlus) {
      state.save.progression.ngPlusWins += 1;
      state.save.progression.ngPlusLevel = Math.max(1, state.save.progression.ngPlusLevel);
    }
    const locked = patients.find((p) => !state.save.unlockedPatients.includes(p.id));
    if (locked) state.save.unlockedPatients.push(locked.id);
  } else {
    state.save.clinic.resonance = Math.max(0, state.save.clinic.resonance - 1);
  }

  saveGame();
  openHub(true, success ? `Run complete. Reward: +${reward} Echoes.` : `Dive failed. You kept +${reward} Echoes.`);
}

function bossPacified() {
  return state.morality.empathy >= 2 && state.morality.preservation >= 1 && state.morality.extraction <= 1;
}

function showBossDecision() {
  openOverlay(`
    <h2>The Abyss Core</h2>
    <p>${state.patient.bossName} watches you.</p>
    <div class="grid">
      <button id="convince">Attempt to calm the consciousness</button>
      <button id="fight">Force extraction</button>
    </div>
  `);
  overlay.querySelector("#convince").addEventListener("click", () => {
    closeOverlay();
    if (bossPacified()) {
      finishRun(true);
    } else {
      state.morality.extraction += 1;
      state.morality.preservation -= 1;
      spawnBossFight();
    }
  });
  overlay.querySelector("#fight").addEventListener("click", () => {
    closeOverlay();
    state.morality.extraction += 2;
    spawnBossFight();
  });
}

function spawnBossFight() {
  state.currentRoom.type = "bossFight";
  state.enemies = [makeEnemy("boss", state.maxLayers, true, true)];
}

function upgradeCost(name) {
  const level = state.save.upgrades[name];
  return 20 + level * 15;
}

function buyUpgrade(name) {
  const cost = upgradeCost(name);
  if (state.save.echoes < cost) return;
  state.save.echoes -= cost;
  state.save.upgrades[name] += 1;
  saveGame();
  openHub(true, `Upgrade ${name.toUpperCase()} purchased.`);
}

function updateSettings(partial) {
  state.save.settings = { ...state.save.settings, ...partial };
  saveGame();
  openHub(true, "Settings updated.");
}

function talkToNpc(npcId) {
  const line = getNpcLine(npcId);
  state.save.clinic.npcTrust[npcId] = (state.save.clinic.npcTrust[npcId] || 0) + 1;
  saveGame();
  openOverlay(`
    <h2>Clinic Dialogue</h2>
    <p>${line}</p>
    <button id="npc-back">Back to clinic</button>
  `);
  overlay.querySelector("#npc-back").addEventListener("click", () => openHub(true, "NPC log updated."));
}

function renderHubHtml(message = "") {
  const resonance = getResonanceTier();
  const storyAct = getStoryAct();
  const ngUnlocked = canStartNgPlus();
  const patientCards = getAvailablePatients()
    .map(
      (p) => `
        <button data-patient="${p.id}">
          <strong>${p.name}</strong> (${p.age})<br />
          ${p.role}<br />
          <small>Symptom: ${p.symptom}</small>
        </button>
      `
    )
    .join("");

  const journal = state.save.journal
    .slice(0, 6)
    .map((j) => `<li>${j.patient} - ${j.state} - seed ${j.seed || "n/a"}</li>`)
    .join("");

  return `
    <h2>NEXMIND Clinic - Hub</h2>
    <p>Echoes: <strong>${state.save.echoes}</strong> ${message ? `<span class="badge">${message}</span>` : ""}</p>
    <h3>Choose Patient</h3>
    <div class="grid">${patientCards}</div>
    <h3>Run Seed</h3>
    <input id="seed-input" placeholder="optional seed (shareable)" value="" />
    <h3>Run Mode</h3>
    <div class="grid">
      <button data-runmode="standard">Standard ${state.save.settings.runMode === "standard" ? "(active)" : ""}</button>
      <button data-runmode="ngplus" ${ngUnlocked ? "" : "disabled"}>New Game+ ${state.save.settings.runMode === "ngplus" ? "(active)" : ""}</button>
    </div>
    <h3>Permanent Upgrades</h3>
    <div class="grid">
      <button data-upgrade="hp">HP Lv ${state.save.upgrades.hp} (cost ${upgradeCost("hp")})</button>
      <button data-upgrade="sanity">Sanity Lv ${state.save.upgrades.sanity} (cost ${upgradeCost("sanity")})</button>
      <button data-upgrade="dodge">Dodge Lv ${state.save.upgrades.dodge} (cost ${upgradeCost("dodge")})</button>
    </div>
    <h3>Accessibility</h3>
    <div class="grid">
      <button data-speed="0.5">Speed 0.5x ${state.save.settings.speed === 0.5 ? "(active)" : ""}</button>
      <button data-speed="0.75">Speed 0.75x ${state.save.settings.speed === 0.75 ? "(active)" : ""}</button>
      <button data-speed="1">Speed 1x ${state.save.settings.speed === 1 ? "(active)" : ""}</button>
      <button data-difficulty="narrative">Narrative ${state.save.settings.difficulty === "narrative" ? "(active)" : ""}</button>
      <button data-difficulty="normal">Normal ${state.save.settings.difficulty === "normal" ? "(active)" : ""}</button>
      <button data-difficulty="abyss">Abyss ${state.save.settings.difficulty === "abyss" ? "(active)" : ""}</button>
      <button data-color="default">Default Palette ${state.save.settings.colorMode === "default" ? "(active)" : ""}</button>
      <button data-color="deuteranopia">Deuteranopia ${state.save.settings.colorMode === "deuteranopia" ? "(active)" : ""}</button>
      <button data-color="protanopia">Protanopia ${state.save.settings.colorMode === "protanopia" ? "(active)" : ""}</button>
      <button data-corrupted="on">Arquivo Corrompido ${state.save.settings.corruptedMode ? "(active)" : ""}</button>
      <button data-corrupted="off">Modo Padrao ${!state.save.settings.corruptedMode ? "(active)" : ""}</button>
    </div>
    <h3>Clinic Ressonance</h3>
    <p>Resonance ${state.save.clinic.resonance} - ${resonance.name}</p>
    <p>Story: ${storyAct.name}</p>
    <p>NG+ Wins: ${state.save.progression.ngPlusWins} ${ngUnlocked ? "(unlocked)" : "(unlock at resonance 12)"}</p>
    <div class="grid">
      <button data-npc="lyra">Talk: Lyra (Analyst)</button>
      <button data-npc="ordan">Talk: Ordan (Security)</button>
      <button data-npc="mira">Talk: Mira (Nurse)</button>
    </div>
    <h3>Soul Diver Journal</h3>
    <ul>${journal || "<li>No entries yet.</li>"}</ul>
    <p><small>Run controls: WASD move, Mouse click basic attack, Space dodge, Q/E active abilities.</small></p>
  `;
}

function openHub(show = true, message = "") {
  state.mode = "hub";
  if (!show) return;

  openOverlay(renderHubHtml(message));
  overlay.querySelectorAll("[data-patient]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const patient = getPatientById(btn.getAttribute("data-patient"));
      const seedInput = overlay.querySelector("#seed-input");
      const seed = seedInput?.value || "";
      const useNgPlus = state.save.settings.runMode === "ngplus" && canStartNgPlus();
      if (patient) resetRunFor(patient, seed, useNgPlus);
    });
  });
  overlay.querySelectorAll("[data-upgrade]").forEach((btn) => {
    btn.addEventListener("click", () => buyUpgrade(btn.getAttribute("data-upgrade")));
  });
  overlay.querySelectorAll("[data-speed]").forEach((btn) => {
    btn.addEventListener("click", () => updateSettings({ speed: Number(btn.getAttribute("data-speed")) }));
  });
  overlay.querySelectorAll("[data-difficulty]").forEach((btn) => {
    btn.addEventListener("click", () => updateSettings({ difficulty: btn.getAttribute("data-difficulty") }));
  });
  overlay.querySelectorAll("[data-color]").forEach((btn) => {
    btn.addEventListener("click", () => updateSettings({ colorMode: btn.getAttribute("data-color") }));
  });
  overlay.querySelectorAll("[data-runmode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-runmode");
      if (mode === "ngplus" && !canStartNgPlus()) return;
      updateSettings({ runMode: mode });
    });
  });
  overlay.querySelectorAll("[data-corrupted]").forEach((btn) => {
    btn.addEventListener("click", () => updateSettings({ corruptedMode: btn.getAttribute("data-corrupted") === "on" }));
  });
  overlay.querySelectorAll("[data-npc]").forEach((btn) => {
    btn.addEventListener("click", () => talkToNpc(btn.getAttribute("data-npc")));
  });
}

function getActives() {
  return state.fragments.filter((f) => f.type === "active").slice(0, 2);
}

function applyEffectDamage(dt) {
  for (const fx of state.effects) {
    fx.time -= dt;
    if (fx.time <= 0) continue;
    for (const enemy of state.enemies) {
      const dist = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
      if (dist > fx.radius + enemy.r) continue;
      enemy.hp -= fx.damage * dt * 10;
      enemy.stun = Math.max(enemy.stun, 0.1 + state.stats.stunBonus);
      if (fx.push) {
        const kx = (enemy.x - state.player.x) / (dist || 1);
        const ky = (enemy.y - state.player.y) / (dist || 1);
        enemy.x += kx * fx.push * dt;
        enemy.y += ky * fx.push * dt;
      }
    }
  }
  state.effects = state.effects.filter((fx) => fx.time > 0);
}

function updateEnemy(enemy, dt) {
  if (enemy.stun > 0) {
    enemy.stun -= dt;
    return;
  }

  const ex = state.player.x - enemy.x;
  const ey = state.player.y - enemy.y;
  const em = Math.hypot(ex, ey) || 1;

  const speedMult = getEnemySpeedMult();

  if (enemy.archetype === "echo") {
    enemy.x += (ex / em) * enemy.speed * speedMult * dt;
    enemy.y += (ey / em) * enemy.speed * speedMult * dt;
  }

  if (enemy.archetype === "guardian") {
    enemy.dashCd -= dt;
    const moveSpeed = enemy.dashCd <= 0 ? enemy.speed * 2.2 : enemy.speed;
    enemy.x += (ex / em) * moveSpeed * speedMult * dt;
    enemy.y += (ey / em) * moveSpeed * speedMult * dt;
    if (enemy.dashCd <= -0.25) enemy.dashCd = rrand(1.2, 2.2);
  }

  if (enemy.archetype === "ego") {
    enemy.blinkCd -= dt;
    if (enemy.blinkCd <= 0) {
      enemy.x = clamp(state.player.x + rrand(-120, 120), 24, canvas.width - 24);
      enemy.y = clamp(state.player.y + rrand(-120, 120), 24, canvas.height - 24);
      enemy.blinkCd = rrand(1.2, 2.3);
    }
    enemy.x += (state.player.vx * 0.45 + ex * 0.25) * speedMult * dt;
    enemy.y += (state.player.vy * 0.45 + ey * 0.25) * speedMult * dt;
  }

  if (enemy.archetype === "archive") {
    enemy.blinkCd -= dt;
    if (enemy.blinkCd <= 0) {
      enemy.visible = !enemy.visible;
      enemy.blinkCd = rrand(0.8, 1.6);
    }
    enemy.x += (ex / em) * enemy.speed * speedMult * dt;
    enemy.y += (ey / em) * enemy.speed * speedMult * dt;
  }

  if (enemy.archetype === "boss") {
    enemy.dashCd -= dt;
    const moveSpeed = enemy.dashCd < 0 ? enemy.speed * 2.5 : enemy.speed;
    enemy.x += (ex / em) * moveSpeed * speedMult * dt;
    enemy.y += (ey / em) * moveSpeed * speedMult * dt;
    if (enemy.dashCd < -0.4) enemy.dashCd = 1.5;
  }

  const canHit = enemy.archetype !== "archive" || enemy.visible || state.runFlags.revealTimer > 0 || state.flags.revealInvisible;
  const touch = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) < enemy.r + state.player.r;
  if (canHit && touch && state.player.invulnTimer <= 0) {
    state.player.hp -= enemy.damage * state.stats.contactDamageMult * getContactDamageMult() * dt;
    state.player.sanity -= enemy.damage * 0.35 * dt;
  }
}

function update(dt) {
  if (state.mode !== "run") return;
  if (overlay.classList.contains("show")) return;

  const diff = getDifficultyConfig();
  state.runFlags.revealTimer = Math.max(0, state.runFlags.revealTimer - dt);

  state.cooldowns.attack = Math.max(0, state.cooldowns.attack - dt);
  state.cooldowns.active1 = Math.max(0, state.cooldowns.active1 - dt);
  state.cooldowns.active2 = Math.max(0, state.cooldowns.active2 - dt);
  state.cooldowns.dodge = Math.max(0, state.cooldowns.dodge - dt);

  state.player.invulnTimer = Math.max(0, state.player.invulnTimer - dt);
  state.player.dodgeTimer = Math.max(0, state.player.dodgeTimer - dt);

  let dx = 0;
  let dy = 0;
  if (keys.has("w")) dy -= 1;
  if (keys.has("s")) dy += 1;
  if (keys.has("a")) dx -= 1;
  if (keys.has("d")) dx += 1;

  const mag = Math.hypot(dx, dy) || 1;
  const speed = state.player.dodgeTimer > 0 ? state.player.speed * 2.6 : state.player.speed;
  state.player.vx = (dx / mag) * speed;
  state.player.vy = (dy / mag) * speed;
  state.player.x += state.player.vx * dt;
  state.player.y += state.player.vy * dt;
  state.player.x = clamp(state.player.x, 24, canvas.width - 24);
  state.player.y = clamp(state.player.y, 24, canvas.height - 24);
  state.player.facing = Math.atan2(pointer.y - state.player.y, pointer.x - state.player.x);

  const inCorruptedRoom = state.currentRoom?.type === "corrupted";
  const sanityDrain = (2.5 + state.enemies.length * 0.03 + (inCorruptedRoom ? 2.3 : 0) + getSanityDrainBonus()) * diff.sanityDrainMult;
  state.player.sanity = clamp(state.player.sanity - sanityDrain * dt, 0, state.player.maxSanity);
  if (state.player.sanity <= 0) state.player.hp -= dt * 6;

  for (const enemy of state.enemies) {
    updateEnemy(enemy, dt);
  }

  applyEffectDamage(dt);

  state.enemies = state.enemies.filter((e) => e.hp > 0);
  if (state.player.hp <= 0) {
    finishRun(false);
    return;
  }

  if (state.enemies.length === 0) {
    if (state.currentRoom?.type === "challenge" && state.runFlags.challengeWavesLeft > 0) {
      state.runFlags.challengeWavesLeft -= 1;
      spawnCombatPack(state.layerIndex + 1, "challenge");
      return;
    }

    if (state.currentRoom?.type === "bossFight") {
      finishRun(true);
      return;
    }

    if (["combat", "corrupted", "challenge"].includes(state.currentRoom?.type || "")) {
      rewardAfterCombat(() => {
        state.currentRoom.cleared = true;
        moveNextRoom();
      });
    }
  }
}

function draw() {
  const sanityFactor = state.player.sanity / Math.max(1, state.player.maxSanity);
  const hue = 210 - (state.layerIndex + 1) * 18 + Math.floor((1 - sanityFactor) * 22);
  ctx.fillStyle = `hsl(${hue} 40% 11%)`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const flicker = sanityFactor < 0.25 && state.rng() < 0.16;
  if (flicker) {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const shake = sanityFactor <= 0 ? 3 : 0;
  const sx = shake ? rrand(-shake, shake) : 0;
  const sy = shake ? rrand(-shake, shake) : 0;
  ctx.save();
  ctx.translate(sx, sy);

  if (getLayerMutator() === "blackout" && state.rng() < 0.32) {
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  for (let i = 0; i < 16; i += 1) {
    ctx.fillStyle = `hsla(${hue + i * 2} 50% 35% / 0.15)`;
    const size = 24 + i * 7;
    ctx.fillRect(i * 80, 0, size, canvas.height);
  }

  for (const enemy of state.enemies) {
    const visible = enemy.archetype !== "archive" || enemy.visible || state.runFlags.revealTimer > 0 || state.flags.revealInvisible;
    if (!visible) continue;

    ctx.globalAlpha = enemy.archetype === "archive" && !state.flags.revealInvisible ? 0.55 : 1;
    ctx.fillStyle = enemy.color;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (state.flags.showEnemyHp || enemy.boss) {
      ctx.fillStyle = "#2c3f52";
      ctx.fillRect(enemy.x - 20, enemy.y - enemy.r - 12, 40, 4);
      ctx.fillStyle = "#ff9a73";
      ctx.fillRect(enemy.x - 20, enemy.y - enemy.r - 12, 40 * (enemy.hp / enemy.maxHp), 4);
    }
  }

  for (const fx of state.effects) {
    ctx.strokeStyle = fx.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(state.player.x, state.player.y, fx.radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  const colors = getColorPreset();
  ctx.fillStyle = state.player.invulnTimer > 0 ? "#f8e9a7" : colors.player;
  ctx.beginPath();
  ctx.arc(state.player.x, state.player.y, state.player.r, 0, Math.PI * 2);
  ctx.fill();

  const fx = state.player.x + Math.cos(state.player.facing) * 26;
  const fy = state.player.y + Math.sin(state.player.facing) * 26;
  ctx.strokeStyle = colors.accent;
  ctx.beginPath();
  ctx.moveTo(state.player.x, state.player.y);
  ctx.lineTo(fx, fy);
  ctx.stroke();

  ctx.restore();
}

function renderHud() {
  if (state.mode !== "run") {
    hud.innerHTML = `<span class="badge">Echo Abyss Prototype</span><span>Open the clinic overlay to start.</span>`;
    panel.innerHTML = "Seeded runs, room types, challenge rooms, merchant, and archetype enemies are now active in this build.";
    return;
  }

  const actives = getActives();
  const a1 = actives[0]?.name || "-";
  const a2 = actives[1]?.name || "-";
  const insanity = state.player.sanity <= 0 ? "<span class='stat-danger'>COLLAPSE</span>" : "stable";
  const roomLabel = roomTypeNames[state.currentRoom?.type] || "Unknown";
  const mutatorLabel = mutatorNames[getLayerMutator()] || mutatorNames.none;
  const roomInLayer = state.roomIndex + 1;
  const layerTotal = currentLayerRooms().length;

  hud.innerHTML = `
    <span>Patient: <strong>${state.patient.name}</strong></span>
    <span>Layer ${state.layerIndex + 1}/${state.maxLayers} - Room ${roomInLayer}/${layerTotal} (${roomLabel})</span>
    <span>HP <strong class="${state.player.hp < state.player.maxHp * 0.35 ? "stat-danger" : ""}">${Math.round(state.player.hp)}/${Math.round(state.player.maxHp)}</strong></span>
    <span>Sanity <strong class="${state.player.sanity < state.player.maxSanity * 0.3 ? "stat-danger" : "stat-ok"}">${Math.round(state.player.sanity)}/${Math.round(state.player.maxSanity)}</strong> (${insanity})</span>
    <span>Seed ${state.runSeed}</span>
    <span>Mutator ${mutatorLabel}</span>
    <span>Mode ${state.runFlags.ngPlus ? "NG+" : "Standard"}</span>
  `;

  panel.innerHTML = `
    <strong>Build</strong><br />
    Active Q: ${a1}<br />
    Active E: ${a2}<br />
    Fragments: ${state.fragments.map((f) => f.name).join(", ") || "none"}<br />
    Relics: ${state.relics.map((r) => r.name).join(", ") || "none"}<br />
    Synergies: ${state.synergies.join(" | ") || "none"}<br />
    Run mode: ${state.runFlags.ngPlus ? "New Game+" : "Standard"}<br />
    Morality: E/P ${state.morality.empathy}/${state.morality.preservation}, Eff/Ext ${state.morality.efficiency}/${state.morality.extraction}, Loy/Reb ${state.morality.loyalty}/${state.morality.rebellion}
    <br />Corrupted Mode: ${state.save.settings.corruptedMode ? "ON" : "OFF"}
    ${state.flags.showRoomForecast ? `<br />Forecast: elite chance ${(12 + (state.layerIndex + 1) * 5).toFixed(0)}%` : ""}
    ${state.currentRoom?.type === "challenge" ? `<br />Challenge waves left: ${state.runFlags.challengeWavesLeft}` : ""}
  `;
}

function basicAttack() {
  if (state.mode !== "run" || overlay.classList.contains("show")) return;
  if (state.cooldowns.attack > 0) return;
  state.cooldowns.attack = 0.28 * state.stats.attackCdMult;

  const range = 72;
  for (const enemy of state.enemies) {
    const canHit = enemy.archetype !== "archive" || enemy.visible || state.runFlags.revealTimer > 0 || state.flags.revealInvisible;
    if (!canHit) continue;

    const dist = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
    if (dist > range + enemy.r) continue;
    const angleToEnemy = Math.atan2(enemy.y - state.player.y, enemy.x - state.player.x);
    const diff = Math.abs(Math.atan2(Math.sin(angleToEnemy - state.player.facing), Math.cos(angleToEnemy - state.player.facing)));
    if (diff < 0.8) {
      enemy.hp -= state.stats.baseDamage;
      enemy.stun = Math.max(enemy.stun, 0.12);
    }
  }
  state.effects.push({ type: "ring", time: 0.06, radius: 58, damage: 0, color: "#a2d8ff" });
}

function triggerActive(slot) {
  if (state.mode !== "run" || overlay.classList.contains("show")) return;
  const actives = getActives();
  const frag = actives[slot - 1];
  if (!frag) return;
  const cdName = slot === 1 ? "active1" : "active2";
  if (state.cooldowns[cdName] > 0) return;
  state.cooldowns[cdName] = 1.2;
  frag.onUse?.(state);
}

function doDodge() {
  if (state.mode !== "run" || overlay.classList.contains("show")) return;
  if (state.cooldowns.dodge > 0) return;
  state.cooldowns.dodge = 1.1 * state.stats.dodgeCdMult;
  state.player.dodgeTimer = 0.2;
  state.player.invulnTimer = hasFragment("echo-fangs") && hasFragment("glass-step") ? 0.29 : 0.22;
}

window.addEventListener("keydown", (e) => {
  keys.add(e.key.toLowerCase());
  if (e.key === " ") {
    e.preventDefault();
    doDodge();
  }
  if (e.key.toLowerCase() === "q") triggerActive(1);
  if (e.key.toLowerCase() === "e") triggerActive(2);

  if (overlay.classList.contains("show") && ["1", "2", "3"].includes(e.key)) {
    const btn = overlay.querySelectorAll("[data-frag]")[Number(e.key) - 1];
    btn?.click();
  }
});

window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
canvas.addEventListener("mousemove", (e) => {
  const r = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - r.left) / r.width) * canvas.width;
  pointer.y = ((e.clientY - r.top) / r.height) * canvas.height;
});
canvas.addEventListener("mousedown", basicAttack);

let last = performance.now();
function loop(now) {
  const speed = state.save.settings.speed || 1;
  const dt = Math.min(0.033, ((now - last) / 1000) * speed);
  last = now;

  update(dt);
  draw();
  renderHud();

  requestAnimationFrame(loop);
}

openHub(true);
requestAnimationFrame(loop);
