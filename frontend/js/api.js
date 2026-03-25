/* ===== api.js – API client & Geo with test mode ===== */
const Api = {
  async post(path, body) {
    const res = await fetch(`${CONFIG.API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  },

  async get(path) {
    const res = await fetch(`${CONFIG.API_BASE}${path}`);
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  },
};

/* ----- Geo: gps / test / custom location ----- */
const Geo = {
  // loc_mode: 'gps' | 'test' | 'custom'
  getLocMode() {
    return localStorage.getItem(CONFIG.STORAGE_KEY_LOC_MODE) || 'test';
  },
  setLocMode(m) {
    localStorage.setItem(CONFIG.STORAGE_KEY_LOC_MODE, m);
    // keep legacy test flag in sync
    localStorage.setItem(CONFIG.STORAGE_KEY_TEST, m === 'test' ? '1' : '0');
  },

  isTestMode() { return this.getLocMode() === 'test'; },
  setTestMode(on) { this.setLocMode(on ? 'test' : 'gps'); },

  getTestLocationIndex() {
    return parseInt(localStorage.getItem(CONFIG.STORAGE_KEY_TEST_LOC) || '0', 10);
  },
  setTestLocationIndex(i) {
    localStorage.setItem(CONFIG.STORAGE_KEY_TEST_LOC, String(i));
  },
  getTestLocation() {
    const loc = TEST_LOCATIONS[this.getTestLocationIndex()] || TEST_LOCATIONS[0];
    return { lat: loc.lat, lng: loc.lng };
  },

  getCustomLat() { return parseFloat(localStorage.getItem(CONFIG.STORAGE_KEY_CUSTOM_LAT) || '40.7580'); },
  getCustomLng() { return parseFloat(localStorage.getItem(CONFIG.STORAGE_KEY_CUSTOM_LNG) || '-73.9855'); },
  setCustomLat(v) { localStorage.setItem(CONFIG.STORAGE_KEY_CUSTOM_LAT, v); },
  setCustomLng(v) { localStorage.setItem(CONFIG.STORAGE_KEY_CUSTOM_LNG, v); },

  /* returns Promise<{lat, lng}> */
  async getLocation() {
    const mode = this.getLocMode();
    if (mode === 'test') return this.getTestLocation();
    if (mode === 'custom') return { lat: this.getCustomLat(), lng: this.getCustomLng() };
    // gps
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('瀏覽器不支援定位，請改用「自訂座標」'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => reject(new Error('GPS 定位失敗。透過 IP 訪問需 HTTPS 才能使用 GPS，請改用「自訂座標」模式')),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  },

  getDataSource() {
    return localStorage.getItem(CONFIG.STORAGE_KEY_DS) || CONFIG.DEFAULT_DATA_SOURCE;
  },
  setDataSource(ds) {
    localStorage.setItem(CONFIG.STORAGE_KEY_DS, ds);
  },
};