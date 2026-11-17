/* SEKHEM — 세켐의 봉인. 주사위 3개 + 사칙연산 숫자 카드 레이스 (오리지널 구성) */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rand = n => Math.floor(Math.random() * n);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const mkStore = s => ({ get(k, d) { try { const v = s().getItem(k); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { s().setItem(k, v); } catch (e) { } } });
  const LS = mkStore(() => localStorage), SS = mkStore(() => sessionStorage);

  /* ================= rules ================= */
  const DICE = [6, 8, 12];
  const SEARCH_MS = 60000, ROLL_MS = 15000, REVEAL_MS = 3800, MAX_ROUNDS = 16;
  // 피라미드: 위(0층)부터 아래로. 위층일수록 큰 수 · 높은 점수
  const TIERS = [
    { n: 3, lo: 100, hi: 200, pts: 5, g: '𓂀', name: '매장실' },
    { n: 6, lo: 61, hi: 99, pts: 4, g: '𓇳', name: '태양의 방' },
    { n: 8, lo: 31, hi: 60, pts: 3, g: '𓋹', name: '앙크의 회랑' },
    { n: 10, lo: 13, hi: 30, pts: 2, g: '𓆣', name: '스카라브 계단' },
    { n: 12, lo: 1, hi: 12, pts: 1, g: '𓉐', name: '입구' },
  ];
  const COLORS = [
    { name: '홍옥', c: '#c8432f', l: '#ff8a6e' },
    { name: '청금석', c: '#2a58cc', l: '#7fa6ff' },
    { name: '공작석', c: '#178f62', l: '#64e0ac' },
    { name: '자수정', c: '#8546c2', l: '#c99bff' },
  ];
  const OPS = { '+': '+', '-': '−', '*': '×', '/': '÷' };

  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
  const fr = (n, d = 1) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; };
  function evaluate(tokens, vals) {
    let p = 0;
    const peek = () => tokens[p];
    function factor() {
      const t = tokens[p];
      if (!t) throw 0;
      if (t.t === 'n') { p++; return fr(vals[t.i]); }
      if (t.t === '(') { p++; const v = expr(); if (!tokens[p] || tokens[p].t !== ')') throw 0; p++; return v; }
      throw 0;
    }
    function term() {
      let v = factor();
      while (peek() && peek().t === 'o' && (peek().v === '*' || peek().v === '/')) {
        const o = tokens[p++].v, r = factor();
        if (o === '*') v = fr(v.n * r.n, v.d * r.d);
        else { if (r.n === 0) throw 0; v = fr(v.n * r.d, v.d * r.n); }
      }
      return v;
    }
    function expr() {
      let v = term();
      while (peek() && peek().t === 'o' && (peek().v === '+' || peek().v === '-')) {
        const o = tokens[p++].v, r = term();
        v = o === '+' ? fr(v.n * r.d + r.n * v.d, v.d * r.d) : fr(v.n * r.d - r.n * v.d, v.d * r.d);
      }
      return v;
    }
    const v = expr();
    if (p !== tokens.length) throw 0;
    return v;
  }
  const tryEval = (tokens, vals) => { try { return tokens.length ? evaluate(tokens, vals) : null; } catch (e) { return null; } };
  const tokStr = (tokens, vals) => tokens.map(t => t.t === 'n' ? vals[t.i] : t.t === 'o' ? OPS[t.v] : t.t).join(' ').replace(/\( /g, '(').replace(/ \)/g, ')');
  const usesAll = tokens => new Set(tokens.filter(t => t.t === 'n').map(t => t.i)).size >= 2; // 주사위 2개 이상 (각각 최대 한 번)

  function sanitize(tokens) {
    if (!Array.isArray(tokens) || tokens.length > 20) return null;
    const used = new Set(), out = [];
    for (const t of tokens) {
      if (!t || typeof t !== 'object') return null;
      if (t.t === 'n') { if (!Number.isInteger(t.i) || t.i < 0 || t.i > 2 || used.has(t.i)) return null; used.add(t.i); out.push({ t: 'n', i: t.i }); }
      else if (t.t === 'o') { if (!OPS[t.v]) return null; out.push({ t: 'o', v: t.v }); }
      else if (t.t === '(' || t.t === ')') out.push({ t: t.t });
      else return null;
    }
    return out;
  }

  // 주사위 2~3개로 만들 수 있는 모든 양의 정수 → 예시 식 (2개짜리 식 우선)
  function allValues(d) {
    const out = new Map(), N = i => ({ t: 'n', i }), O = v => ({ t: 'o', v });
    const P = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]], OP = ['+', '-', '*', '/'];
    for (const [a, b] of P) for (const o of OP) {
      const tk = [N(a), O(o), N(b)], v = tryEval(tk, d);
      if (v && v.d === 1 && v.n > 0 && !out.has(v.n)) out.set(v.n, tk);
    }
    for (const [a, b, c] of P) for (const o1 of OP) for (const o2 of OP) {
      for (const tk of [[N(a), O(o1), N(b), O(o2), N(c)], [{ t: '(' }, N(a), O(o1), N(b), { t: ')' }, O(o2), N(c)], [N(a), O(o1), { t: '(' }, N(b), O(o2), N(c), { t: ')' }]]) {
        const v = tryEval(tk, d);
        if (v && v.d === 1 && v.n > 0 && !out.has(v.n)) out.set(v.n, tk);
      }
    }
    return out;
  }
  let REACH = null; // 어떤 주사위 조합으로든 만들 수 있는 수
  function reachAll() {
    if (REACH) return REACH;
    REACH = new Set();
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 8; b++) for (let c = 1; c <= 12; c++) for (const v of allValues([a, b, c]).keys()) REACH.add(v);
    return REACH;
  }
  function makeCards() {
    const R = reachAll(), cards = [];
    TIERS.forEach((t, ti) => {
      const pool = []; for (let v = t.lo; v <= t.hi; v++) if (R.has(v)) pool.push(v);
      shuffle(pool).slice(0, t.n).sort((x, y) => x - y).forEach(v => cards.push({ v, tier: ti, pts: t.pts, owner: null }));
    });
    return cards;
  }

  const log = (st, html) => { st.log.unshift(html); st.log.length = Math.min(st.log.length, 40); };
  const pname = p => `<b style="color:${COLORS[p.color].l}">${esc(p.name)}</b>`;
  const active = st => st.players.filter(p => p.online !== false);

  function createState(local) {
    return { phase: 'lobby', local, players: [], hostId: null, cards: [], dice: [1, 1, 1], roller: 0, round: 0, stage: 'roll', deadline: 0, log: [], winner: null, event: null, seq: 0, rollSeq: 0, missed: null };
  }
  function addPlayer(st, id, name) {
    if (st.players.length >= 4) return null;
    const used = new Set(st.players.map(p => p.color));
    const color = [0, 1, 2, 3].find(c => !used.has(c));
    const p = { id, name: (String(name || '').trim().slice(0, 12)) || COLORS[color].name, color, stack: [], score: 0, acted: false, got: null, online: true };
    st.players.push(p);
    return p;
  }
  function startGame(st) {
    st.phase = 'play'; st.winner = null; st.event = null; st.round = 0; st.log = []; st.missed = null;
    st.cards = makeCards();
    st.players.forEach(p => { p.stack = []; p.score = 0; p.acted = false; p.got = null; });
    st.roller = rand(st.players.length);
    log(st, '피라미드의 봉인이 드러났다. 주사위를 굴려 숫자 카드를 손에 넣어라.');
    toRollStage(st);
  }
  function toRollStage(st) {
    st.round++;
    st.stage = 'roll';
    st.deadline = Date.now() + ROLL_MS;
    st.players.forEach(p => { p.acted = false; p.got = null; });
    st.missed = null;
  }
  function roll(st) {
    const free = new Set(st.cards.filter(c => !c.owner).map(c => c.v));
    let d;
    for (let k = 0; k < 40; k++) {
      d = DICE.map(n => 1 + rand(n));
      if ([...allValues(d).keys()].some(v => free.has(v))) break;
    }
    st.dice = d; st.stage = 'search'; st.deadline = Date.now() + SEARCH_MS; st.rollSeq++;
    log(st, `${pname(st.players[st.roller])}의 주사위 — <span class="lx">${d.join(' · ')}</span>`);
  }
  function claim(st, p, rawTokens) {
    const tokens = sanitize(rawTokens);
    if (!tokens || !usesAll(tokens)) return 'all';
    const v = tryEval(tokens, st.dice);
    if (!v || v.d !== 1) return 'int';
    const card = st.cards.find(c => !c.owner && c.v === v.n);
    const ex = tokStr(tokens, st.dice);
    if (card) {
      card.owner = p.id; p.stack.push({ v: card.v, pts: card.pts, tier: card.tier }); p.score += card.pts;
      p.acted = true; p.got = card.v;
      st.event = { seq: ++st.seq, kind: 'take', pid: p.id, v: card.v, pts: card.pts, ex };
      log(st, `${pname(p)} <span class="lx">${esc(ex)} = ${card.v}</span> 획득 <b>+${card.pts}</b>`);
      return true;
    }
    return 'none';
  }
  function endRound(st) {
    st.stage = 'reveal'; st.deadline = Date.now() + REVEAL_MS;
    const free = st.cards.filter(c => !c.owner);
    const av = allValues(st.dice);
    const best = free.filter(c => av.has(c.v)).sort((a, b) => b.pts - a.pts || b.v - a.v)[0];
    st.missed = best ? { v: best.v, pts: best.pts, ex: tokStr(av.get(best.v), st.dice) } : null;
    st.event = { seq: ++st.seq, kind: 'reveal' };
  }
  function afterReveal(st) {
    if (st.round >= MAX_ROUNDS) { finish(st); return; }
    st.roller = (st.roller + 1) % st.players.length;
    toRollStage(st);
    refill(st);
  }
  // 가져간 자리에 같은 단의 새 카드를 채움 (판에 없는 숫자 우선)
  function refill(st) {
    const R = reachAll(); let n = 0;
    st.cards.forEach((c, k) => {
      if (!c.owner) return;
      const t = TIERS[c.tier], onBoard = new Set(st.cards.filter(x => !x.owner).map(x => x.v));
      const pool = []; for (let v = t.lo; v <= t.hi; v++) if (R.has(v) && !onBoard.has(v) && v !== c.v) pool.push(v);
      const v = pool.length ? pool[rand(pool.length)] : c.v;
      st.cards[k] = { v, tier: c.tier, pts: t.pts, owner: null, fresh: st.round };
      n++;
    });
    if (n) log(st, `빈 자리에 새 카드 ${n}장이 놓였다.`);
  }
  function finish(st) {
    st.phase = 'over'; st.deadline = 0;
    const rank = [...st.players].sort((a, b) => b.score - a.score || b.stack.length - a.stack.length);
    st.winner = rank[0].id;
    log(st, `${pname(rank[0])} 승리! 𓂀`);
  }
  function maybeEndRound(st) { if (st.stage === 'search' && active(st).every(p => p.acted)) endRound(st); }

  // returns true (state changed) | false | string (rejection reason for the sender)
  function applyAction(st, pid, a) {
    if (!a || typeof a !== 'object') return false;
    if (a.type === 'start' || a.type === 'restart') {
      if ((st.local || pid === st.hostId) && st.players.length >= 2 && (st.phase === 'lobby' || (a.type === 'restart' && st.phase === 'over'))) { startGame(st); return true; }
      if (st.local && st.players.length >= 1 && st.phase !== 'play') { startGame(st); return true; }
      return false;
    }
    if (st.phase !== 'play') return false;
    if (a.type === 'roll') {
      if (st.stage !== 'roll') return false;
      if (!st.local && st.players[st.roller].id !== pid) return false;
      roll(st); return true;
    }
    if (st.stage !== 'search') return false;
    const p = st.players.find(x => x.id === (st.local ? a.as : pid));
    if (!p || p.acted) return false;
    if (a.type === 'pass') { p.acted = true; p.got = 'pass'; log(st, `${pname(p)} 패스`); maybeEndRound(st); return true; }
    if (a.type === 'claim') { const r = claim(st, p, a.tokens); if (r === true) maybeEndRound(st); return r; }
    return false;
  }
  function hostTimers(st) {
    if (st.phase !== 'play' || !st.deadline || Date.now() < st.deadline) return false;
    if (st.stage === 'roll') { roll(st); return true; }
    if (st.stage === 'search') { st.players.forEach(p => { if (!p.acted) { p.acted = true; p.got = 'pass'; } }); log(st, '모래시계가 다 떨어졌다.'); endRound(st); return true; }
    if (st.stage === 'reveal') { afterReveal(st); return true; }
    return false;
  }
  const publicState = st => ({ ...st, deadlineIn: st.deadline ? Math.max(0, st.deadline - Date.now()) : 0 });

  /* ================= host / network ================= */
  const PREFIX = 'sekhem-hxh-v2-';
  const PEER_OPTS = { debug: 0, config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478' }] } };
  const makeCode = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += A[rand(A.length)]; return s; };
  let myId = SS.get('sekhem.cid', null);
  if (!myId) { myId = 'p' + Math.random().toString(36).slice(2, 10); SS.set('sekhem.cid', myId); }

  const net = { mode: null, peer: null, conns: new Map(), conn: null, code: '', retry: 0, timerI: null };
  let H = null;

  function teardown() {
    clearInterval(net.timerI); net.timerI = null;
    try { net.peer && net.peer.destroy(); } catch (e) { }
    net.peer = null; net.conn = null; net.conns.clear(); net.mode = null; net.code = '';
    H = null;
  }
  function publish() {
    const pub = publicState(H);
    const msg = { type: 'state', st: pub };
    net.conns.forEach(c => { if (c.open) try { c.send(msg); } catch (e) { } });
    receive(pub);
  }
  function hostTick() { if (H && hostTimers(H)) publish(); }
  function hostDispatch(pid, a, reply) {
    const r = applyAction(H, pid, a);
    if (r === true) publish();
    else if (typeof r === 'string') reply(r);
  }

  function startLocal(names) {
    teardown();
    net.mode = 'local';
    H = createState(true);
    names.forEach((n, i) => addPlayer(H, 'L' + i, n));
    startGame(H);
    ui.screen = 'game';
    net.timerI = setInterval(hostTick, 400);
    publish();
  }
  function hostOnline(name, attempt = 0) {
    teardown();
    if (!window.Peer) { toast('네트워크 모듈을 불러오지 못했습니다. 새로고침 해주세요.'); return; }
    net.mode = 'host';
    net.code = makeCode();
    ui.screen = 'connecting'; ui.connMsg = '봉인실을 여는 중…'; render();
    const peer = net.peer = new Peer(PREFIX + net.code, PEER_OPTS);
    peer.on('open', () => {
      H = createState(false);
      H.hostId = myId; H.code = net.code;
      addPlayer(H, myId, name);
      ui.screen = 'lobby';
      net.timerI = setInterval(hostTick, 400);
      publish();
    });
    peer.on('connection', conn => {
      conn.on('data', d => onHostMsg(conn, d));
      conn.on('close', () => {
        const pid = conn._pid;
        if (pid && H && net.conns.get(pid) === conn) {
          net.conns.delete(pid);
          const p = H.players.find(x => x.id === pid);
          if (p) {
            if (H.phase === 'lobby') H.players = H.players.filter(x => x.id !== pid);
            else { p.online = false; maybeEndRound(H); }
            publish();
          }
        }
      });
    });
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { } });
    peer.on('error', e => {
      if (e.type === 'unavailable-id' && attempt < 4) return hostOnline(name, attempt + 1);
      if (H) { if (e.type !== 'peer-unavailable') toast('연결 오류: ' + e.type); return; }
      ui.screen = 'menu'; render(); toast('방을 만들 수 없습니다 (' + e.type + '). 잠시 후 다시 시도하세요.');
    });
  }
  function onHostMsg(conn, d) {
    if (!H || !d || typeof d !== 'object') return;
    if (d.type === 'hello') {
      const pid = String(d.cid || '').slice(0, 20);
      if (!pid) return;
      let p = H.players.find(x => x.id === pid);
      if (!p) {
        if (H.phase !== 'lobby') { conn.send({ type: 'reject', reason: '이미 게임이 진행 중인 방입니다.' }); return; }
        if (H.players.length >= 4) { conn.send({ type: 'reject', reason: '방이 가득 찼습니다 (최대 4인).' }); return; }
        p = addPlayer(H, pid, d.name);
        log(H, `${pname(p)} 입장`);
      } else { p.online = true; }
      const old = net.conns.get(pid);
      if (old && old !== conn) try { old.close(); } catch (e) { }
      conn._pid = pid;
      net.conns.set(pid, conn);
      publish();
      return;
    }
    if (d.type === 'act' && conn._pid) hostDispatch(conn._pid, d.action, r => { try { conn.send({ type: 'nack', reason: r }); } catch (e) { } });
  }
  function joinOnline(code, name) {
    teardown();
    if (!window.Peer) { toast('네트워크 모듈을 불러오지 못했습니다. 새로고침 해주세요.'); return; }
    net.mode = 'client'; net.code = code; net.retry = 0;
    ui.screen = 'connecting'; ui.connMsg = `봉인 ${code} 을(를) 찾는 중…`; render();
    const peer = net.peer = new Peer(PEER_OPTS);
    const connect = () => {
      const conn = net.conn = peer.connect(PREFIX + code, { reliable: true });
      conn.on('open', () => { net.retry = 0; conn.send({ type: 'hello', cid: myId, name }); });
      conn.on('data', d => {
        if (!d) return;
        if (d.type === 'state') { if (ui.screen === 'connecting' || ui.screen === 'menu') ui.screen = d.st.phase === 'lobby' ? 'lobby' : 'game'; receive(d.st); }
        if (d.type === 'nack') rejectMsg(d.reason);
        if (d.type === 'reject') { teardown(); ui.st = null; ui.screen = 'menu'; render(); toast(d.reason); }
      });
      conn.on('close', () => {
        if (net.mode !== 'client' || net.conn !== conn) return;
        if (net.retry++ < 8) { toast('연결이 끊겼습니다. 재접속 중…'); setTimeout(() => net.mode === 'client' && connect(), 2500); }
        else { teardown(); ui.st = null; ui.screen = 'menu'; render(); toast('호스트와의 연결이 끊겼습니다.'); }
      });
    };
    peer.on('open', connect);
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) { } });
    peer.on('error', e => {
      if (e.type === 'peer-unavailable') {
        if (ui.st && net.retry && net.retry < 8) return;
        teardown(); ui.screen = 'menu'; ui.joinCode = code; render(); toast('그 봉인(방)을 찾을 수 없습니다. 코드를 확인하세요.');
      } else if (!ui.st) { teardown(); ui.screen = 'menu'; render(); toast('연결 실패: ' + e.type); }
    });
  }
  function send(a) {
    if (H) { hostDispatch(myId, a, rejectMsg); return; }
    if (net.conn && net.conn.open) try { net.conn.send({ type: 'act', cid: myId, action: a }); } catch (e) { }
  }
  function rejectMsg(r) {
    toast({ all: '주사위를 2개 이상 사용해야 합니다', int: '결과가 자연수가 아닙니다', none: '그 숫자의 카드가 남아있지 않습니다 (이미 누가 가져갔어요)' }[r] || '처리할 수 없는 요청');
    const ex = $('#expr'); if (ex) { ex.classList.remove('shake'); void ex.offsetWidth; ex.classList.add('shake'); }
  }

  /* ================= UI ================= */
  const gameEl = document.getElementById('game');
  const ui = { screen: 'title', st: null, tokens: [], key: '', lastSeq: 0, lastRoll: 0, localDeadline: 0, joinCode: '', connMsg: '', escT: 0, prevScreen: 'title', localN: 2, rolling: false };
  const inviteURL = code => `${location.origin}${location.pathname}?t=4471&seal=${code}`;
  const me = () => ui.st && ui.st.players.find(p => p.id === myId);
  const canBuild = () => { const st = ui.st; if (!st || st.phase !== 'play' || st.stage !== 'search' || ui.rolling) return false; if (st.local) return st.players.some(p => !p.acted); const m = me(); return !!m && !m.acted; };

  function receive(st) {
    const prev = ui.st;
    // capture card position before re-render for the fly animation
    let fly = null;
    if (ui.screen === 'game' && st.event && st.event.seq > ui.lastSeq && st.event.kind === 'take') {
      const src = document.querySelector(`.ncard[data-v="${st.event.v}"]`);
      if (src) fly = { rect: src.getBoundingClientRect(), html: src.outerHTML, ev: st.event };
    }
    ui.st = st;
    ui.localDeadline = st.deadlineIn ? Date.now() + st.deadlineIn : 0;
    if (st.phase !== 'lobby' && (ui.screen === 'lobby' || ui.screen === 'connecting')) ui.screen = 'game';
    if (st.phase === 'lobby' && ui.screen === 'game') { ui.screen = 'lobby'; gameEl.innerHTML = ''; }
    const key = `${st.phase}|${st.round}|${st.stage}|${st.dice.join()}`;
    if (st.event && st.event.seq > ui.lastSeq && st.event.kind === 'take' && (st.local || st.event.pid === myId)) ui.tokens = [];
    if (key !== ui.key) { ui.key = key; ui.tokens = []; }
    const fresh = !prev || prev.phase === 'lobby' || ui.screen !== 'game';
    if (fresh) { ui.lastSeq = st.event ? st.event.seq : 0; ui.lastRoll = st.rollSeq; }
    const doRoll = !fresh && st.rollSeq > ui.lastRoll;
    ui.lastRoll = st.rollSeq;
    render();
    if (ui.screen !== 'game') return;
    if (doRoll) rollAnim();
    if (st.event && st.event.seq > ui.lastSeq) {
      ui.lastSeq = st.event.seq;
      if (fly) flyCard(fly);
      if (st.event.kind === 'take') showBanner(st.event);
      if (st.event.kind === 'reveal') showReveal(st);
    }
  }

  function render() {
    gameEl.dataset.screen = ui.screen;
    if (ui.screen === 'game') { if (!$('.g-root', gameEl)) buildGame(); updateGame(); return; }
    const S = { title: titleScreen, menu: menuScreen, rules: rulesScreen, local: localScreen, connecting: connScreen, lobby: lobbyScreen }[ui.screen] || titleScreen;
    gameEl.innerHTML = `<div class="scr"><div class="sky-stars"></div><div class="dunes"><i></i><i></i></div><div class="scr-in">${S()}</div></div>`;
  }
  const brand = small => `<div class="brand ${small ? 'sm' : ''}"><div class="brand-eye">𓂀</div><div class="brand-name">SEKHEM</div><div class="brand-sub">세켐의 봉인</div></div>`;
  const dotS = c => `style="--c:${COLORS[c].c};--l:${COLORS[c].l}"`;

  function titleScreen() {
    return `${brand()}
      <p class="tagline">세 개의 주사위, 네 개의 연산.<br>누구보다 먼저 피라미드의 숫자를 풀어내라.</p>
      <div class="btn-col">
        <button class="btn gold" data-act="go-menu">입장하기</button>
        <button class="btn ghost" data-act="go-rules">게임 방법</button>
      </div>
      <div class="foot-note">ESC 두 번 — 포럼 화면으로 즉시 숨기</div>`;
  }
  function menuScreen() {
    return `${brand(true)}
      <div class="card">
        <label class="lbl">당신의 이름</label>
        <input class="inp" id="in-name" maxlength="12" placeholder="예: 네페르" value="${esc(LS.get('sekhem.name', ''))}">
        <div class="split">
          <div class="pane"><h3>온라인 방 만들기</h3><p>코드를 친구에게 공유하세요. 2–4인.</p><button class="btn gold" data-act="host">새 방 열기</button></div>
          <div class="pane"><h3>코드로 참가</h3>
            <input class="inp code" id="in-code" maxlength="5" placeholder="ABCDE" value="${esc(ui.joinCode)}" autocapitalize="characters" autocomplete="off">
            <button class="btn lapis" data-act="join">참가</button></div>
        </div>
        <button class="btn ghost wide" data-act="go-local">한 기기에서 함께 하기</button>
      </div>
      <button class="link" data-act="go-title">← 처음으로</button>`;
  }
  function localScreen() {
    const n = ui.localN;
    return `${brand(true)}
      <div class="card">
        <label class="lbl">인원</label>
        <div class="seg">${[1, 2, 3, 4].map(k => `<button class="${k === n ? 'on' : ''}" data-act="local-n" data-n="${k}">${k === 1 ? '혼자 연습' : k + '인'}</button>`).join('')}</div>
        ${Array.from({ length: n }, (_, i) => `<div class="pl-in"><span class="dot" ${dotS(i)}></span><input class="inp" id="ln-${i}" maxlength="12" placeholder="${COLORS[i].name}"></div>`).join('')}
        <p class="hint">한 화면을 같이 보며 식을 먼저 찾은 사람이 자기 색 버튼으로 카드를 가져갑니다.</p>
        <button class="btn gold wide" data-act="local-start">시작</button>
      </div>
      <button class="link" data-act="go-menu">← 뒤로</button>`;
  }
  const connScreen = () => `${brand(true)}<div class="spinner"></div><p class="tagline">${esc(ui.connMsg)}</p><button class="link" data-act="leave">취소</button>`;
  function lobbyScreen() {
    const st = ui.st; if (!st) return connScreen();
    const isHost = st.hostId === myId, code = st.code || net.code;
    return `${brand(true)}
      <div class="card lobby">
        <div class="lbl">봉인 코드</div>
        <div class="room-code">${esc(code)}</div>
        <div class="row-btns"><button class="btn sm lapis" data-act="share">초대 링크 공유</button><button class="btn sm ghost dark" data-act="copy-code">코드 복사</button></div>
        <div class="lbl" style="margin-top:18px">참가자 ${st.players.length}/4</div>
        <ul class="plist">${st.players.map(p => `<li><span class="dot" ${dotS(p.color)}></span>${esc(p.name)}${p.id === st.hostId ? '<em>호스트</em>' : ''}${p.id === myId ? '<em class="me">나</em>' : ''}</li>`).join('')}</ul>
        ${isHost ? `<button class="btn gold wide" data-act="start" ${st.players.length < 2 ? 'disabled' : ''}>${st.players.length < 2 ? '참가자를 기다리는 중…' : '게임 시작'}</button>` : '<p class="wait">호스트가 게임을 시작하기를 기다리는 중…</p>'}
      </div>
      <button class="link" data-act="leave">← 나가기</button>`;
  }
  function rulesScreen() {
    return `${brand(true)}
      <div class="card rules">
        <h2>목표</h2>
        <p>피라미드에 놓인 숫자 카드를 사칙연산으로 풀어 모읍니다. 게임이 끝났을 때 <b>점수가 가장 높은 사람</b>이 승리합니다.</p>
        <h2>진행</h2>
        <ol>
          <li><b>주사위 담당</b>이 주사위 3개(6면·8면·12면)를 굴립니다. 담당은 매 라운드 다음 사람에게 넘어갑니다.</li>
          <li>주사위가 멈추는 순간 <b>모든 플레이어가 동시에</b> 카드를 찾습니다. 굴린 사람에게 우선권은 없습니다.</li>
          <li>세 주사위 중 <b>2개 이상</b>을 골라 (각각 한 번씩만) 사용하고, <b>+ − × ÷</b>와 괄호를 자유롭게 써서 피라미드에 남은 카드의 숫자를 만들면 그 카드를 가져갑니다. (× ÷ 먼저 계산)</li>
          <li>한 라운드에 한 사람당 <b>카드 1장</b>. 모두 가져가거나 패스하면, 또는 60초가 지나면 라운드가 끝납니다.</li>
        </ol>
        <h2>카드와 점수</h2>
        <table class="tbl">${TIERS.map(t => `<tr><td><span class="tg">${t.g}</span> ${t.name}</td><td>${t.lo === 1 ? '1–12' : t.lo + '–' + t.hi}</td><td><b>${t.pts}점</b></td></tr>`).join('')}</table>
        <h2>새 카드</h2>
        <p>라운드가 끝나면 카드를 가져간 빈 자리에 <b>같은 단의 새 카드</b>가 채워집니다. 피라미드는 항상 가득 찬 상태로 다음 라운드가 시작됩니다.</p>
        <h2>종료</h2>
        <p>${MAX_ROUNDS}라운드가 끝나면 종료됩니다. 동점이면 카드를 더 많이 가진 사람이 이깁니다.</p>
        <h2>온라인</h2>
        <p>방을 만든 사람(호스트)의 기기가 게임을 진행합니다. 호스트가 창을 닫으면 게임이 끝납니다.</p>
      </div>
      <button class="btn ghost" data-act="back">돌아가기</button>`;
  }

  /* ---------- game screen ---------- */
  const DIE_SHAPE = ['d6', 'd8', 'd12'];
  function buildGame() {
    gameEl.innerHTML = `
    <div class="g-root">
      <header class="g-top">
        <button class="icon-btn" data-act="toggle-menu" aria-label="메뉴">☰</button>
        <div class="g-brand"><span>𓂀</span>SEKHEM</div>
        <div class="g-room" id="g-room"></div>
      </header>
      <div class="g-menu" id="g-menu" hidden>
        <button data-act="go-rules-game">게임 방법</button>
        <button data-act="boss">포럼으로 숨기 (ESC 두 번)</button>
        <button data-act="leave">게임 나가기</button>
      </div>
      <main class="g-main">
        <section class="g-left">
          <div class="g-players" id="g-players"></div>
          <div class="board-frame"><div class="board" id="board">
            <div class="b-sun"></div><div class="b-stars"></div><div class="b-sand"></div>
            <div class="pyr" id="pyr"></div>
            <div class="banner" id="banner"></div>
          </div></div>
        </section>
        <section class="g-right">
          <div class="stage-line" id="stage-line"></div>
          <div class="tray">
            <div class="dice" id="dice">${DIE_SHAPE.map((s, i) => `<button class="die ${s}" data-act="die" data-i="${i}"><span class="dv">–</span><span class="dl">${s.toUpperCase()}</span></button>`).join('')}</div>
            <div class="timer" id="timer"><i></i></div>
            <button class="btn gold roll-btn" data-act="roll" id="btn-roll">주사위 굴리기</button>
          </div>
          <div class="expr" id="expr"><div class="expr-t" id="expr-t"></div><div class="expr-v" id="expr-v"></div></div>
          <div class="ops" id="ops">
            ${Object.entries(OPS).map(([k, s]) => `<button class="op" data-act="op" data-v="${k}">${s}</button>`).join('')}
            <button class="op par" data-act="par" data-v="(">(</button><button class="op par" data-act="par" data-v=")">)</button>
            <button class="op del" data-act="del" aria-label="지우기">⌫</button>
          </div>
          <div class="actions" id="actions"></div>
          <div class="log" id="log"></div>
        </section>
      </main>
      <div class="win" id="win" hidden></div>
    </div>`;
  }

  function updateGame() {
    const st = ui.st; if (!st) return;
    const build = canBuild();
    $('#g-room').innerHTML = st.local ? `<span class="pill">라운드 <b>${st.round}</b>/${MAX_ROUNDS}</span>` : `<span class="pill">라운드 <b>${st.round}</b>/${MAX_ROUNDS}</span><span class="pill">봉인 <b>${esc(st.code || net.code)}</b></span><button class="pill btnp" data-act="share">초대</button>`;
    // players
    $('#g-players').innerHTML = st.players.map((p, i) => {
      const top = p.stack[p.stack.length - 1];
      const status = st.phase !== 'play' ? '' : st.stage === 'roll' ? (i === st.roller ? '🎲 굴리는 중' : '') : p.got === 'pass' ? '패스' : p.got ? `✓ ${p.got}` : p.online === false ? '연결 끊김' : '찾는 중…';
      return `<div class="pchip ${i === st.roller && st.phase === 'play' ? 'roller' : ''} ${p.online === false ? 'off' : ''} ${p.acted ? 'done' : ''}" data-pid="${p.id}" ${dotS(p.color)}>
        <span class="dot"></span>
        <div class="pinfo"><div class="pn">${esc(p.name)}${p.id === myId && !st.local ? ' <small>(나)</small>' : ''}</div><div class="pst">${status}</div></div>
        <div class="pscore">${p.score}<small>점</small></div>
        ${top ? `<div class="ptop t${top.tier}" title="마지막으로 가져간 카드">${top.v}</div>` : '<div class="ptop empty">·</div>'}
      </div>`;
    }).join('');
    // pyramid
    const pyr = $('#pyr');
    const sig = st.cards.map(c => c.v + ':' + (c.fresh || 0)).join();
    if (pyr.dataset.sig !== sig) {
      const first = !pyr.dataset.sig;
      pyr.dataset.sig = sig;
      let k = 0;
      pyr.innerHTML = TIERS.map((t, ti) => {
        let row = '';
        for (let j = 0; j < t.n; j++, k++) { const c = st.cards[k]; row += `<div class="ncard t${ti}${!first && c.fresh === st.round ? ' fresh' : ''}" data-v="${c.v}"><span class="cv">${c.v}</span><span class="cg">${t.g}</span><span class="cp">${'●'.repeat(t.pts)}</span></div>`; }
        return `<div class="prow r${ti}"><div class="step"></div>${row}</div>`;
      }).join('');
    }
    st.cards.forEach(c => { const e = pyr.querySelector(`.ncard[data-v="${c.v}"]`); if (e) e.classList.toggle('gone', !!c.owner); });
    // dice
    const dice = gameEl.querySelectorAll('.die');
    const used = new Set(ui.tokens.filter(t => t.t === 'n').map(t => t.i));
    dice.forEach((d, i) => {
      if (!ui.rolling) d.querySelector('.dv').textContent = st.stage === 'roll' && st.round > 0 && !st.rollSeq ? '–' : st.dice[i];
      d.classList.toggle('used', used.has(i));
      d.classList.toggle('blank', st.stage === 'roll');
      d.disabled = !build || used.has(i);
    });
    const roller = st.players[st.roller];
    const iRoll = st.phase === 'play' && st.stage === 'roll' && (st.local || roller.id === myId);
    const rb = $('#btn-roll'); rb.hidden = !iRoll; rb.disabled = ui.rolling;
    if (iRoll) rb.textContent = st.local ? `${roller.name} — 주사위 굴리기` : '주사위 굴리기';
    // stage line
    $('#stage-line').innerHTML = st.phase !== 'play' ? '' :
      st.stage === 'roll' ? `<span class="dot" ${dotS(roller.color)}></span><span>${iRoll && !st.local ? '<b>당신</b>이 주사위를 굴릴 차례' : `<b>${esc(roller.name)}</b>의 주사위 차례`}</span>` :
      st.stage === 'search' ? `<span class="pulse"></span><span><b>모두 동시에!</b> 주사위 2개 이상으로 카드의 숫자를 만드세요</span>` :
      `<span>라운드 종료</span>`;
    // expression
    const v = tryEval(ui.tokens, st.dice);
    const all = usesAll(ui.tokens);
    $('#expr-t').innerHTML = ui.tokens.length ? ui.tokens.map(t => t.t === 'n' ? `<span class="xt n">${st.dice[t.i]}</span>` : t.t === 'o' ? `<span class="xt o">${OPS[t.v]}</span>` : `<span class="xt p">${t.t}</span>`).join('')
      : `<span class="ph">${build ? '주사위와 연산 기호를 눌러 식을 만드세요' : st.stage === 'search' ? '이번 라운드 선택 완료 — 다른 사람을 기다리는 중' : '주사위를 기다리는 중…'}</span>`;
    const target = v && v.d === 1 && all ? findTarget(st, v.n) : null;
    $('#expr-v').innerHTML = v ? `= ${v.d === 1 ? v.n : v.n + '/' + v.d}` : ui.tokens.length ? '<span class="dim">…</span>' : '';
    $('#expr').classList.toggle('hit', !!target);
    pyr.querySelectorAll('.ncard.hl').forEach(e => e.classList.remove('hl'));
    if (target && target.card) { const e = pyr.querySelector(`.ncard[data-v="${target.card.v}"]`); if (e) e.classList.add('hl'); }
    gameEl.querySelectorAll('#ops button').forEach(b => b.disabled = !build);
    // actions
    const label = target ? `${target.card.v} 가져가기 <small>+${target.card.pts}</small>`
      : v && !all ? '주사위 2개 이상 사용' : '가져가기';
    let act = '';
    if (st.phase === 'play' && st.stage === 'search') {
      if (st.local) {
        act = `<div class="claimers">${st.players.map(p => `<button class="btn claim-p" data-act="claim" data-as="${p.id}" ${dotS(p.color)} ${!target || p.acted || ui.rolling ? 'disabled' : ''}>${esc(p.name)}${p.acted ? (p.got === 'pass' ? ' · 패스' : ' ✓') : ''}</button>`).join('')}</div>
               <div class="act-row"><span class="tlabel">${label}</span><button class="btn sm ghost" data-act="pass-all">라운드 넘기기</button></div>`;
      } else {
        act = `<button class="btn sm ghost" data-act="pass" ${!build ? 'disabled' : ''}>패스</button><button class="btn gold grow" data-act="claim" ${!build || !target ? 'disabled' : ''}>${label}</button>`;
      }
    }
    $('#actions').innerHTML = act;
    $('#actions').classList.toggle('local', !!st.local);
    $('#log').innerHTML = st.log.slice(0, 14).map(l => `<div>${l}</div>`).join('');
    // game over
    const win = $('#win');
    if (st.phase === 'over') {
      const rank = [...st.players].sort((a, b) => b.score - a.score || b.stack.length - a.stack.length);
      const w = rank[0], canRestart = st.local || st.hostId === myId;
      win.hidden = false;
      win.innerHTML = `<div class="win-card"><div class="win-eye">𓂀</div><div class="win-k">매장실의 문이 열렸다</div>
        <div class="win-name" style="color:${COLORS[w.color].c}">${esc(w.name)}</div>
        <ol class="rank">${rank.map(p => `<li><span class="dot" ${dotS(p.color)}></span>${esc(p.name)}<b>${p.score}점</b><small>${p.stack.length}장</small></li>`).join('')}</ol>
        <div class="row-btns">${canRestart ? '<button class="btn gold" data-act="restart">다시 하기</button>' : '<span class="wait">호스트가 새 게임을 시작할 수 있습니다</span>'}<button class="btn ghost dark" data-act="leave">나가기</button></div></div>`;
    } else win.hidden = true;
  }
  function findTarget(st, v) {
    const card = st.cards.find(c => !c.owner && c.v === v);
    return card ? { card } : null;
  }

  async function rollAnim() {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    ui.rolling = true; updateGame();
    const dice = [...gameEl.querySelectorAll('.die')];
    dice.forEach(d => { d.classList.remove('roll'); void d.offsetWidth; d.classList.add('roll'); });
    const n = reduce ? 1 : 12;
    for (let k = 0; k < n; k++) { dice.forEach((d, i) => d.querySelector('.dv').textContent = 1 + rand(DICE[i])); await sleep(55 + k * 6); }
    ui.rolling = false;
    dice.forEach((d, i) => { d.querySelector('.dv').textContent = ui.st.dice[i]; d.classList.remove('roll'); d.classList.add('land'); setTimeout(() => d.classList.remove('land'), 500); });
    updateGame();
  }
  function flyCard({ rect, html, ev }) {
    const dst = document.querySelector(`.pchip[data-pid="${ev.pid}"] .ptop`);
    if (!dst) return;
    const to = dst.getBoundingClientRect();
    const f = document.createElement('div');
    f.className = 'flyer'; f.innerHTML = html;
    Object.assign(f.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
    document.body.appendChild(f);
    const dx = to.left + to.width / 2 - (rect.left + rect.width / 2), dy = to.top + to.height / 2 - (rect.top + rect.height / 2);
    const s = Math.max(.4, to.width / rect.width);
    f.animate([{ transform: 'translate(0,0) scale(1) rotate(0)', opacity: 1 }, { transform: `translate(${dx * .5}px, ${dy * .5 - 60}px) scale(1.25) rotate(-8deg)`, opacity: 1, offset: .45 }, { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(0)`, opacity: .2 }], { duration: 750, easing: 'cubic-bezier(.4,.1,.3,1)' }).onfinish = () => { f.remove(); dst.classList.add('bump'); setTimeout(() => dst.classList.remove('bump'), 400); };
  }
  let bannerT;
  function showBanner(ev) {
    const b = $('#banner'); if (!b) return;
    const p = ui.st.players.find(x => x.id === ev.pid);
    b.className = 'banner show ok';
    b.innerHTML = `<div class="bn-who" ${dotS(p.color)}>${esc(p.name)}</div><div class="bn-h">봉인 해제</div><div class="bn-e">${esc(ev.ex)} = ${ev.v}</div><div class="bn-m">+${ev.pts}점</div>`;
    clearTimeout(bannerT); bannerT = setTimeout(() => { b.className = 'banner'; }, 1700);
  }
  function showReveal(st) {
    const b = $('#banner'); if (!b) return;
    const m = st.missed;
    b.className = 'banner show reveal';
    b.innerHTML = `<div class="bn-h">라운드 ${st.round} 종료</div>${m ? `<div class="bn-e">남아있던 최고 카드: <b>${m.v}</b> (${m.pts}점)<br>${esc(m.ex)} = ${m.v}</div>` : '<div class="bn-e">남은 카드로 만들 수 있는 수가 없었습니다</div>'}`;
    clearTimeout(bannerT); bannerT = setTimeout(() => { b.className = 'banner'; }, REVEAL_MS - 300);
  }

  setInterval(() => {
    const t = $('#timer'); if (!t || !ui.st) return;
    const st = ui.st;
    if (!ui.localDeadline || st.phase !== 'play' || st.stage === 'reveal') { t.style.visibility = 'hidden'; return; }
    t.style.visibility = 'visible';
    const total = st.stage === 'roll' ? ROLL_MS : SEARCH_MS;
    const left = Math.max(0, ui.localDeadline - Date.now());
    t.firstElementChild.style.width = (left / total * 100) + '%';
    t.dataset.s = (st.stage === 'roll' ? '자동 굴림 ' : '') + Math.ceil(left / 1000) + '초';
    t.classList.toggle('low', st.stage === 'search' && left < 10000);
  }, 200);

  function setTokens(tk) { ui.tokens = tk; updateGame(); }
  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.className = 'show';
    clearTimeout(t._t); t._t = setTimeout(() => t.className = '', 2600);
  }
  async function share(code) {
    const url = inviteURL(code);
    if (navigator.share && matchMedia('(pointer:coarse)').matches) { try { await navigator.share({ title: 'deadbeef.boards', text: 'this thread is weird', url }); return; } catch (e) { } }
    copy(url, '초대 링크를 복사했습니다');
  }
  async function copy(text, okMsg) {
    try { await navigator.clipboard.writeText(text); toast(okMsg); }
    catch (e) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast(okMsg); } catch (e2) { toast(text); }
      ta.remove();
    }
  }
  const nameVal = () => { const v = (($('#in-name') || {}).value || '').trim(); LS.set('sekhem.name', v); return v || '여행자'; };
  const doClaim = as => { if (canBuild()) send({ type: 'claim', tokens: ui.tokens, as }); };

  gameEl.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const a = b.dataset.act, st = ui.st;
    switch (a) {
      case 'go-menu': ui.screen = 'menu'; render(); break;
      case 'go-title': ui.screen = 'title'; render(); break;
      case 'go-rules': ui.prevScreen = ui.screen; ui.screen = 'rules'; render(); break;
      case 'go-rules-game': ui.prevScreen = 'game'; ui.screen = 'rules'; render(); break;
      case 'back': ui.screen = ui.prevScreen || 'title'; if (ui.screen === 'game') gameEl.innerHTML = ''; render(); break;
      case 'go-local': ui.screen = 'local'; render(); break;
      case 'local-n': ui.localN = +b.dataset.n; render(); break;
      case 'local-start': { const names = Array.from({ length: ui.localN }, (_, i) => ($('#ln-' + i).value || '').trim() || COLORS[i].name); gameEl.innerHTML = ''; startLocal(names); break; }
      case 'host': hostOnline(nameVal()); break;
      case 'join': {
        const code = (($('#in-code') || {}).value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (code.length !== 5) { toast('5자리 봉인 코드를 입력하세요'); break; }
        joinOnline(code, nameVal()); break;
      }
      case 'share': share(st ? (st.code || net.code) : net.code); break;
      case 'copy-code': copy(st.code || net.code, '코드를 복사했습니다'); break;
      case 'start': send({ type: 'start' }); break;
      case 'restart': send({ type: 'restart' }); break;
      case 'leave': teardown(); ui.st = null; ui.screen = 'menu'; gameEl.innerHTML = ''; render(); break;
      case 'toggle-menu': { const m = $('#g-menu'); m.hidden = !m.hidden; break; }
      case 'boss': window.Forum.show(); break;
      case 'roll': send({ type: 'roll' }); break;
      case 'die': if (canBuild()) setTokens([...ui.tokens, { t: 'n', i: +b.dataset.i }]); break;
      case 'op': case 'par': if (canBuild()) setTokens([...ui.tokens, a === 'op' ? { t: 'o', v: b.dataset.v } : { t: b.dataset.v }]); break;
      case 'del': if (canBuild()) setTokens(ui.tokens.slice(0, -1)); break;
      case 'claim': doClaim(b.dataset.as); break;
      case 'pass': if (canBuild()) send({ type: 'pass' }); break;
      case 'pass-all': if (st && st.local) st.players.filter(p => !p.acted).forEach(p => send({ type: 'pass', as: p.id })); break;
    }
    if (a !== 'toggle-menu') { const m = $('#g-menu'); if (m) m.hidden = true; }
  });
  gameEl.addEventListener('input', e => { if (e.target.id === 'in-code') e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  gameEl.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'in-code') gameEl.querySelector('[data-act="join"]').click(); });

  document.addEventListener('keydown', e => {
    if (gameEl.hidden) return;
    if (e.key === 'Escape') {
      const now = Date.now();
      if (now - ui.escT < 600) { window.Forum.show(); ui.escT = 0; } else ui.escT = now;
      return;
    }
    if (ui.screen !== 'game' || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const st = ui.st;
    if (e.key === ' ' && st && st.stage === 'roll') { e.preventDefault(); const rb = $('#btn-roll'); if (rb && !rb.hidden) rb.click(); return; }
    if (!canBuild()) return;
    const used = new Set(ui.tokens.filter(t => t.t === 'n').map(t => t.i));
    if (/^[0-9]$/.test(e.key)) {
      const j = st.dice.findIndex((n, k) => n === +e.key && !used.has(k));
      if (j >= 0) setTokens([...ui.tokens, { t: 'n', i: j }]);
    } else if ('+-*/'.includes(e.key) && e.key.length === 1) setTokens([...ui.tokens, { t: 'o', v: e.key }]);
    else if (e.key === 'x' || e.key === 'X') setTokens([...ui.tokens, { t: 'o', v: '*' }]);
    else if (e.key === '(' || e.key === ')') setTokens([...ui.tokens, { t: e.key }]);
    else if (e.key === 'Backspace') setTokens(ui.tokens.slice(0, -1));
    else if (e.key === 'Enter' && !st.local) doClaim();
  });

  window.Sekhem = {
    enter(opts = {}) {
      gameEl.hidden = false;
      if (opts.join) { ui.joinCode = opts.join; if (!ui.st) { ui.screen = 'menu'; gameEl.innerHTML = ''; } }
      else if (!ui.st && ui.screen !== 'rules') ui.screen = 'title';
      render();
      if (opts.join && !ui.st) setTimeout(() => { const n = $('#in-name'); if (n) n.focus(); toast('이름을 입력하고 참가를 누르세요'); }, 50);
    },
  };
  window.__sekhemTest = { allValues, makeCards, tryEval };
})();
