import { TRAITS, UNITS } from '../../shared/data';
import { ITEMS } from '../../shared/items';
import { traitBonus } from '../../shared/augments';
import { computeTraits, emblemBonus, mergeBonus, unitTraits } from '../../shared/traits';
import { esc, unitTipHtml } from './hud';
import { itemImg } from './itemIcons';
import { store } from './store';
import type { HoverInfo } from './three/scene';

// Painel fixo de detalhes do robô (clique direito num robô), igual ao painel de campeão do TFT.

let key: string | null = null;
let last: HoverInfo | null = null;
let getInfo: (k: string) => HoverInfo | null = () => null;
let el: HTMLElement | null = null;
let timer = 0;

export function initInspect(fn: (k: string) => HoverInfo | null) {
  getInfo = fn;
  el = document.createElement('div');
  el.id = 'inspect';
  el.className = 'hidden';
  document.body.appendChild(el);
  el.addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('.ins-x')) closeInspect(); });
}

export const isInspectOpen = () => key !== null;

export function inspect(k: string | null) {
  if (!k || !el) { closeInspect(); return; }
  key = k;
  last = null;
  el.classList.remove('hidden');
  render();
  clearInterval(timer);
  timer = window.setInterval(render, 200);
}

export function closeInspect() {
  key = null;
  clearInterval(timer);
  el?.classList.add('hidden');
}

function bar(cur: number, max: number, color: string, label: string) {
  const pct = Math.max(0, Math.min(100, (cur / Math.max(1, max)) * 100));
  return `<div class="ins-bar"><i style="width:${pct}%;background:${color}"></i><span>${label}</span></div>`;
}

function render() {
  if (!key || !el) return;
  const info = getInfo(key) ?? last;
  if (!info) { closeInspect(); return; }
  const gone = !getInfo(key);
  last = info;
  const def = UNITS[info.defId];
  if (!def) return;
  const live = info.hp !== undefined && info.maxHp !== undefined;
  const bars = live
    ? bar(info.hp!, info.maxHp!, '#4fe06a', `${Math.round(info.hp!)} / ${Math.round(info.maxHp!)}`) +
      (info.maxMana !== undefined && info.maxMana < 900 ? bar(info.mana ?? 0, info.maxMana, '#3d8bff', `${Math.round(info.mana ?? 0)} / ${info.maxMana} mana`) : '')
    : '';
  // sinergias do robô com a contagem atual do seu tabuleiro
  const me = store.state?.me;
  const boardU = me?.units.filter((u) => u.loc.zone === 'board') ?? [];
  const active = computeTraits(boardU.map((u) => u.defId), mergeBonus(traitBonus(me?.augments ?? []), emblemBonus(boardU)));
  const traits = unitTraits(def.id, info.items ?? []).map((t) => {
    const tr = TRAITS[t];
    const n = active.find((a) => a.id === t)?.count ?? 0;
    const next = tr.breakpoints.find((b) => b > n);
    return `<div class="ins-trait" style="--c:${tr.color}"><b>${tr.icon} ${esc(tr.name)}</b><span>${tr.breakpoints.map((b) => `<em class="${n >= b ? 'on' : ''}">${b}</em>`).join('')}</span>${next ? `<small>faltam ${next - n}</small>` : '<small>completo!</small>'}</div>`;
  }).join('');
  const items = (info.items ?? []).map((id) => {
    const it = ITEMS[id];
    return it ? `<div class="ins-item">${itemImg(id)}<div><b>${esc(it.name)}</b><small>${esc(it.desc)}</small></div></div>` : '';
  }).join('');
  el.innerHTML = `
    <button class="ins-x" title="Fechar (Esc)">✕</button>
    ${gone ? '<div class="ins-gone">fora de combate</div>' : ''}
    ${bars}
    <div class="ins-tip">${unitTipHtml(info)}</div>
    ${traits ? `<div class="ins-sec">Sinergias</div>${traits}` : ''}
    ${items ? `<div class="ins-sec">Itens</div>${items}` : ''}`;
}
