/* ============================================================
   APP — tabs, rendering, event wiring
   ============================================================ */

let state = {
  activeTab: 'plan',
  planDay: weekdayName(isoDate())
};

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2200);
}

function fmtWeight(w, unit) { return `${w}${unit}`; }

/* ---------------- TAB SWITCHING ---------------- */
function switchTab(tab) {
  state.activeTab = tab;
  $all('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $all('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tab}`));
  renderActiveTab();
}

function renderActiveTab() {
  if (state.activeTab === 'plan') renderPlanTab();
  if (state.activeTab === 'today') renderTodayTab();
  if (state.activeTab === 'recovery') renderRecoveryTab();
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
function renderPlanTab() {
  const plan = Storage.getPlan();
  const panel = $('#panel-plan');
  panel.innerHTML = `
    <div class="day-tabs" id="planDayTabs"></div>
    <div class="card">
      <h3>${state.planDay}'s exercises</h3>
      <div id="planExerciseList"></div>
      <button class="btn btn-primary btn-sm" id="addExerciseBtn" style="margin-top:10px;">+ Add exercise</button>
    </div>
    <div id="addExerciseForm"></div>
  `;
  const dayTabs = $('#planDayTabs');
  DAYS.forEach(d => {
    const b = document.createElement('button');
    b.textContent = d.slice(0, 3);
    b.className = d === state.planDay ? 'active' : '';
    b.onclick = () => { state.planDay = d; renderPlanTab(); };
    dayTabs.appendChild(b);
  });

  const list = $('#planExerciseList');
  const exercises = plan.days[state.planDay] || [];
  if (exercises.length === 0) {
    list.innerHTML = `<div class="empty-state">Rest day — or just not set yet. Add an exercise to start training ${state.planDay}s.</div>`;
  } else {
    list.innerHTML = '';
    exercises.forEach(ex => {
      const row = document.createElement('div');
      row.className = 'exercise-row';
      row.innerHTML = `
        <div>
          <div class="exercise-name">${ex.name}</div>
          <div class="exercise-meta">${ex.muscle} · ${ex.sets} sets × ${ex.repLow}-${ex.repHigh} reps · starting ${fmtWeight(ex.currentWeight, ex.unit)}</div>
        </div>
        <button class="btn btn-sm btn-danger" data-id="${ex.id}">Remove</button>
      `;
      row.querySelector('button').onclick = () => {
        plan.days[state.planDay] = plan.days[state.planDay].filter(e => e.id !== ex.id);
        Storage.savePlan(plan);
        renderPlanTab();
      };
      list.appendChild(row);
    });
  }

  $('#addExerciseBtn').onclick = () => renderAddExerciseForm();
}

function renderAddExerciseForm() {
  const settings = Storage.getSettings();
  const container = $('#addExerciseForm');
  container.innerHTML = `
    <div class="card">
      <h3>New exercise — ${state.planDay}</h3>
      <div class="row">
        <div><label>Exercise name</label><input id="exName" placeholder="e.g. Incline dumbbell press"></div>
        <div><label>Muscle</label>
          <select id="exMuscle">${MUSCLES.map(m => `<option>${m}</option>`).join('')}</select>
        </div>
      </div>
      <div class="row">
        <div><label>Type</label>
          <select id="exType"><option value="compound">Compound</option><option value="isolation">Isolation</option></select>
        </div>
        <div><label>Lower body?</label>
          <select id="exLower"><option value="false">No</option><option value="true">Yes</option></select>
        </div>
        <div><label>Counts toward tier (optional)</label>
          <select id="exStandard"><option value="">None</option>${Standards.allLifts().map(l => `<option>${l}</option>`).join('')}</select>
        </div>
      </div>
      <div class="row">
        <div><label>Sets</label><input id="exSets" type="number" value="3" min="1"></div>
        <div><label>Rep range low</label><input id="exRepLow" type="number" value="8" min="1"></div>
        <div><label>Rep range high</label><input id="exRepHigh" type="number" value="12" min="1"></div>
        <div><label>Starting weight (${settings.units})</label><input id="exWeight" type="number" value="45" min="0"></div>
      </div>
      <div class="row">
        <button class="btn btn-primary" id="saveExerciseBtn">Save exercise</button>
        <button class="btn" id="cancelExerciseBtn">Cancel</button>
      </div>
    </div>
  `;
  $('#saveExerciseBtn').onclick = () => {
    const name = $('#exName').value.trim();
    if (!name) { toast('Give the exercise a name first.'); return; }
    const plan = Storage.getPlan();
    const ex = {
      id: uid(),
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
    if (!plan.days[state.planDay]) plan.days[state.planDay] = [];
    plan.days[state.planDay].push(ex);
    Storage.savePlan(plan);
    container.innerHTML = '';
    renderPlanTab();
    toast('Exercise added — it repeats every ' + state.planDay + ' until you change it.');
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
    <button class="btn btn-primary" id="saveSessionBtn" style="margin-top:10px;">Save today's session</button>
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

  exercises.forEach(ex => {
    const exLogs = logs
      .map(l => ({ date: l.date, entry: (l.exercises || []).find(e => e.exerciseId === ex.id) }))
      .filter(x => x.entry)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(x => x.entry);

    const rx = Progression.nextPrescription(ex, exLogs, upcomingType);
    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.exerciseId = ex.id;
    card.innerHTML = `
      <h3>${ex.name} <span class="exercise-meta">· ${ex.muscle}</span></h3>
      <div class="rx-box ${upcomingType !== 'train' ? upcomingType : ''}">
        Target: <strong>${rx.sets} × ${rx.reps} @ ${fmtWeight(rx.weight, ex.unit)}</strong><br>${rx.note}
      </div>
      <div class="ai-cue" style="margin-top:8px;"></div>
      <div class="sets-log" style="margin-top:10px;"></div>
      <button class="btn btn-sm add-set-btn" style="margin-top:8px;">+ Add set</button>
      <button class="btn btn-sm cue-btn" style="margin-top:8px;">Get form cue</button>
    `;
    const setsWrap = card.querySelector('.sets-log');
    for (let i = 0; i < rx.sets; i++) addSetRow(setsWrap, rx.weight, rx.reps, ex.unit);

    card.querySelector('.add-set-btn').onclick = () => addSetRow(setsWrap, rx.weight, rx.reps, ex.unit);
    card.querySelector('.cue-btn').onclick = async (e) => {
      e.target.disabled = true; e.target.textContent = 'Thinking…';
      const cue = await AI.mindMuscleCue(ex.name, ex.muscle);
      card.querySelector('.ai-cue').innerHTML = `<div class="ai-tip"><span class="tag">${cue.source === 'ai' ? 'AI cue' : 'Offline tip'}</span>${cue.text}</div>`;
      e.target.disabled = false; e.target.textContent = 'Get form cue';
    };
    list.appendChild(card);
  });

  $('#saveSessionBtn').onclick = () => {
    const entry = { date: today, day: templateDay, exercises: [] };
    $all('.card[data-exercise-id]', list).forEach(card => {
      const exId = card.dataset.exerciseId;
      const ex = exercises.find(e => e.id === exId);
      const sets = $all('.set-row', card).map(row => ({
        weight: Number(row.querySelector('.set-weight').value) || 0,
        reps: Number(row.querySelector('.set-reps').value) || 0,
        rpe: Number(row.querySelector('.set-rpe').value) || 8
      }));
      entry.exercises.push({ exerciseId: exId, name: ex.name, muscle: ex.muscle, sets });
    });
    Storage.addLog(entry);
    toast('Session saved — next week\'s targets will update from this.');
  };
}

function addSetRow(container, weight, reps, unit) {
  const row = document.createElement('div');
  row.className = 'row set-row';
  row.style.marginBottom = '6px';
  row.innerHTML = `
    <div><input class="set-weight" type="number" value="${weight}" placeholder="Weight (${unit})"></div>
    <div><input class="set-reps" type="number" value="${reps}" placeholder="Reps"></div>
    <div><input class="set-rpe" type="number" value="8" min="1" max="10" step="0.5" placeholder="RPE"></div>
  `;
  container.appendChild(row);
}

/* ---------------- RECOVERY TAB ---------------- */
function renderRecoveryTab() {
  const logs = Storage.getLogs();
  const percents = Recovery.allPercents(logs);
  const panel = $('#panel-recovery');
  panel.innerHTML = `<div class="card"><h3>Muscle readiness</h3><p class="helper-text">A practical estimate based on time since your last session for each muscle and how hard that session was — not a lab measurement.</p><div class="recovery-grid" id="recoveryGrid"></div></div>`;
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

/* ---------------- STATS TAB ---------------- */
function renderStatsTab() {
  const settings = Storage.getSettings();
  const logs = Storage.getLogs();
  const plan = Storage.getPlan();
  const manual = settings.manualLifts || {};
  const panel = $('#panel-stats');
  panel.innerHTML = `<div class="card row"><div><label>Bodyweight (${settings.units})</label><input id="statBw" type="number" value="${settings.bodyweight}"></div><div><label>Gender (for standards table)</label><select id="statGender"><option value="male" ${settings.gender==='male'?'selected':''}>Male</option><option value="female" ${settings.gender==='female'?'selected':''}>Female</option></select></div></div><div id="tierCards"></div>`;

  $('#statBw').onchange = (e) => { const s = Storage.getSettings(); s.bodyweight = Number(e.target.value) || s.bodyweight; Storage.saveSettings(s); renderStatsTab(); };
  $('#statGender').onchange = (e) => { const s = Storage.getSettings(); s.gender = e.target.value; Storage.saveSettings(s); renderStatsTab(); };

  const cardsWrap = $('#tierCards');
  Standards.allLifts().forEach(lift => {
    // find best logged weight among exercises tagged with this standard lift
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
      <h3>AI assist</h3>
      <p class="helper-text">Used only for exercise suggestions and form/mind-muscle cues. Your key is stored solely in this browser and calls go directly to Google's Gemini API — nothing passes through any server of mine. Get a free key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>.</p>
      <div class="row">
        <div><label>Enable AI</label><select id="setAiEnabled"><option value="false" ${!s.aiEnabled?'selected':''}>Off</option><option value="true" ${s.aiEnabled?'selected':''}>On</option></select></div>
        <div><label>Gemini API key</label><input id="setAiKey" type="password" value="${s.aiApiKey||''}" placeholder="Paste your key"></div>
      </div>
    </div>
    <div class="card">
      <h3>Backup</h3>
      <div class="row">
        <button class="btn" id="exportBtn">Export backup (.json)</button>
        <button class="btn" id="importBtn">Import backup</button>
        <input type="file" id="importFile" accept="application/json" style="display:none;">
      </div>
      <p class="helper-text">Your data lives in this browser only. Export regularly, especially before clearing browser data or switching devices.</p>
    </div>
    <div class="card">
      <h3>Danger zone</h3>
      <button class="btn btn-danger" id="wipeBtn">Erase all data on this device</button>
    </div>
  `;

  const save = (mut) => { const cur = Storage.getSettings(); mut(cur); Storage.saveSettings(cur); toast('Saved.'); };
  $('#setUnits').onchange = e => save(s => s.units = e.target.value);
  $('#setBw').onchange = e => save(s => s.bodyweight = Number(e.target.value) || s.bodyweight);
  $('#setAiEnabled').onchange = e => save(s => s.aiEnabled = e.target.value === 'true');
  $('#setAiKey').onchange = e => save(s => s.aiApiKey = e.target.value.trim());
  $('#setDeload').onchange = e => { const c = Storage.getCycle(); c.deloadEvery = Math.max(2, Number(e.target.value) || 5); Storage.saveCycle(c); renderWeekDial(); toast('Saved.'); };
  $('#setPeak').onchange = e => { const c = Storage.getCycle(); c.peakEvery = Math.max(0, Number(e.target.value) || 0); Storage.saveCycle(c); toast('Saved.'); };

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
  $('#wipeBtn').onclick = () => {
    if (confirm('This erases every plan, log, and setting on this device. This cannot be undone. Continue?')) {
      Storage.wipeAll();
      toast('All data erased.');
      renderActiveTab();
    }
  };
}

/* ---------------- INIT ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  $all('.tab-btn').forEach(b => b.onclick = () => switchTab(b.dataset.tab));
  switchTab('today');
});
