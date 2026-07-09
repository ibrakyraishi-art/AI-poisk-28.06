"""
Векторное хранилище на Supabase pgvector.

Публичные функции:
  save()         — сохранить один чанк
  save_batch()   — сохранить список чанков одним INSERT (предпочтительно)
  search()       — найти похожие куски по запросу (cosine similarity)
  is_saturated() — проверить, набрал ли батч отзывов <5% новых тем

Зависит от SQL-функции public.match_embeddings() в Supabase.
Переменные окружения: SUPABASE_URL, SUPABASE_SERVICE_KEY.

Эмбеддинги: fastembed (ONNX) с моделью all-MiniLM-L6-v2 (384-dim) —
сознательно НЕ sentence-transformers: тот тянет torch, чей импорт съедает
сотни МБ и убивает процесс на Render free tier (512 MB). Импорт ленивый.
Если движок эмбеддингов недоступен (нет RAM/пакета), память деградирует в
no-op: сохранения пропускаются, поиск возвращает пусто — пайплайн при этом
продолжает работать, т.к. агенты передают результаты через context=.
"""
from __future__ import annotations

import os
from typing import Any

from supabase import Client, create_client

from config.limits import COSINE_THRESHOLD, NEW_TOPIC_MIN_RATIO

# fastembed's name for the same 384-dim MiniLM model
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"

_embedder: Any | None = None
_embed_failed = False  # once True, memory becomes a silent no-op
_client_instance: Client | None = None


def _embed_texts(texts: list[str]) -> list[list[float]] | None:
    """Normalized 384-dim vectors, or None when embeddings are unavailable."""
    global _embedder, _embed_failed
    if _embed_failed:
        return None
    try:
        if _embedder is None:
            from fastembed import TextEmbedding  # lazy: keeps module import light
            _embedder = TextEmbedding(EMBEDDING_MODEL)
        import numpy as np

        vectors: list[list[float]] = []
        for vec in _embedder.embed(texts):
            arr = np.asarray(vec, dtype=float)
            norm = float(np.linalg.norm(arr)) or 1.0
            vectors.append((arr / norm).tolist())
        return vectors
    except Exception as exc:  # ImportError, MemoryError, model download failure…
        _embed_failed = True
        print(f"[vector_store] embeddings disabled, memory is a no-op: {exc!r}")
        return None


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
    """384-мерный нормированный вектор. Бросает RuntimeError, если движок недоступен."""
    vectors = _embed_texts([text])
    if vectors is None:
        raise RuntimeError("Embedding engine unavailable")
    return vectors[0]


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
    Если эмбеддинги недоступны — тихо пропускаем (память опциональна).
    """
    if not items:
        return
    texts = [item["content"] for item in items]
    vectors = _embed_texts(texts)
    if vectors is None:
        return
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
    Если эмбеддинги недоступны — пустой список.
    """
    vectors = _embed_texts([query])
    if vectors is None:
        return []
    result = _client().rpc(
        "match_embeddings",
        {
            "query_embedding": vectors[0],
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
    Без эмбеддингов насыщение не наступает никогда (False).
    """
    if not texts or _embed_failed:
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
