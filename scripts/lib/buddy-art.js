// Eyeless, book-accurate: Eridians have no eyes, so Rocky is pure carapace.
// Arms are the top row (pose), legs the bottom row (gait), dome/body fixed
// between — so buddy.js composes figures instead of storing them whole.
// Fixed height: mini = arms/dome/body/legs (4 rows); tall adds a body row (5).
// Leg frame 2, domeParty, and legsTucked pixels are tuned by eye.
const MINI = {
  dome: '  ▄▄▄',
  domeParty: '♪ ▄▄▄ ♪',
  body: ' █████',
  arms: {
    down: '',
    up: '▘     ▘',
    wide: '▘       ▘',
    leftWave: '▘',
    rightWave: '        ▘',
    five: '▘  ▘ ▘  ▘',
    celebrate: '▘ ▘   ▘ ▘',
  },
  legs: ['▘ ▘ ▘▘', '▘    ▘'],
  legsTucked: '▄ ▄ ▄▄',
};

const TALL = {
  dome: '  ▄▄▄▄▄',
  domeParty: '♪ ▄▄▄▄▄ ♪',
  body: [' ███████', '█████████'],
  arms: {
    down: '',
    up: '▘       ▘',
    higher: '  ▘   ▘',
    wide: '▘         ▘',
    leftWave: '▘',
    rightWave: '          ▘',
    five: '▘  ▘ ▘  ▘',
    celebrate: '▘ ▘   ▘ ▘',
  },
  legs: ['▘ ▘▘ ▘ ▘', '▘  ▘   ▘'],
  legsTucked: '▄ ▄▄ ▄ ▄',
};

module.exports = { MINI, TALL };
