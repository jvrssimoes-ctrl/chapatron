import type { ClientMsg, ServerMsg } from '../../shared/types';

type Handler = (msg: ServerMsg) => void;

export class Net {
  private ws: WebSocket | null = null;
  private handlers: Handler[] = [];
  private queue: ClientMsg[] = [];
  private rejoin: ClientMsg | null = null;
  onStatus: (connected: boolean) => void = () => {};

  connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws = ws;
    ws.onopen = () => {
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
      this.onStatus(false);
      setTimeout(() => this.connect(), 1500);
    };
  }

  /** Mensagem reenviada automaticamente ao reconectar (entrar de volta na sala). */
  setRejoin(msg: ClientMsg | null) { this.rejoin = msg; }

  send(msg: ClientMsg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
    else this.queue.push(msg);
  }

  on(h: Handler) { this.handlers.push(h); }
}

export const net = new Net();
