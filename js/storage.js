/* ============================================================
   STORAGE LAYER — multi-profile
   ------------------------------------------------------------
   All profiles (e.g. you and your partner) live inside ONE
   synced blob so either device can switch between profiles or
   push a plan to the other. Three tiers:
     - PROFILES: per-person data (plan, logs, cycle, theme, body
       stats) — synced.
     - SHARED: app-wide AI settings — synced, so entering a key
       once on one device makes it available everywhere synced
       to the same store.
     - DEVICE: the GitHub token/gist id and which profile THIS
       device currently has selected — local only, never synced
       (a token can't usefully sync itself into the store it
       unlocks, and each device may want its own active profile).
   ============================================================ */

const DB = {
  PROFILES: 'ih_profiles',        // { [name]: { plan, logs, cycle, weekOverrides, settings } }
  SHARED: 'ih_shared',            // { aiProvider, aiApiKey, aiEnabled } — synced, app-wide
  DEVICE: 'ih_device',            // { githubToken, githubGistId, githubLastSync, activeProfile } — local only
  // legacy pre-profile keys, read once for migration then left alone
  LEGACY_PLAN: 'ih_plan', LEGACY_LOGS: 'ih_logs', LEGACY_SETTINGS: 'ih_settings',
  LEGACY_CYCLE: 'ih_cycle', LEGACY_WEEK_OVERRIDES: 'ih_week_overrides'
};

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const THEMES = ['iron', 'pink', 'night', 'sunset', 'neon', 'forest'];
const FONT_STYLES = ['modern', 'playful', 'classic'];

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

// Anything (sync.js) can register to hear about local data changes.
let onDataChanged = null;
const LAST_CHANGE_KEY = 'ih_last_change';
function notifyChanged() {
  try { localStorage.setItem(LAST_CHANGE_KEY, new Date().toISOString()); } catch (e) { /* ignore */ }
  if (typeof onDataChanged === 'function') onDataChanged();
}
function getLastLocalChangeAt() {
  return localStorage.getItem(LAST_CHANGE_KEY);
}

function emptyPlan() { return { days: Object.fromEntries(DAYS.map(d => [d, []])) }; }
const TAG_COLORS = ['#4C8DFF', '#F0559C', '#2FD4C0', '#FFA94D', '#8B7CF6', '#4ADE80'];
function defaultProfileSettings() {
  return {
    units: 'lb', bodyweight: 180, gender: 'male',
    barWeight: 45, availablePlates: [45, 35, 25, 10, 5, 2.5],
    restTimerSound: true, manualLifts: {}, theme: 'iron', tagColor: null, fontStyle: 'modern'
  };
}
function defaultProfile() {
  return {
    plan: emptyPlan(),
    logs: [],
    cycle: { startDate: isoDate(), deloadEvery: 5, peakEvery: 0 },
    weekOverrides: {},
    settings: defaultProfileSettings()
  };
}
function defaultShared() { return { aiProvider: 'gemini', aiApiKey: '', aiEnabled: false, posts: [] }; }
function defaultDevice() { return { githubToken: '', githubGistId: '', githubLastSync: null, activeProfile: '', lastSeenPostsAt: null }; }

const PROFILE_SETTING_KEYS = ['units', 'bodyweight', 'gender', 'barWeight', 'availablePlates', 'restTimerSound', 'manualLifts', 'theme', 'tagColor', 'fontStyle'];
const SHARED_SETTING_KEYS = ['aiProvider', 'aiApiKey', 'aiEnabled'];
const DEVICE_SETTING_KEYS = ['githubToken', 'githubGistId', 'githubLastSync'];

/* ---------------- PROFILE MANAGEMENT ---------------- */
function getAllProfilesRaw() { return loadJSON(DB.PROFILES, {}); }
function saveAllProfilesRaw(profiles) { saveJSON(DB.PROFILES, profiles); }
function getDeviceRaw() { return { ...defaultDevice(), ...loadJSON(DB.DEVICE, {}) }; }
function saveDeviceRaw(d) { saveJSON(DB.DEVICE, d); }

