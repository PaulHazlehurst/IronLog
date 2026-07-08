/* ============================================================
   SYNC — cross-device sync via a private GitHub Gist
   ------------------------------------------------------------
   SAFETY MODEL: each profile lives in its OWN file inside the
   Gist (profile__<slug>.json). A device only ever WRITES the
   file for the profile it currently has active, plus a shared
   file (Home feed + special date, merged rather than
   overwritten). It never writes another profile's file. That
   means no device can ever stomp on someone else's profile data,
   even by accident.

   IMPORTANT: GitHub Gists are never truly private — "secret"
   just means unlisted, the content is still world-readable to
   anyone with the URL, and GitHub actively scans gist content
   (secret or public) for exposed API keys and reports them to
   the provider, who auto-revokes them. Because of that, API
   keys (Gemini, etc.) are NEVER stored in DB.SHARED and never
   touch this file — they live only in the device-local bucket
   in storage.js and are deliberately excluded from every sync
   payload below.
   ============================================================ */

const SHARED_FILENAME = 'shared.json';
const LEGACY_FILENAME = 'iron-log-data.json'; // old single-blob format, read-only for migration

function slugForProfile(name) {
  return 'profile__' + String(name).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) + '.json';
}

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

  async findExistingGist(token) {
    const res = await fetch('https://api.github.com/gists?per_page=100', { headers: Sync.headers(token) });
    if (!res.ok) throw new Error(`GitHub responded ${res.status} listing gists`);
    const gists = await res.json();
    return gists.find(g => g.files && (g.files[SHARED_FILENAME] || g.files[LEGACY_FILENAME] ||
      Object.keys(g.files).some(f => f.startsWith('profile__')))) || null;
  },

  async fetchGist(token, gistId) {
    const res = await fetch(`https://api.github.com/gists/${gistId}`, { headers: Sync.headers(token) });
    if (!res.ok) throw new Error(`GitHub responded ${res.status}`);
    return res.json();
  },

  mergePosts(remotePosts, localPosts) {
    const byId = new Map();
    [...(remotePosts || []), ...(localPosts || [])].forEach(p => {
      const existing = byId.get(p.id);
      if (!existing) { byId.set(p.id, { ...p }); return; }
      // Merge reactions from both copies of the same post.
      const merged = { ...existing };
      const allEmojis = new Set([...Object.keys(existing.reactions || {}), ...Object.keys(p.reactions || {})]);
      merged.reactions = {};
      allEmojis.forEach(emoji => {
        merged.reactions[emoji] = [...new Set([...(existing.reactions?.[emoji] || []), ...(p.reactions?.[emoji] || [])])];
      });
      byId.set(p.id, merged);
    });
    return [...byId.values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(-300);
  },

  async push() {
    const device = getDeviceRaw();
    if (!device.githubToken) return { ok: false, message: 'No GitHub token set.' };
    const activeName = Profiles.activeName();
    if (!activeName) return { ok: false, message: 'No active profile to push.' };
    if (Sync.isBusy) return { ok: false, message: 'Sync already in progress.' };
    Sync.isBusy = true;
    try {
      let gistId = device.githubGistId;
      if (!gistId) {
        const existing = await Sync.findExistingGist(device.githubToken);
        gistId = existing?.id || null;
      }

      // Merge shared.json (posts + special date) against whatever's live on
      // GitHub right now, rather than blindly overwriting it — this is what
      // stops two people's comments/reactions from clobbering each other.
      let remoteShared = null;
      let existingGist = null;
      if (gistId) {
        existingGist = await Sync.fetchGist(device.githubToken, gistId);
        const sharedContent = existingGist.files?.[SHARED_FILENAME]?.content;
        if (sharedContent) { try { remoteShared = JSON.parse(sharedContent); } catch (e) { /* ignore */ } }
      }
      const localShared = { ...defaultShared(), ...loadJSON(DB.SHARED, {}) };
      const mergedShared = {
        specialDate: localShared.specialDate || remoteShared?.specialDate || null,
        tokensPerWorkout: localShared.tokensPerWorkout ?? remoteShared?.tokensPerWorkout ?? 10,
        tokensPerPR: localShared.tokensPerPR ?? remoteShared?.tokensPerPR ?? 15,
        deletedProfiles: [...new Set([...(remoteShared?.deletedProfiles || []), ...(localShared.deletedProfiles || [])])],
        posts: Sync.mergePosts(remoteShared?.posts, localShared.posts)
      };
      saveJSON(DB.SHARED, mergedShared); // keep local in sync with the merge too

      const profiles = getAllProfilesRaw();
      const files = {
        [SHARED_FILENAME]: { content: JSON.stringify(mergedShared, null, 2) },
        [slugForProfile(activeName)]: { content: JSON.stringify({ name: activeName, data: profiles[activeName] }, null, 2) }
      };
      // Clean up the old single-blob file if it's still sitting in the gist —
      // it may contain a previously-synced AI key from before this was fixed.
      // Setting a file's content to null deletes it from the gist entirely.
      if (existingGist?.files?.[LEGACY_FILENAME]) files[LEGACY_FILENAME] = null;
      // Actually remove any deleted profile's file from the gist, so it can't
      // get resurrected by a future pull merging in a stale remote copy.
      mergedShared.deletedProfiles.forEach(deletedName => {
        const fname = slugForProfile(deletedName);
        if (existingGist?.files?.[fname]) files[fname] = null;
      });

      let res;
      if (gistId) {
        res = await fetch(`https://api.github.com/gists/${gistId}`, {
          method: 'PATCH', headers: Sync.headers(device.githubToken), body: JSON.stringify({ files })
        });
      } else {
        res = await fetch('https://api.github.com/gists', {
          method: 'POST', headers: Sync.headers(device.githubToken),
          body: JSON.stringify({ description: 'Iron Log workout data — managed by the app, safe to ignore.', public: false, files })
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

      const gist = await Sync.fetchGist(device.githubToken, gistId);
      const files = gist.files || {};
      const currentActive = Profiles.activeName();

      const profileFiles = Object.keys(files).filter(f => f.startsWith('profile__'));
      if (profileFiles.length > 0) {
        // Read shared.json first so we know which profiles have been deleted —
        // a tombstone wins over both local and remote copies of that profile.
        const sharedContent = files[SHARED_FILENAME]?.content;
        let parsedShared = null;
        if (sharedContent) {
          parsedShared = JSON.parse(sharedContent);
          delete parsedShared.aiApiKey; delete parsedShared.aiProvider; delete parsedShared.aiEnabled;
          saveJSON(DB.SHARED, parsedShared);
        }
        const tombstones = new Set(parsedShared?.deletedProfiles || []);

        // Current, multi-file format — start from local so any profile that
        // hasn't been pushed yet survives, then overlay the fresh remote
        // copy for every profile that does exist on GitHub.
        const merged = { ...getAllProfilesRaw() };
        profileFiles.forEach(fname => {
          try {
            const parsed = JSON.parse(files[fname].content);
            if (parsed?.name && parsed?.data) merged[parsed.name] = parsed.data;
          } catch (e) { console.error('Skipping unreadable profile file', fname, e); }
        });
        tombstones.forEach(name => delete merged[name]);
        // Never end up with zero profiles from a stale/conflicting tombstone.
        if (Object.keys(merged).length > 0) saveAllProfilesRaw(merged);
      } else if (files[LEGACY_FILENAME]) {
        // One-time read of the old single-blob format; next push migrates it
        // forward and deletes this file. Strip any AI key it may still hold —
        // that field should never live in shared/synced storage.
        const bundle = JSON.parse(files[LEGACY_FILENAME].content);
        if (bundle.profiles) saveAllProfilesRaw(bundle.profiles);
        if (bundle.shared) {
          delete bundle.shared.aiApiKey; delete bundle.shared.aiProvider; delete bundle.shared.aiEnabled;
          saveJSON(DB.SHARED, bundle.shared);
        }
      } else {
        return { ok: false, message: 'Found the sync gist but it had no readable data.' };
      }

      const d = getDeviceRaw();
      d.githubGistId = gistId;
      d.githubLastSync = new Date().toISOString();
      const profiles = getAllProfilesRaw();
      if (currentActive && profiles[currentActive]) d.activeProfile = currentActive;
      else d.activeProfile = Object.keys(profiles)[0] || '';
      saveDeviceRaw(d);

      return { ok: true, message: 'Pulled the latest shared data from GitHub.' };
    } catch (e) {
      console.error(e);
      return { ok: false, message: 'Pull failed — ' + e.message };
    } finally {
      Sync.isBusy = false;
    }
  },

  // Fetches one profile's file fresh from GitHub without touching anything
  // else — used by "push my plan to" so that action only ever reads/writes
  // the one profile it's actually targeting.
  async fetchProfileFresh(profileName) {
    const device = getDeviceRaw();
    if (!device.githubToken || !device.githubGistId) return null;
    try {
      const gist = await Sync.fetchGist(device.githubToken, device.githubGistId);
      const content = gist.files?.[slugForProfile(profileName)]?.content;
      if (!content) return null;
      const parsed = JSON.parse(content);
      return parsed?.data || null;
    } catch (e) {
      console.error(e);
      return null;
    }
  },

  async pushSingleProfile(profileName) {
    const device = getDeviceRaw();
    if (!device.githubToken || !device.githubGistId) return { ok: false };
    try {
      const profiles = getAllProfilesRaw();
      const res = await fetch(`https://api.github.com/gists/${device.githubGistId}`, {
        method: 'PATCH',
        headers: Sync.headers(device.githubToken),
        body: JSON.stringify({ files: { [slugForProfile(profileName)]: { content: JSON.stringify({ name: profileName, data: profiles[profileName] }, null, 2) } } })
      });
      return { ok: res.ok };
    } catch (e) {
      console.error(e);
      return { ok: false };
    }
  },

  // True if you've made local changes since the last successful push —
  // pulling now would silently overwrite them, so callers should push
  // (or at least warn) instead of pulling blind. Only meaningful for
  // reload/auto-sync — first-time connection uses a pull-first flow
  // regardless of this, see app.js.
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
    Sync.pushTimer = setTimeout(() => { Sync.push(); }, 1000);
  }
};

onDataChanged = () => Sync.scheduleAutoPush();
