import { COST_COLORS, ROLES, TRAITS, UNITS, traitText } from '../../shared/data';
import { AUGMENTS, TIER_COLOR, TIER_NAME } from '../../shared/augments';
import { ALL_COMPONENTS as COMPONENTS, ITEMS, combine } from '../../shared/items';
import type { AugTier, TraitId } from '../../shared/types';
import { augIcon, roleImg, traitImg } from './emblems';
import { augmentTipHtml, esc, hideTip, itemTipHtml, showTip, traitTipHtml, unitTipHtml } from './hud';
import { itemImg } from './itemIcons';
import { robotPortrait } from './three/portrait';
import { resetTips } from './tips';
import { sfx } from './sfx';

// Guia do jogo: básico, sinergias, robôs, itens e aprimoramentos.

type Tab = 'basico' | 'sinergias' | 'robos' | 'itens' | 'aprimoramentos';
const TABS: [Tab, string][] = [['basico', 'Como jogar'], ['sinergias', 'Sinergias'], ['robos', 'Robôs'], ['itens', 'Itens'], ['aprimoramentos', 'Aprimoramentos']];

let root: HTMLElement | null = null;
let tab: Tab = 'basico';
let unitFilter: { cost: number; trait: TraitId | '' } = { cost: 0, trait: '' };

export function isGuideOpen() { return !!root && !root.classList.contains('hidden'); }

export function openGuide(t?: Tab) {
  if (!root) build();
  if (t) tab = t;
  root!.classList.remove('hidden');
  render();
  sfx('click');
}
export function closeGuide() {
  root?.classList.add('hidden');
  hideTip();
}
export function toggleGuide() { if (isGuideOpen()) closeGuide(); else openGuide(); }

function build() {
  root = document.createElement('div');
  root.id = 'guide';
  root.className = 'hidden';
  root.innerHTML = `<div class="gd-box">
    <div class="gd-head"><h2>📖 Guia da Brisa</h2><div class="gd-tabs">${TABS.map(([id, n]) => `<button data-tab="${id}">${n}</button>`).join('')}</div>
    <button class="gd-close btn small ghost" title="Fechar (Esc)">✖</button></div>
    <div class="gd-body"></div></div>`;
  document.body.appendChild(root);
  root.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    if (el === root || el.closest('.gd-close')) { closeGuide(); return; }
    const tb = el.closest('[data-tab]') as HTMLElement | null;
    if (tb) { tab = tb.dataset.tab as Tab; sfx('click'); render(); return; }
    const ft = el.closest('[data-filter-trait]') as HTMLElement | null;
    if (ft) { unitFilter.trait = (ft.dataset.filterTrait as TraitId) || ''; tab = 'robos'; sfx('click'); render(); return; }
    const fc = el.closest('[data-filter-cost]') as HTMLElement | null;
    if (fc) { unitFilter.cost = Number(fc.dataset.filterCost); sfx('click'); render(); return; }
    if (el.closest('#gdResetTips')) { resetTips(); (el as HTMLButtonElement).textContent = '✔ As dicas vão aparecer de novo'; }
  });
  root.addEventListener('mousemove', (e) => {
    const el = (e.target as HTMLElement).closest('[data-tip]') as HTMLElement | null;
    if (!el) { hideTip(); return; }
    const [k, id] = el.dataset.tip!.split(':');
    const html = k === 'u' ? unitTipHtml({ defId: id, star: 1 }) : k === 'i' ? itemTipHtml(id) : k === 't' ? traitTipHtml(id as TraitId, 0) : augmentTipHtml(id);
    showTip(html, e.clientX, e.clientY);
  });
  root.addEventListener('mouseleave', hideTip);
}

