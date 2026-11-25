import './style.css';
import { Scene3D } from './three/scene';
import { UNITS, bossFor, stageOf } from '../../shared/data';
import { robotPortrait } from './three/portrait';
import { MODES, MODE_IDS, TEAM_COLORS } from '../../shared/modes';
import type { GameMode } from '../../shared/types';
import { banner, chatLine, esc, hideTip, hpHit, initHud, itemTipHtml, overSell, renderHud, setLeftTab, setSellMode, showTip, tickHud, toast, unitTipHtml } from './hud';
import { net } from './net';
import { isMuted, setMusic, sfx, toggleMute } from './sfx';
import { store } from './store';
import { avatarHtml, confetti, gameoverHtml, initMenuFx, initParade } from './screens';
import { closeGuide, isGuideOpen, openGuide, toggleGuide } from './guide';
import { checkTips } from './tips';
import { initEmotes, showEmote } from './emotes';
import { closeProfile, isProfileOpen, menuCardHtml, myLp, onStarUp, openProfile, trackCombat, trackGameOver, trackState } from './profile';
import { startMenuHero } from './menuHero';
import { rankBadge } from './rank';
import { closeInspect, initInspect, inspect, isInspectOpen } from './inspect';
import { closePicker, isPickerOpen, myLookKey, openPicker } from './avatarPicker';
import { hidePortalVote, onPortalMsg } from './portalVote';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function lsGet(k: string) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* */ } }

let token = lsGet('chapatron_token');
if (!token) {
  token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  lsSet('chapatron_token', token);
}

const board = new Scene3D($('stage'), {
  hover: (info, x, y) => (info ? showTip(unitTipHtml(info), x, y) : hideTip()),
  dragging: (on, value) => setSellMode(on, value),
  overSell,
  inspect: (key) => inspect(key),
  hoverItem: (id, x, y) => showTip(itemTipHtml(id), x, y),
});
initInspect((k) => board.infoOf(k));
if (import.meta.env.DEV) Object.assign(window, { __board: board, __store: store, __net: net });

// ---------------- telas ----------------

type Screen = 'menu' | 'lobby' | 'game';
let screen: Screen = 'menu';
function show(s: Screen) {
  screen = s;
  $('menu').classList.toggle('hidden', s !== 'menu');
  $('lobby').classList.toggle('hidden', s !== 'lobby');
  $('hud').classList.toggle('hidden', s !== 'game');
  board.active = s === 'game';
  if (s !== 'game') $('gameover').classList.add('hidden');
  if (s === 'menu') { initParade(); syncMenu(); }
  if (s !== 'game') setMusic('menu');
  $('menuMute').classList.toggle('hidden', s === 'game');
  $('menuFs').classList.toggle('hidden', s === 'game');
  $('menuMute').textContent = isMuted() ? '🔇' : '🔊';
  $('muteBtn').textContent = isMuted() ? '🔇' : '🔊';
  requestAnimationFrame(() => board.layout());
}

// ---------------- menu ----------------

const nameInput = $<HTMLInputElement>('nameInput');
const codeInput = $<HTMLInputElement>('codeInput');
nameInput.value = lsGet('chapatron_name') ?? '';
const urlRoom = new URLSearchParams(location.search).get('sala');
if (urlRoom) codeInput.value = urlRoom.toUpperCase();

function myName() {
  const n = nameInput.value.trim().slice(0, 20) || `Robô${Math.floor(Math.random() * 900 + 100)}`;
  lsSet('chapatron_name', n);
  return n;
}

$('createBtn').onclick = () => {
  sfx('click');
  net.send({ t: 'create', name: myName(), token: token!, avatar: myLookKey() });
};
$('joinBtn').onclick = () => {
  sfx('click');
  const room = codeInput.value.trim().toUpperCase();
  if (room.length !== 4) { $('menuError').textContent = 'O código da sala tem 4 letras.'; return; }
  net.send({ t: 'join', name: myName(), room, token: token!, avatar: myLookKey() });
};
codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') $('joinBtn').click(); });

// ---------------- lobby ----------------

function inviteLink() {
  return `${location.origin}${location.pathname}?sala=${store.room}`;
}

