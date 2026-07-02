#!/usr/bin/env bash
# Runs eval prompts through `claude -p` and records output tokens.
#   bash eval/run.sh              # all arms, rewrites eval/results.csv
#   bash eval/run.sh terse        # only the listed arms, appends rows
# Arms: baseline terse lite full ultra. COSTS REAL API TOKENS.
set -euo pipefail
cd "$(dirname "$0")/.."

ALL_MODES=(baseline terse lite full ultra)
if [ "$#" -gt 0 ]; then MODES=("$@"); else MODES=("${ALL_MODES[@]}"); fi
for m in "${MODES[@]}"; do
  case " ${ALL_MODES[*]} " in
    *" $m "*) ;;
    *) echo "unknown mode '$m'. use: ${ALL_MODES[*]}" >&2; exit 1 ;;
  esac
done

# Runs must be clean: if eridian mode is on, the SessionStart hook injects
# the dialect into every run and corrupts the measurements.
current=$(node -e "console.log(require('./scripts/lib/state').readState().current)")
if [ "$current" != "off" ]; then
  echo "eridian mode is '$current' — run 'node scripts/mode.js off' first." >&2
  exit 1
fi

OUT=eval/results.csv
# No args: fresh measurement, rewrite. With args: append to existing cells.
if [ "$#" -eq 0 ] || [ ! -f "$OUT" ]; then
  echo "prompt_id,mode,output_tokens" > "$OUT"
fi

run_one() { # $1=id $2=mode $3=full-prompt
  # </dev/null: claude -p reads stdin, which would drain the while-read pipe
  tokens=$(claude -p "$3" --output-format json </dev/null 2>/dev/null | jq -r '.usage.output_tokens')
  echo "$1,$2,$tokens" | tee -a "$OUT"
}

prompt_for() { # $1=mode $2=prompt
  case "$1" in
    baseline) printf '%s' "$2" ;;
    terse) printf 'Answer concisely.\n\n%s' "$2" ;;
    *) printf '%s\n\n%s' "$(node eval/prefix.js "$1")" "$2" ;;
  esac
}

jq -c '.[]' eval/prompts.json | while read -r row; do
  id=$(echo "$row" | jq -r '.id')
  prompt=$(echo "$row" | jq -r '.prompt')
  for mode in "${MODES[@]}"; do
    run_one "$id" "$mode" "$(prompt_for "$mode" "$prompt")"
  done
done

echo "done. now run: node eval/compute-factors.js"
