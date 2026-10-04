/* Sporeling Grotto: pure game logic (no DOM). Works in the browser (window.GL) and in node (require). */
(function (root) {
  'use strict';

  const SAVE_VERSION = 1;
  const GROWTH = 1.15;
  const GENS = [
    { id: 'sprout', name: 'Sprouts', base: 15, rate: 0.1, blurb: 'Tiny buds that nibble moonlight.' },
    { id: 'moss', name: 'Moss Patch', base: 100, rate: 1, blurb: 'Soft and quietly productive.' },
    { id: 'glowcap', name: 'Glowcaps', base: 1100, rate: 8, blurb: 'Bright caps that shed spores.' },
    { id: 'farm', name: 'Fungus Farm', base: 12000, rate: 47, blurb: 'Neat rows, busy sporelings.' },
    { id: 'beetle', name: 'Cave Beetles', base: 130000, rate: 260, blurb: 'They carry spores everywhere.' },
    { id: 'roots', name: 'Root Network', base: 1.4e6, rate: 1400, blurb: 'The whole grotto hums together.' },
    { id: 'crystal', name: 'Crystal Bloom', base: 2e7, rate: 7800, blurb: 'Crystals that sing spores out.' },
    { id: 'star', name: 'Star Spores', base: 3.3e8, rate: 44000, blurb: 'A little sky inside the cave.' },
  ];
  const MILESTONES = [10, 25, 50, 100, 150];

  const SEED_BONUS = 0.04; // production per seed ever earned
  const BLOOM_DIVISOR = 1e5; // seeds = floor(sqrt(run / divisor))
  const OFFLINE_RATE = 0.5;
  const OFFLINE_CAP = 2 * 3600;
  const OFFLINE_CAP_DEEP = 6 * 3600;
  const GIFT_WAIT = 20 * 3600 * 1000;
  const GIFT_STREAK_WINDOW = 48 * 3600 * 1000;

  // Run upgrades: bought with spores, reset on bloom.
  const UPGRADES = [];
  GENS.forEach((g) => {
    UPGRADES.push({ id: g.id + '1', name: 'Rich Soil: ' + g.name, desc: g.name + ' make twice as many spores.', cost: g.base * 10, gen: g.id, mult: 2, req: (s) => (s.gens[g.id] || 0) >= 1 });
    UPGRADES.push({ id: g.id + '2', name: 'Moonwater: ' + g.name, desc: g.name + ' make twice as many spores.', cost: g.base * 1000, gen: g.id, mult: 2, req: (s) => (s.gens[g.id] || 0) >= 20 });
  });
  UPGRADES.push(
    { id: 'click1', name: 'Thumb Moss', desc: 'Tapping is twice as strong.', cost: 100, clickMult: 2, req: (s) => s.taps >= 10 },
    { id: 'click2', name: 'Steady Rhythm', desc: 'Each tap also gives 2% of your spores per second.', cost: 6000, clickPct: 0.02, req: (s) => s.run >= 2500 },
    { id: 'click3', name: 'Gloved Hands', desc: 'Tapping is twice as strong.', cost: 80000, clickMult: 2, req: (s) => s.run >= 40000 },
    { id: 'click4', name: 'Spore Whisperer', desc: 'Each tap also gives 3% of your spores per second.', cost: 3e6, clickPct: 0.03, req: (s) => s.run >= 1e6 },
    { id: 'glow1', name: 'Glow Dew', desc: 'All spore production +15%.', cost: 1.2e5, global: 1.15, req: (s) => s.run >= 5e4 },
    { id: 'glow2', name: 'Moon Tea', desc: 'All spore production +25%.', cost: 6e6, global: 1.25, req: (s) => s.run >= 2e6 },
    { id: 'glow3', name: 'Deep Roots', desc: 'All spore production +50%.', cost: 5e8, global: 1.5, req: (s) => s.run >= 2e8 },
  );

  // Seed upgrades: bought with seeds, permanent.
  const SEED_UPGRADES = [
    { id: 'head', name: 'Head Start', desc: 'Every new run begins with 10 Sprouts.', cost: 2 },
    { id: 'fingers', name: 'Strong Fingers', desc: 'Tapping is twice as strong, forever.', cost: 3 },
    { id: 'echo', name: 'Cave Echo', desc: 'All production x1.25, forever.', cost: 6 },
    { id: 'lucky', name: 'Lucky Spores', desc: 'Golden spores show up about 35% more often.', cost: 8 },
    { id: 'deep', name: 'Deep Sleep', desc: 'Offline growth lasts up to 6 hours instead of 2.', cost: 12 },
    { id: 'echo2', name: 'Grotto Chorus', desc: 'All production x1.5, forever.', cost: 40 },
  ];

  const ACHIEVEMENTS = [
    { id: 'tap10', name: 'First Touch', desc: 'Tap 10 times.', test: (s) => s.taps >= 10 },
    { id: 'tap500', name: 'Busy Fingers', desc: 'Tap 500 times.', test: (s) => s.taps >= 500 },
    { id: 'tap5000', name: 'Mushroom Masseur', desc: 'Tap 5,000 times.', test: (s) => s.taps >= 5000 },
    { id: 'tot1k', name: 'A Pinch of Spores', desc: 'Earn 1,000 spores in total.', test: (s) => s.total >= 1e3 },
    { id: 'tot100k', name: 'Spore Cloud', desc: 'Earn 100,000 spores in total.', test: (s) => s.total >= 1e5 },
    { id: 'tot10m', name: 'Spore Storm', desc: 'Earn 10 million spores in total.', test: (s) => s.total >= 1e7 },
    { id: 'tot1b', name: 'Spore Galaxy', desc: 'Earn 1 billion spores in total.', test: (s) => s.total >= 1e9 },
    { id: 'tot1t', name: 'Endless Bloom', desc: 'Earn 1 trillion spores in total.', test: (s) => s.total >= 1e12 },
    { id: 'gen5', name: 'Getting Started', desc: 'Own 5 growers of any kind.', test: (s) => totalGens(s) >= 5 },
    { id: 'gen50', name: 'Busy Grotto', desc: 'Own 50 growers.', test: (s) => totalGens(s) >= 50 },
    { id: 'gen200', name: 'Thriving Grotto', desc: 'Own 200 growers.', test: (s) => totalGens(s) >= 200 },
    { id: 'all', name: 'Full House', desc: 'Own at least one of every grower.', test: (s) => GENS.every((g) => (s.gens[g.id] || 0) >= 1) },
    { id: 'gold1', name: 'Golden Find', desc: 'Catch a golden spore.', test: (s) => s.goldenClicks >= 1 },
    { id: 'gold15', name: 'Sharp Eyes', desc: 'Catch 15 golden spores.', test: (s) => s.goldenClicks >= 15 },
    { id: 'bloom1', name: 'First Bloom', desc: 'Bloom for the first time.', test: (s) => s.blooms >= 1 },
    { id: 'bloom5', name: 'Seasoned Gardener', desc: 'Bloom 5 times.', test: (s) => s.blooms >= 5 },
    { id: 'streak3', name: 'Regular Visitor', desc: 'Claim a daily gift 3 days in a row.', test: (s) => s.giftStreak >= 3 },
    { id: 'upg10', name: 'Tinkerer', desc: 'Buy 10 upgrades in one run.', test: (s) => s.ups.length >= 10 },
  ];

  const num = (v, d) => (Number.isFinite(v) ? v : d);
  const totalGens = (s) => GENS.reduce((a, g) => a + (s.gens[g.id] || 0), 0);
  const genById = (id) => GENS.find((g) => g.id === id);

  function newState(now) {
    return {
      v: SAVE_VERSION, spores: 0, run: 0, total: 0, gens: {}, ups: [], seeds: 0, seedsEver: 0, seedUps: [],
      taps: 0, goldenClicks: 0, blooms: 0, buffs: [], golden: null, nextGolden: 50,
      lastGift: 0, giftStreak: 0, ach: [], lastSeen: now || 0, playTime: 0, muted: false,
    };
  }

  function genMult(s, id) {
    const n = s.gens[id] || 0;
    let m = 1;
    for (const t of MILESTONES) if (n >= t) m *= 2;
    for (const u of UPGRADES) if (u.gen === id && s.ups.includes(u.id)) m *= u.mult;
    return m;
  }

  function globalMult(s) {
    let m = 1 + SEED_BONUS * s.seedsEver;
    m *= 1 + 0.01 * s.ach.length;
    if (s.seedUps.includes('echo')) m *= 1.25;
    if (s.seedUps.includes('echo2')) m *= 1.5;
    for (const u of UPGRADES) if (u.global && s.ups.includes(u.id)) m *= u.global;
    return m;
  }

  function buffMult(s, kind) { return s.buffs.some((b) => b.kind === kind && b.t > 0); }

  function baseSps(s) {
    let sum = 0;
    for (const g of GENS) sum += (s.gens[g.id] || 0) * g.rate * genMult(s, g.id);
    return sum * globalMult(s);
  }

  function sps(s) { return baseSps(s) * (buffMult(s, 'frenzy') ? 7 : 1); }

  function clickPower(s) {
    let mult = 1, pct = 0;
    for (const u of UPGRADES) if (s.ups.includes(u.id)) { if (u.clickMult) mult *= u.clickMult; if (u.clickPct) pct += u.clickPct; }
    if (s.seedUps.includes('fingers')) mult *= 2;
    const v = (1 * mult + baseSps(s) * pct) * (1 + 0.5 * s.seedsEver * SEED_BONUS);
    return v * (buffMult(s, 'storm') ? 10 : 1);
  }

  // Cost of buying n more of a grower.
  function genCost(s, id, n) {
    const g = genById(id), k = s.gens[id] || 0;
    return Math.ceil(g.base * Math.pow(GROWTH, k) * (Math.pow(GROWTH, n) - 1) / (GROWTH - 1));
  }

  function maxAffordable(s, id) {
    let n = 0;
    while (n < 1000 && genCost(s, id, n + 1) <= s.spores) n++;
    return n;
  }

  function buyGen(s, id, qty) {
    if (!genById(id)) return 0;
    const n = qty === 'max' ? maxAffordable(s, id) : qty;
    if (n < 1 || genCost(s, id, n) > s.spores) return 0;
    s.spores -= genCost(s, id, n);
    s.gens[id] = (s.gens[id] || 0) + n;
    return n;
  }

  function upgradeVisible(s, u) { return !s.ups.includes(u.id) && u.req(s); }
  function buyUpgrade(s, id) {
    const u = UPGRADES.find((x) => x.id === id);
    if (!u || s.ups.includes(id) || !u.req(s) || s.spores < u.cost) return false;
    s.spores -= u.cost; s.ups.push(id); return true;
  }

  function earn(s, amount) { s.spores += amount; s.run += amount; s.total += amount; }

  function tap(s) { const v = clickPower(s); earn(s, v); s.taps++; return v; }

  function offlineCap(s) { return s.seedUps.includes('deep') ? OFFLINE_CAP_DEEP : OFFLINE_CAP; }

  // Advance time by dt seconds of active play. rng() in [0,1).
  function advance(s, dt, rng) {
    rng = rng || Math.random;
    if (!(dt > 0)) return;
    s.playTime += dt;
    const frenzy = buffMult(s, 'frenzy');
    // production for the part of dt while frenzy lasts is handled approximately per call; call with small dt.
    earn(s, sps(s) * dt);
    void frenzy;
    for (const b of s.buffs) b.t -= dt;
    s.buffs = s.buffs.filter((b) => b.t > 0);
    if (s.golden) { s.golden.life -= dt; if (s.golden.life <= 0) s.golden = null; }
    else {
      s.nextGolden -= dt;
      if (s.nextGolden <= 0) {
        s.golden = { life: 14, x: 0.15 + rng() * 0.7, y: 0.2 + rng() * 0.45 };
        s.nextGolden = (45 + rng() * 55) / (s.seedUps.includes('lucky') ? 1.35 : 1);
      }
    }
  }

  // Click a golden spore. Returns {kind, text} or null.
  function catchGolden(s, rng) {
    if (!s.golden) return null;
    rng = rng || Math.random;
    s.golden = null; s.goldenClicks++;
    const r = rng();
    if (r < 0.6) {
      const amt = Math.max(clickPower(s) * 13, baseSps(s) * 60);
      earn(s, amt);
      return { kind: 'burst', amount: amt, text: 'Spore burst!' };
    }
    if (r < 0.9) { s.buffs.push({ kind: 'frenzy', t: 20 }); return { kind: 'frenzy', text: 'Frenzy! Production x7 for 20s' }; }
    s.buffs.push({ kind: 'storm', t: 15 });
    return { kind: 'storm', text: 'Tap storm! Taps x10 for 15s' };
  }

  function offlineGain(s, seconds) {
    const sec = Math.max(0, Math.min(seconds, offlineCap(s)));
    return baseSps(s) * sec * OFFLINE_RATE;
  }
  function applyOffline(s, seconds) { const g = offlineGain(s, seconds); if (g > 0) earn(s, g); return g; }

  function bloomGain(s) { return Math.max(0, Math.floor(Math.sqrt(s.run / BLOOM_DIVISOR))); }
  function canBloom(s) { return bloomGain(s) >= 1; }

  function bloom(s) {
    const gain = bloomGain(s);
    if (gain < 1) return 0;
    s.seeds += gain; s.seedsEver += gain; s.blooms++;
    s.spores = 0; s.run = 0; s.gens = {}; s.ups = []; s.buffs = []; s.golden = null; s.nextGolden = 30;
    if (s.seedUps.includes('head')) s.gens.sprout = 10;
    return gain;
  }

  function buySeedUpgrade(s, id) {
    const u = SEED_UPGRADES.find((x) => x.id === id);
    if (!u || s.seedUps.includes(id) || s.seeds < u.cost) return false;
    s.seeds -= u.cost; s.seedUps.push(id);
    if (id === 'head' && !totalGens(s)) s.gens.sprout = 10;
    return true;
  }

  function giftReady(s, now) { return now - s.lastGift >= GIFT_WAIT; }
  function giftReward(s, now) {
    const streak = (s.lastGift && now - s.lastGift < GIFT_STREAK_WINDOW) ? s.giftStreak + 1 : 1;
    const spores = Math.max(200, baseSps(s) * 600) * (1 + 0.25 * Math.min(streak - 1, 6));
    return { streak, spores, seeds: streak % 3 === 0 ? 1 : 0 };
  }
  function claimGift(s, now) {
    if (!giftReady(s, now)) return null;
    const r = giftReward(s, now);
    s.giftStreak = r.streak; s.lastGift = now;
    earn(s, r.spores);
    if (r.seeds) { s.seeds += r.seeds; s.seedsEver += r.seeds; }
    return r;
  }

  // Returns ids of newly earned achievements.
  function checkAchievements(s) {
    const out = [];
    for (const a of ACHIEVEMENTS) if (!s.ach.includes(a.id) && a.test(s)) { s.ach.push(a.id); out.push(a.id); }
    return out;
  }

  function fmt(n) {
    if (!Number.isFinite(n)) return '0';
    if (n < 0) return '-' + fmt(-n);
    if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1) : String(Math.floor(n));
    const units = ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx'];
    let i = -1, v = n;
    while (v >= 1000 && i < units.length - 1) { v /= 1000; i++; }
    return v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2) + units[i];
  }

  // Tolerant loader: returns a valid state from any parsed JSON (or a fresh one).
  function sanitize(raw, now) {
    const s = newState(now);
    if (!raw || typeof raw !== 'object') return s;
    for (const k of ['spores', 'run', 'total', 'seeds', 'seedsEver', 'taps', 'goldenClicks', 'blooms', 'giftStreak', 'playTime', 'lastGift', 'lastSeen', 'nextGolden']) s[k] = Math.max(0, num(raw[k], s[k]));
    if (raw.gens && typeof raw.gens === 'object') for (const g of GENS) { const n = Math.floor(num(raw.gens[g.id], 0)); if (n > 0) s.gens[g.id] = Math.min(n, 100000); }
    const ids = (arr, list) => (Array.isArray(arr) ? arr.filter((x, i) => typeof x === 'string' && list.some((l) => l.id === x) && arr.indexOf(x) === i) : []);
    s.ups = ids(raw.ups, UPGRADES); s.seedUps = ids(raw.seedUps, SEED_UPGRADES); s.ach = ids(raw.ach, ACHIEVEMENTS);
    if (Array.isArray(raw.buffs)) s.buffs = raw.buffs.filter((b) => b && (b.kind === 'frenzy' || b.kind === 'storm') && num(b.t, 0) > 0).slice(0, 4).map((b) => ({ kind: b.kind, t: Math.min(b.t, 30) }));
    s.muted = !!raw.muted;
    return s;
  }

  const api = {
    GENS, UPGRADES, SEED_UPGRADES, ACHIEVEMENTS, MILESTONES, SAVE_VERSION, OFFLINE_CAP, OFFLINE_RATE,
    newState, sanitize, genMult, globalMult, sps, baseSps, clickPower, genCost, maxAffordable, buyGen, upgradeVisible, buyUpgrade,
    tap, advance, catchGolden, offlineGain, applyOffline, bloomGain, canBloom, bloom, buySeedUpgrade,
    giftReady, giftReward, claimGift, checkAchievements, fmt, totalGens, genById, earn,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.GL = api;
})(typeof window !== 'undefined' ? window : globalThis);
