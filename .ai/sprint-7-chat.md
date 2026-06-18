# Sprint 7: Answer Generation with Citations (Revised)

## PRD

### Goal

Single-turn Q&A. User asks a question, system retrieves chunks, generates a grounded answer with inline citations. Stateless — no persistence.

### Scope

- LLM provider (Gemini `generateContent`)
- Citation extractor (parse `[1][2]` markers → map to chunks)
- Chat orchestrator: retrieve → prompt → generate → cite
- `POST /api/chat` route
- Chat UI (input, answer, citations)

### Out of Scope

- DB writes, chat persistence, chatId
- Conversation memory, multi-turn
- Streaming, agent workflows, reranking

---

## Flow

```
Question
  → Retrieve top K chunks (reuse Sprint 6)
  → Build prompt: [1] chunk1 [2] chunk2 ...
  → Gemini generateContent
  → Parse [1][2] markers from response
  → Map markers to retrieved chunks
  → Return { answer, citations[] }
```

---

## Task Breakdown

### Phase 1: LLM Provider

1. `workers/src/providers/llm-types.ts` — LLMProvider, LLMMessage, LLMResult interfaces
2. `workers/src/providers/gemini-llm.ts` — Gemini generateContent implementation
3. `workers/src/providers/gemini-llm.test.ts` — 4 tests
4. Update `workers/src/providers/index.ts` — export LLM types

### Phase 2: Citation Extractor

5. `workers/src/chat/citations.ts` — parse markers, map to chunks
6. `workers/src/chat/citations.test.ts` — 5 tests

### Phase 3: Chat Orchestrator

7. `workers/src/chat/answer-generator.ts` — retrieve → prompt → generate → cite
8. `workers/src/chat/answer-generator.test.ts` — 6 tests
9. `workers/src/chat/index.ts` — barrel export

### Phase 4: Shared Schemas

10. Edit `backend/src/index.ts` — add CitationSchema, ChatResponseSchema

### Phase 5: API Route

11. `frontend/src/app/api/chat/route.ts` — POST /api/chat

### Phase 6: Chat UI

12. `frontend/src/components/chat/chat-input.tsx`
13. `frontend/src/components/chat/chat-answer.tsx`
14. `frontend/src/components/chat/chat-section.tsx`
15. `frontend/src/components/chat/chat-input.test.tsx` — 3 tests
16. `frontend/src/components/chat/chat-answer.test.tsx` — 3 tests
17. Edit `frontend/src/app/dashboard/page.tsx` — add ChatSection

---

## Prompt Design

```
System: Answer based ONLY on the provided context. Use citation markers [1], [2], etc.
If the context doesn't contain enough info, say so.

User: Context:
[1] (Page 3)
First chunk content here...

[2] (Page 7)
Second chunk content here...

Question: What is the main contribution?
```

---

## Citation Parsing

1. Prompt numbers chunks as `[1]`, `[2]`, ...
2. Gemini echoes these markers in its answer
3. `extractCitations(answer, chunks)` scans for `[1]`, `[2]`, etc.
4. Maps marker number → retrieved chunk (by index)
5. Returns `{ marker, chunkId, documentId, pageNumber, content }[]`

---

## Files

| Action | File                                                |
| ------ | --------------------------------------------------- |
| Create | `workers/src/providers/llm-types.ts`                |
| Create | `workers/src/providers/gemini-llm.ts`               |
| Create | `workers/src/providers/gemini-llm.test.ts`          |
| Edit   | `workers/src/providers/index.ts`                    |
| Create | `workers/src/chat/citations.ts`                     |
| Create | `workers/src/chat/citations.test.ts`                |
| Create | `workers/src/chat/answer-generator.ts`              |
| Create | `workers/src/chat/answer-generator.test.ts`         |
| Create | `workers/src/chat/index.ts`                         |
| Edit   | `backend/src/index.ts`                              |
| Create | `frontend/src/app/api/chat/route.ts`                |
| Create | `frontend/src/components/chat/chat-input.tsx`       |
| Create | `frontend/src/components/chat/chat-answer.tsx`      |
| Create | `frontend/src/components/chat/chat-section.tsx`     |
| Create | `frontend/src/components/chat/chat-input.test.tsx`  |
| Create | `frontend/src/components/chat/chat-answer.test.tsx` |
| Edit   | `frontend/src/app/dashboard/page.tsx`               |

**17 files** (12 new, 5 edits), **~21 tests**, **0 migrations**.
