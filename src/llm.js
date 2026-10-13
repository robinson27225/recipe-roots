// Minimal client for any OpenAI-compatible chat endpoint. The default target is a
// local Ollama server, so family data never leaves the user's machine.

export const DEFAULTS = {
  baseUrl: process.env.RR_BASE_URL ?? 'http://localhost:11434/v1',
  model: process.env.RR_MODEL ?? 'gemma3:4b',
  apiKey: process.env.RR_API_KEY ?? 'ollama',
};

export async function chatJson({ baseUrl, model, apiKey }, messages, { fetchImpl = fetch, timeoutMs = 300_000, temperature = 0.6 } = {}) {
  const res = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature, response_format: { type: 'json_object' }, stream: false }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Model server returned HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const text = (await res.json()).choices?.[0]?.message?.content ?? '';
  return parseJsonLoose(text);
}

/** Small models sometimes wrap JSON in markdown fences or add chatter around it. */
export function parseJsonLoose(text) {
  const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
  throw new Error('Model did not return JSON.');
}

export async function modelAvailable(cfg, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(`${cfg.baseUrl.replace(/\/$/, '')}/models`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch { return false; }
}
