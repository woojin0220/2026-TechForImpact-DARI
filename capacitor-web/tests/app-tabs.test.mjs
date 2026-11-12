import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { appTabs, readActiveTab, tabsCopies, tabsCopyFor, writeActiveTab } from '../src/shell/tabsCopy.ts';
import { intakeLanguages } from '../src/intakeCopy.ts';

const project = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const compiled = await build({
  absWorkingDir: project,
  stdin: { loader: 'tsx', resolveDir: project, sourcefile: 'tests/app-tabs.fixture.tsx', contents: `
    import { renderToStaticMarkup } from 'react-dom/server';
    import { ComingSoon, TabBar } from './src/shell/TabBar';
    import { tabsCopyFor } from './src/shell/tabsCopy';
    export const bar = (language, active) => renderToStaticMarkup(<TabBar active={active} copy={tabsCopyFor(language)} onSelect={() => {}} />);
    export const placeholder = language => renderToStaticMarkup(<ComingSoon title={tabsCopyFor(language).communityTitle} copy={tabsCopyFor(language)} onBack={() => {}} />);
  ` },
  bundle: true, format: 'cjs', platform: 'node', write: false, jsx: 'automatic', external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime'], loader: { '.css': 'empty' },
});
const module = { exports: {} };
new Function('module', 'exports', 'require', compiled.outputFiles[0].text)(module, module.exports, require);
const { bar, placeholder } = module.exports;

test('the bottom bar has exactly the application, scheduler and community tabs', () => {
  assert.deepEqual(appTabs, ['application', 'scheduler', 'community']);
});

test('every intake language has a complete tab copy', () => {
  const keys = Object.keys(tabsCopies.en).sort();
  for (const { code } of intakeLanguages) {
    assert.deepEqual(Object.keys(tabsCopies[code] ?? {}).sort(), keys, code);
    for (const key of keys) assert.ok(tabsCopies[code][key].trim(), `${code}.${key}`);
  }
  assert.equal(tabsCopyFor('xx'), tabsCopies.en);
});

test('the active tab is marked and labelled in the selected language', () => {
  const html = bar('ko', 'community');
  assert.match(html, /<nav class="tab-bar" aria-label="주 메뉴">/);
  assert.equal((html.match(/<button/g) ?? []).length, 3);
  assert.match(html, /aria-current="page"[^>]*>.*?<span>커뮤니티<\/span>/);
  assert.doesNotMatch(html, /aria-current="page"[^>]*>.*?<span>신청서<\/span>.*?<span>스케줄러/);
  const arabic = bar('ar', 'application');
  for (const label of ['الطلب', 'المواعيد', 'المجتمع']) assert.ok(arabic.includes(label));
});

test('placeholders explain that application work is kept', () => {
  const html = placeholder('en');
  assert.match(html, /<h1>Community<\/h1>/);
  assert.match(html, /application work is kept/);
  assert.match(html, /Back to application/);
});

test('the remembered tab falls back to the application when storage is unusable', () => {
  const store = new Map();
  const storage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
  assert.equal(readActiveTab(storage), 'application');
  writeActiveTab('community', storage);
  assert.equal(readActiveTab(storage), 'community');
  store.set('dari.activeTab.v1', 'admin');
  assert.equal(readActiveTab(storage), 'application');
  assert.equal(readActiveTab({ getItem() { throw new Error('blocked'); } }), 'application');
  assert.doesNotThrow(() => writeActiveTab('scheduler', { setItem() { throw new Error('blocked'); } }));
});