function renderLobby() {
  const l = store.lobby;
  if (!l) return;
  const isHost = l.hostId === store.youId;
  $('lobbyCode').textContent = l.room;
  $('lobbyLink').textContent = inviteLink();
  $('lobbyCount').textContent = `${l.players.length}/8`;
  $('modePick').innerHTML = `<div class="mp-title">Modo de jogo ${isHost ? '' : '<small>(o anfitrião escolhe)</small>'}</div><div class="mp-row">${MODE_IDS.map((id) => {
    const m = MODES[id];
    return `<button class="mp-card ${l.mode === id ? 'on' : ''}" data-mode="${id}" style="--mc:${m.color}" ${isHost ? '' : 'disabled'}>
      <span class="mp-icon">${m.icon}</span><b>${m.name}</b><small>${esc(m.desc)}</small></button>`;
  }).join('')}</div>`;
  const lpHtml = (p: (typeof l.players)[number], i: number) => {
    const tags = [
      p.id === l.hostId ? '<i class="tag host">👑 Anfitrião</i>' : '',
      p.id === store.youId ? '<i class="tag you">Você</i>' : '',
      p.isBot ? '<i class="tag bot">🤖 Bot</i>' : '',
      !p.connected && !p.isBot ? '<i class="tag off">📴</i>' : '',
    ].join('');
    return `<div class="lp ${p.id === store.youId ? 'me' : ''}" style="animation-delay:${i * 0.04}s">
      ${avatarHtml(p.name)}
      <div class="lp-main"><div class="lp-name">${esc(p.name)}</div><div class="lp-tags">${tags}</div></div>
      ${isHost && p.id !== store.youId ? `<button class="kick" data-id="${p.id}" title="Remover">✖</button>` : ''}
    </div>`;
  };
  const lp = $('lobbyPlayers');
  lp.classList.toggle('teams', l.mode === 'dupla');
  if (l.mode === 'dupla') {
    const me = l.players.find((p) => p.id === store.youId);
    lp.innerHTML = [0, 1, 2, 3].map((t) => {
      const mem = l.players.filter((p) => p.team === t);
      const canJoin = mem.length < 2 && me?.team !== t;
      return `<div class="lteam" style="--tc:${TEAM_COLORS[t]}"><div class="lteam-head">🤝 Dupla ${t + 1}${canJoin ? `<button class="btn small ghost" data-team="${t}">Entrar</button>` : ''}</div>
        ${mem.map((p, i) => lpHtml(p, t * 2 + i)).join('')}${Array.from({ length: 2 - mem.length }, () => '<div class="lp empty"><span class="plus">+</span> vaga livre</div>').join('')}</div>`;
    }).join('');
  } else {
    lp.innerHTML = l.players.map(lpHtml).join('') + Array.from({ length: Math.max(0, 8 - l.players.length) }, () => '<div class="lp empty"><span class="plus">+</span> vaga livre</div>').join('');
  }
  $('addBotBtn').classList.toggle('hidden', !isHost);
  $('startBtn').classList.toggle('hidden', !isHost);
  $('waitHost').classList.toggle('hidden', isHost);
}

