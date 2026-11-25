import type { AbilityDef, RobotLook, Role, TraitDef, TraitId, UnitDef } from './types';

// ======================= SINERGIAS =======================
// VERTICAIS: muitas unidades, 3 níveis (2/4/6) — ficam absurdas quando você fecha tudo.
// HORIZONTAIS: poucas unidades, 1-2 níveis — bônus rápidos pra misturar com outras.

export const TRAITS: Record<TraitId, TraitDef> = {
  // ---------- origens (verticais) ----------
  verdinho: {
    id: 'verdinho', name: 'Verdinhos', kind: 'origem', style: 'vertical', color: '#5dff7a', icon: '🌿',
    breakpoints: [2, 4, 6], values: [2, 4, 8], scope: 'holders',
    desc: 'Robôs hidropônicos. Regeneram {v}% da vida máxima por segundo.',
  },
  fumaceiro: {
    id: 'fumaceiro', name: 'Fumaceiros', kind: 'origem', style: 'vertical', color: '#b9b3d6', icon: '💨',
    breakpoints: [2, 4, 6], values: [15, 30, 50], scope: 'holders',
    desc: 'Vivem dentro da própria nuvem. {v}% de chance de esquivar de ataques.',
  },
  larica: {
    id: 'larica', name: 'Laricados', kind: 'origem', style: 'vertical', color: '#ffb347', icon: '🍕',
    breakpoints: [2, 4, 6], values: [25, 40, 70], extra: [15, 25, 40], scope: 'holders',
    desc: 'Ao abater um inimigo, curam {v}% da vida máxima e ganham +{x}% de velocidade de ataque (acumula).',
  },
  ferrugem: {
    id: 'ferrugem', name: 'Enferrujados', kind: 'origem', style: 'vertical', color: '#c8794a', icon: '🔩',
    breakpoints: [2, 4, 6], values: [12, 30, 60], scope: 'team',
    desc: 'Lataria velha e resistente. TODO o time ganha +{v} de armadura e resistência mágica.',
  },
  cosmico: {
    id: 'cosmico', name: 'Cósmicos', kind: 'origem', style: 'vertical', color: '#7ad7ff', icon: '🛸',
    breakpoints: [2, 4, 6], values: [3, 7, 12], extra: [15, 35, 60], scope: 'holders',
    desc: 'Sintonizados com o universo. Ganham {v} de mana por segundo e +{x} de poder de habilidade.',
  },
  // ---------- classes verticais ----------
  tanque: {
    id: 'tanque', name: 'Bolados', kind: 'classe', style: 'vertical', color: '#ff5d73', icon: '🛡️',
    breakpoints: [2, 4, 6], values: [200, 450, 800], scope: 'holders',
    desc: 'Grandões de lata. Ganham +{v} de vida máxima.',
  },
  atirador: {
    id: 'atirador', name: 'Atiradores', kind: 'classe', style: 'vertical', color: '#ffe066', icon: '🎯',
    breakpoints: [2, 4], values: [20, 50], scope: 'holders',
    desc: 'Mira calibrada (mais ou menos). +{v}% de velocidade de ataque.',
  },
  brisa: {
    id: 'brisa', name: 'Brisados', kind: 'classe', style: 'vertical', color: '#d27aff', icon: '🌀',
    breakpoints: [2, 4], values: [25, 65], scope: 'holders',
    desc: 'Viajam longe na ideia. +{v} de poder de habilidade.',
  },
  // ---------- classes horizontais ----------
  sorrateiro: {
    id: 'sorrateiro', name: 'Sorrateiros', kind: 'classe', style: 'horizontal', color: '#9bff5d', icon: '🥷',
    breakpoints: [2, 3], values: [20, 40], scope: 'holders',
    desc: '+{v}% de chance de crítico e +{v}% de dano crítico. (Todo Assassino salta para a retaguarda no início.)',
  },
  guru: {
    id: 'guru', name: 'Gurus', kind: 'classe', style: 'horizontal', color: '#5dffe0', icon: '🧘',
    breakpoints: [2, 4], values: [120, 300], scope: 'team',
    desc: 'Paz e amor. No início do combate, TODO o time recebe um escudo de {v}.',
  },
  dj: {
    id: 'dj', name: 'DJs do Baile', kind: 'classe', style: 'horizontal', color: '#ff5d9e', icon: '🎧',
    breakpoints: [2, 4], values: [10, 25], scope: 'team',
    desc: 'O grave é contagiante. TODO o time ganha +{v}% de velocidade de ataque.',
  },
  hacker: {
    id: 'hacker', name: 'Hackers', kind: 'classe', style: 'horizontal', color: '#3dffb0', icon: '💾',
    breakpoints: [2, 3], values: [30, 60], scope: 'holders',
    desc: 'Invadem o sistema inimigo: os inimigos começam com 0 de mana e os Hackers começam com +{v} de mana.',
  },
  reciclado: {
    id: 'reciclado', name: 'Reciclados', kind: 'classe', style: 'horizontal', color: '#d9c27a', icon: '♻️',
    breakpoints: [2, 4], values: [12, 25], scope: 'holders',
    desc: 'Aproveitam as peças dos amigos. Sempre que um aliado cai, ganham +{v}% de dano (acumula).',
  },
  neon: {
    id: 'neon', name: 'Neons', kind: 'origem', style: 'horizontal', color: '#ff3df0', icon: '💡',
    breakpoints: [2, 3], values: [20, 45], extra: [10, 20], scope: 'holders',
    desc: 'Brilham na balada. Suas habilidades causam +{v}% de dano e, depois de usá-las, recuperam {x} de mana.',
  },
  paranoico: {
    id: 'paranoico', name: 'Paranoicos', kind: 'classe', style: 'horizontal', color: '#ff9d3d', icon: '👁️',
    breakpoints: [2, 4], values: [30, 70], scope: 'holders',
    desc: 'Acham que estão sendo seguidos. Ao cair abaixo de 50% de vida pela primeira vez, ficam imunes a dano por 1,5s e ganham +{v}% de velocidade de ataque.',
  },
  // ---------- expansão "Horta Proibida" (sinergias com efeitos especiais) ----------
  jardineiro: {
    id: 'jardineiro', name: 'Jardineiros', kind: 'origem', style: 'horizontal', color: '#8aff5d', icon: '🌱',
    breakpoints: [2, 4], values: [1, 2], extra: [450, 850], scope: 'team',
    desc: 'Cultivam a própria defesa. No início do combate brotam {v} Mudinha(s) na linha de frente, com {x} de vida cada.',
  },
  muambeiro: {
    id: 'muambeiro', name: 'Muambeiros', kind: 'classe', style: 'horizontal', color: '#ffd23f', icon: '💰',
    breakpoints: [2, 4], values: [35, 70], scope: 'team',
    desc: 'Sempre voltam com alguma coisa. Depois de cada combate contra jogador, {v}% de chance de trazer muamba: ouro (nível 2) ou ouro e componentes (nível 4). Ganham mais quando perdem.',
  },
  pirado: {
    id: 'pirado', name: 'Pirados', kind: 'classe', style: 'horizontal', color: '#ff6b3d', icon: '🤪',
    breakpoints: [2, 4], values: [60, 110], scope: 'holders',
    desc: 'Batem sem olhar. A cada 3 ataques, acertam também todos os inimigos em volta do alvo com {v}% do Dano de Ataque.',
  },};

