/* ============================================================
   APP — tabs, rendering, event wiring
   ============================================================ */

let state = {
  activeTab: 'home',
  planDay: weekdayName(isoDate()),
  progressExerciseId: null,
  restTimers: {}
};

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }

let priorityPushTimer = null;
function pushImmediate() {
  if (!Storage.getSettings().githubToken) return;
  // Short enough that no one perceives this as a delay, long enough to
  // collapse a quick burst of actions (post, then react, then redeem, all
  // within a couple seconds) into one gist revision instead of three.
  clearTimeout(priorityPushTimer);
  priorityPushTimer = setTimeout(() => Sync.push(), 800);
}

function toast(msg) {
  const el = $('#toast');
  el.innerHTML = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2800);
}

function fireConfetti() {
  const theme = document.documentElement.dataset.theme;
  if (theme === 'sabrina') { fireFalling('sabrina-pr'); return; }
  if (theme === 'taylor') { fireFalling('taylor-pr'); return; }
  const colors = ['#4C8DFF', '#F0559C', '#2FD4C0', '#FFA94D', '#8B7CF6', '#4ADE80'];
  const count = 24;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = `${Math.random() * 0.3}s`;
    piece.style.animationDuration = `${1.4 + Math.random() * 0.8}s`;
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 2600);
  }
}

function avatarFor(name) {
  const profiles = getAllProfilesRaw();
  const emoji = profiles[name]?.settings?.avatarEmoji;
  return emoji || (name ? name.trim()[0].toUpperCase() : '?');
}

function fmtWeight(w, unit) { return `${w}${unit}`; }

function applyTheme() {
  const s = Storage.getSettings();
  document.documentElement.dataset.theme = s.theme || 'iron';
  document.documentElement.dataset.font = s.fontStyle || 'modern';
  applyAmbientEffect();
}

function renderProfileButton() {
  const { name } = Profiles.getActive();
  $('#profileNameLabel').textContent = name || 'Set up';
  $('#profileAvatar').textContent = name ? avatarFor(name) : '+';
}

function toggleProfilePanel() {
  const panel = $('#profilePanel');
  if (panel.style.display === 'none') { renderProfilePanel(); panel.style.display = 'block'; }
  else panel.style.display = 'none';
}

function renderProfilePanel() {
  const panel = $('#profilePanel');
  const names = Profiles.list();
  const activeName = Profiles.activeName();
  const settings = Storage.getSettings();
  panel.innerHTML = `
    ${names.length === 0 ? '<p class="helper-text" style="margin-top:0;">Welcome! Create a profile to get started — everyone sharing this app gets their own plan, logs, and theme.</p>' : ''}
    <h3>Profiles</h3>
    <div class="profile-list" id="profileListWrap"></div>
    <div class="row" style="margin-bottom:10px;">
      <input id="newProfileName" placeholder="New profile name">
      <button class="btn btn-sm btn-primary" id="createProfileBtn">Create</button>
    </div>
    ${names.length > 1 ? `
    <h3>Push my plan to…</h3>
    <div class="row" style="margin-bottom:10px;">
      <select id="pushTargetSelect">${names.filter(n => n !== activeName).map(n => `<option>${n}</option>`).join('')}</select>
      <button class="btn btn-sm" id="pushPlanBtn">Push</button>
    </div>` : ''}
    ${names.length > 0 ? `<h3>Theme</h3><div class="theme-swatches" id="themeSwatches"></div>` : ''}
    ${names.length > 0 ? `<h3 style="margin-top:12px;">Font</h3><div class="builder-chip-group" id="fontSwatches"></div>` : ''}
    ${names.length > 0 ? `<h3 style="margin-top:12px;">Background effect</h3><div class="builder-chip-group" id="ambientSwatches"></div>` : ''}
    ${names.length > 0 ? `<h3 style="margin-top:12px;">Your color (used on Home posts)</h3><div class="theme-swatches" id="tagColorSwatches"></div>` : ''}
    ${names.length > 0 ? `<h3 style="margin-top:12px;">Your avatar</h3><div class="builder-chip-group" id="avatarSwatches"></div>` : ''}
  `;
  const listWrap = $('#profileListWrap');
  names.forEach(n => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '6px';
    row.style.alignItems = 'center';
    const b = document.createElement('button');
    b.style.flex = '1';
    b.className = n === activeName ? 'active' : '';
    b.innerHTML = `<span class="profile-avatar" style="width:20px;height:20px;font-size:9px;">${avatarFor(n)}</span> ${n}`;
    b.onclick = () => {
      Profiles.setActive(n);
      applyTheme();
      $('#profilePanel').style.display = 'none';
      renderProfileButton();
      renderActiveTab();
      toast(`Switched to ${n}.`);
    };
    row.appendChild(b);
    if (n === activeName) {
      const rename = document.createElement('button');
      rename.className = 'btn btn-sm';
      rename.textContent = '✏️';
      rename.title = `Rename ${n}`;
      rename.style.flex = '0 0 auto';
      rename.onclick = () => {
        const newName = prompt(`Rename "${n}" to:`, n);
        if (!newName || !newName.trim() || newName.trim() === n) return;
        const ok = Profiles.rename(n, newName.trim());
        if (ok) { pushImmediate(); applyTheme(); renderProfileButton(); renderActiveTab(); renderProfilePanel(); toast(`Renamed to "${newName.trim()}".`); }
        else toast("Couldn't rename — that name may already be taken.");
      };
      row.appendChild(rename);
    }
    if (names.length > 1) {
      const del = document.createElement('button');
      del.className = 'btn btn-sm btn-danger';
      del.textContent = '×';
      del.title = `Delete ${n}`;
      del.style.flex = '0 0 auto';
      del.onclick = () => {
        if (!confirm(`Delete profile "${n}"? This permanently erases its plan and logged history. This cannot be undone.`)) return;
        const wasActive = n === activeName;
        const ok = Profiles.delete(n);
        if (ok) {
          toast(`Deleted "${n}".`);
          pushImmediate();
          if (wasActive) { applyTheme(); renderProfileButton(); renderActiveTab(); }
          renderProfilePanel();
        } else {
          toast("Couldn't delete — at least one profile has to remain.");
        }
      };
      row.appendChild(del);
    }
    listWrap.appendChild(row);
  });
  $('#createProfileBtn').onclick = () => {
    const name = $('#newProfileName').value.trim();
    if (!name) return;
    const wasEmpty = names.length === 0;
    const ok = Profiles.create(name);
    if (ok) {
      applyTheme();
      renderProfileButton();
      $('#profilePanel').style.display = 'none';
      renderActiveTab();
      toast(`Created profile "${name}".`);
      pushImmediate();
    } else {
      toast('That name is taken — try another.');
    }
  };
  const pushBtn = $('#pushPlanBtn');
  if (pushBtn) pushBtn.onclick = async () => {
    const target = $('#pushTargetSelect').value;
    if (!confirm(`Push your current plan to ${target}? This replaces their existing plan.`)) return;
    pushBtn.disabled = true; pushBtn.textContent = 'Pushing…';
    const ok = await Profiles.pushPlanTo(target);
    pushBtn.disabled = false; pushBtn.textContent = 'Push';
    toast(ok ? `Pushed your plan to ${target}.` : 'Push failed.');
  };
  const swatchWrap = $('#themeSwatches');
  if (swatchWrap) {
    const swatchColors = { iron: '#4C8DFF', pink: '#F0559C', night: '#7B8794', sunset: '#FF6B4A', neon: '#B14CFF', forest: '#5EBF63', holiday: '#E0483F', winter: '#6FC3E8', sabrina: '#C81F3C', taylor: '#C9A227' };
    THEMES.forEach(t => {
      const sw = document.createElement('div');
      sw.className = 'theme-swatch' + (settings.theme === t ? ' active' : '');
      sw.style.background = swatchColors[t];
      sw.title = t.charAt(0).toUpperCase() + t.slice(1);
      sw.onclick = () => {
        const tried = [...new Set([...(settings.themesTried || []), t])];
        Storage.saveSettings({ theme: t, themesTried: tried });
        applyTheme();
        renderProfilePanel();
      };
      swatchWrap.appendChild(sw);
    });
  }
  const fontWrap = $('#fontSwatches');
  if (fontWrap) {
    const fontLabels = { modern: 'Modern', playful: 'Playful', classic: 'Classic' };
    const fontFamilies = { modern: "'Space Grotesk', sans-serif", playful: "'Baloo 2', sans-serif", classic: "'Fraunces', serif" };
    FONT_STYLES.forEach(f => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'builder-chip' + (settings.fontStyle === f ? ' selected' : '');
      chip.style.fontFamily = fontFamilies[f];
      chip.textContent = `Aa ${fontLabels[f]}`;
      chip.onclick = () => { Storage.saveSettings({ fontStyle: f }); applyTheme(); renderProfilePanel(); };
      fontWrap.appendChild(chip);
    });
  }
  const tagWrap = $('#tagColorSwatches');
  if (tagWrap) {
    TAG_COLORS.forEach(c => {
      const sw = document.createElement('div');
      sw.className = 'theme-swatch' + (settings.tagColor === c ? ' active' : '');
      sw.style.background = c;
      sw.onclick = () => { Storage.saveSettings({ tagColor: c }); renderProfilePanel(); };
      tagWrap.appendChild(sw);
    });
  }
  const ambientWrap = $('#ambientSwatches');
  if (ambientWrap) {
    const options = [{ key: 'none', label: 'Off' }, { key: 'snow', label: '❄️ Snow' }, { key: 'petals', label: '🌸 Petals' }, { key: 'hearts', label: '❤️ Hearts' }];
    options.forEach(o => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'builder-chip' + ((settings.ambientEffect || 'none') === o.key ? ' selected' : '');
      chip.textContent = o.label;
      chip.onclick = () => { Storage.saveSettings({ ambientEffect: o.key }); applyTheme(); renderProfilePanel(); };
      ambientWrap.appendChild(chip);
    });
  }
  const avatarWrap = $('#avatarSwatches');
  if (avatarWrap) {
    const AVATAR_CHOICES = ['💪', '🔥', '⭐', '🌟', '🦋', '🌸', '👑', '🎯', '🏆', '💎', '🐱', '🌈'];
    AVATAR_CHOICES.forEach(e => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'builder-chip' + (settings.avatarEmoji === e ? ' selected' : '');
      chip.textContent = e;
      chip.style.fontSize = '16px';
      chip.onclick = () => { Storage.saveSettings({ avatarEmoji: e }); renderProfileButton(); renderProfilePanel(); };
      avatarWrap.appendChild(chip);
    });
  }
}

function allPlanExercises() {
  const plan = Storage.getPlan();
  const seen = new Map();
  Object.entries(plan.days).forEach(([day, list]) => {
    (list || []).forEach(ex => { if (!seen.has(ex.id)) seen.set(ex.id, { ...ex, day }); });
  });
  return [...seen.values()];
}

function logsForExercise(exId, logs) {
  return logs
    .map(l => ({ date: l.date, entry: (l.exercises || []).find(e => e.exerciseId === exId) }))
    .filter(x => x.entry)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map(x => ({ date: x.date, ...x.entry }));
}

function bestOneRmEver(exId, logs) {
  const entries = logsForExercise(exId, logs);
  let best = { oneRm: 0, date: null };
  entries.forEach(e => {
    const top = Progression.topSetOf(e);
    if (top.oneRm > best.oneRm) best = { oneRm: top.oneRm, date: e.date };
  });
  return best;
}

