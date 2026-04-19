import { fragments, moralityChoices, patients, relics } from "./content.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const hud = document.getElementById("hud");
const panel = document.getElementById("panel");
const overlay = document.getElementById("overlay");

const keys = new Set();
const pointer = { x: canvas.width / 2, y: canvas.height / 2 };

const saveKey = "echo-abyss-save-v1";
const baseSave = {
  echoes: 0,
  unlockedPatients: ["mara", "tomas", "luna"],
  upgrades: { hp: 0, sanity: 0, dodge: 0 },
  journal: [],
};

const state = {
  mode: "hub",
  save: loadSave(),
  patient: null,
  layer: 1,
  room: 1,
  roomsPerLayer: 5,
  maxLayers: 4,
  enemies: [],
  effects: [],
  projectiles: [],
  fragments: [],
  relics: [],
  cooldowns: { active1: 0, active2: 0, attack: 0, dodge: 0 },
  stats: {
    dodgeCdMult: 1,
    sanityRegen: 0,
    stunBonus: 0,
    baseDamage: 14,
  },
  flags: { showEnemyHp: false, showRoomForecast: false },
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
    return raw ? { ...baseSave, ...JSON.parse(raw) } : structuredClone(baseSave);
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

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function spawnRoom() {
  state.enemies = [];
  const count = 3 + state.layer + Math.floor(state.room / 2);
  const eliteChance = 0.15 + state.layer * 0.06;
  for (let i = 0; i < count; i += 1) {
    const elite = Math.random() < eliteChance;
    state.enemies.push({
      x: rand(140, canvas.width - 100),
      y: rand(120, canvas.height - 110),
      r: elite ? 18 : 14,
      speed: elite ? 95 : 78,
      hp: elite ? 60 + state.layer * 12 : 32 + state.layer * 9,
      maxHp: elite ? 60 + state.layer * 12 : 32 + state.layer * 9,
      damage: elite ? 17 : 10,
      stun: 0,
      elite,
      color: elite ? "#ff7d66" : "#9bc5ff",
    });
  }
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

function resetRunFor(patient) {
  state.mode = "run";
  state.patient = patient;
  state.layer = 1;
  state.room = 1;
  state.fragments = [];
  state.relics = [];
  state.effects = [];
  state.projectiles = [];
  state.stats = {
    dodgeCdMult: 1,
    sanityRegen: 0,
    stunBonus: 0,
    baseDamage: 14,
  };
  state.flags = { showEnemyHp: false, showRoomForecast: false };
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

  spawnRoom();
  closeOverlay();
}

function fragmentById(id) {
  return fragments.find((f) => f.id === id);
}

function hasFragment(id) {
  return state.fragments.some((f) => f.id === id);
}

function applyPassives() {
  state.stats = {
    dodgeCdMult: 1,
    sanityRegen: 0,
    stunBonus: 0,
    baseDamage: 14,
  };
  state.flags = { showEnemyHp: false, showRoomForecast: false };
  for (const frag of state.fragments) {
    if (frag.type === "passive" && frag.apply) frag.apply(state);
  }
  for (const relic of state.relics) {
    if (relic.apply) relic.apply(state);
  }
}

function offerFragments() {
  const options = [...fragments].sort(() => Math.random() - 0.5).slice(0, 3);
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
    });
  });
}

function offerChoice() {
  const c = moralityChoices[Math.floor(Math.random() * moralityChoices.length)];
  openOverlay(`
    <h2>Choice Room</h2>
    <p>${c.title}</p>
    <div class="grid">
      <button data-choice="a">${c.a.label}</button>
      <button data-choice="b">${c.b.label}</button>
    </div>
  `);
  overlay.querySelector("[data-choice='a']").addEventListener("click", () => applyChoice(c.a.effect));
  overlay.querySelector("[data-choice='b']").addEventListener("click", () => applyChoice(c.b.effect));
}

function applyChoice(effect) {
  for (const [k, value] of Object.entries(effect)) {
    if (k in state.morality) state.morality[k] += value;
    if (k === "hp") state.player.hp = clamp(state.player.hp + value, 0, state.player.maxHp);
    if (k === "sanity") state.player.sanity = clamp(state.player.sanity + value, 0, state.player.maxSanity);
    if (k === "echo") state.save.echoes += Math.max(0, value);
    if (k === "fragment" && value > 0) {
      const randomFrag = fragments[Math.floor(Math.random() * fragments.length)];
      if (state.fragments.length >= 6) state.fragments.shift();
      state.fragments.push(randomFrag);
    }
  }
  applyPassives();
  closeOverlay();
}

function offerRelic() {
  const pick = relics[Math.floor(Math.random() * relics.length)];
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
  });
}

