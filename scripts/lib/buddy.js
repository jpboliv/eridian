const { MINI, TALL } = require('./buddy-art');

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

// Per mood: which arm poses cycle, how fast, and special flags.
// still = frozen figure; party = ♪ dome; tucked = asleep; fastGait = 1s legs.
const ANIM = {
  humming: { arms: ['down', 'up'], armsTick: 2000 },
  reacting: { arms: ['leftWave', 'rightWave'], armsTick: 600 },
  working: { arms: ['up', 'wide'], armsTick: 1000, fastGait: true },
  celebrating: { arms: ['celebrate', 'five'], armsTick: 500, party: true },
  alarmed: { arms: ['up'], still: true },
  sleeping: { tucked: true },
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

function pick(pool, nowMs) {
  return pool[Math.floor(nowMs / 10_000) % pool.length];
}

// arms drift through the mood's poses; a single/still pose never changes
function armFrame(anim, nowMs) {
  const poses = anim.arms;
  if (anim.still || poses.length === 1) return poses[0];
  return poses[Math.floor(nowMs / anim.armsTick) % poses.length];
}

// legs step every 2s; twice as fast while working; frozen when still
function gaitIndex(anim, nowMs) {
  if (anim.still) return 0;
  const tick = anim.fastGait ? 1000 : 2000;
  return Math.floor(nowMs / tick) % 2;
}

function quipFor(mood, buddy, nowMs) {
  if (mood === 'sleeping') return 'zzz';
  if (mood === 'reacting') {
    return QUIPS.reacting[buddy.promptClass] || QUIPS.reacting.other;
  }
  return pick(QUIPS[mood], nowMs);
}

function renderBuddy(buddy = {}, nowMs) {
  const mood = deriveMood(buddy, nowMs);
  const anim = ANIM[mood];
  const quip = quipFor(mood, buddy, nowMs);
  if (anim.tucked) {
    return { rows: ['', MINI.dome, MINI.body, MINI.legsTucked], quip };
  }
  const arms = MINI.arms[armFrame(anim, nowMs)];
  const dome = anim.party ? MINI.domeParty : MINI.dome;
  const legs = MINI.legs[gaitIndex(anim, nowMs)];
  return { rows: [arms, dome, MINI.body, legs], quip };
}

function renderTall(buddy = {}, nowMs) {
  const mood = deriveMood(buddy, nowMs);
  const anim = ANIM[mood];
  const quip = quipFor(mood, buddy, nowMs);
  if (anim.tucked) {
    return { rows: ['', TALL.dome, TALL.body[0], TALL.body[1], TALL.legsTucked], quip };
  }
  const arms = TALL.arms[armFrame(anim, nowMs)];
  const dome = anim.party ? TALL.domeParty : TALL.dome;
  const legs = TALL.legs[gaitIndex(anim, nowMs)];
  return { rows: [arms, dome, TALL.body[0], TALL.body[1], legs], quip };
}

module.exports = { deriveMood, renderBuddy, renderTall };
