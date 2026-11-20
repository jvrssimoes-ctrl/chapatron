import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ClientMsg } from '../shared/types';
import { Player, Room } from './room';

// Em dev (--dev) o servidor fica sempre na 3001 e o Vite (5173) faz proxy do /ws.
const PORT = process.argv.includes('--dev') ? 3001 : Number(process.env.PORT ?? 3001);
const DIST = resolve(fileURLToPath(new URL('.', import.meta.url)), '../dist');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json',
  '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
};

const server = createServer((req, res) => {
  const url = (req.url ?? '/').split('?')[0];
  if (url === '/health') { res.writeHead(200).end('ok'); return; }
  if (!existsSync(DIST)) {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
      .end('Servidor CHAPATRON rodando. Em dev, abra http://localhost:5173');
    return;
  }
  let file = normalize(join(DIST, decodeURIComponent(url)));
  if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
  // arquivos do build têm hash no nome: podem ficar em cache "pra sempre"; o index.html nunca
  const cache = file.includes(`${normalize('/assets/')}`) ? 'public, max-age=31536000, immutable' : 'no-cache';
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream', 'cache-control': cache });
  createReadStream(file).pipe(res);
});

const rooms = new Map<string, Room>();

function newCode() {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  do {
    code = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  } while (rooms.has(code));
  return code;
}

const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket) => {
  let room: Room | null = null;
  let player: Player | null = null;
  let alive = true;
  ws.on('pong', () => { alive = true; });
  const ping = setInterval(() => {
    if (!alive) { ws.terminate(); return; }
    alive = false;
    ws.ping();
  }, 20000);

  ws.on('message', (raw) => {
    let msg: ClientMsg;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    if (!msg || typeof msg !== 'object') return;

    if (msg.t === 'create' || msg.t === 'join') {
      if (room && player) return;
      const name = String(msg.name ?? '').slice(0, 20).trim();
      const token = String(msg.token ?? '').slice(0, 64);
      if (msg.t === 'create') {
        const code = newCode();
        room = new Room(code, (c) => rooms.delete(c));
        rooms.set(code, room);
      } else {
        room = rooms.get(String(msg.room ?? '').toUpperCase().trim()) ?? null;
        if (!room) { ws.send(JSON.stringify({ t: 'error', msg: 'Sala não encontrada.' })); return; }
      }
      const res = room.join(ws, name, token);
      if (typeof res === 'string') {
        ws.send(JSON.stringify({ t: 'error', msg: res }));
        room = null;
        return;
      }
      player = res;
      player.send({ t: 'joined', room: room.code, youId: player.id });
      if (room.phase === 'lobby') room.broadcastLobby();
      else {
        room.resendCombat(player);
        room.broadcastState();
      }
      return;
    }
    if (room && player) room.handle(player, msg);
  });

  ws.on('close', () => {
    clearInterval(ping);
    if (room && player && player.ws === ws) room.disconnect(player);
  });
});

server.listen(PORT, () => {
  console.log(`🌿 CHAPATRON servidor na porta ${PORT}`);
});
