import type { AugmentDef, AugTier, TraitId } from './types';
import { TRAITS } from './data';

// ======================= APRIMORAMENTOS =======================
// Escolhidos em 2-1, 3-2 e 4-2. As 3 opções de uma escolha são sempre do mesmo tier.

export const AUGMENTS: Record<string, AugmentDef> = {};

function a(id: string, tier: AugTier, name: string, icon: string, desc: string, extra: Partial<AugmentDef> = {}) {
  AUGMENTS[id] = { id, tier, name, icon, desc, ...extra };
}

// ---------- prata ----------
a('heranca', 'prata', 'Herança da Vó', '💰', 'Ganha 12 de ouro agora.');
a('rolagratis', 'prata', 'Rolagem Grátis', '🎲', 'Ganha 1 rolagem grátis da loja toda rodada.');
a('xpturbo', 'prata', 'Estudos Noturnos', '📚', 'Ganha +2 de XP extra toda rodada.');
a('feira', 'prata', 'Feira do Rolo', '🧺', 'Ganha 2 componentes aleatórios.');
a('lataforte', 'prata', 'Lata Reforçada', '🥫', 'Seu time ganha +20 de armadura e RM.');
a('dedonervoso', 'prata', 'Dedo Nervoso', '⚡', 'Seu time ganha +12% de velocidade de ataque.');
a('menteexp', 'prata', 'Mente Expandida', '🧠', 'Seu time ganha +15 de Poder de Habilidade.');
a('golpecrit', 'prata', 'Golpe de Sorte', '🍀', 'Seu time ganha +15% de chance de crítico.');
a('linhafrente', 'prata', 'Linha de Frente', '🧱', 'Robôs nas 2 fileiras da frente ganham +250 de vida.');
a('reciclagem', 'prata', 'Ferro-Velho Lucrativo', '♻️', 'Vender um robô dá +1 de ouro extra.');
a('pazinterior', 'prata', 'Paz Interior', '☮️', 'Seu time ganha +150 de vida máxima.');
a('vampiro', 'ouro', 'Larica Vampira', '🧛', 'Seu time ganha 12% de omnivampirismo (cura parte do dano causado).');

// ---------- ouro ----------
a('juroscomp', 'ouro', 'Juros Compostos', '🏦', 'Seu limite de juros sobe para 7 de ouro (máx. em 70).');
a('nivelja', 'ouro', 'Nível Já', '🆙', 'Ganha 10 de XP agora.');
a('itempronto', 'ouro', 'Item de Fábrica', '🎁', 'Ganha 1 item completo aleatório.');
a('furia', 'ouro', 'Fúria da Larica', '😡', 'Seu time ganha +15% de Dano de Ataque.');
a('socorro', 'ouro', 'Kit de Socorro', '🩹', 'Seu time começa o combate com escudo de 200.');
a('artilharia', 'ouro', 'Artilharia Chapada', '🎯', 'Robôs nas 2 fileiras de trás causam +20% de dano.');
a('manainf', 'ouro', 'Fonte de Mana', '💧', 'Seu time começa o combate com +20 de mana.');
a('laricacol', 'ouro', 'Larica Coletiva', '🍕', 'Seu time regenera 1% da vida máxima por segundo.');

// ---------- prisma ----------
a('fortuna', 'prisma', 'Fortuna Verde', '💸', 'Ganha 30 de ouro agora.');
a('caixamist', 'prisma', 'Caixa Misteriosa', '📦', 'Ganha 3 itens completos aleatórios.');
a('brisalend', 'prisma', 'Brisa Lendária', '🌈', 'Seu time causa +25% de dano.');
a('ascensao', 'prisma', 'Ascensão', '🚀', 'Ganha 20 de XP e 10 de ouro agora.');
a('presente', 'prisma', 'Presente dos Deuses', '🎀', 'Ganha um robô aleatório de custo 5 agora.');

// ---------- corações (+1) e coroas (+2) de sinergia ----------
for (const t of Object.values(TRAITS)) {
  a(`coracao_${t.id}`, 'prata', `Coração ${t.name}`, t.icon, `Conta como +1 ${t.name}.`, { trait: t.id as TraitId, traitBonus: 1 });
  a(`coroa_${t.id}`, 'ouro', `Coroa ${t.name}`, t.icon, `Conta como +2 ${t.name}.`, { trait: t.id as TraitId, traitBonus: 2 });
}

export const TIER_COLOR: Record<AugTier, string> = { prata: '#c7d3e0', ouro: '#ffcf4a', prisma: '#d68bff' };
export const TIER_NAME: Record<AugTier, string> = { prata: 'Prata', ouro: 'Ouro', prisma: 'Prisma' };

/** Bônus de sinergia que os aprimoramentos dão. */
export function traitBonus(augments: string[]): Partial<Record<TraitId, number>> {
  const b: Partial<Record<TraitId, number>> = {};
  for (const id of augments) {
    const ag = AUGMENTS[id];
    if (ag?.trait) b[ag.trait] = (b[ag.trait] ?? 0) + (ag.traitBonus ?? 0);
  }
  return b;
}

export function augmentPool(tier: AugTier) {
  return Object.values(AUGMENTS).filter((g) => g.tier === tier);
}
