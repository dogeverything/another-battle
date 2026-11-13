/**
 * WebSocket Client Manager for Online PvP Room & Match Synchronization
 */
class NetworkManager {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.roomCode = null;
    this.playerIndex = 0; // 0 (Host) or 1 (Guest)
    this.isHost = false;
    this.listeners = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.ws && this.connected) {
        resolve();
        return;
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      // Connect via Vite's /ws proxy or direct port 3006 fallback
      const wsUrl = `${protocol}//${host}/ws`;

      try {
        this.ws = new WebSocket(wsUrl);
      } catch (err) {
        reject(err);
        return;
      }

      this.ws.onopen = () => {
        this.connected = true;
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.emit(msg.type, msg.payload || {});
        } catch (e) {
          console.error('Invalid WS message:', e);
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.emit('DISCONNECTED', {});
      };

      this.ws.onerror = () => {
        if (!this.connected) {
          reject(new Error('Không thể kết nối tới máy chủ Online PvP.'));
        }
      };
    });
  }

  send(type, payload = {}) {
    if (this.ws && this.connected) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(callback);
    return () => this.off(eventType, callback);
  }

  off(eventType, callback) {
    const set = this.listeners.get(eventType);
    if (set) {
      set.delete(callback);
    }
  }

  clearListeners() {
    this.listeners.clear();
  }

  emit(eventType, payload) {
    const set = this.listeners.get(eventType);
    if (set) {
      for (const cb of set) {
        cb(payload);
      }
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
    this.roomCode = null;
  }
}

export const NetClient = new NetworkManager();