export const TRAIT_LIST = Object.values(TRAITS);

// ======================= PAPÉIS (igual TFT) =======================
// Os atributos base vêm do papel + custo. Cada robô só define mana e habilidade.

export interface RoleInfo {
  name: string;
  icon: string;
  color: string;
  desc: string;
  hp: number[];
  ad: number[];
  as: number;
  range: number;
  res: number[]; // armadura e RM
}

export const ROLES: Record<Role, RoleInfo> = {
  tank: {
    name: 'Tanque', icon: '🛡️', color: '#ff7a7a', desc: 'Linha de frente. Muita vida e resistência; ganha mais mana ao apanhar.',
    hp: [650, 750, 850, 1000, 1150], ad: [50, 55, 60, 70, 80], as: 0.6, range: 1, res: [40, 45, 50, 60, 70],
  },
  fighter: {
    name: 'Lutador', icon: '🥊', color: '#ffb35d', desc: 'Corpo a corpo equilibrado: aguenta e bate.',
    hp: [600, 700, 800, 900, 1000], ad: [55, 60, 70, 80, 90], as: 0.7, range: 1, res: [35, 40, 45, 50, 60],
  },
  assassin: {
    name: 'Assassino', icon: '🗡️', color: '#b8ff5d', desc: 'Salta para a retaguarda inimiga no início do combate.',
    hp: [550, 650, 700, 800, 900], ad: [55, 65, 70, 80, 90], as: 0.75, range: 1, res: [25, 30, 35, 40, 45],
  },
  adcarry: {
    name: 'Atirador AD', icon: '🏹', color: '#ffe066', desc: 'Retaguarda. Dano físico por ataques básicos à distância.',
    hp: [500, 550, 650, 750, 850], ad: [45, 50, 55, 70, 85], as: 0.75, range: 4, res: [15, 20, 25, 30, 35],
  },
  apcaster: {
    name: 'Conjurador AP', icon: '🔮', color: '#c58bff', desc: 'Retaguarda. Dano mágico pesado pelas habilidades.',
    hp: [450, 550, 650, 750, 850], ad: [35, 40, 40, 45, 50], as: 0.7, range: 4, res: [15, 20, 25, 30, 35],
  },
  support: {
    name: 'Suporte', icon: '✚', color: '#5dffe0', desc: 'Meia distância. Cura, escuda e fortalece aliados.',
    hp: [500, 600, 700, 800, 900], ad: [35, 40, 45, 50, 55], as: 0.7, range: 3, res: [20, 25, 30, 35, 40],
  },
};

// ======================= UNIDADES =======================

export const UNITS: Record<string, UnitDef> = {};

interface UnitSpec {
  id: string;
  name: string;
  cost: number;
  role: Role;
  traits: TraitId[];
  mana: number;
  startMana: number;
  ability: Omit<AbilityDef, 'scale'> & { scale?: 'ap' | 'ad' };
  look: RobotLook;
  hp?: number;
  atk?: number;
  as?: number;
  range?: number;
  armor?: number;
  mr?: number;
  pve?: boolean;
  summon?: boolean;
}

function u(s: UnitSpec) {
  const r = ROLES[s.role];
  const i = Math.max(0, Math.min(4, s.cost - 1));
  UNITS[s.id] = {
    id: s.id, name: s.name, cost: s.cost, role: s.role, traits: s.traits,
    hp: s.hp ?? r.hp[i], atk: s.atk ?? r.ad[i], as: s.as ?? r.as, range: s.range ?? r.range,
    armor: s.armor ?? r.res[i], mr: s.mr ?? r.res[i],
    mana: s.mana, startMana: s.startMana,
    ability: { scale: 'ap', ...s.ability },
    look: s.look, pve: s.pve, summon: s.summon,
  };
}

