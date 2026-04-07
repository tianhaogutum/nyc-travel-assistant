/* ===== config.js ===== */
const CONFIG = {
  API_BASE: '',                       // same origin
  DEFAULT_DATA_SOURCE: 'manhattan',
  STORAGE_KEY_EAT: 'q_eat',
  STORAGE_KEY_EXPLORE: 'q_explore',
  STORAGE_KEY_DS: 'data_source',
  STORAGE_KEY_TEST: 'test_mode',
  STORAGE_KEY_TEST_LOC: 'test_location',
  STORAGE_KEY_LOC_MODE: 'loc_mode',
  STORAGE_KEY_CUSTOM_LAT: 'custom_lat',
  STORAGE_KEY_CUSTOM_LNG: 'custom_lng',
  STORAGE_KEY_ONBOARDED: 'onboarded',
  STORAGE_KEY_RADIUS: 'radius_km',
  STORAGE_KEY_MODE: 'pipeline_mode',
  DEFAULT_RADIUS: 1,
};

/* ----- test NYC locations ----- */
const TEST_LOCATIONS = [
  { label: 'Times Square',         lat: 40.7580, lng: -73.9855 },
  { label: 'Central Park',         lat: 40.7829, lng: -73.9654 },
  { label: 'Brooklyn Bridge',      lat: 40.7061, lng: -73.9969 },
  { label: 'Flushing',             lat: 40.7596, lng: -73.8317 },
  { label: 'Chinatown',            lat: 40.7158, lng: -73.9970 },
  { label: 'Williamsburg',         lat: 40.7081, lng: -73.9571 },
  { label: 'SoHo',                 lat: 40.7233, lng: -73.9985 },
  { label: 'Upper East Side',      lat: 40.7736, lng: -73.9566 },
];

/* ----- onboarding story slides ----- */
const ONBOARDING_SLIDES = [
  {
    dog: 'idle',
    title: '🗽 Start Your NYC Adventure',
    text: '',
    bg: 'onb-bg-city',
  },
  {
    dog: 'happy',
    title: '',
    text: 'Hi! I\'m your Samoyed guide 🐾\nI grew up in NYC, exploring every street in Manhattan and visiting all the coffee shops in Brooklyn!',
  },
  {
    dog: 'think',
    title: '',
    text: 'I\'m very attentive - I remember everything you tell me!\nI keep track of what you like and don\'t like in my head 🧠✨',
  },
  {
    dog: 'happy',
    title: '',
    text: 'I know you well already!\nYou love taro, ramen, matcha, and Cantonese food 🍜\nYou don\'t eat lamb, and you\'re not into pizza or beer\nYou don\'t eat after 8pm (so disciplined!)',
  },
  {
    dog: 'happy',
    title: '',
    text: 'You love purple and cherry blossoms 🌸\nYour favorite season is autumn with ginkgo and maple leaves!\nTraveling to NYC with you, I\'ll make sure we have an amazing time 🐾',
  },
  {
    dog: 'idle',
    title: '',
    text: 'I promise to be the best guide!\nI combine Google ratings, real online reviews, and my NYC local knowledge to find the perfect places for you 💜\n\nReady? Let\'s go!',
  },
];

