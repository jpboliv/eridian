// Check this before resolving defaults, reading state, or emitting persona output.
// Keep rule loading independent so eval arms can still request explicit prefixes.
function isOptedOut() {
  return process.env.ERIDIAN_OFF === '1';
}

module.exports = { isOptedOut };
