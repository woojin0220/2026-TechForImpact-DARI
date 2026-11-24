import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const project = fileURLToPath(new URL('..', import.meta.url));
const result = await build({
  absWorkingDir: project,
  stdin: { loader: 'tsx', resolveDir: project, contents: `
    import { renderToStaticMarkup } from 'react-dom/server';
    import { HeaderActions } from './src/app/HeaderActions';
    import { appTexts } from './src/app/texts';
    import { ProcedureGuide } from './src/procedure/ProcedureGuide';
    const noop = () => {};
    const profile = <button aria-label="profile-test">Profile</button>;
    export const header = language => renderToStaticMarkup(<HeaderActions texts={appTexts(language)} languageName={language}
      overviewOpen={false} onOverview={noop} onLanguage={noop} onHelp={noop} showOperator={true}
      operatorOpen={false} onOperator={noop} onCloseOperator={noop} operatorPanel={null} accessory={profile} />);
    export const guide = language => renderToStaticMarkup(<ProcedureGuide language={language} onBack={noop} headerAccessory={profile} />);
  ` },
  bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false,
  external: ['react', 'react-dom/server', 'react/jsx-runtime'], loader: { '.css': 'empty' },
  define: { 'import.meta.env.BASE_URL': '"/"' },
});
const mod = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, mod, mod.exports);

test('issue 23 header keeps overview and grouped settings alongside the PR 27 profile action', () => {
  for (const language of ['ko', 'en', 'fr', 'ru', 'ar', 'fa']) {
    const html = mod.exports.header(language);
    assert.match(html, /class="overview-trigger"/);
    assert.match(html, /class="settings-menu"/);
    assert.match(html, /aria-label="profile-test"/);
    assert.equal((html.match(/settings-action /g) ?? []).length, 3);
  }
});

test('the scheduler keeps the real guide and profile action without a redundant application back button', () => {
  for (const language of ['ko', 'en', 'fr', 'ru', 'ar', 'fa']) {
    const html = mod.exports.guide(language);
    assert.match(html, /procedure-guide\.html\?embedded=1&amp;lang=/);
    assert.match(html, /class="dari-screen-actions"/);
    assert.match(html, /aria-label="profile-test"/);
    assert.equal((html.match(/<button/g) ?? []).length, 1);
    assert.ok(html.includes(`dir="${['ar', 'fa'].includes(language) ? 'rtl' : 'ltr'}"`));
  }
});