// ---------- custo 1 ----------
u({
  id: 'bagulho', name: 'Bagulho-01', cost: 1, role: 'tank', traits: ['verdinho', 'tanque'], mana: 70, startMana: 20,
  ability: { kind: 'cascagrossa', fx: 'shield', name: 'Casca Grossa', desc: 'Ganha um escudo de {v} por 4s e provoca os inimigos adjacentes: eles só atacam o Bagulho por 2s.', values: [230, 330, 480], duration: 4000 },
  look: { color: '#3fae5a', accent: '#a8ff9e', body: 'tank', head: 'square', acc: ['leaf', 'antenna'] },
});
u({
  id: 'tragatron', name: 'Tragatron', cost: 1, role: 'adcarry', traits: ['fumaceiro', 'atirador'], mana: 60, startMana: 0,
  ability: { kind: 'baforada', fx: 'nuke', scale: 'ad', name: 'Baforada Cegante', desc: 'Sopra fumaça no alvo: {v}% do Dano de Ataque e o deixa cego por 2,5s (os ataques dele erram).', values: [210, 220, 240], color: '#b9b3d6' },
  look: { color: '#8a83b5', accent: '#e6e0ff', body: 'tall', head: 'tv', acc: ['joint', 'smoke'] },
});
u({
  id: 'larikinho', name: 'Larikinho', cost: 1, role: 'fighter', traits: ['larica', 'tanque'], mana: 80, startMana: 20,
  ability: { kind: 'mordida', fx: 'drain', name: 'Mordida Faminta', desc: 'Morde o alvo: {v} de dano mágico e cura o mesmo valor. Se abater, ganha +{x}% de Dano de Ataque até o fim do combate.', values: [220, 330, 500], values2: [15, 20, 30] },
  look: { color: '#e08a2e', accent: '#ffe0a8', body: 'round', head: 'dome', acc: ['headphones'] },
});
u({
  id: 'sedabot', name: 'Seda-Bot', cost: 1, role: 'support', traits: ['ferrugem', 'guru'], mana: 70, startMana: 20,
  ability: { kind: 'bolinhapaz', fx: 'heal', name: 'Bolinha da Paz', desc: 'Cura o aliado com menos vida em {v}, tira atordoamentos e dá +{x} de armadura e RM por 4s.', values: [220, 330, 500], values2: [20, 30, 50] },
  look: { color: '#c8794a', accent: '#fff4dd', body: 'box', head: 'square', acc: ['halo', 'antenna'] },
});
u({
  id: 'pipoca', name: 'Pipoca', cost: 1, role: 'adcarry', traits: ['larica', 'atirador'], mana: 50, startMana: 0,
  ability: { kind: 'estouro', fx: 'buffAS', scale: 'ad', name: 'Estouro de Milho', desc: 'Ganha +50% de vel. de ataque e os próximos 4 ataques estouram: {v}% do Dano de Ataque nos inimigos em volta do alvo.', values: [55, 60, 70] },
  look: { color: '#f2c84b', accent: '#fff8d6', body: 'round', head: 'tv', acc: ['shades'] },
});
u({
  id: 'bituca', name: 'Bituca', cost: 1, role: 'assassin', traits: ['ferrugem', 'sorrateiro'], mana: 50, startMana: 0,
  ability: { kind: 'brasa', fx: 'nuke', scale: 'ad', name: 'Brasa na Cara', desc: 'Queima o alvo: {v}% do Dano de Ataque e deixa em chamas por 4s (2% da vida máx. por segundo como dano verdadeiro e −33% de cura).', values: [250, 260, 280], color: '#ff6b3d' },
  look: { color: '#7a6a5c', accent: '#ff6b3d', body: 'tall', head: 'square', acc: ['joint', 'visor'] },
});
u({
  id: 'satelitinho', name: 'Satelitinho', cost: 1, role: 'apcaster', traits: ['cosmico', 'hacker'], mana: 60, startMana: 10,
  ability: { kind: 'sinaltravado', fx: 'stun', name: 'Sinal Travado', desc: 'Trava o alvo: {v} de dano mágico e atordoa por 1,2s. O sinal ricocheteia para outro inimigo (metade do dano e do atordoamento).', values: [220, 330, 500], color: '#7ad7ff' },
  look: { color: '#9fb4d8', accent: '#7ad7ff', body: 'round', head: 'dome', acc: ['antenna', 'visor'] },
});
u({
  id: 'vigia', name: 'Vigia Noiado', cost: 1, role: 'fighter', traits: ['cosmico', 'paranoico'], mana: 70, startMana: 20,
  ability: { kind: 'olhogordo', fx: 'stun', name: 'Olho Gordo', desc: 'Põe olho gordo no alvo: {v} de dano mágico e ele recebe +{x}% de dano de todas as fontes por 4s.', values: [180, 270, 400], values2: [20, 20, 25], color: '#ff9d3d' },
  look: { color: '#4a5a8a', accent: '#ff9d3d', body: 'box', head: 'tv', acc: ['visor', 'antenna'] },
});
u({
  id: 'cupim', name: 'Cupinzeiro', cost: 1, role: 'tank', traits: ['ferrugem', 'jardineiro'], mana: 80, startMana: 30,
  ability: { kind: 'cupinzeiro', fx: 'aoeStun', name: 'Túnel Surpresa', desc: 'Se enterra e surge embaixo do alvo: {v} de dano mágico nele e nos adjacentes, que são arremessados (atordoa 1s).', values: [180, 270, 400], color: '#c8a04a' },
  look: { color: '#8a6a3a', accent: '#5dff7a', body: 'tank', head: 'mushroom', acc: ['antenna'] },
});
u({
  id: 'chicleteiro', name: 'Chicleteiro', cost: 1, role: 'adcarry', traits: ['muambeiro', 'atirador'], mana: 50, startMana: 0,
  ability: { kind: 'chiclete', fx: 'nuke', scale: 'ad', name: 'Cuspe de Chiclete', desc: 'Cospe chiclete no alvo: {v}% do Dano de Ataque e ele fica grudado (−40% de vel. de ataque) por 3s.', values: [220, 230, 250], color: '#ff7ad9' },
  look: { color: '#ff8fc8', accent: '#ffffff', body: 'round', head: 'tv', acc: ['beanie', 'shades'] },
});
u({
  id: 'foguinho', name: 'Foguinho', cost: 1, role: 'apcaster', traits: ['pirado', 'brisa'], mana: 60, startMana: 20,
  ability: { kind: 'fogueira', fx: 'aoe', name: 'Fogueira do Luau', desc: 'Acende uma fogueira no alvo por 3s: {v} de dano mágico no total em quem ficar em raio 1.', values: [330, 500, 750], radius: 1, color: '#ff8a3d' },
  look: { color: '#d8452e', accent: '#ffd23f', body: 'tall', head: 'dome', acc: ['mohawk', 'smoke'] },
});

