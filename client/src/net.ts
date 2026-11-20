import type { ClientMsg, ServerMsg } from '../../shared/types';

type Handler = (msg: ServerMsg) => void;

// Só estas mensagens esperam a conexão voltar; ações de jogo feitas offline são descartadas
// (reenviar uma compra ou venda antiga depois de reconectar surpreende o jogador).
const QUEUEABLE = new Set<ClientMsg['t']>(['create', 'join', 'chat']);

export class Net {
  private ws: WebSocket | null = null;
  private handlers: Handler[] = [];
  private queue: ClientMsg[] = [];
  private rejoin: ClientMsg | null = null;
  private retries = 0;
  private retryTimer = 0;
  onStatus: (connected: boolean) => void = () => {};

  constructor() {
    // volta logo quando a internet ou a aba voltam, sem esperar o próximo intervalo
    const kick = () => {
      if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
      clearTimeout(this.retryTimer);
      this.connect();
    };
    window.addEventListener('online', kick);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  }

  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    ws.onopen = () => {
      this.retries = 0;
      this.onStatus(true);
      if (this.rejoin) ws.send(JSON.stringify(this.rejoin));
      for (const m of this.queue) ws.send(JSON.stringify(m));
      this.queue = [];
    };
    ws.onmessage = (e) => {
      let msg: ServerMsg;
      try { msg = JSON.parse(e.data); } catch { return; }
      for (const h of this.handlers) h(msg);
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.onStatus(false);
      // espera crescente: 0,5s, 1s, 2s, 4s... até 8s
      const wait = Math.min(8000, 500 * 2 ** this.retries++);
      this.retryTimer = window.setTimeout(() => this.connect(), wait);
    };
  }

  /** Mensagem reenviada automaticamente ao reconectar (entrar de volta na sala). */
  setRejoin(msg: ClientMsg | null) { this.rejoin = msg; }

  get connected() { return this.ws?.readyState === WebSocket.OPEN; }

  send(msg: ClientMsg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
    else if (QUEUEABLE.has(msg.t)) this.queue.push(msg);
  }

  on(h: Handler) { this.handlers.push(h); }
}

export const net = new Net();
