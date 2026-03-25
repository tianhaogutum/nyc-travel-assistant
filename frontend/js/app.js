/* ===== app.js – SPA Router & Page Renderers ===== */
(function () {
  const $app = document.getElementById('app');

  /* ===== Onboarding helpers ===== */
  function isOnboarded() {
    return localStorage.getItem(CONFIG.STORAGE_KEY_ONBOARDED) === '1';
  }
  function markOnboarded() {
    localStorage.setItem(CONFIG.STORAGE_KEY_ONBOARDED, '1');
  }

  /* ===== PAGE: Onboarding ===== */
  function pageOnboarding() {
    let idx = 0;
    function renderSlide() {
      const s = ONBOARDING_SLIDES[idx];
      const isLast = idx === ONBOARDING_SLIDES.length - 1;
      const isFirst = idx === 0;

      const dots = ONBOARDING_SLIDES.map((_, i) =>
        `<span class="onb-dot${i === idx ? ' active' : ''}"></span>`
      ).join('');

      const textHtml = s.text ? s.text.split('\n').map(l => `<p>${l}</p>`).join('') : '';

      $app.innerHTML = `
        <div class="onb-page ${s.bg || ''}">
          <div class="onb-content fade-up">
            ${Samoyed.render(s.dog)}
            ${s.title ? `<h1 class="onb-title">${s.title}</h1>` : ''}
            ${textHtml ? `<div class="onb-text">${textHtml}</div>` : ''}
          </div>
          <div class="onb-footer">
            <div class="onb-dots">${dots}</div>
            <div class="onb-btns">
              ${!isFirst ? '<button class="btn btn-outline btn-sm" id="onb-prev">上一步</button>' : '<div></div>'}
              <button class="btn btn-primary btn-sm" id="onb-next">${isLast ? '🐾 出發！' : '下一步 →'}</button>
            </div>
          </div>
        </div>`;

      document.getElementById('onb-next').addEventListener('click', () => {
        if (isLast) {
          markOnboarded();
          location.hash = '#/';
        } else {
          idx++;
          renderSlide();
        }
      });
      const prevBtn = document.getElementById('onb-prev');
      if (prevBtn) prevBtn.addEventListener('click', () => { idx--; renderSlide(); });
    }
    renderSlide();
  }

  /* ===== top bar (data source + test mode) ===== */
  function getRadius() {
    return parseFloat(localStorage.getItem(CONFIG.STORAGE_KEY_RADIUS)) || CONFIG.DEFAULT_RADIUS;
  }
  function setRadius(v) { localStorage.setItem(CONFIG.STORAGE_KEY_RADIUS, v); }
  function getMode() {
    return localStorage.getItem(CONFIG.STORAGE_KEY_MODE) || 'ai';
  }
  function setMode(v) { localStorage.setItem(CONFIG.STORAGE_KEY_MODE, v); }

  function renderTopBar() {
    const ds = Geo.getDataSource();
    const mode = Geo.getLocMode();
    const tli = Geo.getTestLocationIndex();
    const locOpts = TEST_LOCATIONS.map((l, i) =>
      `<option value="${i}"${i === tli ? ' selected' : ''}>${l.label}</option>`
    ).join('');
    const customLat = Geo.getCustomLat();
    const customLng = Geo.getCustomLng();

    return `<div class="topbar">
      <select id="sel-ds" class="topbar-select">
        <option value="manhattan"${ds === 'manhattan' ? ' selected' : ''}>Manhattan</option>
        <option value="brooklyn"${ds === 'brooklyn' ? ' selected' : ''}>Brooklyn</option>
      </select>
      <div class="loc-mode-toggle">
        <button class="loc-btn${mode === 'test' ? ' active' : ''}" data-mode="test">🧪 測試</button>
        <button class="loc-btn${mode === 'custom' ? ' active' : ''}" data-mode="custom">✏️ 自訂</button>
      </div>
      ${mode === 'test' ? `<div id="loc-sub"><select id="sel-test-loc" class="topbar-select">${locOpts}</select></div>` : ''}
      ${mode === 'custom' ? `<div id="loc-sub"><div class="custom-loc-inputs">
        <input id="inp-lat" class="loc-input" type="number" step="0.0001" placeholder="緯度 lat" value="${customLat}">
        <input id="inp-lng" class="loc-input" type="number" step="0.0001" placeholder="經度 lng" value="${customLng}">
      </div></div>` : ''}
    </div>`;
  }

  function wireTopBar() {
    const selDs = document.getElementById('sel-ds');
    if (selDs) selDs.addEventListener('change', () => Geo.setDataSource(selDs.value));

    document.querySelectorAll('.loc-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        Geo.setLocMode(btn.dataset.mode);
        // re-render topbar in place
        const topbar = document.querySelector('.topbar');
        if (topbar) {
          topbar.outerHTML = renderTopBar();
          wireTopBar();
        }
      });
    });

    const selLoc = document.getElementById('sel-test-loc');
    if (selLoc) selLoc.addEventListener('change', () => Geo.setTestLocationIndex(+selLoc.value));

    const inpLat = document.getElementById('inp-lat');
    const inpLng = document.getElementById('inp-lng');
    if (inpLat) inpLat.addEventListener('change', () => Geo.setCustomLat(inpLat.value));
    if (inpLng) inpLng.addEventListener('change', () => Geo.setCustomLng(inpLng.value));
  }

  /* ===== nav footer ===== */
  function renderNav(active) {
    const items = [
      { hash: '#/',        icon: '🏠', label: '首頁' },
      { hash: '#/eat',     icon: '🍜', label: '美食' },
      { hash: '#/explore', icon: '🗽', label: '探索' },
      { hash: '#/profile', icon: '🐾', label: '我的' },
    ];
    return `<nav class="bottom-nav">${items.map(it =>
      `<a href="${it.hash}" class="nav-item${it.hash === active ? ' active' : ''}">${it.icon}<span>${it.label}</span></a>`
    ).join('')}</nav>`;
  }

  /* ===== PAGE: Home ===== */
  function pageHome() {
    $app.innerHTML = renderTopBar() + `
      <div class="page fade-up">
        ${Samoyed.render('idle')}
        <h1 class="hero-title">NYC 旅行助手</h1>
        <p class="hero-sub">你的紐約吃喝玩樂 AI 嚮導 🗽</p>
        <div class="home-cards">
          <a href="#/eat" class="home-card card-eat">
            <span class="home-card-icon">🍜</span>
            <span class="home-card-label">找美食</span>
          </a>
          <a href="#/explore" class="home-card card-explore">
            <span class="home-card-icon">🗽</span>
            <span class="home-card-label">去探索</span>
          </a>
        </div>
      </div>` + renderNav('#/');
    wireTopBar();
  }

  /* ===== PAGE: Eat questionnaire ===== */
  function renderPipelineSettings() {
    const r = getRadius();
    const m = getMode();
    return `
      <div class="pipe-settings">
        <div class="pipe-row">
          <label class="pipe-label">📍 搜索範圍</label>
          <div class="pipe-radius">
            <input type="range" id="inp-radius" min="0.5" max="100" step="0.5" value="${r}">
            <span id="lbl-radius">${r} km</span>
          </div>
        </div>
        <div class="pipe-row">
          <label class="pipe-label">⚡ 模式</label>
          <div class="pipe-mode-toggle">
            <button class="mode-btn${m === 'ai' ? ' active' : ''}" data-mode="ai">🧠 懂你 mode</button>
            <button class="mode-btn${m === 'raw' ? ' active' : ''}" data-mode="raw">📊 直接返回 mode</button>
          </div>
        </div>
        <div class="pipe-row" id="label-row"><label class="pipe-label">🏷️ 細分類型</label><div id="label-container"><span class="pipe-hint">載入中…</span></div></div>
      </div>`;
  }

  let _selectedLabels = [];

  const LABEL_ZH = {
    american_restaurant: '美式餐廳',
    asian_restaurant: '亞洲料理',
    bagel_shop: '貝果店',
    bakery: '麵包烘焙',
    bar: '酒吧',
    bar_and_grill: '燒烤酒吧',
    barbecue_restaurant: '燒烤餐廳',
    breakfast_restaurant: '早餐餐廳',
    british_restaurant: '英式餐廳',
    brunch_restaurant: '早午餐',
    cafe: '咖啡廳',
    cantonese_restaurant: '粵菜餐廳',
    caribbean_restaurant: '加勒比海料理',
    chinese_restaurant: '中餐廳',
    cocktail_bar: '調酒吧',
    coffee_shop: '咖啡店',
    deli: '熟食店',
    dessert_restaurant: '甜品餐廳',
    dessert_shop: '甜品店',
    dim_sum_restaurant: '點心餐廳',
    diner: '美式小館',
    ethiopian_restaurant: '衣索比亞料理',
    fine_dining_restaurant: '精緻餐廳',
    food_court: '美食廣場',
    french_restaurant: '法式餐廳',
    fusion_restaurant: '創意融合料理',
    gastropub: '美食酒館',
    greek_restaurant: '希臘餐廳',
    grocery_store: '雜貨店',
    hamburger_restaurant: '漢堡店',
    hot_pot_restaurant: '火鍋餐廳',
    ice_cream_shop: '冰淇淋店',
    indian_restaurant: '印度餐廳',
    italian_restaurant: '義式餐廳',
    japanese_izakaya_restaurant: '日式居酒屋',
    japanese_restaurant: '日式餐廳',
    korean_barbecue_restaurant: '韓式烤肉',
    korean_restaurant: '韓式餐廳',
    latin_american_restaurant: '拉丁美洲料理',
    lebanese_restaurant: '黎巴嫩料理',
    lounge_bar: '休閒酒吧',
    meal_delivery: '外送餐廳',
    meal_takeaway: '外帶餐廳',
    mediterranean_restaurant: '地中海料理',
    mexican_restaurant: '墨西哥餐廳',
    middle_eastern_restaurant: '中東料理',
    north_indian_restaurant: '北印度料理',
    pastry_shop: '西點店',
    peruvian_restaurant: '秘魯料理',
    pizza_restaurant: '披薩店',
    ramen_restaurant: '拉麵店',
    restaurant: '餐廳',
    sandwich_shop: '三明治店',
    seafood_restaurant: '海鮮餐廳',
    south_american_restaurant: '南美料理',
    spanish_restaurant: '西班牙料理',
    sports_bar: '運動酒吧',
    steak_house: '牛排館',
    supermarket: '超市',
    sushi_restaurant: '壽司餐廳',
    taco_restaurant: '墨西哥塔可',
    taiwanese_restaurant: '台灣料理',
    tapas_restaurant: '西班牙小吃',
    tea_house: '茶館',
    thai_restaurant: '泰式餐廳',
    turkish_restaurant: '土耳其料理',
    vegan_restaurant: '純素餐廳',
    vegetarian_restaurant: '素食餐廳',
    vietnamese_restaurant: '越南料理',
    wine_bar: '葡萄酒吧',
  };

  function _labelDisplay(raw) {
    const en = raw.replace(/_/g, ' ');
    const zh = LABEL_ZH[raw];
    return zh ? `${en} · ${zh}` : en;
  }

  function _updateLabelToggleText() {
    const toggle = document.getElementById('label-toggle-btn');
    if (!toggle) return;
    toggle.textContent = _selectedLabels.length
      ? `已選 ${_selectedLabels.length} 種 ▼`
      : '全部類型 ▼';
  }

  async function loadLabels(dataSource, category) {
    const container = document.getElementById('label-container');
    if (!container) return;
    _selectedLabels = [];
    try {
      const data = await Api.get(`/api/labels?data_source=${dataSource}&category=${category}`);
      const labels = data.labels || [];
      if (!labels.length) { container.innerHTML = '<span class="pipe-hint">無類型資料</span>'; return; }

      const optItems = labels.map(l =>
        `<label class="label-option">
          <input type="checkbox" value="${l.label}">
          <span>${_labelDisplay(l.label)}</span>
          <span class="label-count">${l.count}</span>
        </label>`
      ).join('');

      container.innerHTML = `
        <button class="label-toggle-btn" id="label-toggle-btn">全部類型 ▼</button>
        <div class="label-dropdown" id="label-dropdown" style="display:none">
          <label class="label-option label-clear">
            <input type="checkbox" id="label-all" checked>
            <span>全部（不篩選）</span>
          </label>
          ${optItems}
        </div>`;

      const dropdown = container.querySelector('#label-dropdown');
      const toggleBtn = container.querySelector('#label-toggle-btn');
      const allChk = container.querySelector('#label-all');

      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = dropdown.style.display === 'none';
        dropdown.style.display = open ? '' : 'none';
        toggleBtn.textContent = (open ? '▲ ' : '') + (toggleBtn.textContent.replace(/^▲ /, ''));
      });

      document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
          dropdown.style.display = 'none';
          _updateLabelToggleText();
        }
      });

      container.querySelectorAll('input[type=checkbox]:not(#label-all)').forEach(chk => {
        chk.addEventListener('change', () => {
          if (chk.checked) {
            allChk.checked = false;
            _selectedLabels.push(chk.value);
          } else {
            _selectedLabels = _selectedLabels.filter(v => v !== chk.value);
            if (_selectedLabels.length === 0) allChk.checked = true;
          }
          _updateLabelToggleText();
        });
      });

      allChk.addEventListener('change', () => {
        if (allChk.checked) {
          _selectedLabels = [];
          container.querySelectorAll('input[type=checkbox]:not(#label-all)').forEach(c => c.checked = false);
          _updateLabelToggleText();
        }
      });

    } catch { container.innerHTML = '<span class="pipe-hint">載入失敗</span>'; }
  }

  function wirePipelineSettings() {
    const inp = document.getElementById('inp-radius');
    const lbl = document.getElementById('lbl-radius');
    if (inp) inp.addEventListener('input', () => {
      setRadius(inp.value);
      lbl.textContent = `${inp.value} km`;
    });
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        setMode(btn.dataset.mode);
      });
    });
  }

  function pageEat() {
    const m = getMode();
    $app.innerHTML = renderTopBar() + `
      <div class="page fade-up">
        ${Samoyed.render('think')}
        ${renderPipelineSettings()}
        <div id="q-container"></div>
        ${m === 'raw' ? '<button class="btn btn-primary" id="btn-raw-go" style="margin-top:12px">🚀 直接返回</button>' : ''}
      </div>` + renderNav('#/eat');
    wireTopBar();
    wirePipelineSettings();
    loadLabels(Geo.getDataSource(), 'food_drink');
    if (m === 'raw') {
      document.getElementById('btn-raw-go')?.addEventListener('click', () => runEatPipeline({}));
    } else {
      const qc = document.getElementById('q-container');
      Questionnaire.render(QUESTIONNAIRE_A, qc, (answers) => runEatPipeline(answers));
    }
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => setTimeout(() => pageEat(), 50));
    });
  }

  /* ===== PAGE: Explore category picker ===== */
  function pageExplore() {
    const m = getMode();
    const cats = EXPLORE_CATEGORIES.map(c =>
      `<div class="cat-card" data-cat="${c.id}" style="--cat-color:${c.color}">
        <span class="cat-icon">${c.icon}</span>
        <span class="cat-label">${c.label}</span>
      </div>`
    ).join('');

    $app.innerHTML = renderTopBar() + `
      <div class="page fade-up">
        ${Samoyed.render('explore', '想探索什麼類型？')}
        ${renderPipelineSettings()}
        <div class="cat-grid">${cats}</div>
        <div id="explore-action-panel" style="display:none">
          ${m === 'raw'
            ? '<button class="btn btn-primary" id="btn-raw-explore" style="margin-top:12px">🚀 直接返回</button>'
            : '<button class="btn btn-primary" id="btn-ai-explore" style="margin-top:12px">🧠 繼續 →</button>'
          }
        </div>
      </div>` + renderNav('#/explore');
    wireTopBar();
    wirePipelineSettings();

    document.querySelectorAll('.cat-card').forEach(el => {
      el.addEventListener('click', () => {
        window._exploreCategory = el.dataset.cat;
        document.querySelectorAll('.cat-card').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
        _selectedLabels = [];
        const panel = document.getElementById('explore-action-panel');
        if (panel) panel.style.display = '';
        loadLabels(Geo.getDataSource(), el.dataset.cat);
        /* re-wire action button after label reload */
        setTimeout(() => {
          document.getElementById('btn-raw-explore')?.addEventListener('click', () => {
            runExplorePipeline(window._exploreCategory || 'culture', {});
          });
          document.getElementById('btn-ai-explore')?.addEventListener('click', () => {
            location.hash = '#/explore/questionnaire';
          });
        }, 0);
      });
    });

    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => setTimeout(() => pageExplore(), 50));
    });
  }

  /* ===== PAGE: Explore questionnaire ===== */
  function pageExploreQ() {
    $app.innerHTML = renderTopBar() + `
      <div class="page fade-up">
        ${Samoyed.render('think')}
        <div id="q-container"></div>
      </div>` + renderNav('#/explore');
    wireTopBar();
    const qc = document.getElementById('q-container');
    Questionnaire.render(QUESTIONNAIRE_B, qc, (answers) => {
      runExplorePipeline(window._exploreCategory || 'culture', answers);
    });
  }

  /* ===== PAGE: Loading ===== */
  function pageLoading(label) {
    $app.innerHTML = `
      <div class="page fade-up loading-page">
        ${Samoyed.render('loading')}
        <p class="loading-text">${label || '正在分析中，請稍等…'}</p>
        <div class="loading-bar"><div class="loading-bar-inner"></div></div>
        <div class="loading-steps">
          <p class="l-step">📊 從 Google 評分資料庫篩選附近好店…</p>
          <p class="l-step">🔍 搜尋網路上的真實差評…</p>
          <p class="l-step">🧠 結合你的偏好 + AI 知識進行排序…</p>
        </div>
      </div>`;
  }

  /* ===== PAGE: Results ===== */
  function pageResults(data, backHash) {
    if (data.error) {
      $app.innerHTML = renderTopBar() + `
        <div class="page fade-up">
          ${Samoyed.render('sad', data.error)}
          <button id="btn-retry" class="btn btn-primary">返回重試</button>
        </div>` + renderNav(backHash);
      wireTopBar();
      document.getElementById('btn-retry').addEventListener('click', () => {
        if (backHash === '#/eat') pageEat();
        else if (backHash === '#/explore') pageExplore();
        else location.hash = backHash;
      });
      return;
    }

    const eggs = EasterEggs.check(data.rankings || []);
    const eggHtml = EasterEggs.renderBanners(eggs);

    /* reasoning methodology banner */
    const reasoningBanner = `
      <div class="reasoning-banner">
        <p class="reasoning-oneliner">🧠 綜合你的偏好、Google 數據、AI 知識、網路差評與編輯推薦，為你排序。</p>
      </div>`;

    const cards = (data.rankings || []).map(r => {
      const topCls = r.rank <= 3 ? ' top' : '';
      const comment = Samoyed.commentForRank(r.rank);
      const highlightsHtml = (r.highlights || []).map(h => `<span class="tag tag-pro">✓ ${h}</span>`).join('');
      const warningsHtml = (r.warnings || []).map(w => `<span class="tag tag-con">⚠ ${w}</span>`).join('');

      /* per-card reasoning breakdown */
      const rs = r.reasoning_sources || {};
      let reasoningHtml = '';
      if (rs.user_pref || rs.google_data || rs.llm_knowledge || rs.negative_reviews || rs.online_editorial) {
        reasoningHtml = `
          <div class="r-reasoning">
            <p class="r-reasoning-title">📐 排名依據</p>
            ${rs.user_pref ? `<p class="rr-line"><span class="rr-tag rr-user">👤 偏好</span> ${rs.user_pref}</p>` : ''}
            ${rs.google_data ? `<p class="rr-line"><span class="rr-tag rr-google">📊 數據</span> ${rs.google_data}</p>` : ''}
            ${rs.llm_knowledge ? `<p class="rr-line"><span class="rr-tag rr-ai">🧠 AI</span> ${rs.llm_knowledge}</p>` : ''}
            ${rs.negative_reviews ? `<p class="rr-line"><span class="rr-tag rr-neg">🔍 差評</span> ${rs.negative_reviews}</p>` : ''}
            ${rs.online_editorial ? `<p class="rr-line"><span class="rr-tag rr-editorial">📰 編輯推薦</span> ${rs.online_editorial}</p>` : ''}
          </div>`;
      }

      /* raw DuckDuckGo snippets */
      const snippets = r.neg_review_snippets || [];
      let negSnippetsHtml = '';
      if (snippets.length > 0) {
        const snippetItems = snippets.map(s => `<li class="neg-snippet">${s}</li>`).join('');
        negSnippetsHtml = `
          <details class="neg-snippets-block">
            <summary class="neg-snippets-title">🔎 DuckDuckGo 原始差評（${snippets.length} 條）</summary>
            <ul class="neg-snippets-list">${snippetItems}</ul>
          </details>`;
      }

      return `
        <div class="r-card${topCls} fade-up">
          <div class="r-header">
            <span class="r-rank">#${r.rank}</span>
            <span class="r-name">${r.name}</span>
            ${r.rating ? `<span class="r-rating">⭐${r.rating}</span>` : ''}
          </div>
          <p class="r-comment">${comment}</p>
          ${r.description ? `<p class="r-desc">${r.description}</p>` : ''}
          ${r.review ? `<div class="r-review">${r.review}</div>` : ''}
          ${r.recommendation ? `<p class="r-rec">${r.recommendation}</p>` : ''}
          <div class="r-tags">${highlightsHtml}${warningsHtml}</div>
          ${negSnippetsHtml}
          ${reasoningHtml}
          <div class="r-meta">
            ${r.primary_type ? `<span>${r.primary_type}</span>` : ''}
            ${r.price_level ? `<span>${r.price_level}</span>` : ''}
            ${r.distance_m ? `<span>${r.distance_m}m</span>` : ''}
            ${r.review_count ? `<span>${r.review_count}條評價</span>` : ''}
          </div>
        </div>`;
    }).join('');

    const meta = `
      <div class="result-meta">
        找到 ${data.total} 個結果 · ${data.data_source} · ${data.radius_km}km
        ${data.category ? ` · ${data.category}` : ''}
        · ${data.pipeline_time_ms}ms
      </div>`;

    $app.innerHTML = renderTopBar() + `
      <div class="page fade-up">
        ${Samoyed.render('happy')}
        ${eggHtml}
        ${meta}
        ${reasoningBanner}
        <button id="btn-again" class="btn btn-outline" style="margin-bottom:16px;">🔄 再來一次</button>
        <div class="result-list">${cards}</div>
      </div>` + renderNav(backHash);
    wireTopBar();
    document.getElementById('btn-again').addEventListener('click', () => {
      if (backHash === '#/eat') pageEat();
      else if (backHash === '#/explore') pageExplore();
      else location.hash = backHash;
    });
  }

  /* ===== PAGE: Profile ===== */
  async function pageProfile() {
    $app.innerHTML = renderTopBar() + `
      <div class="page fade-up">
        ${Samoyed.render('idle', '這是你的個人資訊～')}
        <div id="profile-box"><p>載入中…</p></div>
        <div class="profile-section">
          <h3>📋 問卷管理</h3>
          <div class="profile-q-actions">
            <button class="btn btn-sm" id="btn-clear-eat">清除美食問卷</button>
            <button class="btn btn-sm" id="btn-clear-explore">清除探索問卷</button>
          </div>
        </div>
        <div class="profile-section">
          <h3>🔄 重新觀看歡迎故事</h3>
          <button class="btn btn-sm btn-outline" id="btn-replay-onb">重播歡迎動畫</button>
        </div>
      </div>` + renderNav('#/profile');
    wireTopBar();

    // load profile
    try {
      const p = await Api.get('/api/profile');
      const box = document.getElementById('profile-box');
      if (box) {
        box.innerHTML = `
          <div class="profile-section">
            <h3>👤 ${p.name || 'User'}</h3>
            <p>${p.summary || ''}</p>
          </div>
          ${p.structured ? renderStructured(p.structured) : ''}`;
      }
    } catch (e) {
      const box = document.getElementById('profile-box');
      if (box) box.innerHTML = `<p class="err">無法載入 profile：${e.message}</p>`;
    }

    document.getElementById('btn-clear-eat')?.addEventListener('click', () => {
      Questionnaire.clear('eat');
      alert('已清除美食問卷');
    });
    document.getElementById('btn-clear-explore')?.addEventListener('click', () => {
      Questionnaire.clear('explore');
      alert('已清除探索問卷');
    });
    document.getElementById('btn-replay-onb')?.addEventListener('click', () => {
      localStorage.removeItem(CONFIG.STORAGE_KEY_ONBOARDED);
      location.hash = '#/welcome';
    });
  }

  function renderStructured(s) {
    const entries = Object.entries(s).map(([k, v]) => {
      let val = v;
      if (Array.isArray(v)) val = v.join('、');
      else if (typeof v === 'object' && v !== null) val = Object.entries(v).map(([sk, sv]) => `${sk}: ${Array.isArray(sv) ? sv.join('、') : sv}`).join(' · ');
      return `<div class="profile-row"><span class="profile-key">${k}</span><span class="profile-val">${val}</span></div>`;
    }).join('');
    return `<div class="profile-section"><h3>🗂 詳細資訊</h3>${entries}</div>`;
  }

  /* ===== Pipeline runners ===== */
  async function runEatPipeline(answers) {
    const mode = getMode();
    pageLoading(mode === 'raw' ? '📊 直接返回附近結果…' : '🧠 懂你 mode 分析中…');
    try {
      const loc = await Geo.getLocation();
      const res = await Api.post('/api/eat', {
        latitude: loc.lat,
        longitude: loc.lng,
        radius_km: getRadius(),
        data_source: Geo.getDataSource(),
        mode: mode,
        labels: _selectedLabels,
        questionnaire: answers,
      });
      pageResults(res, '#/eat');
    } catch (e) {
      pageResults({ error: e.message, rankings: [], total: 0, radius_km: 0, data_source: '', pipeline_time_ms: 0 }, '#/eat');
    }
  }

  async function runExplorePipeline(category, answers) {
    const mode = getMode();
    pageLoading(mode === 'raw' ? '📊 直接返回附近結果…' : '🧠 懂你 mode 分析中…');
    try {
      const loc = await Geo.getLocation();
      const res = await Api.post('/api/explore', {
        latitude: loc.lat,
        longitude: loc.lng,
        radius_km: getRadius(),
        data_source: Geo.getDataSource(),
        category: category,
        mode: mode,
        labels: _selectedLabels,
        questionnaire: answers,
      });
      pageResults(res, '#/explore');
    } catch (e) {
      pageResults({ error: e.message, rankings: [], total: 0, radius_km: 0, data_source: '', pipeline_time_ms: 0 }, '#/explore');
    }
  }

  /* ===== Router ===== */
  function route() {
    const hash = location.hash || '#/';
    /* redirect to onboarding if first visit */
    if (!isOnboarded() && hash !== '#/welcome') {
      location.hash = '#/welcome';
      return;
    }
    if (hash === '#/welcome') pageOnboarding();
    else if (hash === '#/' || hash === '#') pageHome();
    else if (hash === '#/eat')  pageEat();
    else if (hash === '#/explore') pageExplore();
    else if (hash === '#/explore/questionnaire') pageExploreQ();
    else if (hash === '#/profile') pageProfile();
    else pageHome();
  }

  window.addEventListener('hashchange', route);
  window.addEventListener('DOMContentLoaded', route);
})();