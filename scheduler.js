/* ============================================================
   RECOVERY MODEL
   ------------------------------------------------------------
   Rough, practical heuristic — not a lab measurement. Baseline
   recovery windows reflect the general pattern seen across
   recovery/soreness research: smaller, less-taxed muscles come
   back fastest, large muscle groups hit with heavy compound
   work take longest. The window then stretches based on how
   much volume/intensity you actually did.
   ============================================================ */

const MUSCLES = ['Chest','Back','Shoulders','Biceps','Triceps','Quads','Hamstrings','Glutes','Calves','Abs'];

const BASE_RECOVERY_HOURS = {
  Chest: 48, Back: 60, Shoulders: 48, Biceps: 30, Triceps: 30,
  Quads: 72, Hamstrings: 66, Glutes: 66, Calves: 36, Abs: 30
};

const Recovery = {
  // volumeLoad: rough estimate of sets * (avg rpe / 10) for a session
  sessionStrain(sets) {
    if (!sets || sets.length === 0) return 0.5;
    const avgRpe = sets.reduce((a, s) => a + (Number(s.rpe) || 8), 0) / sets.length;
    const strain = sets.length * (avgRpe / 10);
    return strain;
  },

  // Returns 0-100 (100 = fully recovered / ready to train again)
  percentFor(muscle, logs, now = new Date()) {
    const relevant = logs
      .flatMap(l => (l.exercises || []).filter(e => e.muscle === muscle).map(e => ({ date: l.date, sets: e.sets })))
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (relevant.length === 0) return 100;

    const lastSession = relevant[relevant.length - 1];
    const hoursSince = (now - new Date(lastSession.date + 'T12:00:00')) / (3600 * 1000);
    const strain = Recovery.sessionStrain(lastSession.sets);
    const base = BASE_RECOVERY_HOURS[muscle] || 48;
    // Higher strain stretches the recovery window, up to +60%
    const adjustedWindow = base * (1 + Math.min(strain / 10, 0.6));

    const pct = Math.round(Math.min(100, (hoursSince / adjustedWindow) * 100));
    return Math.max(0, pct);
  },

  allPercents(logs, now = new Date()) {
    const out = {};
    MUSCLES.forEach(m => { out[m] = Recovery.percentFor(m, logs, now); });
    return out;
  },

  statusLabel(pct) {
    if (pct >= 100) return 'Ready';
    if (pct >= 70) return 'Almost ready';
    if (pct >= 40) return 'Recovering';
    return 'Fresh from training';
  },

  colorFor(pct) {
    // red -> amber -> green as pct climbs
    if (pct >= 100) return 'var(--success)';
    if (pct >= 70) return '#8FBF6B';
    if (pct >= 40) return 'var(--amber)';
    return 'var(--accent)';
  }
};
