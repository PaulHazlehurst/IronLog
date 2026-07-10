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
  SHARED: 'ih_shared',            // { posts, specialDate } — synced, household-wide. NEVER put secrets/API keys in here.
  DEVICE: 'ih_device',            // { githubToken, githubGistId, githubLastSync, activeProfile } — local only
  // legacy pre-profile keys, read once for migration then left alone
  LEGACY_PLAN: 'ih_plan', LEGACY_LOGS: 'ih_logs', LEGACY_SETTINGS: 'ih_settings',
  LEGACY_CYCLE: 'ih_cycle', LEGACY_WEEK_OVERRIDES: 'ih_week_overrides'
};

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const MODES = ['dark', 'light', 'night'];
const STYLES = ['iron', 'pink', 'neon', 'sunset', 'forest', 'holiday', 'winter', 'sabrina', 'taylor'];
const FONT_STYLES = ['modern', 'playful', 'classic', 'handwritten'];

// Old versions stored one combined "theme" string. Splits it into a
// mode (neutrals) + style (accent) so they can now be mixed independently.
function deriveModeStyleFromLegacyTheme(theme) {
  const map = {
    light: { mode: 'light', style: 'iron' },
    night: { mode: 'night', style: 'iron' },
    iron: { mode: 'dark', style: 'iron' },
    sabrina: { mode: 'light', style: 'sabrina' },
    taylor: { mode: 'dark', style: 'taylor' }
  };
  if (map[theme]) return map[theme];
  // pink, neon, sunset, forest, holiday, winter were all dark-based
  return { mode: 'dark', style: STYLES.includes(theme) ? theme : 'iron' };
}

function migrateThemeSettings() {
  const profiles = getAllProfilesRaw();
  let changed = false;
  Object.values(profiles).forEach(p => {
    if (p.settings && p.settings.theme && !p.settings.style) {
      const derived = deriveModeStyleFromLegacyTheme(p.settings.theme);
      p.settings.mode = derived.mode;
      p.settings.style = derived.style;
      delete p.settings.theme;
      changed = true;
    }
  });
  if (changed) saveAllProfilesRaw(profiles);
}

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
    restTimerSound: true, manualLifts: {}, mode: 'dark', style: 'iron', tagColor: null, fontStyle: 'modern',
    ambientEffect: 'none', stylesTried: ['iron'], avatarEmoji: null, soundEffects: false
  };
}
function defaultProfile() {
  return {
    plan: emptyPlan(),
    logs: [],
    cycle: { startDate: isoDate(), deloadEvery: 5, peakEvery: 0 },
    weekOverrides: {},
    settings: defaultProfileSettings(),
    tokens: 0,
    tokenLog: [],
    shop: [],
    spinTokens: 1,
    lastFreeSpinGrantDate: null,
    wellness: {
      waterLog: {},      // { 'YYYY-MM-DD': true }
      library: [],       // [{id, title, author, totalPages, pagesRead, addedAt}]
      studyLog: [],       // [{id, subject, minutes, recallText, bonus, date, createdAt}]
      cardioLog: []       // [{id, type, minutes, date, createdAt}]
    }
  };
}
function defaultShared() { return { posts: [], specialDate: null, tokensPerWorkout: 12, tokensPerPR: 2, deletedProfiles: [], keepsakes: [] }; }
function defaultDevice() { return { githubToken: '', githubGistId: '', githubLastSync: null, activeProfile: '', lastSeenPostsAtByProfile: {}, lastNotifiedAtByProfile: {}, aiProvider: 'gemini', aiApiKey: '', aiEnabled: false }; }

