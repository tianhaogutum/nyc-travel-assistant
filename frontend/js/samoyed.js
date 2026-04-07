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
    idle:    'Sigh... What do you want to explore?',
    think:   'Let me understand your preferences~',
    happy:   'Found it! You\'ll love these!',
    sad:     'Woof... Nothing found nearby, try expanding the radius?',
    loading: 'Finding great places for you...',
    explore: 'Explore mode activated!',
    error:   'Something went wrong...',
    night:   'It\'s past 8pm, no eating after that~ Recommend saving for tomorrow!',
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
    if (rank === 1) return '🏆 "This is my top recommendation!"';
    if (rank <= 3) return '💜 "Really good, highly recommend~"';
    if (rank <= 8) return '🐾 "Pretty good~"';
    if (rank <= 15) return '👀 "Worth checking out"';
    if (rank <= 20) return '🤔 "Not bad"';
    return '💤 "Just for reference"';
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