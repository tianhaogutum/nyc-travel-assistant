# 🗽 AI 纽约旅游助手 — 开发规范 (Spec)

> **项目**: NYC Travel Intelligence Engine
> **版本**: v0.2.0
> **日期**: 2026-03-23
> **方法论**: Spec-Driven Development (GitHub spec-kit)
> **状态**: 📐 Specify 阶段

---

## 目录

1. [项目宪章 (Constitution)](#1-项目宪章-constitution)
2. [需求规格 (Specify)](#2-需求规格-specify)
3. [技术实现计划 (Plan)](#3-技术实现计划-plan)
4. [任务分解 (Tasks)](#4-任务分解-tasks)
5. [附录](#5-附录)

---

## 1. 项目宪章 (Constitution)

### 1.1 项目愿景

为在纽约旅行的用户（主要面向华人游客）提供一个 **手机端 Web 应用**，结合本地 LLM (Ollama) 智能推荐和地理空间数据，帮助用户回答两个核心问题：

- **「附近吃什么？」** — 基于当前位置，发现周边最值得去的餐厅/美食
- **「附近去哪玩？」** — 基于当前位置，发现周边最值得去的景点/娱乐场所

两个功能均为 **Pipeline 模式**（无自由聊天），LLM 对数据库 Top 25 结果进行智能排序和推荐。

### 1.2 设计理念

| 原则 | 说明 |
|------|------|
| **个性化优先** | 通过用户画像 (user_profil) + 场景问卷，推荐不是千篇一律的 |
| **数据驱动** | 所有推荐基于自建的地点数据库 (Google Places 真实数据) + LLM 在线搜索验证 |
| **中文友好** | UI 和推荐结果默认中文，地点名称保留中英双语 |
| **零成本 LLM** | 使用 Ollama 本地模型，无需 API 付费 |
| **手机优先** | 网页响应式设计，核心交互为手机触摸操作 |
| **双数据源** | 支持在 Brooklyn / Manhattan 之间切换数据源 |

### 1.3 质量标准

- **准确性**: 推荐的地点必须真实存在，距离计算误差 < 50m
- **响应速度**: Pipeline 端到端 < 30 秒 (本地 LLM 速度取决于硬件)
- **安全性**: 用户数据仅存储在本地，不上传第三方

---

## 2. 需求规格 (Specify)

### 2.1 系统架构概览

```
┌──────────────────────────────────────────────────────────┐
│                    手机 Web 前端                           │
│  ┌────────────────────┐  ┌────────────────────────────┐  │
│  │  🍜 附近吃什么       │  │  📍 附近去哪玩              │  │
│  │  (美食 Pipeline)    │  │  (探索 Pipeline)            │  │
│  └─────────┬──────────┘  └──────────────┬─────────────┘  │
│            │    ┌──────────────────┐     │                │
│            │    │ 🔄 Brooklyn /    │     │                │
│            │    │    Manhattan 切换 │     │                │
│            │    └──────────────────┘     │                │
└────────────┼────────────────────────────┼────────────────┘
             │                            │
             ▼                            ▼
┌──────────────────────────────────────────────────────────┐
│                    后端 API 层 (FastAPI)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Pipeline API  │  │ Pipeline API │  │ 用户/问卷 API   │  │
│  │ /eat          │  │ /explore     │  │ /profile        │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬─────────┘  │
└─────────┼─────────────────┼─────────────────┼────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌──────────────────────────────────────────────────────────┐
│                   数据 & 智能层                            │
│  ┌───────────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │ SQLite 分类 DB     │  │ Ollama LLM   │  │ 在线搜索   │  │
│  │ brooklyn/ │ manhattan/ │  │ (本地模型)   │  │ (差评搜索) │  │
│  └───────────────────┘  └──────────────┘  └───────────┘  │
└──────────────────────────────────────────────────────────┘
```

**架构类型**: Pipeline (数据库冷筛 → LLM 智能排序) + Geospatial (地理空间计算) + Online Search (差评验证)

### 2.2 用户故事 (User Stories)

#### US-1: 附近吃什么 (Eat Pipeline)

> **作为** 一个在纽约逛街的华人游客
> **我想要** 点击「附近吃什么」，指定搜索范围
> **以便** 看到 AI 从附近 Top 25 餐厅中精选排序的推荐，每个都有理由

**验收标准 (Acceptance Criteria):**

```
场景 1: 美食推荐流程
  given: 用户已填写「美食问卷」+ 系统已有用户画像 (user_profil)
  when:  用户点击「附近吃什么」→ 选择数据源 (Brooklyn/Manhattan) → 设置距离范围 (如 1km)
  then:  系统从 food_drink.db 按 review_count 降序取范围内 Top 25
         将 25 条数据 (name, rating, review_count, price_level, primary_type,
              editorial_summary, reviews_preview) + 用户画像 + 问卷答案 发送给 LLM
         LLM 可在线搜索每个餐厅的差评/负面评论
         LLM 返回 25 个结果的排名，每个附带:
           · 自然语言描述 (中文)
           · 推荐理由
           · 推荐指数 (亮点)
           · 负面提醒 (如有)

场景 2: 无结果处理
  given: 用户在偏远区域
  when:  指定范围内不足 25 个结果
  then:  自动扩大搜索半径并提示用户，或返回实际找到的全部结果

场景 3: 切换数据源
  given: 用户当前在 Brooklyn
  when:  切换到 Manhattan 数据源
  then:  Pipeline 使用 manhattan/classifications/food_drink.db 重新检索
```

#### US-2: 附近去哪玩 (Explore Pipeline)

> **作为** 一个想探索纽约的游客
> **我想要** 点击「附近去哪玩」，选择类别 (文化/娱乐/其他)，指定范围
> **以便** 看到 AI 从附近 Top 25 地点中精选排序的推荐

**验收标准:**

```
场景 1: 探索推荐流程
  given: 用户已填写「探索问卷」+ 系统已有用户画像
  when:  用户点击「附近去哪玩」→ 选择类别 (culture/entertainment/other)
         → 选择数据源 → 设置距离范围
  then:  系统从对应分类 DB (culture.db / entertainment.db / other.db) 
         按 review_count 降序取范围内 Top 25
         将数据 + 用户画像 + 问卷答案 发送给 LLM
         LLM 可在线搜索各地点的差评/负面信息
         LLM 返回 25 个结果的排名，格式同美食 Pipeline

场景 2: 类别选择
  given: 用户点击「附近去哪玩」
  when:  展示类别选择界面
  then:  显示三个选项:
         · 🏛️ 文化 (Culture) → culture.db
         · 🎭 娱乐 (Entertainment) → entertainment.db / entertainment_recreation.db
         · 📦 其他 (Other) → other.db
```

#### US-3: 用户画像 + 场景问卷

> **作为** 首次使用的用户
> **我想要** 在使用每个功能前回答针对性问卷
> **以便** 系统结合我的基础画像 + 场景偏好，给出更精准的推荐

**用户画像来源:**

系统预加载用户画像 (来自 `user_profil/helen_profile.md`)，包含:
- 饮食喜好 (喜欢: 芋圆、拉面、抹茶、港式、鼎泰丰... 不喜欢: 羊肉、pizza、啤酒)
- 旅行风格 (高效但不特种兵、喜欢拍照、会做攻略)
- 性格特点 (INFJ、独立、亚洲胃)
- 预算习惯

**两份场景问卷:**

```
问卷 A: 美食问卷 (在「附近吃什么」前填写)
├── Q1: 今天想吃什么类型？(中餐/日料/韩料/西餐/甜品/咖啡/随便)
├── Q2: 一顿饭预算？($15以下 / $15-30 / $30-60 / $60+ / 随意)
├── Q3: 口味偏好？(辣/清淡/甜/酸/重口味/都可以)
├── Q4: 有忌口吗？(无/素食/清真/海鲜过敏/坚果过敏/其他)
├── Q5: 用餐场景？(一个人吃/朋友聚餐/约会/家庭)
├── Q6: 有特别想要的体验吗？(网红打卡/本地人推荐/安静环境/热闹氛围/户外座位)
└── Q7: 对排队的容忍度？(不想排队/可以排15分钟/半小时以内都行/无所谓)

问卷 B: 探索问卷 (在「附近去哪玩」前填写)
├── Q1: 今天想做什么？(看展/逛公园/拍照打卡/文化体验/夜生活/随便逛逛)
├── Q2: 预算？(免费的就好 / $20以内 / $50以内 / 无所谓)
├── Q3: 出行方式？(步行/地铁+步行/打车)
├── Q4: 你的体力？(暴走型一天逛很多 / 悠闲型慢慢来 / 今天比较累想轻松点)
├── Q5: 和谁一起？(一个人/朋友/情侣/家庭)
├── Q6: 有特别想要的体验吗？(拍照/学知识/放松/刺激/文艺)
└── Q7: 对热门程度的偏好？(越热门越好/小众的/都可以)
```

### 2.3 数据架构

#### 2.3.1 数据库结构 (已有)

```
dataset/
├── brooklyn/
│   ├── brooklyn_places.db              ← 合并数据库 (全量)
│   └── classifications/               ← 按类别拆分
│       ├── culture.db                  (99 条)
│       ├── entertainment.db            (144 条)
│       ├── food_drink.db               (784 条)
│       ├── shopping.db                 (124 条)
│       ├── other.db                    (6 条)
│       └── transportation.db           (1 条)
│
├── manhattan/
│   ├── manhattan_places.db             ← 合并数据库 (全量)
│   └── classifications/               ← 按类别拆分
│       ├── culture.db                  (102 条)
│       ├── entertainment_recreation.db (147 条)
│       ├── food_drink.db               (813 条)
│       ├── shopping.db                 (119 条)
│       ├── natural_features.db         (1 条)
│       └── other.db                    (8 条)
│
├── online_recommendations/             ← 网络推荐数据
│
└── user_profil/                        ← 用户画像
    ├── helen_profile.md
    └── conversation.txt
```

#### 2.3.2 地点数据表结构 (places — 9 列精简版)

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | TEXT | 地点名称 |
| `rating` | REAL | Google 评分 (1-5) |
| `review_count` | INTEGER | Google 评论数 (用于冷排序) |
| `price_level` | TEXT | 价格等级 |
| `primary_type` | TEXT | 主要类型 (如 `ramen_restaurant`) |
| `latitude` | REAL | 纬度 |
| `longitude` | REAL | 经度 |
| `editorial_summary` | TEXT | Google 编辑摘要 |
| `reviews_preview` | TEXT | 用户评论预览 (Manhattan 有, Brooklyn 为空) |

#### 2.3.3 Pipeline 使用的 DB 映射

| 功能 | 类别 | Brooklyn DB | Manhattan DB |
|------|------|-------------|-------------|
| 附近吃什么 | — | `food_drink.db` (784条) | `food_drink.db` (813条) |
| 附近去哪玩 | 文化 | `culture.db` (99条) | `culture.db` (102条) |
| 附近去哪玩 | 娱乐 | `entertainment.db` (144条) | `entertainment_recreation.db` (147条) |
| 附近去哪玩 | 其他 | `other.db` (6条) | `other.db` (8条) |

### 2.4 核心 Pipeline 设计

两个功能共享同一套 Pipeline 逻辑，只是数据源和问卷不同:

```
用户点击 [附近吃什么] 或 [附近去哪玩]
    │
    ▼
┌─────────────────────────────────────────────┐
│ Step 0: 问卷收集                             │
│                                             │
│ · 美食 → 填写问卷 A (7 个问题)               │
│ · 探索 → 选择子类别 (文化/娱乐/其他)          │
│         → 填写问卷 B (7 个问题)              │
└───────┬─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│ Step 1: 获取用户位置 + 设置搜索范围           │
│                                             │
│ · navigator.geolocation API 获取 (lat, lng) │
│ · 用户指定距离范围: 0.5km / 1km / 2km / 5km  │
│ · 选择数据源: Brooklyn / Manhattan           │
└───────┬─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│ Step 2: 数据库冷筛 — Top 25                  │
│                                             │
│ SELECT * FROM places                        │
│ WHERE Haversine(lat, lng, ?, ?) <= ?km      │
│ ORDER BY review_count DESC                  │
│ LIMIT 25                                    │
│                                             │
│ 按 review_count(评论数) 降序取前 25 条       │
│ 这是「冷启动」排序，不依赖 LLM               │
└───────┬─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│ Step 3: LLM 智能排序 + 在线搜索              │
│                                             │
│ 输入给 Ollama LLM:                          │
│  · 25 条地点数据 (name, rating, review_count,│
│    price_level, primary_type,               │
│    editorial_summary, reviews_preview)      │
│  · 用户画像 (helen_profile.md 摘要)          │
│  · 问卷答案 (A 或 B)                        │
│                                             │
│ LLM 额外能力:                               │
│  · 🔍 在线搜索: 搜索每个地点的差评/负面评论   │
│    (如 "XXX restaurant bad reviews",        │
│     "XXX 踩雷" 等)                          │
│  · 综合判断: 结合好评 + 差评 + 用户偏好       │
│                                             │
│ LLM 输出 (自然语言中文):                     │
│  · 25 个地点的最终排名                       │
│  · 每个地点包含:                             │
│    - 推荐排名 (#1 - #25)                    │
│    - 自然语言描述 (这是什么地方、特色是什么)   │
│    - 推荐理由 (为什么推荐给你)                │
│    - 推荐指数/亮点 (如: ⭐ 性价比高、📸 拍照好)│
│    - 风险提醒 (如有差评/踩雷信息)             │
└───────┬─────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────┐
│ Step 4: 返回前端展示                         │
│                                             │
│ 以列表形式展示 25 个排名结果                  │
│ 每个卡片包含: 排名、名称、LLM 推荐描述、      │
│ 评分、距离、推荐亮点、风险提醒                 │
└─────────────────────────────────────────────┘
```

### 2.5 前端界面

#### 2.5.0 视觉设计语言 — 「Pixel Samoyed 陪你逛纽约」

**核心角色: 像素风萨摩耶 (Pixel Samoyed Mascot)**

整个 App 由一只像素风格的萨摩耶犬作为向导角色，全程陪伴用户。
萨摩耶有不同状态动画 (CSS sprite / GIF)，根据页面状态切换表情:

| 状态 | 萨摩耶动画 | 对话气泡 (中文) |
|------|-----------|----------------|
| 首页待机 | 🐕 摇尾巴、歪头 | 「嘿～想去哪逛逛？」 |
| 问卷中 | 🐕 竖耳朵、认真脸 | 「让我了解一下你的口味～」 |
| 加载中 | 🐕 转圈追蝴蝶 | 「汪！我在帮你找好地方...」 |
| 结果出来 | 🐕 吐舌微笑、举爪 | 「找到啦！这些地方你一定喜欢！」 |
| 无结果 | 🐕 趴下、耷拉耳朵 | 「呜...附近没找到，要不扩大范围？」 |
| 排名第一 | 🐕 戴皇冠、闪闪眼 | 「这家是我的 Top Pick！」 |

**视觉风格 — 基于 Helen 的喜好定制:**

| 元素 | 设计 | 来源 (helen_profile) |
|------|------|---------------------|
| **主色调** | 紫色渐变 (#9B59B6 → #8E44AD) + 大地色辅助 (#C4A882) | 最喜欢紫色、大地色 |
| **背景装饰** | 飘落的像素樱花瓣 (CSS animation) | 最喜欢櫻花 |
| **转场动画** | 像素蝴蝶飞过屏幕 | 「我最喜歡蝴蝶了」 |
| **加载动画** | 像素萨摩耶追像素蝴蝶 | 薩摩耶 + 蝴蝶 |
| **卡片阴影** | 柔和紫色光晕 | 紫色主题 |
| **字体** | 像素风标题 (Press Start 2P / Silkscreen) + 圆体正文 | 像素风 + 可读性 |
| **按钮样式** | 像素风圆角按钮，hover 时萨摩耶爪印出现 | 像素风互动 |
| **成功反馈** | 撒落像素银杏叶 + 枫叶 | 最喜欢秋天、銀杏、落葉 |
| **底部装饰** | 纽约天际线像素剪影 (紫色渐变天空) | NYC + 紫色 |
| **Favicon** | 像素萨摩耶头像 | 萨摩耶 |
| **问卷选项图标** | 像素风食物/地点小图 (如像素抹茶🍵、像素芋圆) | 喜欢抹茶、芋圆 |

**像素萨摩耶对话气泡设计:**

```
气泡样式: 像素风对话框 (8-bit 边框)

  ┌─────────────────────────────┐
  │ 嘿 Helen～今天想吃什么呀？   │
  │ 我闻到附近有好吃的了 🐾      │
  └──────────┬──────────────────┘
             │
         ┌───┴───┐
         │ ▓▓▓▓  │
         │ ▓◉◉▓  │  ← 像素萨摩耶 (32x32 或 64x64)
         │ ▓▽▽▓  │
         │ ▓▓▓▓  │
         └───────┘
```

#### 2.5.1 页面结构

```
手机 Web 页面:

┌──────────────────────────┐
│  🌸 NYC 旅游助手 🦋        │  ← Header (像素字体, 樱花+蝴蝶装饰)
│  [Brooklyn ▼] 数据源切换   │  ← 紫色下拉框
├──────────────────────────┤
│     ╔═══════════╗        │
│     ║  像素萨摩耶  ║        │  ← 萨摩耶摇尾巴动画
│     ╚═══════════╝        │
│  ┌────────────────────┐  │
│  │ 嘿～想去哪逛逛？🐾  │  │  ← 对话气泡
│  └────────────────────┘  │
│                          │
│   ┌──────────────────┐   │
│   │  🍜 附近吃什么    │   │  ← 像素风按钮 (紫色渐变)
│   └──────────────────┘   │
│                          │
│   ┌──────────────────┐   │
│   │  📍 附近去哪玩    │   │  ← 像素风按钮 (大地色渐变)
│   └──────────────────┘   │
│                          │
├──────────────────────────┤
│  🐾 ═══════════════ 🐾   │  ← 像素爪印分隔线
│  👤 用户画像              │  ← Footer
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │  ← NYC 天际线像素剪影
└──────────────────────────┘

  🌸 🌸   🌸        🌸      │  ← 飘落樱花瓣 (CSS animation)
    🌸       🌸   🌸        │
```

#### 2.5.2 「附近吃什么」流程

```
页面 1: 萨摩耶引导问卷 (问卷 A)
┌──────────────────────────┐
│ ← 返回      附近吃什么 🍜 │
├──────────────────────────┤
│     ╔═══════════╗        │
│     ║ 🐕 竖耳朵  ║        │  ← 认真思考的萨摩耶
│     ╚═══════════╝        │
│  ┌────────────────────┐  │
│  │ 让我了解你的口味～   │  │  ← 萨摩耶气泡
│  │ 回答几个问题就好！🐾 │  │
│  └────────────────────┘  │
│                          │
│ Q1: 今天想吃什么类型？    │
│ [🍜 中餐] [🍣 日料]      │  ← 像素风选择按钮
│ [🍜 韩料] [🍕 西餐]      │     每个有像素食物图标
│ [🧁 甜品] [☕ 咖啡]      │
│ [🎲 随便 (让萨摩耶选!)]  │  ← 彩蛋: 萨摩耶随机推荐
│                          │
│ Q2: 预算？               │
│ [💰 $15以下] [💰💰 $15-30]│
│ [💰💰💰 $30-60] [👑 $60+] │
│                          │
│ Q3: 口味偏好？            │
│ [🌶️ 辣] [🍬 甜] [🧂 咸]  │
│ [🍋 酸] [🍃 清淡] [🔥 重口]│
│                          │
│ Q4: 忌口？               │
│ [✅ 无] [🥬 素食]         │
│ [☪️ 清真] [🦐 海鲜过敏]   │
│                          │
│ Q5: 和谁吃？             │
│ [🧑 一个人] [👫 朋友]     │
│ [💑 约会] [👨‍👩‍👧 家庭]       │
│                          │
│ Q6: 想要什么体验？        │
│ [📸 网红打卡] [🏠 本地人]  │
│ [🤫 安静] [🎉 热闹]       │
│ [🌿 户外座位]             │
│                          │
│ Q7: 排队容忍度？          │
│ [🚫 不排] [⏱️ 15分钟]     │
│ [⏱️ 30分钟] [♾️ 无所谓]   │
│                          │
│ 📏 搜索范围: [===◉==] 1km │  ← 紫色滑动条
│                          │
│ ┌──────────────────────┐ │
│ │ 🐾 开始推荐！         │ │  ← 像素按钮, 按下时萨摩耶跳起来
│ └──────────────────────┘ │
└──────────────────────────┘

页面 2: 加载中 (萨摩耶追蝴蝶)
┌──────────────────────────┐
│                          │
│   🦋           🦋        │  ← 像素蝴蝶飞来飞去
│         🦋               │
│     ╔═══════════╗        │
│     ║ 🐕 追蝴蝶  ║        │  ← 萨摩耶转圈追蝴蝶动画
│     ╚═══════════╝        │
│                          │
│  ┌────────────────────┐  │
│  │ 汪！我在帮你找      │  │
│  │ 好吃的地方...🐾     │  │
│  └────────────────────┘  │
│                          │
│  · 搜索数据库 ✅          │  ← 紫色进度条
│  · 分析你的口味 ✅        │
│  · 搜索差评信息 🔄       │  ← 萨摩耶闻地面动画
│  · 排名推荐中… 🔄        │
│                          │
│  ▓░░░░░░░░░░░░░░░░░░░░  │  ← 像素风进度条
│                          │
└──────────────────────────┘

页面 3: 结果列表 (25 个排名)
┌──────────────────────────┐
│ ← 返回   美食 · 1km 内 🍜│
├──────────────────────────┤
│     ╔═══════════╗        │
│     ║ 🐕 吐舌笑  ║        │
│     ╚═══════════╝        │
│  ┌────────────────────┐  │
│  │ 找到啦！这些你       │  │
│  │ 一定喜欢！🐾         │  │
│  └────────────────────┘  │
│                          │
│ 🌟 TOP PICK               │  ← 像素皇冠装饰
│ ┌──────────────────────┐ │
│ │ 👑 #1 一兰拉面         │ │  ← 紫色渐变卡片边框
│ │ ⭐ 4.6 · 3,200 评论   │ │
│ │ 📏 350m · $$           │ │
│ │                        │ │
│ │ 纽约最正宗的豚骨拉面，  │ │
│ │ 汤底浓郁回味无穷。      │ │
│ │ 特别适合你这种日料爱好者 │ │
│ │                        │ │
│ │ 💜 亮点: 性价比高、      │ │  ← 紫色心心代替普通图标
│ │         正宗博多风味     │ │
│ │ ⚠️ 注意: 高峰期排队30分+ │ │
│ │                        │ │
│ │ 🐕「这家我超推！」      │ │  ← 萨摩耶小评语
│ └──────────────────────┘ │
│                          │
│ ┌──────────────────────┐ │
│ │ #2 Ramen Lab          │ │  ← 普通卡片 (大地色边框)
│ │ ⭐ 4.5 · 890 评论     │ │
│ │ 📏 500m · $$           │ │
│ │ ...                   │ │
│ │ 🐕「也不错哦～」       │ │
│ └──────────────────────┘ │
│                          │
│ ... (共 25 个)           │
│                          │
│ 🍂🍁 (银杏叶装饰分隔线)   │  ← 秋天元素
│                          │
│ ┌──────────────────────┐ │
│ │ #25 ...               │ │
│ │ 🐕「这家...你了解就好」│ │  ← 排名低的萨摩耶态度也变了
│ └──────────────────────┘ │
└──────────────────────────┘
```

#### 2.5.3 「附近去哪玩」流程

```
页面 1: 类别选择 (萨摩耶歪头)
┌──────────────────────────┐
│ ← 返回      附近去哪玩 📍│
├──────────────────────────┤
│     ╔═══════════╗        │
│     ║ 🐕 歪头    ║        │
│     ╚═══════════╝        │
│  ┌────────────────────┐  │
│  │ 想逛点什么呢？🐾    │  │
│  └────────────────────┘  │
│                          │
│  ┌──────────────────────┐│
│  │ 🏛️ 文化 (Culture)    ││ → culture.db
│  │ 博物馆、画廊、历史地标 ││   像素博物馆图标
│  └──────────────────────┘│
│                          │
│  ┌──────────────────────┐│
│  │ 🎭 娱乐 (Entertainment)│ → entertainment.db
│  │ 公园、夜生活、观景台   ││   像素摩天轮图标
│  └──────────────────────┘│
│                          │
│  ┌──────────────────────┐│
│  │ 📦 其他 (Other)       ││ → other.db
│  │ 不在以上分类的地点     ││   像素问号图标
│  └──────────────────────┘│
│                          │
│  🦋        🦋     🦋      │  ← 飞舞的像素蝴蝶
└──────────────────────────┘

页面 2: 探索问卷 (问卷 B) + 距离设置
┌──────────────────────────┐
│ ← 返回    文化 · 问卷 🏛️  │
├──────────────────────────┤
│     ╔═══════════╗        │
│     ║ 🐕 戴墨镜  ║        │  ← 要出去探索的萨摩耶
│     ╚═══════════╝        │
│  ┌────────────────────┐  │
│  │ 探索模式启动！       │  │
│  │ 先让我了解你～🐾     │  │
│  └────────────────────┘  │
│                          │
│ Q1-Q7 (同问卷 B 格式)    │
│ 📏 搜索范围: [====◉=] 2km│
│                          │
│ [🐾 出发探索！]           │
└──────────────────────────┘

页面 3: 结果列表 (同美食卡片格式, 25 个排名, 萨摩耶评语)
```

#### 2.5.4 隐藏彩蛋 & 特别细节

| 彩蛋 | 触发 | 效果 |
|------|------|------|
| **抹茶时间** | 搜索到抹茶/茶相关店铺 | 萨摩耶端着像素抹茶，说「抹茶续命！🍵」 |
| **Jellycat 发现** | 搜索到购物/礼品店 | 萨摩耶抱着一个像素 Jellycat，说「没有人可以拒绝 Jellycat！」 |
| **芋圆警报** | 搜索到甜品/台式店 | 萨摩耶流口水，说「芋圆芋圆！超软超好吃！」 |
| **拍照点** | 结果中有网红打卡地 | 卡片上多一个 📸 标记 + 萨摩耶举相机 |
| **深夜提示** | 晚上 8 点后使用 | 萨摩耶打哈欠，说「过了八点就不吃东西啦～(但推荐留着明天去)」 |
| **连续使用** | 使用超过 3 次 | 萨摩耶说「你是不是跟我一样精力旺盛！暴走型！」 |
| **猫咖发现** | 搜索到猫咖 | 萨摩耶旁边出现一只像素猫，互相歪头 |

#### 2.5.5 CSS 动画清单

```css
/* 需要实现的像素风 CSS 动画: */
@keyframes sakura-fall     { /* 樱花瓣从顶部飘落 */ }
@keyframes butterfly-fly   { /* 蝴蝶随机路径飞舞 */ }
@keyframes samoyed-wag     { /* 萨摩耶摇尾巴 (sprite) */ }
@keyframes samoyed-chase   { /* 萨摩耶追蝴蝶 (加载用) */ }
@keyframes samoyed-spin    { /* 萨摩耶转圈 (加载用) */ }
@keyframes ginkgo-fall     { /* 银杏叶飘落 (结果页装饰) */ }
@keyframes pixel-sparkle   { /* 像素星星闪烁 (Top Pick) */ }
@keyframes bubble-pop      { /* 对话气泡弹出 */ }
@keyframes nyc-skyline     { /* 天际线缓慢平移 (底部) */ }
```

#### 2.5.6 像素素材清单

| 素材 | 尺寸 | 说明 |
|------|------|------|
| `samoyed-idle.png` | 64x64 | 待机摇尾巴 (sprite sheet, 4帧) |
| `samoyed-think.png` | 64x64 | 竖耳朵思考 (问卷页) |
| `samoyed-chase.png` | 64x64 | 追蝴蝶 (加载页, 8帧) |
| `samoyed-happy.png` | 64x64 | 吐舌微笑 (结果页) |
| `samoyed-sad.png` | 64x64 | 趴下耷耳 (无结果) |
| `samoyed-crown.png` | 64x64 | 戴皇冠 (Top Pick) |
| `samoyed-sunglasses.png` | 64x64 | 戴墨镜 (探索模式) |
| `samoyed-matcha.png` | 64x64 | 端抹茶 (彩蛋) |
| `samoyed-jellycat.png` | 64x64 | 抱 Jellycat (彩蛋) |
| `samoyed-camera.png` | 64x64 | 举相机 (打卡点) |
| `butterfly.png` | 16x16 | 像素蝴蝶 (2帧) |
| `sakura-petal.png` | 8x8 | 像素樱花瓣 (3色变体) |
| `ginkgo-leaf.png` | 8x8 | 像素银杏叶 |
| `pixel-cat.png` | 32x32 | 像素猫 (猫咖彩蛋) |
| `nyc-skyline.png` | 320x48 | 纽约天际线剪影 |
| `bubble-frame.9.png` | — | 像素对话框 (9-patch) |

---

## 3. 技术实现计划 (Plan)

### 3.1 技术栈选型

| 层 | 技术 | 理由 |
|----|------|------|
| **前端** | HTML + CSS + Vanilla JS | 手机 Web，简洁轻量 |
| **后端** | Python (FastAPI) | 生态成熟，LLM 调用方便 |
| **数据库** | SQLite (已有分类 DB) | 单文件，开发部署简单 |
| **LLM** | Ollama (本地模型) | MacBook 本地运行，零 API 费用 |
| **在线搜索** | LLM 工具调用 (web search) | 搜索差评/负面评论 |
| **距离计算** | Haversine 公式 (Python) | 本地计算，无需外部 API |
| **开发环境** | MacBook + Ollama | 全栈本地开发 |

### 3.2 Ollama 模型选择

| 模型 | 参数量 | 用途 | 说明 |
|------|--------|------|------|
| `llama3.1:8b` | 8B | 推荐排序 | 速度快，适合 MacBook |
| `qwen2.5:14b` | 14B | 中文推荐 (备选) | 中文能力更强 |
| `mistral:7b` | 7B | 轻量备选 | 如果硬件资源有限 |

Ollama API 调用方式:
```bash
# 本地启动
ollama serve

# API 调用 (兼容 OpenAI 格式)
curl http://localhost:11434/v1/chat/completions \
  -d '{"model": "llama3.1:8b", "messages": [...]}'
```

### 3.3 项目目录结构

```
nyc-travel-assistant/
├── SPEC.md                          ← 本文件
├── dataset/                         ← ✅ 已有: 数据
│   ├── brooklyn/
│   │   ├── brooklyn_places.db
│   │   └── classifications/
│   │       ├── food_drink.db        (784 条)
│   │       ├── culture.db           (99 条)
│   │       ├── entertainment.db     (144 条)
│   │       └── other.db             (6 条)
│   ├── manhattan/
│   │   ├── manhattan_places.db
│   │   └── classifications/
│   │       ├── food_drink.db        (813 条)
│   │       ├── culture.db           (102 条)
│   │       ├── entertainment_recreation.db (147 条)
│   │       └── other.db             (8 条)
│   └── online_recommendations/
│
├── user_profil/                     ← ✅ 已有: 用户画像
│   ├── helen_profile.md
│   └── conversation.txt
│
├── backend/                         ← 🔜 待建: 后端服务
│   ├── main.py                      # FastAPI 入口
│   ├── config.py                    # 配置 (DB paths, Ollama URL)
│   ├── api/
│   │   ├── eat.py                   # 「附近吃什么」Pipeline API
│   │   ├── explore.py               # 「附近去哪玩」Pipeline API
│   │   └── profile.py               # 用户画像/问卷 API
│   ├── services/
│   │   ├── pipeline.py              # 共享 Pipeline 核心逻辑
│   │   ├── llm.py                   # Ollama LLM 调用封装
│   │   ├── geo.py                   # Haversine 距离计算
│   │   └── web_search.py            # 在线搜索 (差评搜索)
│   └── requirements.txt
│
└── frontend/                        ← 🔜 待建: 前端页面
    ├── index.html                   # 首页 (两个按钮 + 数据源切换)
    ├── eat.html                     # 附近吃什么 (问卷 + 结果)
    ├── explore.html                 # 附近去哪玩 (类别 + 问卷 + 结果)
    ├── profile.html                 # 用户画像展示
    ├── css/
    │   └── style.css                # 响应式样式
    └── js/
        ├── app.js                   # 主逻辑 + 数据源切换
        ├── eat.js                   # 美食 Pipeline 前端逻辑
        ├── explore.js               # 探索 Pipeline 前端逻辑
        └── questionnaire.js         # 问卷组件
```

### 3.4 API 设计

#### POST `/api/eat`

```json
// Request
{
  "latitude": 40.7580,
  "longitude": -73.9855,
  "radius_km": 1.0,
  "data_source": "manhattan",
  "questionnaire": {
    "food_type": "日料",
    "budget": "$30-60",
    "taste": "清淡",
    "restrictions": "无",
    "occasion": "朋友聚餐",
    "vibe": "本地人推荐",
    "queue_tolerance": "可以排15分钟"
  }
}

// Response
{
  "rankings": [
    {
      "rank": 1,
      "name": "一兰拉面 时代广场",
      "rating": 4.6,
      "review_count": 3200,
      "price_level": "$$",
      "primary_type": "ramen_restaurant",
      "distance_m": 350,
      "latitude": 40.7583,
      "longitude": -73.9866,
      "description": "纽约最正宗的博多风味豚骨拉面，汤底浓郁回味无穷...",
      "recommendation": "特别适合你这种日料爱好者，而且价格在预算范围内",
      "highlights": ["性价比高", "正宗博多风味", "小红书热门"],
      "warnings": ["高峰期排队可能超过30分钟"]
    },
    ...
  ],
  "total": 25,
  "radius_km": 1.0,
  "data_source": "manhattan",
  "pipeline_time_ms": 15000
}
```

#### POST `/api/explore`

```json
// Request
{
  "latitude": 40.7580,
  "longitude": -73.9855,
  "radius_km": 2.0,
  "data_source": "manhattan",
  "category": "culture",
  "questionnaire": {
    "activity": "看展",
    "budget": "$20以内",
    "mobility": "步行",
    "energy": "悠闲型慢慢来",
    "companions": "情侣",
    "vibe": "文艺",
    "popularity": "都可以"
  }
}

// Response — 格式同 /api/eat
```

#### GET `/api/profile`

```json
// Response — 返回用户画像摘要
{
  "name": "Helen",
  "summary": "亚洲胃，喜欢日料/港式/拉面/抹茶/甜品，不吃羊肉和pizza...",
  "food_likes": ["芋圆", "拉面", "抹茶", "港式", "鼎泰丰", "贝果", "提拉米苏"],
  "food_dislikes": ["羊肉", "pizza", "啤酒"],
  "travel_style": "高效但不特种兵，喜欢拍照做攻略",
  "personality": "INFJ, 独立, 情商高"
}
```

### 3.5 LLM Prompt 设计

#### 3.5.1 Pipeline 排序 Prompt

```
你是纽约旅游推荐专家，专门为华人游客提供个性化推荐。

## 用户画像
{user_profile_summary}

## 用户本次偏好 (问卷答案)
{questionnaire_answers}

## 候选地点 (按评论数排序的 Top 25，距离用户 {radius}km 以内)
{places_json}

## 你的任务
1. 综合分析每个地点的 rating、review_count、editorial_summary、reviews_preview
2. 结合用户画像和本次问卷偏好，对 25 个地点进行个性化排序
3. 如果你觉得某些地方可能有问题，可以通过在线搜索查找差评和负面信息
4. 特别关注: 食品安全问题、服务态度差、性价比低、名不副实等负面评论

## 输出格式 (中文)
对每个地点，按推荐程度从高到低排列，给出:
- 排名 (#1 到 #25)
- 名称
- 自然语言描述 (这是什么地方、特色是什么，2-3 句)
- 推荐理由 (为什么推荐/不推荐给这个用户)
- 亮点 (2-3 个关键词)
- 风险提醒 (如有负面信息，简要说明)

请用自然、友好的中文描述，像朋友在推荐一样。
```

---

## 4. 任务分解 (Tasks)

### Phase 0: 数据准备 ✅ (已完成)

- [x] T-001: 通过 Google Places API 采集 Brooklyn + Manhattan 热门地点
- [x] T-002: 建立地点分类体系 (Taxonomy)
- [x] T-003: 创建 SQLite 数据库 + 按类别拆分
- [x] T-004: 精简数据库列 → 9 列 (name, rating, review_count, price_level, primary_type, latitude, longitude, editorial_summary, reviews_preview)
- [x] T-005: 生成用户画像 (helen_profile.md)

### Phase 1: 后端核心

- [ ] T-101: 搭建 FastAPI 项目骨架 + Ollama 连接配置
- [ ] T-102: 实现 Haversine 距离计算模块 (`services/geo.py`)
- [ ] T-103: 实现共享 Pipeline 核心逻辑 (`services/pipeline.py`)
  - [ ] T-103a: 数据库冷筛 (距离范围 + review_count Top 25)
  - [ ] T-103b: 组装 LLM Prompt (地点数据 + 用户画像 + 问卷答案)
  - [ ] T-103c: 调用 Ollama LLM 生成排名
  - [ ] T-103d: LLM 在线搜索工具 (差评搜索)
  - [ ] T-103e: 解析 LLM 输出 → 结构化 JSON
- [ ] T-104: 实现 `POST /api/eat` — 美食 Pipeline API
- [ ] T-105: 实现 `POST /api/explore` — 探索 Pipeline API
- [ ] T-106: 实现 `GET /api/profile` — 用户画像 API
- [ ] T-107: 实现问卷数据接收/存储

### Phase 2: 前端

- [ ] T-201: 首页 (两个主按钮 + Brooklyn/Manhattan 数据源切换)
- [ ] T-202: 附近吃什么 — 问卷页 (问卷 A: 7 题 + 距离选择)
- [ ] T-203: 附近去哪玩 — 类别选择页 (文化/娱乐/其他) + 问卷页 (问卷 B)
- [ ] T-204: 结果列表页 (卡片式, 25 个排名, 共享组件)
- [ ] T-205: 加载中页面 (Pipeline 进度展示)
- [ ] T-206: 用户画像展示页
- [ ] T-207: 手机响应式适配

### Phase 3: 集成与优化

- [ ] T-301: 前后端联调
- [ ] T-302: Pipeline Prompt 调优 (用真实数据测试排名质量)
- [ ] T-303: 在线搜索差评功能测试
- [ ] T-304: Ollama 模型选择/性能测试 (MacBook 上的响应速度)
- [ ] T-305: 端到端测试 (从问卷到结果展示)

---

## 5. 附录

### 5.1 当前已有资产

| 资产 | 路径 | 说明 |
|------|------|------|
| Brooklyn 分类 DB | `dataset/brooklyn/classifications/*.db` | food_drink(784), culture(99), entertainment(144), other(6) |
| Manhattan 分类 DB | `dataset/manhattan/classifications/*.db` | food_drink(813), culture(102), entertainment(147), other(8) |
| Brooklyn 合并 DB | `dataset/brooklyn/brooklyn_places.db` | 全量合并数据 |
| Manhattan 合并 DB | `dataset/manhattan/manhattan_places.db` | 全量合并数据 |
| 用户画像 | `user_profil/helen_profile.md` | Helen 的完整画像 |
| 对话记录 | `user_profil/conversation.txt` | Messenger 原始对话 |
| Google 采集脚本 | `dev/fetch_*_google_places.py` | Brooklyn + Manhattan |
| 网络推荐数据 | `dataset/online_recommendations/` | 在线推荐 |

### 5.2 环境要求

```bash
# MacBook 本地开发环境
# 1. Ollama (本地 LLM)
brew install ollama
ollama pull llama3.1:8b    # 或 qwen2.5:14b (中文更好)
ollama serve               # 启动服务 (默认 localhost:11434)

# 2. Python 后端
python -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn httpx

# 3. 启动后端
cd backend && uvicorn main:app --reload --port 8000

# 4. 前端直接用浏览器打开
open frontend/index.html
# 或用 Live Server 插件
```

### 5.3 成本估算

| 项目 | 费用 | 说明 |
|------|------|------|
| Ollama LLM | $0 | 本地运行，免费 |
| Google Places API | $0 | 数据已采集完成，不再调用 |
| 在线搜索 | $0 | 使用免费搜索 API 或爬虫 |
| 部署 | $0 | MacBook 本地运行 |
| **总计** | **$0** | 全栈本地开发，零成本 |

### 5.4 数据库各表字段说明

所有分类 DB 的 `places` 表结构统一 (9 列):

| 字段 | 类型 | 说明 | Pipeline 用途 |
|------|------|------|-------------|
| `name` | TEXT | 地点名称 | 展示 + LLM 输入 |
| `rating` | REAL | Google 评分 (1-5) | LLM 排序参考 |
| `review_count` | INTEGER | 评论数量 | 冷排序依据 (Top 25) |
| `price_level` | TEXT | 价格等级 | LLM + 用户匹配 |
| `primary_type` | TEXT | 地点类型 | 分类筛选 |
| `latitude` | REAL | 纬度 | 距离计算 |
| `longitude` | REAL | 经度 | 距离计算 |
| `editorial_summary` | TEXT | Google 编辑摘要 | LLM 了解地点特色 |
| `reviews_preview` | TEXT | 用户评论预览 | LLM 了解真实口碑 (仅 Manhattan) |

### 5.5 参考资料

- [Ollama 官方文档](https://ollama.com/)
- [Ollama API 文档](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [FastAPI 文档](https://fastapi.tiangolo.com/)
- [Haversine 公式](https://en.wikipedia.org/wiki/Haversine_formula)
- [Google Places API (New) 文档](https://developers.google.com/maps/documentation/places/web-service)