function migrateLegacyIfNeeded() {
  const profiles = getAllProfilesRaw();
  if (Object.keys(profiles).length > 0) return; // already on the profile system
  const legacyPlan = loadJSON(DB.LEGACY_PLAN, null);
  const legacyLogs = loadJSON(DB.LEGACY_LOGS, null);
  if (!legacyPlan && !legacyLogs) return; // nothing to migrate, fresh install
  const legacySettings = loadJSON(DB.LEGACY_SETTINGS, {});
  const name = 'My Profile';
  const profile = defaultProfile();
  if (legacyPlan) profile.plan = legacyPlan;
  if (legacyLogs) profile.logs = legacyLogs;
  const legacyCycle = loadJSON(DB.LEGACY_CYCLE, null);
  if (legacyCycle) profile.cycle = legacyCycle;
  const legacyOverrides = loadJSON(DB.LEGACY_WEEK_OVERRIDES, null);
  if (legacyOverrides) profile.weekOverrides = legacyOverrides;
  PROFILE_SETTING_KEYS.forEach(k => { if (legacySettings[k] !== undefined) profile.settings[k] = legacySettings[k]; });
  if (!profile.settings.tagColor) profile.settings.tagColor = TAG_COLORS[0];
  profiles[name] = profile;
  saveAllProfilesRaw(profiles);

  const shared = { ...defaultShared(), ...loadJSON(DB.SHARED, {}) };
  SHARED_SETTING_KEYS.forEach(k => { if (legacySettings[k] !== undefined) shared[k] = legacySettings[k]; });
  saveJSON(DB.SHARED, shared);

  const device = getDeviceRaw();
  DEVICE_SETTING_KEYS.forEach(k => { if (legacySettings[k] !== undefined) device[k] = legacySettings[k]; });
  device.activeProfile = name;
  saveDeviceRaw(device);
}

const Profiles = {
  list() { return Object.keys(getAllProfilesRaw()); },

  activeName() {
    migrateLegacyIfNeeded();
    const device = getDeviceRaw();
    const names = Profiles.list();
    if (device.activeProfile && names.includes(device.activeProfile)) return device.activeProfile;
    return names[0] || '';
  },

  setActive(name) {
    const device = getDeviceRaw();
    device.activeProfile = name;
    saveDeviceRaw(device);
  },

  create(name, theme) {
    name = name.trim();
    if (!name) return false;
    const profiles = getAllProfilesRaw();
    if (profiles[name]) return false;
    const p = defaultProfile();
    if (theme) p.settings.theme = theme;
    const usedColors = Object.values(profiles).map(pr => pr.settings?.tagColor).filter(Boolean);
    p.settings.tagColor = TAG_COLORS.find(c => !usedColors.includes(c)) || TAG_COLORS[Object.keys(profiles).length % TAG_COLORS.length];
    profiles[name] = p;
    saveAllProfilesRaw(profiles);
    Profiles.setActive(name);
    notifyChanged();
    return true;
  },

  rename(oldName, newName) {
    newName = newName.trim();
    if (!newName || oldName === newName) return false;
    const profiles = getAllProfilesRaw();
    if (!profiles[oldName] || profiles[newName]) return false;
    profiles[newName] = profiles[oldName];
    delete profiles[oldName];
    saveAllProfilesRaw(profiles);
    if (Profiles.activeName() === oldName) Profiles.setActive(newName);
    notifyChanged();
    return true;
  },

  delete(name) {
    const profiles = getAllProfilesRaw();
    if (!profiles[name] || Profiles.list().length <= 1) return false;
    delete profiles[name];
    saveAllProfilesRaw(profiles);
    if (Profiles.activeName() === name) Profiles.setActive(Object.keys(profiles)[0]);
    notifyChanged();
    return true;
  },

  // Copies the active profile's plan (exercise template only, not logs)
  // into another profile.
  pushPlanTo(targetName) {
    const profiles = getAllProfilesRaw();
    const activeName = Profiles.activeName();
    if (!profiles[activeName] || !profiles[targetName] || activeName === targetName) return false;
    profiles[targetName].plan = JSON.parse(JSON.stringify(profiles[activeName].plan));
    saveAllProfilesRaw(profiles);
    notifyChanged();
    return true;
  },

  getActive() {
    migrateLegacyIfNeeded();
    let profiles = getAllProfilesRaw();
    let name = Profiles.activeName();
    if (!name) {
      // Truly fresh install — caller (app.js) should prompt to create one;
      // hand back a scratch profile in the meantime so nothing crashes.
      return { name: '', data: defaultProfile() };
    }
    if (!profiles[name]) { profiles[name] = defaultProfile(); saveAllProfilesRaw(profiles); }
    return { name, data: profiles[name] };
  },

  updateActive(mutator) {
    const profiles = getAllProfilesRaw();
    const name = Profiles.activeName();
    if (!name) return;
    if (!profiles[name]) profiles[name] = defaultProfile();
    mutator(profiles[name]);
    saveAllProfilesRaw(profiles);
  }
};