// ---------- custo 2 ----------
u({
  id: 'dichavador', name: 'Dichavador', cost: 2, role: 'tank', traits: ['ferrugem', 'tanque', 'reciclado'], mana: 90, startMana: 30,
  ability: { kind: 'moedor', fx: 'aoeStun', name: 'Moedor Rotativo', desc: 'Gira por 2s: {v} de dano mágico no total nos inimigos adjacentes, que ficam lentos (−30% de vel. de ataque).', values: [320, 480, 720], color: '#c9d2dc' },
  look: { color: '#9aa3ad', accent: '#5dff7a', body: 'wide', head: 'none', acc: ['antenna', 'mohawk'] },
});
u({
  id: 'bong9000', name: 'Bong-9000', cost: 2, role: 'apcaster', traits: ['fumaceiro', 'brisa'], mana: 80, startMana: 30,
  ability: { kind: 'nuvemdensa', fx: 'aoe', name: 'Nuvem Densa', desc: 'Solta uma nuvem no alvo por 3s: quem estiver dentro (raio 1) sofre {v} de dano mágico no total e fica lento.', values: [420, 630, 950], radius: 1 },
  look: { color: '#5aa0c8', accent: '#bdf2ff', body: 'tall', head: 'dome', acc: ['bong', 'smoke'] },
});
u({
  id: 'cogumelox', name: 'Cogumelo-X', cost: 2, role: 'apcaster', traits: ['verdinho', 'brisa'], mana: 70, startMana: 20,
  ability: { kind: 'esporos', fx: 'stun', name: 'Esporos Lisérgicos', desc: 'Atira um esporo: {v} de dano mágico e atordoa o alvo por 1,5s. Os esporos se espalham nos vizinhos ({x}% do dano, atordoa 0,75s).', values: [280, 420, 650], values2: [50, 50, 60], color: '#ff5d73' },
  look: { color: '#d94f4f', accent: '#fff1f1', body: 'round', head: 'mushroom', acc: ['smoke'] },
});
u({
  id: 'brownie', name: 'Brownie MK2', cost: 2, role: 'support', traits: ['larica', 'guru'], mana: 80, startMana: 30,
  ability: { kind: 'fornada', fx: 'heal', name: 'Fornada Especial', desc: 'Entrega um brownie ao aliado mais ferido curando {v}. O que passar da vida máxima vira escudo.', values: [340, 480, 720] },
  look: { color: '#6b4226', accent: '#ffd28a', body: 'box', head: 'dome', acc: ['halo'] },
});
u({
  id: 'fumaninja', name: 'Fumaça Ninja', cost: 2, role: 'assassin', traits: ['fumaceiro', 'sorrateiro'], mana: 60, startMana: 10,
  ability: { kind: 'golpenebuloso', fx: 'nuke', scale: 'ad', name: 'Golpe Nebuloso', desc: 'Some na fumaça (inalvejável por 1s) e reaparece atrás do inimigo com menos vida: {v}% do Dano de Ataque.', values: [300, 310, 330], color: '#c9c2ff' },
  look: { color: '#3c3a52', accent: '#c9c2ff', body: 'tall', head: 'dome', acc: ['visor', 'smoke', 'cape'] },
});
u({
  id: 'djchapadao', name: 'DJ Chapadão', cost: 2, role: 'support', traits: ['cosmico', 'dj'], mana: 80, startMana: 30,
  ability: { kind: 'grave', fx: 'teamAS', name: 'Aumenta o Grave', desc: 'Solta o beat: aliados ganham +{v}% de vel. de ataque por 4s. Quem estiver a até 2 hexes dele ganha o dobro.', values: [20, 25, 40], duration: 4000 },
  look: { color: '#ff5d9e', accent: '#5dffe0', body: 'box', head: 'tv', acc: ['headphones', 'shades'] },
});
u({
  id: 'sucatinha', name: 'Sucatinha', cost: 2, role: 'adcarry', traits: ['ferrugem', 'reciclado'], mana: 70, startMana: 10,
  ability: { kind: 'parafuso', fx: 'multishot', scale: 'ad', name: 'Chuva de Parafuso', desc: 'Arremessa parafusos nos 3 inimigos com menos vida: {v}% do Dano de Ataque cada e −30% de armadura por 4s.', values: [140, 150, 160], count: 3, color: '#ffb347' },
  look: { color: '#8a6d4e', accent: '#ffb347', body: 'box', head: 'square', acc: ['antenna', 'mohawk'] },
});
u({
  id: 'glowbot', name: 'Glow-Bot', cost: 2, role: 'apcaster', traits: ['neon', 'dj'], mana: 60, startMana: 20,
  ability: { kind: 'pulsoneon', fx: 'aoe', name: 'Pulso de Luz Negra', desc: 'Pisca o estrobo: {v} de dano mágico no alvo e nos vizinhos, que perdem {x} de mana.', values: [300, 450, 680], values2: [20, 25, 30], radius: 1, color: '#ff3df0' },
  look: { color: '#2a1a4a', accent: '#ff3df0', body: 'round', head: 'tv', acc: ['headphones', 'shades'] },
});
u({
  id: 'radinho', name: 'Radinho de Pilha', cost: 2, role: 'support', traits: ['muambeiro', 'dj'], mana: 70, startMana: 20,
  ability: { kind: 'radinho', fx: 'teamAS', name: 'Sintoniza a Boa', desc: 'Toca a música certa: os 2 aliados com mais Dano de Ataque ganham +{v}% de Dano de Ataque e +20% de vel. de ataque por 5s.', values: [30, 40, 60], color: '#ffd23f' },
  look: { color: '#c8a050', accent: '#3a2a1a', body: 'box', head: 'tv', acc: ['antenna', 'headphones'] },
});
u({
  id: 'raizote', name: 'Raizote', cost: 2, role: 'tank', traits: ['jardineiro', 'verdinho'], mana: 80, startMana: 30,
  ability: { kind: 'raiz', fx: 'aoeStun', name: 'Raiz Forte', desc: 'Solta raízes nos 2 inimigos mais próximos: {v} de dano mágico e prende (atordoa) por 1,5s. Ganha escudo de {x}.', values: [150, 225, 340], values2: [200, 300, 450], color: '#5dff7a' },
  look: { color: '#5a7a2a', accent: '#c4ff9e', body: 'tank', head: 'square', acc: ['leaf', 'beanie'] },
});
u({
  id: 'redemoinho', name: 'Redemoinho', cost: 2, role: 'fighter', traits: ['pirado', 'fumaceiro'], mana: 70, startMana: 20,
  ability: { kind: 'tornado', fx: 'nuke', name: 'Redemoinho Doido', desc: 'Lança um redemoinho em linha reta: {v} de dano mágico em todos na linha, que são empurrados 1 hex.', values: [240, 360, 540], color: '#d6e6ff' },
  look: { color: '#6a7a9a', accent: '#e6f0ff', body: 'tall', head: 'none', acc: ['smoke', 'mohawk'] },
});

