/* q-erosion dedicated relay — Cloudflare Durable Object, one Room per 4-char code.
   Cost defenses: SQLite-class DO (free-plan compatible), WebSocket Hibernation
   (no duration billing while idle), 2-socket hard cap, per-socket rate/size
   limits, 2h room TTL, path regex so junk traffic never instantiates a DO. */

const MAX_MSG_BYTES = 8192;   // largest state packet is ~3KB at 60 enemies
const MAX_MSGS_PER_SEC = 60;  // normal peak is ~25/s (pose 11 + state 8 + events)
const ROOM_TTL_MS = 2 * 3600e3;

export class Room {
  constructor(state) { this.state = state; }

  async fetch(req) {
    if (new URL(req.url).pathname.endsWith('/info')) {
      return new Response(JSON.stringify({ total: this.state.getWebSockets().length, h: this.state.getWebSockets('h').length, g: this.state.getWebSockets('g').length, lastErr: this._lastErr || null, lastMsg: this._lastMsg || null }), { headers: { 'content-type': 'application/json' } });
    }
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const role = new URL(req.url).searchParams.get('role') === 'h' ? 'h' : 'g';
    if (this.state.getWebSockets().length >= 2) return new Response('room full', { status: 409 });
    if (this.state.getWebSockets(role).length >= 1) return new Response('role taken', { status: 409 });
    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    this.state.acceptWebSocket(server, [role]); // hibernation API
    server.serializeAttachment({ role, n: 0, t: Date.now() });
    if (!(await this.state.storage.getAlarm())) await this.state.storage.setAlarm(Date.now() + ROOM_TTL_MS);
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws, msg) {
    try {
      this._lastMsg = String(msg).slice(0, 40);
      if (typeof msg !== 'string' || msg.length > MAX_MSG_BYTES) { ws.close(1009, 'message too large'); return; }
      const a = ws.deserializeAttachment();
      const now = Date.now();
      if (now - a.t > 1000) { a.t = now; a.n = 0; }
      if (++a.n > MAX_MSGS_PER_SEC) { ws.close(1008, 'rate limit'); return; }
      ws.serializeAttachment(a);
      const other = a.role === 'h' ? 'g' : 'h';
      for (const peer of this.state.getWebSockets(other)) { try { peer.send(msg); } catch {} }
    } catch (e) { this._lastErr = String(e && e.message || e); }
  }

  webSocketClose() { /* peer notices via its own lastSeen watchdog */ }
  webSocketError() {}

  async alarm() { // room expiry
    for (const ws of this.state.getWebSockets()) { try { ws.close(1000, 'room expired'); } catch {} }
  }
}

export default {
  async fetch(req, env) {
    const m = new URL(req.url).pathname.match(/^\/room\/([A-Z0-9]{4})(\/info)?$/);
    if (!m) return new Response('not found', { status: 404 });
    return env.ROOM.get(env.ROOM.idFromName(m[1])).fetch(req);
  },
};
