// Writes src/assets/licenses.json: every open-source package that ships with
// the app (the production dependency tree, as npm resolves it) with its
// version and license type, for the "Open-source licenses" screen
// (app/licenses.tsx). Run after adding, removing or upgrading a dependency:
//
//   npm run licenses
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// `npm ls` exits non-zero over unmet optional peers (e.g. react-native-drawer-layout
// wanting reanimated, which nothing here uses) but still prints the full tree.
function npmLs(args) {
  try {
    return execSync(`npm ls --omit=dev --all ${args}`, { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    if (e.stdout) return e.stdout;
    throw e;
  }
}

const tree = JSON.parse(npmLs('--json'));

// One installed package directory per line.
const paths = npmLs('--parseable')
  .split(/\r?\n/)
  .filter((p) => p.includes('node_modules'));

// @expo/ngrok is the dev-server tunnel (`expo start --tunnel`): its binaries
// are proprietary, carry no license field and never ship in the app.
const SKIP = /^@expo\/ngrok/;

function licenseOf(pkg) {
  if (typeof pkg.license === 'string') return pkg.license;
  if (pkg.license && pkg.license.type) return pkg.license.type;
  if (Array.isArray(pkg.licenses)) return pkg.licenses.map((l) => l.type || l).join(' OR ');
  return 'Unknown';
}

const seen = new Map();
for (const dir of paths) {
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  } catch {
    continue;
  }
  if (!pkg.name || !pkg.version) continue;
  if (SKIP.test(pkg.name)) continue;
  const key = `${pkg.name}@${pkg.version}`;
  if (!seen.has(key)) seen.set(key, { name: pkg.name, version: pkg.version, license: licenseOf(pkg) });
}

const list = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));
writeFileSync(new URL('../src/assets/licenses.json', import.meta.url), '[\n' + list.map((p) => JSON.stringify(p)).join(',\n') + '\n]\n');
console.log(`${list.length} packages from ${tree.name}@${tree.version} -> src/assets/licenses.json`);