const Storage = {
  hasAnyProfile() { migrateLegacyIfNeeded(); return Profiles.list().length > 0; },

  getPlan() { return Profiles.getActive().data.plan || emptyPlan(); },
  savePlan(plan) { Profiles.updateActive(p => p.plan = plan); notifyChanged(); },

  getLogs() { return Profiles.getActive().data.logs || []; },
  saveLogs(logs) { Profiles.updateActive(p => p.logs = logs); notifyChanged(); },
  addLog(entry) {
    const logs = Storage.getLogs();
    logs.push(entry);
    Storage.saveLogs(logs);
  },

  getSettings() {
    const profile = Profiles.getActive().data;
    const shared = { ...defaultShared(), ...loadJSON(DB.SHARED, {}) };
    const device = getDeviceRaw();
    return { ...defaultProfileSettings(), ...profile.settings, ...shared, ...device };
  },
  saveSettings(s) { Storage._splitSaveSettings(s, true); },
  // Same as saveSettings but never triggers a sync push — used when Sync
  // itself is writing back gistId/lastSync so it doesn't loop on itself.
  saveSettingsSilent(s) { Storage._splitSaveSettings(s, false); },
  _splitSaveSettings(s, shouldNotify) {
    Profiles.updateActive(p => {
      p.settings = p.settings || defaultProfileSettings();
      PROFILE_SETTING_KEYS.forEach(k => { if (k in s) p.settings[k] = s[k]; });
    });
    const shared = { ...defaultShared(), ...loadJSON(DB.SHARED, {}) };
    SHARED_SETTING_KEYS.forEach(k => { if (k in s) shared[k] = s[k]; });
    saveJSON(DB.SHARED, shared);
    const device = getDeviceRaw();
    DEVICE_SETTING_KEYS.forEach(k => { if (k in s) device[k] = s[k]; });
    saveDeviceRaw(device);
    if (shouldNotify) notifyChanged();
  },

  getCycle() { return Profiles.getActive().data.cycle || defaultProfile().cycle; },
  saveCycle(c) { Profiles.updateActive(p => p.cycle = c); notifyChanged(); },

  getWeekOverrides() { return Profiles.getActive().data.weekOverrides || {}; },
  saveWeekOverrides(o) { Profiles.updateActive(p => p.weekOverrides = o); notifyChanged(); },

  exportAll() {
    const { name, data } = Profiles.getActive();
    const bundle = {
      version: 2,
      exportedAt: new Date().toISOString(),
      profileName: name,
      profile: data,
      shared: { ...defaultShared(), ...loadJSON(DB.SHARED, {}), aiApiKey: '' }
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iron-log-${(name || 'profile').replace(/\s+/g, '-')}-${bundle.exportedAt.slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },

  importAll(json) {
    try {
      const bundle = JSON.parse(json);
      if (bundle.version === 2 && bundle.profile) {
        const profiles = getAllProfilesRaw();
        let name = bundle.profileName || 'Imported';
        let finalName = name;
        let i = 2;
        while (profiles[finalName]) { finalName = `${name} (${i})`; i++; }
        profiles[finalName] = bundle.profile;
        saveAllProfilesRaw(profiles);
        Profiles.setActive(finalName);
        notifyChanged();
        return true;
      }
      // legacy single-profile export
      if (bundle.plan || bundle.logs) {
        Profiles.updateActive(p => {
          if (bundle.plan) p.plan = bundle.plan;
          if (bundle.logs) p.logs = bundle.logs;
          if (bundle.cycle) p.cycle = bundle.cycle;
          if (bundle.weekOverrides) p.weekOverrides = bundle.weekOverrides;
          if (bundle.settings) PROFILE_SETTING_KEYS.forEach(k => { if (bundle.settings[k] !== undefined) p.settings[k] = bundle.settings[k]; });
        });
        notifyChanged();
        return true;
      }
      return false;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  },

  wipeAll() {
    [DB.PROFILES, DB.SHARED, DB.DEVICE, DB.LEGACY_PLAN, DB.LEGACY_LOGS, DB.LEGACY_SETTINGS, DB.LEGACY_CYCLE, DB.LEGACY_WEEK_OVERRIDES, LAST_CHANGE_KEY]
      .forEach(k => localStorage.removeItem(k));
  },

  /* ---------------- SHARED COMMENT/ACTIVITY HUB ---------------- */
  getPosts() {
    const shared = { ...defaultShared(), ...loadJSON(DB.SHARED, {}) };
    return (shared.posts || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  addPost(post) {
    const shared = { ...defaultShared(), ...loadJSON(DB.SHARED, {}) };
    shared.posts = [...(shared.posts || []), { id: uid(), createdAt: new Date().toISOString(), reactions: {}, ...post }];
    // Keep the feed from growing forever — trim to the most recent 300.
    if (shared.posts.length > 300) shared.posts = shared.posts.slice(shared.posts.length - 300);
    saveJSON(DB.SHARED, shared);
    notifyChanged();
  },
  toggleReaction(postId, emoji, profileName) {
    const shared = { ...defaultShared(), ...loadJSON(DB.SHARED, {}) };
    const post = (shared.posts || []).find(p => p.id === postId);
    if (!post) return;
    post.reactions = post.reactions || {};
    post.reactions[emoji] = post.reactions[emoji] || [];
    const idx = post.reactions[emoji].indexOf(profileName);
    if (idx >= 0) post.reactions[emoji].splice(idx, 1);
    else post.reactions[emoji].push(profileName);
    saveJSON(DB.SHARED, shared);
    notifyChanged();
  },
  getLastSeenPostsAt() { return getDeviceRaw().lastSeenPostsAt; },
  setLastSeenPostsAt(iso) { const d = getDeviceRaw(); d.lastSeenPostsAt = iso; saveDeviceRaw(d); },

  // Both/all profiles logged at least one session in the current Mon-Sun week.
  jointStreakWeeks() {
    const profiles = getAllProfilesRaw();
    const names = Object.keys(profiles);
    if (names.length < 2) return 0;
    let streak = 0;
    let cursor = mondayOf(isoDate());
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const allTrained = names.every(n => {
        const logs = profiles[n].logs || [];
        return logs.some(l => mondayOf(l.date) === cursor);
      });
      if (!allTrained) break;
      streak++;
      const d = new Date(cursor + 'T00:00:00');
      d.setDate(d.getDate() - 7);
      cursor = isoDate(d);
    }
    return streak;
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

/* ---------------- CONSISTENCY / STREAK HELPERS ---------------- */
const Consistency = {
  // Distinct session dates, sorted ascending.
  sessionDates(logs) {
    return [...new Set(logs.map(l => l.date))].sort();
  },

  // Consecutive weeks (Mon-Sun) with at least one logged session, counting back from today.
  currentStreakWeeks(logs) {
    const dates = new Set(Consistency.sessionDates(logs));
    let weeks = new Set([...dates].map(d => mondayOf(d)));
    let streak = 0;
    let cursor = mondayOf(isoDate());
    while (weeks.has(cursor)) {
      streak++;
      const d = new Date(cursor + 'T00:00:00');
      d.setDate(d.getDate() - 7);
      cursor = isoDate(d);
    }
    return streak;
  },

  totalSessions(logs) { return Consistency.sessionDates(logs).length; },

  // Sessions logged in the last 7 days vs. sessions scheduled in the plan (rough adherence %).
  adherenceLast7Days(logs, plan) {
    const scheduled = Object.values(plan.days).filter(arr => arr && arr.length > 0).length;
    if (scheduled === 0) return null;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const recent = Consistency.sessionDates(logs).filter(d => new Date(d + 'T00:00:00') >= cutoff).length;
    return Math.min(100, Math.round((recent / scheduled) * 100));
  }
};