/* ---------------- TAB SWITCHING ---------------- */
function switchTab(tab) {
  state.activeTab = tab;
  $all('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $all('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tab}`));
  renderActiveTab();
}

function renderActiveTab() {
  if (state.activeTab === 'home') renderHomeTab();
  if (state.activeTab === 'shop') renderShopTab();
  if (state.activeTab === 'plan') renderPlanTab();
  if (state.activeTab === 'today') renderTodayTab();
  if (state.activeTab === 'recovery') renderRecoveryTab();
  if (state.activeTab === 'progress') renderProgressTab();
  if (state.activeTab === 'stats') renderStatsTab();
  if (state.activeTab === 'settings') renderSettingsTab();
  renderWeekDial();
}

/* ---------------- WEEK DIAL (header) ---------------- */
function renderWeekDial() {
  const cycle = Storage.getCycle();
  const wk = Progression.weekNumberFor(cycle, isoDate());
  const type = Progression.weekType(cycle, wk);
  const posInCycle = ((wk - 1) % cycle.deloadEvery) + 1;
  const pct = Math.round((posInCycle / cycle.deloadEvery) * 100);
  const color = type === 'deload' ? 'var(--amber)' : (type === 'peak' ? 'var(--blue)' : 'var(--accent)');
  const r = 16, c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  $('#weekDialRing').innerHTML = `
    <svg viewBox="0 0 40 40" class="ring">
      <circle cx="20" cy="20" r="${r}" fill="none" stroke="var(--border)" stroke-width="4"/>
      <circle cx="20" cy="20" r="${r}" fill="none" stroke="${color}" stroke-width="4"
        stroke-dasharray="${c}" stroke-dashoffset="${offset}" stroke-linecap="round"
        transform="rotate(-90 20 20)"/>
    </svg>`;
  $('#weekDialLabel').innerHTML = `Week ${wk}<strong>${type === 'deload' ? 'Deload' : type === 'peak' ? 'Peak / test' : 'Training'}</strong>`;
}

/* ---------------- PLAN TAB ---------------- */
const POST_EMOJIS = ['💪', '🔥', '❤️', '👏'];

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function notifPermissionButtonHTML() {
  if (!('Notification' in window)) return '';
  if (Notification.permission === 'granted') {
    return `<p class="helper-text">Notifications are on for this device.</p><button class="btn btn-sm" id="testNotifBtn">Send myself a test notification</button>`;
  }
  if (Notification.permission === 'denied') return `<p class="helper-text">Notifications are blocked for this site in your browser settings.</p>`;
  return `<button class="btn btn-sm" id="enableNotifBtn">Enable notifications on this device</button>`;
}

let pendingPhotoDataUrl = null;
const GIFT_TYPES = {
  rose: { emoji: '🌹', label: 'Send a rose', defaultText: 'sent you a rose 🌹' },
  flowers: { emoji: '💐', label: 'Send flowers', defaultText: 'sent you flowers 💐' },
  heart: { emoji: '❤️', label: 'Send love', defaultText: 'sent you some love ❤️' }
};

const APPRECIATION_MESSAGES = [
  "is really proud of you today, no reason needed 💛",
  "wants you to know you're doing great, in and out of the gym 🌷",
  "thinks you make hard days easier just by being around 🤍",
  "is grateful to have you on this team 🫶",
  "wants to remind you how much you're appreciated ✨",
  "thinks you deserve a break and a good cup of something nice today ☕",
  "is sending you a little reminder that you're loved 💗",
  "just wanted to say: you've got this, whatever today looks like 🌼"
];

function resizeImageFile(file, maxWidth = 480, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderCompetitionCardHTML(activeName) {
  const profiles = getAllProfilesRaw();
  const names = Object.keys(profiles);
  if (names.length < 2) return '';

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const rows = names.map(name => {
    const logs = profiles[name].logs || [];
    const streak = Consistency.currentStreakWeeks(logs);
    const sessionsThisMonth = Consistency.sessionDates(logs).filter(d => d.startsWith(monthKey)).length;
    const color = profiles[name].settings?.tagColor || 'var(--accent)';
    return { name, streak, sessionsThisMonth, color };
  });
  const maxSessions = Math.max(...rows.map(r => r.sessionsThisMonth));

  return `
    <div class="card">
      <h3>This month</h3>
      <div class="competition-rows">
        ${rows.map(r => `
          <div class="competition-row">
            <span class="post-avatar" style="background:${r.color};">${avatarFor(r.name)}</span>
            <span class="competition-name">${r.name}${r.name === activeName ? ' (you)' : ''}</span>
            <span class="competition-sessions">${r.sessionsThisMonth} session${r.sessionsThisMonth === 1 ? '' : 's'}</span>
            ${r.sessionsThisMonth === maxSessions && maxSessions > 0 ? '<span title="Leading this month">🏆</span>' : ''}
          </div>
        `).join('')}
      </div>
      <p class="helper-text">Friendly count only — sessions logged this calendar month.</p>
    </div>`;
}

function renderTogetherCardHTML(specialDate) {
  if (!specialDate) {
    return `
    <div class="card">
      <h3>Special date</h3>
      <p class="helper-text">Set an anniversary or start date to see a running count on Home.</p>
      <div class="row">
        <input type="date" id="specialDateInput">
        <button class="btn btn-sm btn-primary" id="saveSpecialDateBtn">Save</button>
      </div>
    </div>`;
  }
  const days = Math.floor((new Date(isoDate() + 'T00:00:00') - new Date(specialDate + 'T00:00:00')) / (24 * 3600 * 1000));
  return `
    <div class="card" style="text-align:center;">
      <div class="streak-stat" style="margin:0 auto;"><div class="num">${Math.abs(days)}</div><div class="lbl">Day${Math.abs(days) === 1 ? '' : 's'} ${days >= 0 ? 'together' : 'to go'}</div></div>
      <button class="btn btn-sm" id="editSpecialDateBtn" style="margin-top:8px;">Edit date</button>
    </div>`;
}

const ROULETTE_SEGMENTS = [0, 0.5, 0, 1, 0, 1.5, 0, 2, 0, 5];

function buildWheelGradient() {
  const n = ROULETTE_SEGMENTS.length;
  const step = 360 / n;
  const colors = ['var(--accent)', 'var(--surface-2)'];
  const stops = [];
  for (let i = 0; i < n; i++) stops.push(`${colors[i % 2]} ${i * step}deg ${(i + 1) * step}deg`);
  return `conic-gradient(${stops.join(', ')})`;
}

function renderShopTab() {
  const panel = $('#panel-shop');
  const { name: activeName } = Profiles.getActive();
  const tokens = Storage.getTokens();
  const settings = Storage.getSettings();

  panel.innerHTML = `
    <div class="card" style="text-align:center;">
      <span class="coin-badge" style="width:44px;height:44px;"></span>
      <div class="token-teaser-num" style="font-size:32px;margin-top:6px;">${tokens}</div>
      <div class="helper-text">+${settings.tokensPerWorkout} per workout, +${settings.tokensPerPR} per PR</div>
    </div>
    <div class="card" style="text-align:center;">
      <h3>🎰 Token Roulette</h3>
      <p class="helper-text">Spin for a chance to multiply your tokens — or lose the wager. Just for fun, nothing but tokens on the line.</p>
      <div class="roulette-wrap">
        <div class="roulette-pointer">▼</div>
        <div class="roulette-wheel" id="rouletteWheel" style="background:${buildWheelGradient()};"></div>
        <div class="roulette-hub"></div>
      </div>
      <div class="roulette-legend">
        <span>0x ×5</span><span>0.5x</span><span>1x</span><span>1.5x</span><span>2x</span><span>5x JACKPOT</span>
      </div>
      <div class="row" style="justify-content:center;margin-top:14px;max-width:260px;margin-left:auto;margin-right:auto;">
        <input id="wagerInput" type="number" min="1" max="${Math.max(1, tokens)}" value="${Math.min(10, Math.max(1, tokens))}" ${tokens < 1 ? 'disabled' : ''}>
        <button class="btn btn-primary btn-sm" id="spinBtn" ${tokens < 1 ? 'disabled' : ''}>Spin</button>
      </div>
      <div id="rouletteResult" class="helper-text" style="margin-top:8px;min-height:16px;"></div>
    </div>
    <div class="card">
      <h3>🛍️ Shop</h3>
      <div id="shopSection"></div>
    </div>
  `;

  $('#spinBtn').onclick = () => spinRoulette();
  renderShopSection($('#shopSection'), activeName);
}

function spinRoulette() {
  const wagerInput = $('#wagerInput');
  const spinBtn = $('#spinBtn');
  const wager = Math.floor(Number(wagerInput.value));
  const balance = Storage.getTokens();
  if (!wager || wager < 1) { toast('Enter a wager first.'); return; }
  if (wager > balance) { toast("You don't have that many tokens."); return; }

  spinBtn.disabled = true;
  wagerInput.disabled = true;
  $('#rouletteResult').textContent = '';

  const idx = Math.floor(Math.random() * ROULETTE_SEGMENTS.length);
  const multiplier = ROULETTE_SEGMENTS[idx];
  const step = 360 / ROULETTE_SEGMENTS.length;
  const center = idx * step + step / 2;
  const spins = 5;
  const rotation = spins * 360 + (360 - center);

  const wheel = $('#rouletteWheel');
  wheel.style.transition = 'none';
  wheel.style.transform = 'rotate(0deg)';
  void wheel.offsetWidth;
  wheel.style.transition = 'transform 3.5s cubic-bezier(0.15,0.9,0.25,1)';
  wheel.style.transform = `rotate(${rotation}deg)`;

  setTimeout(() => {
    const winnings = Math.round(wager * multiplier);
    const net = winnings - wager;
    Storage.addTokens(net, multiplier === 0 ? 'Roulette: lost wager' : `Roulette: ${multiplier}x (${net >= 0 ? '+' : ''}${net})`);
    const resultEl = $('#rouletteResult');
    if (!resultEl) return; // tab may have changed
    if (multiplier >= 5) {
      resultEl.innerHTML = `<span style="color:var(--gold);font-weight:600;">🎉 JACKPOT! 5x — won ${winnings} tokens!</span>`;
      fireConfetti();
      const settings = Storage.getSettings();
      const { name: activeName } = Profiles.getActive();
      Storage.addPost({ type: 'comment', authorProfile: activeName, authorColor: settings.tagColor, text: `hit the roulette JACKPOT and won ${winnings} tokens! 🎰🎉` });
    } else if (multiplier > 1) {
      resultEl.innerHTML = `<span style="color:var(--success);">Nice — ${multiplier}x, +${net} tokens.</span>`;
    } else if (multiplier === 1) {
      resultEl.innerHTML = `<span>Push — wager returned.</span>`;
    } else if (multiplier > 0) {
      resultEl.innerHTML = `<span style="color:var(--amber);">${multiplier}x — lost ${Math.abs(net)} tokens.</span>`;
    } else {
      resultEl.innerHTML = `<span style="color:var(--accent);">Bust — lost your ${wager}-token wager.</span>`;
    }
    // Update balance/inputs in place so the result message above stays visible.
    const newBalance = Storage.getTokens();
    const balanceNumEl = $('.token-teaser-num', panelShopEl());
    if (balanceNumEl) balanceNumEl.textContent = newBalance;
    wagerInput.max = Math.max(1, newBalance);
    wagerInput.value = Math.min(Number(wagerInput.value) || 10, Math.max(1, newBalance));
    wagerInput.disabled = newBalance < 1;
    spinBtn.disabled = newBalance < 1;
    pushImmediate();
  }, 3600);
}

function panelShopEl() { return $('#panel-shop'); }

function renderShopSection(container, activeName) {
  const profiles = getAllProfilesRaw();
  const otherNames = Object.keys(profiles).filter(n => n !== activeName);
  const myShop = Storage.getShop(activeName);

  container.innerHTML = `
    ${otherNames.map((name, i) => `
      <div class="shop-owner-block">
        <h4>${escapeHtml(name)}'s shop</h4>
        <div class="shop-items" id="shopItems-${i}"></div>
      </div>
    `).join('')}
    <div class="shop-owner-block">
      <div class="row" style="justify-content:space-between;align-items:center;">
        <h4>My shop</h4>
        <button class="btn btn-sm" id="addShopItemBtn">+ Add item</button>
      </div>
      <p class="helper-text">Items you're offering — your partner spends their own tokens to redeem these.</p>
      <div class="shop-items" id="myShopItems"></div>
      <div id="addShopItemForm"></div>
    </div>
  `;

  otherNames.forEach((name, i) => {
    const wrap = $(`#shopItems-${i}`, container);
    const items = Storage.getShop(name);
    if (items.length === 0) { wrap.innerHTML = '<p class="helper-text">No items yet.</p>'; return; }
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = 'shop-item-row';
      row.innerHTML = `
        <div><div class="shop-item-name">${escapeHtml(item.name)}</div>${item.description ? `<div class="exercise-meta">${escapeHtml(item.description)}</div>` : ''}</div>
        <div class="row" style="flex:0 0 auto;">
          <span class="shop-item-cost"><span class="coin-badge" style="width:13px;height:13px;"></span> ${item.cost}</span>
          <button class="btn btn-sm">Redeem</button>
        </div>
      `;
      row.querySelector('button').onclick = () => {
        if (!confirm(`Redeem "${item.name}" for ${item.cost} tokens?`)) return;
        const res = Storage.redeemReward(name, item.id);
        toast(res.ok ? `Redeemed "${item.name}"! 🎁` : res.message);
        if (res.ok) { pushImmediate(); renderShopTab(); }
      };
      wrap.appendChild(row);
    });
  });

  const myWrap = $('#myShopItems', container);
  if (myShop.length === 0) {
    myWrap.innerHTML = '<p class="helper-text">Nothing offered yet — add something your partner can redeem tokens for.</p>';
  } else {
    myShop.forEach(item => {
      const row = document.createElement('div');
      row.className = 'shop-item-row';
      row.innerHTML = `
        <div><div class="shop-item-name">${escapeHtml(item.name)}</div>${item.description ? `<div class="exercise-meta">${escapeHtml(item.description)}</div>` : ''}</div>
        <div class="row" style="flex:0 0 auto;">
          <span class="shop-item-cost"><span class="coin-badge" style="width:13px;height:13px;"></span> ${item.cost}</span>
          <button class="btn btn-sm btn-danger">Remove</button>
        </div>
      `;
      row.querySelector('button').onclick = () => {
        Storage.saveShop(myShop.filter(i => i.id !== item.id));
        pushImmediate();
        renderShopSection(container, activeName);
      };
      myWrap.appendChild(row);
    });
  }

  $('#addShopItemBtn', container).onclick = () => {
    const formEl = $('#addShopItemForm', container);
    formEl.innerHTML = `
      <div class="row" style="margin-top:8px;">
        <input id="newItemName" placeholder="Item name">
        <input id="newItemCost" type="number" placeholder="Cost in tokens" min="1">
      </div>
      <input id="newItemDesc" placeholder="Description (optional)" style="margin-top:6px;">
      <button class="btn btn-sm btn-primary" id="saveNewItemBtn" style="margin-top:6px;">Save item</button>
    `;
    $('#saveNewItemBtn', formEl).onclick = () => {
      const name = $('#newItemName', formEl).value.trim();
      const cost = Number($('#newItemCost', formEl).value) || 0;
      const desc = $('#newItemDesc', formEl).value.trim();
      if (!name || cost <= 0) { toast('Give it a name and a cost above 0.'); return; }
      Storage.saveShop([...myShop, { id: uid(), name, cost, description: desc }]);
      pushImmediate();
      renderShopSection(container, activeName);
    };
  };
}

