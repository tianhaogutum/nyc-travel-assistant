/* ===== Cartoon Samoyed (Real Photo with CSS emotional states) ===== */
const Samoyed = {
  /* Each state maps to a CSS class applied to the img for animation/filter effects. */
  _stateClass: {
    idle:    'dog-idle',
    think:   'dog-think',
    happy:   'dog-happy',
    sad:     'dog-sad',
    loading: 'dog-loading',
  },

  bubbles: {
    idle:    '嘶～想去哪逛逛？',
    think:   '讓我了解一下你的口味～',
    happy:   '找到啦！這些你一定喜歡！',
    sad:     '呜…附近沒有找到，擴大範圍試試？',
    loading: '正在幫你找好地方…',
    explore: '探索模式啟動！',
    error:   '出了點問題…',
    night:   '過了八點不吃東西啦～推薦留著明天去！',
  },

  render(state, customBubble) {
    const cls = this._stateClass[state] || this._stateClass.idle;
    const text = customBubble || this.bubbles[state] || this.bubbles.idle;
    return `
      <div class="dog-container">
        <img class="dog-img ${cls}" src="img/samoyed.jpg" alt="薩摩耶">
      </div>
      <div class="bubble">${text}</div>
    `;
  },

  commentForRank(rank) {
    if (rank === 1) return '🏆 “這家我超推！必去！”';
    if (rank <= 3) return '💜 “很不錯，強烈推薦～”';
    if (rank <= 8) return '🐾 “也挺好的～”';
    if (rank <= 15) return '👀 “可以看看”';
    if (rank <= 20) return '🤔 “還行吧”';
    return '💤 "了解一下就好"';
  },
};

/* ===== Easter Eggs ===== */
const EasterEggs = {
  check(rankings) {
    const eggs = [];
    const joined = rankings.map(r =>
      `${r.name} ${r.primary_type || ''} ${r.description || ''}`
    ).join(' ').toLowerCase();

    if (/matcha|抛茶|green tea/.test(joined))
      eggs.push('🍵 發現抹茶！薩摩耶端著一杯向你跑來～');
    if (/jellycat|toy|gift|玩具/.test(joined))
      eggs.push('🧸 沒有人可以拒絕 Jellycat！');
    if (/taro|芋圓|芋/.test(joined))
      eggs.push('🟣 芋圓芋圓！超軟超好吃！');
    if (/cat.?cafe|貓咖|貓/.test(joined))
      eggs.push('🐱 薩摩耶發現了一隻貓，互相歪頭～');
    if (new Date().getHours() >= 20)
      eggs.push('🌙 過了八點不吃東西啦～推薦留著明天去！');
    return eggs;
  },

  renderBanners(eggs) {
    return eggs.map(e => `<div class="egg-banner">${e}</div>`).join('');
  },
};