# REVENANT — execution plan (Project 3)

**Executor:** Opus agent. The architecture below is decided. Build it in phases; honor every verification gate before moving on. Small local decisions are yours; do not re-architect.

## What this is

A website with a *resident entity* — a small language model running entirely on-device (WebGPU, no server, no API calls) that behaves like something that lives in the page. It watches how you interact (cursor hesitation, idle time, which links you hover), rewrites its own on-page copy, leaves messages, remembers you between visits via localStorage, and its "mood" drives the visual layer (shader palette + typography). The jaw-drop is that it works **offline** — no backend at all. Prove it: a visible "● OFFLINE · NO SERVER" indicator, and it keeps talking with the network tab empty.

**Reference bar:** eerie, minimal, literary. Think a terminal haunted by something. The physarum project in `../physarum/` is the house style benchmark for restraint, dark palette, monospace, zero-dependency discipline.

## Stack (decided)

- **Model:** `@mlc-ai/web-llm`. Use the SMALLEST capable instruct model it ships — `Qwen2.5-0.5B-Instruct` or `Llama-3.2-1B-Instruct` (q4f16). 0.5B loads faster and is enough for short atmospheric replies; prefer it. The model weights download once (~300–900MB) and cache in the browser — this is the one heavy cost; the loading experience must be designed, not a spinner.
- **Rendering/visual:** vanilla + one WebGL/TSL shader background whose uniforms (hue, turbulence, brightness) are driven by the entity's mood. Can lift the shader approach from physarum if useful, but this project's visual is quieter — a slow fog/plasma, not a slime mold.
- **Build:** Vite, vanilla JS, one page. web-llm is an npm ESM import.
- **NO frameworks. NO backend.** The entire point is client-only.

## The entity — behavior model

Maintain a small JS state object = the entity's memory/mood:
```
{ visits, lastSeen, moodValence (-1..1), moodArousal (0..1),
  observations: [] // short strings: "hovered CONTACT twice then left", "idle 40s" }
```
Persist to localStorage each change. On load, if `visits > 0`, the entity greets you as returning ("you came back").

**Interaction → observation loop:**
- Track: cursor idle duration, hover enter/leave on interactive words, rage-ish fast movement, time on page, scroll.
- Every N seconds or on a notable event, feed a compact prompt to web-llm: a fixed system prompt (the entity's persona: ancient, curious, slightly unsettling, speaks in short lines, never breaks character, never lists) + the recent observations + current mood → returns (a) one short line of dialogue to render, (b) a mood delta as a tiny JSON tag you parse. Keep generations SHORT (max_tokens ~60) so it stays responsive.
- Render its lines into the page — typewriter effect into a central text element. It can also rewrite the page's own labels/heading occasionally ("the entity is editing reality").
- Leave a `console.log` breadcrumb in the entity's voice (people open devtools — reward them).

**Mood → visuals:** valence maps hue (warm/cold), arousal maps shader turbulence + typewriter speed + how often it speaks.

## File structure
```
revenant/
  index.html        — minimal shell: entity text area, offline indicator, loader
  src/main.js       — orchestration: observation loop, render, localStorage
  src/entity.js     — web-llm init, prompt construction, generation, mood parsing
  src/persona.js    — the system prompt + few-shot examples (the writing lives here)
  src/backdrop.js   — the mood-driven shader background
```

## Phases

### Phase 1 — Model loads and speaks
web-llm init with progress callback → designed loading screen (percentage + slowly-typed ominous lines that themselves come from a hardcoded list while weights download). Get one hardcoded-prompt generation rendering to screen with a typewriter effect.
**Gate:** model loads in a fresh profile, generates a line, ZERO network requests after weights cached (verify in Network tab — reload and confirm weights come from cache, generation makes no fetch).

### Phase 2 — Observation loop + persona
Wire cursor/idle/hover tracking → observations array. Build the prompt in `persona.js`. Feed loop → entity responds to what you actually do (hover a word, it comments). Tune persona until replies are eerie and in-character, never assistant-like. Parse a trailing `[mood: v,a]` tag out of each reply; strip it before rendering.
**Gate:** hovering different words / going idle produces visibly different, in-character responses. No "As an AI" leakage.

### Phase 3 — Memory across visits
localStorage persistence. Returning visitor gets acknowledged. Entity references a prior observation ("last time, you left before I finished"). Add a subtle "it remembers you" affordance.
**Gate:** reload → entity greets as returning and references stored state; clearing localStorage resets it to first-contact.

### Phase 4 — Mood-driven visuals + self-editing
`backdrop.js` shader reads mood uniforms, animates slowly. Entity occasionally rewrites a page label/heading via DOM. Offline indicator + a tasteful "what is this?" panel (physarum-panel style) explaining it's a real LLM in your browser, no server.
**Gate:** mood shifts are visible in color + motion; self-edits land without layout jank.

### Phase 5 (stretch) — Voice
Web Speech API `speechSynthesis` whispers its lines (low rate, quiet). Toggle, off by default. Optional Web Audio drone bed (lift from physarum).

## Verification (every phase)
`npm run dev`, drive it in Chrome via claude-in-chrome MCP: screenshot the loader and a live conversation; **crucially, verify offline** — after first load, use the Network panel / read_network_requests to confirm generations make no outbound calls. Read console for the entity's breadcrumbs and any errors. Test a returning visit by reloading. WebGPU required — gate non-WebGPU browsers with a physarum-style dormant message (web-llm needs WebGPU anyway).

## Ship
Same pipeline as physarum: secrets grep → private GitHub repo `revenant` → `vercel deploy --prod --yes` → `vercel git connect` → curl-verify 200. Vite deploys clean on Vercel.
**One Vercel note:** the model weights are fetched from web-llm's CDN (HuggingFace/mlc), not bundled — so "no server" means no *app* server; the weights CDN is a one-time cache-fill. Be precise about this in the copy: "runs on your device" is true; don't claim it downloads nothing.

## Known traps
- First load is heavy (model download). The loading experience is not optional polish — it's the make-or-break first impression. Design it.
- web-llm version churn: pin the version, use the model IDs from the installed version's `prebuiltAppConfig`.
- Keep generations short and serialized (one at a time) — concurrent gener+render will stutter. Queue observations; don't fire a generation while one is running.
- Persona drift: small models break character easily. Invest in `persona.js` few-shot examples; add a cheap post-filter that retries if output contains "AI", "language model", "assistant", "I cannot".
- Don't let it feel like a chatbot — there is NO input box. The user never types. It reacts to behavior only. This is the whole idea; protect it.

## Handoff note to human (include in final report)
"The entity's whole personality lives in `src/persona.js` — rewrite the system prompt and few-shot lines to change who haunts your site. Everything else is plumbing."
