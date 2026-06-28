from dataclasses import dataclass


@dataclass(frozen=True)
class ModelConfig:
    litellm_id: str      # идентификатор, который передаётся в CrewAI / LiteLLM
    display_name: str
    cost_warning: bool = False  # показывать предупреждение перед запуском


MODELS: dict[str, ModelConfig] = {
    "gemini-flash": ModelConfig(
        litellm_id="gemini/gemini-1.5-flash",
        display_name="Gemini 1.5 Flash (быстрый, дешёвый)",
    ),
    "haiku": ModelConfig(
        litellm_id="claude-haiku-4-5-20251001",
        display_name="Claude Haiku 4.5 (быстрый, дешёвый)",
    ),
    "sonnet": ModelConfig(
        litellm_id="claude-sonnet-4-6",
        display_name="Claude Sonnet 4.6 (баланс)",
    ),
    "opus": ModelConfig(
        litellm_id="claude-opus-4-8",
        display_name="Claude Opus 4.8 (лучший, ≈$1–5/запуск)",
        cost_warning=True,
    ),
    "gpt-4o-mini": ModelConfig(
        litellm_id="gpt-4o-mini",
        display_name="GPT-4o Mini (быстрый, дешёвый)",
    ),
}

# Дефолтные модели: дешёвые для сбора данных, умные для анализа
DEFAULTS: dict[str, str] = {
    "reviews_agent":          "gemini-flash",
    "news_agent":             "gemini-flash",
    "business_context_agent": "haiku",
    "competitor_finder_agent":"haiku",
    "analyst_agent":          "sonnet",
    "report_writer_agent":    "sonnet",
    "manager_agent":          "sonnet",
}


def get_litellm_id(key: str) -> str:
    """Возвращает LiteLLM-идентификатор модели для передачи в CrewAI."""
    if key not in MODELS:
        raise ValueError(
            f"Неизвестная модель '{key}'. Допустимые ключи: {list(MODELS.keys())}"
        )
    return MODELS[key].litellm_id


def needs_cost_warning(agent_model_map: dict[str, str]) -> bool:
    """True если хотя бы один агент настроен на дорогую модель (Opus)."""
    return any(
        MODELS[key].cost_warning
        for key in agent_model_map.values()
        if key in MODELS
    )
