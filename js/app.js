(() => {
  'use strict';
  const D = window.NEPO || { cases: [], stats: [], quiz: [], trees: [], quotes: [], words: [] };
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => /^https?:\/\//i.test(String(u || '')) ? String(u) : '#';
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'source'; } };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  };

  const CATS = {
    'tech': { label: 'Tech', emo: '💾', hue: 205 },
    'business': { label: 'Business', emo: '🏦', hue: 150 },
    'finance': { label: 'Finance', emo: '💸', hue: 95 },
    'hollywood': { label: 'Hollywood', emo: '🎬', hue: 350 },
    'music': { label: 'Music', emo: '🎤', hue: 285 },
    'fashion': { label: 'Fashion', emo: '👠', hue: 320 },
    'media': { label: 'Media', emo: '📺', hue: 25 },
    'politics-us': { label: 'US Politics', emo: '🏛️', hue: 225 },
    'politics-world': { label: 'World Politics', emo: '🌍', hue: 10 },
    'sports': { label: 'Sports', emo: '🏆', hue: 45 },
    'global-entertainment': { label: 'Global Showbiz', emo: '🎭', hue: 265 },
    'royals': { label: 'Royals', emo: '👑', hue: 48 },
    'academia': { label: 'Admissions', emo: '🎓', hue: 180 },
    'history': { label: 'History', emo: '📜', hue: 30 },
  };
  const TROPES = {
    'hired-by-family': '👔 Hired by family', 'inherited-company': '🏢 Inherited the company', 'inherited-seat': '🪑 Inherited the seat',
    'inherited-country': '👑 Inherited a country', 'family-bought-it': '💳 Family bought it', 'appointed-by-family': '📜 Appointed by family',
    'board-seat': '🛋️ Board seat', 'name-opens-doors': '🚪 The name opens doors', 'cast-by-family': '🎬 Cast by family',
    'rules-changed': '📏 Rules got changed', 'family-money-seed': '🌱 Family money seed', 'legacy-admission': '🎓 Legacy admit',
    'rescued-or-pardoned': '🛟 Rescued / pardoned', 'married-in': '💍 Married in', 'sibling-deal': '🤝 Sibling deal',
    'deal-flow-from-office': '💼 Deal flow from office', 'perks-of-the-palace': '🏰 Perks of the palace', 'other': '🤷 Other',
  };
  const TIERS = [
    { key: 'diamond', min: 85, emo: '💎', label: 'Diamond Spoon', note: '85+' },
    { key: 'gold', min: 65, emo: '🥇', label: 'Gold Spoon', note: '65–84' },
    { key: 'silver', min: 40, emo: '🥈', label: 'Silver Spoon', note: '40–64' },
    { key: 'bronze', min: 0, emo: '🥉', label: 'Bronze Spoon', note: '<40' },
  ];
  const tierTag = (t) => `<span class="tierlbl t-${t.key}"><span class="t-emo" aria-hidden="true">${t.emo}</span>${t.label}</span>`;
  const tierOf = (n) => TIERS.find(t => n >= t.min) || TIERS[TIERS.length - 1];
  const score = (c) => (c.score && typeof c.score.total === 'number') ? c.score.total : 0;
  const initials = (name) => {
    const parts = String(name).replace(/\(.*?\)/g, '').split(/\s+/).filter(Boolean);
    const pick = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] || '?').slice(0, 2);
    return pick.toUpperCase();
  };
  const avatar = (c) => {
    const cat = CATS[c.category] || { hue: 0, emo: '' };
    return `<div class="avatar" style="background:linear-gradient(135deg,hsl(${cat.hue} 62% 46%),hsl(${(cat.hue + 30) % 360} 70% 32%))" aria-hidden="true">${esc(initials(c.name))}<span class="emo">${cat.emo}</span></div>`;
  };
  const srcLinks = (sources) => (sources || []).map(s => `<a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.title || host(s.url))}</a>`).join(' · ');

  // rank by score (ties: notability, then surprise)
  const cases = (D.cases || []).filter(c => c.category !== 'history' || true).slice();
  const ranked = cases.filter(c => c.category !== 'history').sort((a, b) => score(b) - score(a) || (b.notability || 0) - (a.notability || 0) || (b.surprise || 0) - (a.surprise || 0));
  ranked.forEach((c, i) => { c._rank = i + 1; });
  const byId = new Map(cases.map(c => [c.id, c]));

  // ---------- regions (default: USA) ----------
  const isUS = (c) => c.us === true || /united states|\busa\b|\bu\.s\./i.test(c.country || '');
  const REGIONS = {
    us: { label: '🇺🇸 USA', test: isUS, where: 'in the USA', other: 'outside the USA' },
    world: { label: '🌍 Rest of world', test: c => !isUS(c), where: 'outside the USA', other: 'in the USA' },
    all: { label: '🌐 Everyone', test: () => true, where: 'worldwide', other: '' },
  };
  const rankIn = {};
  for (const k of Object.keys(REGIONS)) { rankIn[k] = new Map(); ranked.filter(REGIONS[k].test).forEach((c, i) => rankIn[k].set(c.id, i + 1)); }
  const savedRegion = store.get('nepo-region');
  const state = { region: REGIONS[savedRegion] ? savedRegion : 'us', cat: '', trope: '', q: '', sort: 'score', shown: 30 };
  const inRegion = (c) => REGIONS[state.region].test(c);
  const rankOf = (c) => rankIn[state.region].get(c.id) || c._rank;
  const rebus = (c, cls = 'rebus') => c.emoji ? `<span class="${cls}" aria-hidden="true">${esc(c.emoji)}</span>` : '';

  // ---------- theme ----------
  const themeBtn = $('#themeToggle');
  const saved = store.get('nepo-theme');
  if (saved) document.documentElement.dataset.theme = saved;
  themeBtn.addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('nepo-theme', next);
  });

  // ---------- header bits ----------
  $('#caseCount').textContent = String(cases.length);
  if (D.updated) $('#updated').textContent = D.updated;

  const ticker = $('#ticker');
  function renderTicker() {
    const tickItems = ranked.filter(inRegion).slice(0, 40).map(c => {
      const sym = (c.ticker_symbol || c.name.split(' ').slice(-1)[0]).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
      return `<span class="tick-item"><span class="up">▲${score(c)}</span><span class="sym">${esc(sym)}</span>${c.emoji ? `<span class="tk-emo">${esc(c.emoji)}</span>` : ''}<span class="what">${esc(c.ticker || c.hook || '')}</span></span>`;
    }).join('');
    ticker.innerHTML = tickItems + tickItems;
  }

  const heroPicks = (D.stats || []).filter(s => s.hero);
  const heroStats = (heroPicks.length ? heroPicks : (D.stats || []).filter(s => s.multiplier)).slice(0, 8);
  let heroIdx = 0;
  const heroEl = $('#heroStat');
  const showHero = () => {
    if (!heroStats.length) { heroEl.hidden = true; return; }
    const s = heroStats[heroIdx % heroStats.length];
    heroEl.innerHTML = `<div class="big">${esc(s.number)}</div><div class="what">${esc(s.headline)}</div><div class="src">${srcLinks(s.sources)}</div>`;
    heroIdx++;
  };
  showHero();
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) setInterval(showHero, 7000);

  $('#tierLegend').innerHTML = TIERS.map(t => `<span class="tier t-${t.key}"><span class="t-emo" aria-hidden="true">${t.emo}</span>${t.label} <small>${t.note}</small></span>`).join('');

  // ---------- board ----------
  const chipsEl = $('#catChips');
  let cats = [];
  function renderChips() {
    const pool = ranked.filter(inRegion);
    const catCounts = pool.reduce((m, c) => (m[c.category] = (m[c.category] || 0) + 1, m), {});
    cats = Object.keys(CATS).filter(k => catCounts[k]);
    if (state.cat && !catCounts[state.cat]) state.cat = '';
    chipsEl.innerHTML = `<button class="chip" type="button" data-cat="" aria-pressed="${!state.cat}">✨ All<span class="n">${pool.length}</span></button>` +
      cats.map(k => `<button class="chip" type="button" data-cat="${k}" aria-pressed="${state.cat === k}">${CATS[k].emo} ${CATS[k].label}<span class="n">${catCounts[k]}</span></button>`).join('');
  }
  const regionEl = $('#regionSeg');
  regionEl.innerHTML = Object.entries(REGIONS).map(([k, r]) => `<button type="button" class="seg" data-region="${k}" aria-pressed="${state.region === k}">${r.label}<span class="n">${rankIn[k].size}</span></button>`).join('');
  function setRegion(k) {
    if (!REGIONS[k]) return;
    state.region = k; state.shown = 30; store.set('nepo-region', k);
    regionEl.querySelectorAll('.seg').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.region === k)));
    renderRegion();
  }
  regionEl.addEventListener('click', e => { const b = e.target.closest('.seg'); if (b) setRegion(b.dataset.region); });
  chipsEl.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    state.cat = b.dataset.cat; state.shown = 30;
    chipsEl.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    renderBoard();
  });
  const tropeCounts = ranked.reduce((m, c) => ((c.tropes || []).forEach(t => m[t] = (m[t] || 0) + 1), m), {});
  $('#tropeSel').innerHTML += Object.keys(TROPES).filter(t => tropeCounts[t]).map(t => `<option value="${t}">${TROPES[t]} (${tropeCounts[t]})</option>`).join('');
  $('#tropeSel').addEventListener('change', e => { state.trope = e.target.value; state.shown = 30; renderBoard(); });
  $('#sortSel').addEventListener('change', e => { state.sort = e.target.value; renderBoard(); });
  let qTimer;
  $('#search').addEventListener('input', e => { clearTimeout(qTimer); qTimer = setTimeout(() => { state.q = e.target.value.trim().toLowerCase(); state.shown = 30; renderBoard(); }, 120); });
  $('#moreBtn').addEventListener('click', () => { state.shown += 30; renderBoard(); });

  $('#randomBtn').addEventListener('click', () => {
    const pool = ranked.filter(inRegion);
    if (pool.length) openCase(pool[Math.floor(Math.random() * pool.length)].id);
  });
  const hay = (c) => c._hay || (c._hay = [c.name, c.known_as, c.country, c.hook, c.headline, (c.relatives || []).map(r => r.name).join(' ')].join(' ').toLowerCase());
  const sorters = {
    score: (a, b) => a._rank - b._rank,
    brazen: (a, b) => ((b.score || {}).brazen || 0) - ((a.score || {}).brazen || 0) || a._rank - b._rank,
    stakes: (a, b) => ((b.score || {}).stakes || 0) - ((a.score || {}).stakes || 0) || a._rank - b._rank,
    surprise: (a, b) => (b.surprise || 0) - (a.surprise || 0) || a._rank - b._rank,
    name: (a, b) => a.name.localeCompare(b.name),
  };
  function renderBoard() {
    const match = (c) => (!state.cat || c.category === state.cat) && (!state.trope || (c.tropes || []).includes(state.trope)) && (!state.q || hay(c).includes(state.q));
    const list = ranked.filter(c => inRegion(c) && match(c)).sort(sorters[state.sort]);
    const filtered = state.cat || state.trope || state.q;
    const elsewhere = state.region === 'all' || !filtered ? 0 : ranked.filter(c => !inRegion(c) && match(c)).length;
    $('#resultCount').innerHTML = `${list.length} ${list.length === 1 ? 'entry' : 'entries'} ${esc(REGIONS[state.region].where)}${filtered ? ' match' : ''}` +
      (elsewhere ? ` · <button type="button" class="linkish" data-region="all">+${elsewhere} more ${esc(REGIONS[state.region].other)} →</button>` : '');
    const shown = list.slice(0, state.shown);
    $('#boardList').innerHTML = shown.length ? shown.map(rowHtml).join('') : '<li class="empty">🕵️ Nobody matches. Suspiciously self-made.</li>';
    $('#moreBtn').hidden = list.length <= state.shown;
  }
  $('#resultCount').addEventListener('click', e => { const b = e.target.closest('[data-region]'); if (b) setRegion(b.dataset.region); });
  function rowHtml(c) {
    const s = score(c), t = tierOf(s), cat = CATS[c.category] || { label: c.category, emo: '' };
    return `<li class="row" tabindex="0" role="button" data-id="${esc(c.id)}" aria-label="${esc(c.name)}, Nepo Score ${s}">
      <div class="rank">${rankOf(c)}</div>
      ${avatar(c)}
      <div class="who">
        <p class="nm">${esc(c.name)} ${rebus(c)}</p>
        <p class="ka">${esc(c.known_as)}</p>
        <p class="hk">${esc(c.headline || c.hook)}</p>
        <div class="tags"><span class="tag cat">${cat.emo} ${esc(cat.label)}</span>${(c.tropes || []).slice(0, 3).map(tr => `<span class="tag">${esc(TROPES[tr] || tr)}</span>`).join('')}</div>
      </div>
      <div class="scorebox">
        <div class="score">${s}<small>/100</small></div>
        <div class="bar"><span style="width:${s}%"></span></div>
        ${tierTag(t)}
      </div>
    </li>`;
  }
  $('#boardList').addEventListener('click', e => { const r = e.target.closest('.row'); if (r) openCase(r.dataset.id); });
  $('#boardList').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('row')) { e.preventDefault(); openCase(e.target.dataset.id); } });
  const champsEl = $('#champs');
  function renderChamps() {
    champsEl.innerHTML = cats.map(k => ranked.find(c => c.category === k && inRegion(c))).filter(Boolean).map(c => {
      const s = score(c), t = tierOf(s), cat = CATS[c.category];
      return `<button type="button" class="champ" data-id="${esc(c.id)}"><span class="c-cat">${cat.emo} ${esc(cat.label)} · #${rankOf(c)}</span><span class="c-nm">${esc(c.name)}</span>${rebus(c, 'c-rebus')}<span class="c-hk">${esc(c.headline || c.hook)}</span><span class="c-sc"><b>${s}</b>${t.emo} ${esc(t.label)}</span></button>`;
    }).join('');
  }
  champsEl.addEventListener('click', e => { const b = e.target.closest('.champ'); if (b) openCase(b.dataset.id); });
  function renderRegion() { renderChips(); renderChamps(); renderTicker(); renderBoard(); }
  renderRegion();

  // ---------- modal ----------
  const modal = $('#modal'), modalBody = $('#modalBody');
  let lastFocus = null;
  function openCase(id, fromHash) {
    const c = byId.get(id); if (!c) return;
    lastFocus = document.activeElement;
    const s = score(c), t = tierOf(s), sc = c.score || {}, cat = CATS[c.category] || { label: c.category, emo: '' };
    const rels = (c.relatives || []).map(r => `<p><b>${esc(r.name)}</b> <span class="tag">${esc(r.relation)}</span><br>${esc(r.power)}</p>`).join('');
    modalBody.innerHTML = `
      <div class="m-head">${avatar(c)}<div>
        <p class="m-rank">${c._rank ? `#${rankIn[isUS(c) ? 'us' : 'world'].get(c.id)} ${isUS(c) ? 'in the USA 🇺🇸' : 'outside the USA 🌍'} · #${c._rank} overall · ` : ''}${cat.emo} ${esc(cat.label)} · ${esc(c.country)}</p>
        <h2 class="m-name" id="modalTitle">${esc(c.name)}</h2>
        <p class="m-ka">${esc(c.known_as)}</p>
      </div></div>
      ${rebus(c, 'm-rebus')}
      <p class="m-headline">${esc(c.headline || c.hook)}</p>
      ${c.quip ? `<p class="m-quip">${esc(c.quip)}</p>` : ''}
      ${c.category !== 'history' ? `<div class="m-box"><h4>🥄 Nepo Score</h4>
        <div style="display:flex;align-items:baseline;gap:12px;flex-wrap:wrap"><span class="m-big">${s}</span>${tierTag(t)}</div>
        <div class="m-sub">
          <div><b>${sc.legup ?? '–'}</b><span>🦵 Leg-up /40</span></div>
          <div><b>${sc.stakes ?? '–'}</b><span>🏆 Prize /30</span></div>
          <div><b>${sc.brazen ?? '–'}</b><span>😳 Brazen /20</span></div>
          <div><b>${sc.irony ?? '–'}</b><span>🙃 Irony /10</span></div>
        </div></div>` : ''}
      <div class="m-grid">
        <div class="m-box thanks"><h4>👪 Thanks, family</h4>${rels}</div>
        <div class="m-box"><h4>🎁 What they got</h4><p>${esc(c.what_they_got)}</p>${c.big_number ? `<p class="m-big" style="font-size:34px;margin-top:10px">${esc(c.big_number)}</p>` : ''}</div>
      </div>
      <div class="m-section"><h4>🪜 The leg-up</h4><p>${esc(c.the_leg_up)}</p></div>
      ${c.quote && c.quote.text ? `<blockquote class="m-quote">“${esc(c.quote.text)}”<cite>— ${esc(c.quote.speaker)}${c.quote.context ? `, ${esc(c.quote.context)}` : ''} · <a href="${esc(safeUrl(c.quote.url))}" target="_blank" rel="noopener noreferrer">source</a></cite></blockquote>` : ''}
      <div class="m-section"><h4>🧾 The receipts</h4><ol class="m-facts">${(c.key_facts || []).map(f => `<li>${esc(f.fact)}<div class="srcs">${srcLinks(f.sources)}</div></li>`).join('')}</ol></div>
      <div class="m-section"><h4>⚖️ In fairness</h4><p>${esc(c.nuance)}</p></div>
      ${c.status_2026 ? `<div class="m-section"><h4>📍 Where things stand (late 2026)</h4><p>${esc(c.status_2026)}</p></div>` : ''}
      <div class="tags" style="margin-top:18px">${(c.tropes || []).map(tr => `<span class="tag">${esc(TROPES[tr] || tr)}</span>`).join('')}<span class="tag cat">${esc(c.years)}</span></div>
      <div class="m-actions"><button class="btn" type="button" data-copy>🔗 Copy link</button><button class="btn ghost" type="button" data-random>🎲 Another one</button><button class="btn ghost" type="button" data-close>Close</button></div>`;
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    $('.modal-card', modal).scrollTop = 0;
    $('.modal-card', modal).focus();
    if (!fromHash) history.replaceState(null, '', `#/e/${encodeURIComponent(c.id)}`);
  }
  function closeModal() {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    if (location.hash.startsWith('#/e/')) history.replaceState(null, '', location.pathname + location.search);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  modal.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) closeModal();
    if (e.target.closest('[data-random]')) { const pool = ranked.filter(inRegion); if (pool.length) openCase(pool[Math.floor(Math.random() * pool.length)].id); }
    const cp = e.target.closest('[data-copy]');
    if (cp) {
      const done = () => { cp.textContent = '✅ Copied'; setTimeout(() => { cp.textContent = '🔗 Copy link'; }, 1400); };
      try { navigator.clipboard.writeText(location.href).then(done, () => { cp.textContent = location.href; }); } catch { cp.textContent = location.href; }
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  const fromHash = () => { const m = location.hash.match(/^#\/e\/(.+)$/); if (m) openCase(decodeURIComponent(m[1]), true); };
  window.addEventListener('hashchange', fromHash);
  fromHash();

  // ---------- odds ----------
  const fmtMult = (n) => { const m = /^(\d+(?:\.\d+)?)x$/.exec(String(n || '')); if (!m) return n; const v = +m[1]; return (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10) + 'x'; };
  const odds = (D.stats || []).filter(s => typeof s.multiplier === 'number' && s.multiplier > 1).sort((a, b) => b.multiplier - a.multiplier);
  const maxLog = Math.log10(Math.max(10, ...odds.map(s => s.multiplier)));
  $('#oddsChart').innerHTML = odds.map(s => `<div class="odd"><div class="lbl">${esc(s.chart_label || s.headline)}<small>${esc(s.year)} · ${srcLinks(s.sources)}</small></div>
    <div class="track"><div class="fill" data-w="${Math.max(4, (Math.log10(s.multiplier) / maxLog) * 100).toFixed(1)}"></div><span class="val">${esc(fmtMult(s.number))}</span></div></div>`).join('');
  const others = (D.stats || []).filter(s => !(typeof s.multiplier === 'number' && s.multiplier > 1));
  $('#statGrid').innerHTML = others.map(s => `<div class="stat"><div class="n">${esc(s.number)}</div><p class="h">${esc(s.headline)}</p><p class="d">${esc(s.detail)}${s.caveat ? ` <i>(${esc(s.caveat)})</i>` : ''}</p><div class="s">${esc(s.year)} · ${srcLinks(s.sources)}</div></div>`).join('');
  const growBars = () => document.querySelectorAll('.odd .fill').forEach(f => { f.style.width = f.dataset.w + '%'; });
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { growBars(); io.disconnect(); } }, { threshold: .15 });
    io.observe($('#oddsChart'));
  } else growBars();

  // ---------- quiz ----------
  const quizBox = $('#quizBox');
  const shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const MODES = {
    quick: { label: '⚡ Quick 10', n: 10 },
    long: { label: '🏃 The 25', n: 25 },
    endless: { label: '♾️ Endless · 3 lives', n: Infinity, lives: 3 },
  };
  const seenKey = 'nepo-quiz-seen';
  const getSeen = () => { try { return new Set(JSON.parse(store.get(seenKey) || '[]')); } catch { return new Set(); } };
  const addSeen = (name) => { const s = getSeen(); s.add(name); store.set(seenKey, JSON.stringify([...s].slice(-400))); };
  let qz = null;
  function quizMenu() {
    const pool = D.quiz || [];
    quizBox.innerHTML = `<p class="q-progress" style="justify-content:center">🥄 ${pool.length} famous people · pick your poison</p>
      <h3 class="q-name" style="font-size:clamp(34px,6vw,56px)">Nepo or Not?</h3>
      <p class="q-ka">Guess who had a leg-up. “It’s complicated” ones count either way. Keys: ← nepo · → not.</p>
      <div class="q-btns">${Object.entries(MODES).map(([k, m]) => `<button class="btn" type="button" data-mode="${k}">${m.label}</button>`).join('')}</div>`;
  }
  function startQuiz(mode) {
    const pool = D.quiz || [];
    if (!pool.length) { quizBox.innerHTML = '<p>Quiz loading soon.</p>'; return; }
    const seen = getSeen();
    const fresh = shuffle(pool.filter(x => !seen.has(x.name))), stale = shuffle(pool.filter(x => seen.has(x.name)));
    const m = MODES[mode];
    qz = { mode, items: fresh.concat(stale).slice(0, Math.min(m.n, pool.length)), i: 0, right: 0, streak: 0, best: 0, lives: m.lives || 0, marks: [], answered: false };
    renderQ();
  }
  const hearts = () => MODES[qz.mode].lives ? ' ' + '❤️'.repeat(qz.lives) + '🖤'.repeat(MODES[qz.mode].lives - qz.lives) : '';
  function renderQ() {
    const it = qz.items[qz.i];
    const total = qz.mode === 'endless' ? '∞' : qz.items.length;
    quizBox.innerHTML = `<div class="q-progress"><span>Q ${qz.i + 1} / ${total}${hearts()}</span><span>${qz.streak >= 2 ? `🔥 ${qz.streak} streak · ` : ''}Score ${qz.right}</span></div>
      <h3 class="q-name">${esc(it.name)}</h3><p class="q-ka">${esc(it.known_as)}</p>
      <div class="q-btns"><button class="q-btn nepo" type="button" data-a="nepo">🥄 Nepo</button><button class="q-btn not" type="button" data-a="not-nepo">💪 Not</button></div>
      <div class="q-reveal" hidden></div>`;
  }
  function answer(a) {
    if (!qz || qz.answered) return;
    const it = qz.items[qz.i];
    const ok = it.answer === 'complicated' || it.answer === a;
    qz.answered = true;
    addSeen(it.name);
    if (ok) { qz.right++; qz.streak++; qz.best = Math.max(qz.best, qz.streak); } else { qz.streak = 0; if (qz.lives) qz.lives--; }
    qz.marks.push(it.answer === 'complicated' ? '🟨' : ok ? '🟩' : '🟥');
    quizBox.querySelectorAll('.q-btn').forEach(x => { x.disabled = true; x.style.opacity = x.dataset.a === a ? '1' : '.4'; });
    const label = it.answer === 'nepo' ? '🥄 Nepo.' : it.answer === 'not-nepo' ? '💪 Not nepo.' : '🤷 It’s complicated. (Point for you.)';
    const cheer = ok ? (qz.streak >= 5 ? `🔥 ${qz.streak} in a row!` : qz.streak >= 3 ? '🔥 On fire' : '🎉 Correct') : '😬 Wrong';
    const over = (qz.mode === 'endless' && qz.lives === 0) || qz.i + 1 >= qz.items.length;
    const r = $('.q-reveal', quizBox);
    r.hidden = false;
    r.innerHTML = `<p class="q-verdict ${ok ? 'right' : 'wrong'}">${cheer} — ${label}</p><p>${esc(it.reveal)}</p><div class="srcs">${srcLinks(it.sources)}</div>
      <div class="q-btns" style="margin-top:16px"><button class="btn" type="button" data-next>${over ? '🏁 See score' : 'Next →'}</button></div>`;
    $('.q-progress', quizBox).innerHTML = `<span>Q ${qz.i + 1} / ${qz.mode === 'endless' ? '∞' : qz.items.length}${hearts()}</span><span>${qz.streak >= 2 ? `🔥 ${qz.streak} streak · ` : ''}Score ${qz.right}</span>`;
    $('[data-next]', quizBox).focus();
  }
  function next() {
    if (!qz || !qz.answered) return;
    const over = (qz.mode === 'endless' && qz.lives === 0) || qz.i + 1 >= qz.items.length;
    if (over) return finishQuiz();
    qz.i++; qz.answered = false; renderQ();
  }
  quizBox.addEventListener('click', e => {
    const b = e.target.closest('[data-a]');
    if (b) return answer(b.dataset.a);
    if (e.target.closest('[data-next]')) return next();
    const m = e.target.closest('[data-mode]');
    if (m) return startQuiz(m.dataset.mode);
    if (e.target.closest('[data-menu]')) return quizMenu();
    const sh = e.target.closest('[data-share]');
    if (sh) {
      const text = sh.dataset.share;
      const done = () => { sh.textContent = '✅ Copied'; setTimeout(() => { sh.textContent = '📋 Copy my score'; }, 1500); };
      try { navigator.clipboard.writeText(text).then(done, () => { sh.textContent = text; }); } catch { sh.textContent = text; }
    }
  });
  document.addEventListener('keydown', e => {
    if (!qz || !modal.hidden || /input|select|textarea/i.test((e.target.tagName || ''))) return;
    const r = quizBox.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    if (!qz.answered && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); answer(e.key === 'ArrowLeft' ? 'nepo' : 'not-nepo'); }
    else if (qz.answered && e.key === 'Enter' && document.activeElement && !document.activeElement.closest('#quizBox')) { e.preventDefault(); next(); }
  });
  function finishQuiz() {
    const n = qz.marks.length, r = qz.right, pct = n ? r / n : 0;
    const msg = pct === 1 ? '🏆 Flawless. You can smell a trust fund through a screen.' : pct >= .7 ? '🕵️ Sharp eye. HR departments fear you.' : pct >= .4 ? '🤏 Not bad. Some of them hide it well.' : '🥺 You believe in meritocracy. That’s adorable.';
    const grid = qz.marks.join('');
    const url = location.origin + location.pathname + '#quiz';
    const share = `🥄 Nepo or Not? ${MODES[qz.mode].label}: ${r}/${n}${qz.best >= 3 ? ` · best streak 🔥${qz.best}` : ''}\n${grid}\n${url}`;
    quizBox.innerHTML = `<div class="q-final"><p class="q-progress" style="justify-content:center">Final score · ${esc(MODES[qz.mode].label)}</p><div class="big">${r}/${n}</div>
      <p class="q-grid" aria-label="Your answers">${grid}</p>
      ${qz.best >= 3 ? `<p class="q-ka">Best streak: 🔥 ${qz.best}</p>` : ''}
      <p class="q-ka" style="font-size:20px">${msg}</p>
      <div class="q-btns"><button class="btn" type="button" data-mode="${qz.mode}">🔁 Play again</button><button class="btn ghost" type="button" data-share="${esc(share)}">📋 Copy my score</button><button class="btn ghost" type="button" data-menu>🎛️ Modes</button></div></div>`;
    qz = null;
  }
  quizMenu();

  // ---------- trees ----------
  const trees = D.trees || [];
  const treeChips = $('#treeChips'), treeView = $('#treeView');
  treeChips.innerHTML = trees.map((t, i) => `<button class="chip" type="button" role="tab" data-i="${i}" aria-selected="${i === 0}">${esc(t.dynasty)}</button>`).join('');
  const ordinal = (n) => ['Founder', '2nd gen', '3rd gen', '4th gen', '5th gen', '6th gen', '7th gen'][n - 1] || `${n}th gen`;
  function renderTree(i) {
    const t = trees[i]; if (!t) { treeView.hidden = true; return; }
    const gens = (t.generations || []).slice().sort((a, b) => a.generation - b.generation);
    treeView.innerHTML = `<h3>${esc(t.dynasty)}</h3><p class="meta">${esc(t.domain)} · ${esc(t.country)} · ${esc(t.span)}</p>
      ${gens.map(g => `<div class="gen" data-gen="${ordinal(g.generation)}"><div class="gen-members">${(g.members || []).map(m => `<div class="node"><b>${esc(m.name)}</b><span>${esc(m.role)}</span>${m.years || m.relation ? `<small>${esc([m.relation, m.years].filter(Boolean).join(' · '))}</small>` : ''}</div>`).join('')}</div></div>`).join('')}
      <p class="fun">${esc(t.fun_fact)}</p><div class="srcs">${srcLinks(t.sources)}</div>`;
  }
  treeChips.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    treeChips.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    renderTree(+b.dataset.i);
  });
  renderTree(0);

  // ---------- quotes ----------
  const quotes = D.quotes || [];
  const toneChips = $('#toneChips');
  const TONE_EMO = { denial: '🙅', defensive: '🛡️', 'self-aware': '🫠', roast: '🔥', earnest: '🥹' };
  const tones = ['denial', 'defensive', 'self-aware', 'roast', 'earnest'].filter(t => quotes.some(q => q.tone === t));
  toneChips.innerHTML = `<button class="chip" type="button" data-t="" aria-pressed="true">✨ All</button>` + tones.map(t => `<button class="chip" type="button" data-t="${t}" aria-pressed="false">${TONE_EMO[t] || ''} ${t[0].toUpperCase() + t.slice(1)}</button>`).join('');
  function renderQuotes(tone) {
    $('#quoteWall').innerHTML = quotes.filter(q => !tone || q.tone === tone).map(q => `<figure class="quote"><blockquote>${esc(q.text)}</blockquote>
      <figcaption><div class="who">${esc(q.speaker)}</div><div class="ctx">${esc(q.speaker_context)}</div><div class="ctx">${esc(q.context)}${q.date ? `, ${esc(q.date)}` : ''}</div>
      <span class="tag tone tone-${esc(q.tone)}">${TONE_EMO[q.tone] || ''} ${esc(q.tone)}</span><div class="s">${srcLinks(q.sources)}</div></figcaption></figure>`).join('');
  }
  toneChips.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    toneChips.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    renderQuotes(b.dataset.t);
  });
  renderQuotes('');

  // ---------- words ----------
  $('#wordGrid').innerHTML = (D.words || []).map(w => `<button class="word" type="button" aria-pressed="false"><div class="word-inner">
    <div class="word-face front"><span class="lang">${esc(w.language)} · ${esc(w.country)}</span><span class="term">${esc(w.term)}</span><span class="lit">“${esc(w.literal)}”</span></div>
    <div class="word-face back"><span class="lit">“${esc(w.literal)}”</span><p>${esc(w.meaning)}</p>${w.note ? `<p>${esc(w.note)}</p>` : ''}<span class="s">${(w.sources || []).map(s => esc(host(s.url))).join(' · ')}</span></div>
  </div></button>`).join('');
  $('#wordGrid').addEventListener('click', e => { const w = e.target.closest('.word'); if (w) w.setAttribute('aria-pressed', String(w.getAttribute('aria-pressed') !== 'true')); });

  // ---------- history ----------
  const hist = cases.filter(c => c.category === 'history').sort((a, b) => (a.sort_year ?? 0) - (b.sort_year ?? 0));
  $('#timeline').innerHTML = hist.map(c => `<li class="tl"><div class="yr">${esc(c.year_label || c.years)}</div><div class="body" role="button" tabindex="0" data-id="${esc(c.id)}"><h3>${esc(c.name)} ${rebus(c)}</h3><p>${esc(c.headline || c.hook)}</p></div></li>`).join('');
  $('#timeline').addEventListener('click', e => { const b = e.target.closest('.body'); if (b) openCase(b.dataset.id); });
  $('#timeline').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.classList.contains('body')) openCase(e.target.dataset.id); });

})();