function renderHomeTab() {
  const panel = $('#panel-home');
  const posts = Storage.getPosts();
  const { name: activeName } = Profiles.getActive();
  const jointStreak = Storage.jointStreakWeeks();

  // Check for unseen gifts from someone else before we mark everything read.
  const lastSeen = Storage.getLastSeenPostsAt(activeName);
  const unseenGift = posts.find(p => p.giftType && p.authorProfile !== activeName && (!lastSeen || new Date(p.createdAt) > new Date(lastSeen)));

  panel.innerHTML = `
    ${renderTogetherCardHTML(Storage.getSettings().specialDate)}
    ${jointStreak > 0 ? `
    <div class="card" style="text-align:center;">
      <div class="streak-stat" style="margin:0 auto;"><div class="num">${jointStreak}</div><div class="lbl">Week${jointStreak === 1 ? '' : 's'} trained together</div></div>
    </div>` : ''}
    <div class="card">
      <h3>💕 Reasons why</h3>
      <p class="helper-text">A running, permanent list — unlike the feed below, nothing here ever scrolls away.</p>
      <div class="row">
        <input id="keepsakeInput" placeholder="One reason, big or small…" maxlength="140">
        <button class="btn btn-sm btn-primary" id="addKeepsakeBtn" style="flex:0 0 auto;">Add</button>
      </div>
      <div id="keepsakeList" class="keepsake-list"></div>
    </div>
    ${renderCompetitionCardHTML(activeName)}
    <div class="card token-teaser" id="tokenTeaser">
      <span class="coin-badge" style="width:26px;height:26px;"></span>
      <span class="token-teaser-num">${Storage.getTokens()}</span>
      <span class="token-teaser-lbl">tokens — tap to visit the Shop</span>
    </div>
    <div class="card">
      <h3>Say something</h3>
      <textarea id="postComposer" rows="2" placeholder="Leave a note for the household…" style="resize:vertical;"></textarea>
      <div id="photoPreviewWrap"></div>
      <div class="row" style="margin-top:8px;flex-wrap:wrap;">
        <button class="btn btn-sm" id="attachPhotoBtn" type="button">📷 Attach photo</button>
        <button class="btn btn-primary btn-sm" id="postBtn">Post</button>
      </div>
      <input type="file" id="photoInput" accept="image/*" style="display:none;">
      <div class="row" style="margin-top:10px;flex-wrap:wrap;">
        ${Object.entries(GIFT_TYPES).map(([key, g]) => `<button class="btn btn-sm gift-btn" data-gift="${key}">${g.emoji} ${g.label}</button>`).join('')}
        <button class="btn btn-sm" id="sendAppreciationBtn">💌 Send appreciation</button>
      </div>
      ${notifPermissionButtonHTML()}
    </div>
    <div id="postsFeed"></div>
  `;

  const saveSpecialBtn = $('#saveSpecialDateBtn');
  if (saveSpecialBtn) saveSpecialBtn.onclick = () => {
    const val = $('#specialDateInput').value;
    if (!val) { toast('Pick a date first.'); return; }
    Storage.saveSettings({ specialDate: val });
    pushImmediate();
    renderHomeTab();
  };
  const editSpecialBtn = $('#editSpecialDateBtn');
  if (editSpecialBtn) editSpecialBtn.onclick = () => {
    Storage.saveSettings({ specialDate: null });
    pushImmediate();
    renderHomeTab();
  };

  $('#tokenTeaser').onclick = () => switchTab('shop');

  const renderKeepsakeList = () => {
    const listEl = $('#keepsakeList');
    const keepsakes = Storage.getKeepsakes();
    if (keepsakes.length === 0) {
      listEl.innerHTML = `<p class="helper-text">Nothing yet — add the first one.</p>`;
      return;
    }
    listEl.innerHTML = '';
    keepsakes.forEach(k => {
      const row = document.createElement('div');
      row.className = 'keepsake-row';
      row.innerHTML = `
        <span class="post-avatar" style="background:${k.authorColor || 'var(--accent)'};width:20px;height:20px;font-size:9px;">${k.authorProfile ? avatarFor(k.authorProfile) : '?'}</span>
        <span class="keepsake-text">${escapeHtml(k.text)}</span>
        ${k.authorProfile === activeName ? '<button class="keepsake-remove" title="Remove">×</button>' : ''}
      `;
      const removeBtn = row.querySelector('.keepsake-remove');
      if (removeBtn) removeBtn.onclick = () => {
        Storage.removeKeepsake(k.id, activeName);
        pushImmediate();
        renderKeepsakeList();
      };
      listEl.appendChild(row);
    });
  };
  renderKeepsakeList();

  $('#addKeepsakeBtn').onclick = () => {
    const input = $('#keepsakeInput');
    const text = input.value.trim();
    if (!text) return;
    const settings = Storage.getSettings();
    Storage.addKeepsake(text, activeName, settings.tagColor);
    input.value = '';
    pushImmediate();
    renderKeepsakeList();
  };
  $('#keepsakeInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('#addKeepsakeBtn').click();
  });

  const renderPhotoPreview = () => {
    const wrap = $('#photoPreviewWrap');
    wrap.innerHTML = pendingPhotoDataUrl
      ? `<div style="position:relative;display:inline-block;margin-top:8px;"><img src="${pendingPhotoDataUrl}" class="photo-preview-img"><button id="removePhotoBtn" class="btn btn-sm" style="position:absolute;top:4px;right:4px;">✕</button></div>`
      : '';
    const removeBtn = $('#removePhotoBtn');
    if (removeBtn) removeBtn.onclick = () => { pendingPhotoDataUrl = null; renderPhotoPreview(); };
  };
  renderPhotoPreview();

  $('#attachPhotoBtn').onclick = () => $('#photoInput').click();
  $('#photoInput').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      pendingPhotoDataUrl = await resizeImageFile(file);
      renderPhotoPreview();
    } catch (err) {
      toast("Couldn't read that image — try a different photo.");
    }
  };

  $('#postBtn').onclick = () => {
    const text = $('#postComposer').value.trim();
    if (!text && !pendingPhotoDataUrl) return;
    const settings = Storage.getSettings();
    Storage.addPost({ type: 'comment', authorProfile: activeName, authorColor: settings.tagColor, text, photoDataUrl: pendingPhotoDataUrl || null });
    pendingPhotoDataUrl = null;
    pushImmediate();
    renderHomeTab();
  };

  $all('.gift-btn').forEach(btn => {
    btn.onclick = () => {
      const key = btn.dataset.gift;
      const gift = GIFT_TYPES[key];
      const settings = Storage.getSettings();
      const customText = $('#postComposer').value.trim();
      Storage.addPost({
        type: 'gift', giftType: key, authorProfile: activeName, authorColor: settings.tagColor,
        text: customText || gift.defaultText
      });
      fireFalling(key);
      toast(`${gift.emoji} Sent!`);
      pushImmediate();
      renderHomeTab();
    };
  });

  $('#sendAppreciationBtn').onclick = () => {
    const settings = Storage.getSettings();
    const msg = APPRECIATION_MESSAGES[Math.floor(Math.random() * APPRECIATION_MESSAGES.length)];
    Storage.addPost({
      type: 'appreciation', authorProfile: activeName, authorColor: settings.tagColor,
      text: `${activeName} ${msg}`
    });
    fireFalling('heart');
    toast('💌 Sent!');
    pushImmediate();
    renderHomeTab();
  };

  const notifBtn = $('#enableNotifBtn');
  if (notifBtn) notifBtn.onclick = async () => {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') Storage.setLastNotifiedAt(activeName, new Date().toISOString());
    toast(perm === 'granted' ? 'Notifications enabled on this device.' : 'Notifications not enabled.');
    renderHomeTab();
  };
  const testNotifBtn = $('#testNotifBtn');
  if (testNotifBtn) testNotifBtn.onclick = () => {
    const body = 'This is a test — if you see this, notifications are working on this device.';
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready.then(reg => reg.showNotification('Iron Log', { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' }));
    } else {
      new Notification('Iron Log', { body });
    }
    toast('Test notification sent.');
  };

  const feed = $('#postsFeed');
  if (posts.length === 0) {
    feed.innerHTML = `<div class="empty-state">No activity yet — post something, or complete a workout to share it here.</div>`;
  } else {
    feed.innerHTML = '';
    posts.forEach(p => feed.appendChild(renderPostCard(p, activeName)));
  }

  if (unseenGift) fireFalling(unseenGift.giftType);
  Storage.setLastSeenPostsAt(activeName, new Date().toISOString());
}

function renderPostCard(p, activeName) {
  const card = document.createElement('div');
  const isWorkout = p.type === 'workout_complete';
  const isGift = p.type === 'gift';
  const isRedemption = p.type === 'redemption';
  const isAppreciation = p.type === 'appreciation';
  card.className = 'card post-card' + (isGift || isRedemption || isAppreciation ? ' gift-card' : '');
  card.innerHTML = `
    <div class="post-head">
      <span class="post-avatar" style="background:${p.authorColor || 'var(--accent)'};">${p.authorProfile ? avatarFor(p.authorProfile) : '?'}</span>
      <span class="post-author">${p.authorProfile || 'Someone'}</span>
      <span class="post-time">${timeAgo(p.createdAt)}</span>
    </div>
    <div class="post-body">${isWorkout ? '🏋️ ' : ''}${isGift ? `${GIFT_TYPES[p.giftType]?.emoji || '🎁'} ` : ''}${isAppreciation ? '💌 ' : ''}${escapeHtml(p.text)}</div>
    ${p.photoDataUrl ? `<img src="${p.photoDataUrl}" class="post-photo">` : ''}
    <div class="post-reactions" id="reactions-${p.id}"></div>
  `;
  const reactWrap = card.querySelector('.post-reactions');
  POST_EMOJIS.forEach(emoji => {
    const users = (p.reactions && p.reactions[emoji]) || [];
    const btn = document.createElement('button');
    btn.className = 'reaction-chip' + (users.includes(activeName) ? ' active' : '');
    btn.textContent = `${emoji}${users.length ? ' ' + users.length : ''}`;
    btn.onclick = () => { Storage.toggleReaction(p.id, emoji, activeName); pushImmediate(); renderHomeTab(); };
    reactWrap.appendChild(btn);
  });
  return card;
}

function fireFalling(kind) {
  const symbolSets = {
    rose: ['🌹'], flowers: ['💐', '🌷', '🌼', '🌸'], heart: ['❤️', '💕', '💖'],
    'sabrina-pr': ['🎀', '⭐', '💗', '✨'],
    'taylor-pr': ['⭐', '✨', '🏆']
  };
  const symbols = symbolSets[kind] || ['🌸'];
  const count = 22;
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'falling-emoji';
    el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    el.style.left = `${Math.random() * 100}vw`;
    el.style.animationDelay = `${Math.random() * 0.6}s`;
    el.style.animationDuration = `${3 + Math.random() * 2}s`;
    el.style.fontSize = `${20 + Math.random() * 16}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 6000);
  }
}

let ambientInterval = null;
let currentAmbientEffect = null;
function applyAmbientEffect() {
  const s = Storage.getSettings();
  const effect = s.ambientEffect || 'none';
  if (effect === currentAmbientEffect) return; // nothing changed, don't flicker existing particles
  currentAmbientEffect = effect;
  clearInterval(ambientInterval);
  document.querySelectorAll('.ambient-particle').forEach(el => el.remove());
  if (effect === 'none') return;
  const symbol = effect === 'snow' ? '❄️' : effect === 'petals' ? '🌸' : '❤️';
  ambientInterval = setInterval(() => {
    const el = document.createElement('div');
    el.className = 'ambient-particle';
    el.textContent = symbol;
    el.style.left = `${Math.random() * 100}vw`;
    el.style.animationDuration = `${8 + Math.random() * 6}s`;
    el.style.fontSize = `${10 + Math.random() * 10}px`;
    el.style.opacity = 0.4 + Math.random() * 0.3;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 15000);
  }, 900);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function checkForNewActivity() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const { name: activeName } = Profiles.getActive();
  const lastNotified = Storage.getLastNotifiedAt(activeName);
  const posts = Storage.getPosts();
  const fresh = posts.filter(p => p.authorProfile !== activeName && (!lastNotified || new Date(p.createdAt) > new Date(lastNotified)));
  if (fresh.length === 0) return;
  const body = fresh.length === 1
    ? (fresh[0].giftType ? `${GIFT_TYPES[fresh[0].giftType]?.emoji || '🎁'} ${fresh[0].authorProfile} ${fresh[0].text}` : `${fresh[0].authorProfile}: ${fresh[0].text}`)
    : `${fresh.length} new updates from your household`;
  if (navigator.serviceWorker && navigator.serviceWorker.ready) {
    navigator.serviceWorker.ready.then(reg => reg.showNotification('Iron Log', { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' }));
  } else {
    new Notification('Iron Log', { body });
  }
  const newest = fresh.reduce((a, p) => (new Date(p.createdAt) > new Date(a) ? p.createdAt : a), fresh[0].createdAt);
  Storage.setLastNotifiedAt(activeName, newest);
}

function renderPlanTab() {
  const plan = Storage.getPlan();
  const panel = $('#panel-plan');
  panel.innerHTML = `
    <div class="card">
      <div class="row" style="justify-content:space-between;">
        <h3>Build a plan with AI</h3>
        <button class="btn btn-sm" id="openBuilderBtn">Build my plan</button>
      </div>
      <p class="helper-text">Answer a few questions and get a full weekly plan generated for you — you'll see a preview before anything replaces your current plan.</p>
      <div id="planBuilderForm"></div>
    </div>
    <div class="card">
      <div class="row" style="justify-content:space-between;">
        <h3>Plan review</h3>
        <button class="btn btn-primary btn-sm" id="reviewPlanBtn">Review my week</button>
      </div>
      <p class="helper-text">Checks your whole week for volume outside typical ranges, back-to-back scheduling conflicts, missing muscle groups, rep-range variety, and repeated exercises.</p>
      <div id="planReviewResults"></div>
    </div>
    <div class="day-tabs" id="planDayTabs"></div>
    <div class="card">
      <div class="row" style="justify-content:space-between;">
        <h3>${state.planDay}'s exercises</h3>
        <button class="btn btn-sm" id="copyDayBtn">Copy from another day</button>
      </div>
      <div id="planExerciseList"></div>
      <button class="btn btn-primary btn-sm" id="addExerciseBtn" style="margin-top:10px;">+ Add exercise</button>
    </div>
    <div id="addExerciseForm"></div>
  `;
  $('#openBuilderBtn').onclick = () => renderPlanBuilderForm();
  $('#reviewPlanBtn').onclick = () => runPlanReview(plan);
  if (reviewState.findings) renderReviewResults(false);

  const dayTabs = $('#planDayTabs');
  DAYS.forEach(d => {
    const b = document.createElement('button');
    b.textContent = d.slice(0, 3);
    b.className = d === state.planDay ? 'active' : '';
    b.onclick = () => { state.planDay = d; renderPlanTab(); };
    dayTabs.appendChild(b);
  });

  $('#copyDayBtn').onclick = () => {
    const options = DAYS.filter(d => d !== state.planDay);
    const choice = prompt(`Copy which day's exercises into ${state.planDay}?\n(${options.join(', ')})`);
    const match = options.find(d => d.toLowerCase() === (choice || '').trim().toLowerCase());
    if (!match) { if (choice !== null) toast('Type a day name exactly, e.g. Monday.'); return; }
    if (plan.days[state.planDay]?.length && !confirm(`This replaces ${state.planDay}'s current exercises with ${match}'s. Continue?`)) return;
    plan.days[state.planDay] = (plan.days[match] || []).map(ex => ({ ...ex, id: uid() }));
    Storage.savePlan(plan);
    renderPlanTab();
    toast(`Copied ${match} into ${state.planDay}.`);
  };

  const list = $('#planExerciseList');
  const exercises = plan.days[state.planDay] || [];
  if (exercises.length === 0) {
    list.innerHTML = `<div class="empty-state">Rest day — or just not set yet. Add an exercise to start training ${state.planDay}s.</div>`;
  } else {
    list.innerHTML = '';
    exercises.forEach((ex, idx) => {
      const row = document.createElement('div');
      row.className = 'exercise-row';
      row.innerHTML = `
        <div>
          <div class="exercise-name">${ex.name}${ex.standardLift ? ` <span class="pill" style="background:var(--surface-2);color:var(--text-dim);">${ex.standardLift}</span>` : ''}</div>
          <div class="exercise-meta">${ex.muscle} · ${ex.sets} sets × ${ex.repLow}-${ex.repHigh} reps · starting ${fmtWeight(ex.currentWeight, ex.unit)}</div>
        </div>
        <div class="row" style="flex:0 0 auto;gap:6px;">
          <button class="btn btn-sm" data-act="up" ${idx === 0 ? 'disabled' : ''}>↑</button>
          <button class="btn btn-sm" data-act="down" ${idx === exercises.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="btn btn-sm" data-act="edit">Edit</button>
          <button class="btn btn-sm btn-danger" data-act="remove">Remove</button>
        </div>
      `;
      row.querySelector('[data-act="remove"]').onclick = () => {
        if (!confirm(`Remove ${ex.name} from ${state.planDay}?`)) return;
        plan.days[state.planDay] = plan.days[state.planDay].filter(e => e.id !== ex.id);
        Storage.savePlan(plan);
        renderPlanTab();
      };
      row.querySelector('[data-act="edit"]').onclick = () => renderAddExerciseForm(ex);
      row.querySelector('[data-act="up"]').onclick = () => {
        if (idx === 0) return;
        const arr = plan.days[state.planDay];
        [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
        Storage.savePlan(plan); renderPlanTab();
      };
      row.querySelector('[data-act="down"]').onclick = () => {
        const arr = plan.days[state.planDay];
        if (idx === arr.length - 1) return;
        [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
        Storage.savePlan(plan); renderPlanTab();
      };
      list.appendChild(row);
    });
  }

  $('#addExerciseBtn').onclick = () => renderAddExerciseForm();
}

const EQUIPMENT_OPTIONS = ['Barbell', 'Dumbbells', 'Machines', 'Cables', 'Bodyweight only', 'Kettlebells', 'Bands'];
let builderState = { equipment: ['Barbell', 'Dumbbells', 'Machines', 'Cables'], days: 4, focus: [] };

function renderPlanBuilderForm() {
  const container = $('#planBuilderForm');
  if (!Storage.getSettings().aiEnabled) {
    container.innerHTML = `<p class="helper-text">Turn on AI in Settings and add a Gemini key to use the plan builder.</p>`;
    return;
  }
  container.innerHTML = `
    <div style="margin-top:10px;">
      <label>Equipment you have access to</label>
      <div class="builder-chip-group" id="builderEquipment"></div>
    </div>
    <div class="row" style="margin-top:12px;">
      <div><label>Days per week</label><input id="builderDays" type="number" min="1" max="7" value="${builderState.days}"></div>
    </div>
    <div style="margin-top:12px;">
      <label>Muscle groups to focus on (optional — leave blank for a balanced plan)</label>
      <div class="builder-chip-group" id="builderFocus"></div>
    </div>
    <button class="btn btn-primary btn-sm" id="generatePlanBtn" style="margin-top:12px;">Generate plan</button>
    <div id="builderResult"></div>
  `;
  const eqWrap = $('#builderEquipment');
  EQUIPMENT_OPTIONS.forEach(eq => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'builder-chip' + (builderState.equipment.includes(eq) ? ' selected' : '');
    chip.textContent = eq;
    chip.onclick = () => {
      builderState.equipment = builderState.equipment.includes(eq)
        ? builderState.equipment.filter(e => e !== eq)
        : [...builderState.equipment, eq];
      chip.classList.toggle('selected');
    };
    eqWrap.appendChild(chip);
  });
  const focusWrap = $('#builderFocus');
  MUSCLES.forEach(m => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'builder-chip' + (builderState.focus.includes(m) ? ' selected' : '');
    chip.textContent = m;
    chip.onclick = () => {
      builderState.focus = builderState.focus.includes(m)
        ? builderState.focus.filter(x => x !== m)
        : [...builderState.focus, m];
      chip.classList.toggle('selected');
    };
    focusWrap.appendChild(chip);
  });
  $('#builderDays').onchange = (e) => { builderState.days = Math.max(1, Math.min(7, Number(e.target.value) || 4)); };

  $('#generatePlanBtn').onclick = async () => {
    builderState.days = Math.max(1, Math.min(7, Number($('#builderDays').value) || 4));
    const btn = $('#generatePlanBtn');
    btn.disabled = true; btn.textContent = 'Generating…';
    const settings = Storage.getSettings();
    const result = await AI.buildPlan({
      equipment: builderState.equipment.length ? builderState.equipment : ['Bodyweight only'],
      days: builderState.days,
      focus: builderState.focus,
      units: settings.units
    });
    btn.disabled = false; btn.textContent = 'Generate plan';
    const resultEl = $('#builderResult');
    if (!result.ok) {
      resultEl.innerHTML = `<div class="plateau-banner">${result.message}</div>`;
      return;
    }
    renderBuilderPreview(resultEl, result.plan, settings.units);
  };
}

