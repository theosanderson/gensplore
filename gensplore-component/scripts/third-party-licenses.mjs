// Writes the license notices for every Rust crate linked into the aligner's
// WebAssembly module (Nextclade and its dependencies), as their licenses require
// when redistributing compiled code. Run by build-align-wasm.mjs.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const LICENSE_FILE = /^(licen[cs]e|copying|unlicense|notice)/i;
const MIT = /Permission is hereby granted, free of charge/;

// License files in the crate's directory, or the nearest ancestor that has any: a
// workspace member such as nextclade keeps them at its repository root.
function licenseFiles(manifestPath) {
  for (let dir = dirname(manifestPath); dir !== dirname(dir); dir = dirname(dir)) {
    const files = readdirSync(dir).filter(name => LICENSE_FILE.test(name)).sort();
    if (files.length) return files.map(name => readFileSync(join(dir, name), 'utf8').trim());
    if (existsSync(join(dir, '.git')) || /[\\/]registry[\\/]src[\\/][^\\/]+$/.test(dirname(dir))) break;
  }
  return [];
}

// Where MIT is one alternative, its notice alone satisfies the license. Otherwise every
// license file ships. A crate publishing no file gets the MIT text for its authors.
function notices(pkg) {
  const texts = licenseFiles(pkg.manifest_path);
  const license = pkg.license || '';
  const mitAlternative = /\bMIT\b/.test(license) && !/\bAND\b/.test(license);
  if (mitAlternative && texts.some(text => MIT.test(text))) return texts.filter(text => MIT.test(text));
  if (texts.length) return texts;
  if (!mitAlternative) throw new Error(`No license file for ${pkg.name} ${pkg.version} (${license})`);
  return [`MIT License

Copyright (c) ${pkg.authors.length ? pkg.authors.join(', ') : `the ${pkg.name} authors`}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`];
}

export function thirdPartyLicenses(crateDir) {
  const metadata = JSON.parse(execFileSync('cargo', ['metadata', '--format-version', '1', '--locked', '--filter-platform', 'wasm32-unknown-unknown'], { cwd: crateDir, encoding: 'utf8', maxBuffer: 1 << 28 }));
  const packages = new Map(metadata.packages.map(pkg => [pkg.id, pkg]));
  const nodes = new Map(metadata.resolve.nodes.map(node => [node.id, node]));
  // Normal (not build or dev) dependencies reachable from the crate; procedural
  // macros run at compile time and are not linked.
  const linked = new Set();
  const pending = [metadata.resolve.root];
  while (pending.length) {
    for (const dep of nodes.get(pending.pop()).deps) {
      const pkg = packages.get(dep.pkg);
      if (linked.has(dep.pkg) || !dep.dep_kinds.some(kind => kind.kind === null)) continue;
      if (pkg.targets.some(target => target.kind.includes('proc-macro'))) continue;
      linked.add(dep.pkg);
      pending.push(dep.pkg);
    }
  }
  const crates = [...linked].map(id => packages.get(id))
    .sort((a, b) => (b.name === 'nextclade') - (a.name === 'nextclade') || a.name.localeCompare(b.name) || a.version.localeCompare(b.version, undefined, { numeric: true }));
  // Identical texts (such as Apache-2.0) are printed once, listing their crates.
  const groups = new Map();
  for (const pkg of crates) {
    for (const text of notices(pkg)) {
      if (!groups.has(text)) groups.set(text, []);
      groups.get(text).push(`${pkg.name} ${pkg.version}${pkg.repository ? ` (${pkg.repository})` : ''}`);
    }
  }
  const rule = '='.repeat(80);
  return `THIRD-PARTY SOFTWARE NOTICES

Gensplore's sequence comparison runs a WebAssembly module compiled from Nextclade
(https://github.com/nextstrain/nextclade, MIT license, by the Nextstrain team) and
the Rust crates it links, listed below with their license notices. The module is
embedded in this package's JavaScript bundle.

Crates (${crates.length}):
${crates.map(pkg => `  ${pkg.name} ${pkg.version}  ${pkg.license || '(see notice)'}`).join('\n')}

${[...groups].map(([text, names]) => `${rule}\n${names.join('\n')}\n${rule}\n\n${text}\n`).join('\n')}`;
}
