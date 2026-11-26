import { COST_COLORS, ROLES, SHOP_UNITS, TRAITS, traitText } from '../../shared/data';
import { robotPortrait } from './three/portrait';
import { roleImg, traitImg } from './emblems';

// Página de catálogo (só para gerar o PDF com todos os robôs): /catalogo.html

const NEW = new Set(['gosminha', 'faisca', 'espadinha', 'tentaculo', 'pilhudo', 'esgrimabot', 'mutantao', 'raioze', 'mosqueteira', 'hidra', 'tesla', 'reimutante', 'maegosma']);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

function card(id: string) {
  const d = SHOP_UNITS.find((u) => u.id === id)!;
  const r = ROLES[d.role];
  return `<div class="card" style="--cc:${COST_COLORS[d.cost]};--rc:${r.color}">
    <img class="pt" src="${robotPortrait(d.id, d.look)}" alt="">
    ${NEW.has(d.id) ? '<span class="new">NOVO</span>' : ''}<span class="cost">${d.cost}💰</span>
    <div class="info">
      <div class="name">${esc(d.name)}</div>
      <div class="role">${roleImg(d.role, r.color)} ${esc(r.name)}</div>
      <div class="traits">${d.traits.map((t) => `<span style="--tc:${TRAITS[t].color}">${traitImg(t, TRAITS[t].color)}${esc(TRAITS[t].name)}</span>`).join('')}</div>
      <div class="ab">✦ ${esc(d.ability.name)}</div>
    </div></div>`;
}

function build() {
  const byCost = [1, 2, 3, 4, 5].map((c) => SHOP_UNITS.filter((u) => u.cost === c).sort((a, b) => Number(NEW.has(b.id)) - Number(NEW.has(a.id)) || a.name.localeCompare(b.name)));
  const roleLegend = (Object.keys(ROLES) as (keyof typeof ROLES)[]).map((k) => `<span style="color:${ROLES[k].color}">${roleImg(k, ROLES[k].color)} ${esc(ROLES[k].name)}</span>`).join('');
  const nt = (['mutante', 'eletrico', 'duelista'] as const).map((t) => {
    const T = TRAITS[t];
    return `<div class="nt" style="--c:${T.color}"><b>${traitImg(t, T.color)} ${esc(T.name)}</b><small>${esc(traitText(T))}</small><em>${T.breakpoints.join(' / ')} robôs</em></div>`;
  }).join('');
  document.getElementById('root')!.innerHTML = `
    <div class="cover"><h1>🌿 CHAPATRON</h1><p>Catálogo de Robôs · ${SHOP_UNITS.length} robôs · expansão Laboratório Clandestino</p></div>
    <div class="legend">${roleLegend}</div>
    <div class="newtraits">${nt}</div>
    ${byCost.map((list, i) => `<h2 style="--cc:${COST_COLORS[i + 1]}">Custo ${i + 1} · ${list.length} robôs</h2><div class="grid">${list.map((d) => card(d.id)).join('')}</div>`).join('')}`;
  document.getElementById('status')!.textContent = 'pronto';
  document.body.dataset.ready = '1';
}

document.fonts.ready.then(() => setTimeout(build, 50));
