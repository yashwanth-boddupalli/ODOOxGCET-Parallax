// Serves POST /api/assistant from the Vite dev server (and `vite preview`), so the
// Groq key stays in frontend/.env.local on this machine and never reaches the browser.
import { AssistantError, answerQuestion } from './assistant.js';

const MAX_BODY_BYTES = 64 * 1024;

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new AssistantError(413, 'Message is too long.'));
        req.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(new AssistantError(400, 'Invalid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export function assistantPlugin(env) {
  const handler = async (req, res) => {
    if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' });
    try {
      const body = await readJson(req);
      const accessToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const result = await answerQuestion({
        messages: body.messages,
        warehouseId: body.warehouseId || null,
        accessToken,
        env,
      });
      send(res, 200, result);
    } catch (err) {
      const status = err instanceof AssistantError ? err.status : 500;
      if (status >= 500) console.error('[assistant]', err);
      send(res, status, { error: status === 500 ? 'The assistant hit an unexpected error.' : err.message });
    }
  };

  return {
    name: 'stocksense-assistant',
    configureServer(server) {
      server.middlewares.use('/api/assistant', handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/assistant', handler);
    },
  };
}
