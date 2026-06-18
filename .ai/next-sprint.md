# ScholarForge AI — Next Sprint

## Sprint 8: Deployment

### Goal

Deploy the application to production. Frontend on Vercel, workers on Railway/Render, production Supabase configuration.

### Prerequisites (All Met)

- [x] Full pipeline working end-to-end (upload → extract → chunk → embed → search → chat)
- [x] All tests passing (131 tests)
- [x] CI pipeline working (GitHub Actions)
- [x] Local Supabase fully configured

### Likely Tasks

1. **Production Supabase** — apply all migrations (0001-0006) to remote project
2. **Vercel deployment** — deploy frontend with env vars
3. **Worker deployment** — Railway or Render for background processing
4. **Queue integration** — replace stub with real queue (BullMQ/Redis) if needed
5. **Environment variables** — configure all production env vars
6. **Custom domain** — configure domain and SSL
7. **Monitoring** — Sentry DSN, error tracking
8. **Analytics** — PostHog or similar (optional)

### Architecture Considerations

- Vercel handles Next.js API routes (serverless)
- Workers need a separate deployment for background processing
- Queue transport needed for real upload → processing pipeline
- Service role key must be secured in production

### Database Changes

- No schema changes (all migrations already created)
- Apply migrations 0001-0006 to remote Supabase

### Testing Strategy

- Manual verification of production deployment
- End-to-end test with real PDF upload
- Verify search and chat work in production

### Blockers / Notes

- Remote Supabase still has `vector(1536)` from migration 0005 — needs update
- DeepSeek API returns 404 — use Gemini for production
- Queue stub needs real implementation for production upload flow
