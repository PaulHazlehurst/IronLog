/* ============================================================
   STORAGE LAYER
   Everything lives in localStorage on this device/browser.
   Use Settings > Export to back up, Import to restore or move
   to another device.
   ============================================================ */

const DB = {
  PLAN: 'ih_plan',          // recurring weekly template
  LOGS: 'ih_logs',          // array of completed session logs
  SETTINGS: 'ih_settings',  // units, bodyweight, gender, ai key
  CYCLE: 'ih_cycle',        // periodization meta (start date, deload cadence)
  WEEK_OVERRIDES: 'ih_week_overrides' // per-week "missed day" reshuffles
};

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load', key, e);
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('Failed to save', key, e);
    return false;
  }
}

const Storage = {
  getPlan() {
    return loadJSON(DB.PLAN, { days: Object.fromEntries(DAYS.map(d => [d, []])) });
  },
  savePlan(plan) { saveJSON(DB.PLAN, plan); },

  getLogs() { return loadJSON(DB.LOGS, []); },
  saveLogs(logs) { saveJSON(DB.LOGS, logs); },
  addLog(entry) {
    const logs = Storage.getLogs();
    logs.push(entry);
    Storage.saveLogs(logs);
  },

  getSettings() {
    return loadJSON(DB.SETTINGS, {
      units: 'lb',
      bodyweight: 180,
      gender: 'male',
      aiProvider: 'gemini',
      aiApiKey: '',
      aiEnabled: false
    });
  },
  saveSettings(s) { saveJSON(DB.SETTINGS, s); },

  getCycle() {
    return loadJSON(DB.CYCLE, {
      startDate: new Date().toISOString().slice(0,10),
      deloadEvery: 5,   // train N-1 weeks, then a deload week
      peakEvery: 0      // 0 = disabled; else weeks between test/peak weeks
    });
  },
  saveCycle(c) { saveJSON(DB.CYCLE, c); },

  getWeekOverrides() { return loadJSON(DB.WEEK_OVERRIDES, {}); },
  saveWeekOverrides(o) { saveJSON(DB.WEEK_OVERRIDES, o); },

  exportAll() {
    const bundle = {
      version: 1,
      exportedAt: new Date().toISOString(),
      plan: Storage.getPlan(),
      logs: Storage.getLogs(),
      settings: Storage.getSettings(),
      cycle: Storage.getCycle(),
      weekOverrides: Storage.getWeekOverrides()
    };
    const stripped = { ...bundle, settings: { ...bundle.settings, aiApiKey: '' } };
    const blob = new Blob([JSON.stringify(stripped, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iron-log-backup-${bundle.exportedAt.slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importAll(json) {
    try {
      const bundle = JSON.parse(json);
      if (bundle.plan) Storage.savePlan(bundle.plan);
      if (bundle.logs) Storage.saveLogs(bundle.logs);
      if (bundle.cycle) Storage.saveCycle(bundle.cycle);
      if (bundle.weekOverrides) Storage.saveWeekOverrides(bundle.weekOverrides);
      if (bundle.settings) {
        const current = Storage.getSettings();
        Storage.saveSettings({ ...bundle.settings, aiApiKey: current.aiApiKey });
      }
      return true;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  },

  wipeAll() {
    Object.values(DB).forEach(k => localStorage.removeItem(k));
  }
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function isoDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function mondayOf(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0 = Sun
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  return isoDate(d);
}

function weekdayName(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const idx = (d.getDay() + 6) % 7; // Monday=0
  return DAYS[idx];
}
