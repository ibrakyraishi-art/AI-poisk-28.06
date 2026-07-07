# PROGRESS.md — журнал прогресса CompetitorScope

**Правило:** после каждого значимого изменения добавлять новую запись
с датой — что сделано и почему. При старте новой сессии читать этот файл первым.

---

## 2026-06-28 — Инфраструктура Supabase + Stage 1

### Supabase (проект `competitor-scope`, id: `nqpeidlfkcxucgqykyrv`)

- **pgvector включён** (`CREATE EXTENSION vector`) — тип данных `vector(384)` теперь доступен в БД
- **Таблица `analysis_runs`** — хранит статус каждого анализа (pending→running→completed/failed),
  прогресс, JSON-результат, путь к docx. RLS включён.
- **Таблица `embeddings`** — RAG-память: тексты агентов + 384-мерные векторы.
  HNSW индекс на `vector_cosine_ops` — быстрый поиск по косинусному сходству. RLS включён.
- **Supabase Auth** — встроен, `auth.users` подтверждена; к ней FK из обеих таблиц.
- **RLS-политики** — каждый пользователь видит только свои строки (`auth.uid() = user_id`).
  Python backend (Railway) использует service key → обходит RLS.
- **`fail_stale_runs()`** — SQL-функция, помечает "running" jobs старше 45 мин как "failed".
  Причина: если Railway-контейнер упадёт, job зависает в running навсегда.
- **pg_cron** — расписание `*/10 * * * *` вызывает `fail_stale_runs()`. Watchdog работает.
- **`match_embeddings(query, run_id, limit)`** — SQL RPC-функция для косинусного поиска
  через `<=>` оператор. Используется в `vector_store.search()`.

### Stage 1 — config + memory layer (`c6e0a17`)

**`config/llm_config.py`**
Реестр моделей с LiteLLM-идентификаторами (`gemini/gemini-1.5-flash`, `claude-sonnet-4-6` и др.).
`get_litellm_id(key)` → строка для CrewAI. `DEFAULTS` → умолчания по агентам.
`needs_cost_warning()` → сигнал UI показать предупреждение перед Opus.

**`config/limits.py`**
Все числа-пороги в одном файле: `MAX_REVIEWS=200`, `BATCH_SIZE=50`,
`COSINE_THRESHOLD=0.85`, `NEW_TOPIC_MIN_RATIO=0.05`, `MAX_RETRIES=2`.

**`memory/vector_store.py`**
- `save_batch()` — батчевый INSERT: N чанков = 1 запрос к Supabase + 1 проход модели.
  Реализовано сразу после ревью (одиночный save был N запросов).
- `save()` — тонкая обёртка над `save_batch()` для одного чанка.
- `search()` — вызывает `match_embeddings()` RPC, возвращает top-k похожих записей.
- `is_saturated()` — стоп-сигнал для Reviews Agent: True если <5% батча новых тем.
- Ленивая загрузка модели и клиента (первый вызов инициализирует, потом кэш).
- Валидация env-переменных с понятным сообщением об ошибке.

### Открытые слабые места (из ревью)

| # | Проблема | Приоритет | Когда чинить |
|---|---------|-----------|-------------|
| 1 | `is_saturated()` делает N запросов к Supabase (N = батч) | Medium | До Stage 3 (оптимизация, не блокер) |
| 2 | Скрытая зависимость от `match_embeddings()` SQL-функции | Low | README или startup-check |
| 3 | Глобальный `_client_instance` усложняет тесты | Low | Перед написанием тестов |
| 4 | Нет retry при падении Supabase-соединения | Medium | Перед продом |

---

## 2026-06-29 — Stage 2: Reviews Agent (ЗАВЕРШЁН)

### Что сделано

**`models/schemas.py`**
Pydantic-схемы для всех агентов: `ReviewTheme`, `ReviewData`, `AnalystOutput`,
`CompetitorProfile`, `ReportData`. `confidence` в ReviewData/AnalystOutput управляет
ConditionalTask retry-логикой в Stage 4.

**`tools/memory_save_tool.py` / `tools/memory_search_tool.py`**
CrewAI-инструменты (`BaseTool`) над `vector_store.save()` и `vector_store.search()`.
`run_id` / `user_id` хранятся как Pydantic-поля инструмента — изолируют каждый запуск.
`MemorySearchTool` возвращает результаты с меткой агента и score — LLM видит контекст.

