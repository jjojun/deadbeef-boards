/* deadbeef.boards — a perfectly ordinary forum. Nothing to see here. */
(() => {
  'use strict';
  const root = document.getElementById('forum');
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const THREADS = [
    { id: 5120, cat: 'Embedded & Firmware', title: 'nRF52 SAADC drifts ~3 LSB after waking from System OFF', author: 'vcc_glitch', replies: 14, views: 1893, last: '12 min ago', tag: 'solved',
      body: `Board wakes from System OFF via GPIO sense, first ~20 samples are consistently 3 LSB higher than steady state. Calibration is triggered right after boot. Is there a settle time I'm missing?`,
      posts: [['tinker_bell', 'Run the offset calibration <i>after</i> the first conversion, not before. The reference needs a moment after the regulator comes up.'], ['vcc_glitch', 'That was it. Moved CALIBRATEOFFSET to after a dummy sample and it\'s flat now. Thanks!']] },
    { id: 5117, cat: 'Reverse Engineering', title: 'Unpacking a custom LZ variant in a 2004 router firmware', author: 'm0rph', replies: 31, views: 4410, last: '1 hr ago',
      body: `The header has a 4-byte magic <code>0x1F 0x9E 0x50 0x4B</code> followed by what looks like a window size. Standard LZSS tools choke on it. Anyone seen this?`,
      posts: [['ghidra_goblin', 'Looks like LZSS with a 12-bit offset but the flag byte is inverted. Try XORing flags with 0xFF.'], ['m0rph', 'Inverted flags + big-endian offsets. Got a clean squashfs out. Writeup soon.']] },
    { id: 5109, cat: 'Retro Computing', title: 'Recapped a 1989 portable — now it beeps 3 times and halts', author: 'sixfiveohtwo', replies: 9, views: 702, last: '3 hr ago',
      body: `Replaced every electrolytic. Now POST gives three short beeps. Before the recap it at least showed a cursor.`,
      posts: [['oldiron', 'Three beeps on that BIOS is base 64K RAM. Check you didn\'t lift a pad near the DRAM bank while desoldering.']] },
    { id: 4471, cat: 'Reverse Engineering', title: '[UNSOLVED] Found a "cartouche" in an EPROM dump. Has anyone seen this before?', author: 'khepri_0x', replies: 23, views: 6661, last: '3 years ago', tag: 'unsolved', mystery: true },
    { id: 5102, cat: 'Embedded & Firmware', title: 'Zephyr: k_work_delayable keeps firing after cancel?', author: 'rtos_or_die', replies: 6, views: 512, last: '5 hr ago',
      body: `I call <code>k_work_cancel_delayable()</code> from an ISR but the handler still runs once more. Race?`,
      posts: [['tinker_bell', 'If it was already submitted to the queue, cancel can\'t pull it back. Use <code>k_work_cancel_delayable_sync()</code> from thread context, or check a flag in the handler.']] },
    { id: 5098, cat: 'Off-topic', title: 'What\'s on your bench this week?', author: 'oldiron', replies: 58, views: 3020, last: '6 hr ago',
      body: `Mine: a dead bench PSU, two half-finished keyboards and a logic analyzer I don't trust.`,
      posts: [['sixfiveohtwo', 'A Z80 SBC that only works when I\'m looking at it.'], ['vcc_glitch', 'Reflow oven controller v3. v2 caught fire. Slightly.']] },
    { id: 5091, cat: 'Reverse Engineering', title: 'Glitching an STM32F1 RDP1 — success rates?', author: 'ghidra_goblin', replies: 17, views: 2287, last: '1 day ago',
      body: `Getting roughly 1 in 4000 attempts with a crowbar on VCAP. Is that typical, or is my trigger jitter too high?`,
      posts: [['m0rph', 'Your jitter is the problem. Trigger off the reset line with a CPLD, not the MCU.']] },
    { id: 5084, cat: 'Retro Computing', title: 'Archiving floppy images: flux vs sector dumps', author: 'bitrot', replies: 12, views: 960, last: '2 days ago',
      body: `For copy-protected disks, is a flux-level dump always worth it?`,
      posts: [['oldiron', 'Always flux. Storage is cheap, those disks are not getting younger.']] },
  ];

  const MYSTERY_POSTS = [
    ['khepri_0x', 'Joined 2011 · 212 posts', `Pulled this from a 27C256 on an unlabeled board I bought at a flea market. Most of the image is a normal 8051 program, but at <code>0x7FA0</code> there's a block that doesn't decode to anything. The ASCII column almost reads like a word.
<pre class="hexdump">00007F90  FF FF FF FF FF FF FF FF  FF FF FF FF FF FF FF FF  |................|
00007FA0  53 45 4B 48 45 4D 00 13  09 0C 18 05 00 5E A1 ED  |SEKHEM.......^..|
00007FB0  2B 2D 2A 2F 00 01 02 03  04 05 06 07 08 09 00 18  |+-*/............|
00007FC0  07 06 05 04 02 01 00 00  00 00 00 00 00 00 00 00  |................|
00007FD0  FF FF FF FF FF FF FF FF  FF FF FF FF FF FF FF FF  |................|</pre>
Checksum of the block comes out to <code>0x5EA1ED</code>. Sealed? Funny coincidence I guess.`],
    ['tinker_bell', 'Joined 2009 · 4,880 posts', `<code>2B 2D 2A 2F</code> is literally <code>+ - * /</code>. Then digits 1–9. Then <code>07 06 05 04 02 01</code>… that sums to 25. Looks like a lookup table for some kind of calculator game?`],
    ['m0rph', 'Joined 2013 · 1,102 posts', `7, 6, 5, 4, 2, 1 — rows of something getting narrower. A staircase. Or a pyramid.`],
    ['bitrot', 'Joined 2015 · 390 posts', `You guys are reading tea leaves. It's uninitialised EEPROM garbage.`],
    ['khepri_0x', 'Joined 2011 · 212 posts', `Update: I traced the code that reads this table. It waits for three pulses on a pin labelled with a little triangle on the silkscreen. Three knocks, then it "opens". That's the word in the disassembly comment. <i>Opens.</i>`],
    ['[deleted]', '—', `<span class="glyph">𓂀</span> it is still listening. the triangle is on every page.`],
  ];

  let knocks = [];

  function header() {
    return `<header class="f-head">
      <div class="f-wrap f-head-in">
        <a class="f-logo" href="#" data-nav="home"><span class="f-logo-hex">0x</span>deadbeef<span class="f-logo-dim">.boards</span></a>
        <nav class="f-nav"><a href="#" data-nav="home">Forums</a><a href="#" data-nav="home">New posts</a><a href="#" data-nav="home">Members</a></nav>
        <div class="f-search"><input type="search" placeholder="Search threads…" aria-label="Search"></div>
      </div>
    </header>`;
  }

  function footer() {
    return `<footer class="f-foot"><div class="f-wrap">
      <span>deadbeef.boards · est. 2009 · low-level, reversing &amp; retro</span>
      <span class="f-foot-r">board engine v2.4.1 · <a href="#" data-nav="home">rules</a> · <a href="#" data-nav="home">privacy</a> · <button class="f-tri" id="f-tri" aria-label="·" title="">▲</button></span>
    </div></footer>`;
  }

  function home() {
    const cats = [...new Set(THREADS.map(t => t.cat))];
    const rows = THREADS.map(t => `
      <a class="f-row ${t.mystery ? 'is-old' : ''}" href="?t=${t.id}" data-thread="${t.id}">
        <div class="f-row-ic">${t.tag === 'solved' ? '✓' : t.tag === 'unsolved' ? '?' : '•'}</div>
        <div class="f-row-main">
          <div class="f-row-title">${t.tag ? `<span class="f-tag f-tag-${t.tag}">${t.tag}</span>` : ''}${esc(t.title)}</div>
          <div class="f-row-meta">by <b>${esc(t.author)}</b> · ${esc(t.cat)}</div>
        </div>
        <div class="f-row-num"><b>${t.replies}</b><span>replies</span></div>
        <div class="f-row-num"><b>${t.views.toLocaleString('en-US')}</b><span>views</span></div>
        <div class="f-row-last">${esc(t.last)}</div>
      </a>`).join('');
    return `${header()}
    <main class="f-wrap f-main">
      <div class="f-crumbs">Forums › Latest</div>
      <section class="f-cats">${cats.map(c => `<div class="f-cat"><b>${esc(c)}</b><span>${THREADS.filter(t => t.cat === c).length * 137 + 41} threads</span></div>`).join('')}</section>
      <section class="f-list"><div class="f-list-h">Latest threads</div>${rows}</section>
      <aside class="f-online">Users online: <b>37</b> (4 members, 33 guests) — oldiron, tinker_bell, m0rph, <span class="f-ghost">khepri_0x</span></aside>
    </main>${footer()}`;
  }

  function thread(id) {
    const t = THREADS.find(x => x.id === id);
    if (!t) return home();
    const posts = t.mystery
      ? MYSTERY_POSTS
      : [[t.author, 'Member', t.body], ...t.posts.map(p => [p[0], 'Member', p[1]])];
    const html = posts.map(([who, meta, body], i) => `
      <article class="f-post ${who === '[deleted]' ? 'is-deleted' : ''}">
        <div class="f-post-user"><div class="f-ava" style="--h:${(who.length * 47) % 360}">${esc(who[0] === '[' ? '?' : who[0].toUpperCase())}</div><b>${esc(who)}</b><span>${esc(meta)}</span></div>
        <div class="f-post-body"><div class="f-post-meta">#${i + 1} · ${t.mystery ? ['Mar 3, 2023', 'Mar 3, 2023', 'Mar 4, 2023', 'Mar 4, 2023', 'Mar 9, 2023', 'Oct 31, 2023'][i] : 'today'}</div>${body}</div>
      </article>`).join('');
    return `${header()}
    <main class="f-wrap f-main">
      <div class="f-crumbs"><a href="#" data-nav="home">Forums</a> › ${esc(t.cat)}</div>
      <h1 class="f-title">${esc(t.title)}</h1>
      ${html}
      ${t.mystery ? '<div class="f-locked">🔒 This thread has been locked. Replies are disabled.</div>' : '<div class="f-reply">You must be logged in to reply.</div>'}
    </main>${footer()}`;
  }

  function render(view, id) {
    root.innerHTML = view === 'thread' ? thread(id) : home();
    const t = view === 'thread' && THREADS.find(x => x.id === id);
    document.title = t ? `${t.title} | deadbeef.boards` : 'deadbeef.boards — low-level, reversing & retro';
    window.scrollTo(0, 0);
  }

  function show() {
    document.getElementById('game').hidden = true;
    document.getElementById('portal').hidden = true;
    root.hidden = false;
  }

  root.addEventListener('click', e => {
    const tri = e.target.closest('#f-tri');
    if (tri) {
      e.preventDefault();
      const now = Date.now();
      knocks = knocks.filter(k => now - k < 1800);
      knocks.push(now);
      tri.classList.remove('knock'); void tri.offsetWidth; tri.classList.add('knock');
      if (knocks.length >= 3) { knocks = []; openPortal(); }
      return;
    }
    const th = e.target.closest('[data-thread]');
    if (th) { e.preventDefault(); history.pushState({}, '', '?t=' + th.dataset.thread); render('thread', +th.dataset.thread); return; }
    const nav = e.target.closest('[data-nav]');
    if (nav) { e.preventDefault(); history.pushState({}, '', location.pathname); render('home'); }
  });
  window.addEventListener('popstate', () => {
    const t = new URLSearchParams(location.search).get('t');
    t ? render('thread', +t) : render('home');
  });

  /* ---------- the portal ---------- */
  function openPortal(opts = {}) {
    const portal = document.getElementById('portal');
    const cv = document.getElementById('portal-canvas');
    const txt = document.getElementById('portal-text');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    portal.hidden = false;
    portal.classList.remove('fade');
    document.body.classList.add('glitching');
    setTimeout(() => document.body.classList.remove('glitching'), 450);
    const ctx = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.width = innerWidth * dpr, H = cv.height = innerHeight * dpr;
    const glyphs = '𓂀𓋹𓆣𓇳𓊽𓉐𓃭𓅓𓆓𓏏𓈖𓂋𓊪𓋴𓎛𓇋𓄿𓅱𓃀𓍿𓐍'.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g);
    const fs = 22 * dpr, cols = Math.ceil(W / fs);
    const drops = Array.from({ length: cols }, () => Math.random() * -40);
    ctx.font = `${fs}px "Noto Sans Egyptian Hieroglyphs", serif`;
    const t0 = performance.now();
    const lines = ['THREE KNOCKS RECEIVED', 'THE SEAL RECOGNISES YOU', '𓂀'];
    txt.innerHTML = '';
    lines.forEach((l, i) => setTimeout(() => { const d = document.createElement('div'); d.textContent = l; d.className = i === 2 ? 'eye' : ''; txt.appendChild(d); }, 250 + i * 520));
    const dur = reduce ? 900 : 2100;
    function frame(now) {
      const el = now - t0;
      ctx.fillStyle = 'rgba(6,8,18,0.16)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#e8c766';
      for (let i = 0; i < cols; i++) {
        const g = glyphs[(Math.random() * glyphs.length) | 0];
        ctx.globalAlpha = 0.35 + Math.random() * 0.6;
        ctx.fillText(g, i * fs, drops[i] * fs);
        if (drops[i] * fs > H && Math.random() > 0.96) drops[i] = 0;
        drops[i] += 0.55;
      }
      ctx.globalAlpha = 1;
      if (el < dur) requestAnimationFrame(frame);
      else {
        root.hidden = true;
        window.Sekhem.enter(opts);
        portal.classList.add('fade');
        setTimeout(() => { portal.hidden = true; ctx.clearRect(0, 0, W, H); }, 700);
      }
    }
    ctx.fillStyle = '#060812'; ctx.fillRect(0, 0, W, H);
    requestAnimationFrame(frame);
  }

  window.Forum = { show };

  // boot
  const q = new URLSearchParams(location.search);
  const seal = (q.get('seal') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const t = q.get('t');
  t ? render('thread', +t) : render('home');
  if (seal) setTimeout(() => openPortal({ join: seal }), 1500);
})();