// ---------- custo 3 ----------
u({
  id: 'astrolarica', name: 'Astro-Larica', cost: 3, role: 'adcarry', traits: ['cosmico', 'atirador'], mana: 60, startMana: 20,
  ability: { kind: 'salgadinho', fx: 'multishot', scale: 'ad', name: 'Chuva de Salgadinho', desc: 'Lança salgadinhos em 3 inimigos: {v}% do Dano de Ataque cada. Cada uso dá +{x}% de vel. de ataque até o fim do combate.', values: [180, 190, 215], values2: [10, 12, 15], count: 3, color: '#ffcf5d' },
  look: { color: '#3f6fd8', accent: '#ffcf5d', body: 'round', head: 'dome', acc: ['antenna', 'shades'] },
});
u({
  id: 'verdejante', name: 'Verdejante', cost: 3, role: 'support', traits: ['verdinho', 'guru'], mana: 90, startMana: 40,
  ability: { kind: 'fotossintese', fx: 'teamHeal', name: 'Fotossíntese Coletiva', desc: 'Cura todos os aliados em {v} ao longo de 3s. Quem estiver abaixo de 40% de vida recebe o dobro.', values: [180, 270, 420] },
  look: { color: '#2e8b57', accent: '#c4ffd0', body: 'tall', head: 'square', acc: ['leaf', 'halo'] },
});
u({
  id: 'neblina', name: 'Neblina Sombria', cost: 3, role: 'tank', traits: ['fumaceiro', 'tanque'], mana: 100, startMana: 40,
  ability: { kind: 'neblinapesada', fx: 'aoeStun', name: 'Neblina Pesada', desc: 'Solta fumaça ao redor: {v} de dano mágico, atordoa os vizinhos por 1,5s e ganha {x}% de esquiva por 3s.', values: [200, 300, 450], values2: [40, 45, 60], radius: 1, duration: 1500 },
  look: { color: '#4b4766', accent: '#9f97d8', body: 'tank', head: 'tv', acc: ['smoke', 'bong'] },
});
u({
  id: 'lunatico', name: 'Lunático', cost: 3, role: 'assassin', traits: ['cosmico', 'sorrateiro'], mana: 70, startMana: 20,
  ability: { kind: 'eclipse', fx: 'nuke', scale: 'ad', name: 'Eclipse na Ideia', desc: 'Salta no inimigo com menos vida: {v}% do Dano de Ataque. Se abater, salta de novo (até 2 vezes).', values: [380, 400, 450], color: '#f4f0c0' },
  look: { color: '#28284a', accent: '#f4f0c0', body: 'tall', head: 'dome', acc: ['visor', 'cape'] },
});
u({
  id: 'mclarica', name: 'MC Larica', cost: 3, role: 'fighter', traits: ['larica', 'dj'], mana: 90, startMana: 30,
  ability: { kind: 'rima', fx: 'teamHeal', name: 'Rima Nutritiva', desc: 'Manda um verso: cura todos os aliados em {v} e ganha +{x}% de Dano de Ataque por 5s.', values: [150, 220, 340], values2: [40, 50, 70] },
  look: { color: '#ffb347', accent: '#ff5d9e', body: 'round', head: 'square', acc: ['headphones', 'joint'] },
});
u({
  id: 'hackerverde', name: 'Hackerverde', cost: 3, role: 'apcaster', traits: ['verdinho', 'hacker', 'brisa'], mana: 80, startMana: 20,
  ability: { kind: 'virus', fx: 'nuke', name: 'Vírus Herbal', desc: 'Infecta o alvo: {v} de dano mágico ao longo de 4s. Se ele cair infectado, o vírus pula para o inimigo mais próximo.', values: [450, 680, 1050], color: '#3dffb0' },
  look: { color: '#2fbf71', accent: '#5dff7a', body: 'tall', head: 'tv', acc: ['leaf', 'antenna', 'cape'] },
});
u({
  id: 'calhambeque', name: 'Calhambeque', cost: 3, role: 'adcarry', traits: ['ferrugem', 'atirador', 'reciclado'], mana: 80, startMana: 20,
  ability: { kind: 'escapamento', fx: 'nuke', scale: 'ad', name: 'Escapamento Turbo', desc: 'Dispara o escapamento em linha reta: todos os inimigos na linha sofrem {v}% do Dano de Ataque.', values: [300, 320, 360], color: '#ffd23f' },
  look: { color: '#b5651d', accent: '#ffd23f', body: 'wide', head: 'square', acc: ['shades', 'smoke'] },
});
u({
  id: 'noiadao', name: 'Noiadão', cost: 3, role: 'assassin', traits: ['fumaceiro', 'paranoico'], mana: 60, startMana: 10,
  ability: { kind: 'surto', fx: 'aoeStun', scale: 'ad', name: 'Surto na Sombra', desc: 'Surta: golpeia todos os inimigos adjacentes com {v}% do Dano de Ataque e fica inalvejável por 1s.', values: [260, 270, 300], color: '#ff9d3d' },
  look: { color: '#3a3a3a', accent: '#ff9d3d', body: 'tall', head: 'square', acc: ['cape', 'smoke', 'visor'] },
});
u({
  id: 'lampiao', name: 'Lampião Neon', cost: 3, role: 'adcarry', traits: ['neon', 'atirador'], mana: 60, startMana: 10,
  ability: { kind: 'ricochete', fx: 'multishot', scale: 'ad', name: 'Rajada Fluorescente', desc: 'Dispara um feixe que ricocheteia 5 vezes entre inimigos: {v}% do Dano de Ataque, −15% a cada salto.', values: [210, 220, 245], color: '#3dfff0' },
  look: { color: '#1a2a3a', accent: '#3dfff0', body: 'tall', head: 'dome', acc: ['antenna', 'mohawk'] },
});
u({
  id: 'curto', name: 'Curto-Circuito', cost: 3, role: 'assassin', traits: ['pirado', 'hacker'], mana: 60, startMana: 10,
  ability: { kind: 'curto', fx: 'nuke', scale: 'ad', name: 'Descarga em Série', desc: 'Vira eletricidade e atravessa 3 inimigos em sequência: {v}% do Dano de Ataque cada e queima 20 de mana deles.', values: [180, 190, 210], color: '#9fe8ff' },
  look: { color: '#2a3a5a', accent: '#9fe8ff', body: 'tall', head: 'tv', acc: ['antenna', 'visor'] },
});
u({
  id: 'imanzao', name: 'Imãzão', cost: 3, role: 'tank', traits: ['muambeiro', 'ferrugem'], mana: 90, startMana: 40,
  ability: { kind: 'imantar', fx: 'stun', name: 'Ímã de Geladeira', desc: 'Liga o ímã: puxa o inimigo mais distante para perto, causa {v} de dano mágico e o atordoa por 1,5s.', values: [250, 375, 560], color: '#ff5d73' },
  look: { color: '#b03a3a', accent: '#d0d8e0', body: 'wide', head: 'square', acc: ['antenna', 'visor'] },
});

