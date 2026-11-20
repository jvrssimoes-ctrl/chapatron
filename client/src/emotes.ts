import { net } from './net';
import { sfx } from './sfx';
import { store } from './store';

// Emotes rápidos: aparecem ao lado do jogador na lista e grandes sobre o tabuleiro.

export const EMOTES: [string, string][] = [
  ['🌿', 'Bora!'], ['😂', 'Rindo'], ['😎', 'Tranquilo'], ['😡', 'Bravo'],
  ['😭', 'Chorando'], ['👏', 'Boa!'], ['🔥', 'Pegando fogo'], ['🤯', 'Bad trip'],
];

let lastSent = 0;

export function initEmotes() {
  const bar = document.getElementById('emoteBar');
  if (!bar) return;
  bar.innerHTML = EMOTES.map(([e, n], i) => `<button data-e="${i}" title="${n}">${e}</button>`).join('');
  bar.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest('button') as HTMLElement | null;
    if (!b) return;
    const now = performance.now();
    if (now - lastSent < 1200) return;
    lastSent = now;
    net.send({ t: 'emote', e: Number(b.dataset.e) });
  });
}

export function showEmote(from: string, e: number) {
  const emoji = EMOTES[e]?.[0];
  if (!emoji) return;
  sfx('puff', 120);
  // balão ao lado do jogador na lista
  const row = document.querySelector(`#players .prow[data-id="${from}"]`) as HTMLElement | null;
  if (row) {
    const r = row.getBoundingClientRect();
    const b = document.createElement('div');
    b.className = 'emote-bubble';
    b.textContent = emoji;
    b.style.left = `${r.left - 8}px`;
    b.style.top = `${r.top + r.height / 2}px`;
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 2200);
  }
  // grande sobre o tabuleiro: você (embaixo) ou seu adversário atual (em cima)
  const s = store.state;
  const isMe = from === store.youId;
  const isOpp = !!s && s.opponentId === from;
  if (isMe || isOpp) {
    const big = document.createElement('div');
    big.className = `emote-big ${isMe ? 'me' : 'opp'}`;
    big.textContent = emoji;
    document.body.appendChild(big);
    setTimeout(() => big.remove(), 2000);
  }
}
