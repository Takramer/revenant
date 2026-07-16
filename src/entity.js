// web-llm plumbing: init, serialized generation, schema-constrained actions, character-break filter.
import { CreateMLCEngine } from "@mlc-ai/web-llm";
import { SYSTEM, FEWSHOT, ACTION_SCHEMA, BREAK_RE, FALLBACK_LINES } from "./persona.js";

const MODEL = "Qwen2.5-0.5B-Instruct-q4f16_1-MLC";

let engine = null;
let busy = false;

export const ready = () => !!engine && !busy;

export async function init(onProgress) {
  engine = await CreateMLCEngine(MODEL, {
    initProgressCallback: (p) => onProgress(p.progress ?? 0, p.text ?? ""),
  });
}

// One generation at a time. Callers check ready() and skip if busy — observations queue up
// in state.obs and get folded into the next report, so nothing is lost.
// Returns an action: { say, mood: {v, a}, rewrite: {target, text} } — schema-enforced
// by constrained decoding, so the shape is guaranteed; only the content needs filtering.
export async function act(report) {
  if (!engine || busy) return null;
  busy = true;
  try {
    let action = await gen(report);
    if (!action || BREAK_RE.test(action.say)) action = await gen(report + " stay in character. one quiet line.");
    if (!action || BREAK_RE.test(action.say)) {
      action = {
        say: FALLBACK_LINES[(Math.random() * FALLBACK_LINES.length) | 0],
        mood: null, rewrite: { target: "none", text: "" },
      };
    }
    action.say = clean(action.say);
    if (action.mood) {
      action.mood.v = clamp(action.mood.v, -1, 1);
      action.mood.a = clamp(action.mood.a, 0, 1);
    }
    return action.say ? action : null;
  } catch (e) {
    console.warn("generation failed", e);
    return null;
  } finally {
    busy = false;
  }
}

async function gen(report) {
  const messages = [{ role: "system", content: SYSTEM }];
  for (const [u, a] of FEWSHOT) messages.push({ role: "user", content: u }, { role: "assistant", content: a });
  messages.push({ role: "user", content: report });
  const r = await engine.chat.completions.create({
    messages, max_tokens: 140, temperature: 0.9, top_p: 0.95,
    response_format: { type: "json_object", schema: ACTION_SCHEMA },
  });
  try {
    return JSON.parse(r.choices?.[0]?.message?.content ?? "");
  } catch {
    return null; // constrained decoding makes this rare (truncation only)
  }
}

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, +x || 0));

function clean(line) {
  return line
    .replace(/^["'“]+|["'”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 140);
}