function renderBuilderPreview(container, generatedPlan, unit) {
  const dayCards = DAYS.map(day => {
    const list = generatedPlan.days[day] || [];
    if (list.length === 0) return '';
    return `<div class="builder-preview-day"><div class="bp-day-title">${day}</div>${list.map(ex =>
      `<div class="builder-preview-ex">${ex.name} — ${ex.muscle}, ${ex.sets}×${ex.repLow}-${ex.repHigh} @ ${ex.currentWeight}${unit}</div>`
    ).join('')}</div>`;
  }).join('');
  container.innerHTML = `
    <div class="card" style="margin-top:12px;background:var(--surface-2);">
      <h3>Preview</h3>
      ${dayCards || '<p class="helper-text">The AI returned an empty plan — try generating again.</p>'}
      <div class="row" style="margin-top:10px;">
        <button class="btn btn-primary btn-sm" id="applyBuilderPlanBtn">Apply — replace my current plan</button>
        <button class="btn btn-sm" id="discardBuilderPlanBtn">Discard</button>
      </div>
    </div>
  `;
  $('#applyBuilderPlanBtn').onclick = () => {
    if (!confirm('This replaces every day in your current plan. Continue?')) return;
    Storage.savePlan(generatedPlan);
    $('#planBuilderForm').innerHTML = '';
    renderPlanTab();
    toast('New plan applied.');
  };
  $('#discardBuilderPlanBtn').onclick = () => { container.innerHTML = ''; };
}

let reviewState = { findings: null, summary: '', suggestions: [] };

function runPlanReview(plan) {
  reviewState.findings = PlanReview.analyze(plan);
  reviewState.summary = '';
  reviewState.suggestions = [];
  renderReviewResults(true);
  const summaryText = PlanReview.toPromptSummary(plan, reviewState.findings);
  AI.reviewPlan(summaryText).then(res => {
    if (res.ok) {
      reviewState.summary = res.summary;
      reviewState.suggestions = res.suggestions;
    } else {
      reviewState.summary = res.message;
      reviewState.suggestions = [];
    }
    renderReviewResults(false);
  });
}

function renderReviewResults(loading) {
  const resultsEl = $('#planReviewResults');
  if (!resultsEl || !reviewState.findings) return;
  resultsEl.innerHTML = PlanReview.renderHTML(reviewState.findings) + `<div id="aiReviewSlot"></div>`;
  const slot = $('#aiReviewSlot');
  if (loading) {
    slot.innerHTML = `<p class="helper-text">Checking against training science…</p>`;
    return;
  }
  if (reviewState.summary) {
    slot.innerHTML = `<div class="ai-tip"><span class="tag">AI summary</span>${escapeHtml(reviewState.summary)}</div>`;
  }
  const listWrap = document.createElement('div');
  listWrap.id = 'suggestionList';
  slot.appendChild(listWrap);
  reviewState.suggestions.forEach(s => listWrap.appendChild(renderSuggestionCard(s)));
}

