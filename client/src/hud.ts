import {
  AD_STAR_MULT, BASE_CRIT, COST_COLORS, HP_STAR_MULT, MAX_LEVEL, REROLL_COST, ROLES, TRAITS, UNITS, XP_COST,
  abilityText, isPveRound, stageLabel, traitText,
} from '../../shared/data';
import { AUGMENTS, TIER_COLOR, TIER_NAME, traitBonus } from '../../shared/augments';
import { COMPONENTS, ITEMS, combine, statsText } from '../../shared/items';
import { computeTraits } from '../../shared/traits';
import type { TraitId } from '../../shared/types';
import type { HoverInfo } from './three/scene';
import { net } from './net';
import { itemIcon, itemImg } from './itemIcons';
import { augIcon, roleImg, traitImg } from './emblems';

function augImg(id: string, cls = 'ai') {
  const a = AUGMENTS[id];
  if (!a) return '';
  const t = a.trait ? TRAITS[a.trait] : undefined;
  const url = augIcon(id, { tier: a.tier, trait: a.trait, traitColor: t?.color, bonus: a.traitBonus });
  return `<img class="${cls}" src="${url}" alt="" draggable="false">`;
}
import { robotPortrait } from './three/portrait';
import { getVolume, isMuted, setVolume, sfx, toggleMute } from './sfx';
import { QUALITY_LABEL, loadQuality, saveQuality, type Quality } from './three/post';
import { store } from './store';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

let lastShopKey = '';
let lastShopIds = '';
let lastTraitsKey = '';
let lastPlayersKey = '';
let lastLevel = 0;
let lastBenchKey = '';

/** Bolinhas das rodadas do estágio atual (⚔ PvP, 🤖 PvE, 🎁 arsenal, ✨ aprimoramento). */
function stageDots(round: number) {
  const label = stageLabel(round);
  const [stage, sub] = label.split('-').map(Number);
  const first = stage === 1 ? 1 : round - (sub - 1);
  const count = stage === 1 ? 3 : 7;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const r = first + i;
    const l = stageLabel(r);
    const sb = Number(l.split('-')[1]);
    let icon = isPveRound(r) ? '🤖' : '⚔️';
    if (l === '2-1' || l === '3-2' || l === '4-2') icon = '✨';
    else if (stage >= 2 && sb === 4) icon = '🎁';
    out.push(`<span class="${r < round ? 'past' : r === round ? 'cur' : ''}" title="${l}">${icon}</span>`);
  }
  return out.join('');
}

export function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

// ---------------- tooltip ----------------

const tip = () => $('tooltip');

export function showTip(html: string, x: number, y: number) {
  const t = tip();
  t.innerHTML = html;
  t.classList.remove('hidden');
  const r = t.getBoundingClientRect();
  let tx = x + 18, ty = y + 18;
  if (tx + r.width > window.innerWidth - 8) tx = x - r.width - 18;
  if (ty + r.height > window.innerHeight - 8) ty = window.innerHeight - r.height - 8;
  t.style.left = `${Math.max(8, tx)}px`;
  t.style.top = `${Math.max(8, ty)}px`;
}
export function hideTip() { tip().classList.add('hidden'); }

