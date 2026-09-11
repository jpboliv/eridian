// Conservative phrase lists: ordinary uncertainty and single words such as "just"
// are intentionally absent. A match is a review hint, never a quality judgment.
module.exports = Object.freeze({
  filler: Object.freeze([
    "it's worth noting",
    'it is worth noting',
    'needless to say',
    'at the end of the day',
    'for all intents and purposes',
  ]),
  preambles: Object.freeze([
    'great question',
    'happy to help',
    "let's dive in",
    'let us dive in',
    'certainly, here',
  ]),
  recaps: Object.freeze(['in summary', 'to summarize', 'in conclusion', 'to recap']),
  salesLanguage: Object.freeze([
    'game changer',
    'game-changing',
    'unlock the power',
    'revolutionary solution',
    'seamless experience',
  ]),
  rockyMarkers: Object.freeze([
    'good good good',
    'bad bad bad',
    'amaze amaze amaze',
    'understand, question',
    '♫',
  ]),
});
