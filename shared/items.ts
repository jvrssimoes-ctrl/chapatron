import type { ItemDef, ItemStats, TraitId } from './types';

// ======================= COMPONENTES =======================
// 8 componentes básicos. Dois componentes juntos = 1 item completo (36 combinações).

export const ITEMS: Record<string, ItemDef> = {};

function comp(id: string, name: string, icon: string, stats: ItemStats, desc: string) {
  ITEMS[id] = { id, name, icon, component: true, stats, desc };
}

comp('isqueiro', 'Isqueiro', '🔥', { ad: 10 }, '+10% Dano de Ataque');
comp('seda', 'Seda Turbo', '📜', { as: 10 }, '+10% Velocidade de Ataque');
comp('cachimbo', 'Cachimbo', '🚬', { ap: 10 }, '+10 Poder de Habilidade');
comp('colirio', 'Colírio', '💧', { mana: 15 }, '+15 Mana inicial');
comp('lataria', 'Lataria', '🥫', { armor: 20 }, '+20 Armadura');
comp('aluminio', 'Papel Alumínio', '🥈', { mr: 20 }, '+20 Resistência Mágica');
comp('pochete', 'Pochete', '🎒', { hp: 150 }, '+150 Vida');
comp('luvas', 'Luvas de Lã', '🧤', { crit: 20 }, '+20% Chance de Crítico');

export const COMPONENTS = ['isqueiro', 'seda', 'cachimbo', 'colirio', 'lataria', 'aluminio', 'pochete', 'luvas'];
// componente raro: vira Emblema (não entra nos sorteios comuns de componente)
comp('colher', 'Colher de Pau', '🥄', {}, 'Componente raro. Combine com outro componente para criar um Emblema (dá uma sinergia extra). Duas colheres = Chapéu de Mestre-Cuca.');
/** todos os componentes, incluindo a Colher de Pau (tabelas de receita) */
export const ALL_COMPONENTS = [...COMPONENTS, 'colher'];

// ======================= ITENS COMPLETOS =======================

function full(id: string, a: string, b: string, name: string, icon: string, desc: string, extra: ItemStats = {}) {
  const stats: ItemStats = {};
  for (const src of [ITEMS[a].stats, ITEMS[b].stats, extra]) {
    for (const [k, v] of Object.entries(src) as [keyof ItemStats, number][]) stats[k] = (stats[k] ?? 0) + v;
  }
  ITEMS[id] = { id, name, icon, component: false, recipe: [a, b], stats, desc };
}