export function unitTipHtml(info: HoverInfo) {
  const def = UNITS[info.defId];
  const star = info.star || 1;
  const items = info.items ?? [];
  const st = { ad: 0, as: 0, ap: 0, mana: 0, armor: 0, mr: 0, hp: 0, crit: 0 };
  for (const id of items) {
    if (id === 'maoleve') continue;
    for (const [k, v] of Object.entries(ITEMS[id]?.stats ?? {})) st[k as keyof typeof st] += v as number;
  }
  const role = ROLES[def.role];
  const traits = def.traits.map((t) => `<span class="tt-trait" style="color:${TRAITS[t].color}">${traitImg(t, TRAITS[t].color)} ${TRAITS[t].name}</span>`).join('');
  const hpMax = Math.round(def.hp * HP_STAR_MULT[star - 1] + st.hp);
  const hp = info.hp !== undefined ? `${info.hp}/${info.maxHp}` : String(hpMax);
  const stars = info.star ? `<span class="tt-stars s${info.star}">${'★'.repeat(info.star)}</span>` : '';
  const ad = Math.round(def.atk * AD_STAR_MULT[star - 1] * (1 + st.ad / 100));
  const as = (def.as * (1 + st.as / 100)).toFixed(2);
  const itemsHtml = items.length
    ? `<div class="tt-items">${items.map((i) => `<span>${itemImg(i)} ${esc(ITEMS[i].name)}</span>`).join('')}</div>` : '';
  return `
    <div class="tt-head" style="border-color:${COST_COLORS[def.cost]}">
      <b>${esc(def.name)}</b> ${stars}<span class="tt-cost" style="background:${COST_COLORS[def.cost]}">${def.cost}💰</span>
    </div>
    <div class="tt-role" style="color:${role.color}">${roleImg(def.role, role.color)} ${role.name} <small>${def.ability.scale === 'ad' ? '· habilidade escala com DA' : ''}</small></div>
    <div class="tt-traits">${traits}</div>
    <div class="tt-stats">
      <span title="Vida">❤️ ${hp}</span><span title="Dano de Ataque">⚔️ ${ad}</span><span title="Poder de Habilidade">✨ ${100 + st.ap}</span>
      <span title="Velocidade de Ataque">⚡ ${as}</span><span title="Alcance">🎯 ${def.range}</span><span title="Crítico">💥 ${BASE_CRIT + st.crit}%</span>
      <span title="Armadura">🛡️ ${def.armor + st.armor}</span><span title="Resistência Mágica">🔮 ${def.mr + st.mr}</span>
      <span title="Mana">🔷 ${def.startMana + st.mana}/${def.mana}</span>
    </div>
    <div class="tt-ab"><b>${esc(def.ability.name)}</b><br>${esc(abilityText(def, info.star || undefined))}</div>
    ${itemsHtml}`;
}

export function itemTipHtml(id: string) {
  const it = ITEMS[id];
  if (!it) return '';
  let extra = '';
  if (it.component) {
    extra = `<div class="tt-recipes">${COMPONENTS.map((c) => {
      const r = ITEMS[combine(id, c)!];
      return `<div>${itemImg(c)}<span class="arr">›</span>${itemImg(r.id)} <b>${esc(r.name)}</b></div>`;
    }).join('')}</div>`;
  } else if (it.recipe) {
    extra = `<div class="tt-recipe">Receita: ${itemImg(it.recipe[0])} ${esc(ITEMS[it.recipe[0]].name)} + ${itemImg(it.recipe[1])} ${esc(ITEMS[it.recipe[1]].name)}</div>`;
  }
  return `<div class="tt-head tt-item" style="border-color:${it.component ? '#9aa3ad' : '#ffd23f'}">${itemImg(id, 'ii big')}<b>${esc(it.name)}</b><small>${it.component ? 'componente' : 'item completo'}</small></div>
    <div class="tt-istats">${statsText(it.stats)}</div>
    ${it.component ? '' : `<div class="tt-ab">${esc(it.desc)}</div>`}${extra}
    <div class="tt-hint">${it.component ? 'Arraste até um robô. Dois componentes no mesmo robô viram um item completo.' : 'Arraste até um robô para equipar.'}</div>`;
}

export function augmentTipHtml(id: string) {
  const a = AUGMENTS[id];
  if (!a) return '';
  return `<div class="tt-head" style="border-color:${TIER_COLOR[a.tier]}">${augImg(id, 'ii big')}<b>${esc(a.name)}</b><small>${TIER_NAME[a.tier]}</small></div><div class="tt-ab">${esc(a.desc)}</div>`;
}

export function traitTipHtml(id: TraitId, count: number) {
  const t = TRAITS[id];
  const tiers = t.breakpoints.map((b, i) => `<div class="tt-tier ${count >= b ? 'on' : ''}">(${b}) ${esc(traitText(t, i))}</div>`).join('');
  const units = Object.values(UNITS).filter((u) => !u.pve && u.traits.includes(id))
    .sort((a, b) => a.cost - b.cost)
    .map((u) => `<span style="color:${COST_COLORS[u.cost]}">${esc(u.name)}</span>`).join(' · ');
  const style = t.style === 'vertical' ? '⬆ vertical' : '↔ horizontal';
  return `<div class="tt-head" style="border-color:${t.color}">${traitImg(id, t.color, 'ti big')}<b>${t.name}</b> <small>${t.kind} · ${style}</small></div>${tiers}<div class="tt-units">${units}</div>`;
}

