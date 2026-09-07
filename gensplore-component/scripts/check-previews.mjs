import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { serveDirectory } from './serve-static.mjs';

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
try {
  for (const [name, path, route] of [
    ['Website', '../../website/dist', '/?gb=/phix174.gb&fasta=/phix174.fasta'],
    ['Storybook', '../storybook-static', '/iframe.html?id=gensplore--phage&viewMode=story'],
  ]) {
    const server = await serveDirectory(fileURLToPath(new URL(path, import.meta.url)));
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(server.url + route);
      const compare = page.getByRole('button', { name: 'Compare FASTA' });
      await compare.waitFor();
      if (name === 'Website') await page.locator('h2', { hasText: 'NC_001422' }).waitFor();
      await compare.click();
      await page.getByRole('dialog').waitFor();
      if (name === 'Website') await page.getByText('0 changes', { exact: true }).waitFor();
      assert.equal(await page.getByRole('dialog').evaluate(node => getComputedStyle(node).position), 'fixed');
      assert.deepEqual(errors, []);
      await page.close();
      console.log(`${name} production preview passed`);
    } finally { await server.close(); }
  }
} finally { await browser.close(); }