const PROFILE_SETTING_KEYS = ['units', 'bodyweight', 'gender', 'barWeight', 'availablePlates', 'restTimerSound', 'manualLifts', 'mode', 'style', 'tagColor', 'fontStyle', 'ambientEffect', 'stylesTried', 'avatarEmoji', 'theme', 'soundEffects'];
const SHARED_SETTING_KEYS = ['specialDate', 'tokensPerWorkout', 'tokensPerPR'];
const DEVICE_SETTING_KEYS = ['githubToken', 'githubGistId', 'githubLastSync', 'aiProvider', 'aiApiKey', 'aiEnabled'];

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
    migrateLegacyIfNeeded(); migrateThemeSettings();
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
    const shared = { ...defaultShared(), ...loadJSON(DB.SHARED, {}) };
    shared.deletedProfiles = [...new Set([...(shared.deletedProfiles || []), oldName])];
    saveJSON(DB.SHARED, shared);
    if (Profiles.activeName() === oldName) Profiles.setActive(newName);
    notifyChanged();
    return true;
  },

  delete(name) {
    const profiles = getAllProfilesRaw();
    if (!profiles[name] || Profiles.list().length <= 1) return false;
    delete profiles[name];
    saveAllProfilesRaw(profiles);
    const shared = { ...defaultShared(), ...loadJSON(DB.SHARED, {}) };
    shared.deletedProfiles = [...new Set([...(shared.deletedProfiles || []), name])];
    saveJSON(DB.SHARED, shared);
    if (Profiles.activeName() === name) Profiles.setActive(Object.keys(profiles)[0]);
    notifyChanged();
    return true;
  },

  // Copies the active profile's plan (exercise template only, not logs)
  // into another profile. If GitHub sync is connected, fetches that
  // profile's current file fresh first and pushes only that one file back —
  // it never touches any other profile's data, local cache or not.
  async pushPlanTo(targetName) {
    const activeName = Profiles.activeName();
    if (activeName === targetName) return false;
    const activeData = getAllProfilesRaw()[activeName];
    if (!activeData) return false;
    const device = getDeviceRaw();

    if (device.githubToken && device.githubGistId) {
      const freshTarget = await Sync.fetchProfileFresh(targetName);
      const profiles = getAllProfilesRaw();
      const base = freshTarget || profiles[targetName];
      if (!base) return false;
      base.plan = JSON.parse(JSON.stringify(activeData.plan));
      profiles[targetName] = base;
      saveAllProfilesRaw(profiles);
      const res = await Sync.pushSingleProfile(targetName);
      return res.ok;
    }

    const profiles = getAllProfilesRaw();
    if (!profiles[targetName]) return false;
    profiles[targetName].plan = JSON.parse(JSON.stringify(activeData.plan));
    saveAllProfilesRaw(profiles);
    notifyChanged();
    return true;
  },

  // Deducts from the active profile's own balance (always safe) and, for
  // the recipient, fetches their current file fresh (if synced) and pushes
  // only that one file back — same safety pattern as pushPlanTo, never a
  // blind local write to someone else's data.
  async sendTokensTo(targetName, amount) {
    const activeName = Profiles.activeName();
    if (activeName === targetName) return { ok: false, message: "That's your own balance." };
    amount = Math.floor(Number(amount)) || 0;
    if (amount < 1) return { ok: false, message: 'Enter a valid amount.' };
    if (amount > Storage.getTokens()) return { ok: false, message: "You don't have that many tokens." };

    Profiles.updateActive(p => {
      p.tokens = (p.tokens || 0) - amount;
      p.tokenLog = [...(p.tokenLog || []), { id: uid(), amount: -amount, reason: `Sent to ${targetName}`, createdAt: new Date().toISOString() }].slice(-100);
    });

    const device = getDeviceRaw();
    if (device.githubToken && device.githubGistId) {
      const freshTarget = await Sync.fetchProfileFresh(targetName);
      const profiles = getAllProfilesRaw();
      const base = freshTarget || profiles[targetName];
      if (!base) return { ok: false, message: 'Could not reach that profile — try again.' };
      base.tokens = (base.tokens || 0) + amount;
      base.tokenLog = [...(base.tokenLog || []), { id: uid(), amount, reason: `Received from ${activeName}`, createdAt: new Date().toISOString() }].slice(-100);
      profiles[targetName] = base;
      saveAllProfilesRaw(profiles);
      await Sync.pushSingleProfile(targetName);
    } else {
      const profiles = getAllProfilesRaw();
      if (!profiles[targetName]) return { ok: false, message: 'Profile not found.' };
      profiles[targetName].tokens = (profiles[targetName].tokens || 0) + amount;
      profiles[targetName].tokenLog = [...(profiles[targetName].tokenLog || []), { id: uid(), amount, reason: `Received from ${activeName}`, createdAt: new Date().toISOString() }].slice(-100);
      saveAllProfilesRaw(profiles);
    }
    notifyChanged();
    const settings = Storage.getSettings();
    Storage.addPost({ type: 'comment', authorProfile: activeName, authorColor: settings.tagColor, text: `sent ${amount} tokens to ${targetName} 🪙` });
    return { ok: true };
  },

  getActive() {
    migrateLegacyIfNeeded(); migrateThemeSettings();
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
  hasAnyProfile() { migrateLegacyIfNeeded(); migrateThemeSettings(); return Profiles.list().length > 0; },

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

  // Emergency recovery: paste raw JSON found in a GitHub Gist revision
  // (Settings > danger zone) after data was accidentally overwritten.
  // Accepts either the old combined-bundle shape or a single profile file.
  restoreFromRawBackup(jsonText) {
    try {
      const parsed = JSON.parse(jsonText);
      if (parsed.profiles) {
        const merged = { ...getAllProfilesRaw(), ...parsed.profiles };
        saveAllProfilesRaw(merged);
        if (parsed.shared) {
          const cleanedShared = { ...parsed.shared };
          delete cleanedShared.aiApiKey; delete cleanedShared.aiProvider; delete cleanedShared.aiEnabled;
          const mergedShared = { ...defaultShared(), ...loadJSON(DB.SHARED, {}), ...cleanedShared };
          saveJSON(DB.SHARED, mergedShared);
        }
        notifyChanged();
        return { ok: true, count: Object.keys(parsed.profiles).length };
      }
      if (parsed.name && parsed.data) {
        const profiles = getAllProfilesRaw();
        profiles[parsed.name] = parsed.data;
        saveAllProfilesRaw(profiles);
        notifyChanged();
        return { ok: true, count: 1 };
      }
      return { ok: false, message: "Didn't recognize that JSON — make sure you copied the whole file content." };
    } catch (e) {
      return { ok: false, message: 'Invalid JSON — check you copied the whole thing, including the outer { }.' };
    }
  },

  /* ---------------- TOKENS & SHOP ---------------- */
  getTokens() { return Profiles.getActive().data.tokens || 0; },
  addTokens(amount, reason) {
    Profiles.updateActive(p => {
      p.tokens = (p.tokens || 0) + amount;
      p.tokenLog = [...(p.tokenLog || []), { id: uid(), amount, reason, createdAt: new Date().toISOString() }].slice(-100);
    });
    notifyChanged();
  },
  getTokenLog() { return (Profiles.getActive().data.tokenLog || []).slice().reverse(); },

  /* ---------------- ROULETTE SPIN TOKENS ---------------- */
  // Grants today's free spin if it hasn't been claimed yet — call this
  // whenever the Shop/Roulette area is opened so it's always current.
  grantDailySpinIfNeeded() {
    const data = Profiles.getActive().data;
    const today = isoDate();
    if (data.lastFreeSpinGrantDate === today) return;
    Profiles.updateActive(p => {
      p.spinTokens = (p.spinTokens || 0) + 2;
      p.lastFreeSpinGrantDate = today;
    });
    notifyChanged();
  },
  getSpinTokens() { return Profiles.getActive().data.spinTokens || 0; },
  useSpinToken() {
    if (Storage.getSpinTokens() < 1) return false;
    Profiles.updateActive(p => { p.spinTokens = Math.max(0, (p.spinTokens || 0) - 1); });
    notifyChanged();
    return true;
  },
  addBonusSpin(reason) {
    Profiles.updateActive(p => { p.spinTokens = (p.spinTokens || 0) + 1; });
    notifyChanged();
  },

  getShop(profileName) { return getAllProfilesRaw()[profileName]?.shop || []; },
  saveShop(items) { Profiles.updateActive(p => p.shop = items); notifyChanged(); },

  // Spends tokens from the ACTIVE profile's own balance to redeem an item
  // from someone else's shop. Never writes to the shop owner's data — only
  // the redeemer's balance changes, plus a Home post announcing it so the
  // owner sees it and can follow through.
  redeemReward(ownerProfileName, itemId) {
    const activeName = Profiles.activeName();
    if (ownerProfileName === activeName) return { ok: false, message: "That's your own shop." };
    const item = Storage.getShop(ownerProfileName).find(i => i.id === itemId);
    if (!item) return { ok: false, message: 'Item not found.' };
    const balance = Storage.getTokens();
    if (balance < item.cost) return { ok: false, message: `Not enough tokens — need ${item.cost - balance} more.` };
    Profiles.updateActive(p => {
      p.tokens = (p.tokens || 0) - item.cost;
      p.tokenLog = [...(p.tokenLog || []), { id: uid(), amount: -item.cost, reason: `Redeemed: ${item.name}`, createdAt: new Date().toISOString() }].slice(-100);
    });
    const settings = Storage.getSettings();
    Storage.addPost({
      type: 'redemption',
      authorProfile: activeName,
      authorColor: settings.tagColor,
      text: `redeemed "${item.name}" from ${ownerProfileName}'s shop for ${item.cost} tokens 🎁`
    });
    return { ok: true };
  },

  /* ---------------- WELLNESS ---------------- */
  getWellness(profileName) {
    const p = getAllProfilesRaw()[profileName];
    return { waterLog: {}, library: [], studyLog: [], cardioLog: [], ...(p?.wellness || {}) };
  },

  hasRedeemedWaterToday() {
    return !!Storage.getWellness(Profiles.activeName()).waterLog[isoDate()];
  },
  redeemWater() {
    if (Storage.hasRedeemedWaterToday()) return { ok: false, message: 'Already redeemed today.' };
    Profiles.updateActive(p => {
      p.wellness = p.wellness || defaultProfile().wellness;
      p.wellness.waterLog[isoDate()] = true;
    });
    Storage.addTokens(10, 'Drank enough water');
    return { ok: true };
  },

  getLibrary(profileName) { return Storage.getWellness(profileName || Profiles.activeName()).library; },
  addBook(title, author, totalPages) {
    Profiles.updateActive(p => {
      p.wellness = p.wellness || defaultProfile().wellness;
      p.wellness.library = [...(p.wellness.library || []), {
        id: uid(), title, author, totalPages: Math.max(1, totalPages), pagesRead: 0, addedAt: new Date().toISOString()
      }];
    });
    notifyChanged();
  },
  removeBook(bookId) {
    Profiles.updateActive(p => { p.wellness.library = (p.wellness.library || []).filter(b => b.id !== bookId); });
    notifyChanged();
  },
  // Only awards tokens for the NEW pages since the last recorded value —
  // correcting a number downward doesn't claw tokens back.
  updateBookProgress(bookId, newPagesRead) {
    const book = Storage.getLibrary(Profiles.activeName()).find(b => b.id === bookId);
    if (!book) return { ok: false };
    const clamped = Math.max(0, Math.min(book.totalPages, Math.round(newPagesRead)));
    const delta = clamped - book.pagesRead;
    Profiles.updateActive(p => {
      const b = p.wellness.library.find(x => x.id === bookId);
      if (b) b.pagesRead = clamped;
    });
    if (delta > 0) Storage.addTokens(delta, `Read ${delta} page${delta === 1 ? '' : 's'} of "${book.title}"`);
    else notifyChanged();
    return { ok: true, delta: Math.max(0, delta) };
  },

  getStudyLog() { return Storage.getWellness(Profiles.activeName()).studyLog.slice().reverse(); },
  addStudySession(subject, minutes, recallText, bonus) {
    const base = Math.round(minutes * 0.5);
    Profiles.updateActive(p => {
      p.wellness = p.wellness || defaultProfile().wellness;
      p.wellness.studyLog = [...(p.wellness.studyLog || []), {
        id: uid(), subject, minutes, recallText: recallText || '', bonus: bonus || 0, date: isoDate(), createdAt: new Date().toISOString()
      }].slice(-200);
    });
    Storage.addTokens(base + (bonus || 0), `Studied ${subject} (${minutes}m)${bonus ? ` + ${bonus} recall bonus` : ''}`);
    return base + (bonus || 0);
  },

  getCardioLog() { return Storage.getWellness(Profiles.activeName()).cardioLog.slice().reverse(); },
  addCardioSession(type, minutes) {
    const coins = Math.round(minutes * 0.5);
    Profiles.updateActive(p => {
      p.wellness = p.wellness || defaultProfile().wellness;
      p.wellness.cardioLog = [...(p.wellness.cardioLog || []), {
        id: uid(), type, minutes, date: isoDate(), createdAt: new Date().toISOString()
      }].slice(-200);
    });
    Storage.addTokens(coins, `${type} for ${minutes}m`);
    return coins;
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

  // "Reasons Why" — a permanent shared keepsake list, distinct from the
  // scrolling Home feed where things eventually get buried. Append-only in
  // spirit (deletion of your own entries is allowed, nothing else is).
  getKeepsakes() {
    const shared = { ...defaultShared(), ...loadJSON(DB.SHARED, {}) };
    return (shared.keepsakes || []).slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },
  addKeepsake(text, authorProfile, authorColor) {
    const shared = { ...defaultShared(), ...loadJSON(DB.SHARED, {}) };
    shared.keepsakes = [...(shared.keepsakes || []), { id: uid(), text, authorProfile, authorColor, createdAt: new Date().toISOString() }];
    saveJSON(DB.SHARED, shared);
    notifyChanged();
  },
  removeKeepsake(id, requesterProfile) {
    const shared = { ...defaultShared(), ...loadJSON(DB.SHARED, {}) };
    const entry = (shared.keepsakes || []).find(k => k.id === id);
    if (!entry || entry.authorProfile !== requesterProfile) return false;
    shared.keepsakes = shared.keepsakes.filter(k => k.id !== id);
    saveJSON(DB.SHARED, shared);
    notifyChanged();
    return true;
  },

  getLastSeenPostsAt(profileName) { return getDeviceRaw().lastSeenPostsAtByProfile?.[profileName] || null; },
  setLastSeenPostsAt(profileName, iso) {
    const d = getDeviceRaw();
    d.lastSeenPostsAtByProfile = d.lastSeenPostsAtByProfile || {};
    d.lastSeenPostsAtByProfile[profileName] = iso;
    saveDeviceRaw(d);
  },
  // Separate from lastSeenPostsAt (which tracks opening Home) — this tracks
  // what's already triggered a push notification, so background polling
  // doesn't re-notify about the same post every time it checks.
  getLastNotifiedAt(profileName) { return getDeviceRaw().lastNotifiedAtByProfile?.[profileName] || null; },
  setLastNotifiedAt(profileName, iso) {
    const d = getDeviceRaw();
    d.lastNotifiedAtByProfile = d.lastNotifiedAtByProfile || {};
    d.lastNotifiedAtByProfile[profileName] = iso;
    saveDeviceRaw(d);
  },

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
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
