/* Sporeling Grotto: rendering, input, audio, saving. Game rules live in logic.js (window.GL). */
(function () {
  'use strict';
  const GL = window.GL;
  const CREDITS_LINE = 'Made by Glimmerspore Games, an AI-assisted game studio. Code, art, sound and text were created with AI tools (Claude by Anthropic).'; // exact wording per Compliance SG2
  const SAVE_KEY = 'sporeling-grotto-save-v1';
  let W = 320;
  const H = 180;

  // ---------- storage (falls back to memory if localStorage is blocked) ----------
  let memSave = null;
  function readSave() {
    try { const t = localStorage.getItem(SAVE_KEY); if (t) return JSON.parse(t); } catch (e) { /* blocked or corrupt */ }
    return memSave ? JSON.parse(memSave) : null;
  }
  function writeSave(text) { memSave = text; try { localStorage.setItem(SAVE_KEY, text); } catch (e) { /* ignore */ } }

  // ---------- state ----------
  const now0 = Date.now();
  let S = GL.sanitize(readSave(), now0);
  const hadSave = S.total > 0;
  let awayInfo = null;
  if (hadSave) {
    const gap = (now0 - S.lastSeen) / 1000;
    if (gap > 60) { const g = GL.applyOffline(S, gap); if (g > 0) awayInfo = { gap, gain: g }; }
  }
  GL.checkAchievements(S);
  function save() { S.lastSeen = Date.now(); writeSave(JSON.stringify(S)); }

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const cv = $('cv'), ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  function rect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); }

  // ---------- audio (procedural, created after the first gesture) ----------
  let ac = null, lastTapSound = 0;
  function unlockAudio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } } if (ac && ac.state === 'suspended') ac.resume(); }
  function tone(freq, dur, type, vol, delay, slide) {
    if (!ac || S.muted) return;
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.08, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  const sfx = {
    tap() { const n = performance.now(); if (n - lastTapSound < 70) return; lastTapSound = n; tone(420 + Math.random() * 160, 0.09, 'sine', 0.07, 0, 700); },
    buy() { tone(523, 0.1, 'triangle', 0.08); tone(784, 0.14, 'triangle', 0.08, 0.07); },
    golden() { [660, 880, 1100, 1320].forEach((f, i) => tone(f, 0.18, 'sine', 0.07, i * 0.06)); },
    gift() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', 0.08, i * 0.09)); },
    bloom() { tone(200, 0.9, 'sine', 0.1, 0, 900); tone(300, 0.9, 'triangle', 0.06, 0.1, 1200); },
    ach() { tone(880, 0.12, 'square', 0.04); tone(1175, 0.18, 'square', 0.04, 0.1); },
    no() { tone(180, 0.12, 'square', 0.04); },
  };

  // ---------- icons (drawn procedurally, 16x16) ----------
  function drawGen(c, id, x, y, t) {
    const R = (dx, dy, w, h, col) => rect(c, x + dx, y + dy, w, h, col);
    switch (id) {
      case 'sprout': R(7, 8, 2, 7, '#4caf50'); R(4, 5, 4, 3, '#7ee081'); R(8, 4, 4, 3, '#7ee081'); R(5, 4, 2, 1, '#b8f5b8'); break;
      case 'moss': R(1, 10, 14, 5, '#2e7d32'); R(3, 8, 10, 3, '#43a047'); R(5, 7, 3, 2, '#66bb6a'); R(10, 9, 3, 2, '#81c784'); R(2, 11, 2, 1, '#1b5e20'); break;
      case 'glowcap': R(7, 9, 2, 6, '#e0f7fa'); R(3, 5, 10, 4, '#26c6da'); R(5, 3, 6, 2, '#4dd0e1'); R(5, 6, 2, 2, '#e0ffff'); R(9, 5, 2, 2, '#e0ffff'); break;
      case 'farm': R(1, 5, 14, 2, '#8d6e63'); R(1, 10, 14, 2, '#8d6e63'); for (let i = 0; i < 4; i++) { R(2 + i * 3.5, 3, 3, 2, '#ef9a9a'); R(2 + i * 3.5, 8, 3, 2, '#ffcc80'); R(2 + i * 3.5, 13, 3, 2, '#ce93d8'); } break;
      case 'beetle': R(4, 7, 8, 6, '#5d4037'); R(5, 6, 6, 1, '#795548'); R(7, 7, 2, 6, '#3e2723'); R(10, 4, 2, 3, '#5d4037'); R(3, 4, 2, 3, '#5d4037'); R(3, 13, 1, 2, '#3e2723'); R(12, 13, 1, 2, '#3e2723'); R(6, 9, 1, 1, '#ffd23f'); break;
      case 'roots': R(7, 1, 2, 14, '#a1887f'); R(3, 4, 5, 1, '#8d6e63'); R(8, 7, 5, 1, '#8d6e63'); R(2, 10, 6, 1, '#8d6e63'); R(8, 12, 5, 1, '#8d6e63'); R(6, 0, 4, 2, '#ffd23f'); break;
      case 'crystal': R(7, 2, 3, 12, '#b388ff'); R(5, 5, 2, 9, '#9575cd'); R(10, 6, 3, 8, '#d1c4e9'); R(8, 3, 1, 3, '#fff'); break;
      case 'star': { const p = (Math.sin((t || 0) * 3) + 1) / 2; R(7, 1, 2, 14, '#fff3b0'); R(1, 7, 14, 2, '#fff3b0'); R(4, 4, 8, 8, '#ffd23f'); R(6, 6, 4, 4, p > 0.5 ? '#fff' : '#fff8d0'); break; }
    }
  }
  const iconCache = {};
  function iconURL(id) {
    if (iconCache[id]) return iconCache[id];
    const c = document.createElement('canvas'); c.width = 16; c.height = 16;
    drawGen(c.getContext('2d'), id, 0, 0, 0);
    return (iconCache[id] = c.toDataURL());
  }

  // ---------- scene ----------
  function resize() {
    const sc = $('scene').getBoundingClientRect();
    const w = Math.max(220, Math.min(440, Math.round(H * sc.width / Math.max(1, sc.height))));
    if (w !== W || cv.width !== w) { W = w; cv.width = W; cv.height = H; ctx.imageSmoothingEnabled = false; }
  }
  window.addEventListener('resize', resize);
  const flies = Array.from({ length: 14 }, (_, i) => ({ x: hash(i, 1) * 300, y: 30 + hash(i, 2) * 110, ph: hash(i, 3) * 6.28, sp: 0.3 + hash(i, 4) }));
  let parts = []; // {x,y,vx,vy,life,col,text}
  let squish = 0, time = 0;

  function drawScene() {
    const t = time;
    rect(ctx, 0, 0, W, H, '#120d24');
    rect(ctx, 0, 0, W, 60, '#1a1236'); rect(ctx, 0, 60, W, 60, '#1f1640'); rect(ctx, 0, 120, W, 60, '#2a1d52');
    // dithered cave wall bands
    for (let y = 40; y < 125; y += 2) for (let x = (y / 2) % 2 ? 0 : 2; x < W; x += 4) if (hash(x, y) > 0.9) rect(ctx, x, y, 1, 1, '#33265f');
    // stalactites
    for (let i = 0; i < Math.ceil(W / 29); i++) { const x = i * 29 + hash(i, 9) * 12, hgt = 10 + hash(i, 7) * 26; for (let k = 0; k < hgt; k += 2) rect(ctx, x + k / 8, k, Math.max(1, 9 - k / 3.5), 2, k % 4 ? '#2b2050' : '#34286a'); }
    // ground
    rect(ctx, 0, 138, W, 42, '#2a1f4d'); rect(ctx, 0, 138, W, 2, '#4a3a86');
    for (let x = 0; x < W; x += 3) if (hash(x, 5) > 0.7) rect(ctx, x, 142 + Math.floor(hash(x, 6) * 36), 2, 1, '#3d2f70');
    // glow behind mushroom
    const power = Math.min(1, Math.log10(1 + S.total) / 9);
    ctx.globalAlpha = 0.10 + 0.14 * power;
    for (let r = 60; r > 10; r -= 10) { ctx.fillStyle = '#c58bff'; ctx.beginPath(); ctx.arc(W / 2, 100, r, 0, 6.28); ctx.fill(); }
    ctx.globalAlpha = 1;
    // owned growers: far to near
    for (const g of GL.GENS) {
      const n = S.gens[g.id] || 0, i = GL.GENS.indexOf(g);
      for (let k = 0; k < Math.min(n, 14); k++) {
        let x = 6 + hash(i, k + 20) * (W - 30), y = 142 + hash(i, k + 40) * 20;
        if (Math.abs(x - W / 2) < 35) x += x < W / 2 ? -50 : 50;
        x = Math.max(2, Math.min(W - 18, x));
        if (g.id === 'star') { y = 12 + hash(i, k) * 50 + Math.sin(t * 1.5 + k) * 3; x = 10 + hash(k, 77) * (W - 30); }
        if (g.id === 'roots') y = 146 + hash(i, k + 3) * 14;
        const bob = g.id === 'beetle' ? Math.round(Math.sin(t * 3 + k * 2)) : 0;
        drawGen(ctx, g.id, x, y + bob, t + k);
      }
    }
    // big mushroom
    const sq = squish * 0.14, sx = 1 + sq, sy = 1 - sq;
    ctx.save(); ctx.translate(Math.round(W / 2), 138); ctx.scale(sx, sy);
    // violet glowing cap on a bluish-grey stem, glowing teal spots, no face
    rect(ctx, -9, -44, 18, 44, '#8a93b8'); rect(ctx, -9, -44, 4, 44, '#6b7399'); rect(ctx, 5, -44, 4, 44, '#aab3d6');
    for (let y = -92; y <= -50; y += 4) { const f = 1 - Math.pow((y + 71) / 21, 2); const hw = Math.max(0, Math.round(46 * Math.sqrt(Math.max(0, f)))); if (hw) rect(ctx, -hw, y, hw * 2, 4, y < -80 ? '#b388ff' : y < -62 ? '#7e57c2' : '#512da8'); }
    const gl = 0.75 + 0.25 * Math.sin(t * 2.2);
    ctx.globalAlpha = 0.35 * gl; for (const [sx0, sy0, sz] of [[-34, -70, 8], [6, -84, 10], [22, -66, 7], [-10, -60, 6]]) rect(ctx, sx0 - 2, sy0 - 2, sz + 4, sz + 4, '#4dffe0'); ctx.globalAlpha = 1;
    rect(ctx, -34, -70, 8, 8, '#7dfbe6'); rect(ctx, 6, -84, 10, 8, '#7dfbe6'); rect(ctx, 22, -66, 7, 7, '#7dfbe6'); rect(ctx, -10, -60, 6, 6, '#7dfbe6');
    ctx.restore();
    // fireflies
    for (const f of flies) {
      const x = f.x + Math.sin(t * f.sp + f.ph) * 14, y = f.y + Math.cos(t * f.sp * 0.8 + f.ph) * 8, a = (Math.sin(t * 2 + f.ph) + 1) / 2;
      ctx.globalAlpha = 0.35 + 0.65 * a; rect(ctx, x, y, 2, 2, '#fff3b0'); ctx.globalAlpha = 0.2 * a; rect(ctx, x - 1, y - 1, 4, 4, '#ffd23f'); ctx.globalAlpha = 1;
    }
    // particles
    ctx.font = 'bold 9px monospace';
    for (const p of parts) {
      ctx.globalAlpha = Math.min(1, p.life * 1.6);
      if (p.text) { ctx.fillStyle = '#000'; ctx.fillText(p.text, Math.round(p.x) + 1, Math.round(p.y) + 1); ctx.fillStyle = p.col; ctx.fillText(p.text, Math.round(p.x), Math.round(p.y)); }
      else rect(ctx, p.x, p.y, 2, 2, p.col);
    }
    ctx.globalAlpha = 1;
  }

  function stepParts(dt) {
    for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.text ? 0 : 40) * dt; p.life -= dt; }
    parts = parts.filter((p) => p.life > 0);
    if (parts.length > 160) parts = parts.slice(-160);
    squish = Math.max(0, squish - dt * 5);
  }
  function burst(x, y, n, cols) {
    for (let i = 0; i < n; i++) parts.push({ x, y, vx: (Math.random() - 0.5) * 70, vy: -20 - Math.random() * 60, life: 0.5 + Math.random() * 0.5, col: cols[i % cols.length] });
  }

  // ---------- toast / modal ----------
  let toastT = null;
  const toastQ = [];
  function toast(msg) { toastQ.push(msg); if (toastQ.length > 4) toastQ.shift(); if (!toastT) nextToast(); }
  function nextToast() {
    const m = toastQ.shift();
    if (!m) { toastT = null; return; }
    const el = $('toast'); el.textContent = m; el.classList.add('show');
    toastT = setTimeout(() => { el.classList.remove('show'); setTimeout(() => { toastT = null; nextToast(); }, 350); }, 2200);
  }
  function modal(html) { $('modal-body').innerHTML = html; $('modal').hidden = false; }
  $('modal-close').onclick = () => { $('modal').hidden = true; };

  // ---------- panel ----------
  let tab = 'grow', qty = 1, sigCache = '', confirmBloom = false, confirmReset = false;
  const list = $('list');

  function qtyFor(g) { const q = qty === 'max' ? Math.max(1, GL.maxAffordable(S, g.id)) : qty; return q; }

  function renderPanel(force) {
    $('buyqty').classList.toggle('hide', tab !== 'grow');
    let sig;
    if (tab === 'grow') sig = 'grow';
    else if (tab === 'upgrades') sig = 'up:' + GL.UPGRADES.filter((u) => GL.upgradeVisible(S, u)).map((u) => u.id).join(',');
    else if (tab === 'bloom') sig = 'bloom:' + S.seeds + S.seedUps.join(',') + S.blooms + confirmBloom + GL.canBloom(S);
    else sig = 'tro:' + S.ach.length;
    if (sig !== sigCache || force) { sigCache = sig; buildPanel(); }
    updatePanel();
  }

  function buildPanel() {
    let h = '';
    if (tab === 'grow') {
      for (const g of GL.GENS) h += '<button class="row" data-gen="' + g.id + '"><img class="ico" src="' + iconURL(g.id) + '" alt=""><span class="main"><span class="name">' + esc(g.name) + '</span><br><span class="sub" data-sub="' + g.id + '"></span></span><span class="cost" data-cost="' + g.id + '"></span><span class="own" data-own="' + g.id + '"></span></button>';
    } else if (tab === 'upgrades') {
      const ups = GL.UPGRADES.filter((u) => GL.upgradeVisible(S, u)).sort((a, b) => a.cost - b.cost);
      h += ups.length ? '' : '<p class="note">No upgrades yet. Grow your grotto and new ones will appear here.</p>';
      for (const u of ups) h += '<button class="row" data-up="' + u.id + '"><span class="main"><span class="name">' + esc(u.name) + '</span><br><span class="sub">' + esc(u.desc) + '</span></span><span class="cost" data-upcost="' + u.id + '">' + GL.fmt(u.cost) + '</span></button>';
      h += '<p class="note">Upgrades reset when you Bloom.</p>';
    } else if (tab === 'bloom') {
      h += '<p class="note">Bloom to wither your grotto and sprout again with <b>Seeds</b>. Every seed you ever earn makes all spore production +4%, forever. Seeds you have not spent can buy permanent gifts below.</p>';
      h += '<button class="big" id="bloomBtn"></button>';
      h += '<div class="note">Seeds: <b>' + S.seeds + '</b> to spend &middot; ' + S.seedsEver + ' ever earned &middot; Blooms: ' + S.blooms + '</div><h3>Permanent gifts</h3>';
      for (const u of GL.SEED_UPGRADES) {
        const own = S.seedUps.includes(u.id);
        h += '<button class="row' + (own ? ' dim' : '') + '" data-seedup="' + u.id + '"><span class="main"><span class="name">' + esc(u.name) + '</span><br><span class="sub">' + esc(u.desc) + '</span></span><span class="cost">' + (own ? 'Owned' : u.cost + ' seeds') + '</span></button>';
      }
    } else {
      h += '<p class="note">Each trophy adds +1% to all spore production. ' + S.ach.length + ' of ' + GL.ACHIEVEMENTS.length + ' earned.</p>';
      for (const a of GL.ACHIEVEMENTS) { const own = S.ach.includes(a.id); h += '<div class="tro' + (own ? '' : ' locked') + '"><span>' + (own ? '&#9733;' : '&#9734;') + '</span><span><b>' + esc(a.name) + '</b><br><span class="sub">' + esc(a.desc) + '</span></span></div>'; }
    }
    list.innerHTML = h;
  }

  function updatePanel() {
    if (tab === 'grow') {
      for (const g of GL.GENS) {
        const q = qtyFor(g), cost = GL.genCost(S, g.id, q), row = list.querySelector('[data-gen="' + g.id + '"]');
        if (!row) continue;
        const per = g.rate * GL.genMult(S, g.id) * GL.globalMult(S);
        row.querySelector('[data-sub]').textContent = GL.fmt(per) + '/s each' + (q > 1 ? ' (x' + q + ')' : '');
        row.querySelector('[data-cost]').textContent = GL.fmt(cost);
        row.querySelector('[data-own]').textContent = S.gens[g.id] || 0;
        row.classList.toggle('afford', S.spores >= cost);
        row.classList.toggle('dim', S.spores < cost && (S.gens[g.id] || 0) === 0 && S.total < cost * 0.3);
      }
    } else if (tab === 'upgrades') {
      list.querySelectorAll('[data-up]').forEach((row) => { const u = GL.UPGRADES.find((x) => x.id === row.dataset.up); row.classList.toggle('afford', S.spores >= u.cost); });
    } else if (tab === 'bloom') {
      const b = $('bloomBtn'), gain = GL.bloomGain(S);
      if (b) { b.disabled = gain < 1; b.textContent = gain < 1 ? 'Bloom unlocks after 100K spores in one run' : (confirmBloom ? 'Tap again to confirm: Bloom for +' + gain + ' seeds' : 'Bloom now: +' + gain + ' seeds'); }
      list.querySelectorAll('[data-seedup]').forEach((row) => { const u = GL.SEED_UPGRADES.find((x) => x.id === row.dataset.seedup); row.classList.toggle('afford', !S.seedUps.includes(u.id) && S.seeds >= u.cost); });
    }
  }

  list.addEventListener('click', (e) => {
    unlockAudio();
    const row = e.target.closest('[data-gen],[data-up],[data-seedup],#bloomBtn');
    if (!row) return;
    if (row.dataset.gen) {
      const g = GL.genById(row.dataset.gen), n = GL.buyGen(S, g.id, qtyFor(g));
      if (n) { sfx.buy(); burst(W / 2, 120, 8, ['#7ee081', '#fff3b0']); } else sfx.no();
    } else if (row.dataset.up) {
      if (GL.buyUpgrade(S, row.dataset.up)) { sfx.buy(); renderPanel(true); } else sfx.no();
    } else if (row.dataset.seedup) {
      if (GL.buySeedUpgrade(S, row.dataset.seedup)) { sfx.buy(); toast('Gift unlocked!'); renderPanel(true); } else sfx.no();
    } else if (row.id === 'bloomBtn') {
      if (!GL.canBloom(S)) return;
      if (!confirmBloom) { confirmBloom = true; renderPanel(true); setTimeout(() => { confirmBloom = false; }, 4000); return; }
      confirmBloom = false;
      const gain = GL.bloom(S);
      sfx.bloom(); burst(W / 2, 90, 60, ['#ff9ad5', '#fff3b0', '#b388ff']);
      toast('The grotto blooms! +' + gain + ' seeds');
      save(); renderPanel(true);
    }
    afterAction();
  });

  $('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    unlockAudio(); tab = b.dataset.tab; confirmBloom = false;
    document.querySelectorAll('#tabs button').forEach((x) => x.classList.toggle('on', x === b));
    list.scrollTop = 0; renderPanel(true);
  });
  $('buyqty').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    qty = b.dataset.q === 'max' ? 'max' : Number(b.dataset.q);
    document.querySelectorAll('#buyqty button').forEach((x) => x.classList.toggle('on', x === b));
    updatePanel();
  });

  // ---------- scene input ----------
  function doTap(clientX, clientY) {
    unlockAudio();
    const v = GL.tap(S);
    squish = 1; sfx.tap();
    const r = cv.getBoundingClientRect(), s = Math.min(r.width / W, r.height / H);
    const ox = r.left + (r.width - W * s) / 2, oy = r.top + (r.height - H * s) / 2;
    const x = Math.max(8, Math.min(W - 40, (clientX - ox) / s)), y = Math.max(20, Math.min(H - 10, (clientY - oy) / s));
    parts.push({ x, y, vx: 0, vy: -28, life: 0.8, col: '#fff3b0', text: '+' + GL.fmt(v) });
    burst(x, y, 3, ['#ffd0ec', '#fff3b0']);
    afterAction();
  }
  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); doTap(e.clientX, e.clientY); });
  window.addEventListener('keydown', (e) => {
    if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat && document.activeElement && document.activeElement.tagName !== 'BUTTON' && $('modal').hidden) { e.preventDefault(); const r = cv.getBoundingClientRect(); doTap(r.left + r.width / 2, r.top + r.height * 0.55); }
  });

  const goldenEl = $('golden');
  goldenEl.addEventListener('click', () => {
    unlockAudio();
    const r = GL.catchGolden(S);
    if (!r) return;
    sfx.golden(); toast(r.text + (r.amount ? ' +' + GL.fmt(r.amount) : ''));
    burst(W / 2, 90, 30, ['#ffd23f', '#fff3b0']);
    afterAction();
  });

  $('mute').addEventListener('click', () => { S.muted = !S.muted; unlockAudio(); updateBar(); save(); if (!S.muted) sfx.buy(); });
  $('gift').addEventListener('click', () => {
    unlockAudio();
    const r = GL.claimGift(S, Date.now());
    if (!r) return;
    sfx.gift(); toast('Daily gift: +' + GL.fmt(r.spores) + ' spores' + (r.seeds ? ' and 1 seed' : '') + ' (day ' + r.streak + ')');
    save(); updateBar();
  });
  $('about-btn').addEventListener('click', () => {
    confirmReset = false; aboutModal();
  });
  function aboutModal() {
    modal('<h2>Sporeling Grotto</h2><p>' + esc(CREDITS_LINE) + '</p><p class="sub">Tap the big mushroom to make spores. Spend them on growers and upgrades. Catch golden spores. Bloom to earn Seeds and grow faster next time. Your grotto keeps growing while you are away.</p><p class="sub">Progress is saved in this browser only. No data leaves your device.</p><button id="reset-btn">Reset all progress</button>');
    $('reset-btn').onclick = function () {
      if (!confirmReset) { confirmReset = true; this.textContent = 'Tap again to erase everything'; return; }
      writeSave(''); S = GL.newState(Date.now()); S.nextGolden = 50; confirmReset = false; $('modal').hidden = true; renderPanel(true); toast('Progress erased');
    };
  }

  function updateBar() {
    $('mute').textContent = 'Sound: ' + (S.muted ? 'off' : 'on');
    $('gift').hidden = !GL.giftReady(S, Date.now()) || S.total < 20;
  }

  function afterAction() {
    for (const id of GL.checkAchievements(S)) { const a = GL.ACHIEVEMENTS.find((x) => x.id === id); sfx.ach(); toast('Trophy: ' + a.name + ' (+1% production)'); }
    $('spores').textContent = GL.fmt(S.spores);
    $('rate').textContent = GL.fmt(GL.sps(S)) + ' per second';
    updatePanel();
  }

  // ---------- main loop ----------
  let last = performance.now(), lastWall = Date.now(), accPanel = 0, accSave = 0, accBar = 0;
  function frame(nowMs) {
    const wall = Date.now(), gap = (wall - lastWall) / 1000;
    lastWall = wall;
    let dt = Math.min((nowMs - last) / 1000, 1);
    last = nowMs;
    if (gap > 30) { // tab was frozen or hidden
      const g = GL.applyOffline(S, gap);
      if (g > 0) { toast('Welcome back! Your grotto made ' + GL.fmt(g) + ' spores while you were away.'); }
      dt = 0;
    }
    time += dt;
    GL.advance(S, dt);
    stepParts(dt);
    drawScene();
    accPanel += dt; accSave += dt; accBar += dt;
    if (accPanel > 0.2) {
      accPanel = 0;
      $('spores').textContent = GL.fmt(S.spores);
      $('rate').textContent = GL.fmt(GL.sps(S)) + ' per second';
      renderPanel(false);
      const ach = GL.checkAchievements(S);
      for (const id of ach) { const a = GL.ACHIEVEMENTS.find((x) => x.id === id); sfx.ach(); toast('Trophy: ' + a.name + ' (+1% production)'); }
      // golden orb
      if (S.golden) { goldenEl.hidden = false; goldenEl.style.left = (S.golden.x * 100) + '%'; goldenEl.style.top = (S.golden.y * 100) + '%'; }
      else goldenEl.hidden = true;
      const bf = S.buffs.map((b) => '<div class="buff">' + (b.kind === 'frenzy' ? 'Frenzy x7' : 'Tap storm x10') + ' ' + Math.ceil(b.t) + 's</div>').join('');
      if ($('buffs').innerHTML !== bf) $('buffs').innerHTML = bf;
    }
    if (accBar > 2) { accBar = 0; updateBar(); }
    if (accSave > 10) { accSave = 0; save(); }
    requestAnimationFrame(frame);
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  window.addEventListener('pagehide', save);
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  // test hook: lets the headless-browser test fast-forward and inspect (no effect on play)
  window.__sg = { get state() { return S; }, GL, fast(sec) { const n = Math.ceil(sec / 0.25); for (let i = 0; i < n; i++) GL.advance(S, 0.25); }, save, renderPanel };

  resize(); renderPanel(true); updateBar(); afterAction();
  if (awayInfo) modal('<h2>Welcome back!</h2><p>Your grotto kept growing while you were away and made <b>' + GL.fmt(awayInfo.gain) + '</b> spores.</p>');
  else if (!hadSave) modal('<h2>Sporeling Grotto</h2><p class="sub">Tap the big mushroom to make spores.<br>Buy growers on the right. Catch golden spores!</p>');
  requestAnimationFrame(frame);
})();