function render() {
  if (!root) return;
  root.querySelectorAll<HTMLElement>('.gd-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  const body = root.querySelector('.gd-body') as HTMLElement;
  body.innerHTML = tab === 'basico' ? basico() : tab === 'sinergias' ? sinergias() : tab === 'robos' ? robos() : tab === 'itens' ? itens() : aprimoramentos();
  body.scrollTop = 0;
}

const shop = Object.values(UNITS).filter((u) => !u.pve);

function basico() {
  const step = (n: number, title: string, text: string) => `<div class="gd-step"><b>${n}</b><div><h4>${title}</h4><p>${text}</p></div></div>`;
  return `<div class="gd-basics">
    ${step(1, 'Compre robôs', 'Clique numa carta da loja (ou aperte <kbd>1</kbd>–<kbd>5</kbd>). Eles vão para o banco; arraste para as fileiras de baixo do tabuleiro. Seu <b>nível</b> diz quantos robôs podem lutar.')}
    ${step(2, 'Evolua com estrelas', '3 cópias iguais viram ⭐⭐ (quase 3x mais forte). 3 de ⭐⭐ viram ⭐⭐⭐. Cartas com brilho dourado na loja completam uma evolução.')}
    ${step(3, 'Ative sinergias', 'Robôs com a mesma origem/classe dão bônus. Os números (2 › 4 › 6) mostram quantos robôs <b>diferentes</b> você precisa. Veja a aba <b>Sinergias</b>.')}
    ${step(4, 'Posicione', `${roleImg('tank', ROLES.tank.color, 'ri')} Tanques e ${roleImg('fighter', ROLES.fighter.color, 'ri')} lutadores na frente; ${roleImg('adcarry', ROLES.adcarry.color, 'ri')} atiradores e ${roleImg('apcaster', ROLES.apcaster.color, 'ri')} conjuradores atrás, de preferência num canto. ${roleImg('assassin', ROLES.assassin.color, 'ri')} Assassinos pulam na retaguarda inimiga.`)}
    ${step(5, 'Monte itens', 'Rodadas contra drones (PvE) soltam <b>componentes</b>. Arraste até um robô: 2 componentes viram um item completo. Dê os itens de dano para o seu principal atirador/conjurador e os de defesa para o tanque.')}
    ${step(6, 'Cuide da economia', 'Guarde ouro: cada 10 💰 rende +1 por rodada (máx. +5). Sequências de vitórias ou derrotas dão bônus. Gaste quando a vida apertar ou quando subir de nível.')}
    ${step(7, 'Suba de nível', 'Comprar XP (<kbd>F</kbd>) aumenta o limite do tabuleiro e melhora as chances de robôs caros na loja. Robôs de 4 e 5 custo vencem jogos.')}
    ${step(8, 'Aprimoramentos e arsenal', 'Em 2-1, 3-2 e 4-2 você escolhe um <b>aprimoramento</b> permanente. Na rodada 4 de cada estágio tem o <b>carrossel</b> 🎠 (clique no chão para andar com a sua Fumacinha e pegue um robô com item — quem tem menos vida escolhe primeiro) e na rodada 5 o <b>arsenal</b> 🎁 com um item de graça. Clique direito num robô abre o painel de detalhes. A <b>Colher de Pau</b> 🥄 vira Emblema (sinergia extra) e no começo de cada partida todo mundo vota num <b>portal</b> 🌀 com uma regra especial.')}
  </div>
  <div class="gd-keys"><h4>Atalhos</h4>
    <span><kbd>1</kbd>–<kbd>5</kbd> comprar</span><span><kbd>D</kbd> rolar loja</span><span><kbd>F</kbd> comprar XP</span>
    <span><kbd>E</kbd> vender robô sob o mouse</span><span><kbd>Q</kbd> espiar próximo jogador</span><span><kbd>Tab</kbd> sinergias / dano</span>
    <span><kbd>H</kbd> este guia</span><span><kbd>Enter</kbd> chat</span><span><kbd>Esc</kbd> voltar</span>
  </div>
  <button id="gdResetTips" class="btn small">💡 Rever as dicas de primeira partida</button>`;
}

function sinergias() {
  const list = Object.values(TRAITS).sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'origem' ? -1 : 1));
  return `<p class="gd-hint">Passe o mouse para ver detalhes · clique para ver os robôs da sinergia.</p><div class="gd-traits">${list.map((t) => {
    const units = shop.filter((u) => u.traits.includes(t.id)).sort((a, b) => a.cost - b.cost);
    return `<div class="gd-trait" style="--tc:${t.color}" data-filter-trait="${t.id}">
      <div class="gd-trait-head">${traitImg(t.id, t.color, 'ti big')}<div><b>${esc(t.name)}</b><small>${t.kind} · ${t.style === 'vertical' ? 'vertical' : 'horizontal'} · ${t.breakpoints.join(' › ')}</small></div></div>
      <p>${esc(traitText(t))}</p>
      <div class="gd-trait-units">${units.map((u) => `<img src="${robotPortrait(u.id, u.look)}" style="--cc:${COST_COLORS[u.cost]}" data-tip="u:${u.id}" alt="">`).join('')}</div>
    </div>`;
  }).join('')}</div>`;
}