**`agents/reviews_agent.py`**
- `FetchAndSaveReviewsTool`: один вызов от LLM → весь пайплайн (скрейп → батч по 50 →
  saturation check → save_batch). LLM не управляет циклом, только вызывает инструмент.
- Фолбэк: любое исключение скрейпера → загружается `tests/fixtures/app_store_reviews.json`
  (50 реалистичных отзывов: батарея, краши, цена, GPS, UI).
- `create_reviews_agent()` / `create_reviews_task()` — фабрики для Stage 4 (Manager).
- `output_pydantic=ReviewData` — CrewAI требует JSON по схеме, retry если не совпадает.

**`main.py`**
- CLI: `python main.py --company FitTrack --period 30d [--model sonnet]`
- Создаёт `analysis_runs` запись (status=running), обновляет на completed/failed.
- Работает без Supabase (локальный run_id fallback).
- Предупреждение о стоимости перед Opus.
- Красивый вывод в консоль: темы с тональностью и цитатами.

**`tests/fixtures/app_store_reviews.json`**
50 реалистичных отзывов fitness-приложения. Темы: battery, crashes, price/subscription,
GPS accuracy, sync bugs, UI/UX, customer support, features.

### Открытые слабые места (Stage 2)

| # | Проблема | Приоритет | Когда чинить |
|---|---------|-----------|-------------|
| 1 | `is_saturated()` делает N запросов к Supabase | Medium | До Stage 4 |
| 2 | Скрейперы не протестированы с реальными app_id | Medium | Перед первым реальным запуском |
| 3 | `result.pydantic` может быть None при LLM-сбое | Low | Добавить retry в main.py |
| 4 | Нет `requirements.txt` | High | Перед первым запуском |

---

---

## 2026-06-29 — Stage 3: полный 4-агентный pipeline (ЗАВЕРШЁН)

### Что сделано

**`models/schemas.py`** — добавлен `NewsData` (company, period, article_count,
key_developments, sentiment_summary, confidence, articles_saved_to_memory).

**`agents/news_agent.py`**
- `NewsSearchTool`: запросы к newsapi-python (4 поисковые фразы по шаблону).
  Фолбэк: 10 mock-статей, если `NEWS_API_KEY` не задан или API упал.
  Агент сам решает, какие статьи релевантны, и вызывает `memory_save` —
  не сохраняем всё подряд автоматически.
- Дефолтная модель: `gemini-flash` (задача простая — найди и сохрани).

**`agents/analyst_agent.py`**
- Только `MemorySearchTool` — без внешних запросов.
  Читает из pgvector то, что Reviews + News агенты уже туда положили.
- 6 поисковых запросов покрывают все квадранты SWOT.
- Также получает структурированный JSON предыдущих агентов через `context=`.
- Дефолтная модель: `sonnet` (синтез сложнее сбора данных).
- `max_iter=10` — больше итераций для 6 поисковых запросов.

**`agents/report_writer_agent.py`**
- `GenerateReportTool`: принимает полный ReportData JSON → создаёт .docx
  (python-docx) → загружает в Supabase Storage `reports/{run_id}/report.docx`.
  Фолбэк: сохраняет в `output/` локально если Storage недоступен.
- `output_pydantic=ReportData` — структурированный JSON и docx генерируются
  одновременно.
- `max_iter=6` — меньше итераций (данные уже готовы, задача — написать и сохранить).

**`tasks/research_tasks.py`** — полностью рефакторен:
все 4 функции `make_*_task()` делегируют в соответствующие agent-модули.
Нет дублирования Task-определений.

**`main.py`** — обновлён для полного 4-агентного запуска:
- Создаёт 4 агента + 4 задачи с правильной цепочкой `context=`.
- `--model` переопределяет модель у всех агентов одновременно.
- `_finish_run()` теперь сохраняет `report_docx_path` в `analysis_runs`.
- `_print_results()` выводит executive summary, SWOT, инсайты, рекомендации.

### Архитектура pipeline (Stage 3)

```
Reviews Agent  →  pgvector (embeddings)
                      ↓
News Agent     →  pgvector (embeddings)
                      ↓
Analyst Agent  ←  pgvector search + context JSON
                      ↓
Report Writer  ←  context JSON → .docx → Supabase Storage
                      ↓
              analysis_runs.report_json / report_docx_path
```