// ---------------- toasts / chat ----------------

export function toast(msg: string, kind: 'info' | 'good' | 'bad' = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  $('toasts').appendChild(el);
  if (kind === 'bad') sfx('error');
  setTimeout(() => el.classList.add('out'), 2600);
  setTimeout(() => el.remove(), 3100);
}

/** Vida caiu: número flutuante e tremida no contador. */
export function hpHit(amount: number) {
  const box = $('myHp');
  box.classList.remove('hit'); void box.offsetWidth; box.classList.add('hit');
  const r = box.getBoundingClientRect();
  const f = document.createElement('span');
  f.className = 'hp-float';
  f.textContent = `-${amount} ❤️`;
  f.style.left = `${r.left + r.width / 2}px`;
  f.style.top = `${r.bottom + 4}px`;
  document.body.appendChild(f);
  setTimeout(() => f.remove(), 1400);
}

/** Faixa grande no meio-alto da tela (evolução, conquistas...). */
export function banner(html: string, kind: 'gold' | 'silver' | 'green' = 'gold', ms = 2200) {
  const el = document.createElement('div');
  el.className = `banner ${kind}`;
  el.innerHTML = html;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('out'), ms);
  setTimeout(() => el.remove(), ms + 500);
}

export function chatLine(from: string, msg: string) {
  const log = $('chatLog');
  const el = document.createElement('div');
  el.innerHTML = `<b>${esc(from)}:</b> ${esc(msg)}`;
  log.appendChild(el);
  while (log.children.length > 40) log.firstChild?.remove();
  log.scrollTop = log.scrollHeight;
}

// ---------------- venda ----------------

export function setSellMode(on: boolean, value: number) {
  $('shopbar').classList.toggle('selling', on);
  $('sellValue').textContent = `+${value}💰`;
}
export function overSell(x: number, y: number) {
  const r = $('shopbar').getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

// ---------------- render ----------------

export interface HudHooks {
  itemDrag: (pos: { x: number; y: number } | null) => void;
  dropItem: (index: number, x: number, y: number) => void;
}

let choiceHidden = false;

function initItemsAndChoices(hooks: HudHooks) {
  // ---- banco de itens: arrastar para um robô ----
  const bench = $('itemBench');
  let drag: { i: number; ghost: HTMLElement } | null = null;
  bench.addEventListener('pointerdown', (e) => {
    const slot = (e.target as HTMLElement).closest('.islot.full') as HTMLElement | null;
    if (!slot || e.button !== 0) return;
    e.preventDefault();
    const i = Number(slot.dataset.i);
    const ghost = document.createElement('div');
    ghost.className = 'item-ghost';
    const gid = store.state?.me.itemBench[i];
    if (gid) ghost.innerHTML = itemImg(gid, '');
    document.body.appendChild(ghost);
    drag = { i, ghost };
    slot.classList.add('lifted');
    hideTip();
    const move = (ev: PointerEvent) => {
      ghost.style.left = `${ev.clientX}px`;
      ghost.style.top = `${ev.clientY}px`;
      hooks.itemDrag({ x: ev.clientX, y: ev.clientY });
    };
    move(e);
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      ghost.remove();
      slot.classList.remove('lifted');
      hooks.itemDrag(null);
      if (drag) hooks.dropItem(drag.i, ev.clientX, ev.clientY);
      drag = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  });
  bench.addEventListener('mousemove', (e) => {
    if (drag) return;
    const slot = (e.target as HTMLElement).closest('.islot.full') as HTMLElement | null;
    const id = slot ? store.state?.me.itemBench[Number(slot.dataset.i)] : null;
    if (id) showTip(itemTipHtml(id), e.clientX, e.clientY);
    else hideTip();
  });
  bench.addEventListener('mouseleave', hideTip);

  // ---- aprimoramentos no topo ----
  $('augs').addEventListener('mousemove', (e) => {
    const el = (e.target as HTMLElement).closest('.aug') as HTMLElement | null;
    if (el) showTip(augmentTipHtml(el.dataset.id!), e.clientX, e.clientY);
    else hideTip();
  });
  $('augs').addEventListener('mouseleave', hideTip);

  // ---- escolha (aprimoramento / arsenal) ----
  $('choice').addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('#choiceHide')) { choiceHidden = true; sfx('click'); renderChoice(); return; }
    const card = t.closest('.ch-card') as HTMLElement | null;
    if (!card) return;
    net.send({ t: 'choose', i: Number(card.dataset.i) });
    sfx('star');
    $('choice').classList.add('hidden');
  });
  $('choiceShow').onclick = () => { choiceHidden = false; sfx('click'); renderChoice(); };
}