// ---------- custo 4 ----------
u({
  id: 'rastamech', name: 'Rasta-Mech', cost: 4, role: 'tank', traits: ['verdinho', 'tanque', 'dj'], mana: 100, startMana: 50,
  ability: { kind: 'groove', fx: 'aoeStun', name: 'Groove Sísmico', desc: 'Salta no meio do maior grupo de inimigos e pisa no ritmo: {v} de dano mágico e atordoa em raio 1 por 1,75s.', values: [300, 450, 1200], radius: 1, duration: 1750 },
  look: { color: '#2b7a3b', accent: '#ffd23f', body: 'tank', head: 'square', acc: ['beanie', 'joint'] },
});
u({
  id: 'laricasuprema', name: 'Larica Suprema', cost: 4, role: 'apcaster', traits: ['larica', 'brisa'], mana: 80, startMana: 30,
  ability: { kind: 'pizza', fx: 'meteor', name: 'Pizza Gigante Orbital', desc: 'Chama uma pizza orbital no maior grupo de inimigos: cai depois de 0,8s causando {v} de dano mágico (raio 2) e deixa queijo derretido queimando por 3s.', values: [460, 690, 1700], radius: 2, color: '#ffb347' },
  look: { color: '#d8562e', accent: '#ffe08a', body: 'wide', head: 'tv', acc: ['headphones', 'antenna'] },
});
u({
  id: 'zecometa', name: 'Zé Cometa', cost: 4, role: 'adcarry', traits: ['cosmico', 'atirador'], mana: 60, startMana: 0,
  ability: { kind: 'hiperespaco', fx: 'buffAS', name: 'Modo Hiperespaço', desc: 'Hiperdrive por 5s: +{v}% de vel. de ataque e cada ataque dispara um segundo tiro em outro inimigo (60% do dano).', values: [80, 100, 220], duration: 5000, color: '#7ad7ff' },
  look: { color: '#6a3fd8', accent: '#7ad7ff', body: 'round', head: 'dome', acc: ['mohawk', 'shades'] },
});
u({
  id: 'ferrovelho', name: 'Ferro-Velho Rei', cost: 4, role: 'tank', traits: ['ferrugem', 'tanque', 'reciclado'], mana: 100, startMana: 40,
  ability: { kind: 'latariareal', fx: 'shield', name: 'Lataria Real', desc: 'Veste a armadura real: escudo de {v} por 5s. Enquanto o escudo durar, devolve {x}% do dano recebido.', values: [550, 800, 2800], values2: [30, 35, 80], duration: 5000, color: '#ffd23f' },
  look: { color: '#6e5a48', accent: '#ffd23f', body: 'tank', head: 'square', acc: ['crown', 'visor'] },
});
u({
  id: 'nevoahacker', name: 'Névoa Hacker', cost: 4, role: 'apcaster', traits: ['fumaceiro', 'hacker'], mana: 70, startMana: 30,
  ability: { kind: 'pane', fx: 'stun', name: 'Pane no Sistema', desc: 'Derruba o sistema do alvo: {v} de dano mágico, atordoa por 2,5s e rouba toda a mana dele para o aliado com menos mana.', values: [700, 1050, 2600], duration: 2500, color: '#3dffb0' },
  look: { color: '#5a5a7a', accent: '#7ad7ff', body: 'tall', head: 'dome', acc: ['visor', 'smoke', 'cape'] },
});
u({
  id: 'bichogrilo', name: 'Bicho-Grilo 9000', cost: 4, role: 'fighter', traits: ['verdinho', 'paranoico'], mana: 90, startMana: 30,
  ability: { kind: 'badtrip', fx: 'aoeStun', name: 'Bad Trip Coletiva', desc: 'Grita que tá todo mundo olhando: {v} de dano mágico nos adjacentes, que são empurrados 1 hex e ficam atordoados por 1,5s.', values: [280, 420, 1200], radius: 1, color: '#ffd23f' },
  look: { color: '#6a8a2a', accent: '#ffd23f', body: 'wide', head: 'mushroom', acc: ['beanie', 'leaf'] },
});
u({
  id: 'espelhona', name: 'Espelhona', cost: 4, role: 'support', traits: ['neon', 'guru'], mana: 80, startMana: 30,
  ability: { kind: 'espelho', fx: 'shield', name: 'Espelho Mágico', desc: 'Envolve o aliado com menos vida num espelho: escudo de {v} por 4s que devolve {x}% do dano recebido.', values: [450, 650, 2000], values2: [40, 50, 100], color: '#e0f0ff' },
  look: { color: '#8ab0d8', accent: '#ff3df0', body: 'tall', head: 'dome', acc: ['halo', 'crown'] },
});
u({
  id: 'colheitadeira', name: 'Colheitadeira', cost: 4, role: 'fighter', traits: ['jardineiro', 'larica'], mana: 70, startMana: 20,
  ability: { kind: 'colheita', fx: 'aoeStun', scale: 'ad', name: 'Hora da Colheita', desc: 'Passa a lâmina: {v}% do Dano de Ataque em todos os inimigos adjacentes. Abate na hora quem ficar abaixo de {x}% de vida.', values: [220, 230, 500], values2: [12, 15, 30], color: '#c4ff9e' },
  look: { color: '#3a7a3a', accent: '#ffd23f', body: 'wide', head: 'square', acc: ['visor', 'mohawk'] },
});
u({
  id: 'sirenao', name: 'Sirenão', cost: 4, role: 'apcaster', traits: ['paranoico', 'pirado'], mana: 80, startMana: 20,
  ability: { kind: 'sirene', fx: 'aoe', name: 'Sirene da Viatura', desc: 'Liga a sirene em linha reta: {v} de dano mágico em todos na linha, que ficam silenciados (não ganham mana) por 3s.', values: [420, 630, 1600], color: '#ff3d3d' },
  look: { color: '#2a3a8a', accent: '#ff3d3d', body: 'round', head: 'tv', acc: ['antenna', 'shades'] },
});

