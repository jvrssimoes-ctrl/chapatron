// Cliente de teste: cria sala, adiciona bots, inicia e imprime as mensagens recebidas.
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3001/ws');
const seen: Record<string, number> = {};
ws.on('open', () => ws.send(JSON.stringify({ t: 'create', name: 'Teste', token: 'tok' + Date.now() })));
ws.on('message', (raw) => {
  const m = JSON.parse(String(raw));
  seen[m.t] = (seen[m.t] ?? 0) + 1;
  if (m.t === 'joined') {
    for (let i = 0; i < 3; i++) ws.send(JSON.stringify({ t: 'addBot' }));
    setTimeout(() => ws.send(JSON.stringify({ t: 'start' })), 300);
  }
  if (m.t === 'state') console.log('state', m.phase, 'round', m.round, 'gold', m.me.gold, 'shop', m.me.shop.join(','));
  if (m.t === 'combat') console.log('combat events', m.result.events.length, 'winner', m.result.winner);
  if (m.t === 'error' || m.t === 'toast') console.log(m.t, m.msg);
});
setTimeout(() => { console.log(seen); process.exit(0); }, Number(process.argv[2] ?? 4000));
