import { net } from './net';
import { sfx } from './sfx';
import { store } from './store';
import { isUnlocked, unlockText } from './cosmetics';

// Emotes rápidos: aparecem ao lado do jogador na lista e grandes sobre o tabuleiro.

export const EMOTES: [string, string][] = [
  ['🌿', 'Bora!'], ['😂', 'Rindo'], ['😎', 'Tranquilo'], ['😡', 'Bravo'],
  ['😭', 'Chorando'], ['👏', 'Boa!'], ['🔥', 'Pegando fogo'], ['🤯', 'Bad trip'],
  // extras (alguns liberados por conquistas, ver cosmetics.ts)
  ['🍕', 'Larica'], ['💤', 'Sono'], ['🤑', 'Rico'], ['👑', 'Rei'],
  ['🥶', 'Congelou'], ['🤡', 'Palhaçada'], ['💀', 'Morri'], ['🧪', 'Experimento'],
];

let lastSent = 0;

export function initEmotes() {
  const bar = document.getElementById('emoteBar');
  if (!bar) return;
  renderEmoteBar(bar);
  bar.addEventListener('mouseenter', () => renderEmoteBar(bar));
  bar.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest('button') as HTMLElement | null;
    if (!b) return;
    if (b.classList.contains('locked')) { sfx('error'); return; }
    const now = performance.now();
    if (now - lastSent < 1200) return;
    lastSent = now;
    net.send({ t: 'emote', e: Number(b.dataset.e) });
  });
}

function renderEmoteBar(bar: HTMLElement) {
  bar.innerHTML = EMOTES.map(([e, n], i) => {
    const open = isUnlocked(`emote:${i}`);
    return `<button data-e="${i}" class="${open ? '' : 'locked'}" title="${open ? n : `🔒 ${unlockText(`emote:${i}`)}`}">${e}</button>`;
  }).join('');
}

/** onAvatar: mostra o emote em cima da Pequena Lenda (retorna false se ela não está na tela) */
export function showEmote(from: string, e: number, onAvatar?: (from: string, emoji: string) => boolean) {
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
  if (onAvatar?.(from, emoji)) return;
  if (isMe || isOpp) {
    const big = document.createElement('div');
    big.className = `emote-big ${isMe ? 'me' : 'opp'}`;
    big.textContent = emoji;
    document.body.appendChild(big);
    setTimeout(() => big.remove(), 2000);
  }
}