// ---------- custo 5 ----------
u({
  id: 'mestrebob', name: 'Mestre Bob-Bot', cost: 5, role: 'support', traits: ['cosmico', 'guru'], mana: 100, startMana: 40,
  ability: { kind: 'vibracao', fx: 'teamShield', name: 'Vibração Positiva', desc: 'Protege todos os aliados com um escudo de {v} por 5s e tira atordoamentos.', values: [350, 550, 2000], duration: 5000 },
  look: { color: '#1f9e5a', accent: '#ffd23f', body: 'round', head: 'square', acc: ['beanie', 'halo', 'joint'] },
});
u({
  id: 'bigbongbang', name: 'Big Bong Bang', cost: 5, role: 'apcaster', traits: ['fumaceiro', 'brisa'], mana: 110, startMana: 40,
  ability: { kind: 'bigbang', fx: 'meteor', name: 'Big Bang Esfumaçado', desc: 'Explosão cósmica no alvo: {v} de dano mágico em raio 2 e atordoa por 1,5s. Depois caem mais 2 meteoros em inimigos aleatórios ({x}% do dano).', values: [560, 840, 3800], values2: [40, 40, 60], radius: 2, duration: 1500 },
  look: { color: '#8b2fc9', accent: '#5dff7a', body: 'tall', head: 'dome', acc: ['bong', 'smoke', 'antenna'] },
});
u({
  id: 'arvoremae', name: 'Árvore-Mãe 3000', cost: 5, role: 'tank', traits: ['verdinho', 'tanque'], mana: 110, startMana: 50,
  ability: { kind: 'seiva', fx: 'teamHeal', name: 'Seiva Ancestral', desc: 'Cura todos os aliados em {v} e faz brotar uma Mudinha ao lado com {x} de vida (até 2 por combate).', values: [350, 520, 2200], values2: [500, 900, 3000] },
  look: { color: '#1e7a3a', accent: '#a8ff9e', body: 'tank', head: 'dome', acc: ['leaf', 'halo', 'smoke'] },
});
u({
  id: 'donalarica', name: 'Dona Larica Cósmica', cost: 5, role: 'adcarry', traits: ['larica', 'dj'], mana: 90, startMana: 30,
  ability: { kind: 'festa', fx: 'teamAS', scale: 'ad', name: 'Festa Infinita', desc: 'Começa a festa: aliados ganham +{v}% de vel. de ataque por 6s e ela solta confete em TODOS os inimigos ({x}% do Dano de Ataque).', values: [50, 75, 250], values2: [60, 70, 200], duration: 6000 },
  look: { color: '#ff7ad9', accent: '#ffe066', body: 'round', head: 'dome', acc: ['crown', 'headphones', 'joint'] },
});
u({
  id: 'rainhaneon', name: 'Rainha do Neon', cost: 5, role: 'apcaster', traits: ['neon', 'paranoico', 'hacker'], mana: 100, startMana: 30,
  ability: { kind: 'apagao', fx: 'aoe', name: 'Apagão Neon', desc: 'Corta a luz: {v} de dano mágico em quem estiver a 2 hexes do alvo, que ficam cegos por 2s. Ela some no escuro (inalvejável por 1,5s).', values: [460, 700, 3300], radius: 2, color: '#ff3df0' },
  look: { color: '#1a0a2a', accent: '#ff3df0', body: 'round', head: 'dome', acc: ['crown', 'visor', 'cape'] },
});
u({
  id: 'buraconegro', name: 'Vórtice Larica', cost: 5, role: 'apcaster', traits: ['cosmico', 'muambeiro'], mana: 100, startMana: 30,
  ability: { kind: 'buraconegro', fx: 'meteor', name: 'Buraco Negro da Fome', desc: 'Abre um buraco negro no maior grupo de inimigos: puxa todos a até 2 hexes para o centro, causa {v} de dano mágico e atordoa por 1,5s.', values: [520, 780, 3500], radius: 2, color: '#a07aff' },
  look: { color: '#140a2a', accent: '#a07aff', body: 'round', head: 'dome', acc: ['halo', 'antenna', 'cape'] },
});
u({
  id: 'marretao', name: 'Marretão Supremo', cost: 5, role: 'fighter', traits: ['jardineiro', 'tanque', 'pirado'], mana: 80, startMana: 20,
  ability: { kind: 'marreta', fx: 'aoeStun', scale: 'ad', name: 'Marretada Final', desc: 'Desce a marreta: {v}% do Dano de Ataque no alvo e metade nos adjacentes, que são empurrados. Ganha +{x}% de Dano de Ataque permanente a cada uso.', values: [350, 370, 1200], values2: [15, 20, 50], color: '#ffd23f' },
  look: { color: '#7a4a2a', accent: '#ffd23f', body: 'tank', head: 'square', acc: ['crown', 'mohawk'] },
});

// ---------- invocações ----------
u({
  id: 'muda', name: 'Mudinha', cost: 1, role: 'tank', traits: [], summon: true, mana: 999, startMana: 0,
  hp: 500, atk: 30, as: 0.6, armor: 25, mr: 25,
  ability: { kind: 'mudinha', fx: 'shield', name: 'Brotinho', desc: 'Só segura a linha.', values: [0, 0, 0] },
  look: { color: '#3fae5a', accent: '#c4ff9e', body: 'round', head: 'mushroom', acc: ['leaf'] },
});

