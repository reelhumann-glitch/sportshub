import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const project = fileURLToPath(new URL('.', import.meta.url));
const wrangler = fileURLToPath(new URL('./node_modules/wrangler/bin/wrangler.js', import.meta.url));
if (!existsSync(wrangler)) {
  console.error('Run npm ci in this folder first.');
  process.exit(1);
}

function run(...args) {
  const result = spawnSync(process.execPath, [wrangler, ...args], { cwd: project, stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run('login');
run('deploy');
console.log('Paste your configured AIOStreams manifest URL into the Wrangler secret prompt.');
run('secret', 'put', 'AIOSTREAMS_MANIFEST_URL');
console.log('Setup complete. Add /manifest.json to the Worker URL printed above and install that URL in Nuvio.');