/* ----- questionnaire A: eat (expanded) ----- */
const QUESTIONNAIRE_A = {
  key: 'eat',
  title: '🍜 Your Food Preferences',
  questions: [
    { id: 'cuisine',      label: 'What cuisines do you like?',        options: ['Chinese', 'Japanese', 'Korean', 'Italian', 'American', 'Southeast Asian', 'Cantonese', 'French', 'All'], multi: true },
    { id: 'spicy',        label: 'Do you eat spicy food?',            options: ['Not at all', 'Mild', 'Medium', 'Very spicy', 'Depends'] },
    { id: 'budget',       label: 'Budget per meal?',                  options: ['<$10', '$10-25', '$25-50', '$50-100', 'No limit'] },
    { id: 'vibe',         label: 'What atmosphere do you prefer?',    options: ['Quiet & cozy', 'Lively', 'Trendy decor', 'Casual street', 'Doesn\'t matter'], multi: true },
    { id: 'avoid',        label: 'Any dietary restrictions?',         options: ['None', 'No pork', 'No beef', 'Vegetarian', 'Seafood allergy', 'Lactose intolerant', 'Other'], multi: true },
    { id: 'priority',     label: 'What matters most when choosing?',  options: ['Taste', 'Value', 'Ambiance', 'Wait time', 'Ratings', 'Instagram-worthy'], multi: true },
    { id: 'mood',         label: 'What\'s your mood today?',          options: ['Want a fancy dinner', 'Just something casual', 'Looking for dessert', 'Want drinks', 'Late night snacks', 'Try something new'] },
    { id: 'meal_type',    label: 'Which meal are you thinking?',      options: ['Brunch', 'Lunch', 'Afternoon tea', 'Dinner', 'Night snack', 'Anytime'] },
    { id: 'portion',      label: 'Do you have a big appetite?',       options: ['Light eater', 'Normal', 'Big eater', 'Like to share plates'] },
    { id: 'drink',        label: 'Will you want a drink?',            options: ['Boba/Bubble tea', 'Coffee', 'Alcohol', 'Juice', 'No thanks'], multi: true },
    { id: 'distance',     label: 'How far are you willing to go?',    options: ['As close as possible', 'Within 15 mins', 'Within 30 mins', 'Doesn\'t matter if good'] },
    { id: 'wait',         label: 'Can you wait for a table?',         options: ['Won\'t wait', '15 mins', '30 mins', 'Can wait an hour for good food'] },
  ],
};

/* ----- questionnaire B: explore (expanded) ----- */
const QUESTIONNAIRE_B = {
  key: 'explore',
  title: '🗽 Your Exploration Preferences',
  questions: [
    { id: 'interest',     label: 'What interests you most?',         options: ['Museums', 'Nature', 'Social media spots', 'Shopping', 'Activities', 'Street art', 'Everything'], multi: true },
    { id: 'pace',         label: 'Travel pace?',                     options: ['Relaxed & slow', 'Fast-paced', 'Moderate', 'Walk & stop for photos'] },
    { id: 'companion',    label: 'How many are you with?',           options: ['Alone', 'Couple', 'Friends', 'Family', 'Large group'] },
    { id: 'time_avail',   label: 'How much time do you have?',       options: ['1-2 hours', 'Half day', 'Full day', 'Just a short while'] },
    { id: 'outdoor',      label: 'Indoor or outdoor?',               options: ['Indoor', 'Outdoor', 'Both', 'Depends on weather'], multi: true },
    { id: 'photo',        label: 'Is photography important?',        options: ['Very important', 'Somewhat', 'Not really', 'Mainly video'] },
    { id: 'history',      label: 'Interested in history & culture?', options: ['Very', 'Somewhat', 'Prefer modern', 'Mix of both'] },
    { id: 'crowd',        label: 'Do crowds bother you?',            options: ['Love crowds', 'Moderate', 'Prefer quiet spots', 'Doesn\'t matter'] },
    { id: 'free_paid',    label: 'Free or paid activities?',         options: ['Free is better', 'Both fine', 'Worth paying for good experiences'] },
    { id: 'unique',       label: 'Classic spots or hidden gems?',    options: ['Must-see classics', 'Hidden gems', 'Both', 'Local recommendations'] },
    { id: 'weather',      label: 'How\'s the weather today?',        options: ['Sunny', 'Cloudy', 'Rainy', 'Cold', 'Hot'] },
    { id: 'souvenir',     label: 'Will you buy souvenirs?',          options: ['Definitely', 'Maybe', 'Probably not', 'Just photos'] },
  ],
};

/* ----- explore categories ----- */
const EXPLORE_CATEGORIES = [
  { id: 'culture',        label: '🏛️ Culture',      icon: '🏛️', color: '#7C5CFC' },
  { id: 'entertainment',  label: '🎭 Entertainment',          icon: '🎭', color: '#F472B6' },
  { id: 'shopping',       label: '🛍️ Shopping',     icon: '🛍️', color: '#34D399' },
  { id: 'other',          label: '🌟 Other',         icon: '🌟', color: '#FBBF24' },
];