// ---------- PvE: drones da patrulha ----------
u({
  id: 'drone', name: 'Drone da Patrulha', cost: 1, role: 'fighter', traits: [], pve: true, mana: 999, startMana: 0,
  hp: 420, atk: 35, as: 0.6, armor: 10, mr: 10,
  ability: { kind: 'none', fx: 'nuke', name: '—', desc: 'Só apita.', values: [0, 0, 0] },
  look: { color: '#3a4a7a', accent: '#ff3d3d', body: 'round', head: 'none', acc: ['antenna'] },
});
u({
  id: 'dronebig', name: 'Drone Blindado', cost: 2, role: 'tank', traits: [], pve: true, mana: 999, startMana: 0,
  hp: 1300, atk: 70, as: 0.6, armor: 40, mr: 30,
  ability: { kind: 'none', fx: 'nuke', name: '—', desc: 'Apita mais alto.', values: [0, 0, 0] },
  look: { color: '#22305a', accent: '#3d8bff', body: 'tank', head: 'tv', acc: ['antenna', 'visor'] },
});

// Ajuste global de ritmo (combates de ~20-25s, igual TFT).
export const AD_SCALE = 1.25;
for (const d of Object.values(UNITS)) d.atk = Math.round(d.atk * AD_SCALE);

export const SHOP_UNITS = Object.values(UNITS).filter((d) => !d.pve && !d.summon);

// ======================= ECONOMIA (valores do TFT) =======================

export const POOL_SIZE: Record<number, number> = { 1: 30, 2: 25, 3: 18, 4: 10, 5: 9 };

// chance (%) de cada custo por nível [c1, c2, c3, c4, c5]
export const SHOP_ODDS: Record<number, number[]> = {
  1: [100, 0, 0, 0, 0],
  2: [100, 0, 0, 0, 0],
  3: [75, 25, 0, 0, 0],
  4: [55, 30, 15, 0, 0],
  5: [45, 33, 20, 2, 0],
  6: [30, 40, 25, 5, 0],
  7: [19, 30, 40, 10, 1],
  8: [18, 25, 32, 22, 3],
  9: [15, 20, 25, 30, 10],
  10: [5, 10, 20, 40, 25],
};

// XP necessária para sair do nível N (tabela do TFT: 2, 6, 10, 20, 36, 48, 76, 84, 100)
export const XP_TO_LEVEL: Record<number, number> = { 1: 2, 2: 6, 3: 10, 4: 20, 5: 36, 6: 48, 7: 76, 8: 84, 9: 100 };
export const MAX_LEVEL = 10;
export const XP_COST = 4;
export const XP_PER_BUY = 4;
export const REROLL_COST = 2;
export const SHOP_SIZE = 5;
export const START_HP = 100;
export const HP_STAR_MULT = [1, 1.8, 3.24];
export const AD_STAR_MULT = [1, 1.5, 2.25];
export const MAX_ITEMS = 3;
export const BASE_CRIT = 25; // %
export const BASE_CRIT_DMG = 40; // % extra (140%)

export const COST_COLORS: Record<number, string> = {
  1: '#9aa3ad',
  2: '#3fd17a',
  3: '#3fa9ff',
  4: '#c46bff',
  5: '#ffc93f',
};

// ======================= ESTÁGIOS (igual TFT) =======================
// rodada 1..3 = 1-2, 1-3, 1-4 (PvE). Depois 2-1 ... 2-7, 3-1 ... (7 rodadas por estágio).

export function stageOf(round: number): { stage: number; sub: number } {
  if (round <= 3) return { stage: 1, sub: round + 1 };
  const k = round - 4;
  return { stage: 2 + Math.floor(k / 7), sub: (k % 7) + 1 };
}
export function stageLabel(round: number) {
  const s = stageOf(round);
  return `${s.stage}-${s.sub}`;
}
export function isPveRound(round: number) {
  const s = stageOf(round);
  return s.stage === 1 || s.sub === 7;
}
/** Rodadas com escolha de aprimoramento: 2-1, 3-2, 4-2. */
export function isAugmentRound(round: number) {
  const l = stageLabel(round);
  return l === '2-1' || l === '3-2' || l === '4-2';
}
/** Arsenal (escolha de item) no meio de cada estágio. */
export function isArmoryRound(round: number) {
  const s = stageOf(round);
  return s.stage >= 2 && s.sub === 5;
}
/** Carrossel compartilhado antes da rodada x-4 (e um no começo do jogo). */
export function isCarouselRound(round: number, portal?: string | null) {
  const s = stageOf(round);
  return s.stage >= 2 && (s.sub === 4 || (portal === 'rodizio' && s.sub === 6));
}
export const STAGE_DAMAGE: Record<number, number> = { 1: 0, 2: 2, 3: 4, 4: 6, 5: 9, 6: 12, 7: 16 };
/** Dano extra por robô sobrevivente do vencedor. */
export function survivorDamage(star: number, cost: number) {
  return star + (cost >= 4 ? 1 : 0);
}
export function stageDamage(round: number) {
  const s = stageOf(round).stage;
  return STAGE_DAMAGE[Math.min(7, s)] ?? 17;
}

export function sellValue(cost: number, star: number) {
  const copies = Math.pow(3, star - 1);
  return star > 1 && cost > 1 ? cost * copies - 1 : cost * copies;
}

export function abilityText(def: UnitDef, star?: number) {
  const vals = def.ability.values;
  const v = star ? String(vals[star - 1]) : vals.join('/');
  const v2 = def.ability.values2;
  const x = v2 ? (star ? String(v2[star - 1]) : v2.join('/')) : '';
  return def.ability.desc.replace('{v}', v).replace('{x}', x);
}

/** Descrição da sinergia num nível específico (ou todos os níveis se tier for omitido). */
export function traitText(t: TraitDef, tier?: number) {
  const pick = (arr?: number[]) => (arr ? (tier === undefined ? arr.join('/') : String(arr[tier])) : '');
  return t.desc.replaceAll('{v}', pick(t.values)).replace('{x}', pick(t.extra));
}
