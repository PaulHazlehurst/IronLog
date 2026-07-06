/* ============================================================
   STRENGTH STANDARDS / TIERS
   ------------------------------------------------------------
   Approximate bodyweight-ratio benchmarks synthesized from
   widely-published, publicly-available strength standard data
   (the same general figures repeated across most strength
   calculators). Treat tiers as a fun, motivating estimate, not
   a certified test.
   ============================================================ */

// multiplier of bodyweight required for each tier, by lift and gender
const STANDARDS = {
  male: {
    Squat:      { Beginner: 0.5, Novice: 0.9,  Intermediate: 1.4, Advanced: 1.8, Elite: 2.2 },
    Bench:      { Beginner: 0.4, Novice: 0.7,  Intermediate: 1.0, Advanced: 1.4, Elite: 1.8 },
    Deadlift:   { Beginner: 0.6, Novice: 1.1,  Intermediate: 1.6, Advanced: 2.1, Elite: 2.6 },
    OHP:        { Beginner: 0.25,Novice: 0.45, Intermediate: 0.65,Advanced: 0.9, Elite: 1.15},
    Row:        { Beginner: 0.4, Novice: 0.65, Intermediate: 0.9, Advanced: 1.2, Elite: 1.5 }
  },
  female: {
    Squat:      { Beginner: 0.35,Novice: 0.6,  Intermediate: 0.9, Advanced: 1.25,Elite: 1.6 },
    Bench:      { Beginner: 0.2, Novice: 0.35, Intermediate: 0.55,Advanced: 0.75,Elite: 1.0 },
    Deadlift:   { Beginner: 0.45,Novice: 0.75, Intermediate: 1.1, Advanced: 1.5, Elite: 1.9 },
    OHP:        { Beginner: 0.15,Novice: 0.25, Intermediate: 0.4, Advanced: 0.55,Elite: 0.7 },
    Row:        { Beginner: 0.25,Novice: 0.4,  Intermediate: 0.6, Advanced: 0.8, Elite: 1.0 }
  }
};

const TIER_ORDER = ['Untrained','Beginner','Novice','Intermediate','Advanced','Elite'];
const TIER_COLORS = {
  Untrained: '#6B7078', Beginner: '#A8703E', Novice: '#B8BCC2',
  Intermediate: '#3E8FB0', Advanced: '#C9A15A', Elite: '#7FD8D0'
};

const Standards = {
  tierFor(lift, gender, bodyweightLb, liftedLb) {
    const table = STANDARDS[gender]?.[lift];
    if (!table) return { tier: 'Untrained', ratio: 0, nextTier: null, toNext: null };
    const ratio = liftedLb / bodyweightLb;
    let tier = 'Untrained';
    for (const t of ['Beginner','Novice','Intermediate','Advanced','Elite']) {
      if (ratio >= table[t]) tier = t;
    }
    const idx = TIER_ORDER.indexOf(tier);
    const nextTier = TIER_ORDER[idx + 1];
    const toNext = nextTier && table[nextTier] ? Math.max(0, Math.round(table[nextTier] * bodyweightLb - liftedLb)) : null;
    return { tier, ratio, nextTier: (nextTier === 'Elite' && tier === 'Elite') ? null : nextTier, toNext };
  },

  allLifts() { return Object.keys(STANDARDS.male); }
};