let lastChoiceKey = '';
function renderChoice() {
  const ch = store.state?.me.choice ?? null;
  const box = $('choice');
  $('choiceShow').classList.toggle('hidden', !ch || !choiceHidden);
  if (!ch) { box.classList.add('hidden'); lastChoiceKey = ''; choiceHidden = false; return; }
  box.classList.toggle('hidden', choiceHidden);
  const key = JSON.stringify(ch);
  if (key === lastChoiceKey) return;
  lastChoiceKey = key;
  choiceHidden = false;
  box.classList.remove('hidden');
  hideTip();
  sfx('augment');
  const cards = ch.options.map((id, i) => {
    if (ch.kind === 'augment') {
      const a = AUGMENTS[id];
      return `<button class="ch-card aug-${a.tier}" data-i="${i}" style="--tier:${TIER_COLOR[a.tier]}">
        <div class="ch-icon">${augImg(id, 'ch-img')}</div><div class="ch-name">${esc(a.name)}</div>
        <div class="ch-tier">${TIER_NAME[a.tier]}</div><div class="ch-desc">${esc(a.desc)}</div></button>`;
    }
    const it = ITEMS[id];
    return `<button class="ch-card ${it.component ? '' : 'aug-ouro'}" data-i="${i}" style="--tier:${it.component ? '#9aa3ad' : '#ffcf4a'}">
      <div class="ch-icon">${itemImg(id, 'ch-img')}</div><div class="ch-name">${esc(it.name)}</div>
      <div class="ch-tier">${statsText(it.stats)}</div><div class="ch-desc">${esc(it.component ? 'Componente básico.' : it.desc)}</div></button>`;
  }).join('');
  box.innerHTML = `<div class="ch-box"><h2>${esc(ch.title)}</h2><div class="ch-cards">${cards}</div>
    <button id="choiceHide" class="btn small ghost">👁 Ver tabuleiro</button></div>`;
}

