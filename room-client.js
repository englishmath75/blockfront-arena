export class PlayerRoom {
  constructor(onEvent) {
    this.onEvent = onEvent;
  }
  async request(action, body = {}, joining = false) {
    const response = await fetch('/arena-api/' + action, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: 'Bearer ' + this.token } : {}),
      },
      body: JSON.stringify({ ...body, code: joining ? body.code : this.room.code }),
      signal: AbortSignal.timeout(joining?60000:8000),
    });
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error),{status:response.status});
    return result;
  }
  async join(options) {
    const result = await this.request('join', options, true);
    Object.assign(this, result);
    this.source = new EventSource(
      '/arena-api/events?' + new URLSearchParams({ code: this.room.code, key: this.token }),
    );
    for (const type of ['room', 'start', 'input', 'state', 'voice', 'closed'])
      this.source.addEventListener(type, (event) => {
        const data = JSON.parse(event.data);
        if (type === 'room' || type === 'start') this.room = data;
        this.onEvent(type, data);
      });
    this.source.onopen = () => { clearTimeout(this.reconnect); this.reconnect=null; };
    this.source.onerror = () => {
      if(this.room?.started && !this.reconnect)
        this.reconnect=setTimeout(()=>this.onEvent('closed','경기 연결이 끊겼습니다.'),12000);
    };
  }
  async leave() {
    if (!this.room) return;
    clearTimeout(this.reconnect);
    this.source?.close();
    try {
      await this.request('leave');
    } catch {
      /* room already closed */
    }
  }
  get host() {
    return this.room != null && this.id != null && this.id === this.room.host;
  }
}
