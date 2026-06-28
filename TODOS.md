# CompetitorScope — TODO (post eng-review 2026-06-28)

## Security fixes (from outside-voice review — do before any deploy)

- [ ] **P0**: Add user ownership check to `GET /analyze/{run_id}` —
  verify `analysis_runs.user_id` matches the JWT `sub` before returning data.
  Any auth'd user can currently read any run by ID.
- [ ] **P1**: Scrub LLM keys from FastAPI logs. Set `log_level=WARNING` in uvicorn,
  add `SecretStr` wrapper for key values, never pass raw key strings to `repr()`-able
  objects. Consider `--no-access-log` in production.
- [ ] **P1**: Watchdog for stuck `running` jobs. Supabase cron or Railway cron job
  every 10 min: `UPDATE analysis_runs SET status='failed', error='timeout'
  WHERE status='running' AND created_at < NOW() - INTERVAL '45 minutes'`.

## Infrastructure (before Stage 1)

- [ ] Create Supabase project, enable `vector` extension
- [ ] Run schema migrations: `analysis_runs`, `embeddings` (vector 384-dim), HNSW index
- [ ] Enable Supabase Auth
- [ ] Set up Supabase Vault for LLM key storage (pgsodium)
- [ ] Create Supabase Storage bucket `reports` (private)
- [ ] Deploy Python backend skeleton to Railway (FastAPI + health check)
- [ ] Set Railway env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, SERPER_API_KEY

## Stage 1 — Reviews Agent + pgvector memory

- [ ] `config/llm_config.py` — model IDs + LiteLLM prefix mapping
- [ ] `config/limits.py` — MAX_REVIEWS=200, BATCH_SIZE=50, COSINE_THRESHOLD=0.85, MAX_RETRIES=2
- [ ] `memory/vector_store.py` — pgvector INSERT + cosine `<->` query (NOT ChromaDB)
- [ ] `tools/memory_save_tool.py` — CrewAI tool wrapping pgvector INSERT
- [ ] `tools/memory_search_tool.py` — CrewAI tool wrapping pgvector `<->` query
- [ ] `models/schemas.py` — `ReviewData` Pydantic schema
- [ ] `agents/reviews_agent.py` — saturation stop, `output_pydantic=ReviewData`
- [ ] `main.py` — entry point; writes status to `analysis_runs`

## Stage 2 — News Agent

- [ ] `agents/news_agent.py` — News API
- [ ] `models/schemas.py` — add `NewsData`
- [ ] `tasks/research_tasks.py` — sequential pipeline (real parallel after Stage 4)

## Stage 3 — Analyst + Report Writer

- [ ] `models/schemas.py` — `AnalystOutput`, `ReportData`, `CompetitorProfile`
- [ ] `agents/analyst_agent.py`
- [ ] `agents/report_writer_agent.py` — generates JSON + docx
- [ ] Upload docx to Supabase Storage, write path to `analysis_runs.report_docx_path`
- [ ] Write JSON summary to `analysis_runs.report_json`

## Stage 4 — Manager + Process.hierarchical

- [ ] `agents/manager_agent.py`
- [ ] Switch crew to `Process.hierarchical`
- [ ] ConditionalTask callback: retry Reviews if `review_count < 10` or `confidence < 0.7`
- [ ] **Pin `crewai==x.y.z` before this stage** (ConditionalTask API unstable)

## Stage 5 — Business Context + Competitor Finder

- [ ] `agents/business_context_agent.py`
- [ ] `agents/competitor_finder_agent.py` — SerperDev web search
- [ ] Competitor matrix JSON (≥2 competitors, all criteria)

## Stage 6 — Next.js Frontend (replaces Streamlit)

- [ ] FastAPI: `POST /analyze`, `GET /analyze/{run_id}`, Supabase JWT auth middleware
- [ ] Next.js project on Vercel
- [ ] Supabase Auth UI (sign in / sign up)
- [ ] BYOK page: enter API keys → Supabase Vault
- [ ] Analysis form: company, period, LLM model dropdowns per agent
- [ ] Cost warning modal before Opus (≈$1–5/run)
- [ ] Job status polling every 5s from `analysis_runs`
- [ ] Report view + docx download (signed URL from Supabase Storage)
