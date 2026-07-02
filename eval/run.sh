#!/usr/bin/env bash
# Runs each eval prompt in baseline + each rocky level via `claude -p`.
# COSTS REAL API TOKENS. Run manually, from the repo root:  bash eval/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."

# Baseline runs must be clean: if rocky mode is on, the SessionStart hook
# injects the dialect into every run and corrupts the measurements.
current=$(node -e "console.log(require('./scripts/lib/state').readState().current)")
if [ "$current" != "off" ]; then
  echo "rocky mode is '$current' — run 'node scripts/mode.js off' first." >&2
  exit 1
fi

OUT=eval/results.csv
echo "prompt_id,mode,output_tokens" > "$OUT"

run_one() { # $1=id $2=mode $3=full-prompt
  tokens=$(claude -p "$3" --output-format json 2>/dev/null | jq -r '.usage.output_tokens')
  echo "$1,$2,$tokens" | tee -a "$OUT"
}

jq -c '.[]' eval/prompts.json | while read -r row; do
  id=$(echo "$row" | jq -r '.id')
  prompt=$(echo "$row" | jq -r '.prompt')
  run_one "$id" baseline "$prompt"
  for level in lite full ultra; do
    prefix=$(node eval/prefix.js "$level")
    run_one "$id" "$level" "$prefix

$prompt"
  done
done

echo "done. now run: node eval/compute-factors.js"
