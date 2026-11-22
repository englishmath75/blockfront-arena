import { randomUUID, randomBytes } from 'node:crypto';
import { MAPS } from './arena.js';
import { AGENTS, GAME_MODES } from './rules.js';

export function roomMiddleware() {
  const rooms = new Map();
  const modes = GAME_MODES;
  const view = (room) => ({
    code: room.code,
    map: room.map,
    mode: room.mode,
    started: room.started,
    connected: [...room.members.values()].filter(m=>m.stream).length,
    host: room.host,
    players: [...room.members.values()].map(({ id, agent, team }) => ({ id, agent, team })),
  });
  const emit = (p, type, data) =>
    p.stream?.write('event: ' + type + '\ndata: ' + JSON.stringify(data) + '\n\n');
  const all = (room, type, data) => room.members.forEach((p) => emit(p, type, data));
  function leave(room, p) {
    room.members.delete(p.token);
    p.stream?.end();
    if (!room.members.size) {
      rooms.delete(room.code);
      return;
    }
    if (room.started) {
      all(room, 'closed', '플레이어가 퇴장하여 경기를 종료했습니다.');
      room.members.forEach((m) => m.stream?.end());
      rooms.delete(room.code);
    } else {
      if (room.host === p.id) room.host = room.members.values().next().value.id;
      all(room, 'room', view(room));
    }
  }
  async function middleware(req, res, next) {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/arena-api/')) return next();
    const action = url.pathname.slice(11);
    const reply = (status, data) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify(data));
    };
    if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)
      return reply(403, { error: '다른 출처의 요청입니다.' });
    try {
      let data = {};
      if (req.method === 'POST') {
        let size = 0,
          parts = [];
        for await (const part of req) {
          size += part.length;
          if (size > 120000) return reply(413, { error: '메시지가 너무 큽니다.' });
          parts.push(part);
        }
        data = JSON.parse(Buffer.concat(parts).toString() || '{}');
      } else if (action !== 'events') return reply(405, { error: '지원하지 않는 요청입니다.' });
      let room = rooms.get(String(data.code ?? url.searchParams.get('code') ?? '').toUpperCase());
      if (action === 'join') {
        if (
          !Object.hasOwn(AGENTS, data.agent) ||
          !modes.includes(data.mode) ||
          !MAPS.some((m) => m.name === data.map)
        )
          return reply(400, { error: '선택 항목을 확인하세요.' });
        if (data.code && !room) return reply(404, { error: '방 코드를 확인하세요.' });
        if (!room && data.queue)
          room = [...rooms.values()].find(
            (r) => r.queue && !r.started && r.mode === data.mode && r.map === data.map && r.members.size < 10,
          );
        if (!room) {
          const code = randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
          room = {
            code,
            map: data.map,
            mode: data.mode,
            queue: !!data.queue,
            started: false,
            members: new Map(),
            host: null,
          };
          rooms.set(code, room);
        }
        if (room.started || room.members.size >= 10) return reply(409, { error: '참가할 자리가 없습니다.' });
        const blue = [...room.members.values()].filter((p) => p.team === 'blue').length;
        const p = {
          id: randomUUID(),
          token: randomUUID(),
          agent: data.agent,
          team: blue <= room.members.size - blue ? 'blue' : 'amber',
        };
        room.members.set(p.token, p);
        room.host ??= p.id;
        setTimeout(() => {
          if (!p.stream && room.members.has(p.token)) leave(room, p);
        }, 15000).unref();
        all(room, 'room', view(room));
        return reply(200, { room: view(room), id: p.id, token: p.token });
      }
      const token = req.headers.authorization?.replace(/^Bearer /, '') ?? url.searchParams.get('key');
      const p = room?.members.get(token);
      if (!p) return reply(404, { error: '종료된 방입니다.' });
      if (action === 'events') {
        p.stream?.end();
        p.stream = res;
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'X-Accel-Buffering': 'no',
        });
        all(room, 'room', view(room));
        const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 20000);
        heartbeat.unref();
        res.on('close', () => {
          clearInterval(heartbeat);
          if (p.stream === res && room.members.has(p.token)) {
            p.stream = null;
            if(!room.started)all(room,'room',view(room));
            setTimeout(() => {
              if (!p.stream && room.members.has(p.token)) leave(room, p);
            }, 3000).unref();
          }
        });
        if (room.queue && room.members.size === 10 && [...room.members.values()].every((m) => m.stream)) {
          room.started = true;
          all(room, 'start', view(room));
        }
        return;
      }
      if (action === 'start') {
        if (
          p.id !== room.host ||
          room.started ||
          room.members.size < (room.mode === '경쟁전' ? 10 : 2) ||
          ![...room.members.values()].every((m) => m.stream)
        )
          return reply(409, { error: '접속한 플레이어 두 명이 필요합니다.' });
        room.started = true;
        all(room, 'start', view(room));
      } else if (action === 'leave') leave(room, p);
      else if (action === 'input' && room.started) {
        const host = [...room.members.values()].find((m) => m.id === room.host);
        emit(host, 'input', { from: p.id, input: data.input });
      } else if (action === 'state' && room.started && p.id === room.host) {
        room.members.forEach((m) => {
          if (m.id !== p.id) emit(m, 'state', data.state);
        });
      } else return reply(400, { error: '요청을 처리할 수 없습니다.' });
      return reply(200, { ok: true });
    } catch {
      return reply(400, { error: '요청을 읽을 수 없습니다.' });
    }
  }
  return middleware;
}
