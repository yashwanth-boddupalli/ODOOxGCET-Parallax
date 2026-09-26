import { supabase } from '../lib/supabase';

// Sends the chat to the StockSense assistant (served by the dev server at /api/assistant).
// The user's own session token goes along so the assistant reads data with their permissions.
export async function askAssistant(messages, warehouseId) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in again to use the assistant.');

  let res;
  try {
    res = await fetch('/api/assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messages: messages.map(({ role, content }) => ({ role, content })),
        warehouseId: warehouseId || null,
      }),
    });
  } catch {
    throw new Error('Can’t reach the assistant. Is the dev server running?');
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 404) throw new Error('The assistant only runs with the local dev server (npm run dev) for now.');
    if (res.status === 429) throw new Error('The AI is busy right now (rate limit). Try again in a few seconds.');
    throw new Error(body.error || `Assistant error (${res.status})`);
  }
  return body; // { reply, steps: [{ tool, label, ok }], model }
}