export function initHud(hooks: HudHooks) {
  initItemsAndChoices(hooks);
  $('xpBtn').onclick = () => { net.send({ t: 'xp' }); sfx('xp'); };
  $('rerollBtn').onclick = () => { net.send({ t: 'reroll' }); sfx('reroll'); };
  $('lockBtn').onclick = () => { net.send({ t: 'lock' }); sfx('click'); };
  $('readyBtn').onclick = () => { net.send({ t: 'ready' }); sfx('click'); };
  // ---- som: popover com volumes ----
  const mute = $('muteBtn');
  const icon = () => (isMuted() || getVolume('master') === 0 ? '🔇' : '🔊');
  mute.textContent = icon();
  const pop = document.createElement('div');
  pop.id = 'volPop';
  pop.className = 'hidden';
  const row = (k: 'master' | 'music' | 'sfx', label: string) =>
    `<label class="vrow"><span>${label}</span><input type="range" min="0" max="100" data-k="${k}" value="${Math.round(getVolume(k) * 100)}"><b data-v="${k}">${Math.round(getVolume(k) * 100)}</b></label>`;
  pop.innerHTML = `<h4>Som</h4>${row('master', 'Geral')}${row('music', 'Música')}${row('sfx', 'Efeitos')}
    <button class="btn small ghost" id="muteToggle">${isMuted() ? '🔊 Ativar som' : '🔇 Silenciar tudo'}</button>`;
  $('hud').appendChild(pop);
  const place = () => { const r = mute.getBoundingClientRect(); pop.style.top = `${r.bottom + 8}px`; pop.style.right = `${innerWidth - r.right}px`; };
  mute.onclick = (e) => { e.stopPropagation(); place(); pop.classList.toggle('hidden'); sfx('click'); };
  pop.addEventListener('input', (e) => {
    const inp = e.target as HTMLInputElement;
    const k = inp.dataset.k as 'master' | 'music' | 'sfx';
    if (!k) return;
    setVolume(k, Number(inp.value) / 100);
    pop.querySelector<HTMLElement>(`[data-v="${k}"]`)!.textContent = inp.value;
    mute.textContent = icon();
  });
  pop.addEventListener('change', (e) => { if ((e.target as HTMLInputElement).dataset.k === 'sfx') sfx('buy'); });
  pop.querySelector<HTMLButtonElement>('#muteToggle')!.onclick = (e) => {
    const m = toggleMute();
    (e.target as HTMLElement).textContent = m ? '🔊 Ativar som' : '🔇 Silenciar tudo';
    mute.textContent = icon();
  };
  window.addEventListener('pointerdown', (e) => { if (!pop.contains(e.target as Node) && e.target !== mute) pop.classList.add('hidden'); });
  const gfx = $('gfxBtn');
  const q = loadQuality();
  gfx.textContent = `✨ ${QUALITY_LABEL[q]}`;
  gfx.onclick = () => {
    const next: Quality = q === 'alto' ? 'medio' : q === 'medio' ? 'baixo' : 'alto';
    saveQuality(next);
    location.reload();
  };
  const input = $<HTMLInputElement>('chatInput');
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && input.value.trim()) {
      net.send({ t: 'chat', msg: input.value.trim() });
      input.value = '';
    }
    if (e.key === 'Escape') input.blur();
  });
  $('shop').addEventListener('click', (e) => {
    const card = (e.target as HTMLElement).closest('.card') as HTMLElement | null;
    if (!card || card.classList.contains('empty')) return;
    const i = Number(card.dataset.i);
    const me = store.state?.me;
    const id = me?.shop[i];
    if (!me || !id) return;
    if (me.gold < UNITS[id].cost) { toast('Grana insuficiente, parceiro.', 'bad'); return; }
    net.send({ t: 'buy', i });
    sfx('buy');
    card.classList.add('bought');
  });
  $('shop').addEventListener('mousemove', (e) => {
    const card = (e.target as HTMLElement).closest('.card') as HTMLElement | null;
    const id = card && store.state?.me.shop[Number(card.dataset.i)];
    if (id) showTip(unitTipHtml({ defId: id, star: 1 }), e.clientX, e.clientY);
    else hideTip();
  });
  $('shop').addEventListener('mouseleave', hideTip);
  $('traits').addEventListener('mousemove', (e) => {
    const row = (e.target as HTMLElement).closest('.trait') as HTMLElement | null;
    if (row) showTip(traitTipHtml(row.dataset.id as TraitId, Number(row.dataset.count)), e.clientX, e.clientY);
    else hideTip();
  });
  $('traits').addEventListener('mouseleave', hideTip);
  $('leftTabs').addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button') as HTMLElement | null;
    if (b) { sfx('click'); setLeftTab(b.dataset.tab as 'traits' | 'dmg'); }
  });
  $('players').addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest('.prow') as HTMLElement | null;
    if (!row) return;
    store.scoutId = row.dataset.id === store.youId ? null : row.dataset.id!;
    sfx('click');
    renderHud();
  });
}

