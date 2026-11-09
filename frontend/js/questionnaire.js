/* ===== questionnaire.js – localStorage persistence ===== */
const Questionnaire = {
  _drafts: new Map(),

  /* ---- storage helpers ---- */
  _key(type) {
    return type === 'eat' ? CONFIG.STORAGE_KEY_EAT : CONFIG.STORAGE_KEY_EXPLORE;
  },

  save(type, answers) {
    this._drafts.delete(type);
    localStorage.setItem(this._key(type), JSON.stringify(answers));
  },

  load(type) {
    try {
      const raw = localStorage.getItem(this._key(type));
      const value = raw ? JSON.parse(raw) : null;
      return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
    } catch { return null; }
  },

  clear(type) {
    this._drafts.delete(type);
    localStorage.removeItem(this._key(type));
  },

  hasSaved(type) {
    return !!this.load(type);
  },

  /* ---- render a questionnaire form ---- */
  render(schema, container, onSubmit) {
    const stored = this.load(schema.key);
    const source = this._drafts.get(schema.key) || stored || {};
    // Stored surveys may come from an older schema or be manually corrupted.
    const answers = {};
    schema.questions.forEach(q => {
      const value = source[q.id];
      if (typeof value !== 'string') return;
      const selected = q.multi ? value.split(', ') : [value];
      const valid = [...new Set(selected.filter(option => q.options.includes(option)))];
      if (valid.length) answers[q.id] = valid.join(', ');
    });
    const complete = schema.questions.every(q => answers[q.id]);
    const saved = stored && !this._drafts.has(schema.key) && complete ? answers : null;

    const formHtml = () => {
      let h = '<form id="q-form">';
      schema.questions.forEach((q, qi) => {
        const savedVal = answers[q.id] || null;
        const isMulti = !!q.multi;
        const savedArr = isMulti && typeof savedVal === 'string' ? savedVal.split(', ') : [];
        h += `<div class="q-group"><p class="q-label"><span class="q-num">${qi + 1}</span>${Html.escape(q.label)}${isMulti ? ' <span class="q-multi-hint">(Multiple choice)</span>' : ''}</p><div class="q-options">`;
        q.options.forEach(opt => {
          const sel = isMulti ? (savedArr.includes(opt) ? ' sel' : '') : (savedVal === opt ? ' sel' : '');
          h += `<button type="button" aria-pressed="${!!sel}" class="q-opt${sel}" data-qid="${Html.escape(q.id)}" data-val="${Html.escape(opt)}" data-multi="${isMulti}">${Html.escape(opt)}</button>`;
        });
        h += '</div></div>';
      });
      h += `<button type="submit" class="btn btn-primary btn-block" id="q-submit">Submit</button></form>`;
      return h;
    };

    if (saved) {
      // Summarise saved answers as chips
      const summaryChips = schema.questions.map(q => {
        const v = saved[q.id];
        return v ? `<span class="q-summary-chip">${Html.escape(v)}</span>` : '';
      }).join('');

      container.innerHTML = `
        <h2 class="q-title">${Html.escape(schema.title)}</h2>
        <div class="q-saved-banner">
          <div class="q-saved-summary">${summaryChips}</div>
          <div class="q-saved-actions">
            <button class="btn btn-primary btn-sm" id="q-use-saved">🚀 Use This</button>
            <button class="btn btn-sm btn-outline" id="q-toggle-form" aria-expanded="false" aria-controls="q-details">✏️ Edit</button>
          </div>
        </div>
        <details id="q-details">
          <summary style="display:none"></summary>
          ${formHtml()}
        </details>`;
    } else {
      container.innerHTML = `<h2 class="q-title">${Html.escape(schema.title)}</h2>${formHtml()}`;
    }

    /* ----- wire events ----- */
    container.querySelectorAll('.q-opt').forEach(el => {
      el.addEventListener('click', () => {
        if (el.dataset.multi === 'true') {
          el.classList.toggle('sel');
        } else {
          container.querySelectorAll(`.q-opt[data-qid="${el.dataset.qid}"]`).forEach(s => s.classList.remove('sel'));
          el.classList.add('sel');
        }
        container.querySelectorAll('.q-opt').forEach(option => {
          option.setAttribute('aria-pressed', String(option.classList.contains('sel')));
        });
        const draft = {};
        container.querySelectorAll('.q-opt.sel').forEach(option => {
          const key = option.dataset.qid;
          draft[key] = draft[key] ? `${draft[key]}, ${option.dataset.val}` : option.dataset.val;
        });
        this._drafts.set(schema.key, draft);
        // Once edited, the submit button applies the visible draft; the old
        // quick-submit action must not silently send stale saved answers.
        const useSaved = container.querySelector('#q-use-saved');
        if (useSaved) useSaved.hidden = true;
      });
    });

    container.querySelector('#q-use-saved')?.addEventListener('click', (e) => {
      e.preventDefault();
      onSubmit(saved);
    });

    container.querySelector('#q-toggle-form')?.addEventListener('click', (e) => {
      e.preventDefault();
      const details = container.querySelector('#q-details');
      if (details) {
        details.open = !details.open;
        e.currentTarget.textContent = details.open ? '▲ Collapse' : '✏️ Edit';
        e.currentTarget.setAttribute('aria-expanded', String(details.open));
      }
    });

    const form = container.querySelector('#q-form');
    if (!form) return;
    const multiIds = new Set(schema.questions.filter(q => q.multi).map(q => q.id));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const answers = {};
      let allAnswered = true;
      schema.questions.forEach(q => {
        if (multiIds.has(q.id)) {
          const chosen = container.querySelectorAll(`.q-opt.sel[data-qid="${q.id}"]`);
          if (chosen.length > 0) answers[q.id] = Array.from(chosen).map(c => c.dataset.val).join(', ');
          else allAnswered = false;
        } else {
          const chosen = container.querySelector(`.q-opt.sel[data-qid="${q.id}"]`);
          if (chosen) answers[q.id] = chosen.dataset.val;
          else allAnswered = false;
        }
      });
      if (!allAnswered) { alert('Please answer all questions before continuing.'); return; }
      this.save(schema.key, answers);
      onSubmit(answers);
    });
  },
};