### Что нужно перед первым запуском Stage 3

1. Создать бакет "reports" в Supabase Storage (Dashboard → Storage → New bucket).
2. Задать переменные в `.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`,
   `ANTHROPIC_API_KEY` (или `GOOGLE_API_KEY`), опционально `NEWS_API_KEY`.
3. `pip install -r requirements.txt`

---

## 2026-06-29 — Stage 4: Manager + Process.hierarchical + ConditionalTask (ЗАВЕРШЁН)

### Что сделано

**`requirements.txt`** — зафиксирован `crewai>=0.80.0,<1.0.0` с комментарием
о трёх breaking changes в 1.x: убран `output_pydantic=`, переименован
`ConditionalTask`, сломаны litellm-строки модели. `crewai-tools<1.0.0` тоже.

**`agents/manager_agent.py`**
- `create_manager_agent()`: `allow_delegation=True`, нет инструментов.
- Передаётся в `Crew(manager_agent=...)`, НЕ в `agents=[]`.
- Дефолтная модель: `sonnet` — Manager читает JSON-выводы агентов, нужно понимание.

**`main.py`** — переключён на `Process.hierarchical` + добавлен `ConditionalTask`:

```
reviews_task          → всегда выполняется
retry_reviews_task    → ConditionalTask, выполняется если _needs_review_retry()=True
news_task             → всегда выполняется
analyst_task          → context: [reviews, retry_reviews, news]
report_task           → context: [reviews, retry_reviews, news, analyst]
```

**`_needs_review_retry(task_output)`**: читает `task_output.pydantic` (ReviewData),
возвращает True если `review_count < 10` или `confidence < 0.7`.
Manager вызывает эту функцию автоматически перед `retry_reviews_task`.

**Эскалация периода**: `30d → 90d → 6m` (константа `_PERIOD_ESCALATION`).
При retry агент получает расширенный период в описании задачи.

**Analyst и Report** получают оба reviews-таска в `context=`:
если retry запустился — видят оба вывода и берут более полный.

---

## 2026-06-29 — Stage 5: Business Context + Competitor Finder (ЗАВЕРШЁН)

### Что сделано

**`models/schemas.py`** — два новых типа:
- `BusinessContextData`: category, target_audience, key_differentiators,
  `main_competitors` (список имён → передаётся Competitor Finder), market_context.
- `CompetitorFinderOutput`: обёртка над `list[CompetitorProfile]` с confidence.

**`tools/serper_search_tool.py`**
Общий инструмент для обоих агентов Stage 5. POST на `google.serper.dev/search`.
10 mock-результатов (сравнения, цены, рейтинги, рыночная статистика) когда
`SERPER_API_KEY` не задан. Результаты не сохраняются автоматически — агент решает сам.

**`agents/business_context_agent.py`**
3 поисковых запроса: категория, аудитория, конкуренты. `output_pydantic=BusinessContextData`.
`main_competitors` — "мост" к Competitor Finder через `context=`. Модель: haiku.

**`agents/competitor_finder_agent.py`**
2 веб-поиска на каждого конкурента (рейтинг+цена, функции+отзывы).
`max_iter=12` (до 5 конкурентов × 2 поиска + сохранения). `output_pydantic=CompetitorFinderOutput`.
`COMPETITOR_MIN_COUNT=2` используется в тексте задачи. Модель: haiku.

**`agents/report_writer_agent.py`** — обновлён `create_report_task()`:
`competitors` теперь берётся из CompetitorFinderOutput в context (не пустой список).
Рекомендации должны ссылаться на конкурентов по имени.

**`main.py`** — полный 7-задачный pipeline:
```
reviews_task            → всегда
retry_reviews_task      → ConditionalTask
business_context_task   → рыночный контекст
news_task               → новости
competitor_finder_task  → context: [business_context_task]
analyst_task            → context: [reviews × 2, news_task]
report_task             → context: [все выше]
```
`_print_results` теперь выводит секцию конкурентов (рейтинг, цена, топ-1 плюс/минус).

---

## 2026-06-29 — Stage 6: FastAPI Backend + Next.js Frontend (ЗАВЕРШЁН)

### Что сделано

**`api/auth.py`**
JWT-верификация через PyJWT: проверяет Bearer-токен, HS256, audience="authenticated".
Возвращает `user_id` (sub из payload). Используется как `Depends(verify_jwt)`.

