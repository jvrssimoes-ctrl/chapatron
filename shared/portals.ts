// Portais: uma regra especial por partida, votada pelos jogadores antes do primeiro carrossel.

export interface PortalDef { id: string; name: string; icon: string; desc: string; color: string }

export const PORTALS: Record<string, PortalDef> = {};
function portal(id: string, name: string, icon: string, color: string, desc: string) {
  PORTALS[id] = { id, name, icon, color, desc };
}

portal('chuva', 'Chuva de Grana', '🌧️', '#ffd23f', 'Todo mundo ganha +1 de ouro em toda rodada.');
portal('feira', 'Feira Livre', '🛒', '#5dffe0', 'Rolar a loja custa só 1 de ouro.');
portal('kit', 'Kit de Sobrevivência', '🎒', '#7ad7ff', 'Todo mundo começa com 2 componentes aleatórios.');
portal('rodizio', 'Rodízio de Carrossel', '🎠', '#ff7ad9', 'Tem carrossel extra na rodada 6 de cada estágio (a partir do 2).');
portal('pilotagem', 'Escola de Pilotagem', '📚', '#9bff5d', 'Comprar XP dá 6 de experiência em vez de 4.');
portal('colchao', 'Colchão de Fumaça', '☁️', '#c58bff', 'Jogadores levam 25% menos dano ao perder. Partidas mais longas!');
portal('drones', 'Drones Generosos', '🛸', '#ff8a3d', 'Rodadas PvE soltam 1 componente a mais.');
portal('juros', 'Juros Altos', '🏦', '#ffe066', 'O limite de juros sobe de 5 para 7 de ouro.');
portal('colheres', 'Chuva de Colheres', '🥄', '#ff5d73', 'Todo mundo ganha uma Colher de Pau no começo e outra no estágio 3.');

export const PORTAL_IDS = Object.keys(PORTALS);

export const rerollCost = (portal: string | null | undefined, mode?: string) => (portal === 'feira' || mode === 'turbo' ? 1 : 2);
/** portais que não fazem sentido no modo Turbo (sem juros e sem comprar XP) */
export const TURBO_SKIP_PORTALS = ['feira', 'pilotagem', 'juros'];
export const interestCap = (portal: string | null | undefined, hasJurosAug: boolean) => (hasJurosAug ? 7 : portal === 'juros' ? 7 : 5);
