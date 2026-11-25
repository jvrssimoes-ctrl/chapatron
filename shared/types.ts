export type TraitId =
  // origens (verticais)
  | 'verdinho' | 'fumaceiro' | 'larica' | 'ferrugem' | 'cosmico'
  // classes (verticais e horizontais)
  | 'tanque' | 'atirador' | 'brisa' | 'sorrateiro' | 'guru' | 'dj' | 'hacker' | 'reciclado'
  // expansão "Noite de Neon"
  | 'neon' | 'paranoico'
  // expansão "Horta Proibida"
  | 'jardineiro' | 'muambeiro' | 'pirado';

/** Papel do robô no combate (igual aos "arquétipos" de auto battler). */
export type Role = 'tank' | 'fighter' | 'adcarry' | 'apcaster' | 'assassin' | 'support';

/** Família visual da habilidade (pose de quem conjura + cor). */
export type FxKind =
  | 'shield' | 'multishot' | 'drain' | 'heal' | 'buffAS' | 'nuke' | 'stun'
  | 'aoe' | 'teamHeal' | 'aoeStun' | 'teamShield' | 'meteor' | 'teamAS';

/** Mecânica única de cada robô (implementada em server/combat.ts). */
export type AbilityKind =
  | 'none'
  | 'cascagrossa' | 'baforada' | 'mordida' | 'bolinhapaz' | 'estouro' | 'brasa' | 'sinaltravado' | 'olhogordo'
  | 'moedor' | 'nuvemdensa' | 'esporos' | 'fornada' | 'golpenebuloso' | 'grave' | 'parafuso' | 'pulsoneon'
  | 'salgadinho' | 'fotossintese' | 'neblinapesada' | 'eclipse' | 'rima' | 'virus' | 'escapamento' | 'surto' | 'ricochete'
  | 'groove' | 'pizza' | 'hiperespaco' | 'latariareal' | 'pane' | 'badtrip'
  | 'vibracao' | 'bigbang' | 'seiva' | 'festa' | 'apagao'
  // novos robôs
  | 'cupinzeiro' | 'chiclete' | 'fogueira' | 'radinho' | 'raiz' | 'tornado' | 'curto' | 'imantar'
  | 'espelho' | 'colheita' | 'sirene' | 'buraconegro' | 'marreta' | 'mudinha';

export interface AbilityDef {
  kind: AbilityKind;
  fx: FxKind;
  name: string;
  desc: string; // {v} = valor por estrela, {x} = segundo valor por estrela
  values: [number, number, number];
  values2?: [number, number, number];
  color?: string;
  /** 'ap' = valor × poder de habilidade; 'ad' = valor é % do dano de ataque */
  scale: 'ap' | 'ad';
  count?: number;
  duration?: number; // ms
  radius?: number;
}

export type BodyType = 'box' | 'round' | 'tall' | 'wide' | 'tank';
export type HeadType = 'square' | 'dome' | 'tv' | 'mushroom' | 'none';
export type Accessory =
  | 'antenna' | 'leaf' | 'joint' | 'beanie' | 'bong' | 'headphones'
  | 'shades' | 'smoke' | 'halo' | 'mohawk' | 'visor' | 'cape' | 'crown';

export interface RobotLook {
  color: string;
  accent: string;
  body: BodyType;
  head: HeadType;
  acc: Accessory[];
}

export interface UnitDef {
  id: string;
  name: string;
  cost: number;
  role: Role;
  traits: TraitId[];
  hp: number;
  atk: number;
  as: number; // ataques por segundo
  range: number; // em hexágonos
  armor: number;
  mr: number;
  mana: number;
  startMana: number;
  ability: AbilityDef;
  look: RobotLook;
  pve?: boolean;
  /** invocado durante o combate (não aparece na loja) */
  summon?: boolean;
}

export interface TraitDef {
  id: TraitId;
  name: string;
  kind: 'origem' | 'classe';
  color: string;
  icon: string;
  breakpoints: number[];
  values: number[];
  extra?: number[]; // segundo valor por nível ({x} na descrição)
  desc: string; // {v} e {x}
  scope: 'holders' | 'team';
  style: 'vertical' | 'horizontal';
}

// ---------- itens ----------

export interface ItemStats {
  ad?: number; // % de dano de ataque
  as?: number; // % de velocidade de ataque
  ap?: number; // pontos de poder de habilidade
  mana?: number; // mana inicial
  armor?: number;
  mr?: number;
  hp?: number;
  crit?: number; // % chance de crítico
}

export interface ItemDef {
  id: string;
  name: string;
  icon: string;
  component: boolean;
  /** consumível (Pé de Cabra, Reforjador, Xerox) */
  special?: boolean;
  /** Emblema: o portador ganha essa sinergia */
  emblem?: TraitId;
  recipe?: [string, string];
  stats: ItemStats;
  desc: string;
}

// ---------- aprimoramentos ----------

export type AugTier = 'prata' | 'ouro' | 'prisma';

export interface AugmentDef {
  id: string;
  name: string;
  icon: string;
  tier: AugTier;
  desc: string;
  trait?: TraitId; // corações/coroas
  traitBonus?: number;
}

export interface Choice {
  kind: 'augment' | 'armory';
  title: string;
  options: string[]; // ids de aprimoramentos ou itens
}

// ---------- unidades ----------

export interface UnitInst { id: string; defId: string; star: number; items: string[] }

export type Loc = { zone: 'board'; r: number; c: number } | { zone: 'bench'; i: number };

export interface OwnedUnit extends UnitInst { loc: Loc }

export type Phase = 'lobby' | 'portal' | 'carousel' | 'planning' | 'combat' | 'gameover';

