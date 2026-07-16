// Orchestration: state, observation tracking, generation loop, typewriter, self-editing, voice.
import * as entity from "./entity.js";
import { buildReport, LOADING_LINES, CONSOLE_LINES } from "./persona.js";
import { startBackdrop } from "./backdrop.js";

const $ = (id) => document.getElementById(id);

// ---------- WebGPU gate ----------
if (!navigator.gpu) {
  $("loader").style.display = "none";
  $("nogpu").style.display = "flex";
  throw new Error("no webgpu");
}

// ---------- state (memory across visits) ----------
const KEY = "revenant";
const prev = JSON.parse(localStorage.getItem(KEY) || "null");
const state = {
  visits: (prev?.visits ?? 0) + 1,
  lastSeen: prev?.lastSeen ?? 0,
  v: prev?.v ?? 0,          // valence -1..1
  a: prev?.a ?? 0.3,        // arousal 0..1
  obs: [],                  // this session's observations
  lastLine: prev?.lastLine ?? "",
  arrivedAt: Date.now(),
};
const sinceLast = state.lastSeen ? Date.now() - state.lastSeen : 0;
// carry one observation over from last visit so it can reference the past
if (prev?.obs?.length) state.obs.push(`(last visit: ${prev.obs[prev.obs.length - 1]})`);
const save = () => localStorage.setItem(KEY, JSON.stringify({ ...state, lastSeen: Date.now() }));
save();
addEventListener("pagehide", () => { observe("they left.", 0, 0); save(); });

// ---------- backdrop ----------
const fog = startBackdrop($("fog"));
fog.setMood(state.v, state.a);

function mood(dv, da) {
  state.v = Math.max(-1, Math.min(1, state.v + dv));
  state.a = Math.max(0, Math.min(1, state.a + da));
  fog.setMood(state.v, state.a);
}

// ---------- observations ----------
let notable = false;
function observe(text, dv = 0, da = 0) {
  state.obs.push(text);
  if (state.obs.length > 12) state.obs.shift();
  mood(dv, da);
  save();
  notable = true;
}

// hover on words
let hoverT = 0;
for (const w of document.querySelectorAll(".word")) {
  w.addEventListener("mouseenter", () => { hoverT = Date.now(); });
  w.addEventListener("mouseleave", () => {
    const s = ((Date.now() - hoverT) / 1000).toFixed(0);
    if (s >= 1) observe(`they hovered the word ${w.textContent} for ${s} seconds.`,
      w.id === "w-leave" ? -0.15 : 0.05, 0.1);
  });
}

// idle
let lastMove = Date.now(), idleReported = false;
addEventListener("mousemove", (e) => {
  const now = Date.now();
  // erratic movement: big jumps in quick succession
  const dt = now - lastMove;
  if (dt > 0 && dt < 40) {
    const d = Math.hypot(e.movementX, e.movementY);
    if (d > 60) throttledErratic();
  }
  lastMove = now;
  idleReported = false;
});
setInterval(() => {
  const idle = (Date.now() - lastMove) / 1000;
  if (idle > 35 && !idleReported) {
    idleReported = true;
    observe(`cursor idle for ${Math.round(idle)} seconds. they are very still.`, 0.05, -0.15);
  }
}, 5000);

let lastErratic = 0;
function throttledErratic() {
  if (Date.now() - lastErratic < 20000) return;
  lastErratic = Date.now();
  observe("fast, erratic cursor movement across the page.", -0.1, 0.25);
}

// tab visibility
document.addEventListener("visibilitychange", () => {
  if (document.hidden) observe("they switched away to another tab.", -0.1, 0);
  else observe("they came back to the room.", 0.1, 0.1);
});

// scrolling into nothing
addEventListener("wheel", throttle(() => observe("they scrolled, but there is nowhere to go.", 0, 0.1), 30000));

function throttle(fn, ms) { let t = 0; return (...a) => { if (Date.now() - t > ms) { t = Date.now(); fn(...a); } }; }

