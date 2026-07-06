/* ============================================================
   SYNC — cross-device sync via a private GitHub Gist
   ------------------------------------------------------------
   Your data (plan, logs, cycle settings — never your API keys)
   is written to a private Gist on your own GitHub account. Any
   device that has your token can find that same Gist and pull
   the latest copy. This is last-write-wins: whichever device
   pushes most recently "wins" if two devices are edited at the
   same time without syncing in between — fine for a single
   person using their own devices, not built for simultaneous
   multi-user editing.
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
    const s = Storage.getSettings();
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      plan: Storage.getPlan(),
      logs: Storage.getLogs(),
      cycle: Storage.getCycle(),
      weekOverrides: Storage.getWeekOverrides(),
      // Never sync personal API keys or the token itself.
      settings: { ...s, aiApiKey: '', githubToken: '' }
    };
  },

  async findExistingGist(token) {
    const res = await fetch('https://api.github.com/gists?per_page=100', { headers: Sync.headers(token) });
    if (!res.ok) throw new Error(`GitHub responded ${res.status} listing gists`);
    const gists = await res.json();
    return gists.find(g => g.files && g.files[GIST_FILENAME]) || null;
  },

  async push() {
    const s = Storage.getSettings();
    if (!s.githubToken) return { ok: false, message: 'No GitHub token set.' };
    if (Sync.isBusy) return { ok: false, message: 'Sync already in progress.' };
    Sync.isBusy = true;
    try {
      const content = JSON.stringify(Sync.buildBundle(), null, 2);
      let gistId = s.githubGistId;
      if (!gistId) {
        const existing = await Sync.findExistingGist(s.githubToken);
        gistId = existing?.id || null;
      }
      let res;
      if (gistId) {
        res = await fetch(`https://api.github.com/gists/${gistId}`, {
          method: 'PATCH',
          headers: Sync.headers(s.githubToken),
          body: JSON.stringify({ files: { [GIST_FILENAME]: { content } } })
        });
      } else {
        res = await fetch('https://api.github.com/gists', {
          method: 'POST',
          headers: Sync.headers(s.githubToken),
          body: JSON.stringify({
            description: 'Iron Log workout data — managed by the app, safe to ignore.',
            public: false,
            files: { [GIST_FILENAME]: { content } }
          })
        });
      }
      if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
      const data = await res.json();
      const cur = Storage.getSettings();
      cur.githubGistId = data.id;
      cur.githubLastSync = new Date().toISOString();
      Storage.saveSettingsSilent(cur);
      return { ok: true, message: 'Pushed to GitHub.' };
    } catch (e) {
      console.error(e);
      return { ok: false, message: 'Push failed — ' + e.message };
    } finally {
      Sync.isBusy = false;
    }
  },

  async pull() {
    const s = Storage.getSettings();
    if (!s.githubToken) return { ok: false, message: 'No GitHub token set.' };
    if (Sync.isBusy) return { ok: false, message: 'Sync already in progress.' };
    Sync.isBusy = true;
    try {
      let gistId = s.githubGistId;
      if (!gistId) {
        const existing = await Sync.findExistingGist(s.githubToken);
        gistId = existing?.id || null;
      }
      if (!gistId) return { ok: false, message: 'No sync data found on GitHub yet — push from your other device first.' };

      const res = await fetch(`https://api.github.com/gists/${gistId}`, { headers: Sync.headers(s.githubToken) });
      if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
      const data = await res.json();
      const content = data.files?.[GIST_FILENAME]?.content;
      if (!content) return { ok: false, message: 'Found the sync gist but it was empty.' };
      const bundle = JSON.parse(content);

      if (bundle.plan) Storage.savePlan(bundle.plan);
      if (bundle.logs) Storage.saveLogs(bundle.logs);
      if (bundle.cycle) Storage.saveCycle(bundle.cycle);
      if (bundle.weekOverrides) Storage.saveWeekOverrides(bundle.weekOverrides);

      const cur = Storage.getSettings();
      const merged = { ...cur, ...bundle.settings, aiApiKey: cur.aiApiKey, githubToken: cur.githubToken, githubGistId: gistId, githubLastSync: new Date().toISOString() };
      Storage.saveSettingsSilent(merged);

      return { ok: true, message: `Pulled from GitHub (saved ${bundle.updatedAt ? new Date(bundle.updatedAt).toLocaleString() : 'earlier'}).` };
    } catch (e) {
      console.error(e);
      return { ok: false, message: 'Pull failed — ' + e.message };
    } finally {
      Sync.isBusy = false;
    }
  },

  // Called whenever local data changes; waits a few seconds in case more
  // changes are coming (e.g. adding several sets), then pushes once.
  scheduleAutoPush() {
    const s = Storage.getSettings();
    if (!s.githubToken) return;
    clearTimeout(Sync.pushTimer);
    Sync.pushTimer = setTimeout(() => { Sync.push(); }, 4000);
  }
};

onDataChanged = () => Sync.scheduleAutoPush();
