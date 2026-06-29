# CompetitorScope — TODO (post eng-review 2026-06-28)

## Security fixes ✅ все закрыты в Stage 6

- [x] **P0**: `GET /analyze/{run_id}` проверяет `analysis_runs.user_id == JWT.sub`, 403 при несовпадении.
- [x] **P1**: `log_level=WARNING` + `--no-access-log` в uvicorn; LLM-ключи не попадают в логи.
- [x] **P1**: Watchdog — `fail_stale_runs()` SQL-функция + pg_cron `*/10 * * * *` (Stage 1, Supabase).

## Infrastructure ✅

- [x] Supabase project создан (`competitor-scope`, id: `nqpeidlfkcxucgqykyrv`)
- [x] `vector` extension включён, HNSW индекс
- [x] Schema migrations: `analysis_runs`, `embeddings` (vector 384-dim)
- [x] Supabase Auth включён
- [x] Storage bucket `reports` создан (private)
- [x] `Procfile` для Railway — `uvicorn api.main:app --host 0.0.0.0 --port $PORT ...`
- [x] `.env.example` для backend и `frontend/.env.example` для Vercel
- [ ] Задать Railway env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_JWT_SECRET, и т.д.

## Stage 1 — config + memory layer ✅

- [x] `config/llm_config.py`
- [x] `config/limits.py`
- [x] `memory/vector_store.py`
- [x] `tools/memory_save_tool.py`
- [x] `tools/memory_search_tool.py`
- [x] `models/schemas.py`
- [x] `agents/reviews_agent.py`
- [x] `main.py`

## Stage 2 — News Agent ✅

- [x] `agents/news_agent.py`
- [x] `models/schemas.py` — `NewsData`
- [x] `tasks/research_tasks.py`

## Stage 3 — Analyst + Report Writer ✅

- [x] `models/schemas.py` — `AnalystOutput`, `ReportData`, `CompetitorProfile`
- [x] `agents/analyst_agent.py`
- [x] `agents/report_writer_agent.py` — JSON + docx
- [x] docx → Supabase Storage, path → `analysis_runs.report_docx_path`
- [x] JSON → `analysis_runs.report_json`

## Stage 4 — Manager + Process.hierarchical ✅

- [x] `agents/manager_agent.py`
- [x] `Process.hierarchical` в Crew
- [x] `ConditionalTask` retry если `review_count < 10` или `confidence < 0.7`
- [x] `crewai>=0.80.0,<1.0.0` зафиксирован в `requirements.txt`

## Stage 5 — Business Context + Competitor Finder ✅

- [x] `agents/business_context_agent.py`
- [x] `agents/competitor_finder_agent.py` — SerperDev
- [x] `tools/serper_search_tool.py`
- [x] Competitor matrix JSON (≥2 конкурентов)

## Stage 6 — FastAPI + Next.js Frontend ✅

- [x] `api/auth.py` — JWT middleware
- [x] `api/runner.py` — ThreadPoolExecutor background runner
- [x] `api/routes/analyze.py` — `POST /analyze`, `GET /analyze/{run_id}`
- [x] `api/main.py` — FastAPI + CORS
- [x] Next.js 14 + TypeScript + Tailwind CSS
- [x] Supabase Auth UI (sign in / sign up)
- [x] BYOK страница → `user_api_keys` таблица (RLS)
- [x] Форма анализа с cost warning modal перед Opus
- [x] Polling статуса каждые 5 сек
- [x] ReportView + CompetitorMatrix компоненты
- [x] docx download (signed URL из Supabase Storage)

## Остаток перед деплоем

- [ ] Задать env vars в Railway (из `.env.example`)
- [ ] Задать env vars в Vercel (из `frontend/.env.example`)
- [ ] `npm install` во `frontend/` и проверить `next build` локально
- [ ] End-to-end тест с реальными API-ключами
