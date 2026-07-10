/* ============================================================
   PLAN REVIEW
   ------------------------------------------------------------
   Deterministic, rule-based checks over the whole weekly plan —
   works with AI off. Looks for: volume outside general effective
   ranges, muscle groups with no direct work, back-to-back
   scheduling that doesn't respect typical recovery windows, rep
   ranges that never vary, repeated exercise names, and any
   single day that piles up a lot of sets for one muscle.
   ============================================================ */

const PlanReview = {
  analyze(plan) {
    const days = plan.days;
    const findings = { volume: [], recovery: [], variety: [], gaps: [], dayOverload: [], duplicates: [] };

    // Volume landmarks
    const weeklySets = Volume.weeklySetsByMuscle(plan);
    MUSCLES.forEach(m => {
      const sets = weeklySets[m] || 0;
      const lm = VOLUME_LANDMARKS[m];
      if (sets === 0) {
        findings.gaps.push(`${m}: no direct work scheduled this week.`);
      } else if (sets < lm.mev) {
        findings.volume.push(`${m}: only ${sets} set${sets === 1 ? '' : 's'}/week — below the roughly ${lm.mev}-set minimum most people need to keep making progress.`);
      } else if (sets > lm.mrv) {
        findings.volume.push(`${m}: ${sets} sets/week is above the ~${lm.mrv}-set range most people can recover from well — consider trimming a set or two per exercise.`);
      }
    });

    // Recovery conflicts: same muscle trained on days too close together
    const muscleDayIndices = {};
    DAYS.forEach((day, idx) => {
      (days[day] || []).forEach(ex => {
        muscleDayIndices[ex.muscle] = muscleDayIndices[ex.muscle] || [];
        muscleDayIndices[ex.muscle].push(idx);
      });
    });
    Object.entries(muscleDayIndices).forEach(([muscle, idxs]) => {
      const sorted = [...new Set(idxs)].sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        const gapDays = sorted[i] - sorted[i - 1];
        const gapHours = gapDays * 24;
        const needed = BASE_RECOVERY_HOURS[muscle] || 48;
        if (gapHours < needed) {
          findings.recovery.push(`${muscle}: trained ${DAYS[sorted[i - 1]]} and ${DAYS[sorted[i]]} — only ~${gapHours}h apart, while ${muscle} typically wants closer to ${needed}h.`);
        }
      }
    });

    // Repeated exercise names across the week
    const nameDays = {};
    DAYS.forEach(day => (days[day] || []).forEach(ex => {
      const key = ex.name.trim().toLowerCase();
      nameDays[key] = nameDays[key] || { days: new Set(), display: ex.name };
      nameDays[key].days.add(day);
    }));
    Object.values(nameDays).forEach(({ days: daySet, display }) => {
      if (daySet.size >= 3) {
        findings.duplicates.push(`"${display}" appears on ${daySet.size} different days — fine if that's deliberate high frequency, but worth double-checking it's not just leftover from plan-building.`);
      }
    });

    // Rep-range variety per muscle
    const muscleReps = {};
    DAYS.forEach(day => (days[day] || []).forEach(ex => {
      muscleReps[ex.muscle] = muscleReps[ex.muscle] || [];
      muscleReps[ex.muscle].push([ex.repLow, ex.repHigh]);
    }));
    Object.entries(muscleReps).forEach(([muscle, ranges]) => {
      if (ranges.length >= 2) {
        const [lo0, hi0] = ranges[0];
        const allSimilar = ranges.every(([lo, hi]) => Math.abs(lo - lo0) <= 2 && Math.abs(hi - hi0) <= 2);
        if (allSimilar) {
          findings.variety.push(`${muscle}: every exercise sits in roughly the same ${lo0}-${hi0} rep range — spreading across a broader mix (a heavier low-rep set, a higher-rep finisher) can add a different stimulus.`);
        }
      }
    });

    // Same-day volume overload for a single muscle
    DAYS.forEach(day => {
      const perMuscle = {};
      (days[day] || []).forEach(ex => { perMuscle[ex.muscle] = (perMuscle[ex.muscle] || 0) + Number(ex.sets || 0); });
      Object.entries(perMuscle).forEach(([muscle, sets]) => {
        if (sets > 12) {
          findings.dayOverload.push(`${day}: ${sets} sets for ${muscle} in one session — beyond roughly 10-12 sets per muscle per session, extra volume tends to add fatigue faster than growth. Consider splitting some of it onto another day.`);
        }
      });
    });

    return findings;
  },

  hasAnyFindings(f) {
    return Object.values(f).some(arr => arr.length > 0);
  },

  renderHTML(findings) {
    const section = (title, items, emptyMsg) => `
      <div style="margin-bottom:14px;">
        <div style="font-family:var(--font-display);text-transform:uppercase;font-size:12px;color:var(--text-dim);margin-bottom:6px;letter-spacing:0.04em;">${title}</div>
        ${items.length
          ? `<ul style="margin:0;padding-left:18px;font-size:13px;">${items.map(i => `<li style="margin-bottom:4px;">${i}</li>`).join('')}</ul>`
          : `<div class="helper-text">${emptyMsg}</div>`}
      </div>`;
    return [
      section('Volume flags', findings.volume, 'All muscle groups fall within a reasonable weekly set range.'),
      section('Missing muscle groups', findings.gaps, 'Every tracked muscle group has at least some direct work.'),
      section('Recovery conflicts', findings.recovery, 'No back-to-back scheduling conflicts detected.'),
      section('Rep-range variety', findings.variety, 'Rep ranges look reasonably varied across your exercises.'),
      section('Same-day volume', findings.dayOverload, 'No single day looks overloaded for one muscle.'),
      section('Repeated exercises', findings.duplicates, 'No exercise repeats more than twice a week.')
    ].join('');
  },

  // Compact text summary, used as context for the AI narrative.
  toPromptSummary(plan, findings) {
    const lines = [];
    DAYS.forEach(day => {
      const list = plan.days[day] || [];
      if (list.length === 0) return;
      lines.push(`${day}: ` + list.map(ex => `${ex.name} (${ex.muscle}, ${ex.sets}x${ex.repLow}-${ex.repHigh})`).join('; '));
    });
    const flagLines = Object.values(findings).flat();
    return `Weekly plan:\n${lines.join('\n')}\n\nAutomatically detected flags:\n${flagLines.length ? flagLines.join('\n') : 'None.'}`;
  },

  // "Are all my exercises aligned?" — catches two real, related problems:
  // (1) the exact same exercise name tagged with different muscle/type
  //     across days (a data mistake), and (2) near-identical names that
  //     differ only by a typo, which matters a lot now that progression
  //     and PRs are pooled by exact name match — a misspelled duplicate
  //     silently starts its own separate, empty history track.
  checkAlignment(plan) {
    const all = [];
    Object.entries(plan.days).forEach(([day, list]) => (list || []).forEach(ex => all.push({ ...ex, day })));
    const findings = [];
    if (all.length < 2) return findings;

    const groups = {};
    all.forEach(ex => {
      const key = ex.name.trim().toLowerCase();
      groups[key] = groups[key] || [];
      groups[key].push(ex);
    });

    Object.values(groups).forEach(group => {
      if (group.length < 2) return;
      const muscles = new Set(group.map(e => e.muscle));
      const types = new Set(group.map(e => e.type));
      const days = group.map(e => e.day).join(', ');
      if (muscles.size > 1) {
        findings.push(`"${group[0].name}" is tagged as different muscle groups on different days (${[...muscles].join(' vs ')}) — ${days}. Pick one so progress tracks correctly.`);
      }
      if (types.size > 1) {
        findings.push(`"${group[0].name}" is marked both compound and isolation depending on the day (${days}) — worth making it consistent.`);
      }
    });

    const keys = Object.keys(groups);
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const dist = levenshteinDistance(keys[i], keys[j]);
        const maxLen = Math.max(keys[i].length, keys[j].length);
        if (dist > 0 && dist <= 2 && maxLen > 4) {
          findings.push(`"${groups[keys[i]][0].name}" and "${groups[keys[j]][0].name}" look like they might be the same exercise with a spelling difference — right now they're tracked as two completely separate exercises with separate progress histories.`);
        }
      }
    }

    return findings;
  }
};

function levenshteinDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}