**`api/runner.py`**
`ThreadPoolExecutor(max_workers=4)` — запускает полный 7-агентный pipeline в фоне.
`start_analysis_run()` создаёт запись в `analysis_runs`, запускает `_run_crew()` и возвращает `run_id` немедленно.
`_run_crew()` вызывает `crew.kickoff()`, обновляет статус на completed/failed.

**`api/routes/analyze.py`**
- `POST /analyze`: валидирует company/period, вызывает `start_analysis_run()`, возвращает `{run_id, status}`.
- `GET /analyze/{run_id}`: **P0 security** — сравнивает `run["user_id"] == JWT.sub` перед возвратом, 403 при несовпадении.

**`api/main.py`**
FastAPI app с CORS (origins из env `CORS_ORIGINS`), включает analyze router.
Запуск: `uvicorn api.main:app --log-level warning --no-access-log` (P1: скрывает URL из логов).

**`frontend/`** — Next.js 14 на TypeScript

| Файл | Назначение |
|---|---|
| `src/lib/supabase.ts` | Supabase client (anon key) |
| `src/lib/api.ts` | `startAnalysis()`, `getAnalysisRun()`, `getSignedDocxUrl()`, `pollUntilDone()` |
| `src/app/layout.tsx` | Root layout |
| `src/app/page.tsx` | Landing с CTA |
| `src/app/auth/page.tsx` | Supabase Auth UI (email/pass) |
| `src/app/settings/page.tsx` | BYOK — upsert в `user_api_keys` |
| `src/app/dashboard/page.tsx` | Форма анализа + список прошлых запусков |
| `src/app/results/[runId]/page.tsx` | Polling каждые 5 сек пока status=running, отображает ReportView, кнопка Download .docx |
| `src/components/AnalysisForm.tsx` | Форма с cost warning modal перед Opus |
| `src/components/ReportView.tsx` | Executive summary, темы, SWOT, рекомендации |
| `src/components/CompetitorMatrix.tsx` | Таблица конкурентов с цветовой кодировкой рейтинга |

**Supabase migration: `create_user_api_keys`**
Таблица `user_api_keys` (uuid PK, user_id FK → auth.users, keys jsonb).
RLS: каждый пользователь видит только свою строку. Trigger `updated_at`.

### Деплой

**Backend (Railway):**
```
uvicorn api.main:app --host 0.0.0.0 --port $PORT --log-level warning --no-access-log
```
Env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`, `CORS_ORIGINS`.

**Frontend (Vercel):**
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=https://your-railway-app.up.railway.app
```

---

## 2026-07-02 — Деплой (Render + Vercel) + BYOK + фиксы сборки

### Продакшн-адреса

- **Backend (Render):** `https://ai-poisk-28-06.onrender.com` — FastAPI + uvicorn.
  Free-tier: контейнер засыпает после простоя, первый запрос будит (~30-60 сек).
- **Frontend (Vercel):** `https://ai-poisk-28-06.vercel.app` (+ preview-URL ветки `main`).

### Переезд с Railway на Render

- **`runtime.txt`** → `python-3.12` (Render определяет версию Python по этому файлу).
- **`Procfile`** → команда запуска uvicorn.
- Причина: Railway перестал устраивать по бесплатному тарифу; Render проще для Python.

### `requirements.txt` — вычищены конфликты зависимостей

Серия фиксов (коммиты `cacbf7a`, `d1f9d0f`, `9f18ce4`, `c93d854`, `a814b6f`):
- **`crewai==0.86.0`** — зафиксирован ТОЧНО (не диапазон). 1.x ломает `ConditionalTask`,
  `output_pydantic`, `Process.hierarchical`. `crewai-tools` убран (тянул конфликтующие пакеты).
- **`app-store-scraper` удалён** — пинил `requests==2.23.0`, что ломало весь дерево зависимостей.
  Reviews Agent падает на фолбэк (mock-отзывы), пока не подключён другой скрейпер.
- **`serper-python` заменён на `requests`** — пакета с таким именем не существует;
  Serper дёргаем прямым HTTP POST.
- **Добавлены веб-серверные зависимости** (их отсутствие роняло Render с "Exited status 1"):
  ```
  fastapi>=0.111.0
  uvicorn[standard]>=0.29.0
  PyJWT>=2.8.0
  ```

