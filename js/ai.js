/* ============================================================
   AI ASSIST
   ------------------------------------------------------------
   Your API key lives only in this browser's localStorage. Every
   call goes straight from your device to Google's Gemini API —
   nothing passes through any server of mine. Google's free tier
   covers this kind of light, occasional use.
   Get a free key: https://aistudio.google.com/apikey
   If no key is set, everything still works via the curated tips
   below — no AI required.
   ============================================================ */

const FALLBACK_TIPS = {
  Chest: ['Lead with the elbows, not the hands — squeeze the chest together at the top rather than just locking out the arms.', 'Slow the lowering phase down; a controlled stretch under load recruits more fibers than a fast bounce off the chest.'],
  Back: ['Think "elbows to hips" on rows and pulldowns instead of just curling the weight up — it shifts the work off the arms.', 'Pause and squeeze the shoulder blades together for a beat at the top of every rep.'],
  Shoulders: ['Keep the reps a bit slower and lighter than you think you need — shoulders respond well to control, not ego load.', 'Lead laterals with the elbow, thinking about pouring water out of a jug, to keep tension on the side delt.'],
  Biceps: ['Keep elbows pinned to your sides; letting them drift forward turns curls into a shoulder exercise.', 'Add a one-second squeeze at the top of each rep to feel the peak contraction.'],
  Triceps: ['Keep the upper arm still and let the forearm do the moving — swinging the elbow steals tension from the triceps.', 'Full lockout matters here more than most muscles — that\'s where triceps get most of their work.'],
  Quads: ['Drive through the whole foot, not just the heel, and think about pushing the knees forward over the toes on squats.', 'Pause a beat at the bottom instead of bouncing out of the hole — it keeps tension on the quads instead of the tendons.'],
  Hamstrings: ['On hinges, think about pushing the hips back rather than bending the knees — that\'s what loads the hamstring.', 'Control the lowering portion of RDLs; hamstrings grow a lot from that eccentric stretch.'],
  Glutes: ['Squeeze the glutes hard at the top of hip thrusts and pause briefly — most people cut this rep short.', 'Point the toes slightly out and drive the knees out on squats to get the glutes more involved.'],
  Calves: ['Get a real stretch at the bottom of every rep — calves respond strongly to range of motion, not just weight.', 'Slow down the tempo; calves are used to fast, repetitive movement all day and need a different stimulus to grow.'],
  Abs: ['Focus on curling the ribcage toward the pelvis rather than just lifting the shoulders off the floor.', 'Exhale hard at the point of peak contraction — it helps you actually feel the muscle working instead of just moving the weight.']
};

const AI = {
  isConfigured() {
    const s = Storage.getSettings();
    return !!(s.aiEnabled && s.aiApiKey);
  },

  async callGemini(prompt) {
    const s = Storage.getSettings();
    const key = s.aiApiKey;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Gemini request failed (${res.status}): ${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    return text.trim();
  },

  async mindMuscleCue(exerciseName, muscle) {
    if (!AI.isConfigured()) {
      const pool = FALLBACK_TIPS[muscle] || ['Slow down the rep, focus on the target muscle, and keep tension on it through the full range of motion.'];
      return { text: pool[Math.floor(Math.random() * pool.length)], source: 'offline' };
    }
    try {
      const prompt = `In 2 short sentences, give a science-informed mind-muscle-connection cue and a technique tip for the exercise "${exerciseName}" (primary muscle: ${muscle}). Be specific and practical, no fluff, no disclaimers.`;
      const text = await AI.callGemini(prompt);
      return { text, source: 'ai' };
    } catch (e) {
      console.error(e);
      const pool = FALLBACK_TIPS[muscle] || ['Slow down the rep and keep tension on the target muscle through the full range of motion.'];
      return { text: pool[0] + ' (AI call failed — showing an offline tip instead.)', source: 'offline' };
    }
  },

  async reviewPlan(planSummary) {
    if (!AI.isConfigured()) {
      return { text: 'Turn on AI in Settings and add a free Gemini key for a written, prioritized summary on top of the checks above.', source: 'offline' };
    }
    try {
      const prompt = `You are an experienced, practical strength coach. Here is a lifter's weekly training plan and a list of automatically-detected flags:\n\n${planSummary}\n\nGive 3-5 concise, prioritized, practical suggestions for set/rep changes or restructuring, focused on the most important issues first. Plain language, no fluff, no disclaimers, under 150 words total.`;
      const text = await AI.callGemini(prompt);
      return { text, source: 'ai' };
    } catch (e) {
      console.error(e);
      return { text: 'AI review failed — the checks above still stand on their own.', source: 'offline' };
    }
  },

  async suggestExercise(muscle, equipment, avoid) {
    const fallbackMap = {
      Chest: 'Incline dumbbell press', Back: 'Chest-supported row', Shoulders: 'Seated dumbbell lateral raise',
      Biceps: 'Incline dumbbell curl', Triceps: 'Overhead rope extension', Quads: 'Leg press',
      Hamstrings: 'Romanian deadlift', Glutes: 'Barbell hip thrust', Calves: 'Standing calf raise', Abs: 'Cable crunch'
    };
    if (!AI.isConfigured()) {
      return { text: `${fallbackMap[muscle] || 'Compound movement for ' + muscle} — a solid default for ${muscle}. Turn on AI in Settings for tailored suggestions based on your equipment.`, source: 'offline' };
    }
    try {
      const prompt = `Suggest ONE specific exercise for training the ${muscle}, given available equipment: ${equipment || 'standard gym'}. ${avoid ? `Avoid: ${avoid}.` : ''} Reply in 2 short sentences: the exercise name, then one line on why it's a good current choice for hypertrophy.`;
      const text = await AI.callGemini(prompt);
      return { text, source: 'ai' };
    } catch (e) {
      console.error(e);
      return { text: `${fallbackMap[muscle] || 'Compound movement for ' + muscle} (AI call failed — showing an offline suggestion instead.)`, source: 'offline' };
    }
  }
};
