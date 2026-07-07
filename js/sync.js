/* ============================================================
   SYNC — cross-device sync via a private GitHub Gist
   ------------------------------------------------------------
   Syncs ALL profiles plus the shared AI settings in one blob —
   so either person can switch profiles on their own device, and
   entering an AI key once makes it available to every profile on
   every device synced to the same Gist. The GitHub token/gist id
   themselves stay device-local (each device already needs its
   own copy to unlock the store in the first place).
   Last-write-wins: whichever device pushes most recently "wins"
   if two devices are edited at the same time without syncing in
   between — fine for a couple of trusted devices, not built for
   true simultaneous multi-editor conflict resolution.
   ============================================================ */

const GIST_FILENAME = 'iron-log-data.json';

const Sync = {
  pushTimer: null,
  isBusy: false,

  headers(token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    };
  },

  buildBundle() {
    return {
      version: 2,
      updatedAt: new Date().toISOString(),
      profiles: getAllProfilesRaw(),
      shared: { ...defaultShared(), ...loadJSON(DB.SHARED, {}) }
    };
  },

  async findExistingGist(token) {
    const res = await fetch('https://api.github.com/gists?per_page=100', { headers: Sync.headers(token) });
    if (!res.ok) throw new Error(`GitHub responded ${res.status} listing gists`);
    const gists = await res.json();
    return gists.find(g => g.files && g.files[GIST_FILENAME]) || null;
  },

  async push() {
    const device = getDeviceRaw();
    if (!device.githubToken) return { ok: false, message: 'No GitHub token set.' };
    if (Sync.isBusy) return { ok: false, message: 'Sync already in progress.' };
    Sync.isBusy = true;
    try {
      const content = JSON.stringify(Sync.buildBundle(), null, 2);
      let gistId = device.githubGistId;
      if (!gistId) {
        const existing = await Sync.findExistingGist(device.githubToken);
        gistId = existing?.id || null;
      }
      let res;
      if (gistId) {
        res = await fetch(`https://api.github.com/gists/${gistId}`, {
          method: 'PATCH',
          headers: Sync.headers(device.githubToken),
          body: JSON.stringify({ files: { [GIST_FILENAME]: { content } } })
        });
      } else {
        res = await fetch('https://api.github.com/gists', {
          method: 'POST',
          headers: Sync.headers(device.githubToken),
          body: JSON.stringify({
            description: 'Iron Log workout data — managed by the app, safe to ignore.',
            public: false,
            files: { [GIST_FILENAME]: { content } }
          })
        });
      }
      if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
      const data = await res.json();
      const d = getDeviceRaw();
      d.githubGistId = data.id;
      d.githubLastSync = new Date().toISOString();
      saveDeviceRaw(d);
      return { ok: true, message: 'Pushed to GitHub.' };
    } catch (e) {
      console.error(e);
      return { ok: false, message: 'Push failed — ' + e.message };
    } finally {
      Sync.isBusy = false;
    }
  },

  async pull() {
    const device = getDeviceRaw();
    if (!device.githubToken) return { ok: false, message: 'No GitHub token set.' };
    if (Sync.isBusy) return { ok: false, message: 'Sync already in progress.' };
    Sync.isBusy = true;
    try {
      let gistId = device.githubGistId;
      if (!gistId) {
        const existing = await Sync.findExistingGist(device.githubToken);
        gistId = existing?.id || null;
      }
      if (!gistId) return { ok: false, message: 'No sync data found on GitHub yet — push from your other device first.' };

      const res = await fetch(`https://api.github.com/gists/${gistId}`, { headers: Sync.headers(device.githubToken) });
      if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
      const data = await res.json();
      const content = data.files?.[GIST_FILENAME]?.content;
      if (!content) return { ok: false, message: 'Found the sync gist but it was empty.' };
      const bundle = JSON.parse(content);

      const currentActive = Profiles.activeName();
      if (bundle.profiles) saveAllProfilesRaw(bundle.profiles);
      if (bundle.shared) saveJSON(DB.SHARED, bundle.shared);

      const d = getDeviceRaw();
      d.githubGistId = gistId;
      d.githubLastSync = new Date().toISOString();
      // Keep this device on the same profile if it still exists after pulling.
      if (currentActive && bundle.profiles && bundle.profiles[currentActive]) d.activeProfile = currentActive;
      else if (bundle.profiles) d.activeProfile = Object.keys(bundle.profiles)[0] || '';
      saveDeviceRaw(d);

      return { ok: true, message: `Pulled from GitHub (saved ${bundle.updatedAt ? new Date(bundle.updatedAt).toLocaleString() : 'earlier'}).` };
    } catch (e) {
      console.error(e);
      return { ok: false, message: 'Pull failed — ' + e.message };
    } finally {
      Sync.isBusy = false;
    }
  },

  // True if you've made local changes since the last successful push —
  // pulling now would silently overwrite them, so callers should push
  // (or at least warn) instead of pulling blind.
  hasPendingLocalChanges() {
    const device = getDeviceRaw();
    const lastChange = getLastLocalChangeAt();
    if (!lastChange) return false;
    if (!device.githubLastSync) return true;
    return new Date(lastChange) > new Date(device.githubLastSync);
  },

  // Called whenever local data changes; waits a couple seconds in case more
  // changes are coming (e.g. adding several sets), then pushes once.
  scheduleAutoPush() {
    const device = getDeviceRaw();
    if (!device.githubToken) return;
    clearTimeout(Sync.pushTimer);
    Sync.pushTimer = setTimeout(() => { Sync.push(); }, 2000);
  }
};

onDataChanged = () => Sync.scheduleAutoPush();
