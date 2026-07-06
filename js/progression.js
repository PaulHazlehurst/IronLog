/* ============================================================
   PROGRESSIVE OVERLOAD ENGINE
   ------------------------------------------------------------
   Built on well-established, broadly-agreed resistance training
   principles rather than any single study:
     - Double progression within a target rep range
     - RPE / RIR based autoregulation (how close to failure a
       set was, not just the numbers on the bar)
     - Periodized deload weeks to manage fatigue
     - Optional periodic "peak" week to retest a working max
   This is a rules engine, not a citation of specific papers —
   treat its output as a smart, adjustable default, not gospel.
   ============================================================ */

const Progression = {

  // Epley formula — a common, simple way to estimate a 1-rep max from a
  // higher-rep set. Rough by nature; treat it as a trend line, not a fact.
  estimateOneRM(weight, reps) {
    if (!weight || !reps) return 0;
    if (reps === 1) return weight;
    return Math.round(weight * (1 + reps / 30));
  },

  // Best top-set weight logged in an entry (used for trend charts / PRs).
  topSetOf(entry) {
    if (!entry?.sets?.length) return { weight: 0, reps: 0, oneRm: 0 };
    const best = entry.sets.reduce((a, s) => (s.weight > a.weight ? s : a), entry.sets[0]);
    return { weight: best.weight, reps: best.reps, oneRm: Progression.estimateOneRM(best.weight, best.reps) };
  },

  // Looks at the last 3 sessions for an exercise: if estimated 1RM hasn't
  // meaningfully improved and effort (RPE) hasn't dropped, that's a plateau.
  detectPlateau(recentLogEntries) {
    if (!recentLogEntries || recentLogEntries.length < 3) return null;
    const last3 = recentLogEntries.slice(-3);
    const oneRms = last3.map(e => Progression.topSetOf(e).oneRm);
    const improving = oneRms[2] > oneRms[0] * 1.01; // >1% up over 3 sessions
    const avgRpeLast = last3[2].sets?.length
      ? last3[2].sets.reduce((a, s) => a + (Number(s.rpe) || 8), 0) / last3[2].sets.length
      : 8;
    if (!improving && avgRpeLast >= 8) {
      return 'No real progress across your last 3 sessions here despite solid effort — a classic plateau. Consider an extra deload, swapping the exercise for a few weeks, or double-checking recovery/nutrition around this lift.';
    }
    return null;
  },

  // How much weight to add when an exercise "levels up", by category.
  incrementFor(exercise) {
    if (exercise.type === 'isolation') return exercise.unit === 'kg' ? 1.25 : 2.5;
    if (exercise.lowerBody) return exercise.unit === 'kg' ? 5 : 10;
    return exercise.unit === 'kg' ? 2.5 : 5;
  },

  // Determine which "week type" the upcoming week is: train / deload / peak
  weekType(cycle, weekNumber) {
    if (cycle.peakEvery && cycle.peakEvery > 0 && weekNumber % cycle.peakEvery === 0) {
      return 'peak';
    }
    if (cycle.deloadEvery && weekNumber % cycle.deloadEvery === 0) {
      return 'deload';
    }
    return 'train';
  },

  weekNumberFor(cycle, dateStr) {
    const start = new Date(cycle.startDate + 'T00:00:00');
    const now = new Date(mondayOf(dateStr) + 'T00:00:00');
    const diffWeeks = Math.round((now - start) / (7 * 24 * 3600 * 1000)) + 1;
    return Math.max(1, diffWeeks);
  },

  // Look at the most recent completed sets for this exercise and
  // decide the next prescription (weight / reps / sets / note).
  nextPrescription(exercise, recentLogEntries, weekTypeUpcoming) {
    const inc = Progression.incrementFor(exercise);
    const low = exercise.repLow, high = exercise.repHigh;

    // No history yet — just hand back the plan's starting point.
    if (!recentLogEntries || recentLogEntries.length === 0) {
      return {
        weight: exercise.currentWeight,
        reps: low,
        sets: exercise.sets,
        note: 'Starting point — log this session to start tracking progress.'
      };
    }

    const last = recentLogEntries[recentLogEntries.length - 1];
    const workingSets = last.sets || [];
    const avgRpe = workingSets.length
      ? workingSets.reduce((a, s) => a + (Number(s.rpe) || 8), 0) / workingSets.length
      : 8;
    const minReps = workingSets.length ? Math.min(...workingSets.map(s => Number(s.reps) || 0)) : low;
    const hitTopEverySet = workingSets.length > 0 && workingSets.every(s => Number(s.reps) >= high);
    const missedBottom = workingSets.length > 0 && minReps < low;

    // Upcoming deload: cut load and volume, cap effort.
    if (weekTypeUpcoming === 'deload') {
      return {
        weight: Math.round((last.sets?.[0]?.weight || exercise.currentWeight) * 0.85 / inc) * inc,
        reps: Math.max(low - 2, 5),
        sets: Math.max(1, Math.ceil(exercise.sets * 0.6)),
        note: 'Deload week — lighter load, lower volume. Stay well short of failure (RPE ≤ 6) so you come back fresh.'
      };
    }

    // Upcoming peak/test week: go heavier, lower reps, fewer sets.
    if (weekTypeUpcoming === 'peak') {
      const lastTopWeight = Math.max(...workingSets.map(s => Number(s.weight) || exercise.currentWeight));
      return {
        weight: Math.round((lastTopWeight * 1.05) / inc) * inc,
        reps: 3,
        sets: Math.min(exercise.sets, 3),
        note: 'Test week — work up to a strong top set of ~3 reps to gauge your current max. Leave 1 rep in reserve.'
      };
    }

    // RPE says this was too hard even though reps looked OK — hold or regress.
    if (avgRpe >= 9.5 || missedBottom) {
      return {
        weight: missedBottom ? Math.round((last.sets[0].weight * 0.92) / inc) * inc : last.sets[0].weight,
        reps: low,
        sets: exercise.sets,
        note: missedBottom
          ? 'Missed the bottom of the rep range — pulling weight back slightly to rebuild a clean base.'
          : 'That was maximal effort — repeat the weight and aim for a lower RPE before adding load.'
      };
    }

    // Hit the top of the range for every set with room to spare — level up.
    if (hitTopEverySet && avgRpe <= 8.5) {
      return {
        weight: last.sets[0].weight + inc,
        reps: low,
        sets: exercise.sets,
        note: `Hit ${high} reps across the board with reps in reserve — adding ${inc}${exercise.unit} and resetting to the bottom of your rep range.`
      };
    }

    // (warm-up ramp is generated separately — see Progression.warmupRamp below)

    // Still building reps within the range — same weight, chase 1-2 more reps.
    return {
      weight: last.sets[0].weight,
      reps: Math.min(high, minReps + 1),
      sets: exercise.sets,
      note: 'Same weight — add a rep or two per set before the next jump in load.'
    };
  },

  // A standard percentage-based warm-up ramp for compound lifts, so you're
  // not jumping straight from empty bar to working weight.
  warmupRamp(workingWeight, unit, increment) {
    if (!workingWeight) return [];
    const round = (w) => Math.round(w / increment) * increment;
    const steps = [
      { pct: 0.4, reps: 8 },
      { pct: 0.6, reps: 5 },
      { pct: 0.8, reps: 3 }
    ];
    return steps
      .map(s => ({ weight: round(workingWeight * s.pct), reps: s.reps }))
      .filter(s => s.weight > 0 && s.weight < workingWeight);
  },

  // Suggested rest, in seconds, based on the rep range — heavier/lower-rep
  // work needs more recovery between sets than higher-rep hypertrophy work.
  suggestedRestSeconds(repLow, exerciseType) {
    if (repLow <= 5) return exerciseType === 'compound' ? 210 : 150;
    if (repLow <= 8) return 120;
    if (repLow <= 12) return 90;
    return 60;
  }
};
