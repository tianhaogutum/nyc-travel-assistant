const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
  const values = new Map();
  const context = vm.createContext({
    localStorage: {
      getItem: key => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, String(value)),
    },
  });
  vm.runInContext(fs.readFileSync('js/config.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('js/api.js', 'utf8'), context);
  return { geo: vm.runInContext('Geo', context), values };
}

test('custom coordinates reject blank, partially numeric and out-of-range values', async () => {
  const { geo } = setup();
  geo.setLocMode('custom');
  for (const latitude of ['', '  ', '40.75wrong', 'Infinity', '91']) {
    geo.setCustomLat(latitude);
    await assert.rejects(geo.getLocation(), /valid latitude/);
  }
  geo.setCustomLat('0');
  geo.setCustomLng('0');
  const location = await geo.getLocation();
  assert.equal(location.lat, 0);
  assert.equal(location.lng, 0);
});

test('invalid persisted mode, area and test index use valid defaults', () => {
  const { geo, values } = setup();
  values.set('loc_mode', 'bad');
  values.set('data_source', 'bad');
  values.set('test_location', '-1');
  assert.equal(geo.getLocMode(), 'test');
  assert.equal(geo.getDataSource(), 'manhattan');
  assert.equal(geo.getTestLocationIndex(), 0);
});
