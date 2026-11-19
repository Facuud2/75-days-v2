# Vibe-Coding Security, Resilience & Ethics Guardrails

Always-on baseline rules for this workspace (`75-days-v2`). For full audits, stack-specific playbooks, or pre-deploy hardening, activate the `vibe-coding-hardening` skill.

## 1. Secrets & Configuration
- Never expose private API keys, DB credentials, JWT secrets, or OAuth secrets with client prefixes (`NEXT_PUBLIC_*`).
- Never hardcode fallback secrets (e.g. `process.env.JWT_SECRET || 'dev-secret'`). Validate required env vars at startup in `config.ts` and fail fast if missing.
- Never log passwords, session tokens, or raw credentials.

## 2. Access Control, Validation & OAuth
- **Ownership (Anti-IDOR):** Every non-public route in `backend-core` and `backend-health` MUST verify `req.user.id` from the JWT middleware and scope Prisma queries by that verified `userId`. Never trust a `userId` from `req.body` or query params.
- **Strict Validation (Anti-Mass Assignment):** Validate every request body with Zod `.strict()` and explicitly map writable fields into Prisma `.create()`/`.update()`.
- **OAuth & Third-Party Tokens:** Sign OAuth `state` parameters (anti-CSRF) and encrypt third-party access/refresh tokens (e.g. Strava) at rest before storing in Postgres.
- **Internal Routes:** Protect `/internal/*` routes using constant-time comparison against `INTERNAL_API_KEY`.

## 3. Resilience & Performance Hygiene
- **Mandatory Timeouts:** Every outbound HTTP call (`axios`/`fetch`) to FatSecret, Strava, or between services MUST include an explicit timeout (`<= 5000ms`).
- **Rate Limiting:** Protect `/api/auth/*`, external sync routes, and heavy write/upload endpoints with rate limiting returning `429`.
- **Query Hygiene:** Avoid `N+1` query loops, avoid selecting heavy Base64 fields (`photoUrl`) in summary/list queries, and use explicit `select`/`take` bounds.

## 4. Privacy, Multi-DB Erasure & Ethical UX
- **No Compliance Theater:** Never claim "SOC 2" or "ISO 27001" compliance in code, comments, or UI. Base hardening on concrete OWASP controls.
- **Multi-DB Erasure (`75days` + `75days_health`):** Any new model storing user data in either database MUST be included in `deleteAccount` and user data export flows so no orphaned user data remains.
- **Accessible & Ethical UI:** Ensure WCAG AA contrast, `alt` attributes, keyboard navigation (`Tab`), unchecked terms checkboxes at signup, and zero dark patterns.

## 5. Proof by Test (Non-Negotiable)
- Never claim a route is protected based on visual inspection alone. Any security or access-control change MUST include an automated test proving unauthorized or cross-user (`User A` vs. `User B`) access is rejected with `401`, `403`, `404`, `400`, or `429`.