export function renderHud() {
  const s = store.state;
  if (!s) return;
  const me = s.me;

  // topo
  const phaseName = s.phase === 'planning' ? 'Planejamento' : s.phase === 'combat' ? 'Combate' : s.phase === 'gameover' ? 'Fim de jogo' : '';
  const kind = s.pve ? '🤖 PvE' : '⚔️ PvP';
  const vs = s.phase === 'combat' && store.combat && store.combat.round === s.round
    ? ` <span class="vs">vs ${esc(store.combat.opponentName)}</span>` : '';
  $('roundLabel').innerHTML = `Estágio <b>${stageLabel(s.round)}</b> · ${kind} · ${phaseName}${vs}`;
  $('stageDots').innerHTML = stageDots(s.round);
  $('myHp').innerHTML = `❤️ <b>${Math.max(0, me.hp)}</b>`;
  $('augs').innerHTML = me.augments.map((id) => {
    const a = AUGMENTS[id];
    return a ? `<div class="aug" data-id="${id}" style="--tier:${TIER_COLOR[a.tier]}">${augImg(id)}</div>` : '';
  }).join('');

  // itens
  const benchKey = JSON.stringify(me.itemBench);
  if (benchKey !== lastBenchKey) {
    lastBenchKey = benchKey;
    const slots = Math.max(10, me.itemBench.length);
    $('itemBench').innerHTML = Array.from({ length: slots }, (_, i) => {
      const id = me.itemBench[i];
      if (!id) return '<div class="islot"></div>';
      const it = ITEMS[id];
      return `<div class="islot full ${it.component ? '' : 'done'}" data-i="${i}"><img src="${itemIcon(id)}" alt="" draggable="false"></div>`;
    }).join('');
    $('itemPanel').classList.toggle('has', me.itemBench.length > 0);
  }
  renderChoice();

  // economia
  if ($('gold').textContent !== String(me.gold)) {
    $('gold').textContent = String(me.gold);
    const gb = $('goldBox');
    gb.classList.remove('bump'); void gb.offsetWidth; gb.classList.add('bump');
  }
  const cap = me.augments.includes('juroscomp') ? 7 : 5;
  $('interest').innerHTML = Array.from({ length: cap }, (_, i) => `<i class="${i < Math.min(cap, Math.floor(me.gold / 10)) ? 'on' : ''}"></i>`).join('');
  $('rerollBtn').innerHTML = me.freeRerolls > 0 ? `🔄 Rolar <b>GRÁTIS</b> <kbd>D</kbd>` : `🔄 Rolar <b>2💰</b> <kbd>D</kbd>`;
  $('levelLabel').textContent = `Nível ${me.level}`;
  $('xpLabel').textContent = me.level >= MAX_LEVEL ? 'MÁX' : `${me.xp}/${me.xpNeeded}`;
  $('xpFill').style.width = me.level >= MAX_LEVEL ? '100%' : `${(100 * me.xp) / Math.max(1, me.xpNeeded)}%`;
  const nBoard = me.units.filter((u) => u.loc.zone === 'board').length;
  const bc = $('boardCount');
  bc.textContent = `🤖 Em campo ${nBoard}/${me.level}`;
  bc.className = nBoard > me.level ? 'over' : nBoard === me.level ? 'full' : 'room';
  const streak = $('streak');
  streak.textContent = me.streak >= 2 ? `🔥 ${me.streak}` : me.streak <= -2 ? `🧊 ${-me.streak}` : '';
  ($('xpBtn') as HTMLButtonElement).disabled = me.gold < XP_COST || me.level >= MAX_LEVEL || !me.alive;
  ($('rerollBtn') as HTMLButtonElement).disabled = (me.gold < REROLL_COST && me.freeRerolls <= 0) || !me.alive;
  $('lockBtn').textContent = me.locked ? '🔒' : '🔓';
  $('lockBtn').classList.toggle('on', me.locked);
  const ready = $('readyBtn');
  ready.classList.toggle('on', me.ready);
  ready.textContent = me.ready ? 'Pronto ✔' : 'Pronto';
  (ready as HTMLButtonElement).disabled = s.phase !== 'planning' || !me.alive;
  if (me.level > lastLevel && lastLevel > 0) sfx('levelup');
  lastLevel = me.level;

  // loja
  const counts = new Map<string, number>();
  for (const u of me.units) if (u.star === 1) counts.set(u.defId, (counts.get(u.defId) ?? 0) + 1);
  const shopKey = JSON.stringify(me.shop) + JSON.stringify([...counts]) + me.gold;
  if (shopKey !== lastShopKey) {
    lastShopKey = shopKey;
    const shopIds = me.shop.join(',');
    const shopEl = $('shop');
    if (shopIds !== lastShopIds) {
      shopEl.classList.remove('roll'); void shopEl.offsetWidth; shopEl.classList.add('roll');
      setTimeout(() => shopEl.classList.remove('roll'), 700);
    }
    lastShopIds = shopIds;
    shopEl.innerHTML = me.shop.map((id, i) => {
      if (!id) return `<div class="card empty" data-i="${i}"></div>`;
      const d = UNITS[id];
      const owned = counts.get(id) ?? 0;
      const tr = d.traits.map((t) => `<div class="chip" style="--tc:${TRAITS[t].color}">${traitImg(t, TRAITS[t].color)}${TRAITS[t].name}</div>`).join('');
      const cls = `${owned >= 2 ? 'upgrade' : owned === 1 ? 'owned' : ''} ${me.gold < d.cost ? 'poor' : ''}`;
      const role = ROLES[d.role];
      return `<div class="card c${d.cost} ${cls}" data-i="${i}" style="--cc:${COST_COLORS[d.cost]}">
        <img src="${robotPortrait(id, d.look)}" alt="">
        <kbd class="card-key">${i + 1}</kbd>
        <div class="card-role" style="color:${role.color}" title="${role.name}">${roleImg(d.role, role.color)}</div>
        <div class="card-traits">${tr}</div>
        ${owned >= 2 ? '<div class="card-up">⭐ EVOLUI!</div>' : ''}
        <div class="card-bottom"><span>${esc(d.name)}</span><b class="card-cost"><i></i>${d.cost}</b></div>
      </div>`;
    }).join('');
  }

  // sinergias
  const board = me.units.filter((u) => u.loc.zone === 'board').map((u) => u.defId);
  const traits = computeTraits(board, traitBonus(me.augments));
  const tKey = JSON.stringify(traits);
  if (tKey !== lastTraitsKey) {
    lastTraitsKey = tKey;
    $('traitList').innerHTML = traits.length
      ? traits.map((t) => {
          const d = TRAITS[t.id];
          const bps = d.breakpoints.map((b, i) => `<span class="${i === t.tier ? 'cur' : t.count >= b ? 'done' : ''}">${b}</span>`).join('<i>›</i>');
          const tierCls = t.tier < 0 ? 'off' : t.tier === d.breakpoints.length - 1 ? 'gold' : 'bronze';
          return `<div class="trait ${tierCls}" data-id="${t.id}" data-count="${t.count}" style="--tc:${d.color}">
            <div class="ticon">${traitImg(t.id)}</div>
            <div class="tbody"><div class="tname">${d.name}</div><div class="tbps"><b>${t.count}</b> ${bps}</div></div>
          </div>`;
        }).join('')
      : '<div class="hint">Coloque robôs no tabuleiro para ativar sinergias.</div>';
  }

  // jogadores
  const players = [...s.players].sort((a, b) => Number(b.alive) - Number(a.alive) || b.hp - a.hp || a.place - b.place);
  const pKey = JSON.stringify(players.map((p) => [p.id, p.hp, p.level, p.alive, p.connected, p.streak])) + store.scoutId + s.opponentId + s.phase;
  if (pKey !== lastPlayersKey) {
    lastPlayersKey = pKey;
    $('players').innerHTML = players.map((p, rank) => {
      const cls = [
        p.id === store.youId ? 'me' : '',
        !p.alive ? 'dead' : '',
        p.id === store.scoutId ? 'scouted' : '',
        s.phase === 'combat' && p.id === s.opponentId ? 'opp' : '',
        !p.connected ? 'offline' : '',
      ].join(' ');
      const st = p.streak >= 2 ? `🔥${p.streak}` : p.streak <= -2 ? `🧊${-p.streak}` : '';
      return `<div class="prow ${cls}" data-id="${p.id}" title="Clique para espiar o tabuleiro">
        <div class="prank">${p.alive ? rank + 1 : '💀'}</div>
        <div class="pmain">
          <div class="pname">${esc(p.name)}${p.id === store.youId ? ' (você)' : ''}${!p.connected ? ' 📴' : ''}</div>
          <div class="pinfo"><span>Nv ${p.level}</span><span>${st}</span><span>${p.alive ? `❤️ ${p.hp}` : `${p.place}º`}</span></div>
          <div class="php"><div style="width:${Math.max(0, p.hp)}%"></div></div>
        </div>
      </div>`;
    }).join('');
  }
}

