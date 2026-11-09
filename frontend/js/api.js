/* API requests are cancellable and bounded; SSE supports split UTF-8 and CRLF. */
const Api = {
  async request(path, options = {}, timeoutMs = 20000) {
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    const res = await fetch(`${CONFIG.API_BASE}${path}`, { ...options, signal });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res;
  },

  async post(path, body, signal) {
    const res = await this.request(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal,
    }, 330000);
    return res.json();
  },

  async get(path, signal) {
    const res = await this.request(path, { signal });
    return res.json();
  },

  async stream(path, body, onEvent, signal) {
    const res = await this.request(path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal,
    }, 330000);
    if (!res.body) throw new Error('Streaming is not supported by this response.');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let completed = false;
    const dispatch = frame => {
      const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).replace(/^ /, '')).join('\n');
      if (!data) return;
      if (data === '[DONE]') { completed = true; return; }
      onEvent(JSON.parse(data));
    };
    try {
      while (!completed) {
        const { done, value } = await reader.read();
        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        let boundary;
        while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
          dispatch(buffer.slice(0, boundary.index));
          buffer = buffer.slice(boundary.index + boundary[0].length);
          if (completed) break;
        }
        if (done) {
          if (buffer.trim() && !completed) dispatch(buffer);
          if (!completed) throw new Error('Connection interrupted. Please try again.');
          break;
        }
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  },
};

/* ----- Geo: gps / test / custom location ----- */
const Geo = {
  // loc_mode: 'gps' | 'test' | 'custom'
  getLocMode() {
    const mode = localStorage.getItem(CONFIG.STORAGE_KEY_LOC_MODE);
    return ['gps', 'test', 'custom'].includes(mode) ? mode : 'test';
  },
  setLocMode(m) {
    localStorage.setItem(CONFIG.STORAGE_KEY_LOC_MODE, m);
    // keep legacy test flag in sync
    localStorage.setItem(CONFIG.STORAGE_KEY_TEST, m === 'test' ? '1' : '0');
  },

  isTestMode() { return this.getLocMode() === 'test'; },
  setTestMode(on) { this.setLocMode(on ? 'test' : 'gps'); },

  getTestLocationIndex() {
    const index = Number(localStorage.getItem(CONFIG.STORAGE_KEY_TEST_LOC));
    return Number.isInteger(index) && index >= 0 && index < TEST_LOCATIONS.length ? index : 0;
  },
  setTestLocationIndex(i) {
    localStorage.setItem(CONFIG.STORAGE_KEY_TEST_LOC, String(i));
  },
  getTestLocation() {
    const loc = TEST_LOCATIONS[this.getTestLocationIndex()] || TEST_LOCATIONS[0];
    return { lat: loc.lat, lng: loc.lng };
  },

  getCustomLat() { return this._coordinate(CONFIG.STORAGE_KEY_CUSTOM_LAT, 40.7580); },
  getCustomLng() { return this._coordinate(CONFIG.STORAGE_KEY_CUSTOM_LNG, -73.9855); },
  _coordinate(key, defaultValue) {
    const value = localStorage.getItem(key);
    if (value === null) return defaultValue;
    return value.trim() ? Number(value) : NaN;
  },
  setCustomLat(v) { localStorage.setItem(CONFIG.STORAGE_KEY_CUSTOM_LAT, v); },
  setCustomLng(v) { localStorage.setItem(CONFIG.STORAGE_KEY_CUSTOM_LNG, v); },

  /* returns Promise<{lat, lng}> */
  async getLocation() {
    const mode = this.getLocMode();
    if (mode === 'test') return this.getTestLocation();
    if (mode === 'custom') {
      const lat = this.getCustomLat(), lng = this.getCustomLng();
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        throw new Error('Please enter valid latitude (-90 to 90) and longitude (-180 to 180).');
      }
      return { lat, lng };
    }
    // gps
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Browser does not support geolocation. Please use custom coordinates instead.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => reject(new Error('GPS location failed. HTTPS is required for GPS access via IP. Please use custom coordinates mode.')),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  },

  getDataSource() {
    const source = localStorage.getItem(CONFIG.STORAGE_KEY_DS);
    return ['manhattan', 'brooklyn'].includes(source) ? source : CONFIG.DEFAULT_DATA_SOURCE;
  },
  setDataSource(ds) {
    localStorage.setItem(CONFIG.STORAGE_KEY_DS, ds);
  },
};