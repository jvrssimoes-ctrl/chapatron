import { UNITS } from '../../shared/data';
import { robotPortrait } from './three/portrait';

// Menu, lobby e fim de jogo: avatares de robô, desfile, fumaça de fundo, pódio e confete.

const ROSTER = Object.values(UNITS).filter((u) => !u.pve).sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  // mistura final (murmur3 fmix) para espalhar bem os bits baixos
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}

/** Robô-avatar fixo para cada jogador (derivado do nome). */
export function avatarDef(key: string) {
  return ROSTER[hash(key.toLowerCase()) % ROSTER.length];
}
export function avatarUrl(key: string) {
  const d = avatarDef(key);
  return robotPortrait(d.id, d.look);
}

const COST_GLOW = ['', '#9aa3ad', '#5dff7a', '#3d8bff', '#b07aff', '#ffd23f'];
export function avatarHtml(key: string, cls = 'avatar') {
  const d = avatarDef(key);
  return `<div class="${cls}" style="--ac:${COST_GLOW[d.cost] ?? '#b07aff'}"><img src="${robotPortrait(d.id, d.look)}" alt="" draggable="false"></div>`;
}

// ---------------- fumaça / folhas flutuando ao fundo ----------------
export function initMenuFx() {
  for (const box of document.querySelectorAll<HTMLElement>('.menu-fx')) {
    if (box.childElementCount) continue;
    let html = '';
    for (let i = 0; i < 22; i++) {
      const leaf = i % 4 === 0;
      const size = leaf ? 14 + Math.random() * 14 : 40 + Math.random() * 120;
      const style = [
        `left:${Math.random() * 100}%`,
        `--s:${size.toFixed(0)}px`,
        `--d:${(10 + Math.random() * 14).toFixed(1)}s`,
        `--delay:${(-Math.random() * 20).toFixed(1)}s`,
        `--x:${(Math.random() * 120 - 60).toFixed(0)}px`,
        `--h:${Math.floor(Math.random() * 3)}`,
      ].join(';');
      html += `<span class="${leaf ? 'fx-leaf' : 'fx-puff'}" style="${style}"></span>`;
    }
    box.innerHTML = html;
  }
}

// ---------------- desfile de robôs no menu ----------------
let paradeDone = false;
export function initParade() {
  if (paradeDone) return;
  const track = document.getElementById('paradeTrack');
  if (!track) return;
  paradeDone = true;
  const list = [...ROSTER];
  const imgs: string[] = [];
  let i = 0;
  // renderiza os retratos aos poucos para não travar a abertura
  const step = () => {
    const t0 = performance.now();
    while (i < list.length && performance.now() - t0 < 12) {
      const d = list[i++];
      imgs.push(`<div class="pr" style="--ac:${COST_GLOW[d.cost]};--i:${i}"><img src="${robotPortrait(d.id, d.look)}" alt="" draggable="false"><span>${d.name}</span></div>`);
    }
    if (i < list.length) { setTimeout(step, 16); return; }
    const row = imgs.join('');
    track.innerHTML = row + row;
    track.style.setProperty('--n', String(list.length));
    track.classList.add('on');
  };
  setTimeout(step, 60);
}

// ---------------- confete ----------------
export function confetti(host: HTMLElement, ms = 5000) {
  const cv = document.createElement('canvas');
  cv.className = 'confetti';
  host.appendChild(cv);
  const ctx = cv.getContext('2d')!;
  const W = (cv.width = innerWidth), H = (cv.height = innerHeight);
  const cols = ['#5dff7a', '#ff5d9e', '#ffd23f', '#7ad7ff', '#b07aff', '#ffffff'];
  const ps = Array.from({ length: 180 }, () => ({
    x: Math.random() * W, y: -20 - Math.random() * H * 0.6,
    vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4,
    r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
    w: 6 + Math.random() * 7, h: 4 + Math.random() * 5,
    c: cols[Math.floor(Math.random() * cols.length)], leaf: Math.random() < 0.15,
  }));
  const t0 = performance.now();
  const tick = (now: number) => {
    const t = now - t0;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = t > ms - 800 ? Math.max(0, (ms - t) / 800) : 1;
    for (const p of ps) {
      p.x += p.vx + Math.sin((t + p.r * 900) / 400) * 0.8; p.y += p.vy; p.r += p.vr;
      if (p.y > H + 20 && t < ms - 1500) { p.y = -20; p.x = Math.random() * W; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      if (p.leaf) { ctx.font = '16px sans-serif'; ctx.fillText('🌿', -8, 6); }
      else { ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2))); }
      ctx.restore();
    }
    if (t < ms && cv.isConnected) requestAnimationFrame(tick);
    else cv.remove();
  };
  requestAnimationFrame(tick);
}

// ---------------- fim de jogo ----------------
const PLACE_TXT: Record<number, [string, string]> = {
  1: ['VOCÊ É O MAIS CHAPADO!', 'Rei absoluto da brisa. Ninguém segura esse time. 🌿👑'],
  2: ['QUASE LÁ!', 'Vice-campeão da larica. Faltou só um tiquinho.'],
  3: ['PÓDIO!', 'Bronze com fumaça. Respeita!'],
  4: ['TOP 4!', 'Ainda na brisa. Dá pra se orgulhar.'],
};

export function gameoverHtml(ranking: { id: string; name: string; place: number; isBot: boolean }[], youId: string | null, isHost: boolean, esc: (s: string) => string) {
  const me = ranking.find((r) => r.id === youId);
  const place = me?.place ?? 0;
  const [title, sub] = PLACE_TXT[place] ?? [`VOCÊ FICOU EM ${place}º`, 'A brisa acabou cedo... bora outra?'];
  const by = (p: number) => ranking.find((r) => r.place === p);
  const podium = [2, 1, 3].map((p) => {
    const r = by(p);
    if (!r) return '<div class="pod-col empty"></div>';
    return `<div class="pod-col p${p} ${r.id === youId ? 'me' : ''}">
      ${p === 1 ? '<div class="pod-crown">👑</div>' : ''}
      ${avatarHtml(r.name, 'avatar pod-av')}
      <div class="pod-name">${esc(r.name)}${r.isBot ? ' <small>🤖</small>' : ''}</div>
      <div class="pod-block"><b>${p}º</b></div>
    </div>`;
  }).join('');
  const rest = ranking.filter((r) => r.place > 3).sort((a, b) => a.place - b.place)
    .map((r, i) => `<li class="${r.id === youId ? 'me' : ''}" style="animation-delay:${0.9 + i * 0.08}s"><b>${r.place}º</b>${avatarHtml(r.name, 'avatar mini')}<span>${esc(r.name)}</span>${r.isBot ? '<small>🤖</small>' : ''}</li>`).join('');
  return `
    <div class="go-box place-${Math.min(place, 5)}">
      <div class="go-medal">${place || '?'}º</div>
      <h1>${title}</h1>
      <p class="go-sub">${sub}</p>
      <div class="podium">${podium}</div>
      ${rest ? `<ol class="go-rest">${rest}</ol>` : ''}
      <div class="go-btns">
        ${isHost ? '<button id="restartBtn" class="btn primary big">Nova partida</button>' : '<p class="hint">Esperando o anfitrião...</p>'}
        <button id="exitBtn" class="btn">Sair</button>
      </div>
    </div>`;
}
