/* ===== app.js – SPA Router & Page Renderers ===== */
(function () {
  const $app = document.getElementById('app');

  let activeRequest = null;
  let labelRequest = null;
  let labelCategory = null;
  function cancelRequests() {
    activeRequest?.abort();
    activeRequest = null;
    labelRequest?.abort();
    labelRequest = null;
  }

  // One document listener, instead of one retained closure per label reload.
  document.addEventListener('click', event => {
    const container = document.getElementById('label-container');
    if (container && !container.contains(event.target)) {
      const dropdown = container.querySelector('#label-dropdown');
      if (dropdown) dropdown.hidden = true;
      container.querySelector('#label-toggle-btn')?.setAttribute('aria-expanded', 'false');
    }
  });

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
              ${!isFirst ? '<button class="btn btn-outline btn-sm" id="onb-prev">← Previous</button>' : '<div></div>'}
              <button class="btn btn-primary btn-sm" id="onb-next">${isLast ? '🐾 Let\'s Go!' : 'Next →'}</button>
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
    const value = Number(localStorage.getItem(CONFIG.STORAGE_KEY_RADIUS));
    return Number.isFinite(value) && value >= 0.5 && value <= 100 ? value : CONFIG.DEFAULT_RADIUS;
  }
  function setRadius(v) { localStorage.setItem(CONFIG.STORAGE_KEY_RADIUS, v); }
  function getMode() {
    return localStorage.getItem(CONFIG.STORAGE_KEY_MODE) === 'raw' ? 'raw' : 'ai';
  }
  function setMode(v) { localStorage.setItem(CONFIG.STORAGE_KEY_MODE, v); }

  function renderTopBar() {
    const ds = Geo.getDataSource();
    const mode = Geo.getLocMode();
    const tli = Geo.getTestLocationIndex();
    const locOpts = TEST_LOCATIONS.map((l, i) =>
      `<option value="${i}"${i === tli ? ' selected' : ''}>${Html.escape(l.label)}</option>`
    ).join('');
    const customLat = Geo.getCustomLat();
    const customLng = Geo.getCustomLng();

    return `<div class="topbar">
      <select id="sel-ds" aria-label="Area" class="topbar-select">
        <option value="manhattan"${ds === 'manhattan' ? ' selected' : ''}>Manhattan</option>
        <option value="brooklyn"${ds === 'brooklyn' ? ' selected' : ''}>Brooklyn</option>
      </select>
      <div class="loc-mode-toggle" role="group" aria-label="Location mode">
        <button class="loc-btn${mode === 'gps' ? ' active' : ''}" aria-pressed="${mode === 'gps'}" data-mode="gps">📍 GPS</button>
        <button class="loc-btn${mode === 'test' ? ' active' : ''}" aria-pressed="${mode === 'test'}" data-mode="test">🧪 Test</button>
        <button class="loc-btn${mode === 'custom' ? ' active' : ''}" aria-pressed="${mode === 'custom'}" data-mode="custom">✏️ Customize</button>
      </div>
      ${mode === 'test' ? `<div id="loc-sub"><select id="sel-test-loc" aria-label="Test location" class="topbar-select">${locOpts}</select></div>` : ''}
      ${mode === 'custom' ? `<div id="loc-sub"><div class="custom-loc-inputs">
        <input id="inp-lat" aria-label="Latitude" min="-90" max="90" class="loc-input" type="number" step="0.0001" placeholder="Latitude" value="${Number.isFinite(customLat) ? customLat : ''}">
        <input id="inp-lng" aria-label="Longitude" min="-180" max="180" class="loc-input" type="number" step="0.0001" placeholder="Longitude" value="${Number.isFinite(customLng) ? customLng : ''}">
      </div></div>` : ''}
    </div>`;
  }

  function wireTopBar() {
    const selDs = document.getElementById('sel-ds');
    if (selDs) selDs.addEventListener('change', () => {
      Geo.setDataSource(selDs.value);
      _selectedLabels = [];
      if (labelCategory) loadLabels(selDs.value, labelCategory);
    });

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
    if (inpLat) inpLat.addEventListener('input', () => Geo.setCustomLat(inpLat.value));
    if (inpLng) inpLng.addEventListener('input', () => Geo.setCustomLng(inpLng.value));
  }

  /* ===== nav footer ===== */
  function renderNav(active) {
    const items = [
      { hash: '#/',        icon: '🏠', label: 'Home' },
      { hash: '#/eat',     icon: '🍜', label: 'Food' },
      { hash: '#/explore', icon: '🗽', label: 'Explore' },
      { hash: '#/profile', icon: '🐾', label: 'My Profile' },
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
        <h1 class="hero-title">NYC Travel Assistant</h1>
        <p class="hero-sub">Your AI guide to eating, drinking & exploring NYC 🗽</p>
        <div class="home-cards">
          <a href="#/eat" class="home-card card-eat">
            <span class="home-card-icon">🍜</span>
            <span class="home-card-label">Find Food</span>
          </a>
          <a href="#/explore" class="home-card card-explore">
            <span class="home-card-icon">🗽</span>
            <span class="home-card-label">Explore</span>
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
          <label class="pipe-label" for="inp-radius">📍 Search Radius</label>
          <div class="pipe-radius">
            <input type="range" id="inp-radius" min="0.5" max="100" step="0.5" value="${r}">
            <span id="lbl-radius">${r} km</span>
          </div>
        </div>
        <div class="pipe-row">
          <label class="pipe-label">⚡ Mode</label>
          <div class="pipe-mode-toggle">
            <button class="mode-btn${m === 'ai' ? ' active' : ''}" data-mode="ai">🧠 Smart Mode</button>
            <button class="mode-btn${m === 'raw' ? ' active' : ''}" data-mode="raw">📊 Direct Mode</button>
          </div>
        </div>
        <div class="pipe-row" id="label-row"><label class="pipe-label">🏷️ Subcategories</label><div id="label-container"><span class="pipe-hint">Loading...</span></div></div>
      </div>`;
  }

  let _selectedLabels = [];
  const labelSelections = new Map();

  const LABEL_EN = {
    american_restaurant: 'American Restaurant',
    asian_restaurant: 'Asian Cuisine',
    bagel_shop: 'Bagel Shop',
    bakery: 'Bakery',
    bar: 'Bar',
    bar_and_grill: 'Bar & Grill',
    barbecue_restaurant: 'Barbecue Restaurant',
    breakfast_restaurant: 'Breakfast Restaurant',
    british_restaurant: 'British Restaurant',
    brunch_restaurant: 'Brunch',
    cafe: 'Café',
    cantonese_restaurant: 'Cantonese Restaurant',
    caribbean_restaurant: 'Caribbean Cuisine',
    chinese_restaurant: 'Chinese Restaurant',
    cocktail_bar: 'Cocktail Bar',
    coffee_shop: 'Coffee Shop',
    deli: 'Deli',
    dessert_restaurant: 'Dessert Restaurant',
    dessert_shop: 'Dessert Shop',
    dim_sum_restaurant: 'Dim Sum Restaurant',
    diner: 'Diner',
    ethiopian_restaurant: 'Ethiopian Cuisine',
    fine_dining_restaurant: 'Fine Dining',
    food_court: 'Food Court',
    french_restaurant: 'French Restaurant',
    fusion_restaurant: 'Fusion Cuisine',
    gastropub: 'Gastropub',
    greek_restaurant: 'Greek Restaurant',
    grocery_store: 'Grocery Store',
    hamburger_restaurant: 'Hamburger Restaurant',
    hot_pot_restaurant: 'Hot Pot Restaurant',
    ice_cream_shop: 'Ice Cream Shop',
    indian_restaurant: 'Indian Restaurant',
    italian_restaurant: 'Italian Restaurant',
    japanese_izakaya_restaurant: 'Japanese Izakaya',
    japanese_restaurant: 'Japanese Restaurant',
    korean_barbecue_restaurant: 'Korean BBQ',
    korean_restaurant: 'Korean Restaurant',
    latin_american_restaurant: 'Latin American Cuisine',
    lebanese_restaurant: 'Lebanese Cuisine',
    lounge_bar: 'Lounge Bar',
    meal_delivery: 'Meal Delivery',
    meal_takeaway: 'Takeaway',
    mediterranean_restaurant: 'Mediterranean Cuisine',
    mexican_restaurant: 'Mexican Restaurant',
    middle_eastern_restaurant: 'Middle Eastern Cuisine',
    north_indian_restaurant: 'North Indian Restaurant',
    pastry_shop: 'Pastry Shop',
    peruvian_restaurant: 'Peruvian Cuisine',
    pizza_restaurant: 'Pizza Restaurant',
    ramen_restaurant: 'Ramen Restaurant',
    restaurant: 'Restaurant',
    sandwich_shop: 'Sandwich Shop',
    seafood_restaurant: 'Seafood Restaurant',
    south_american_restaurant: 'South American Cuisine',
    spanish_restaurant: 'Spanish Restaurant',
    sports_bar: 'Sports Bar',
    steak_house: 'Steakhouse',
    supermarket: 'Supermarket',
    sushi_restaurant: 'Sushi Restaurant',
    taco_restaurant: 'Taco Restaurant',
    taiwanese_restaurant: 'Taiwanese Cuisine',
    tapas_restaurant: 'Spanish Tapas',
    tea_house: 'Tea House',
    thai_restaurant: 'Thai Restaurant',
    turkish_restaurant: 'Turkish Cuisine',
    vegan_restaurant: 'Vegan Restaurant',
    vegetarian_restaurant: 'Vegetarian Restaurant',
    vietnamese_restaurant: 'Vietnamese Cuisine',
    wine_bar: 'Wine Bar',
  };

  function _labelDisplay(raw) {
    const display = raw.replace(/_/g, ' ');
    const eng = LABEL_EN[raw];
    return eng ? eng : display;
  }

  function _updateLabelToggleText() {
    const toggle = document.getElementById('label-toggle-btn');
    if (!toggle) return;
    toggle.textContent = _selectedLabels.length
      ? `Selected ${_selectedLabels.length} ▼`
      : 'All Categories ▼';
  }

  async function loadLabels(dataSource, category) {
    const container = document.getElementById('label-container');
    if (!container) return;
    labelCategory = category;
    labelRequest?.abort();
    const controller = new AbortController();
    labelRequest = controller;
    const scope = `${dataSource}:${category}`;
    _selectedLabels = [...(labelSelections.get(scope) || [])];
    container.textContent = 'Loading...';
    try {
      const data = await Api.get(`/api/labels?data_source=${dataSource}&category=${category}`, controller.signal);
      if (controller.signal.aborted || !container.isConnected) return;
      const labels = data.labels || [];
      _selectedLabels = _selectedLabels.filter(value => labels.some(label => label.label === value));
      labelSelections.set(scope, [..._selectedLabels]);
      if (!labels.length) { container.innerHTML = '<span class="pipe-hint">No categories available</span>'; return; }

      const optItems = labels.map(l =>
        `<label class="label-option">
          <input type="checkbox" value="${Html.escape(l.label)}"${_selectedLabels.includes(l.label) ? ' checked' : ''}>
          <span>${Html.escape(_labelDisplay(l.label))}</span>
          <span class="label-count">${Html.escape(l.count)}</span>
        </label>`
      ).join('');

      container.innerHTML = `
        <button class="label-toggle-btn" id="label-toggle-btn" aria-expanded="false" aria-controls="label-dropdown">All Categories ▼</button>
        <div class="label-dropdown" id="label-dropdown" hidden>
          <label class="label-option label-clear">
            <input type="checkbox" id="label-all"${_selectedLabels.length ? '' : ' checked'}>
            <span>All (No Filter)</span>
          </label>
          ${optItems}
        </div>`;

      const dropdown = container.querySelector('#label-dropdown');
      const toggleBtn = container.querySelector('#label-toggle-btn');
      const allChk = container.querySelector('#label-all');
      _updateLabelToggleText();
      container.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          dropdown.hidden = true;
          toggleBtn.setAttribute('aria-expanded', 'false');
          toggleBtn.focus();
        }
      }, { signal: controller.signal });

      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.hidden = !dropdown.hidden;
        toggleBtn.setAttribute('aria-expanded', String(!dropdown.hidden));
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
          labelSelections.set(scope, [..._selectedLabels]);
          _updateLabelToggleText();
        });
      });

      allChk.addEventListener('change', () => {
        if (allChk.checked || _selectedLabels.length === 0) {
          allChk.checked = true;
          _selectedLabels = [];
          labelSelections.set(scope, []);
          container.querySelectorAll('input[type=checkbox]:not(#label-all)').forEach(c => c.checked = false);
          _updateLabelToggleText();
        }
      });

    } catch {
      if (!controller.signal.aborted && container.isConnected) {
        container.innerHTML = '<span class="pipe-hint">Failed to load categories</span>';
      }
    }
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
    cancelRequests();
    const m = getMode();
    $app.innerHTML = renderTopBar() + `
      <div class="page fade-up">
        ${Samoyed.render('think')}
        ${renderPipelineSettings()}
        <div id="q-container"></div>
        ${m === 'raw' ? '<button class="btn btn-primary" id="btn-raw-go" style="margin-top:12px">🚀 Get Results</button>' : ''}
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
      btn.addEventListener('click', () => pageEat());
    });
  }

  /* ===== PAGE: Explore category picker ===== */
  function pageExplore() {
    cancelRequests();
    const m = getMode();
    const cats = EXPLORE_CATEGORIES.map(c =>
      `<button type="button" aria-pressed="false" class="cat-card" data-cat="${c.id}" style="--cat-color:${c.color}">
        <span class="cat-icon">${c.icon}</span>
        <span class="cat-label">${c.label}</span>
      </button>`
    ).join('');

    $app.innerHTML = renderTopBar() + `
      <div class="page fade-up">
        ${Samoyed.render('explore', 'What would you like to explore?')}
        ${renderPipelineSettings()}
        <div class="cat-grid">${cats}</div>
        <div id="explore-action-panel" style="display:none">
          ${m === 'raw'
            ? '<button class="btn btn-primary" id="btn-raw-explore" style="margin-top:12px">🚀 Get Results</button>'
            : '<button class="btn btn-primary" id="btn-ai-explore" style="margin-top:12px">🧠 Continue →</button>'
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
        const panel = document.getElementById('explore-action-panel');
        if (panel) panel.style.display = '';
        loadLabels(Geo.getDataSource(), el.dataset.cat);
        document.querySelectorAll('.cat-card').forEach(card => {
          card.setAttribute('aria-pressed', String(card === el));
        });
      });
    });
    document.getElementById('btn-raw-explore')?.addEventListener('click', () => {
      runExplorePipeline(window._exploreCategory || 'culture', {});
    });
    document.getElementById('btn-ai-explore')?.addEventListener('click', () => {
      location.hash = '#/explore/questionnaire';
    });
    const selectedCategory = document.querySelector(`.cat-card[data-cat="${window._exploreCategory || ''}"]`);
    if (selectedCategory) selectedCategory.click();
    else {
      _selectedLabels = [];
      labelCategory = null;
      document.getElementById('label-container').textContent = 'Choose an exploration category.';
    }

    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => pageExplore());
    });
  }

  /* ===== PAGE: Explore questionnaire ===== */
  function pageExploreQ() {
    cancelRequests();
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
        <p class="loading-text">${label || 'Analyzing... Please wait'}</p>
        <div class="loading-bar"><div class="loading-bar-inner"></div></div>
        <div class="loading-steps">
          <p class="l-step">📊 Filtering nearby places from Google data...</p>
          <p class="l-step">🔍 Searching for real reviews online...</p>
          <p class="l-step">🧠 Ranking based on your preferences + AI insights...</p>
        </div>
      </div>`;
  }

  /* ===== PAGE: Results ===== */
  function pageResults(data, backHash) {
    if (data.error) {
      $app.innerHTML = renderTopBar() + `
        <div class="page fade-up">
          ${Samoyed.render('sad', data.error)}
          <button id="btn-retry" class="btn btn-primary">Try Again</button>
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
    const statusMessages = {
      cold: 'Nearby matches are ready. AI is personalizing your recommendations...',
      ai: 'Ranked using your preferences, place data and available review evidence.',
      fallback: 'AI is unavailable. Results use rating confidence and distance.',
      raw: 'Sorted by review count. No AI ranking was used.',
      empty: 'No places match these filters. Try a larger radius or another category.',
    };
    const status = data.ranking_method || data.type || 'raw';
    const reasoningBanner = `
      <div class="reasoning-banner">
        <p class="reasoning-oneliner" role="status">${Html.escape(statusMessages[status] || statusMessages.raw)}</p>
      </div>`;

    const cards = (data.rankings || []).map(r => {
      const topCls = r.rank <= 3 ? ' top' : '';
      const comment = Samoyed.commentForRank(r.rank);
      const highlightsHtml = (r.highlights || []).map(h => `<span class="tag tag-pro">✓ ${Html.escape(h)}</span>`).join('');
      const warningsHtml = (r.warnings || []).map(w => `<span class="tag tag-con">⚠ ${Html.escape(w)}</span>`).join('');

      /* per-card reasoning breakdown */
      const rs = r.reasoning_sources || {};
      let reasoningHtml = '';
      if (rs.user_pref || rs.google_data || rs.llm_knowledge || rs.negative_reviews || rs.online_editorial) {
        reasoningHtml = `
          <div class="r-reasoning">
            <p class="r-reasoning-title">📐 Ranking Breakdown</p>
            ${rs.user_pref ? `<p class="rr-line"><span class="rr-tag rr-user">👤 Preference</span> ${Html.escape(rs.user_pref)}</p>` : ''}
            ${rs.google_data ? `<p class="rr-line"><span class="rr-tag rr-google">📊 Data</span> ${Html.escape(rs.google_data)}</p>` : ''}
            ${rs.llm_knowledge ? `<p class="rr-line"><span class="rr-tag rr-ai">🧠 AI</span> ${Html.escape(rs.llm_knowledge)}</p>` : ''}
            ${rs.negative_reviews ? `<p class="rr-line"><span class="rr-tag rr-neg">🔍 Reviews</span> ${Html.escape(rs.negative_reviews)}</p>` : ''}
            ${rs.online_editorial ? `<p class="rr-line"><span class="rr-tag rr-editorial">📰 Expert Pick</span> ${Html.escape(rs.online_editorial)}</p>` : ''}
          </div>`;
      }

      /* raw DuckDuckGo snippets */
      const snippets = r.neg_review_snippets || [];
      let negSnippetsHtml = '';
      if (snippets.length > 0) {
        const snippetItems = snippets.map(s => `<li class="neg-snippet">${Html.escape(s)}</li>`).join('');
        negSnippetsHtml = `
          <details class="neg-snippets-block">
            <summary class="neg-snippets-title">🔎 DuckDuckGo Reviews (${snippets.length})</summary>
            <ul class="neg-snippets-list">${snippetItems}</ul>
          </details>`;
      }

      return `
        <div class="r-card${topCls} fade-up">
          <div class="r-header">
            <span class="r-rank">#${Html.escape(r.rank)}</span>
            <span class="r-name">${Html.escape(r.name)}</span>
            ${r.rating ? `<span class="r-rating">⭐${Html.escape(r.rating)}</span>` : ''}
          </div>
          <p class="r-comment">${comment}</p>
          ${r.description ? `<p class="r-desc">${Html.escape(r.description)}</p>` : ''}
          ${r.review ? `<div class="r-review">${Html.escape(r.review)}</div>` : ''}
          ${r.recommendation ? `<p class="r-rec">${Html.escape(r.recommendation)}</p>` : ''}
          <div class="r-tags">${highlightsHtml}${warningsHtml}</div>
          ${negSnippetsHtml}
          ${reasoningHtml}
          <div class="r-meta">
            ${r.primary_type ? `<span>${Html.escape(r.primary_type)}</span>` : ''}
            ${r.price_level ? `<span>${Html.escape(r.price_level)}</span>` : ''}
            ${r.distance_m != null ? `<span>${Html.escape(r.distance_m)}m</span>` : ''}
            ${r.review_count ? `<span>${Html.escape(r.review_count)} reviews</span>` : ''}
          </div>
        </div>`;
    }).join('');

    const meta = `
      <div class="result-meta">
        Found ${Html.escape(data.total)} results · ${Html.escape(data.data_source)} · ${Html.escape(data.radius_km)}km
        ${data.category ? ` · ${Html.escape(data.category)}` : ''}
        · ${Html.escape(data.pipeline_time_ms)}ms
      </div>`;

    $app.innerHTML = renderTopBar() + `
      <div class="page fade-up">
        ${Samoyed.render(data.total ? 'happy' : 'sad')}
        ${eggHtml}
        ${meta}
        ${reasoningBanner}
        <button id="btn-again" class="btn btn-outline" style="margin-bottom:16px;">🔄 Try Again</button>
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
        ${Samoyed.render('idle', 'Here\'s your profile info!')}
        <div id="profile-box"><p>Loading...</p></div>
        <div class="profile-section">
          <h3>📋 Questionnaire Management</h3>
          <div class="profile-q-actions">
            <button class="btn btn-sm" id="btn-clear-eat">Clear Food Survey</button>
            <button class="btn btn-sm" id="btn-clear-explore">Clear Explore Survey</button>
          </div>
        </div>
        <div class="profile-section">
          <h3>🔄 Rewatch Welcome Story</h3>
          <button class="btn btn-sm btn-outline" id="btn-replay-onb">Replay Welcome</button>
        </div>
      </div>` + renderNav('#/profile');
    wireTopBar();

    document.getElementById('btn-clear-eat')?.addEventListener('click', () => {
      Questionnaire.clear('eat');
      alert('Food survey cleared');
    });
    document.getElementById('btn-clear-explore')?.addEventListener('click', () => {
      Questionnaire.clear('explore');
      alert('Explore survey cleared');
    });
    document.getElementById('btn-replay-onb')?.addEventListener('click', () => {
      localStorage.removeItem(CONFIG.STORAGE_KEY_ONBOARDED);
      location.hash = '#/welcome';
    });

    const controller = new AbortController();
    activeRequest = controller;
    const box = document.getElementById('profile-box');
    try {
      const p = await Api.get('/api/profile', controller.signal);
      if (controller.signal.aborted || !box.isConnected) return;
      if (box) {
        box.innerHTML = `
          <div class="profile-section">
            <h3>👤 ${Html.escape(p.name || 'User')}</h3>
            <p>${Html.escape(p.summary || '')}</p>
          </div>
          ${p.structured ? renderStructured(p.structured) : ''}`;
      }
    } catch (e) {
      if (controller.signal.aborted || !box.isConnected) return;
      if (box) box.innerHTML = `<p class="err">無法載入 profile：${Html.escape(e.message)}</p>`;
    }
  }

  function renderStructured(s) {
    const entries = Object.entries(s).map(([k, v]) => {
      let val = v;
      if (Array.isArray(v)) val = v.join(', ');
      else if (typeof v === 'object' && v !== null) val = Object.entries(v).map(([sk, sv]) => `${sk}: ${Array.isArray(sv) ? sv.join(', ') : sv}`).join(' · ');
      return `<div class="profile-row"><span class="profile-key">${Html.escape(k)}</span><span class="profile-val">${Html.escape(val)}</span></div>`;
    }).join('');
    return `<div class="profile-section"><h3>🗂 Details</h3>${entries}</div>`;
  }

  /* ===== Pipeline runners ===== */
  function runEatPipeline(answers) {
    return runPipeline('eat', null, answers);
  }

  function runExplorePipeline(category, answers) {
    return runPipeline('explore', category, answers);
  }

  async function runPipeline(kind, category, answers) {
    cancelRequests();
    const controller = new AbortController();
    activeRequest = controller;
    const mode = getMode();
    const backHash = `#/${kind}`;
    const payload = {
      radius_km: getRadius(), data_source: Geo.getDataSource(), mode,
      labels: [...(labelSelections.get(`${Geo.getDataSource()}:${category || 'food_drink'}`) || [])], questionnaire: answers,
      ...(category ? { category } : {}),
    };
    let lastResult = null;
    pageLoading(mode === 'raw' ? 'Getting results nearby...' : 'Analyzing your preferences...');
    const cancel = document.createElement('button');
    cancel.className = 'btn btn-outline';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => kind === 'eat' ? pageEat() : pageExplore());
    $app.querySelector('.page').append(cancel);
    const show = data => {
      if (controller.signal.aborted) return;
      lastResult = data;
      pageResults(data, backHash);
    };
    try {
      const loc = await Geo.getLocation();
      if (controller.signal.aborted) return;
      payload.latitude = loc.lat;
      payload.longitude = loc.lng;
      if (mode === 'raw') show(await Api.post(`/api/${kind}`, payload, controller.signal));
      else await Api.stream(`/api/${kind}/stream`, payload, show, controller.signal);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (lastResult && !lastResult.error) {
        show({ ...lastResult, ranking_method: lastResult.type === 'cold' ? 'fallback' : lastResult.ranking_method });
        const notice = document.createElement('p');
        notice.setAttribute('role', 'status');
        notice.textContent = 'Connection interrupted. Showing the last available results.';
        $app.querySelector('.reasoning-banner')?.append(notice);
      } else {
        pageResults({ error: error.message, rankings: [], total: 0 }, backHash);
      }
    } finally {
      if (activeRequest === controller) activeRequest = null;
    }
  }

  /* ===== Router ===== */
  function route() {
    cancelRequests();
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