function onRoomCleared() {
  state.player.sanity = clamp(state.player.sanity + state.stats.sanityRegen, 0, state.player.maxSanity);
  state.room += 1;
  state.save.echoes += 3 + state.layer;
  if (Math.random() < 0.65) {
    offerFragments();
  }
  if (Math.random() < 0.28) {
    offerRelic();
  }
  if (Math.random() < 0.42) {
    offerChoice();
  }

  if (state.room > state.roomsPerLayer) {
    if (state.layer >= state.maxLayers) {
      finishRun(true);
      return;
    }
    state.layer += 1;
    state.room = 1;
  }
  spawnRoom();
}

function finishRun(success) {
  state.mode = "hub";
  const reward = success ? 25 + state.layer * 10 : 10 + state.layer * 4;
  state.save.echoes += reward;
  const patientState = success ? "rescued" : "lost";
  state.save.journal.unshift({
    at: new Date().toISOString(),
    patient: state.patient.name,
    state: patientState,
    morality: { ...state.morality },
  });
  state.save.journal = state.save.journal.slice(0, 20);

  if (success) {
    const locked = patients.find((p) => !state.save.unlockedPatients.includes(p.id));
    if (locked) state.save.unlockedPatients.push(locked.id);
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
  state.enemies = [
    {
      x: canvas.width * 0.65,
      y: canvas.height * 0.5,
      r: 34,
      speed: 85,
      hp: 240,
      maxHp: 240,
      damage: 22,
      stun: 0,
      elite: true,
      color: "#ffc07a",
      boss: true,
    },
  ];
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

function renderHubHtml(message = "") {
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
    .slice(0, 5)
    .map((j) => `<li>${j.patient} - ${j.state} (${new Date(j.at).toLocaleString()})</li>`)
    .join("");

  return `
    <h2>NEXMIND Clinic - Hub</h2>
    <p>Echoes: <strong>${state.save.echoes}</strong> ${message ? `<span class="badge">${message}</span>` : ""}</p>
    <h3>Choose Patient</h3>
    <div class="grid">${patientCards}</div>
    <h3>Permanent Upgrades</h3>
    <div class="grid">
      <button data-upgrade="hp">HP Lv ${state.save.upgrades.hp} (cost ${upgradeCost("hp")})</button>
      <button data-upgrade="sanity">Sanity Lv ${state.save.upgrades.sanity} (cost ${upgradeCost("sanity")})</button>
      <button data-upgrade="dodge">Dodge Lv ${state.save.upgrades.dodge} (cost ${upgradeCost("dodge")})</button>
    </div>
    <h3>Soul Diver Journal</h3>
    <ul>${journal || "<li>No entries yet.</li>"}</ul>
    <p><small>Controls in run: WASD move, Mouse click basic attack, Space dodge, Q active1, E active2.</small></p>
  `;
}

function openHub(show = true, message = "") {
  state.mode = "hub";
  if (show) {
    openOverlay(renderHubHtml(message));
    overlay.querySelectorAll("[data-patient]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = getPatientById(btn.getAttribute("data-patient"));
        if (p) resetRunFor(p);
      });
    });
    overlay.querySelectorAll("[data-upgrade]").forEach((btn) => {
      btn.addEventListener("click", () => buyUpgrade(btn.getAttribute("data-upgrade")));
    });
  }
}

function getActives() {
  return state.fragments.filter((f) => f.type === "active").slice(0, 2);
}

