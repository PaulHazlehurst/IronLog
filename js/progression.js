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

    // Still building reps within the range — same weight, chase 1-2 more reps.
    return {
      weight: last.sets[0].weight,
      reps: Math.min(high, minReps + 1),
      sets: exercise.sets,
      note: 'Same weight — add a rep or two per set before the next jump in load.'
    };
  }
};