function renderSuggestionCard(s) {
  const card = document.createElement('div');
  card.className = 'card suggestion-card';
  const badgeClass = s.action === 'remove' ? 'sugg-remove' : s.action === 'add' ? 'sugg-add' : 'sugg-adjust';
  const badgeLabel = s.action === 'remove' ? 'Remove' : s.action === 'add' ? 'Add' : 'Adjust';
  let title = '';
  if (s.action === 'add') title = `${s.newExercise.name} — ${s.day}`;
  else if (s.action === 'remove') title = `${s.exerciseName} — ${s.day}`;
  else title = `${s.exerciseName} — ${s.day} (${Object.entries(s.changes).map(([k, v]) => `${k}: ${v}`).join(', ')})`;

  card.innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:flex-start;">
      <div>
        <span class="pill ${badgeClass}">${badgeLabel}</span>
        <div class="exercise-name" style="margin-top:6px;">${escapeHtml(title)}</div>
        <div class="exercise-meta">${escapeHtml(s.reason)}</div>
      </div>
    </div>
    <div class="row" style="margin-top:10px;flex:0 0 auto;" id="suggActions-${s.id}"></div>
  `;
  const actions = card.querySelector(`#suggActions-${s.id}`);
  if (s.status === 'applied') {
    actions.innerHTML = `<span class="helper-text" style="color:var(--success);">✓ Applied</span>`;
  } else if (s.status === 'dismissed') {
    actions.innerHTML = `<span class="helper-text">Dismissed</span>`;
  } else {
    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'btn btn-sm btn-primary';
    acceptBtn.textContent = 'Accept';
    acceptBtn.onclick = () => {
      const result = applySuggestion(s);
      if (result.ok) {
        s.status = 'applied';
        renderPlanTab();
        toast('Applied to your plan.');
      } else {
        toast(result.message);
      }
    };
    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'btn btn-sm';
    dismissBtn.textContent = 'Dismiss';
    dismissBtn.onclick = () => { s.status = 'dismissed'; renderReviewResults(false); };
    actions.appendChild(acceptBtn);
    actions.appendChild(dismissBtn);
  }
  return card;
}

function applySuggestion(s) {
  const plan = Storage.getPlan();
  const list = plan.days[s.day] || (plan.days[s.day] = []);
  if (s.action === 'add') {
    const settings = Storage.getSettings();
    list.push({ id: uid(), standardLift: null, unit: settings.units, ...s.newExercise });
    Storage.savePlan(plan);
    return { ok: true };
  }
  const idx = list.findIndex(e => e.name.trim().toLowerCase() === s.exerciseName.trim().toLowerCase());
  if (idx === -1) return { ok: false, message: `Couldn't find "${s.exerciseName}" on ${s.day} anymore — it may already have changed.` };
  if (s.action === 'remove') {
    list.splice(idx, 1);
  } else if (s.action === 'adjust') {
    Object.assign(list[idx], s.changes);
  }
  Storage.savePlan(plan);
  return { ok: true };
}

function renderAddExerciseForm(existing) {
  const settings = Storage.getSettings();
  const container = $('#addExerciseForm');
  const isEdit = !!existing;
  container.innerHTML = `
    <div class="card">
      <h3>${isEdit ? 'Edit exercise' : 'New exercise'} — ${state.planDay}</h3>
      <div class="row">
        <div><label>Exercise name</label><input id="exName" placeholder="e.g. Incline dumbbell press" value="${existing?.name || ''}"></div>
        <div><label>Muscle</label>
          <select id="exMuscle">${MUSCLES.map(m => `<option ${existing?.muscle === m ? 'selected' : ''}>${m}</option>`).join('')}</select>
        </div>
      </div>
      <div class="row">
        <div><label>Type</label>
          <select id="exType">
            <option value="compound" ${existing?.type === 'compound' ? 'selected' : ''}>Compound</option>
            <option value="isolation" ${existing?.type === 'isolation' ? 'selected' : ''}>Isolation</option>
          </select>
        </div>
        <div><label>Lower body?</label>
          <select id="exLower">
            <option value="false" ${existing && !existing.lowerBody ? 'selected' : ''}>No</option>
            <option value="true" ${existing?.lowerBody ? 'selected' : ''}>Yes</option>
          </select>
        </div>
        <div><label>Counts toward tier (optional)</label>
          <select id="exStandard">
            <option value="">None</option>
            ${Standards.allLifts().map(l => `<option ${existing?.standardLift === l ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="row">
        <div><label>Sets</label><input id="exSets" type="number" value="${existing?.sets ?? 3}" min="1"></div>
        <div><label>Rep range low</label><input id="exRepLow" type="number" value="${existing?.repLow ?? 8}" min="1"></div>
        <div><label>Rep range high</label><input id="exRepHigh" type="number" value="${existing?.repHigh ?? 12}" min="1"></div>
        <div><label>${isEdit ? 'Current' : 'Starting'} weight (${settings.units})</label><input id="exWeight" type="number" value="${existing?.currentWeight ?? 45}" min="0"></div>
      </div>
      <div class="row">
        <button class="btn btn-primary" id="saveExerciseBtn">${isEdit ? 'Save changes' : 'Save exercise'}</button>
        <button class="btn" id="cancelExerciseBtn">Cancel</button>
      </div>
    </div>
  `;
  $('#saveExerciseBtn').onclick = () => {
    const name = $('#exName').value.trim();
    if (!name) { toast('Give the exercise a name first.'); return; }
    const plan = Storage.getPlan();
    const data = {
      name,
      muscle: $('#exMuscle').value,
      type: $('#exType').value,
      lowerBody: $('#exLower').value === 'true',
      standardLift: $('#exStandard').value || null,
      sets: Number($('#exSets').value) || 3,
      repLow: Number($('#exRepLow').value) || 8,
      repHigh: Number($('#exRepHigh').value) || 12,
      currentWeight: Number($('#exWeight').value) || 45,
      unit: settings.units
    };
    if (isEdit) {
      const arr = plan.days[state.planDay];
      const idx = arr.findIndex(e => e.id === existing.id);
      arr[idx] = { ...existing, ...data };
    } else {
      if (!plan.days[state.planDay]) plan.days[state.planDay] = [];
      plan.days[state.planDay].push({ id: uid(), ...data });
    }
    Storage.savePlan(plan);
    container.innerHTML = '';
    renderPlanTab();
    toast(isEdit ? 'Exercise updated.' : `Exercise added — it repeats every ${state.planDay} until you change it.`);
  };
  $('#cancelExerciseBtn').onclick = () => { container.innerHTML = ''; };
}

/* ---------------- TODAY TAB ---------------- */
function renderTodayTab() {
  const today = isoDate();
  const { templateDay, exercises } = Scheduler.effectiveDayFor(today);
  const cycle = Storage.getCycle();
  const wk = Progression.weekNumberFor(cycle, today);
  const upcomingType = Progression.weekType(cycle, wk);
  const logs = Storage.getLogs();
  const settings = Storage.getSettings();
  const panel = $('#panel-today');

  const overrides = Storage.getWeekOverrides();
  const wasReshuffled = !!overrides[mondayOf(today)];

  panel.innerHTML = `
    <div class="card row" style="justify-content:space-between;">
      <div>
        <h3 style="margin-bottom:2px;">${new Date().toLocaleDateString(undefined,{weekday:'long', month:'short', day:'numeric'})}</h3>
        <div class="exercise-meta">Scheduled: ${templateDay}${wasReshuffled ? ' (reshuffled this week)' : ''}</div>
      </div>
      <div class="row" style="flex:0 0 auto;">
        <button class="btn btn-sm" id="missedBtn">Couldn't make it today</button>
        ${wasReshuffled ? '<button class="btn btn-sm" id="resetWeekBtn">Undo reshuffle</button>' : ''}
      </div>
    </div>
    <div id="todayExercises"></div>
    <div class="card" id="chirpCard" style="display:none;">
      <label>Chirp your household (optional)</label>
      <input id="chirpInput" placeholder="Add a message to your completion post…" maxlength="80">
      <div class="builder-chip-group" id="chirpChips"></div>
    </div>
    <div class="row" style="margin-top:10px;">
      <button class="btn btn-primary" id="saveSessionBtn">Save today's session</button>
      <button class="btn" id="startWorkoutModeBtn" style="display:none;">🏋️ Start Workout Mode</button>
    </div>
  `;

  $('#missedBtn').onclick = () => {
    const ok = Scheduler.markMissed(today);
    toast(ok ? "Shifted this week's remaining sessions to fit it in." : 'Nothing scheduled today to shift.');
    renderTodayTab();
  };
  const resetBtn = $('#resetWeekBtn');
  if (resetBtn) resetBtn.onclick = () => { Scheduler.resetWeek(today); renderTodayTab(); };

  const list = $('#todayExercises');
  if (!exercises || exercises.length === 0) {
    list.innerHTML = `<div class="empty-state">No session scheduled today. Enjoy the rest day, or set one up in Plan.</div>`;
    $('#saveSessionBtn').style.display = 'none';
    return;
  }
  $('#startWorkoutModeBtn').style.display = 'inline-block';
  $('#startWorkoutModeBtn').onclick = () => enterWorkoutMode(exercises, templateDay, upcomingType, logs, settings);
  $('#chirpCard').style.display = 'block';
  const chirpChips = $('#chirpChips');
  const stockChirps = ['Your turn! 💪', "Let's gooo!", 'Beat that 😏', "Don't break the streak!", 'Feeling strong today 🔥'];
  stockChirps.forEach(c => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'builder-chip';
    chip.textContent = c;
    chip.onclick = () => { $('#chirpInput').value = c; };
    chirpChips.appendChild(chip);
  });

  exercises.forEach(ex => {
    const exLogs = logsForExercise(ex.id, logs);
    const rx = Progression.nextPrescription(ex, exLogs, upcomingType);
    const plateauMsg = Progression.detectPlateau(exLogs);
    const lastEntry = exLogs[exLogs.length - 1];
    const restSecs = Progression.suggestedRestSeconds(ex.repLow, ex.type);

    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.exerciseId = ex.id;
    card.innerHTML = `
      <h3>${ex.name} <span class="exercise-meta">· ${ex.muscle}</span></h3>
      ${lastEntry ? `<div class="prev-session">Last time: ${lastEntry.sets.map(s => `${s.weight}${ex.unit}×${s.reps}`).join(', ')} (avg RPE ${(lastEntry.sets.reduce((a,s)=>a+(Number(s.rpe)||8),0)/lastEntry.sets.length).toFixed(1)})</div>` : ''}
      <div class="rx-box ${upcomingType !== 'train' ? upcomingType : ''}">
        Target: <strong>${rx.sets} × ${rx.reps} @ ${fmtWeight(rx.weight, ex.unit)}</strong><br>${rx.note}
      </div>
      ${plateauMsg ? `<div class="plateau-banner">⚠ ${plateauMsg} <button class="btn btn-sm" data-act="ai-swap" style="margin-top:6px;">Suggest a swap</button></div>` : ''}
      <div class="warmup-list" data-act="warmup"></div>
      <div class="plate-calc" data-act="plates" style="display:none;"></div>
      <div class="ai-cue" style="margin-top:8px;"></div>
      <div class="sets-log" style="margin-top:10px;"></div>
      <div class="row" style="margin-top:8px;flex-wrap:wrap;">
        <button class="btn btn-sm add-set-btn">+ Add set</button>
        ${lastEntry ? '<button class="btn btn-sm copy-last-btn">Copy last time\'s numbers</button>' : ''}
        ${ex.type === 'compound' ? '<button class="btn btn-sm plates-btn">Show plates</button>' : ''}
        <button class="btn btn-sm cue-btn">Get form cue</button>
        <button class="btn btn-sm rest-btn">Start rest timer</button>
      </div>
      <div class="rest-timer-slot"></div>
    `;

    // warm-up ramp
    if (ex.type === 'compound') {
      const ramp = Progression.warmupRamp(rx.weight, ex.unit, Progression.incrementFor(ex));
      if (ramp.length) {
        card.querySelector('[data-act="warmup"]').innerHTML =
          `<strong style="color:var(--text-dim);">Warm-up:</strong>` +
          ramp.map(r => `<div class="wu-row"><span>${r.weight}${ex.unit}</span><span>${r.reps} reps</span></div>`).join('');
      }
    }

    const setsWrap = card.querySelector('.sets-log');
    for (let i = 0; i < rx.sets; i++) addSetRow(setsWrap, rx.weight, rx.reps, ex.unit);

    card.querySelector('.add-set-btn').onclick = () => addSetRow(setsWrap, rx.weight, rx.reps, ex.unit);

    const copyBtn = card.querySelector('.copy-last-btn');
    if (copyBtn) copyBtn.onclick = () => {
      resetSetsContainer(setsWrap, ex.unit);
      lastEntry.sets.forEach(s => addSetRow(setsWrap, s.weight, s.reps, ex.unit, s.rpe));
      toast("Filled in with last time's numbers.");
    };

    const platesBtn = card.querySelector('.plates-btn');
    if (platesBtn) platesBtn.onclick = () => {
      const slot = card.querySelector('[data-act="plates"]');
      const result = calcPlates(rx.weight, settings);
      slot.style.display = 'block';
      slot.innerHTML = result.error
        ? result.error
        : `Per side: ${result.perSide.map(p => `<span class="plate-chip">${p}${settings.units}</span>`).join('') || 'bar only'} &nbsp;(bar: ${settings.barWeight}${settings.units})`;
    };

    card.querySelector('.cue-btn').onclick = async (e) => {
      e.target.disabled = true; e.target.textContent = 'Thinking…';
      const cue = await AI.mindMuscleCue(ex.name, ex.muscle);
      card.querySelector('.ai-cue').innerHTML = `<div class="ai-tip"><span class="tag">${cue.source === 'ai' ? 'AI cue' : 'Offline tip'}</span>${cue.text}</div>`;
      e.target.disabled = false; e.target.textContent = 'Get form cue';
    };

    const swapBtn = card.querySelector('[data-act="ai-swap"]');
    if (swapBtn) swapBtn.onclick = async () => {
      swapBtn.disabled = true; swapBtn.textContent = 'Thinking…';
      const sug = await AI.suggestExercise(ex.muscle, '', ex.name);
      card.querySelector('.ai-cue').innerHTML = `<div class="ai-tip"><span class="tag">${sug.source === 'ai' ? 'AI suggestion' : 'Offline suggestion'}</span>${sug.text}</div>`;
      swapBtn.disabled = false; swapBtn.textContent = 'Suggest a swap';
    };

    card.querySelector('.rest-btn').onclick = (e) => startRestTimer(card.querySelector('.rest-timer-slot'), restSecs, settings.restTimerSound);

    list.appendChild(card);
  });

  $('#saveSessionBtn').onclick = () => {
    const chirp = $('#chirpInput')?.value || '';
    finalizeSession(templateDay, exercises, logs, (exId) => {
      const card = list.querySelector(`.card[data-exercise-id="${exId}"]`);
      return $all('.set-row:not(.set-header)', card).map(row => ({
        weight: Number(row.querySelector('.set-weight').value) || 0,
        reps: Number(row.querySelector('.set-reps').value) || 0,
        rpe: Number(row.querySelector('.set-rpe').value) || 8
      }));
    }, chirp);
    renderTodayTab();
  };
}

// Shared by the normal Today-tab save button and Live Workout Mode's finish
// button — getSetsForExercise(exerciseId) returns that exercise's logged sets.
function finalizeSession(templateDay, exercises, logs, getSetsForExercise, chirp) {
  const entry = { date: isoDate(), day: templateDay, exercises: [] };
  let prCount = 0;
  exercises.forEach(ex => {
    const sets = getSetsForExercise(ex.id) || [];
    const priorBest = bestOneRmEver(ex.id, logs).oneRm;
    const newTop = Progression.topSetOf({ sets });
    if (newTop.oneRm > priorBest && priorBest > 0) prCount++;
    entry.exercises.push({ exerciseId: ex.id, name: ex.name, muscle: ex.muscle, sets });
  });
  Storage.addLog(entry);
  const { name: activeName } = Profiles.getActive();
  const settings = Storage.getSettings();

  const tokensEarned = (settings.tokensPerWorkout || 10) + prCount * (settings.tokensPerPR || 15);
  Storage.addTokens(tokensEarned, `Completed ${templateDay}'s workout${prCount > 0 ? ` + ${prCount} PR${prCount > 1 ? 's' : ''}` : ''}`);

  const prLine = prCount > 0 ? ` (${prCount} new PR${prCount > 1 ? 's' : ''} 🎉)` : '';
  const chirpLine = chirp && chirp.trim() ? ` — "${chirp.trim()}"` : '';
  Storage.addPost({
    type: 'workout_complete',
    authorProfile: activeName,
    authorColor: settings.tagColor,
    text: `completed ${templateDay}'s workout${prLine}${chirpLine}`
  });
  toast(prCount > 0
    ? `Session saved. <span class="pr-toast-badge">${prCount} New PR${prCount > 1 ? 's' : ''}!</span> +${tokensEarned} <span class="coin-badge" style="width:13px;height:13px;"></span>`
    : `Session saved. +${tokensEarned} <span class="coin-badge" style="width:13px;height:13px;"></span> — next week's targets will update from this.`);
  if (prCount > 0) fireConfetti();
  pushImmediate();
  return { prCount, tokensEarned };
}

/* ---------------- LIVE WORKOUT MODE ---------------- */
let workoutMode = { idx: 0, exercises: [], templateDay: '', setsCache: {} };
let wakeLockSentinel = null;

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) wakeLockSentinel = await navigator.wakeLock.request('screen');
  } catch (e) { console.error('Wake lock request failed', e); }
}
function releaseWakeLock() {
  if (wakeLockSentinel) { wakeLockSentinel.release().catch(() => {}); wakeLockSentinel = null; }
}
let lastAutoSyncCheck = 0;
function hasOpenTransientForm() {
  return ['addShopItemForm', 'planBuilderForm', 'addExerciseForm'].some(id => {
    const el = document.getElementById(id);
    return el && el.innerHTML.trim() !== '';
  });
}