// isqueiro
full('lancachamas', 'isqueiro', 'isqueiro', 'Lança-Chamas', '🧨', 'Causa +20% de dano.');
full('bazuca', 'isqueiro', 'seda', 'Bazuca de Pipoca', '🍿', 'Causa +25% de dano a alvos com mais de 1600 de vida máxima.');
full('isqueiroplasma', 'isqueiro', 'cachimbo', 'Isqueiro de Plasma', '🔫', 'Ganha 20% de omnivampirismo (cura 20% de todo dano causado).');
full('cristal', 'isqueiro', 'colirio', 'Cristal Lunar', '🔮', 'Ataques concedem +5 de mana extra.');
full('tampa', 'isqueiro', 'lataria', 'Tampa de Panela', '🍳', 'Ao cair para 60% de vida: escudo de 25% da vida máxima e +20% de velocidade de ataque.');
full('facaeletrica', 'isqueiro', 'aluminio', 'Faca Elétrica', '🔪', '12% de omnivampirismo. Ao cair para 40% de vida, ganha escudo de 25% da vida máxima.');
full('pocheteraivosa', 'isqueiro', 'pochete', 'Pochete Raivosa', '😤', 'Abaixo de 60% de vida, ganha +40% de Dano de Ataque.');
full('tesoura', 'isqueiro', 'luvas', 'Tesoura de Ouro', '✂️', 'Habilidades podem dar crítico. +15% de dano crítico.');
// seda
full('megaseda', 'seda', 'seda', 'Mega Seda', '🌪️', 'Cada ataque concede +5% de velocidade de ataque (acumula).');
full('turbo', 'seda', 'cachimbo', 'Turbinador', '🚀', 'Após usar a habilidade, ganha +60% de velocidade de ataque por 5s.');
full('tocha', 'seda', 'colirio', 'Tocha Estática', '🌩️', 'A cada 3 ataques, um raio atinge 3 inimigos causando 70 de dano mágico e reduzindo 30% da RM deles.');
full('coleteseda', 'seda', 'lataria', 'Colete de Seda', '🦺', 'Cada ataque concede +2% de Dano de Ataque e Poder de Habilidade (até +25%).');
full('rede', 'seda', 'aluminio', 'Rede de Pesca', '🕸️', 'Ataques acertam um inimigo extra próximo com 55% do dano.');
full('caixadesom', 'seda', 'pochete', 'Caixa de Som', '🔊', 'Aliados na mesma linha ganham +15% de velocidade de ataque.');
full('mira', 'seda', 'luvas', 'Mira a Laser', '🔦', 'Ataques reduzem 30% da armadura do alvo por 3s.');
// cachimbo
full('cachimbogig', 'cachimbo', 'cachimbo', 'Cachimbo Gigante', '🌋', '+30 de Poder de Habilidade extra.', { ap: 30 });
full('garrafa', 'cachimbo', 'colirio', 'Garrafa da Brisa', '🍾', 'A cada 5s, ganha +20 de Poder de Habilidade.');
full('escudocosmico', 'cachimbo', 'lataria', 'Escudo Cósmico', '🪐', 'Começa com escudo de 30% da vida máxima por 8s. Quando acaba, ganha +30 de Poder de Habilidade.');
full('ionizador', 'cachimbo', 'aluminio', 'Ionizador', '🧲', 'Inimigos a até 2 hexes têm a RM reduzida em 30%.');
full('morteiro', 'cachimbo', 'pochete', 'Morteiro de Brasa', '☄️', 'Dano queima o alvo em 10% da vida máxima dele ao longo de 5s e reduz 33% das curas recebidas.');
full('luvaarcana', 'cachimbo', 'luvas', 'Luva Arcana', '💎', 'Habilidades podem dar crítico. +15% de chance de crítico.', { crit: 15 });
// colírio
full('coroa', 'colirio', 'colirio', 'Coroa do Rei da Brisa', '👑', 'Mana máxima -10. Após usar a habilidade, recupera 10 de mana.');
full('manto', 'colirio', 'lataria', 'Manto Congelante', '❄️', 'Inimigos a até 2 hexes atacam 20% mais devagar.');
full('radio', 'colirio', 'aluminio', 'Rádio Comunitário', '📻', 'A cada 5s, cura todos os aliados em 12% da vida que falta.');
full('mochila', 'colirio', 'pochete', 'Mochila de Lanche', '🥪', 'A cada 2s, cura 5% da vida que falta.');
full('maodestino', 'colirio', 'luvas', 'Mão do Destino', '🖐️', '+15% de dano e 15% de omnivampirismo.');
// lataria
full('caixadagua', 'lataria', 'lataria', "Caixa d'Água", '🛢️', 'Recebe 8% menos dano de ataques. Ao ser atingido, causa 80 de dano mágico a inimigos adjacentes (2s de recarga).');
full('cadeado', 'lataria', 'aluminio', 'Cadeado Velho', '🗝️', 'Ganha +12 de armadura e RM para cada inimigo mirando nele.');
full('parachoque', 'lataria', 'pochete', 'Para-Choque', '🚗', 'A cada 2s, queima inimigos adjacentes em 60 de dano mágico e reduz 33% das curas deles.');
full('coracao', 'lataria', 'luvas', 'Coração de Lata', '💗', 'Recebe 15% menos dano (25% acima de 50% de vida).');
// alumínio
full('chapeu', 'aluminio', 'aluminio', 'Chapéu de Alumínio', '🎩', 'A cada 2s, cura 5% da vida máxima.');
full('abafador', 'aluminio', 'pochete', 'Abafador', '🌫️', 'Inimigos a até 2 hexes têm a armadura reduzida em 30%.');
full('tenis', 'aluminio', 'luvas', 'Tênis de Mola', '👟', 'Imune a atordoamento nos primeiros 15s. A cada 2s ganha +3% de velocidade de ataque.');
// pochete
full('marmita', 'pochete', 'pochete', 'Marmita Gigante', '🍱', '+12% de vida máxima.');
full('maleta', 'pochete', 'luvas', 'Maleta de Ferramentas', '🧰', 'Causa +20% de dano a alvos com escudo.');
// luvas
full('maoleve', 'luvas', 'luvas', 'Mão Leve', '🎁', 'Ocupa os 3 espaços. A cada combate, equipa 2 itens completos aleatórios.');