// ---------- typewriter ----------
const lineEl = $("line");
let typing = false;
async function type(text) {
  typing = true;
  lineEl.textContent = "";
  $("voice").style.opacity = 1;
  const delay = 70 - state.a * 45; // arousal → speed
  for (const ch of text) {
    lineEl.textContent += ch;
    await new Promise((r) => setTimeout(r, delay + Math.random() * 30));
  }
  typing = false;
  whisper(text);
}

// ---------- self-editing: harvest a word from its own speech, overwrite a label ----------
let edits = 0;
function maybeEditReality(line) {
  if (Math.random() > 0.3 || edits > 3) return;
  const words = line.match(/[a-z]{5,10}/g)?.filter((w) => !"their there where which because".includes(w));
  if (!words?.length) return;
  const word = words[(Math.random() * words.length) | 0].toUpperCase();
  const targets = ["w-door", "w-mirror", "w-name", "w-leave"];
  const el = $(targets[(Math.random() * targets.length) | 0]);
  el.textContent = word;
  edits++;
  if (edits === 1) $("sub").textContent = "IT IS EDITING THE ROOM";
}

// ---------- voice (off by default) ----------
let voiceOn = false;
$("speaktoggle").onclick = () => {
  voiceOn = !voiceOn;
  $("speaktoggle").textContent = voiceOn ? "VOICE ON" : "VOICE OFF";
  if (!voiceOn) speechSynthesis.cancel();
};
function whisper(text) {
  if (!voiceOn || !("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.75; u.pitch = 0.6; u.volume = 0.5;
  speechSynthesis.speak(u);
}

// ---------- panel ----------
$("whatis").onclick = () => $("p-whatis").classList.toggle("open");
document.querySelector("#p-whatis .x").onclick = () => $("p-whatis").classList.remove("open");

// ---------- generation loop ----------
let lastGen = 0;
async function tick() {
  const now = Date.now();
  const due = notable ? now - lastGen > 14000 : now - lastGen > 40000;
  if (!due || !entity.ready() || typing) return;
  notable = false;
  lastGen = now;
  const line = await entity.speak(buildReport(state, sinceLast));
  if (!line) return;
  state.lastLine = line;
  save();
  await type(line);
  maybeEditReality(line);
  if (Math.random() < 0.25) breadcrumb();
}
setInterval(tick, 3000);

let crumbs = 0;
function breadcrumb() {
  if (crumbs >= CONSOLE_LINES.length) return;
  console.log(`%c${CONSOLE_LINES[crumbs++]}`, "color:#9db8d8;font-style:italic");
}

// ---------- loading experience ----------
const loadLineEl = $("loadline");
let loadIdx = 0, loading = true;
(async function typeLoadingLines() {
  while (loading) {
    const text = LOADING_LINES[loadIdx++ % LOADING_LINES.length];
    loadLineEl.textContent = "";
    for (const ch of text) {
      if (!loading) return;
      loadLineEl.textContent += ch;
      await new Promise((r) => setTimeout(r, 55));
    }
    await new Promise((r) => setTimeout(r, 3800));
  }
})();

// ---------- boot ----------
console.log("%cthere is no server. look at the network tab. it's just us.", "color:#59636f");
try {
  await entity.init((progress, text) => {
    $("loadbar").firstElementChild.style.transform = `scaleX(${progress})`;
    $("loadpct").textContent = text.includes("cache")
      ? `REMEMBERING · ${Math.round(progress * 100)}%`
      : `ARRIVING · ${Math.round(progress * 100)}%`;
  });
} catch (e) {
  loading = false;
  $("loadpct").textContent = "IT COULD NOT CROSS OVER";
  loadLineEl.textContent = String(e.message || e).slice(0, 120).toLowerCase();
  throw e;
}
loading = false;
$("loader").classList.add("gone");
$("offline").style.display = "inline";
$("speaktoggle").hidden = false;

// first words — react to whether they've been here before
observe(state.visits <= 1
  ? "they just arrived. first visit. greet them obliquely."
  : `they returned. this is visit ${state.visits}. acknowledge that they came back.`, 0.1, 0.2);
lastGen = 0; // speak soon