async function syncNow(silent) {
  const s = Storage.getSettings();
  if (!s.githubToken) return;
  if (Sync.hasPendingLocalChanges()) {
    if (!silent) toast('Pushing unsynced changes to GitHub…');
    await Sync.push();
  } else {
    if (!silent) toast('Checking GitHub for updates…');
    const res = await Sync.pull();
    if (res.ok) {
      applyTheme();
      renderProfileButton();
      checkForNewActivity();
      // A silent background sync shouldn't yank the screen out from under
      // someone mid-typing into a form (e.g. adding a shop item), or reset
      // a rest timer that's actively counting down between sets — the
      // fresh data is already saved locally either way, it'll just show up
      // next time this tab naturally re-renders instead of right this second.
      const activeEl = document.activeElement;
      const isTyping = activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName);
      const hasRunningTimer = !!document.querySelector('#restCountdown');
      if (!silent || !(isTyping || hasRunningTimer || hasOpenTransientForm())) renderActiveTab();
    }
  }
}

// Shared throttle so the visibility-change trigger and the periodic timer
// below don't double up on the same short window.
function maybeAutoSync() {
  if (!Storage.hasAnyProfile() || document.visibilityState !== 'visible') return;
  const now = Date.now();
  if (now - lastAutoSyncCheck < 6000) return;
  lastAutoSyncCheck = now;
  syncNow(true);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if ($('#workoutModeOverlay')) requestWakeLock();
  maybeAutoSync();
});

// While the app is open and visible, quietly check for updates every so
// often — this is what gets a partner's change to show up without needing
// to background/foreground the app or force-quit and reopen it.
setInterval(maybeAutoSync, 12000);

function enterWorkoutMode(exercises, templateDay, upcomingType, logs, settings) {
  workoutMode = { idx: 0, exercises, templateDay, setsCache: {} };
  const overlay = document.createElement('div');
  overlay.id = 'workoutModeOverlay';
  overlay.className = 'workout-mode-overlay';
  document.body.appendChild(overlay);
  requestWakeLock();
  renderWorkoutModeScreen(upcomingType, logs, settings);
}

function exitWorkoutMode() {
  releaseWakeLock();
  const overlay = $('#workoutModeOverlay');
  if (overlay) overlay.remove();
}

function saveWorkoutModeCurrentSets(exId) {
  const setsWrap = $('#wmSetsLog');
  if (!setsWrap) return;
  workoutMode.setsCache[exId] = $all('.set-row:not(.set-header)', setsWrap).map(row => ({
    weight: Number(row.querySelector('.set-weight').value) || 0,
    reps: Number(row.querySelector('.set-reps').value) || 0,
    rpe: Number(row.querySelector('.set-rpe').value) || 8
  }));
}

function renderWorkoutModeScreen(upcomingType, logs, settings) {
  const overlay = $('#workoutModeOverlay');
  if (!overlay) return;
  const ex = workoutMode.exercises[workoutMode.idx];
  const exLogs = logsForExercise(ex.id, logs);
  const rx = Progression.nextPrescription(ex, exLogs, upcomingType);
  const restSecs = Progression.suggestedRestSeconds(ex.repLow, ex.type);
  const isLast = workoutMode.idx === workoutMode.exercises.length - 1;

  overlay.innerHTML = `
    <div class="wm-header">
      <button class="btn btn-sm" id="wmExitBtn">✕ Exit</button>
      <div class="wm-progress">${workoutMode.idx + 1} / ${workoutMode.exercises.length}</div>
    </div>
    <div class="wm-body">
      <h2 class="wm-exercise-name">${ex.name}</h2>
      <div class="exercise-meta" style="text-align:center;">${ex.muscle}</div>
      <div class="rx-box ${upcomingType !== 'train' ? upcomingType : ''}" style="margin:16px auto;max-width:380px;text-align:center;">
        Target: <strong>${rx.sets} × ${rx.reps} @ ${fmtWeight(rx.weight, ex.unit)}</strong><br>${rx.note}
      </div>
      <div class="sets-log" id="wmSetsLog" style="max-width:420px;margin:0 auto;"></div>
      <div class="row" style="justify-content:center;margin-top:12px;">
        <button class="btn btn-sm" id="wmAddSetBtn">+ Add set</button>
        <button class="btn btn-sm" id="wmRestBtn">Start rest timer</button>
      </div>
      <div id="wmRestSlot" style="text-align:center;"></div>
      ${isLast ? `<input id="wmChirpInput" placeholder="Add a chirp for your household (optional)" maxlength="80" style="max-width:420px;margin:14px auto 0;display:block;">` : ''}
    </div>
    <div class="wm-nav">
      <button class="btn" id="wmPrevBtn" ${workoutMode.idx === 0 ? 'disabled' : ''}>← Prev</button>
      ${isLast
        ? `<button class="btn btn-primary" id="wmFinishBtn">Finish workout 🎉</button>`
        : `<button class="btn btn-primary" id="wmNextBtn">Next →</button>`}
    </div>
  `;

  const setsWrap = $('#wmSetsLog');
  const cached = workoutMode.setsCache[ex.id];
  if (cached && cached.length) {
    resetSetsContainer(setsWrap, ex.unit);
    cached.forEach(s => addSetRow(setsWrap, s.weight, s.reps, ex.unit, s.rpe));
  } else {
    for (let i = 0; i < rx.sets; i++) addSetRow(setsWrap, rx.weight, rx.reps, ex.unit);
  }

  $('#wmExitBtn').onclick = () => {
    saveWorkoutModeCurrentSets(ex.id);
    if (confirm('Exit Workout Mode? Nothing logged so far is saved yet — you can jump back into the regular Today tab and save from there, or return to Workout Mode later this session.')) exitWorkoutMode();
  };
  $('#wmAddSetBtn').onclick = () => addSetRow(setsWrap, rx.weight, rx.reps, ex.unit);
  $('#wmRestBtn').onclick = () => startRestTimer($('#wmRestSlot'), restSecs, settings.restTimerSound);
  const prevBtn = $('#wmPrevBtn');
  if (prevBtn && workoutMode.idx > 0) prevBtn.onclick = () => { saveWorkoutModeCurrentSets(ex.id); workoutMode.idx--; renderWorkoutModeScreen(upcomingType, logs, settings); };
  const nextBtn = $('#wmNextBtn');
  if (nextBtn) nextBtn.onclick = () => { saveWorkoutModeCurrentSets(ex.id); workoutMode.idx++; renderWorkoutModeScreen(upcomingType, logs, settings); };
  const finishBtn = $('#wmFinishBtn');
  if (finishBtn) finishBtn.onclick = () => {
    saveWorkoutModeCurrentSets(ex.id);
    const chirp = $('#wmChirpInput')?.value || '';
    finalizeSession(workoutMode.templateDay, workoutMode.exercises, logs, (exId) => workoutMode.setsCache[exId], chirp);
    exitWorkoutMode();
    renderTodayTab();
  };
}

function calcPlates(targetWeight, settings) {
  const perSideNeeded = (targetWeight - settings.barWeight) / 2;
  if (perSideNeeded < 0) return { error: `Target is lighter than the bar (${settings.barWeight}${settings.units}) — use a lighter bar or dumbbells.` };
  const plates = [...settings.availablePlates].sort((a, b) => b - a);
  let remaining = perSideNeeded;
  const used = [];
  plates.forEach(p => {
    while (remaining + 0.001 >= p) { used.push(p); remaining -= p; }
  });
  return { perSide: used, leftover: remaining };
}

function startRestTimer(slot, seconds, soundOn) {
  let remaining = seconds;
  slot.innerHTML = `<div class="rest-timer"><span id="restCountdown">${formatClock(remaining)}</span><button id="restCancel">Cancel</button></div>`;
  const countdownEl = slot.querySelector('#restCountdown');
  clearInterval(slot._timer);
  slot._timer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(slot._timer);
      slot.innerHTML = `<div class="rest-timer" style="color:var(--success);">Rest done — go!</div>`;
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      if (soundOn) beep();
      return;
    }
    countdownEl.textContent = formatClock(remaining);
  }, 1000);
  slot.querySelector('#restCancel').onclick = () => { clearInterval(slot._timer); slot.innerHTML = ''; };
}

