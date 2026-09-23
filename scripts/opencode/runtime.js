const os = require('node:os');
const path = require('node:path');
const { createStateStore, sessionId } = require('../lib/state-store');
const { resolveConfig } = require('../lib/config');
const { transition, resolveTarget } = require('../lib/mode-service');
const { loadInjectionBlock } = require('../lib/persona');

const HELP = `Eridian for OpenCode: /eridian-mode [lite|full|ultra|eridian|off|reset|status].
No argument toggles off/full. Explicit levels save a preference for future sessions.
Existing sessions keep their mode. Reset re-reads team defaults. Unconfigured installs are off.
ERIDIAN_OFF=1 suppresses style injection and mode writes.
/eridian-review performs a read-only review; /eridian-commit previews a conventional commit.
Buddy, token accounting, diagnostics, and guarded memory compression are not supported here.`;

const COMMANDS = {
  'eridian-mode': {
    description: 'Set Eridian mode or show status',
    template: 'Report the Eridian mode command result.',
  },
  'eridian-help': { description: 'Show Eridian commands and limits', template: HELP },
  'eridian-review': {
    description: 'Review the workspace diff or a revision without changing files',
    template:
      'Perform a read-only substantive review of the workspace diff, or this requested revision: $ARGUMENTS. Prioritize bugs and regressions. Give severity, file and line, evidence, and impact for each finding. State when no findings were identified and name verification gaps. Do not modify files.',
  },
  'eridian-commit': {
    description: 'Preview a conventional commit from staged changes',
    template:
      'Inspect the staged diff and propose a plain conventional commit. Additional request: $ARGUMENTS. Use ordinary grammatical prose without Rocky dialect. Do not stage files. Show the exact proposed message and obtain confirmation before creating the commit. If nothing is staged, report that fact.',
  },
};

function createHooks({ directory = process.cwd(), env = process.env, home = os.homedir() } = {}) {
  // Construct lazily: opt-out must not read or write saved state.
  let store;
  const getStore = () =>
    (store ||= createStateStore({
      stateDir: env.ERIDIAN_STATE_DIR
        ? path.join(path.resolve(env.ERIDIAN_STATE_DIR), 'opencode')
        : path.join(
            env.XDG_STATE_HOME || path.join(home, '.local', 'state'),
            'eridian',
            'opencode'
          ),
      configOptions: { env, home },
    }));
  const optedOut = () => env.ERIDIAN_OFF === '1';
  const owned = new Set();
  function stateFor(id) {
    const currentStore = getStore();
    if (Object.hasOwn(currentStore.readStore().sessions, id))
      return currentStore.readState(id, { cwd: directory });
    return currentStore.updateSession(id, (state) => state, {
      initialize: true,
      cwd: directory,
    });
  }
  return {
    config: async (config) => {
      config.command ||= {};
      for (const [name, command] of Object.entries(COMMANDS)) {
        // A user-defined command remains theirs, including its execution hook.
        if (Object.hasOwn(config.command, name)) continue;
        config.command[name] = { ...command, subtask: false };
        owned.add(name);
      }
    },
    'command.execute.before': async (input, output) => {
      if (input.command !== 'eridian-mode' || !owned.has(input.command)) return;
      const id = sessionId(input.sessionID);
      const arg = String(input.arguments || '').trim();
      let result;
      if (optedOut()) {
        result = 'Eridian disabled for this run (ERIDIAN_OFF=1). Saved mode unchanged.';
      } else if (!id) {
        result = 'Eridian mode failed: missing or invalid host session identity. No state changed.';
      } else if (arg !== 'status' && !resolveTarget(arg, 'off')) {
        result = 'Unknown mode. Use lite | full | ultra | eridian | off | reset | status.';
      } else {
        const state = stateFor(id);
        if (arg === 'status') {
          result = `Eridian host: opencode; current: ${state.current}; saved preference: ${getStore().readStore().preferences.current}; source: ${state.resolvedSource}.`;
        } else {
          const next = getStore().updateSession(
            id,
            (current, raw) => {
              const change = transition(current, raw, arg, {
                cwd: directory,
                resolve: (options) => resolveConfig({ ...options, env, home }),
                recordActivation: getStore().recordActivation,
              });
              if (!change.ok) throw new Error(change.error);
              return change.state;
            },
            { cwd: directory }
          );
          result = `Eridian mode: ${next.current}.`;
        }
      }
      // Mutate the host's array in place; its caller retains this reference.
      output.parts.splice(0, output.parts.length, {
        type: 'text',
        text: `Report this Eridian command result briefly. Do not run tools or change settings.\n${result}`,
      });
    },
    'experimental.chat.system.transform': async (input, output) => {
      if (optedOut()) return;
      const id = sessionId(input.sessionID);
      if (!id) return;
      const state = stateFor(id);
      const block = loadInjectionBlock(state.current);
      if (!block) return;
      const payload = `Eridian mode "${state.current}" is active.\n${block}`;
      if (!output.system.includes(payload)) output.system.push(payload);
    },
  };
}

module.exports = { createHooks };