$('lobbyPlayers').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('.kick') as HTMLElement | null;
  if (b) net.send({ t: 'kick', id: b.dataset.id! });
  const tb = (e.target as HTMLElement).closest('[data-team]') as HTMLElement | null;
  if (tb) { sfx('click'); net.send({ t: 'team', team: Number(tb.dataset.team) }); }
});
$('modePick').addEventListener('click', (e) => {
  const c = (e.target as HTMLElement).closest('.mp-card') as HTMLButtonElement | null;
  if (c && !c.disabled) { sfx('click'); net.send({ t: 'mode', mode: c.dataset.mode as GameMode }); }
});
$('addBotBtn').onclick = () => { sfx('click'); net.send({ t: 'addBot' }); };
$('startBtn').onclick = () => { sfx('click'); net.send({ t: 'start' }); };
$('copyBtn').onclick = async () => {
  try { await navigator.clipboard.writeText(inviteLink()); toast('Link copiado! Manda pros amigos 🌿', 'good'); }
  catch { toast(inviteLink(), 'info'); }
};
$('leaveBtn').onclick = () => { location.href = location.pathname; };
$('guideBtn').onclick = () => openGuide();
$('menuGuideBtn').onclick = () => openGuide();
$('profileBtn').onclick = () => openProfile();
const MENU_TIPS = [
  'Guarde ouro: a cada 10 💰 você ganha +1 de juros por rodada (até +5).',
  'Robôs de mesmo nome brilham na loja quando completam uma evolução.',
  'Segure o botão direito (ou o dedo) num robô para ver tudo sobre ele.',
  'Nas rodadas de chefão, espalhe os robôs para fugir das habilidades em área.',
  'Clique no tabuleiro para a Pequena Lenda pegar os orbes de saque.',
  'Dois componentes no mesmo robô viram um item completo. Teste combinações!',
  'Perdeu muito? Sequência de derrotas também dá ouro extra.',
  'Bigorna no banco de itens: clique nela para escolher o item.',
  'Na aba Times do Guia tem composições prontas com itens sugeridos.',
  'Assassinos pulam na sua retaguarda: proteja os atiradores nos cantos.',
];
const syncRank = () => { $('menuRank').innerHTML = rankBadge(myLp(), 'big'); };
document.addEventListener('visibilitychange', () => { if (!document.hidden && screen === 'menu') startMenuHero($<HTMLCanvasElement>('menuHeroCv'), () => screen === 'menu' && !document.hidden); });
nameInput.addEventListener('change', () => { lsSet('chapatron_name', nameInput.value.trim().slice(0, 20)); if (screen === 'menu') syncMenu(); });
/** Atualiza o menu: saudação, cartão do jogador, dica e a Pequena Lenda. */
function syncMenu() {
  syncRank();
  const n = (lsGet('chapatron_name') ?? '').trim();
  const h = new Date().getHours();
  const hi = h < 6 ? 'Boa madrugada' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  $('menuHello').innerHTML = `${hi}${n ? `, <b>${esc(n)}</b>` : ''}! 🌿`;
  $('menuCard').innerHTML = menuCardHtml();
  $('menuTip').innerHTML = `<span>💡 Dica</span>${esc(MENU_TIPS[Math.floor(Math.random() * MENU_TIPS.length)])}`;
  startMenuHero($<HTMLCanvasElement>('menuHeroCv'), () => screen === 'menu' && !document.hidden);
}
syncRank();
$('avatarBtn').onclick = () => openPicker();
$('lobbyAvatarBtn').onclick = () => openPicker();
$('menuMute').onclick = () => { $('menuMute').textContent = toggleMute() ? '🔇' : '🔊'; };

// ---------------- tela cheia ----------------

function toggleFullscreen() {
  sfx('click');
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {
    const msg = 'Seu navegador bloqueou a tela cheia — tente F11.';
    if (screen === 'menu') $('menuError').textContent = msg;
    else toast(msg, 'bad');
  });
}
function syncFullscreen() {
  const on = !!document.fullscreenElement;
  for (const id of ['fsBtn', 'menuFs']) {
    const b = $(id);
    b.classList.toggle('on', on);
    b.title = on ? 'Sair da tela cheia (F11)' : 'Tela cheia (F11)';
  }
  requestAnimationFrame(() => board.layout());
}
$('fsBtn').onclick = toggleFullscreen;
$('menuFs').onclick = toggleFullscreen;
document.addEventListener('fullscreenchange', syncFullscreen);

// ---------------- rede ----------------

let prevStars = new Map<string, number>();
let prevHp = 100;
let prevPhase = '';

net.onStatus = (ok) => $('connStatus').classList.toggle('hidden', ok);