function update(dt) {
  if (state.mode !== "run") return;
  if (overlay.classList.contains("show")) return;

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

  state.player.sanity = clamp(state.player.sanity - 2.7 * dt - state.enemies.length * 0.025, 0, state.player.maxSanity);
  if (state.player.sanity <= 0) {
    state.player.hp -= dt * 6;
  }

  for (const enemy of state.enemies) {
    if (enemy.stun > 0) {
      enemy.stun -= dt;
      continue;
    }
    const ex = state.player.x - enemy.x;
    const ey = state.player.y - enemy.y;
    const em = Math.hypot(ex, ey) || 1;
    enemy.x += (ex / em) * enemy.speed * dt;
    enemy.y += (ey / em) * enemy.speed * dt;

    const touch = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) < enemy.r + state.player.r;
    if (touch && state.player.invulnTimer <= 0) {
      state.player.hp -= enemy.damage * dt;
      state.player.sanity -= enemy.damage * dt * 0.35;
    }
  }

  for (const fx of state.effects) {
    fx.time -= dt;
    if (fx.time > 0) {
      for (const enemy of state.enemies) {
        const dist = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
        if (dist <= fx.radius + enemy.r) {
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
    }
  }
  state.effects = state.effects.filter((fx) => fx.time > 0);

  state.enemies = state.enemies.filter((e) => e.hp > 0);
  if (state.player.hp <= 0) {
    finishRun(false);
  }

  if (state.enemies.length === 0) {
    if (state.layer === state.maxLayers && state.room === state.roomsPerLayer) {
      showBossDecision();
    } else {
      onRoomCleared();
    }
  }
}

function draw() {
  const sanityFactor = state.player.sanity / state.player.maxSanity;
  const hue = 210 - state.layer * 18 + Math.floor((1 - sanityFactor) * 22);
  ctx.fillStyle = `hsl(${hue} 40% 11%)`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const flicker = sanityFactor < 0.25 && Math.random() < 0.16;
  if (flicker) {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const shake = sanityFactor <= 0 ? 3 : 0;
  const sx = shake ? rand(-shake, shake) : 0;
  const sy = shake ? rand(-shake, shake) : 0;
  ctx.save();
  ctx.translate(sx, sy);

  for (let i = 0; i < 16; i += 1) {
    ctx.fillStyle = `hsla(${hue + i * 2} 50% 35% / 0.15)`;
    const size = 24 + i * 7;
    ctx.fillRect(i * 80, 0, size, canvas.height);
  }

  for (const enemy of state.enemies) {
    ctx.fillStyle = enemy.color;
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.r, 0, Math.PI * 2);
    ctx.fill();

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

  ctx.fillStyle = state.player.invulnTimer > 0 ? "#f8e9a7" : "#d0f2ff";
  ctx.beginPath();
  ctx.arc(state.player.x, state.player.y, state.player.r, 0, Math.PI * 2);
  ctx.fill();

  const fx = state.player.x + Math.cos(state.player.facing) * 26;
  const fy = state.player.y + Math.sin(state.player.facing) * 26;
  ctx.strokeStyle = "#7ad9ff";
  ctx.beginPath();
  ctx.moveTo(state.player.x, state.player.y);
  ctx.lineTo(fx, fy);
  ctx.stroke();

  ctx.restore();
}

function renderHud() {
  if (state.mode !== "run") {
    hud.innerHTML = `<span class="badge">Echo Abyss Prototype</span><span>Open the clinic overlay to start.</span>`;
    panel.innerHTML = "Use this prototype to test core loop: choose patient, clear layers, make choices, fight/pacify final core.";
    return;
  }

  const actives = getActives();
  const a1 = actives[0]?.name || "-";
  const a2 = actives[1]?.name || "-";
  const insanity = state.player.sanity <= 0 ? "<span class='stat-danger'>COLLAPSE</span>" : "stable";

  hud.innerHTML = `
    <span>Patient: <strong>${state.patient.name}</strong></span>
    <span>Layer ${state.layer}/${state.maxLayers} - Room ${state.room}/${state.roomsPerLayer}</span>
    <span>HP <strong class="${state.player.hp < state.player.maxHp * 0.35 ? "stat-danger" : ""}">${Math.round(state.player.hp)}/${state.player.maxHp}</strong></span>
    <span>Sanity <strong class="${state.player.sanity < state.player.maxSanity * 0.3 ? "stat-danger" : "stat-ok"}">${Math.round(state.player.sanity)}/${state.player.maxSanity}</strong> (${insanity})</span>
    <span>Echoes ${state.save.echoes}</span>
  `;

  panel.innerHTML = `
    <strong>Build</strong><br />
    Active Q: ${a1}<br />
    Active E: ${a2}<br />
    Fragments: ${state.fragments.map((f) => f.name).join(", ") || "none"}<br />
    Relics: ${state.relics.map((r) => r.name).join(", ") || "none"}<br />
    Morality: E/P ${state.morality.empathy}/${state.morality.preservation}, Eff/Ext ${state.morality.efficiency}/${state.morality.extraction}, Loy/Reb ${state.morality.loyalty}/${state.morality.rebellion}
    ${state.flags.showRoomForecast ? `<br />Forecast: elite chance ${(15 + state.layer * 6).toFixed(0)}%` : ""}
  `;
}

function basicAttack() {
  if (state.mode !== "run" || overlay.classList.contains("show")) return;
  if (state.cooldowns.attack > 0) return;
  state.cooldowns.attack = 0.28;

  const range = 70;
  for (const enemy of state.enemies) {
    const dist = Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y);
    if (dist > range + enemy.r) continue;
    const angleToEnemy = Math.atan2(enemy.y - state.player.y, enemy.x - state.player.x);
    const diff = Math.abs(Math.atan2(Math.sin(angleToEnemy - state.player.facing), Math.cos(angleToEnemy - state.player.facing)));
    if (diff < 0.75) {
      enemy.hp -= state.stats.baseDamage;
      enemy.stun = Math.max(enemy.stun, 0.12);
    }
  }
  state.effects.push({ type: "ring", time: 0.06, radius: 55, damage: 0, color: "#a2d8ff" });
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
  state.player.invulnTimer = 0.22;
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
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  update(dt);
  draw();
  renderHud();

  requestAnimationFrame(loop);
}

openHub(true);
requestAnimationFrame(loop);
