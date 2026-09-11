# Input overhead and estimate limits — ticket 002

Measured after ticket 010 selected the unchanged every-20-active-prompts full
refresh. `input-payloads.json` retains exact captured text, byte lengths, SHA256
identities and counts from **tiktoken 0.12.0 / o200k_base**. These are exact counts
for that encoding, **approximate for Claude**, and not provider-billed input counts.
Run with the pinned optional dependency in `eval/tokenizer-requirements.txt`:

```sh
python -m pip install -r eval/tokenizer-requirements.txt
python eval/count-payloads.py > /tmp/input-payloads.json
```

The probe invokes actual mode/hooks against disposable state only. It captures
activation, SessionStart and the first 21 active prompts per level. Existing
preferences and sessions are unchanged. Shared rules, isolated level regions,
experimental reminders and available skill/command frontmatter are counted too.
Metadata counts cover source text available to this plugin, not hidden host prompt
wrappers, descriptions chosen by the host, or its complete system prompt.

| Payload                                    | Lite | Full | Ultra |
| ------------------------------------------ | ---: | ---: | ----: |
| Shared rules                               |  143 |  143 |   143 |
| Level alone                                |   90 |  154 |   243 |
| Combined persona                           |  233 |  297 |   386 |
| Activation with wrapper                    |  239 |  303 |   392 |
| SessionStart with wrapper                  |  253 |  317 |   407 |
| Prompt-20 full reminder with wrapper       |  250 |  314 |   404 |
| Experimental short reminder (not selected) |   34 |   34 |    30 |

The probe observed emission at prompt 20 only for each level. A newly injected
payload may be processed again in future turns and tool requests; summing payload
counts is therefore not total session input. Conversely, cached text may have a
different marginal rate. The [cadence experiment](../../eval/snapshots/reinforcement-cadence/README.md)
retains separate input, cache-creation, cache-read and output usage for every
completed call. Its synthetic replay is not a native session or billing experiment.
The provider limit left comparisons incomplete; there is no validated break-even
workload or claim that the retained cadence is optimal.

## Monetary interpretation

Displayed estimates are counterfactual eligible-prose output reductions, not
measured savings or money saved. Existing unscoped factors are inapplicable; caches
preserve calibration identity/model/rules rather than silently repricing history.
The July 22 historical raw-data gap remains. New all-output runs include thinking
and cannot become prose-only runtime calibration by relabeling them.

For token-priced usage, a workload-specific cost difference is:

`Δcost = Δuncached_input × input_rate + Δcache_write × write_rate + Δcache_read × read_rate − output_reduction × output_rate`.

Counts must come from comparable provider usage, with the actual billing model and
rates. As a purely hypothetical uncached example, assume 100 additional input tokens,
30 fewer output tokens, input $1/million and output $5/million, with no other requests
or fees. The difference is $0.00010 − $0.00015 = −$0.00005. Those are invented example
rates, not any provider's current prices; replayed context, caching, thinking, tools
or a different workload can reverse the result. The approximate payload counts
above cannot substitute for measured provider usage in this formula.

Under fixed per-request billing, shorter replies do not inherently reduce charges.
Subscriptions, quotas and tiered billing require their own analysis. There is no
universal reply-length threshold or unconditional monetary-saving claim.