net.on((msg) => {
  switch (msg.t) {
    case 'joined':
      store.youId = msg.youId;
      store.room = msg.room;
      net.setRejoin({ t: 'join', name: myName(), room: msg.room, token: token!, avatar: myLookKey() });
      history.replaceState(null, '', `?sala=${msg.room}`);
      $('menuError').textContent = '';
      break;
    case 'lobby':
      store.lobby = msg;
      store.state = null;
      store.combat = null;
      show('lobby');
      renderLobby();
      break;
    case 'state': {
      const firstState = !store.state;
      store.state = msg;
      store.phaseEndsAt = performance.now() + msg.endsIn;
      if (screen !== 'game') show('game');
      trackState();
      if (msg.phase !== prevPhase) {
        if (msg.phase === 'planning' && prevPhase) sfx('phase');
        if (msg.phase === 'planning') { store.scoutId = null; setLeftTab('traits'); if (msg.pve) bossWarning(msg.round, false); }
        if (msg.phase === 'carousel') { store.scoutId = null; closeInspect(); banner('<b>🎠 CARROSSEL</b><small>clique no chão para andar e pegue um robô!</small>', 'silver'); }
        if (msg.phase !== 'carousel') store.carousel = null;
        if (msg.phase !== 'portal') hidePortalVote();
        prevPhase = msg.phase;
      }
      setMusic(msg.phase === 'combat' ? 'combat' : msg.phase === 'gameover' ? 'menu' : 'planning');
      // evoluções
      if (!firstState) {
        for (const u of msg.me.units) {
          const before = prevStars.get(u.id);
          if (before === undefined || u.star <= before) continue;
          const d = UNITS[u.defId];
          if (u.star === 3) {
            banner(`<span class="bn-stars">★★★</span><b>${esc(d.name)}</b><small>${d.cost >= 4 ? (d.cost === 5 ? 'DIVINDADE CHAPADA — ninguém segura!' : 'MONSTRO DA BRISA!') : 'NÍVEL MÁXIMO DA BRISA!'}</small>`, 'gold', d.cost >= 4 ? 4200 : 3400).classList.add('epic');
          } else banner(`<span class="bn-stars">${'★'.repeat(u.star)}</span><b>${esc(d.name)}</b><small>evoluiu!</small>`, 'silver');
          onStarUp(u.star);
        }
        if (msg.me.hp < prevHp) hpHit(prevHp - msg.me.hp);
      }
      prevHp = msg.me.hp;
      prevStars = new Map(msg.me.units.map((u) => [u.id, u.star]));
      if (msg.phase !== 'gameover') $('gameover').classList.add('hidden');
      renderHud();
      checkTips();
      break;
    }
    case 'combat':
      store.combat = msg;
      store.combatStartedAt = performance.now() - (msg.elapsed ?? 0);
      store.scoutId = null;
      setLeftTab('dmg');
      if (!msg.elapsed) sfx('combat');
      if (msg.pve && !msg.elapsed) bossWarning(msg.round, true);
      setTimeout(checkTips, 1500);
      if (!msg.elapsed) trackCombat();
      break;
    case 'gameover': {
      const me = msg.ranking.find((r) => r.id === store.youId);
      const isHost = store.state?.hostId === store.youId;
      const total = msg.mode === 'dupla' ? new Set(msg.ranking.map((r) => r.team)).size : msg.ranking.length;
      const rank = me ? trackGameOver(me.place, total, msg.mode) : null;
      syncRank();
      $('gameover').innerHTML = gameoverHtml(msg.ranking, store.youId, isHost, esc, { mode: msg.mode, rank });
      $('gameover').classList.remove('hidden');
      if (me && me.place <= 4) confetti($('gameover'), me.place === 1 ? 7000 : 3500);
      sfx(me?.place === 1 ? 'win' : 'lose');
      document.getElementById('restartBtn')?.addEventListener('click', () => net.send({ t: 'restart' }));
      $('exitBtn').onclick = () => { location.href = location.pathname; };
      break;
    }
    case 'carousel': {
      const before = store.carousel;
      const wasLocked = !before || before.locked.includes(store.youId);
      store.carousel = msg;
      store.carouselAt = performance.now();
      if (wasLocked && msg.unlocked.includes(store.youId)) { sfx('phase'); toast('🎠 Liberado! Corre pegar o seu!', 'good'); }
      const mine = msg.avatars.find((a) => a.id === store.youId);
      const minePrev = before?.avatars.find((a) => a.id === store.youId);
      if (mine && mine.picked >= 0 && (minePrev?.picked ?? -1) < 0) sfx('buy');
      break;
    }
    case 'portal':
      if (screen !== 'game' && store.state) show('game');
      onPortalMsg(msg);
      break;
    case 'orbOpen':
      store.orbOpens.push({ id: msg.id, x: msg.x, z: msg.z, kind: msg.kind, content: msg.content });
      break;
    case 'chat':
      chatLine(msg.from, msg.msg);
      break;
    case 'emote':
      showEmote(msg.from, msg.e, (from, emoji) => board.avatarEmote(from, emoji));
      break;
    case 'toast':
      toast(msg.msg, msg.kind ?? 'info');
      break;
    case 'error':
      if (screen === 'menu') $('menuError').textContent = msg.msg;
      else toast(msg.msg, 'bad');
      if (msg.msg.includes('não encontrada') || msg.msg.includes('removido') || msg.msg.includes('começou')) {
        net.setRejoin(null);
        if (screen !== 'menu') setTimeout(() => { location.href = location.pathname; }, 1500);
      }
      break;
  }
});

