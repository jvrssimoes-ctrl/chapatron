import { UNITS } from '../../shared/data';
import { store } from './store';

// Dicas de primeira partida: balõezinhos apontando para a parte da tela certa.
// Cada dica aparece uma vez só (fica salvo no navegador).

const KEY = 'chapatron_tips';
type Place = 'top' | 'bottom' | 'left' | 'right';
interface Hint { id: string; text: string; anchor: () => DOMRect | null; place: Place; valid?: () => boolean }

function load(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]')); } catch { return new Set(); }
}
const seen = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify([...seen])); } catch { /* */ } }

export function resetTips() { seen.clear(); save(); }

const queue: Hint[] = [];
let current: { hint: Hint; el: HTMLElement; timer: number } | null = null;

const rectOf = (id: string) => () => {
  const el = document.getElementById(id);
  if (!el || el.offsetParent === null) return null;
  return el.getBoundingClientRect();
};
/** Região do tabuleiro (metade de baixo da tela, centro). */
const boardRect = () => new DOMRect(window.innerWidth * 0.35, window.innerHeight * 0.45, window.innerWidth * 0.3, window.innerHeight * 0.15);

function hint(id: string, text: string, anchor: () => DOMRect | null, place: Place, valid?: () => boolean) {
  if (seen.has(id) || queue.some((h) => h.id === id) || current?.hint.id === id) return;
  queue.push({ id, text, anchor, place, valid });
  pump();
}

function pump() {
  if (current || !queue.length) return;
  const h = queue.shift()!;
  // a dica perdeu a hora (ex.: era do combate e já voltou o planejamento): fica pra próxima
  if (h.valid && !h.valid()) { pump(); return; }
  const r = h.anchor();
  if (!r) { pump(); return; }
  seen.add(h.id); save();
  const el = document.createElement('div');
  el.className = `coach ${h.place}`;
  el.innerHTML = `<div class="coach-text">💡 ${h.text}</div><button class="coach-ok">Entendi</button>`;
  document.body.appendChild(el);
  place(el, r, h.place);
  const done = () => {
    if (!current || current.el !== el) return;
    clearTimeout(current.timer);
    el.classList.add('out');
    setTimeout(() => el.remove(), 250);
    current = null;
    setTimeout(pump, 400);
  };
  el.querySelector('.coach-ok')!.addEventListener('click', done);
  current = { hint: h, el, timer: window.setTimeout(done, 14000) };
}

function place(el: HTMLElement, r: DOMRect, p: Place) {
  const b = el.getBoundingClientRect();
  const gap = 14;
  let x = r.left + r.width / 2 - b.width / 2;
  let y = r.top + r.height / 2 - b.height / 2;
  if (p === 'top') y = r.top - b.height - gap;
  if (p === 'bottom') y = r.bottom + gap;
  if (p === 'left') x = r.left - b.width - gap;
  if (p === 'right') x = r.right + gap;
  x = Math.max(8, Math.min(window.innerWidth - b.width - 8, x));
  y = Math.max(8, Math.min(window.innerHeight - b.height - 8, y));
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  // seta apontando para o centro do alvo
  const ax = Math.max(16, Math.min(b.width - 16, r.left + r.width / 2 - x));
  const ay = Math.max(16, Math.min(b.height - 16, r.top + r.height / 2 - y));
  el.style.setProperty('--ax', `${ax}px`);
  el.style.setProperty('--ay', `${ay}px`);
}

/** Olha o estado do jogo e mostra a dica do momento (chamado a cada atualização). */
export function checkTips() {
  const s = store.state;
  if (!s || !s.me.alive) return;
  const me = s.me;
  const board = me.units.filter((u) => u.loc.zone === 'board');
  const bench = me.units.filter((u) => u.loc.zone === 'bench');

  if (s.phase === 'planning' && me.choice) {
    hint('choice', me.choice.kind === 'augment'
      ? 'Aprimoramentos ficam com você até o fim do jogo. Escolha um que combine com o seu time.'
      : 'Arsenal: escolha um item de graça!', () => document.querySelector('.ch-box')?.getBoundingClientRect() ?? null, 'bottom', () => !!store.state?.me.choice);
    return;
  }
  if (s.phase === 'planning') {
    if (me.units.length === 0 && me.gold > 0)
      hint('buy', 'Compre um robô clicando numa carta da loja (ou aperte <kbd>1</kbd>–<kbd>5</kbd>).', rectOf('shop'), 'top');
    if (bench.length > 0 && board.length < me.level)
      hint('drag', `Arraste o robô do banco para o tabuleiro. Você pode ter <b>${me.level}</b> lutando agora — o limite é o seu nível.`, boardRect, 'top');
    const counts = new Map<string, number>();
    for (const u of me.units) if (u.star === 1) counts.set(u.defId, (counts.get(u.defId) ?? 0) + 1);
    const pair = [...counts.entries()].find(([, n]) => n === 2);
    if (pair) hint('pair', `Você tem 2 <b>${UNITS[pair[0]].name}</b>. Mais 1 cópia e ele evolui para ⭐⭐ — procure a carta brilhando na loja!`, rectOf('shop'), 'top');
    if (me.itemBench.length > 0 && board.length > 0)
      hint('items', 'Você ganhou um componente! Arraste até um robô. Dois componentes no mesmo robô viram um item completo.', rectOf('itemPanel'), 'right');
    if (board.length >= 2)
      hint('traits', 'Robôs com a mesma origem/classe ativam <b>sinergias</b>. Passe o mouse aqui para ver o que cada uma faz.', rectOf('traits'), 'right');
    if (me.gold >= 10 && s.round >= 4)
      hint('interest', 'Juros: cada 10 💰 guardados rendem +1 por rodada (até +5). Às vezes vale esperar antes de gastar.', rectOf('goldBox'), 'top');
    if (s.round >= 5 && me.gold >= 4)
      hint('xp', 'Comprar XP (<kbd>F</kbd>) sobe seu nível: mais robôs em campo e chances de robôs caros na loja.', rectOf('xpBtn'), 'top');
    if (s.round >= 6)
      hint('scout', 'Clique num jogador (ou aperte <kbd>Q</kbd>) para espiar o tabuleiro dele. <kbd>H</kbd> abre o guia completo.', rectOf('players'), 'left');
  }
  if (s.phase === 'combat' && store.combat)
    hint('combat', 'O combate é automático! Acompanhe o dano de cada robô na aba <b>Dano</b> (<kbd>Tab</kbd>).', rectOf('traits'), 'right', () => store.state?.phase === 'combat');
}
