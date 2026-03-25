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
  { label: 'Flushing 法拉盛',       lat: 40.7596, lng: -73.8317 },
  { label: 'Chinatown 中國城',      lat: 40.7158, lng: -73.9970 },
  { label: 'Williamsburg',         lat: 40.7081, lng: -73.9571 },
  { label: 'SoHo',                 lat: 40.7233, lng: -73.9985 },
  { label: 'Upper East Side',      lat: 40.7736, lng: -73.9566 },
];

/* ----- onboarding story slides ----- */
const ONBOARDING_SLIDES = [
  {
    dog: 'idle',
    title: '🗽 開始你的紐約之旅',
    text: '',
    bg: 'onb-bg-city',
  },
  {
    dog: 'happy',
    title: '',
    text: 'Hi Helen！我是你的薩摩耶嚮導 🐾\n我在紐約長大，從小跟著主人逛遍曼哈頓的大街小巷，布魯克林的每一間咖啡店我都去聞過味道！',
  },
  {
    dog: 'think',
    title: '',
    text: '我很細心的，你跟我說過的每一句話我都會記住！\n你說什麼喜歡、什麼不喜歡，我全部都幫你記在小腦袋裡 🧠✨',
  },
  {
    dog: 'happy',
    title: '',
    text: '我已經知道你啦～\n你喜歡芋圓、拉麵、抹茶、港式料理 🍜\n你不吃羊肉、不愛 pizza 和啤酒\n過了八點不吃東西（好自律！）',
  },
  {
    dog: 'happy',
    title: '',
    text: '你喜歡紫色和櫻花 🌸\n最愛的季節是秋天，銀杏和楓葉～\n和天浩一起來紐約，我會帶你們玩得開心的 🐾',
  },
  {
    dog: 'idle',
    title: '',
    text: '我保證會做一個最棒的嚮導！\n我會結合 Google 評分資料、網上真實評論、還有我自己的紐約在地知識，幫你找到最適合你的好地方 💜\n\n準備好了嗎？出發吧！',
  },
];

/* ----- questionnaire A: eat (expanded) ----- */
const QUESTIONNAIRE_A = {
  key: 'eat',
  title: '🍜 你的美食口味',
  questions: [
    { id: 'cuisine',      label: '你最喜歡什麼菜系？',              options: ['中餐', '日料', '韓料', '意餐', '美式', '東南亞', '港式', '法餐', '都喜歡'], multi: true },
    { id: 'spicy',        label: '吃辣嗎？',                        options: ['不吃', '微辣', '中辣', '超辣', '看心情'] },
    { id: 'budget',       label: '一般一頓飯的預算？',              options: ['$10以下', '$10-25', '$25-50', '$50-100', '不限'] },
    { id: 'vibe',         label: '更喜歡什麼氛圍？',                options: ['安靜文藝', '熱鬧有氣氛', '有特色裝修', '隨性街邊', '無所謂'], multi: true },
    { id: 'avoid',        label: '有什麼忌口？',                    options: ['無', '不吃豬肉', '不吃牛肉', '素食', '海鮮過敏', '乳糖不耐', '其他'], multi: true },
    { id: 'priority',     label: '選餐廳最看重？',                  options: ['味道', '性價比', '環境', '排隊時間', '評分', '拍照好看'], multi: true },
    { id: 'mood',         label: '今天的心情是？',                  options: ['想吃大餐', '隨便吃吃', '找甜品', '喝一杯', '找夜宵', '想試新奇的'] },
    { id: 'meal_type',    label: '現在想吃哪一餐？',                options: ['早午餐', '午餐', '下午茶', '晚餐', '宵夜', '隨時'] },
    { id: 'portion',      label: '食量大嗎？',                      options: ['小鳥胃', '正常', '大胃王', '想多點幾樣分著吃'] },
    { id: 'drink',        label: '會想配飲料嗎？',                  options: ['奶茶/手搖', '咖啡', '酒', '果汁', '不需要'], multi: true },
    { id: 'distance',     label: '願意走多遠去吃？',                options: ['越近越好', '15分鐘內', '30分鐘也行', '好吃就去不管多遠'] },
    { id: 'wait',         label: '能接受排隊多久？',                options: ['完全不排', '15分鐘', '30分鐘', '好吃排1小時也行'] },
  ],
};

/* ----- questionnaire B: explore (expanded) ----- */
const QUESTIONNAIRE_B = {
  key: 'explore',
  title: '🗽 你的探索偏好',
  questions: [
    { id: 'interest',     label: '最感興趣的類型？',                options: ['博物館', '自然風景', '網紅打卡', '購物', '體驗活動', '街頭藝術', '都想看'], multi: true },
    { id: 'pace',         label: '旅行節奏？',                     options: ['佛系慢遊', '暴走型', '適中', '走走停停拍拍'] },
    { id: 'companion',    label: '幾個人一起？',                   options: ['獨自', '情侶', '朋友們', '家庭', '一大群'] },
    { id: 'time_avail',   label: '今天還有多少時間？',             options: ['1-2小時', '半天', '一整天', '只有一會兒'] },
    { id: 'outdoor',      label: '室內還是室外？',                 options: ['室內', '室外', '都行', '看天氣'], multi: true },
    { id: 'photo',        label: '拍照重要嗎？',                   options: ['非常重要', '一般', '不太在意', '主要拍影片'] },
    { id: 'history',      label: '對歷史文化感興趣嗎？',           options: ['很感興趣', '還好', '更喜歡現代', '想看兩者結合'] },
    { id: 'crowd',        label: '介意人多嗎？',                   options: ['越熱鬧越好', '適中', '希望人少清淨', '無所謂'] },
    { id: 'free_paid',    label: '免費還是付費都行？',             options: ['免費最好', '都行', '願意花錢買好體驗'] },
    { id: 'unique',       label: '想要經典景點還是小眾秘境？',     options: ['經典必去', '小眾獨特', '兩者都要', '當地人推薦的'] },
    { id: 'weather',      label: '今天天氣如何？',                 options: ['晴天', '陰天', '下雨', '很冷', '很熱'] },
    { id: 'souvenir',     label: '會想買紀念品嗎？',               options: ['一定要買', '看到喜歡的就買', '不太買', '只拍照留念'] },
  ],
};

/* ----- explore categories ----- */
const EXPLORE_CATEGORIES = [
  { id: 'culture',        label: '🏛️ 文化 · Culture',      icon: '🏛️', color: '#7C5CFC' },
  { id: 'entertainment',  label: '🎭 娛樂 · Fun',          icon: '🎭', color: '#F472B6' },
  { id: 'shopping',       label: '🛍️ 購物 · Shopping',     icon: '🛍️', color: '#34D399' },
  { id: 'other',          label: '🌟 其他 · Other',         icon: '🌟', color: '#FBBF24' },
];