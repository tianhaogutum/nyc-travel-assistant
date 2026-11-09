const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function apiFor(text, size = 1) {
  const encoded = new TextEncoder().encode(text);
  let cancelled = false, released = false, offset = 0;
  const reader = {
    async read() {
      if (offset >= encoded.length) return { done: true };
      const value = encoded.slice(offset, offset + size);
      offset += size;
      return { value, done: false };
    },
    async cancel() { cancelled = true; },
    releaseLock() { released = true; },
  };
  const context = vm.createContext({ CONFIG: { API_BASE: '' }, TextDecoder, AbortSignal,
    fetch: async () => ({ ok: true, body: { getReader: () => reader } }) });
  vm.runInContext(fs.readFileSync('js/api.js', 'utf8'), context);
  return { api: vm.runInContext('Api', context), closed: () => cancelled && released };
}
test('SSE handles split UTF-8, CRLF, comments and exact DONE marker', async () => {
  const { api, closed } = apiFor(': heartbeat\r\n\r\ndata:{"name":"紐約 [DONE] cafe"}\r\n\r\ndata: [DONE]\r\n\r\n');
  const events = [];
  await api.stream('/stream', {}, e => events.push(e));
  assert.equal(events.length, 1);
  assert.equal(events[0].name, '紐約 [DONE] cafe');
  assert.ok(closed());
});
test('SSE accepts final DONE without trailing blank line', async () => {
  const { api } = apiFor('data: {"ok":true}\n\ndata: [DONE]', 1000);
  let count = 0;
  await api.stream('/', {}, () => count++);
  assert.equal(count, 1);
});
test('truncated SSE preserves delivered events and reports interruption', async () => {
  const { api, closed } = apiFor('data: {"type":"cold"}\n\n');
  const events = [];
  await assert.rejects(api.stream('/', {}, e => events.push(e)), /interrupted/);
  assert.equal(events.length, 1);
  assert.ok(closed());
});
test('malformed events clean up reader', async () => {
  const { api, closed } = apiFor('data: nope\n\n');
  await assert.rejects(api.stream('/', {}, () => {}));
  assert.ok(closed());
});
