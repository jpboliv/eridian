// Eyeless, book-accurate: Eridians have no eyes, so Rocky is pure carapace.
// Arms merge onto the dome's row (buddy.js composes them) — dome/body/legs
// are the fixed parts; arms are the only per-pose piece.
// Every glyph here must stay Unicode East-Asian-Width "Narrow" (not
// "Ambiguous") — ambiguous-width glyphs render 2 columns wide in some
// terminals, which silently breaks column alignment between rows. Verify:
//   python3 -c "import unicodedata as u; print(u.east_asian_width('◼'))"
const MINI = {
  dome: '  ◼◼◼',
  body: ' ◼◼◼◼◼',
  arms: {
    down: '',
    up: '▘     ▘',
    wide: '▘       ▘',
    leftWave: '▘' + ' '.repeat(8),
    rightWave: '        ▘',
    five: '▘▘    ▘ ▘',
    celebrate: '▘▘     ▘▘',
  },
  legs: ['▘ ▘ ▘▘', '▘  ▘ ▘'],
  legsTucked: '◼ ◼ ◼◼',
};

module.exports = { MINI };
