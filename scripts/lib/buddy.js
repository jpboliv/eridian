const WINDOWS = {
  celebrating: 60_000,
  alarmed: 30_000,
  reacting: 20_000,
  working: 15_000,
  sleep_after: 600_000,
};

const QUIPS = {
  celebrating: ['good good good!', 'amaze!', '♪ happy happy ♪'],
  alarmed: ['bad bad bad.', 'not good.', 'I concern.'],
  working: ['I fix.', 'I observe.', 'I engineer.'],
  humming: ['♫'],
  reacting: {
    question: 'hmm. I answer, question?',
    bugfix: 'bad bad. I fix.',
    build: 'I make.',
    other: 'I listen.',
  },
};

function within(ts, nowMs, windowMs) {
  if (!ts) return false;
  const t = Date.parse(ts);
  return Number.isFinite(t) && nowMs - t >= 0 && nowMs - t <= windowMs;
}

function deriveMood(buddy = {}, nowMs) {
  if (within(buddy.milestoneAt, nowMs, WINDOWS.celebrating)) return 'celebrating';
  if (within(buddy.lastErrorAt, nowMs, WINDOWS.alarmed)) return 'alarmed';
  if (within(buddy.lastPromptAt, nowMs, WINDOWS.reacting)) return 'reacting';
  if (within(buddy.lastToolAt, nowMs, WINDOWS.working)) return 'working';

  const activity = [buddy.lastToolAt, buddy.lastPromptAt]
    .map((ts) => Date.parse(ts))
    .filter(Number.isFinite);
  if (activity.length && nowMs - Math.max(...activity) > WINDOWS.sleep_after) {
    return 'sleeping';
  }
  return 'humming';
}

// Eyeless, book-accurate: Eridians have no eyes, so Rocky is pure carapace.
// Mini is a one-cell wedge; tall is a Clawd-sized dome with five legs whose
// end ticks are ▘ so they touch the filled halves of the ▐/▌ body edges.
const MINI = {
  step: ['▟█▙', '▄█▄'],
  alarmed: '▛█▜',
  sleeping: '▄▄▄ zzz',
};
const TALL = {
  dome: ' ▄█████▄ ',
  domeParty: '♪▄█████▄♪',
  body: '▐███████▌',
  // gait: stance (all five down) ↔ middle pair lifted; end legs stay
  // anchored so Rocky never floats
  legs: [' ▘ ▘▘ ▝ ▘', ' ▘  ▘   ▘'],
  legsTucked: ' ▄ ▄▄ ▄ ▄',
};

function pick(pool, nowMs) {
  return pool[Math.floor(nowMs / 10_000) % pool.length];
}

// legs step every 2s; twice as fast while working
function gaitTick(mood, nowMs) {
  const tick = mood === 'working' ? 1000 : 2000;
  return Math.floor(nowMs / tick) % 2;
}

function quipFor(mood, buddy, nowMs) {
  if (mood === 'sleeping') return '';
  if (mood === 'reacting') {
    return QUIPS.reacting[buddy.promptClass] || QUIPS.reacting.other;
  }
  return pick(QUIPS[mood], nowMs);
}

function renderBuddy(buddy = {}, nowMs) {
  const mood = deriveMood(buddy, nowMs);
  const step = MINI.step[gaitTick(mood, nowMs)];

  if (mood === 'sleeping') return { art: MINI.sleeping, quip: '' };
  if (mood === 'alarmed') {
    return { art: MINI.alarmed, quip: quipFor(mood, buddy, nowMs) };
  }
  if (mood === 'celebrating') {
    return { art: `♪ ${step} ♪`, quip: quipFor(mood, buddy, nowMs) };
  }
  return { art: step, quip: quipFor(mood, buddy, nowMs) };
}

function renderTall(buddy = {}, nowMs) {
  const mood = deriveMood(buddy, nowMs);
  const legs = TALL.legs[gaitTick(mood, nowMs)];

  if (mood === 'sleeping') {
    return { rows: [TALL.dome, TALL.body, TALL.legsTucked], quip: 'zzz' };
  }
  const dome = mood === 'celebrating' ? TALL.domeParty : TALL.dome;
  return { rows: [dome, TALL.body, legs], quip: quipFor(mood, buddy, nowMs) };
}

module.exports = { deriveMood, renderBuddy, renderTall };
