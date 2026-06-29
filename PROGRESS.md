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

## Следующий шаг — Stage 3: News Agent + Analyst + Report Writer

По `TODOS.md`:
- `agents/news_agent.py` — News API интеграция
- `models/schemas.py` — добавить `NewsData` (уже есть файл, дополнить)
- `tasks/research_tasks.py` — sequential pipeline: Reviews → News → Analyst → Report
- `agents/analyst_agent.py` — читает из pgvector, пишет AnalystOutput (SWOT)
- `agents/report_writer_agent.py` — генерирует JSON + report.docx
- Загрузка docx в Supabase Storage, запись `report_docx_path` в `analysis_runs`

**Перед Stage 3**: добавить `requirements.txt` с зафиксированными версиями
(особенно `crewai==x.y.z` — ConditionalTask API нестабилен).
