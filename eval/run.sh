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

# Suppress automatic persona hooks without changing the user's saved mode.
# Explicit prefixes below remain enabled for the dialect arms.
export ERIDIAN_OFF=1

OUT=eval/results.csv
ISOLATION=eval/results-isolation.jsonl
# No args: fresh measurement, rewrite. With args: append to existing cells.
if [ "$#" -eq 0 ] || [ ! -f "$OUT" ]; then
  echo "prompt_id,mode,output_tokens" > "$OUT"
  : > "$ISOLATION"
fi
node -e 'console.log(JSON.stringify({
  startedAt: new Date().toISOString(),
  modes: process.argv.slice(1),
  isolation: { ERIDIAN_OFF: process.env.ERIDIAN_OFF, scope: "Eridian automatic hooks and mode command only" }
}))' "${MODES[@]}" >> "$ISOLATION"

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
