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

## Следующий шаг — Stage 2: Reviews Agent

По `TODOS.md`:
- `agents/reviews_agent.py` — CrewAI агент с `output_pydantic=ReviewData`,
  стоп по насыщению (`is_saturated()`), `MAX_REVIEWS=200`
- `models/schemas.py` — Pydantic-схема `ReviewData`
- `tools/memory_save_tool.py` — CrewAI-инструмент обёртка над `save_batch()`
- `tools/memory_search_tool.py` — CrewAI-инструмент обёртка над `search()`
- `main.py` — точка входа; создаёт запись в `analysis_runs`, запускает crew
- Скрейпер: `google-play-scraper` / `app-store-scraper` + мок-фикстуры в `tests/fixtures/`

**Цель Этапа 1 (из дизайн-документа):**
`python main.py` запускает Reviews Agent против реального приложения (FitTrack или любого),
выводит сгруппированный список тем с тональностью, данные в Supabase.
