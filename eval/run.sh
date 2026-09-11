#!/usr/bin/env bash
# Reproducible, isolated comparisons. Costs provider tokens. Defaults to 3 repeats.
set -euo pipefail
exec node "$(dirname "$0")/run.js" "$@"
