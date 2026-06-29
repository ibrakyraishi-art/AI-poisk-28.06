"""
CrewAI-инструмент для записи текста в pgvector-память.

Агент вызывает этот инструмент когда хочет сохранить
важный факт, цитату или вывод, чтобы другие агенты
могли найти их позже через memory_search.
"""
from crewai.tools import BaseTool

from memory import vector_store


class MemorySaveTool(BaseTool):
    name: str = "memory_save"
    description: str = (
        "Save an important text chunk to analysis memory. "
        "Use this to preserve key findings, review quotes, or insights "
        "so other agents can retrieve them. "
        "Input: the text to save (string). Optionally append ' | url: <url>' "
        "to attach a source URL."
    )
    run_id: str
    user_id: str
    agent_name: str

    def _run(self, content: str) -> str:
        source_url = ""
        if " | url: " in content:
            content, source_url = content.split(" | url: ", 1)
            content = content.strip()
            source_url = source_url.strip()

        vector_store.save(
            run_id=self.run_id,
            user_id=self.user_id,
            content=content,
            agent=self.agent_name,
            source_url=source_url,
        )
        return f"Saved to memory ({len(content)} chars)."
