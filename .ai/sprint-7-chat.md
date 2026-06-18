# Sprint 7: Answer Generation with Citations — Complete

## What Was Built

Single-turn Q&A. User asks a question, system retrieves chunks, generates a grounded answer with inline citations. Stateless — no persistence.

### LLM Provider

- `LLMProvider` interface for text generation
- Gemini LLM provider (`gemini-2.0-flash`, `generateContent` API)
- Same auth pattern as embedding (`x-goog-api-key` header)

### Citation Extractor

- Parse `[1]`, `[2]` markers from LLM output
- Map markers to retrieved chunks by index
- Deduplicate and sort by marker number

### Chat Orchestrator

- Stateless: retrieve → prompt → generate → cite
- Builds prompt with numbered context passages
- System prompt instructs Gemini to use citation markers
- Returns answer + citations array

### API Route

- `POST /api/chat` — requires auth
- Embeds query, retrieves top 5 chunks, generates answer
- Returns `{ answer, citations[] }`

### Chat UI

- `ChatInput` — question input + Ask button
- `ChatAnswer` — answer display with source citations
- `ChatSection` — stateful wrapper (loading/error/answer)
- Dashboard integration (shown when user has ready documents)

### Shared Schemas

- `CitationSchema` — `{ marker, chunkId, documentId, pageNumber, content }`
- `ChatResponseSchema` — `{ answer, citations[] }`

## Files Created

| File                                                | Purpose                                       |
| --------------------------------------------------- | --------------------------------------------- |
| `workers/src/providers/llm-types.ts`                | LLMProvider, LLMMessage, LLMResult interfaces |
| `workers/src/providers/gemini-llm.ts`               | Gemini generateContent implementation         |
| `workers/src/providers/gemini-llm.test.ts`          | 4 tests                                       |
| `workers/src/chat/citations.ts`                     | Parse citation markers → map to chunks        |
| `workers/src/chat/citations.test.ts`                | 5 tests                                       |
| `workers/src/chat/answer-generator.ts`              | retrieve → prompt → generate → cite           |
| `workers/src/chat/answer-generator.test.ts`         | 6 tests                                       |
| `workers/src/chat/index.ts`                         | Barrel export                                 |
| `frontend/src/app/api/chat/route.ts`                | POST /api/chat endpoint                       |
| `frontend/src/components/chat/chat-input.tsx`       | Question input component                      |
| `frontend/src/components/chat/chat-answer.tsx`      | Answer + citations display                    |
| `frontend/src/components/chat/chat-section.tsx`     | Stateful wrapper                              |
| `frontend/src/components/chat/chat-input.test.tsx`  | 3 tests                                       |
| `frontend/src/components/chat/chat-answer.test.tsx` | 3 tests                                       |

## Files Modified

| File                                  | Change                                           |
| ------------------------------------- | ------------------------------------------------ |
| `workers/src/providers/index.ts`      | Export LLM types + Gemini LLM provider           |
| `workers/src/env.ts`                  | Add LLM_PROVIDER, LLM_MODEL, createLLMRuntime    |
| `backend/src/index.ts`                | Add CitationSchema, ChatResponseSchema           |
| `frontend/src/app/dashboard/page.tsx` | Add ChatSection, fetch user's ready document IDs |

## Verification Results

| Check     | Result                     |
| --------- | -------------------------- |
| Lint      | clean                      |
| Typecheck | clean                      |
| Tests     | 131 passing (18 + 32 + 81) |
| Build     | clean                      |

## Example Response

```json
{
  "answer": "The paper proposes a novel approach to federated learning that reduces communication overhead by 40% [1]. The key innovation is adaptive gradient compression [1][2].",
  "citations": [
    {
      "marker": 1,
      "chunkId": "a1b2c3d4-...",
      "documentId": "e5f6g7h8-...",
      "pageNumber": 3,
      "content": "Our approach reduces communication by 40% through adaptive gradient compression..."
    },
    {
      "marker": 2,
      "chunkId": "i9j0k1l2-...",
      "documentId": "e5f6g7h8-...",
      "pageNumber": 7,
      "content": "We validate on three benchmarks showing consistent improvement..."
    }
  ]
}
```
