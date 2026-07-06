/* ============================================================
   APP — tabs, rendering, event wiring
   ============================================================ */

let state = {
  activeTab: 'today',
  planDay: weekdayName(isoDate()),
  progressExerciseId: null,
  restTimers: {}
};

function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return [...root.querySelectorAll(sel)]; }

function toast(msg) {
  const el = $('#toast');
  el.innerHTML = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2800);
}

function fmtWeight(w, unit) { return `${w}${unit}`; }

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
function renderPlanTab() {
  const plan = Storage.getPlan();
  const panel = $('#panel-plan');
  panel.innerHTML = `
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
  $('#reviewPlanBtn').onclick = () => runPlanReview(plan);

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

function runPlanReview(plan) {
  const resultsEl = $('#planReviewResults');
  const findings = PlanReview.analyze(plan);
  resultsEl.innerHTML = PlanReview.renderHTML(findings) + `<div class="ai-review-slot"></div>`;
  const aiSlot = resultsEl.querySelector('.ai-review-slot');
  aiSlot.innerHTML = `<div class="helper-text">Loading AI summary…</div>`;
  const summary = PlanReview.toPromptSummary(plan, findings);
  AI.reviewPlan(summary).then(res => {
    aiSlot.innerHTML = `<div class="ai-tip"><span class="tag">${res.source === 'ai' ? 'AI summary' : 'Note'}</span>${res.text}</div>`;
  });
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
    const entry = { date: today, day: templateDay, exercises: [] };
    let prCount = 0;
    $all('.card[data-exercise-id]', list).forEach(card => {
      const exId = card.dataset.exerciseId;
      const ex = exercises.find(e => e.id === exId);
      const sets = $all('.set-row:not(.set-header)', card).map(row => ({
        weight: Number(row.querySelector('.set-weight').value) || 0,
        reps: Number(row.querySelector('.set-reps').value) || 0,
        rpe: Number(row.querySelector('.set-rpe').value) || 8
      }));
      const priorBest = bestOneRmEver(exId, logs).oneRm;
      const newTop = Progression.topSetOf({ sets });
      if (newTop.oneRm > priorBest && priorBest > 0) prCount++;
      entry.exercises.push({ exerciseId: exId, name: ex.name, muscle: ex.muscle, sets });
    });
    Storage.addLog(entry);
    toast(prCount > 0
      ? `Session saved. <span class="pr-toast-badge">${prCount} New PR${prCount > 1 ? 's' : ''}!</span>`
      : "Session saved — next week's targets will update from this.");
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
      <h3>Exercise trend</h3>
      <div class="exercise-picker" id="exercisePicker"></div>
      <div id="progressChart"></div>
      <div id="progressPR" class="helper-text"></div>
    </div>
  `;

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
      <p class="helper-text">Used only for exercise suggestions and form/mind-muscle cues. Your key is stored solely in this browser and calls go directly to Google's Gemini API — nothing passes through any server of mine. Get a free key at <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>.</p>
      <div class="row">
        <div><label>Enable AI</label><select id="setAiEnabled"><option value="false" ${!s.aiEnabled?'selected':''}>Off</option><option value="true" ${s.aiEnabled?'selected':''}>On</option></select></div>
        <div><label>Gemini API key</label><input id="setAiKey" type="password" value="${s.aiApiKey||''}" placeholder="Paste your key"></div>
      </div>
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
    if (Sync.hasPendingLocalChanges()) {
      const pushRes = await Sync.push();
      toast(pushRes.ok ? 'Pushed your existing data to GitHub as the starting point.' : pushRes.message);
    } else {
      const pullRes = await Sync.pull();
      if (pullRes.ok) {
        toast('Found existing data — pulled it in.');
        renderActiveTab();
      } else {
        const pushRes = await Sync.push();
        toast(pushRes.ok ? 'Created new sync store on GitHub.' : pushRes.message);
      }
    }
    renderSettingsTab();
  };
  $('#pullNowBtn').onclick = async () => {
    if (Sync.hasPendingLocalChanges() && !confirm('You have local changes not yet pushed to GitHub. Pulling now will overwrite them with the GitHub copy. Continue anyway?')) return;
    $('#syncStatus').textContent = 'Pulling…';
    const res = await Sync.pull();
    toast(res.message);
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
  $('#wipeBtn').onclick = () => {
    if (confirm('This erases every plan, log, and setting on this device. This cannot be undone. Continue?')) {
      Storage.wipeAll();
      toast('All data erased.');
      renderActiveTab();
    }
  };
}

/* ---------------- INIT ---------------- */
document.addEventListener('DOMContentLoaded', async () => {
  $all('.tab-btn').forEach(b => b.onclick = () => switchTab(b.dataset.tab));
  const s = Storage.getSettings();
  if (s.githubToken) {
    if (Sync.hasPendingLocalChanges()) {
      toast('Pushing unsynced changes to GitHub…');
      await Sync.push();
    } else {
      toast('Checking GitHub for updates…');
      const res = await Sync.pull();
      if (res.ok) toast('Synced from GitHub.');
    }
  }
  switchTab('today');
});
