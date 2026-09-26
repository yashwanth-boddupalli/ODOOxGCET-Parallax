// Vercel Function for POST /api/assistant: the hosted twin of the dev-server
// middleware in frontend/server/vitePluginAssistant.js. Both call the same
// answerQuestion(), so the bot behaves identically locally and on Vercel.
// Needs GROQ_API_KEY (and optionally GROQ_MODEL) in the Vercel project's
// environment variables; the key never reaches the browser.
import { AssistantError, answerQuestion } from '../server/assistant.js';

const MAX_BODY_BYTES = 64 * 1024;

const send = (status, payload) =>
  Response.json(payload, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request) {
  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > MAX_BODY_BYTES) throw new AssistantError(413, 'Message is too long.');
    let body;
    try {
      body = JSON.parse(text || '{}');
    } catch {
      throw new AssistantError(400, 'Invalid JSON.');
    }
    const accessToken = String(request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const result = await answerQuestion({
      messages: body.messages,
      warehouseId: body.warehouseId || null,
      accessToken,
      env: process.env,
    });
    return send(200, result);
  } catch (err) {
    const status = err instanceof AssistantError ? err.status : 500;
    if (status >= 500) console.error('[assistant]', err);
    return send(status, { error: status === 500 ? 'The assistant hit an unexpected error.' : err.message });
  }
}
