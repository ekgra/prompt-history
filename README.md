# PROMPT-HISTORY

A simple, open prompt knowledge base that treats prompts as first‑class assets. Start by saving, organizing, and searching prompts; evolve into prompt‑by‑design workflows and, later, context engineering.

## Why
- Portability: keep prompts independent of vendor UIs.
- Reliability: never lose work to flaky chat interfaces.
- Reuse: searchable library with tags, embeddings, and lineage.
- Best practices: templates, variables, and versioning by design.
- Evolution: learn from previous prompts and outcomes.

## Roadmap
- Step 1: Minimal UI + backend to save, tag, version, and search prompts.
- Step 2: “Prompt engineering by design” — templates, variables, forks, eval notes, lineage graph.
- Step 3: Context engineering — richer corpora, retrieval, and experiments.

## MVP (Step 1)
- Save/edit prompts with project, title, tags, template, variables, model/provider.
- Search by keywords + vector similarity over prompt text.

## Initial Stack
- Frontend: React or Next JS
- Backend: Node/ Python 
- Database: MongoDB with Vector Search (or Postgres + pgvector).
- Embeddings: OpenAI or local model (pluggable).

## Next
- Wire basic CRUD + search API.
- Build React pages: list, detail, create/edit, search.
- Add import from ChatGPT export; export to JSONL.