function formatClock(s) { const m = Math.floor(s / 60); const sec = s % 60; return `${m}:${sec.toString().padStart(2, '0')}`; }

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    o.start(); o.stop(ctx.currentTime + 0.3);
  } catch (e) { /* audio not available, ignore */ }
}

function setsHeaderHTML(unit) {
  return `
    <div class="set-row set-header">
      <div class="set-num-col"></div>
      <div>Weight (${unit})</div>
      <div>Reps</div>
      <div>RPE</div>
      <div class="set-remove-col"></div>
    </div>`;
}

function resetSetsContainer(container, unit) {
  container.innerHTML = setsHeaderHTML(unit);
}

function renumberSets(container) {
  $all('.set-row:not(.set-header)', container).forEach((row, i) => {
    row.querySelector('.set-number').textContent = i + 1;
  });
}

function addSetRow(container, weight, reps, unit, rpe) {
  if (!container.querySelector('.set-header')) container.innerHTML = setsHeaderHTML(unit);
  const row = document.createElement('div');
  row.className = 'set-row';
  const setNum = $all('.set-row:not(.set-header)', container).length + 1;
  row.innerHTML = `
    <div class="set-number">${setNum}</div>
    <div><input class="set-weight" type="number" value="${weight}" inputmode="decimal"></div>
    <div><input class="set-reps" type="number" value="${reps}" inputmode="numeric"></div>
    <div><input class="set-rpe" type="number" value="${rpe ?? 8}" min="1" max="10" step="0.5" inputmode="decimal"></div>
    <button type="button" class="set-remove" aria-label="Remove set" title="Remove set">×</button>
  `;
  row.querySelector('.set-remove').onclick = () => { row.remove(); renumberSets(container); };
  container.appendChild(row);
}

/* ---------------- RECOVERY TAB ---------------- */
function renderRecoveryTab() {
  const logs = Storage.getLogs();
  const percents = Recovery.allPercents(logs);
  const panel = $('#panel-recovery');
  panel.innerHTML = `
    <div class="card">
      <h3>Muscle map</h3>
      <div class="bodymap-wrap">${BodyMap.render(percents)}</div>
      <p class="helper-text" style="text-align:center;">Green = ready to train, red = fresh from a hard session. Grey areas aren't tracked as their own muscle group.</p>
    </div>
    <div class="card">
      <h3>Detail</h3>
      <p class="helper-text">A practical estimate based on time since your last session for each muscle and how hard that session was — not a lab measurement.</p>
      <div class="recovery-grid" id="recoveryGrid"></div>
    </div>`;
  const grid = $('#recoveryGrid');
  MUSCLES.forEach(m => {
    const pct = percents[m];
    const tile = document.createElement('div');
    tile.className = 'muscle-tile';
    tile.innerHTML = `
      <div class="name">${m}</div>
      <div class="muscle-bar-track"><div class="muscle-bar-fill" style="width:${pct}%; background:${Recovery.colorFor(pct)};"></div></div>
      <div class="status">${pct}% · ${Recovery.statusLabel(pct)}</div>
    `;
    grid.appendChild(tile);
  });
}

/* ---------------- PROGRESS TAB ---------------- */
function countAllTimePRs(logs) {
  const bestByExercise = {};
  let prCount = 0;
  const sorted = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
  sorted.forEach(l => {
    (l.exercises || []).forEach(e => {
      const top = Progression.topSetOf(e);
      const prior = bestByExercise[e.exerciseId] || 0;
      if (prior > 0 && top.oneRm > prior) prCount++;
      if (top.oneRm > prior) bestByExercise[e.exerciseId] = top.oneRm;
    });
  });
  return prCount;
}

function hasAdvancedTier(plan, logs, settings) {
  return Standards.allLifts().some(lift => {
    const taggedIds = Object.values(plan.days).flat().filter(e => e.standardLift === lift).map(e => e.id);
    let best = 0;
    logs.forEach(l => (l.exercises || []).forEach(e => {
      if (taggedIds.includes(e.exerciseId)) (e.sets || []).forEach(s => { if (s.weight > best) best = s.weight; });
    }));
    const manual = settings.manualLifts?.[lift] || 0;
    const lifted = best || manual;
    if (!lifted) return false;
    const result = Standards.tierFor(lift, settings.gender, settings.bodyweight, lifted);
    return result.tier === 'Advanced' || result.tier === 'Elite';
  });
}

function computeBadges(logs, plan, settings) {
  const total = Consistency.totalSessions(logs);
  const streak = Consistency.currentStreakWeeks(logs);
  const prCount = countAllTimePRs(logs);
  return [
    { icon: '🎯', label: 'First Rep', unlocked: total >= 1 },
    { icon: '🔥', label: 'On a Roll', unlocked: streak >= 3, hint: '3-week streak' },
    { icon: '🌋', label: 'Unstoppable', unlocked: streak >= 8, hint: '8-week streak' },
    { icon: '💯', label: 'Century', unlocked: total >= 10, hint: '10 sessions' },
    { icon: '🏋️', label: 'Iron Regular', unlocked: total >= 50, hint: '50 sessions' },
    { icon: '🥇', label: 'New Max', unlocked: prCount >= 1, hint: 'Any PR' },
    { icon: '⚡', label: 'Serial PR Setter', unlocked: prCount >= 5, hint: '5 PRs' },
    { icon: '📈', label: 'Advanced Tier', unlocked: hasAdvancedTier(plan, logs, settings), hint: 'Advanced+ on any lift' },
    { icon: '🎨', label: 'Explorer', unlocked: (settings.themesTried || []).length >= 3, hint: 'Try 3 themes' }
  ];
}

function renderProgressTab() {
  const logs = Storage.getLogs();
  const plan = Storage.getPlan();
  const settings = Storage.getSettings();
  const panel = $('#panel-progress');
  const streak = Consistency.currentStreakWeeks(logs);
  const total = Consistency.totalSessions(logs);
  const adherence = Consistency.adherenceLast7Days(logs, plan);

  panel.innerHTML = `
    <div class="card">
      <h3>Consistency</h3>
      <div class="streak-stats">
        <div class="streak-stat"><div class="num">${streak}</div><div class="lbl">Week streak</div></div>
        <div class="streak-stat"><div class="num">${total}</div><div class="lbl">Sessions logged</div></div>
        <div class="streak-stat"><div class="num">${adherence === null ? '—' : adherence + '%'}</div><div class="lbl">Last 7 days</div></div>
      </div>
    </div>
    <div class="card">
      <h3>Trophy case</h3>
      <div class="badge-grid" id="badgeGrid"></div>
    </div>
    <div class="card">
      <h3>Exercise trend</h3>
      <div class="exercise-picker" id="exercisePicker"></div>
      <div id="progressChart"></div>
      <div id="progressPR" class="helper-text"></div>
    </div>
  `;

  const badges = computeBadges(logs, plan, settings);
  const badgeGrid = $('#badgeGrid');
  badges.forEach(b => {
    const tile = document.createElement('div');
    tile.className = 'badge-tile' + (b.unlocked ? ' unlocked' : '');
    tile.innerHTML = `
      <div class="badge-icon">${b.icon}</div>
      <div class="badge-label">${b.label}</div>
      ${b.hint ? `<div class="badge-hint">${b.hint}</div>` : ''}
    `;
    badgeGrid.appendChild(tile);
  });

  const exercises = allPlanExercises();
  if (exercises.length === 0) {
    $('#exercisePicker').innerHTML = '';
    $('#progressChart').innerHTML = '<div class="empty-state">Add exercises in Plan to start tracking trends.</div>';
    return;
  }
  if (!state.progressExerciseId || !exercises.find(e => e.id === state.progressExerciseId)) {
    state.progressExerciseId = exercises[0].id;
  }
  const picker = $('#exercisePicker');
  exercises.forEach(ex => {
    const b = document.createElement('button');
    b.textContent = ex.name;
    b.className = ex.id === state.progressExerciseId ? 'active' : '';
    b.onclick = () => { state.progressExerciseId = ex.id; renderProgressTab(); };
    picker.appendChild(b);
  });

  const chosen = exercises.find(e => e.id === state.progressExerciseId);
  const entries = logsForExercise(chosen.id, logs);
  const points = entries.map(e => {
    const top = Progression.topSetOf(e);
    return { x: e.date.slice(5), y: top.oneRm };
  });
  $('#progressChart').innerHTML = `<h3 style="margin-bottom:8px;">${chosen.name} — estimated 1RM trend</h3>` + Charts.line(points, { unitLabel: chosen.unit });

  const best = bestOneRmEver(chosen.id, logs);
  $('#progressPR').textContent = best.oneRm > 0
    ? `Best estimated 1RM: ${best.oneRm}${chosen.unit} (set on ${best.date})`
    : 'Log a session with this exercise to start tracking.';
}

/* ---------------- STATS TAB ---------------- */
function renderStatsTab() {
  const settings = Storage.getSettings();
  const logs = Storage.getLogs();
  const plan = Storage.getPlan();
  const manual = settings.manualLifts || {};
  const panel = $('#panel-stats');
  panel.innerHTML = `
    <div class="card row">
      <div><label>Bodyweight (${settings.units})</label><input id="statBw" type="number" value="${settings.bodyweight}"></div>
      <div><label>Gender (for standards table)</label><select id="statGender"><option value="male" ${settings.gender==='male'?'selected':''}>Male</option><option value="female" ${settings.gender==='female'?'selected':''}>Female</option></select></div>
    </div>
    <div id="tierCards"></div>
    <div class="card">
      <h3>Weekly volume vs. landmarks</h3>
      <p class="helper-text">Working sets per week, per muscle, against general effective-volume ranges (MEV/MAV/MRV). A rough guide, not a hard rule.</p>
      <div id="volumeRows"></div>
    </div>
  `;

  $('#statBw').onchange = (e) => { const s = Storage.getSettings(); s.bodyweight = Number(e.target.value) || s.bodyweight; Storage.saveSettings(s); renderStatsTab(); };
  $('#statGender').onchange = (e) => { const s = Storage.getSettings(); s.gender = e.target.value; Storage.saveSettings(s); renderStatsTab(); };

  const cardsWrap = $('#tierCards');
  Standards.allLifts().forEach(lift => {
    const taggedIds = Object.values(plan.days).flat().filter(e => e.standardLift === lift).map(e => e.id);
    let best = 0;
    logs.forEach(l => (l.exercises || []).forEach(e => {
      if (taggedIds.includes(e.exerciseId)) {
        (e.sets || []).forEach(s => { if (s.weight > best) best = s.weight; });
      }
    }));
    const usingManual = best === 0;
    const lifted = usingManual ? (manual[lift] || 0) : best;
    const s = Storage.getSettings();
    const result = Standards.tierFor(lift, s.gender, s.bodyweight, lifted);
    const card = document.createElement('div');
    card.className = 'card tier-card';
    card.innerHTML = `
      <div class="tier-badge" style="background:${TIER_COLORS[result.tier]};">${result.tier.slice(0,3)}</div>
      <div class="tier-info">
        <div class="lift-name">${lift}</div>
        <div class="tier-name">${result.tier}</div>
        <div class="to-next">${lifted ? `Best: ${lifted}${s.units}` : 'No data yet'} ${result.nextTier ? `· ${result.toNext}${s.units} to ${result.nextTier}` : (result.tier==='Elite' ? '· Top tier' : '')}</div>
        ${usingManual ? `<div class="row" style="margin-top:8px;"><input type="number" placeholder="Enter your best ${lift} (${s.units})" value="${manual[lift]||''}" data-lift="${lift}" class="manual-lift-input"></div>` : ''}
      </div>
    `;
    cardsWrap.appendChild(card);
  });

  $all('.manual-lift-input', cardsWrap).forEach(input => {
    input.onchange = (e) => {
      const s = Storage.getSettings();
      s.manualLifts = s.manualLifts || {};
      s.manualLifts[e.target.dataset.lift] = Number(e.target.value) || 0;
      Storage.saveSettings(s);
      renderStatsTab();
    };
  });

  const volumes = Volume.weeklySetsByMuscle(plan);
  const volWrap = $('#volumeRows');
  MUSCLES.forEach(m => {
    const sets = volumes[m] || 0;
    const lm = VOLUME_LANDMARKS[m];
    const status = Volume.classify(m, sets);
    const row = document.createElement('div');
    row.className = 'volume-row';
    row.innerHTML = `
      <div class="vr-top"><span class="vlabel">${m}</span><span style="color:${status.color};">${sets} sets/wk · ${status.label}</span></div>
      ${Charts.bar(sets, lm.mrv, status.color)}
    `;
    volWrap.appendChild(row);
  });
}

