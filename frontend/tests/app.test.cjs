const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
async function setup(hash = '#/explore', mode = 'raw') {
  const dom = new JSDOM('<div id="app"></div>', { url: 'https://example.test/' + hash, runScripts: 'outside-only' });
  const w = dom.window;
  const run = code => vm.runInContext(code, dom.getInternalVMContext());
  await new Promise(resolve => w.addEventListener('DOMContentLoaded', resolve, { once: true }));
  for (const script of ['html', 'config', 'samoyed', 'questionnaire', 'api']) run(fs.readFileSync(`js/${script}.js`, 'utf8'));
  run(`localStorage.setItem(CONFIG.STORAGE_KEY_ONBOARDED, '1'); localStorage.setItem(CONFIG.STORAGE_KEY_MODE, '${mode}');`);
  const api = run('Api');
  api.get = async () => ({ labels: [{ label: 'cafe', count: 1 }] });
  run('Geo').getLocation = async () => ({ lat: 40.75, lng: -73.98 });
  run(fs.readFileSync('js/app.js', 'utf8'));
  w.dispatchEvent(new w.Event('DOMContentLoaded'));
  await tick();
  return { dom, w, doc: w.document, api };
}
const result = { total: 1, radius_km: 1, data_source: 'manhattan', pipeline_time_ms: 1, ranking_method: 'raw',
  rankings: [{ name: '<img src=x onerror=alert(1)>', rank: 1, distance_m: 0, review: '<svg onload=alert(1)>',
    highlights: ['<script>bad</script>'], warnings: [], neg_review_snippets: ['<img src=x>'] }] };
test('repeated category selection submits once and renders API text safely', async () => {
  const { dom, doc, api } = await setup();
  try {
    let calls = 0;
    api.post = async () => { calls++; return result; };
    const category = doc.querySelector('.cat-card');
    assert.equal(category.tagName, 'BUTTON');
    category.click(); category.click(); category.click();
    await tick();
    doc.querySelector('#btn-raw-explore').click();
    await tick();
    assert.equal(calls, 1);
    assert.equal(doc.querySelectorAll('.result-list img, .result-list svg, .result-list script').length, 0);
    assert.match(doc.querySelector('.r-name').textContent, /<img/);
    assert.match(doc.querySelector('.r-meta').textContent, /0m/);
    assert.match(doc.querySelector('[role=status]').textContent, /No AI/);
  } finally { dom.window.close(); }
});
test('navigation aborts request and late response cannot replace home', async () => {
  const { dom, doc, api, w } = await setup('#/eat');
  try {
    let resolve, signal;
    api.post = (_, __, s) => { signal = s; return new Promise(r => resolve = r); };
    doc.querySelector('#btn-raw-go').click();
    await tick();
    w.location.hash = '#/';
    await tick();
    assert.ok(signal.aborted);
    resolve(result);
    await tick();
    assert.ok(doc.querySelector('.hero-title'));
    assert.equal(doc.querySelector('.result-list'), null);
  } finally { w.close(); }
});
test('stale label response cannot overwrite newly selected category', async () => {
  const { dom, doc, api } = await setup();
  try {
    const pending = [];
    api.get = () => new Promise(resolve => pending.push(resolve));
    const cards = doc.querySelectorAll('.cat-card');
    cards[0].click(); cards[1].click();
    pending[1]({ labels: [{ label: 'new_category', count: 2 }] });
    await tick();
    pending[0]({ labels: [{ label: 'old_category', count: 3 }] });
    await tick();
    assert.ok(doc.querySelector('input[value="new_category"]'));
    assert.equal(doc.querySelector('input[value="old_category"]'), null);
  } finally { dom.window.close(); }
});
test('interrupted AI stream retains cold results and shows fallback', async () => {
  const { dom, doc, api } = await setup('#/eat', 'ai');
  try {
    api.stream = async (_, __, emit) => {
      emit({ ...result, type: 'cold', ranking_method: 'cold' });
      throw new Error('disconnected');
    };
    const form = doc.querySelector('#q-form');
    doc.querySelectorAll('.q-group').forEach(group => group.querySelector('.q-opt').click());
    form.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    await tick();
    assert.ok(doc.querySelector('.result-list'));
    assert.match(doc.querySelector('.reasoning-banner').textContent, /AI is unavailable/);
    assert.match(doc.querySelector('.reasoning-banner').textContent, /Connection interrupted/);
  } finally { dom.window.close(); }
});
