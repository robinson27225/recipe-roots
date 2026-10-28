// A tiny local server for the review page, so corrections and family stories can be typed into the page and saved straight
// back to family-recipes.json. It listens on 127.0.0.1 only, under a random one-time path, and serves nothing but that file's
// recipes and the images beside it. No dependencies.
import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { renderReview, applyEdits } from './review.js';

const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

export async function serveReview(file, { port = 0 } = {}) {
  const dir = path.dirname(file);
  const token = crypto.randomBytes(16).toString('hex');
  let backedUp = false;
  const load = async () => {
    const recipes = JSON.parse(await readFile(file, 'utf8'));
    if (!Array.isArray(recipes)) throw new Error(`${file} should be a JSON array of recipes.`);
    return recipes;
  };
  const server = http.createServer(async (req, res) => {
    const send = (code, body, type = 'application/json') => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };
    try {
      const host = String(req.headers.host ?? '');
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return send(403, '{"error":"forbidden"}'); // blocks DNS-rebinding
      const url = new URL(req.url, 'http://127.0.0.1');
      const prefix = `/${token}/`;
      if (!url.pathname.startsWith(prefix)) return send(404, '{"error":"not found"}');
      const rest = decodeURIComponent(url.pathname.slice(prefix.length));
      if (req.method === 'GET' && rest === '') return send(200, renderReview(await load(), { edit: true }), 'text/html; charset=utf-8');
      if (req.method === 'GET') { // an image beside the file, nothing else
        const full = path.resolve(dir, rest), type = TYPES[path.extname(full).toLowerCase()];
        if (!type || !full.startsWith(dir + path.sep)) return send(404, '{"error":"not found"}');
        return send(200, await readFile(full), type);
      }
      if (req.method === 'POST' && rest === 'save') {
        let body = '';
        for await (const chunk of req) { body += chunk; if (body.length > 2_000_000) return send(413, '{"error":"too large"}'); }
        const recipes = await load();
        const changed = applyEdits(recipes, JSON.parse(body).edits);
        if (changed) {
          if (!backedUp) { await copyFile(file, `${file}.bak`); backedUp = true; }
          await writeFile(file, JSON.stringify(recipes, null, 2));
        }
        return send(200, JSON.stringify({ ok: true, changed }));
      }
      return send(404, '{"error":"not found"}');
    } catch (e) { return send(400, JSON.stringify({ error: e.message })); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { server, url: `http://127.0.0.1:${server.address().port}/${token}/` };
}