export const COMPLETED = Object.values(ITEMS).filter((i) => !i.component && !i.special).map((i) => i.id);

// ======================= EMBLEMAS (Colher de Pau + componente) =======================

function emblem(id: string, comp: string, trait: TraitId, traitName: string, icon: string) {
  ITEMS[id] = {
    id, name: `Emblema ${traitName}`, icon, component: false, recipe: ['colher', comp], emblem: trait,
    stats: { ...ITEMS[comp].stats },
    desc: `O portador ganha a sinergia ${traitName}. Não pode ir num robô que já é ${traitName}.`,
  };
}
emblem('emb_fumaceiro', 'isqueiro', 'fumaceiro', 'Fumaceiro', '💨');
emblem('emb_atirador', 'seda', 'atirador', 'Atirador', '🎯');
emblem('emb_brisa', 'cachimbo', 'brisa', 'Brisado', '🌀');
emblem('emb_cosmico', 'colirio', 'cosmico', 'Cósmico', '🌌');
emblem('emb_ferrugem', 'lataria', 'ferrugem', 'Enferrujado', '⚙️');
emblem('emb_verdinho', 'aluminio', 'verdinho', 'Verdinho', '🌿');
emblem('emb_tanque', 'pochete', 'tanque', 'Bolado', '🛡️');
emblem('emb_larica', 'luvas', 'larica', 'Laricado', '🍩');
ITEMS.chapeucuca = {
  id: 'chapeucuca', name: 'Chapéu de Mestre-Cuca', icon: '👨‍🍳', component: false, recipe: ['colher', 'colher'], stats: {},
  desc: 'Equipado num robô em campo: +1 robô no tabuleiro.',
};

export const EMBLEMS = Object.values(ITEMS).filter((i) => i.emblem).map((i) => i.id);
export const isEmblem = (id: string) => !!ITEMS[id]?.emblem;

/** Pode equipar este emblema? (não pode já ter a sinergia nem repetir) */
export function emblemAllowed(unitTraits: TraitId[], items: string[], emblemId: string) {
  const t = ITEMS[emblemId]?.emblem;
  if (!t) return true;
  return !unitTraits.includes(t) && !items.some((i) => ITEMS[i]?.emblem === t);
}

/** Limite de robôs no tabuleiro (nível + Chapéu de Mestre-Cuca em campo). */
export function boardCap(level: number, units: { items: string[]; loc: { zone: string } }[], augments: string[] = []) {
  return level + (units.some((u) => u.loc.zone === 'board' && u.items.includes('chapeucuca')) ? 1 : 0) + (augments.includes('exercito') ? 1 : 0);
}

// ======================= ITENS ESPECIAIS (consumíveis) =======================

function special(id: string, name: string, icon: string, desc: string) {
  ITEMS[id] = { id, name, icon, component: false, special: true, stats: {}, desc };
}
special('pedecabra', 'Pé de Cabra', '🔧', 'Arraste até um robô: arranca todos os itens dele e devolve para o banco de itens.');
special('reforjador', 'Reforjador da Quebrada', '🔨', 'Arraste até um robô: troca os itens dele por outros aleatórios do mesmo tipo (componente por componente, completo por completo).');
special('xerox', 'Xerox Clandestino', '📠', 'Arraste até um robô de custo 1 a 4: cria uma cópia ★ dele no banco.');

special('forja', 'Forja Radiante', '🌟', 'Arraste até um robô: transforma o primeiro item completo dele na versão Radiante (atributos dobrados e bônus extra).');

// bigornas: saem dos orbes de saque; clique (ou arraste num robô) para escolher o item
special('bigorna', 'Bigorna de Componente', '⚒️', 'Clique (ou arraste até um robô): abre a bigorna e você escolhe 1 entre 4 componentes.');
special('bigornaouro', 'Bigorna Dourada', '🛠️', 'Clique (ou arraste até um robô): abre a bigorna e você escolhe 1 entre 4 itens completos.');
export const ANVILS = ['bigorna', 'bigornaouro'];
export const isAnvil = (id: string) => ANVILS.includes(id);
export const SPECIALS = ['pedecabra', 'reforjador', 'xerox'];
export const isSpecial = (id: string) => !!ITEMS[id]?.special;

