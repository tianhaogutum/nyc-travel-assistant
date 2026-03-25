/* ===== questionnaire.js – localStorage persistence ===== */
const Questionnaire = {
  /* ---- storage helpers ---- */
  _key(type) {
    return type === 'eat' ? CONFIG.STORAGE_KEY_EAT : CONFIG.STORAGE_KEY_EXPLORE;
  },

  save(type, answers) {
    localStorage.setItem(this._key(type), JSON.stringify(answers));
  },

  load(type) {
    try {
      const raw = localStorage.getItem(this._key(type));
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  clear(type) {
    localStorage.removeItem(this._key(type));
  },

  hasSaved(type) {
    return !!localStorage.getItem(this._key(type));
  },

  /* ---- render a questionnaire form ---- */
  render(schema, container, onSubmit) {
    const saved = this.load(schema.key);

    const formHtml = () => {
      let h = '<form id="q-form">';
      schema.questions.forEach((q, qi) => {
        const savedVal = saved ? saved[q.id] : null;
        const isMulti = !!q.multi;
        const savedArr = isMulti && savedVal ? savedVal.split(', ') : [];
        h += `<div class="q-group"><p class="q-label"><span class="q-num">${qi + 1}</span>${q.label}${isMulti ? ' <span class="q-multi-hint">（可多選）</span>' : ''}</p><div class="q-options">`;
        q.options.forEach(opt => {
          const sel = isMulti ? (savedArr.includes(opt) ? ' sel' : '') : (savedVal === opt ? ' sel' : '');
          h += `<span class="q-opt${sel}" data-qid="${q.id}" data-val="${opt}" data-multi="${isMulti}">${opt}</span>`;
        });
        h += '</div></div>';
      });
      h += `<button type="submit" class="btn btn-primary btn-block" id="q-submit">提交</button></form>`;
      return h;
    };

    if (saved) {
      // Summarise saved answers as chips
      const summaryChips = schema.questions.map(q => {
        const v = saved[q.id];
        return v ? `<span class="q-summary-chip">${v}</span>` : '';
      }).join('');

      container.innerHTML = `
        <h2 class="q-title">${schema.title}</h2>
        <div class="q-saved-banner">
          <div class="q-saved-summary">${summaryChips}</div>
          <div class="q-saved-actions">
            <button class="btn btn-primary btn-sm" id="q-use-saved">🚀 直接使用</button>
            <button class="btn btn-sm btn-outline" id="q-toggle-form">✏️ 重新填寫</button>
          </div>
        </div>
        <details id="q-details">
          <summary style="display:none"></summary>
          ${formHtml()}
        </details>`;
    } else {
      container.innerHTML = `<h2 class="q-title">${schema.title}</h2>${formHtml()}`;
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
        e.currentTarget.textContent = details.open ? '▲ 收起' : '✏️ 重新填寫';
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
      if (!allAnswered) { alert('請回答所有問題哷～'); return; }
      this.save(schema.key, answers);
      onSubmit(answers);
    });
  },
};