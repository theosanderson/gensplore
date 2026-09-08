import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { serveDirectory } from './serve-static.mjs';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), 'gensplore-package-'));
const run = (command, args, cwd) => execFileSync(command, args, { cwd, stdio: 'inherit' });
let browser;
try {
  const packResult = JSON.parse(execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', temporary], { cwd: root, encoding: 'utf8' }));
  const pack = Array.isArray(packResult) ? packResult[0] : packResult.gensplore;
  const packedFiles = pack.files.map(file => file.path);
  const requiredFiles = ['dist/gensplore.js', 'dist/gensplore.cjs', 'dist/index.d.ts', 'dist/index.d.cts'];
  for (const required of requiredFiles) assert(packedFiles.includes(required), required);
  assert(packedFiles.every(path => requiredFiles.includes(path) || /^(package.json|README.md|LICENSE.*)$/.test(path)), 'Only library outputs and package metadata should be packed');
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
  for (const reactVersion of (process.env.REACT_VERSION ? [process.env.REACT_VERSION] : ['18.3.1', '19.2.8'])) {
    const fixture = join(temporary, `react-${reactVersion}`);
    await cp(join(root, 'tests/consumer'), fixture, { recursive: true, filter: source => !source.includes('node_modules') });
    await mkdir(join(fixture, 'public'), { recursive: true });
    await cp(join(root, '../website/public/phix174.gb'), join(fixture, 'public/reference.gb'));
    const control = await readFile(join(root, '../website/public/phix174.fasta'), 'utf8');
    // An arbitrary single-base deletion exercises the packaged inline worker.
    const sequence = control.split('\n').slice(1).join('').trim();
    await writeFile(join(fixture, 'public/alternative.fasta'), '>Packaged phage test\n' + sequence.slice(0, 100) + sequence.slice(101) + '\n');
    run('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], fixture);
    run('npm', ['install', '--ignore-scripts', '--no-save', '--package-lock=false', '--no-audit', '--no-fund', join(temporary, pack.filename), `react@${reactVersion}`, `react-dom@${reactVersion}`, ...(reactVersion.startsWith("19") ? ["@types/react@19.2.18", "@types/react-dom@19.2.7"] : [])], fixture);
    run('npm', ['run', 'check'], fixture);
    run(join(fixture, 'node_modules/.bin/tsc'), ['--noEmit', '--strict', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', 'src/commonjs.cts'], fixture);
    run('node', ['--input-type=module', '-e', 'import assert from "node:assert/strict"; import Gensplore from "gensplore"; assert.equal(typeof Gensplore, "function")'], fixture);
    run('node', ['-e', 'require("node:assert/strict").equal(typeof require("gensplore"), "function")'], fixture);
    run('npm', ['run', 'build'], fixture);
    const server = await serveDirectory(join(fixture, 'dist'));
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(server.url);
      await page.getByRole('heading', { name: 'Packaged phage test', exact: true }).waitFor();
      assert.equal(await page.locator('#react-version').innerText(), reactVersion);
      assert.equal(await page.locator('style#gensplore-styles').count(), 1, 'Styles load automatically once');
      assert.match(await page.locator('#viewer-title').innerText(), /Packaged phage test vs/);
      const hostStyle = await page.locator('#host-button').evaluate(node => getComputedStyle(node).paddingTop);
      assert.notEqual(hostStyle, '20px', 'Gensplore utilities must not style host elements');
      assert.equal(await page.locator('#host-heading').evaluate(node => getComputedStyle(node).fontSize), '32px', 'Gensplore reset must not restyle host headings');
      await page.getByRole('button', { name: 'Compare FASTA' }).click();
      await page.getByRole('dialog').waitFor();
      assert.equal(await page.getByRole('dialog').evaluate(node => getComputedStyle(node).position), 'fixed');
      await page.getByRole('cell', { name: 'Deletion', exact: true }).waitFor();
      if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.SCREENSHOT_DIR, `gensplore-react-${reactVersion}.png`) });
      await page.getByRole('button', { name: 'Close comparison' }).click();
      await page.getByRole('button', { name: 'Remove comparison' }).click();
      await page.getByRole('heading', { name: 'Packaged phage test', exact: true }).waitFor({ state: 'detached' });
      await page.getByRole('button', { name: 'Settings', exact: true }).click();
      await page.getByRole('dialog', { name: 'Settings', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Close', exact: true }).click();
      await page.keyboard.press('Control+f');
      await page.locator('#search-input').fill('AAA');
      await page.getByText(/Hit 1 of/).waitFor();
      await page.getByRole('button', { name: 'Use aligned sequence', exact: true }).click();
      await page.getByRole('heading', { name: 'Aligned preview', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Compare FASTA' }).click();
      await page.getByRole('cell', { name: 'Insertion', exact: true }).waitFor();
      await page.getByRole('cell', { name: 'Ambiguous', exact: true }).waitFor();
      assert.equal(await page.getByLabel('FASTA URL').count(), 0);
      await page.getByRole('button', { name: 'Close comparison' }).click();
      await page.getByText('Coverage gap', { exact: true }).first().waitFor();
      assert(await page.locator('svg text[fill-opacity="0.35"]').count() > 0, 'Coverage gap reference bases are faded');
      await page.getByRole('img', { name: /Amino acid unresolved because of ambiguous nucleotide calls/ }).first().waitFor();
      assert(await page.locator('svg text[font-size="10"][fill-opacity="0.35"]').count() > 0, 'Coverage gap amino acids are faded');
      await page.getByRole('img', { name: /Amino acid unresolved because of ambiguous nucleotide calls/ }).first().hover();
      await page.getByRole('tooltip').waitFor();
      assert.match(await page.getByRole('tooltip').innerText(), /Amino acid unresolved/);
      await page.locator('svg text[font-size="12"][fill-opacity="0.35"]').first().hover();
      assert.match(await page.getByRole('tooltip').innerText(), /Reference .*No confident call/);
      if (process.env.SCREENSHOT_DIR) await page.screenshot({ path: join(process.env.SCREENSHOT_DIR, `gensplore-tooltips-${reactVersion}.png`) });
      await page.getByRole('button', { name: 'Remove aligned sequence', exact: true }).click();
      await page.getByRole('heading', { name: 'Aligned preview', exact: true }).waitFor({ state: 'detached' });
      assert.deepEqual(errors, [], 'No browser errors');
      await page.close();
      console.log(`Packaged component passed with React ${reactVersion}`);
    } finally {
      await server.close();
    }
  }
} finally {
  await browser?.close();
  await rm(temporary, { recursive: true, force: true });
}