/** Carrossel compartilhado: robôs girando no meio, cada um com um item. */
export interface CarouselUnit { defId: string; item: string; taken: string | null }
export interface CarouselAvatar { id: string; x: number; z: number; picked: number }

export interface BoardPreviewUnit { defId: string; star: number; r: number; c: number; items: string[] }

export interface PublicPlayer {
  id: string;
  name: string;
  hp: number;
  level: number;
  alive: boolean;
  isBot: boolean;
  connected: boolean;
  streak: number;
  place: number;
  gold: number;
  board: BoardPreviewUnit[];
  augments: string[];
  /** visual da Pequena Lenda ("especie:cor") */
  avatar: string;
}

export interface PrivateState {
  gold: number;
  level: number;
  xp: number;
  xpNeeded: number;
  shop: (string | null)[];
  units: OwnedUnit[];
  itemBench: string[];
  augments: string[];
  choice: Choice | null;
  freeRerolls: number;
  locked: boolean;
  streak: number;
  ready: boolean;
  hp: number;
  alive: boolean;
}

export interface LobbyPlayer { id: string; name: string; isBot: boolean; connected: boolean; avatar: string }

export interface CombatUnitInit {
  uid: number;
  defId: string;
  star: number;
  side: 0 | 1;
  r: number;
  c: number;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  shield: number;
  items: string[];
}

export type CombatEvent =
  | { t: number; k: 'move'; u: number; r: number; c: number; jump?: boolean; dash?: boolean; push?: boolean }
  | { t: number; k: 'atk'; u: number; tg: number; mana: number }
  | { t: number; k: 'dmg'; u: number; amt: number; hp: number; sh: number; mana: number; crit?: boolean; dodge?: boolean; miss?: boolean; magic?: boolean; tru?: boolean; s?: number }
  | { t: number; k: 'cast'; u: number; ab: AbilityKind; tg?: number; tgs?: number[]; r?: number; c?: number; n?: number }
  /** efeito visual tardio de uma habilidade (impacto, tick de zona, ricochete...) */
  | { t: number; k: 'fx'; u: number; ab: AbilityKind; tg?: number; tgs?: number[]; r?: number; c?: number; n?: number }
  | { t: number; k: 'spawn'; unit: CombatUnitInit; u: number; src: number }
  | { t: number; k: 'status'; u: number; s: StatusKind; dur: number }
  | { t: number; k: 'heal'; u: number; amt: number; hp: number }
  | { t: number; k: 'shield'; u: number; sh: number }
  | { t: number; k: 'death'; u: number }
  | { t: number; k: 'stun'; u: number; dur: number }
  | { t: number; k: 'mana'; u: number; mana: number }
  | { t: number; k: 'buff'; u: number; dur: number }
  | { t: number; k: 'proc'; u: number; item: string; tgs?: number[] };

export type StatusKind = 'blind' | 'slow' | 'mark' | 'taunt' | 'stealth' | 'reflect' | 'dodge' | 'silence' | 'burn' | 'virus' | 'cleanse' | 'rage';

export interface CombatResult {
  units: CombatUnitInit[];
  events: CombatEvent[];
  duration: number;
  winner: 0 | 1 | -1;
  survivors: { side: 0 | 1; star: number; cost: number }[];
}

// ---------- mensagens ----------

export type ClientMsg =
  | { t: 'create'; name: string; token: string; avatar?: string }
  | { t: 'join'; name: string; room: string; token: string; avatar?: string }
  /** muda o visual da Pequena Lenda ("especie:cor") */
  | { t: 'avatar'; look: string }
  | { t: 'addBot' }
  | { t: 'kick'; id: string }
  | { t: 'start' }
  | { t: 'restart' }
  | { t: 'buy'; i: number }
  | { t: 'sell'; id: string }
  | { t: 'move'; id: string; to: Loc }
  | { t: 'equip'; item: number; unitId: string }
  | { t: 'choose'; i: number }
  | { t: 'reroll' }
  | { t: 'xp' }
  | { t: 'lock' }
  | { t: 'ready' }
  | { t: 'chat'; msg: string }
  | { t: 'emote'; e: number }
  | { t: 'walk'; x: number; z: number }
  | { t: 'vote'; i: number };

export type ServerMsg =
  | { t: 'joined'; room: string; youId: string }
  | { t: 'lobby'; room: string; hostId: string; players: LobbyPlayer[] }
  | {
      t: 'state';
      phase: Phase;
      round: number;
      endsIn: number;
      phaseTotal: number;
      pve: boolean;
      hostId: string;
      me: PrivateState;
      players: PublicPlayer[];
      opponentId: string | null;
      /** regra especial da partida (portal votado) */
      portal: string | null;
    }
  /** home: lado dono do tabuleiro (o outro está visitando) · dmg: dano que o perdedor leva na vida */
  | { t: 'combat'; round: number; mySide: 0 | 1; opponentName: string; opponentId?: string; pve: boolean; result: CombatResult; elapsed?: number; home: 0 | 1; dmg: number }
  | { t: 'gameover'; ranking: { id: string; name: string; place: number; isBot: boolean }[] }
  | { t: 'chat'; from: string; msg: string }
  | { t: 'emote'; from: string; e: number }
  | { t: 'carousel'; units: CarouselUnit[]; angle: number; spin: number; radius: number; avatars: CarouselAvatar[]; unlocked: string[]; locked: string[]; endsIn: number }
  | { t: 'loot'; items: string[]; gold: number }
  /** votação do portal: votes = id do jogador → opção */
  | { t: 'portal'; options: string[]; votes: Record<string, number>; endsIn: number; chosen: string | null }
  | { t: 'toast'; msg: string; kind?: 'info' | 'good' | 'bad' }
  | { t: 'error'; msg: string };
