#!/usr/bin/env python3
"""Count captured Eridian payloads with tiktoken; approximate for Claude billing."""
import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import re
import subprocess
import tempfile

import tiktoken

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parent.parent)
args = parser.parse_args()
root = args.root.resolve()
source = (root / 'skills/speak/SKILL.md').read_text()
encoding = tiktoken.get_encoding('o200k_base')
payloads = {}
for name, text in re.findall(r'<!-- eridian:inject:([\w-]+) -->(.*?)<!-- /eridian:inject:\1 -->', source, re.S):
    payloads[f'region:{name}'] = text.strip()
frontmatter = re.match(r'^---\n(.*?)\n---', source, re.S)
if frontmatter:
    payloads['skill-frontmatter'] = frontmatter.group(1)

# Capture actual command/hook wrappers using only a disposable state store.
probe = r'''
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = process.argv[1], dir = process.argv[2];
const env = {...process.env, ERIDIAN_OFF:'0', ERIDIAN_STATE_DIR:dir, CLAUDE_SESSION_ID:'payload-probe'};
const invoke = (file,args=[],input={}) => execFileSync(process.execPath,[path.join(root,file),...args],{env,input:JSON.stringify(input),encoding:'utf8',cwd:root});
const result = {};
for(const level of ['lite','full','ultra']) {
  result[`combined:${level}`] = invoke('eval/prefix.js',[level]);
  result[`activation:${level}`] = invoke('scripts/mode.js',[level,'--session-id','payload-probe']);
  const start = invoke('scripts/session-start.js',[],{session_id:'payload-probe',source:'startup',cwd:root});
  result[`session-start:${level}`] = start ? JSON.parse(start).hookSpecificOutput.additionalContext : '';
  const emissions = [];
  for(let i=1;i<=21;i++) {
    const text=invoke('scripts/buddy-hook.js',['prompt'],{session_id:'payload-probe',prompt:'Continue.',cwd:root});
    if(text) { result[`prompt-${i}:${level}`]=text; emissions.push(i); }
  }
  result[`observed-cadence:${level}`] = JSON.stringify(emissions);
}
process.stdout.write(JSON.stringify(result));
'''
with tempfile.TemporaryDirectory(prefix='eridian-payload-count-') as state_dir:
    captured = json.loads(subprocess.check_output(['node', '-e', probe, str(root), state_dir], text=True))
observed_cadence = {key: json.loads(value) for key, value in captured.items() if key.startswith('observed-cadence:')}
payloads.update({key: value for key, value in captured.items() if not key.startswith('observed-cadence:')})
print(json.dumps({
    'schemaVersion': 1,
    'tokenizer': f'tiktoken {importlib.metadata.version("tiktoken")} / o200k_base',
    'interpretation': 'Exact counts for this named encoding; approximate for Claude. Newly emitted payload only, not total context processed or billed input.',
    'ruleHash': hashlib.sha256(source.encode()).hexdigest(),
    'observedCadence': observed_cadence,
    'payloads': {key: {'tokens': len(encoding.encode(text)), 'utf8Bytes': len(text.encode()), 'sha256': hashlib.sha256(text.encode()).hexdigest(), 'text': text} for key, text in payloads.items()},
}, ensure_ascii=False, indent=2))