function robos() {
  const list = shop
    .filter((u) => (!unitFilter.cost || u.cost === unitFilter.cost) && (!unitFilter.trait || u.traits.includes(unitFilter.trait)))
    .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
  const costBtns = [0, 1, 2, 3, 4, 5].map((c) => `<button data-filter-cost="${c}" class="${unitFilter.cost === c ? 'on' : ''}" style="--cc:${COST_COLORS[c] ?? '#fff'}">${c ? `${c}💰` : 'Todos'}</button>`).join('');
  const tr = unitFilter.trait ? TRAITS[unitFilter.trait] : null;
  return `<div class="gd-filters">${costBtns}${tr ? `<button data-filter-trait="" class="on gd-trait-chip" style="--cc:${tr.color}">${traitImg(tr.id, tr.color)} ${esc(tr.name)} ✖</button>` : ''}</div>
  <div class="gd-units">${list.map((u) => {
    const role = ROLES[u.role];
    return `<div class="gd-unit" style="--cc:${COST_COLORS[u.cost]}" data-tip="u:${u.id}">
      <img src="${robotPortrait(u.id, u.look)}" alt="">
      <div class="gd-unit-info"><b>${esc(u.name)}</b>
        <small style="color:${role.color}">${roleImg(u.role, role.color)} ${role.name}</small>
        <div class="gd-unit-traits">${u.traits.map((t) => `<span style="color:${TRAITS[t].color}">${traitImg(t, TRAITS[t].color)}${esc(TRAITS[t].name)}</span>`).join('')}</div>
        <i>${esc(u.ability.name)}</i>
      </div><span class="gd-cost">${u.cost}</span>
    </div>`;
  }).join('') || '<p class="gd-hint">Nenhum robô com esse filtro.</p>'}</div>`;
}

function itens() {
  const head = `<tr><th></th>${COMPONENTS.map((c) => `<th data-tip="i:${c}">${itemImg(c)}</th>`).join('')}</tr>`;
  const rows = COMPONENTS.map((a) => `<tr><th data-tip="i:${a}">${itemImg(a)}</th>${COMPONENTS.map((b) => {
    const id = combine(a, b)!;
    return `<td data-tip="i:${id}">${itemImg(id)}</td>`;
  }).join('')}</tr>`).join('');
  const comps = COMPONENTS.map((c) => `<span data-tip="i:${c}">${itemImg(c)} <b>${esc(ITEMS[c].name)}</b> <small>${esc(ITEMS[c].desc)}</small></span>`).join('');
  return `<p class="gd-hint">Linha + coluna = item completo. Passe o mouse para ver o que cada um faz.</p>
    <div class="gd-items"><table class="gd-recipes">${head}${rows}</table><div class="gd-comps"><h4>Componentes</h4>${comps}</div></div>`;
}

function aprimoramentos() {
  const tiers: AugTier[] = ['prata', 'ouro', 'prisma'];
  const generic = Object.values(AUGMENTS).filter((a) => !a.trait);
  return tiers.map((tier) => `<h4 class="gd-tier" style="color:${TIER_COLOR[tier]}">${TIER_NAME[tier]}</h4><div class="gd-augs">${generic.filter((a) => a.tier === tier).map((a) =>
    `<div class="gd-aug" data-tip="a:${a.id}"><img src="${augIcon(a.id, { tier: a.tier })}" alt=""><div><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div></div>`).join('')}</div>`).join('') +
    '<p class="gd-hint">Também existem <b>Corações</b> (prata, +1 numa sinergia) e <b>Coroas</b> (ouro, +2) — aparecem para as sinergias que você já tem.</p>';
}
