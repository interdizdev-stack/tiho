import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

test('GitHub Pages root contains a built entry point and its assets', async () => {
  const html = await readFile('index.html', 'utf8');
  assert.doesNotMatch(html, /src="\/src\/main\.js"/);
  const css = html.match(/href="(\/assets\/[^" ]+\.css)"/);
  const script = html.match(/src="(\/assets\/[^" ]+\.js)"/);
  assert.ok(css, 'built stylesheet must be linked');
  assert.ok(script, 'built module must be linked');
  await Promise.all([access(`.${css[1]}`), access(`.${script[1]}`)]);
  const js = await readFile(`.${script[1]}`, 'utf8');
  assert.doesNotMatch(js, /from\s*["'](?:gsap|three)["']/);
});