// ======================= RADIANTES (itens completos turbinados) =======================
/** bônus fixo de todo item Radiante, além dos atributos dobrados */
export const RADIANT_BONUS = { dmg: 0.2, hp: 200 };

export const RADIANTS: string[] = [];
for (const id of COMPLETED) {
  if (id === 'maoleve') continue;
  const base = ITEMS[id];
  const stats: ItemStats = {};
  for (const [k, v] of Object.entries(base.stats) as [keyof ItemStats, number][]) stats[k] = v * 2;
  const rid = `r_${id}`;
  ITEMS[rid] = {
    id: rid, name: `${base.name} Radiante`, icon: base.icon, component: false, radiant: id, stats,
    desc: `${base.desc} RADIANTE: atributos dobrados, +20% de dano e +200 de vida.`,
  };
  RADIANTS.push(rid);
}
export const isRadiant = (id: string) => !!ITEMS[id]?.radiant;
/** Id do item "de verdade" para efeitos (Radiante conta como o item base). */
export const baseItem = (id: string) => ITEMS[id]?.radiant ?? id;

// ======================= ARTEFATOS (únicos, sem receita) =======================

function artifact(id: string, name: string, icon: string, stats: ItemStats, desc: string) {
  ITEMS[id] = { id, name, icon, component: false, artifact: true, stats, desc };
}
artifact('machado', 'Machado do Lenhador', '🪓', { ad: 35, as: 15 }, 'Ataques causam dano verdadeiro extra igual a 4% da vida máxima do alvo.');
artifact('cajado', 'Cajado Infinito', '🪄', { ap: 40, mana: 15 }, 'Cada vez que usa a habilidade, ganha +12 de Poder de Habilidade (acumula).');
artifact('armadurazen', 'Armadura Zen', '🧘', { hp: 300, armor: 30, mr: 30 }, 'Fica invulnerável nos primeiros 2,5s do combate.');
artifact('relogio', 'Relógio Parado', '⏱️', { as: 15, hp: 150 }, 'Uma vez por combate, ao cair para 30% de vida: fica invulnerável por 2s e cura 35% da vida máxima.');
artifact('chinelo', 'Chinelo da Vó', '🩴', { ad: 25, as: 20 }, 'A cada 4 ataques, atordoa o alvo por 1s.');
artifact('terceiroolho', 'Terceiro Olho', '👁️', { ap: 20, crit: 25 }, 'Habilidades podem dar crítico e o dano crítico aumenta em 30%.');
artifact('discovoador', 'Disco Voador de Bolso', '🛸', { hp: 200, ad: 20 }, 'No início do combate, salta para a retaguarda inimiga e ganha escudo de 25% da vida máxima por 4s.');
artifact('cogumelodourado', 'Cogumelo Dourado', '🍄', { hp: 250, ap: 20 }, 'A cada 3s, cura todos os aliados em 4% da vida máxima deles.');

export const ARTIFACTS = Object.values(ITEMS).filter((i) => i.artifact).map((i) => i.id);
export const isArtifact = (id: string) => !!ITEMS[id]?.artifact;

const RECIPES = new Map<string, string>();
for (const it of Object.values(ITEMS)) {
  if (it.recipe) {
    RECIPES.set(`${it.recipe[0]}+${it.recipe[1]}`, it.id);
    RECIPES.set(`${it.recipe[1]}+${it.recipe[0]}`, it.id);
  }
}

export function combine(a: string, b: string): string | null {
  return RECIPES.get(`${a}+${b}`) ?? null;
}

export function isComponent(id: string) {
  return !!ITEMS[id]?.component;
}

/** Quantos espaços um conjunto de itens ocupa (Mão Leve ocupa 3). */
export function itemSlots(items: string[]) {
  return items.reduce((n, i) => n + (i === 'maoleve' ? 3 : 1), 0);
}

const STAT_LABEL: Record<keyof ItemStats, [string, string]> = {
  ad: ['% DA', '🔥'],
  as: ['% VA', '📜'],
  ap: [' PH', '🚬'],
  mana: [' Mana', '💧'],
  armor: [' Armadura', '🥫'],
  mr: [' RM', '🥈'],
  hp: [' Vida', '🎒'],
  crit: ['% Crítico', '🧤'],
};

export function statsText(s: ItemStats) {
  return (Object.entries(s) as [keyof ItemStats, number][])
    .map(([k, v]) => `+${v}${STAT_LABEL[k][0]}`)
    .join(' · ');
}