/* ---------------- SETTINGS TAB ---------------- */
function renderSettingsTab() {
  const s = Storage.getSettings();
  const cycle = Storage.getCycle();
  const panel = $('#panel-settings');
  panel.innerHTML = `
    <div class="card">
      <h3>Units & profile</h3>
      <div class="row">
        <div><label>Units</label><select id="setUnits"><option value="lb" ${s.units==='lb'?'selected':''}>lb</option><option value="kg" ${s.units==='kg'?'selected':''}>kg</option></select></div>
        <div><label>Bodyweight</label><input id="setBw" type="number" value="${s.bodyweight}"></div>
      </div>
    </div>
    <div class="card">
      <h3>Periodization</h3>
      <div class="row">
        <div><label>Deload every N weeks</label><input id="setDeload" type="number" min="2" value="${cycle.deloadEvery}"></div>
        <div><label>Peak/test week every N weeks (0 = off)</label><input id="setPeak" type="number" min="0" value="${cycle.peakEvery}"></div>
      </div>
      <p class="helper-text">Deload weeks automatically lighten load and volume; peak weeks suggest a heavier, low-rep top set to re-test your working max.</p>
    </div>
    <div class="card">
      <h3>Token economy</h3>
      <div class="row">
        <div><label>Tokens per workout</label><input id="setTokensWorkout" type="number" min="0" value="${s.tokensPerWorkout}"></div>
        <div><label>Bonus tokens per PR</label><input id="setTokensPR" type="number" min="0" value="${s.tokensPerPR}"></div>
      </div>
      <p class="helper-text">Shared rate for everyone in the household — changing it here changes it for both of you.</p>
    </div>
    <div class="card">
      <h3>Barbell & plates</h3>
      <div class="row">
        <div><label>Bar weight (${s.units})</label><input id="setBar" type="number" value="${s.barWeight}"></div>
        <div><label>Plates you own (comma separated, ${s.units})</label><input id="setPlates" value="${s.availablePlates.join(', ')}"></div>
      </div>
      <div class="row">
        <div><label>Rest timer sound</label><select id="setRestSound"><option value="true" ${s.restTimerSound?'selected':''}>On</option><option value="false" ${!s.restTimerSound?'selected':''}>Off</option></select></div>
      </div>
    </div>
    <div class="card">
      <h3>AI assist</h3>
      <p class="helper-text">Used for exercise suggestions, form/mind-muscle cues, plan review, and the AI plan builder. <strong>This key stays only on this device</strong> — it is never synced, never written into your shared Gist, and never shared with other profiles or devices. That's intentional: GitHub scans gist content (even "secret" ones) for exposed API keys and Google auto-revokes anything it finds, so a key stored inside synced data will always eventually get killed. Each person/device needs to enter their own free key. Calls go directly from the browser to Google's API — nothing passes through any server of mine. Get a free key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>.</p>
      <p class="helper-text" style="color:var(--amber);"><strong>Never paste this key anywhere else</strong> — not into a code file, a GitHub issue, a commit, or a gist (public or secret). Only ever paste it here.</p>
      <div class="row">
        <div><label>Enable AI</label><select id="setAiEnabled"><option value="false" ${!s.aiEnabled?'selected':''}>Off</option><option value="true" ${s.aiEnabled?'selected':''}>On</option></select></div>
        <div><label>Gemini API key</label><input id="setAiKey" type="password" value="${s.aiApiKey||''}" placeholder="Paste your key"></div>
      </div>
      <button class="btn btn-sm" id="testAiBtn" style="margin-top:8px;">Test connection</button>
      <div id="aiTestResult"></div>
    </div>
    <div class="card">
      <h3>Cross-device sync (GitHub)</h3>
      <p class="helper-text">Stores your plan and logs in a private Gist on your GitHub account. Any device with the same token stays in sync automatically — never your API keys. Create a token at
        <a href="https://github.com/settings/tokens/new?description=Iron%20Log%20sync&scopes=gist" target="_blank" rel="noopener">github.com/settings/tokens/new</a>
        — check only the <strong>gist</strong> scope, set an expiration you're comfortable with, generate, and paste it below.</p>
      <div class="row">
        <div><label>GitHub personal access token</label><input id="setGithubToken" type="password" value="${s.githubToken || ''}" placeholder="ghp_..."></div>
      </div>
      <div class="row" style="margin-top:8px;">
        <button class="btn btn-sm" id="pullNowBtn">Pull latest</button>
        <button class="btn btn-sm" id="pushNowBtn">Push now</button>
      </div>
      <p class="helper-text" id="syncStatus">${s.githubLastSync ? `Last synced: ${new Date(s.githubLastSync).toLocaleString()}` : 'Not synced yet.'}</p>
    </div>
    <div class="card">
      <h3>Backup</h3>
      <div class="row">
        <button class="btn" id="exportBtn">Export this profile (.json)</button>
        <button class="btn" id="importBtn">Import a profile</button>
        <input type="file" id="importFile" accept="application/json" style="display:none;">
      </div>
      <p class="helper-text">Exports only your currently active profile (${Profiles.activeName() || 'none selected'}). Importing adds it as a new profile rather than overwriting — handy for moving a profile to a fresh browser.</p>
    </div>
    <div class="card">
      <h3>App updates</h3>
      <p class="helper-text">The app checks for updates automatically, but iPhone's home-screen apps can be slow to notice new versions. If something feels out of date, tap this — no need to delete and re-add the app.</p>
      <button class="btn btn-sm" id="forceRefreshBtn">Check for updates now</button>
    </div>
    <div class="card">
      <h3>Emergency restore</h3>
      <p class="helper-text">If sync data was ever accidentally overwritten: go to your Gist on github.com → click the <strong>Revisions</strong> tab → find the version from before the overwrite → open the file → copy its full contents → paste below.</p>
      <textarea id="restoreTextarea" rows="4" placeholder="Paste the raw JSON from a gist revision here…"></textarea>
      <button class="btn btn-sm" id="restoreBtn" style="margin-top:8px;">Restore from pasted data</button>
    </div>
    <div class="card">
      <h3>Danger zone</h3>
      <button class="btn btn-danger" id="wipeBtn">Erase all profiles &amp; data on this device</button>
    </div>
  `;

  const save = (mut) => { const cur = Storage.getSettings(); mut(cur); Storage.saveSettings(cur); toast('Saved.'); };
  $('#setUnits').onchange = e => save(s => s.units = e.target.value);
  $('#setBw').onchange = e => save(s => s.bodyweight = Number(e.target.value) || s.bodyweight);
  $('#setTokensWorkout').onchange = e => save(s => s.tokensPerWorkout = Math.max(0, Number(e.target.value) || 0));
  $('#setTokensPR').onchange = e => save(s => s.tokensPerPR = Math.max(0, Number(e.target.value) || 0));
  $('#setAiEnabled').onchange = e => save(s => s.aiEnabled = e.target.value === 'true');
  $('#setAiKey').onchange = e => save(s => s.aiApiKey = e.target.value.trim());
  $('#testAiBtn').onclick = async () => {
    const resultEl = $('#aiTestResult');
    const btn = $('#testAiBtn');
    btn.disabled = true; btn.textContent = 'Testing…';
    resultEl.innerHTML = '';
    if (!Storage.getSettings().aiEnabled) {
      resultEl.innerHTML = `<p class="helper-text" style="color:var(--amber);">AI is set to Off — turn it on above first.</p>`;
    } else if (!Storage.getSettings().aiApiKey) {
      resultEl.innerHTML = `<p class="helper-text" style="color:var(--amber);">No key entered yet.</p>`;
    } else {
      try {
        const text = await AI.callGemini("Reply with exactly one word: connected");
        resultEl.innerHTML = `<p class="helper-text" style="color:var(--success);">✓ Working — Gemini replied: "${escapeHtml(text.slice(0,60))}"</p>`;
      } catch (err) {
        const hint = err.message.includes('401')
          ? ' This usually means the key was revoked — check your email for a notice from Google about it being found exposed somewhere public, and generate a fresh one if so.'
          : '';
        resultEl.innerHTML = `<p class="helper-text" style="color:var(--accent);">✗ Failed: ${escapeHtml(err.message)}${hint}</p>`;
      }
    }
    btn.disabled = false; btn.textContent = 'Test connection';
  };
  $('#setBar').onchange = e => save(s => s.barWeight = Number(e.target.value) || s.barWeight);
  $('#setPlates').onchange = e => save(s => s.availablePlates = e.target.value.split(',').map(v => Number(v.trim())).filter(Boolean).sort((a,b)=>b-a));
  $('#setRestSound').onchange = e => save(s => s.restTimerSound = e.target.value === 'true');
  $('#setDeload').onchange = e => { const c = Storage.getCycle(); c.deloadEvery = Math.max(2, Number(e.target.value) || 5); Storage.saveCycle(c); renderWeekDial(); toast('Saved.'); };
  $('#setPeak').onchange = e => { const c = Storage.getCycle(); c.peakEvery = Math.max(0, Number(e.target.value) || 0); Storage.saveCycle(c); toast('Saved.'); };

  $('#setGithubToken').onchange = async (e) => {
    const token = e.target.value.trim();
    const cur = Storage.getSettings();
    const hadToken = !!cur.githubToken;
    cur.githubToken = token;
    Storage.saveSettingsSilent(cur);
    if (!token) { toast('GitHub sync disconnected.'); renderSettingsTab(); return; }
    if (hadToken) { toast('Token updated.'); return; }
    toast('Connecting to GitHub…');
    // First-time connection always tries to pull any existing shared data
    // first — pulling is now safe (it merges rather than replaces), so this
    // is the right default whether you're the first person connecting or
    // joining someone who already set things up.
    const pullRes = await Sync.pull();
    if (pullRes.ok) {
      toast('Synced with the shared store on GitHub.');
      applyTheme();
      renderProfileButton();
      renderActiveTab();
    } else {
      const pushRes = await Sync.push();
      toast(pushRes.ok ? 'No existing shared data found — created a new sync store with what you have.' : pushRes.message);
    }
    renderSettingsTab();
  };
  $('#pullNowBtn').onclick = async () => {
    if (Sync.hasPendingLocalChanges() && !confirm('You have local changes not yet pushed to GitHub. Pulling now will overwrite them with the GitHub copy. Continue anyway?')) return;
    $('#syncStatus').textContent = 'Pulling…';
    const res = await Sync.pull();
    toast(res.message);
    if (res.ok) checkForNewActivity();
    renderActiveTab();
  };
  $('#pushNowBtn').onclick = async () => {
    $('#syncStatus').textContent = 'Pushing…';
    const res = await Sync.push();
    toast(res.message);
    renderSettingsTab();
  };

  $('#exportBtn').onclick = () => Storage.exportAll();
  $('#importBtn').onclick = () => $('#importFile').click();
  $('#importFile').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = Storage.importAll(reader.result);
      toast(ok ? 'Import successful.' : 'Import failed — check the file.');
      renderActiveTab();
    };
    reader.readAsText(file);
  };
  $('#forceRefreshBtn').onclick = async () => {
    toast('Clearing cache and checking for updates…');
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(n => caches.delete(n)));
      }
    } catch (e) { console.error(e); }
    window.location.reload();
  };
  $('#restoreBtn').onclick = () => {
    const text = $('#restoreTextarea').value.trim();
    if (!text) { toast('Paste the JSON first.'); return; }
    const result = Storage.restoreFromRawBackup(text);
    if (result.ok) {
      toast(`Restored ${result.count} profile${result.count === 1 ? '' : 's'}. Push to GitHub in the sync card above to make it official.`);
      $('#restoreTextarea').value = '';
      applyTheme();
      renderProfileButton();
      renderActiveTab();
      renderSettingsTab();
    } else {
      toast(result.message);
    }
  };
  $('#wipeBtn').onclick = () => {
    if (confirm('This erases every profile, plan, log, and setting on this device. This cannot be undone. Continue?')) {
      Storage.wipeAll();
      toast('All data erased.');
      applyTheme();
      renderProfileButton();
      renderProfilePanel();
      $('#profilePanel').style.display = 'block';
      renderActiveTab();
    }
  };
}

/* ---------------- INIT ---------------- */
document.addEventListener('DOMContentLoaded', async () => {
  $all('.tab-btn').forEach(b => b.onclick = () => switchTab(b.dataset.tab));

  $('#profileBtn').onclick = () => toggleProfilePanel();
  document.addEventListener('click', (e) => {
    const panel = $('#profilePanel');
    const btn = $('#profileBtn');
    if (panel.style.display !== 'none' && !panel.contains(e.target) && !btn.contains(e.target)) {
      if (Storage.hasAnyProfile()) panel.style.display = 'none';
    }
  });

  applyTheme();
  renderProfileButton();

  if (!Storage.hasAnyProfile()) {
    renderProfilePanel();
    $('#profilePanel').style.display = 'block';
  }

  lastAutoSyncCheck = Date.now();
  await syncNow(false);
  if (Storage.hasAnyProfile()) switchTab('home');
});
