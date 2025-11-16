export default class MadSocket {
  constructor(url = "wss://ws.alimad.co") {
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.reconnectDelay = 1000;
    this.listeners = [];
    this.queue = [];
    this.subscriptions = new Set();
    this.pendingStateRequests = new Map();
    this._reqId = 1;
  }

  connect() {
    if (this.ws && this.ws.readyState === 1) return;
    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      this.connected = true;
      this.flushQueue();
      this._resubscribeAll();
    };

    this.ws.onmessage = e => {
      let msg;
      try { msg = JSON.parse(e.data); }
      catch { msg = e.data; }
      console.warn(msg);

      if (msg.type === "state" && msg.reqId && this.pendingStateRequests.has(msg.reqId)) {
        const fn = this.pendingStateRequests.get(msg.reqId);
        this.pendingStateRequests.delete(msg.reqId);
        fn(msg.result);
        return;
      }

      this.listeners.forEach(cb => cb(msg));
    };

    this.ws.onclose = () => {
      this.connected = false;
      setTimeout(() => this.connect(), this.reconnectDelay);
    };
  }

  _sendRaw(obj) {
    console.log("Sending " + JSON.stringify(obj))
    const open = this.ws && this.ws.readyState === 1;
    if (!open) {
      this.queue.push(obj);
      return;
    }
    this.ws.send(JSON.stringify(obj));
  }

  send(obj) {
    this._sendRaw(obj);
  }

  flushQueue() {
    while (this.queue.length) this._sendRaw(this.queue.shift());
  }

  _resubscribeAll() {
    if (!this.subscriptions.size) return;
    this._sendRaw({ type: 'subscribe', channel: [...this.subscriptions] });
  }

  on(cb) {
    this.listeners.push(cb);
  }

  broadcast(data, channels = [...this.subscriptions]) {
    if (!channels || !channels.length) return;
    this._sendRaw({ type: 'broadcast', channel: channels, data });
  }

  subscribe(ch) {
    console.log("Subscribing to " + ch)
    const arr = Array.isArray(ch) ? ch : [ch];
    arr.forEach(c => this.subscriptions.add(c));
    this._sendRaw({ type: 'subscribe', channel: arr });
  }

  unsubscribe(ch) {
    if (!this.subscriptions.has(ch)) return;
    this.subscriptions.delete(ch);
    this._sendRaw({ type: 'unsubscribe', channel: ch });
  }

  unsubscribeAll() {
    if (!this.subscriptions.size) return;
    this.subscriptions.clear();
    this._sendRaw({ type: 'unsubscribe.all' });
  }

  disconnect() {
    if (!this.ws) return;
    this.ws.onclose = () => {};
    this.ws.close();
    this.ws = null;
    this.connected = false;
    this.subscriptions.clear();
  }

  stateAdd(channel, data) {
    this._sendRaw({
      type: "state",
      action: "add",
      channel,
      data
    });
  }

  stateRemove(channel, keys) {
    this._sendRaw({
      type: "state",
      action: "remove",
      channel,
      data: keys
    });
  }

  stateGet(channel) {
    const reqId = this._reqId++;
    this._sendRaw({
      type: "state",
      action: "get",
      channel,
      reqId
    });

    return new Promise(res => {
      this.pendingStateRequests.set(reqId, res);
    });
  }
}
