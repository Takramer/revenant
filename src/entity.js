// web-llm plumbing: init, serialized generation, mood parsing, character-break filter.
import { CreateMLCEngine } from "@mlc-ai/web-llm";
import { SYSTEM, FEWSHOT, BREAK_RE, FALLBACK_LINES } from "./persona.js";

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
export async function speak(report) {
  if (!engine || busy) return null;
  busy = true;
  try {
    let line = await gen(report);
    if (!line || BREAK_RE.test(line)) line = await gen(report + " stay in character. one quiet line.");
    if (!line || BREAK_RE.test(line)) line = FALLBACK_LINES[(Math.random() * FALLBACK_LINES.length) | 0];
    return clean(line);
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
    messages, max_tokens: 60, temperature: 0.9, top_p: 0.95,
  });
  return r.choices?.[0]?.message?.content?.trim() ?? "";
}

function clean(line) {
  return line
    .replace(/\[.*?\]/g, "")           // any stray bracketed tags
    .replace(/^["'“]+|["'”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 140);
}