/** chamado todo frame: timer */
export function tickHud() {
  const s = store.state;
  if (!s) return;
  const left = Math.max(0, store.phaseEndsAt - performance.now());
  const total = s.phase === 'planning' ? Math.max(1, s.phaseTotal) : Math.max(left, 1);
  const fill = $('timerFill');
  fill.style.width = s.phase === 'planning' ? `${(100 * left) / total}%` : '100%';
  fill.classList.toggle('combat', s.phase === 'combat');
  fill.classList.toggle('urgent', s.phase === 'planning' && left < 5000);
  $('timerText').textContent = s.phase === 'planning' ? `${Math.ceil(left / 1000)}s` : s.phase === 'combat' ? '⚔️' : '';
  // contagem regressiva sonora nos últimos 5s do planejamento
  const sec = Math.ceil(left / 1000);
  if (s.phase === 'planning' && sec <= 5 && sec >= 1) {
    if (sec !== lastTickSec) { sfx(sec === 1 ? 'tickLast' : 'tick', 300); lastTickSec = sec; }
  } else lastTickSec = 0;
  renderDmg();
}
let lastTickSec = 0;

// ---------------- aba Sinergias / Dano ----------------

let leftTab: 'traits' | 'dmg' = 'traits';
let lastDmgKey = '';
let lastDmgAt = 0;

