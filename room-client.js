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
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    return result;
  }
  async join(options) {
    const result = await this.request('join', options, true);
    Object.assign(this, result);
    this.source = new EventSource(
      '/arena-api/events?' + new URLSearchParams({ code: this.room.code, key: this.token }),
    );
    for (const type of ['room', 'start', 'input', 'state', 'closed'])
      this.source.addEventListener(type, (event) => {
        const data = JSON.parse(event.data);
        if (type === 'room' || type === 'start') this.room = data;
        this.onEvent(type, data);
      });
    this.source.onerror = () => {
      if (this.room?.started) this.onEvent('closed', '경기 연결이 끊겼습니다.');
    };
  }
  async leave() {
    if (!this.room) return;
    this.source?.close();
    try {
      await this.request('leave');
    } catch {
      /* room already closed */
    }
  }
  get host() {
    return this.id === this.room?.host;
  }
}
