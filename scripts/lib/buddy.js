const { MINI } = require('./buddy-art');

const WINDOWS = {
  celebrating: 60_000,
  alarmed: 30_000,
  reacting: 20_000,
  working: 15_000,
  sleep_after: 600_000,
};

const QUIPS = {
  celebrating: ['good good good!', 'amaze!', '♫ happy happy ♫'],
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

// Per mood: which arm poses cycle, and special flags. Poses advance one
// step per statusline refresh (buddy.frame, bumped by statusline.js) —
// the host re-runs the statusline too rarely (~10s) for wall-clock ticks
// to ever be seen, so the frame counter is the only animation clock.
// still = frozen figure; tucked = asleep;
// dance = synced arms+legs+shift cycle (celebrating only).
const ANIM = {
  humming: { arms: ['down', 'up'] },
  reacting: { arms: ['leftWave', 'rightWave'] },
  working: { arms: ['up', 'wide'] },
  celebrating: { dance: true },
  alarmed: { arms: ['up'], still: true },
  sleeping: { tucked: true },
};

// celebrating: one synced 2-beat cycle (arm pose + leg frame + a 1-column
// shift of the whole figure) instead of independent arms/legs timers —
// reads as a dance step instead of a jitter.
const DANCE_BEATS = [
  { pose: 'celebrate', legIndex: 0, shift: 0 },
  { pose: 'five', legIndex: 1, shift: 1 },
];

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
function armFrame(anim, frame) {
  const poses = anim.arms;
  if (anim.still || poses.length === 1) return poses[0];
  return poses[frame % poses.length];
}

// legs alternate gait frames each refresh; frozen when still
function gaitIndex(anim, frame) {
  if (anim.still) return 0;
  return frame % 2;
}

function quipFor(mood, buddy, nowMs) {
  if (mood === 'sleeping') return 'zzz';
  if (mood === 'reacting') {
    return QUIPS.reacting[buddy.promptClass] || QUIPS.reacting.other;
  }
  return pick(QUIPS[mood], nowMs);
}

// overlays arm ticks onto the dome row; arm ink wins, dome shows through
// elsewhere. Never collides for any current pose (see buddy-art.test.js).
function merge(armStr, base) {
  const len = Math.max(armStr.length, base.length);
  let out = '';
  for (let i = 0; i < len; i++) {
    const a = armStr[i];
    out += a && a !== ' ' ? a : base[i] || ' ';
  }
  return out;
}

function renderBuddy(buddy = {}, nowMs) {
  const mood = deriveMood(buddy, nowMs);
  const anim = ANIM[mood];
  const quip = quipFor(mood, buddy, nowMs);
  const frame = buddy.frame || 0;

  if (anim.tucked) {
    return { rows: [MINI.dome, MINI.body, MINI.legsTucked], quip };
  }

  if (anim.dance) {
    const beat = DANCE_BEATS[frame % DANCE_BEATS.length];
    const pad = ' '.repeat(beat.shift);
    return {
      rows: [
        pad + merge(MINI.arms[beat.pose], MINI.dome),
        pad + MINI.body,
        pad + MINI.legs[beat.legIndex],
      ],
      quip,
    };
  }

  const arms = MINI.arms[armFrame(anim, frame)];
  const legs = MINI.legs[gaitIndex(anim, frame)];
  return { rows: [merge(arms, MINI.dome), MINI.body, legs], quip };
}

module.exports = { deriveMood, renderBuddy };