// ---------------- teclado ----------------

window.addEventListener('keydown', (e) => {
  if (e.key === 'F11') { e.preventDefault(); toggleFullscreen(); return; }
  if (e.key === 'Escape' && isGuideOpen()) { closeGuide(); return; }
  if (e.key === 'Escape' && isProfileOpen()) { closeProfile(); return; }
  if (e.key === 'Escape' && isInspectOpen()) { closeInspect(); return; }
  if (e.key === 'Escape' && isPickerOpen()) { closePicker(); return; }
  if ((e.target as HTMLElement).tagName !== 'INPUT' && e.key.toLowerCase() === 'h') { toggleGuide(); return; }
  if (screen !== 'game' || (e.target as HTMLElement).tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (e.repeat && k !== 'd') return;
  if (k >= '1' && k <= '5') {
    (document.querySelector(`#shop .card[data-i="${Number(k) - 1}"]`) as HTMLElement | null)?.click();
  } else if (k === 'd') $('rerollBtn').click();
  else if (k === 'f') $('xpBtn').click();
  else if (k === 'e' && board.hoveredOwnedId) {
    net.send({ t: 'sell', id: board.hoveredOwnedId });
    sfx('sell');
    hideTip();
    board.hoveredOwnedId = null;
  } else if (k === 'enter') $('chatInput').focus();
  else if (k === 'escape') { store.scoutId = null; renderHud(); }
  else if (k === 'tab') { e.preventDefault(); setLeftTab('toggle'); }
  else if (k === 'q' && store.state) {
    // espia o próximo jogador vivo (volta para você no fim da lista)
    const others = store.state.players.filter((p) => p.alive && p.id !== store.youId).map((p) => p.id);
    const i = store.scoutId ? others.indexOf(store.scoutId) : -1;
    store.scoutId = i + 1 < others.length ? others[i + 1] : null;
    sfx('click');
    renderHud();
  }
});

// ---------------- loop ----------------

initHud({
  itemDrag: (pos) => { board.itemDragPos = pos; },
  dropItem: (i, x, y) => {
    const id = board.ownedIdAt(x, y);
    if (!id) { sfx('error'); return; }
    net.send({ t: 'equip', item: i, unitId: id });
    sfx('equip');
  },
});
net.connect();
initEmotes();
initMenuFx();
show('menu');
if (urlRoom && nameInput.value) {
  // volta direto pra sala do link (ex.: recarregou a página)
  net.send({ t: 'join', name: myName(), room: urlRoom.toUpperCase(), token: token!, avatar: myLookKey() });
}

function loop(now: number) {
  board.frame(now);
  if (screen === 'game') tickHud();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/** Chefão do PvE: aviso na preparação e apresentação quando a luta começa. */
function bossWarning(round: number, fight: boolean) {
  const st = stageOf(round).stage;
  const b = st >= 2 ? bossFor(st) : null;
  if (!b?.boss) return;
  const img = `<img class="bn-icon boss" src="${robotPortrait(b.id, b.look)}" alt="">`;
  if (fight) {
    banner(`${img}<small>CHEFÃO</small><b>${esc(b.boss.title)}</b>`, 'gold', 2600).classList.add('epic', 'boss');
    sfx('slam');
  } else {
    banner(`${img}<small>⚠️ chefão na próxima luta</small><b>${esc(b.boss.title)}</b><em>${esc(b.boss.desc)}</em>`, 'silver', 4200).classList.add('boss');
  }
}