### BYOK — «свои ключи» (коммит `bcb0cad`)

- **`_load_user_keys(user_id)`** в `api/runner.py`: перед `crew.kickoff()` читает
  `user_api_keys.keys` (JSONB) из Supabase и инъектит ключи в `os.environ`
  (`ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `SERPER_API_KEY`, `NEWS_API_KEY`).
  В блоке `finally` — восстанавливает исходное окружение.
- **Модель BYOK:** пользователь добавляет ключи через страницу Settings → они лежат
  в его приватной строке таблицы `user_api_keys` под RLS, НЕ в серверных env-переменных.
  Сервер подставляет их только на время конкретного запуска этого пользователя.

### Фиксы сборки фронтенда

- `25475e8` — `export const dynamic = "force-dynamic"` на страницах с Supabase,
  чтобы Next.js не пытался пре-рендерить их на билде (падало без сессии).
- `6d0b380` — `supabase.ts`: плейсхолдер-фолбэки для env, чтобы билд не крашился,
  когда переменные ещё не заданы.
- `c4da6ac` — типы `Report` во фронте выровнены со схемами Pydantic бэкенда
  (`completed_at` вместо `updated_at`).
- `6062e9a` — защита от пустого ответа Supabase insert в `runner.py`.
- **Settings загружает существующие ключи** при открытии (`useEffect` → select из
  `user_api_keys`). Раньше повторный вход показывал пустые поля и сохранение затирало ключи.

---

## 2026-07-06 — Русская локализация + тёмная тема + живая визуализация агентов

### Полная локализация на русский (коммиты `48aa1b7`, `7f0be66`)

- Все страницы и компоненты переведены: лендинг, вход, кабинет, настройки, форма
  анализа, отчёт, таблица конкурентов, страница результатов.
- **Supabase Auth UI** локализован через `localization.variables` (вход/регистрация/сброс пароля).
- `api.ts` — тексты ошибок на русском.
- Даты рендерятся через `toLocaleString("ru-RU")`.
- `layout.tsx` — `html lang="ru"`, Inter догружает `cyrillic` subset, `description` на русском.
- Тональность в отчёте показывается по-русски (позитив/негатив/смешанный).

### Первый заход по дизайну (коммит `12c4656`)

- Inter через `next/font`, SVG-фавикон 🔭.
- Статусы анализов — цветные бейджи с иконками вместо сырого текста.
- Dashed-карточка пустого состояния, спиннер на кнопке «Запуск…».
- **Починена зелёная кнопка Supabase** → фирменный индиго (`appearance.variables`).

### Тёмная тема + фирменный стиль (коммит `5a7f41c`)

- **`layout.tsx`** — near-black фон `#07070e` + мягкие свечения (индиго/фиолетовый/фуксия) на фоне.
- **Лендинг** — градиентный заголовок с эффектом shimmer, стеклянные карточки
  (glassmorphism), светящаяся кнопка CTA, пульсирующий бейдж, футер.
- **Вход** — тёмная стеклянная карточка + полный тёмный набор переменных ThemeSupa.
- **Кабинет / настройки / результаты / отчёт / таблица** — тёмные поверхности,
  полупрозрачные карточки, тёмные бейджи статусов.
- **`globals.css`** — keyframes `pulse-glow` / `float-slow` / `shimmer` + тёмный скроллбар.

### `AppHeader` — единая шапка

Общий липкий стеклянный топ-бар (логотип 🔭 + навигация Кабинет / API-ключи / Выйти)
на всех страницах приложения. Раньше в настройках и результатах шапки не было вообще.

### `AgentPipeline` — живая визуализация 7 агентов (главная фича)

На странице результатов, пока `status=running`, показывается пайплайн из 7 реальных агентов
в порядке выполнения:

```
Менеджер → Исследование рынка → Отзывы → Новости → Конкуренты → Стратегия → Отчёт
```

- у каждого агента иконка, название, описание задачи;
- состояния done/active/pending: галочка / пульсирующее свечение «выполняется…» / притушено;
- прогресс-бар + таймер, всё анимируется.
- **Ограничение:** бэкенд отдаёт только общий статус (running/completed), без отметок по
  агентам. Активный этап оценивается по времени (пайплайн ≈ 3–8 мин). Для ТОЧНОЙ пошаговой
  отметки нужно, чтобы `runner.py` писал текущего агента в `analysis_runs` (напр. поле
  `current_stage`), тогда визуализация подхватит реальные данные. — **открытая задача.**

### Дизайн-ревью по коду (коммит `f4a9e8d`)

Браузерный `/design-review` из облачного окружения не запускается (прокси режет доступ
к сайту). Ревью сделано по коду — найдено и починено:
- **`AppHeader` остался светлым** (белый бар `bg-white/80` на тёмном сайте) — перекрашен в тёмное стекло.
- Футер лендинга `text-slate-600` — низкий контраст на near-black → `slate-500`.

### Прочее

- **`frontend/.gitignore`** (коммит `ca74070`) — игнор `.next/`, `next-env.d.ts`,
  `*.tsbuildinfo`, `node_modules`, `.vercel`.

### Новые файлы фронтенда

| Файл | Назначение |
|---|---|
| `src/components/AppHeader.tsx` | Единая липкая шапка с навигацией (тёмное стекло) |
| `src/components/AgentPipeline.tsx` | Живая визуализация 7-агентного пайплайна во время анализа |

### Открытые задачи

| # | Задача | Приоритет |
|---|--------|-----------|
| 1 | `runner.py` пишет текущего агента в `analysis_runs.current_stage` → реальный прогресс в `AgentPipeline` | Medium |
| 2 | Подключить реальный скрейпер отзывов (app-store-scraper убран из-за конфликта) | Medium |
| 3 | Проверить весь сквозной сценарий на проде: регистрация → ключи → анализ → отчёт | High |
| 4 | Render free-tier засыпает — первый запрос долгий; рассмотреть keep-alive или платный тариф | Low |

---

## 2026-07-06 — CORS-фикс + 2-й раунд дизайн-ревью (по скринам с прода)

Локальный Claude Code (с браузером) прогнал визуальное ревью прод-сайта и нашёл главное:
**ядро продукта не работало из-за CORS.**

### 🔴 CORS — запуск анализа блокировался (коммит `f7ac907`)

- Симптом: `POST …onrender.com/analyze` с прод-origin `ai-poisk-28-06.vercel.app` →
  preflight отдавал 400 без `Access-Control-Allow-Origin`. `/health` при этом жив (200).
- Причина: в `CORS_ORIGINS` на Render остался старый preview-домен.
- **Фикс в коде** (`api/main.py`): добавлен `allow_origin_regex=r"https://.*\.vercel\.app"`
  (пропускает и прод-алиас, и все превью) + прод-домен всегда в списке. Теперь протухший
  env на хосте не может снова сломать CORS. Требуется редеплой Render.

### Дизайн-фиксы по ревью (коммит `f7ac907`)

- **Шапка на мобильном (390px)**: логотип слипался с навигацией → скрыл дублирующую
  ссылку «Кабинет» на телефоне, уменьшил текст, `whitespace-nowrap`, `shrink-0`.
- **Сырая ошибка «Failed to fetch»** → понятное русское сообщение (бэкенд мог заснуть)
  + ссылка «Проверить API-ключи →» на настройки.
- **Контраст ниже WCAG AA**: вторичный текст `slate-500` → `slate-400` (футер, подсказки,
  подписи, «Упоминаний», описания агентов).
- **Настройки на десктопе**: форма висела вверху → обёрнута в стеклянную карточку.
- **`color-scheme: dark`** в globals — нативные контролы/автозаполнение/скроллбары в тёмном.

### Отложено (субъективное / требует визуальной итерации)

- 3-колоночная сетка фич на лендинге («AI-slop» по мнению ревьюера) — переделка формы подачи.
- Эмодзи-логотип 🔭 → векторное лого.
- Тач-таргеты ссылок Supabase на /auth < 44px (внутри чужого UI-компонента).

### Всё ещё не проверено вживую

Живой пайплайн из 7 агентов снять не удалось — запуск анализа блокировался CORS.
После редеплоя Render нужно повторить прогон и доснять `agents_running_*` + отчёт.

---

## 2026-07-07 — JWT ES256 + подсказки к API-ключам

### 🔴 401 на /analyze — алгоритм JWT (коммит `27fac35`)

После фикса CORS запрос дошёл до бэкенда, но вернул `401: The specified alg value
is not allowed`. Причина: Supabase подписывает access-токены **асимметрично (ES256
через JWKS)**, а `api/auth.py` принимал только legacy `HS256`.
- **Фикс** (`api/auth.py`): `verify_jwt()` читает `alg` из заголовка токена и проверяет
  подпись соответствующе — HS256 по `SUPABASE_JWT_SECRET`, ES256/RS256 по публичному
  ключу из JWKS Supabase (`{SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
  кэш через `PyJWKClient`). Работает и на старых, и на новых проектах.
- `requirements.txt`: `PyJWT` → `PyJWT[crypto]` (для ES256 нужен `cryptography`).

### Подсказки к API-ключам (коммит `8a998e2`)

Страница `/settings`: у каждого ключа теперь описание (для чего), прямая ссылка
«Получить ключ ↗» (console.anthropic.com / aistudio.google.com / serper.dev /
newsapi.org) и плашка сверху (нужен минимум один LLM-ключ).

### Всё ещё не проверено вживую

Живой пайплайн из 7 агентов по-прежнему не снят — теперь ждём редеплой Render с JWT-фиксом,
затем повторный прогон анализа.

---

## 2026-07-07 — 🎉 ВЕХА: пайплайн заработал вживую + устойчивость результатов

После редеплоя Render (JWT-фикс подхватился) запуск анализа **ВкусВилл** впервые
прошёл сквозь весь стек: логин → POST /analyze (200) → перекид на /results →
**живой пайплайн из 7 агентов** с галочками, активным «выполняется…», прогресс-баром
и таймером. Это ровно то, что просили в начале проекта — визуализация взаимодействия агентов.

### Диагностика деплоя

Добавлен маркер в `/health`: `{"status":"ok","auth":"es256+hs256"}` — позволяет
точно проверять, какой JWT-билд живой на Render (а не гадать по симптомам).

### 🐛 Фикс устойчивости /results (коммит `a4f77bf`)

Ревью поймало баг: разовый сбой опроса статуса (`Failed to fetch` при cold-start Render)
**сносил весь экран** и убивал просмотр идущего анализа, потому что:
1. успешный опрос не сбрасывал `error`;
2. фатальный экран показывался при любом `error`.
- Теперь: успешный опрос очищает ошибку; фатальный экран только когда данных нет вообще
  (`error && !run`) + кнопка «Повторить»; во время анализа временный сбой показывает мягкий
  баннер «переподключаемся…», следующий опрос восстанавливает.

### Наблюдение (не баг)

Прогон ВкусВилл шёл >16 мин (последний агент — генерация отчёта LLM). Дольше оценки 3–8 мин.
Watchdog `fail_stale_runs()` пометит зависшие >45 мин как failed. Реальный по-агентный
прогресс (открытая задача #1: `analysis_runs.current_stage`) покажет, где именно затык.

### 🔴 Разбор зависона: дефолт на Gemini без ключа Google (коммит `4f2d962`)

Прогон ВкусВилл завис на 27.5 мин. Диагностика через прямой SQL к Supabase:
- `analysis_runs`: `running`, 0 ошибки, отчёта нет;
- `embeddings` для run_id: **0 записей** → ни один агент реально ничего не сохранил
  (галочки в UI — анимация по времени, не реальный прогресс);
- `user_api_keys`: заданы Anthropic + Serper + NewsAPI, **Google — нет**.

Причина: `config/llm_config.py` DEFAULTS ставит `reviews_agent` и `news_agent` на
`gemini-flash` (нужен ключ Google). Пользователь без Google-ключа → первый агент
(Отзывы) виснет на бесконечных ретраях Gemini → немой зависон до watchdog.

**Фикс (`api/runner.py`), `_resolve_model_or_fail()` перед kickoff:**
- дефолт адаптируется под ключи: оба (Google+Anthropic) → per-agent микс;
  только Anthropic → весь пайплайн на `haiku`; только Google → `gemini-flash`;
  только OpenAI → `gpt-4o-mini`;
- явная модель: проверяем наличие её провайдер-ключа, иначе мгновенный fail
  с понятным сообщением (ValueError → `analysis_runs.error`), без 27-мин зависона.
- Фронт: подпись дефолта «Gemini Flash» → «авто по вашим ключам».

Зависший прогон вручную помечен `failed` с пояснением (чтобы не висел до 45 мин).
