/* ============================================================
   SCHEDULER
   ------------------------------------------------------------
   Your plan is a weekly template (Monday = Push, Tuesday = rest,
   etc.) that repeats forever until you edit it. "Couldn't make
   it today" doesn't change that template — it just reshuffles
   THIS week only, sliding the missed session into the next open
   slot so you still get the same number of sessions in, and
   bumping everything after it back by one day.
   ============================================================ */

const Scheduler = {
  // Which day's session (by template day-name) actually falls on `dateStr`,
  // after applying this week's override (if any).
  effectiveDayFor(dateStr) {
    const plan = Storage.getPlan();
    const overrides = Storage.getWeekOverrides();
    const wkKey = mondayOf(dateStr);
    const weekOrder = overrides[wkKey]?.order || [...DAYS];
    const naturalIdx = DAYS.indexOf(weekdayName(dateStr));
    const templateDay = weekOrder[naturalIdx];
    return { templateDay, exercises: plan.days[templateDay] || [] };
  },

  markMissed(dateStr) {
    const wkKey = mondayOf(dateStr);
    const overrides = Storage.getWeekOverrides();
    const order = overrides[wkKey]?.order ? [...overrides[wkKey].order] : [...DAYS];
    const naturalIdx = DAYS.indexOf(weekdayName(dateStr));

    // Only reshuffle if there's a real session scheduled today and days left in the week.
    const plan = Storage.getPlan();
    if (naturalIdx === 6) return false; // Sunday, nowhere to push to
    const missedDay = order[naturalIdx];
    if (!plan.days[missedDay] || plan.days[missedDay].length === 0) return false;

    // Shift everything from tomorrow onward back one slot, push missed day to the end of the remaining week.
    const rest = order.slice(naturalIdx + 1);
    const newOrder = [...order.slice(0, naturalIdx), ...rest, missedDay].slice(0, 7);
    // pad if short
    while (newOrder.length < 7) newOrder.push(newOrder[newOrder.length - 1]);

    overrides[wkKey] = { order: newOrder };
    Storage.saveWeekOverrides(overrides);
    return true;
  },

  resetWeek(dateStr) {
    const wkKey = mondayOf(dateStr);
    const overrides = Storage.getWeekOverrides();
    delete overrides[wkKey];
    Storage.saveWeekOverrides(overrides);
  },

  weekAt(dateStr) {
    const wkStart = mondayOf(dateStr);
    const start = new Date(wkStart + 'T00:00:00');
    const out = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const ds = isoDate(d);
      out.push({ date: ds, ...Scheduler.effectiveDayFor(ds) });
    }
    return out;
  }
};