export function setLeftTab(tab: 'traits' | 'dmg' | 'toggle') {
  leftTab = tab === 'toggle' ? (leftTab === 'traits' ? 'dmg' : 'traits') : tab;
  document.querySelectorAll<HTMLElement>('#leftTabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === leftTab));
  $('traitList').classList.toggle('hidden', leftTab !== 'traits');
  $('dmgMeter').classList.toggle('hidden', leftTab !== 'dmg');
  lastDmgKey = '';
  renderDmg(true);
}

/** Dano causado por cada robô seu no combate atual (ou no último). */
function renderDmg(force = false) {
  if (leftTab !== 'dmg') return;
  const now = performance.now();
  if (!force && now - lastDmgAt < 200) return;
  lastDmgAt = now;
  const cb = store.combat;
  const el = $('dmgMeter');
  if (!cb) { el.innerHTML = '<div class="hint">O dano de cada robô aparece aqui durante o combate.</div>'; return; }
  const elapsed = now - store.combatStartedAt;
  const mine = cb.result.units.filter((u) => u.side === cb.mySide);
  const stat = new Map<number, { phys: number; magic: number; taken: number; heal: number }>();
  for (const u of mine) stat.set(u.uid, { phys: 0, magic: 0, taken: 0, heal: 0 });
  for (const e of cb.result.events) {
    if (e.t > elapsed) break;
    if (e.k === 'dmg') {
      const s = e.s !== undefined ? stat.get(e.s) : undefined;
      if (s) { if (e.magic) s.magic += e.amt; else s.phys += e.amt; }
      const v = stat.get(e.u);
      if (v) v.taken += e.amt;
    } else if (e.k === 'heal') {
      const v = stat.get(e.u);
      if (v) v.heal += e.amt;
    }
  }
  const rows = mine.map((u) => ({ u, ...stat.get(u.uid)! })).sort((a, b) => b.phys + b.magic - (a.phys + a.magic));
  const max = Math.max(1, ...rows.map((r) => r.phys + r.magic));
  const total = rows.reduce((s, r) => s + r.phys + r.magic, 0);
  const key = rows.map((r) => `${r.u.uid}:${r.phys}:${r.magic}:${r.taken}`).join('|');
  if (key === lastDmgKey && !force) return;
  lastDmgKey = key;
  const done = elapsed > cb.result.duration;
  const fmt = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(1)}k` : String(Math.round(n)));
  el.innerHTML = `<div class="dm-head"><span>${done ? 'Último combate' : 'Ao vivo'} · vs ${esc(cb.opponentName)}</span><b>${fmt(total)}</b></div>` +
    rows.map((r, i) => {
      const d = UNITS[r.u.defId];
      const all = r.phys + r.magic;
      return `<div class="dm-row" style="--cc:${COST_COLORS[d.cost] ?? '#888'}" title="Físico ${fmt(r.phys)} · Mágico ${fmt(r.magic)} · Recebido ${fmt(r.taken)} · Curado ${fmt(r.heal)}">
        <img src="${robotPortrait(d.id, d.look)}" alt="">
        <div class="dm-main">
          <div class="dm-top"><span>${i === 0 && all > 0 ? '👑 ' : ''}${esc(d.name)} <i>${'★'.repeat(r.u.star)}</i></span><b>${fmt(all)}</b></div>
          <div class="dm-bar"><div class="ph" style="width:${(100 * r.phys) / max}%"></div><div class="mg" style="width:${(100 * r.magic) / max}%"></div></div>
        </div>
      </div>`;
    }).join('');
}
