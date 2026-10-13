// Embeddings from any OpenAI-compatible endpoint. Default: EmbeddingGemma via local Ollama.
export const EMBED_DEFAULTS = {
  model: process.env.RR_EMBED_MODEL ?? 'embeddinggemma',
};

export function makeEmbedder({ baseUrl, apiKey, model = EMBED_DEFAULTS.model, fetchImpl }) {
  return {
    model,
    async embed(texts) {
      const out = [];
      for (let i = 0; i < texts.length; i += 16) {
        const res = await (fetchImpl ?? fetch)(`${baseUrl.replace(/\/$/, '')}/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model, input: texts.slice(i, i + 16) }),
          signal: AbortSignal.timeout(120_000),
        });
        if (!res.ok) throw new Error(`Embedding server returned HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const { data } = await res.json();
        if (!Array.isArray(data) || data.length !== Math.min(16, texts.length - i)) throw new Error('Embedding server returned an unexpected number of vectors.');
        out.push(...data.sort((a, b) => a.index - b.index).map((d) => d.embedding));
      }
      return out;
    },
  };
}
