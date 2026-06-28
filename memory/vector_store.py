"""
Векторное хранилище на Supabase pgvector.

Публичные функции:
  save()         — сохранить один чанк
  save_batch()   — сохранить список чанков одним INSERT (предпочтительно)
  search()       — найти похожие куски по запросу (cosine similarity)
  is_saturated() — проверить, набрал ли батч отзывов <5% новых тем

Зависит от SQL-функции public.match_embeddings() в Supabase.
Переменные окружения: SUPABASE_URL, SUPABASE_SERVICE_KEY.
"""
from __future__ import annotations

import os
from typing import Any

from sentence_transformers import SentenceTransformer
from supabase import Client, create_client

from config.limits import COSINE_THRESHOLD, NEW_TOPIC_MIN_RATIO

EMBEDDING_MODEL = "all-MiniLM-L6-v2"

_model_instance: SentenceTransformer | None = None
_client_instance: Client | None = None


def _model() -> SentenceTransformer:
    global _model_instance
    if _model_instance is None:
        _model_instance = SentenceTransformer(EMBEDDING_MODEL)
    return _model_instance


def _client() -> Client:
    global _client_instance
    if _client_instance is None:
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_SERVICE_KEY")
        if not url or not key:
            missing = [v for v, val in [("SUPABASE_URL", url), ("SUPABASE_SERVICE_KEY", key)] if not val]
            raise EnvironmentError(f"Не заданы переменные окружения: {missing}")
        _client_instance = create_client(url, key)
    return _client_instance


def embed(text: str) -> list[float]:
    """384-мерный вектор для текста. normalize_embeddings=True → единичная длина."""
    return _model().encode(text, normalize_embeddings=True).tolist()


def save(
    *,
    run_id: str,
    user_id: str,
    content: str,
    agent: str,
    source_url: str = "",
) -> None:
    """Сохранить один текстовый чанк. Для батча используй save_batch()."""
    save_batch(
        run_id=run_id,
        user_id=user_id,
        agent=agent,
        items=[{"content": content, "source_url": source_url}],
    )


def save_batch(
    *,
    run_id: str,
    user_id: str,
    agent: str,
    items: list[dict],
) -> None:
    """
    Сохранить список чанков одним INSERT-запросом.

    items: список словарей {content: str, source_url?: str}

    Эмбеддинги генерируются батчем (один проход модели вместо N),
    INSERT — один запрос вместо N. Используй для сохранения отзывов.
    """
    if not items:
        return
    texts = [item["content"] for item in items]
    vectors = _model().encode(texts, normalize_embeddings=True).tolist()
    rows = [
        {
            "run_id": run_id,
            "user_id": user_id,
            "content": item["content"],
            "embedding": vector,
            "agent": agent,
            "source_url": item.get("source_url", ""),
        }
        for item, vector in zip(items, vectors)
    ]
    _client().table("embeddings").insert(rows).execute()


def search(
    query: str,
    *,
    run_id: str,
    limit: int = 5,
) -> list[dict[str, Any]]:
    """
    Вернуть top-k семантически близких чанков для данного run_id.
    Использует SQL-функцию match_embeddings() c оператором <=> (cosine).
    Каждый результат: {id, content, agent, source_url, similarity}.
    """
    result = _client().rpc(
        "match_embeddings",
        {
            "query_embedding": embed(query),
            "match_run_id": run_id,
            "match_count": limit,
        },
    ).execute()
    return result.data or []


def is_saturated(texts: list[str], *, run_id: str) -> bool:
    """
    True если в батче меньше NEW_TOPIC_MIN_RATIO (5%) новых тем.
    Вызывается Reviews Agent после каждых BATCH_SIZE отзывов.

    Логика: если ближайший сохранённый вектор имеет similarity >= COSINE_THRESHOLD,
    текст считается уже известной темой. Если таких >95% — стоп.
    """
    if not texts:
        return False

    new_count = sum(
        1 for text in texts
        if _is_new_topic(text, run_id=run_id)
    )
    return (new_count / len(texts)) < NEW_TOPIC_MIN_RATIO


def _is_new_topic(text: str, *, run_id: str) -> bool:
    closest = search(text, run_id=run_id, limit=1)
    if not closest:
        return True  # в памяти ещё ничего нет — тема точно новая
    return closest[0]["similarity"] < COSINE_THRESHOLD
