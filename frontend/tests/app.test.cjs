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
  return { dom, w, doc: w.document, api, run };
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

test('mode changes retain the exploration category and scoped label selection', async () => {
  const { dom, doc, api } = await setup();
  try {
    doc.querySelector('.cat-card[data-cat="shopping"]').click();
    await tick();
    doc.querySelector('input[value="cafe"]').click();
    doc.querySelector('.mode-btn[data-mode="ai"]').click();
    await tick();
    assert.equal(doc.querySelector('.cat-card.selected').dataset.cat, 'shopping');
    assert.ok(doc.querySelector('input[value="cafe"]').checked);
    doc.querySelector('.mode-btn[data-mode="raw"]').click();
    await tick();
    let payload;
    api.post = async (_, body) => { payload = body; return result; };
    doc.querySelector('#btn-raw-explore').click();
    await tick();
    assert.equal(payload.category, 'shopping');
    assert.deepEqual(Array.from(payload.labels), ['cafe']);
  } finally { dom.window.close(); }
});

test('labels do not leak across areas and the previous selection is restored on return', async () => {
  const { dom, doc, w } = await setup('#/eat');
  try {
    doc.querySelector('input[value="cafe"]').click();
    const area = doc.querySelector('#sel-ds');
    area.value = 'brooklyn';
    area.dispatchEvent(new w.Event('change'));
    await tick();
    assert.equal(doc.querySelector('input[value="cafe"]').checked, false);
    area.value = 'manhattan';
    area.dispatchEvent(new w.Event('change'));
    await tick();
    assert.ok(doc.querySelector('input[value="cafe"]').checked);
    const toggle = doc.querySelector('#label-toggle-btn');
    toggle.click();
    doc.querySelector('input[value="cafe"]').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(toggle.getAttribute('aria-expanded'), 'false');
    assert.equal(doc.activeElement, toggle);
  } finally { w.close(); }
});

test('unsent questionnaire edits survive mode changes and navigation', async () => {
  const { dom, doc, w } = await setup('#/eat', 'ai');
  try {
    doc.querySelector('.q-opt[data-qid="spicy"][data-val="Mild"]').click();
    doc.querySelector('.mode-btn[data-mode="raw"]').click();
    await tick();
    doc.querySelector('.mode-btn[data-mode="ai"]').click();
    await tick();
    assert.equal(doc.querySelector('.q-opt.sel[data-qid="spicy"]').dataset.val, 'Mild');
    w.location.hash = '#/';
    await tick();
    w.location.hash = '#/eat';
    await tick();
    assert.equal(doc.querySelector('.q-opt.sel[data-qid="spicy"]').getAttribute('aria-pressed'), 'true');
  } finally { w.close(); }
});

test('malformed and outdated stored surveys cannot bypass required answers', async () => {
  const { dom, doc, run, w } = await setup('#/eat', 'ai');
  try {
    const questionnaire = run('Questionnaire');
    const schema = run('QUESTIONNAIRE_A');
    const container = doc.querySelector('#q-container');
    for (const saved of ['[]', '"text"', '123', '{"spicy":42}', '{"spicy":"Retired choice"}']) {
      questionnaire.clear('eat');
      w.localStorage.setItem('q_eat', saved);
      questionnaire.render(schema, container, () => assert.fail('invalid survey submitted'));
      assert.equal(container.querySelector('#q-use-saved'), null);
      assert.equal(container.querySelectorAll('.q-opt.sel').length, 0);
    }
    const partial = { spicy: 'Mild', budget: '<$10' };
    w.localStorage.setItem('q_eat', JSON.stringify(partial));
    questionnaire.render(schema, container, () => assert.fail('partial survey submitted'));
    assert.equal(container.querySelector('#q-use-saved'), null);
    assert.equal(container.querySelectorAll('.q-opt.sel').length, 2);
  } finally { w.close(); }
});

test('editing saved answers prevents quick-submit from using the old values', async () => {
  const { dom, doc, run, w } = await setup('#/eat', 'ai');
  try {
    const schema = run('QUESTIONNAIRE_A');
    const saved = Object.fromEntries(schema.questions.map(question => [question.id, question.options[0]]));
    w.localStorage.setItem('q_eat', JSON.stringify(saved));
    let submitted;
    run('Questionnaire').render(schema, doc.querySelector('#q-container'), value => submitted = value);
    doc.querySelector('#q-toggle-form').click();
    assert.equal(doc.querySelector('#q-toggle-form').getAttribute('aria-expanded'), 'true');
    doc.querySelector('.q-opt[data-qid="spicy"][data-val="Mild"]').click();
    assert.ok(doc.querySelector('#q-use-saved').hidden);
    doc.querySelector('#q-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(submitted.spicy, 'Mild');
    assert.equal(JSON.parse(w.localStorage.getItem('q_eat')).spicy, 'Mild');
  } finally { w.close(); }
});

test('profile controls work while the profile request is still pending', async () => {
  const { dom, doc, api, w } = await setup('#/');
  try {
    let finish;
    api.get = () => new Promise(resolve => finish = resolve);
    w.localStorage.setItem('q_eat', '{}');
    w.alert = () => {};
    w.location.hash = '#/profile';
    await tick();
    doc.querySelector('#btn-clear-eat').click();
    assert.equal(w.localStorage.getItem('q_eat'), null);
    finish({ name: 'Test traveler', structured: {} });
    await tick();
  } finally { w.close(); }
});
