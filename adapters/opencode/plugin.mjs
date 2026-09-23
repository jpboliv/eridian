import runtime from '../../scripts/opencode/runtime.js';

export const EridianPlugin = async ({ directory }) => runtime.createHooks({ directory });
