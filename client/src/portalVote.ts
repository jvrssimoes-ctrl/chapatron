import { PORTALS } from '../../shared/portals';
import type { ServerMsg } from '../../shared/types';
import { esc } from './hud';
import { net } from './net';
import { sfx } from './sfx';
import { store } from './store';

// Votação do portal (regra especial da partida), igual aos portais do TFT.

type PortalMsg = Extract<ServerMsg, { t: 'portal' }>;

let el: HTMLElement | null = null;
let hideTimer = 0;

function ensure() {
  if (el) return el;
  el = document.createElement('div');
  el.id = 'portalVote';
  el.className = 'hidden';
  document.body.appendChild(el);
  el.addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest('.pv-card') as HTMLElement | null;
    if (!card || el!.classList.contains('done')) return;
    net.send({ t: 'vote', i: Number(card.dataset.i) });
    sfx('click');
  });
  return el;
}

export function onPortalMsg(msg: PortalMsg) {
  const root = ensure();
  const players = store.state?.players ?? [];
  const nameOf = (id: string) => players.find((p) => p.id === id)?.name ?? store.lobby?.players.find((p) => p.id === id)?.name ?? '?';
  const mine = msg.votes[store.youId];
  const chosenIdx = msg.chosen ? msg.options.indexOf(msg.chosen) : -1;
  root.classList.remove('hidden');
  root.classList.toggle('done', !!msg.chosen);
  root.innerHTML = `<div class="pv-box">
    <h2>${msg.chosen ? '🌀 Portal escolhido!' : '🌀 Vote no portal da partida'}</h2>
    <p class="pv-sub">${msg.chosen ? 'Essa regra vale até o fim do jogo.' : 'Cada partida tem uma regra especial. A mais votada vale pra todo mundo (empate = sorteio).'}</p>
    <div class="pv-cards">${msg.options.map((id, i) => {
      const p = PORTALS[id];
      const voters = Object.entries(msg.votes).filter(([, v]) => v === i).map(([pid]) => pid);
      const cls = [mine === i ? 'mine' : '', chosenIdx === i ? 'win' : '', chosenIdx >= 0 && chosenIdx !== i ? 'lose' : ''].join(' ');
      return `<button class="pv-card ${cls}" data-i="${i}" style="--pc:${p.color}">
        <div class="pv-icon">${p.icon}</div>
        <b>${esc(p.name)}</b>
        <small>${esc(p.desc)}</small>
        <div class="pv-votes">${voters.map((v) => `<span class="${v === store.youId ? 'me' : ''}">${esc(nameOf(v))}</span>`).join('') || '<em>sem votos</em>'}</div>
      </button>`;
    }).join('')}</div>
  </div>`;
  clearTimeout(hideTimer);
  if (msg.chosen) { sfx('augment'); hideTimer = window.setTimeout(() => root.classList.add('hidden'), 2600); }
}

export function hidePortalVote() { el?.classList.add('hidden'); }
