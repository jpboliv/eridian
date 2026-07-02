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

function frame(eyes, armsAlt) {
  return armsAlt ? `╲╱[${eyes}]╲╱` : `╱╲[${eyes}]╱╲`;
}

function pick(pool, nowMs) {
  return pool[Math.floor(nowMs / 10_000) % pool.length];
}

function renderBuddy(buddy = {}, nowMs) {
  const mood = deriveMood(buddy, nowMs);
  const blink = Math.floor(nowMs / 1000) % 7 === 0;
  const armsAlt = Math.floor(nowMs / 2000) % 2 === 1;

  let art;
  let quip;
  if (mood === 'sleeping') {
    art = `${frame('-ᴗ-', false)} zzz`;
    quip = '';
  } else if (mood === 'alarmed') {
    art = frame('⊙_⊙', armsAlt);
    quip = pick(QUIPS.alarmed, nowMs);
  } else if (mood === 'celebrating') {
    art = `♪ ${frame(blink ? '-ᴗ-' : '•ᴗ•', armsAlt)} ♪`;
    quip = pick(QUIPS.celebrating, nowMs);
  } else if (mood === 'reacting') {
    art = frame(blink ? '-ᴗ-' : '•ᴗ•', armsAlt);
    quip = QUIPS.reacting[buddy.promptClass] || QUIPS.reacting.other;
  } else if (mood === 'working') {
    art = frame(blink ? '-ᴗ-' : '•ᴗ•', armsAlt);
    quip = pick(QUIPS.working, nowMs);
  } else {
    art = frame(blink ? '-ᴗ-' : '•ᴗ•', armsAlt);
    quip = pick(QUIPS.humming, nowMs);
  }
  return { art, quip };
}

module.exports = { deriveMood, renderBuddy };
