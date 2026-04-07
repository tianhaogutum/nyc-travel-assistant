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
        <img class="dog-img ${cls}" src="img/samoyed.jpg" alt="Samoyed">
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
      eggs.push('🍵 Matcha spotted! Samoyed is running over with a cup~');
    if (/jellycat|toy|gift|玩具/.test(joined))
      eggs.push('🧸 Nobody can resist a Jellycat!');
    if (/taro|芋圓|芋/.test(joined))
      eggs.push('🟣 Taro taro! So soft and delicious!');
    if (/cat.?cafe|貓咖|貓/.test(joined))
      eggs.push('🐱 Samoyed spotted a cat — both tilting their heads~');
    if (new Date().getHours() >= 20)
      eggs.push('🌙 It\'s past 8pm, no eating after that~ Save it for tomorrow!');
    return eggs;
  },

  renderBanners(eggs) {
    return eggs.map(e => `<div class="egg-banner">${e}</div>`).join('');
  },
};