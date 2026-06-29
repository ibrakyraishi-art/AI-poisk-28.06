"""
CrewAI-инструмент для поиска по pgvector-памяти.

Агент вызывает этот инструмент когда ему нужно
найти ранее сохранённые данные — например, Analyst Agent
ищет в памяти отзывы по теме "цена" или "баги".
"""
from crewai.tools import BaseTool

from memory import vector_store


class MemorySearchTool(BaseTool):
    name: str = "memory_search"
    description: str = (
        "Search analysis memory for relevant information. "
        "Use this to find previously saved reviews, news articles, or insights. "
        "Input: a search query (string). Returns up to 5 most relevant chunks "
        "with their source agent and similarity score."
    )
    run_id: str

    def _run(self, query: str) -> str:
        results = vector_store.search(query, run_id=self.run_id, limit=5)
        if not results:
            return "Nothing found in memory for this query."

        lines = []
        for r in results:
            header = f"[{r['agent']}] similarity={r['similarity']:.2f}"
            if r.get("source_url"):
                header += f" | {r['source_url']}"
            lines.append(f"{header}\n{r['content']}")

        return "\n\n---\n\n".join(lines)
