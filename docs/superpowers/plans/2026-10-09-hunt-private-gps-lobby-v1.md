# HUNT Private GPS Lobby V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a production-ready, mobile-first private lobby where players join by code and see each other’s live, device-reported GPS positions.

**Architecture:** Keep existing Next.js, Supabase Auth/Postgres/Realtime, MapLibre, and PWA. Fix the database RPC with a forward migration; harden lobby persistence and location-sharing lifecycle; prove the service and client flows with database, unit, and two-player browser tests before the production rollout.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.8, Supabase JS 2, PostgreSQL, MapLibre GL, Node.js built-in test runner, Playwright for browser-flow tests.

**Spec:** `docs/superpowers/specs/2026-10-09-hunt-private-gps-lobby-v1-design.md`

## Global Constraints

- “La V1 valide le partage de position et la fiabilité du lobby; elle ne comporte ni rôles, ni objectif de capture, ni score.”
- “L’application demande le meilleur niveau de précision disponible au navigateur, publie latitude, longitude, précision mesurée et heure du point, puis affiche les positions reçues sur la carte et dans la liste d’escouade.”
- “Les positions âgées de plus de 45 secondes sont marquées périmées et ne sont plus présentées comme actives.”
- “Aucun secret `service_role` dans le navigateur, le dépôt ou les variables `NEXT_PUBLIC_*`.”
- “Ne jamais stocker un historique de coordonnées pour cette V1.”
- “Livrer ce changement via une migration forward-only, réexécutable sans supprimer de données.”
- “HUNT ne peut demander que la meilleure précision que l’OS et l’appareil accordent; l’application doit afficher la précision reçue sans la présenter comme garantie.”

## Review Focus

- RPC succeeds but browser storage fails: preserve the created lobby and show recovery instead of a false creation error (Task 2 test `creation_survives_unavailable_storage`).
- Invalid, closed, or already-used invite code: preserve the screen and make retry possible without duplicate membership (Task 2 test `join_rejects_invalid_or_closed_code`).
- GPS permission denied or API unavailable: keep lobby usable and expose a clear retry path (Task 3 tests `permission_denial_is_retryable` and `missing_geolocation_is_unavailable`).
- A GPS callback/write completes after stop or lobby change: it must not restore a removed position (Task 3 test `stop_invalidates_pending_position_updates`).
- Invalid/future/stale timestamps: never classify them as a current location (Task 3 tests `invalid_and_future_positions_are_not_fresh` and `position_expires_after_45_seconds`).

---

### Task 1: Safe room-creation migration and database contract

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/20261009000000_fix_create_room_random_code.sql`
- Create: `supabase/tests/lobby-contract.sql`
- Modify: `supabase/schema.sql:93-120`

**Interfaces:**
- Consumes: existing `public.rooms`, `public.room_members`, `public.profiles`, and authenticated Supabase JWT claims.
- Produces: unchanged `public.create_room() RETURNS TABLE(room_id uuid, room_code text)`; existing six-character uppercase room code and `authenticated` execute grant stay compatible.

- [ ] **Step 1: Add transaction-scoped SQL regression tests**

Create minimal CLI config and an SQL test script wrapped in `BEGIN`/`ROLLBACK`. Assert `create_room_returns_code_and_adds_owner`, `create_room_retries_code_collision`, `join_room_adds_second_member`, and `non_member_cannot_read_room_positions`. Use unique fixture UUIDs and transaction-scoped JWT claims so tests leave no rows behind. Do not require Docker or enable a testing extension in production.

- [ ] **Step 2: Prove creation regression before fix**

Run: `npx supabase@latest db query --linked -f supabase/tests/lobby-contract.sql`
Expected: creation test fails at `public.create_room()` with the current unqualified `gen_random_bytes(integer)` resolution error; other failures must be recorded, not masked.

- [ ] **Step 3: Add the forward-only repair migration**

Replace the function body with `CREATE OR REPLACE FUNCTION public.create_room()`. Generate the same six-character uppercase hex code from `pg_catalog.gen_random_uuid()` so the function no longer depends on `pgcrypto` search path. Keep `search_path = ''`, explicitly qualify all application objects, retain unique-collision retries, check active membership, insert room and owner membership atomically, and return the existing result shape. Do not drop tables, rows, policies, or grants.

- [ ] **Step 4: Run database contract tests after repair**

Run: `npx supabase@latest db query --linked -f supabase/tests/lobby-contract.sql`
Expected: all four SQL assertions pass and the explicit rollback leaves no fixture rows.

- [ ] **Step 5: Commit the database slice**

```powershell
git add supabase/config.toml supabase/schema.sql supabase/migrations/20261009000000_fix_create_room_random_code.sql supabase/tests/lobby-contract.sql
git commit -m "fix: make lobby creation work with secure search path"
```

### Task 2: Reliable create, join, and lobby restoration

**Files:**
- Create: `lib/active-room.cjs`
- Create: `tests/active-room.test.cjs`
- Create: `tests/hunt-lobby.test.cjs`
- Modify: `app/page.tsx:126-266,316-324`
- Modify: `lib/hunt.ts:46-54,61-67`

**Interfaces:**
- Consumes: Task 1 RPC result `{ room_id, room_code }` and current `Room` type.
- Produces: `saveActiveRoom(storage, room): boolean`, `readActiveRoom(storage): Room | null`, `clearActiveRoom(storage): void`; `createRoom(): Promise<{id:string; code:string}>` remains unchanged.

- [ ] **Step 1: Write storage and client regression tests**

Add tests `creation_survives_unavailable_storage`, `malformed_saved_room_is_removed`, `valid_saved_room_restores`, `join_rejects_invalid_or_closed_code`, and `rpc_error_is_recoverable`. Assert no room is stored on RPC failure and successful RPC result survives storage exceptions in in-memory UI state.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `node --test tests/active-room.test.cjs tests/hunt-lobby.test.cjs`
Expected: FAIL because safe storage/client behavior is not implemented yet.

- [ ] **Step 3: Implement safe room persistence and transitions**

Implement the three `lib/active-room.cjs` functions with injected Storage-like objects and guarded JSON parsing. In `app/page.tsx`, commit returned room to React state before best-effort persistence; storage failure must not report an RPC failure. Apply the same behavior to join. On restore, verify current session membership through `getRoom`; clear malformed or inaccessible saved state. Preserve six-character code normalization and render retryable errors.

- [ ] **Step 4: Run focused and full client tests**

Run: `node --test tests/active-room.test.cjs tests/hunt-lobby.test.cjs` and `npm test`
Expected: all named cases and all existing tests pass.

- [ ] **Step 5: Commit the client lifecycle slice**

```powershell
git add app/page.tsx lib/hunt.ts lib/active-room.cjs tests/active-room.test.cjs tests/hunt-lobby.test.cjs
git commit -m "fix: preserve lobby state across browser failures"
```

### Task 3: Accurate, stoppable live location sharing

**Files:**
- Create: `lib/location-freshness.cjs`
- Create: `tests/location-freshness.test.cjs`
- Create: `lib/location-watch.cjs`
- Create: `tests/geolocation-lifecycle.test.cjs`
- Modify: `hooks/use-geolocation.ts`
- Modify: `app/page.tsx:160-176,282-307`
- Modify: `components/MapView.tsx`

**Interfaces:**
- Consumes: existing `positions` upsert and `stop_sharing` RPC; browser `watchPosition` with `enableHighAccuracy: true`, `maximumAge: 0`, `timeout: 12000`.
- Produces: `isPositionFresh(updatedAt: string, nowMs?: number): boolean`, true only for valid timestamps with age in `[0, 45_000)`; location states remain `off | requesting | active | denied | unavailable`.

- [ ] **Step 1: Write freshness and stop-race regression tests**

Add tests `position_expires_after_45_seconds`, `invalid_and_future_positions_are_not_fresh`, `permission_denial_is_retryable`, `missing_geolocation_is_unavailable`, and `stop_invalidates_pending_position_updates`. Assert the current boundary fails for expired/future/invalid timestamps and stopped callbacks.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `node --test tests/location-freshness.test.cjs tests/geolocation-lifecycle.test.cjs`
Expected: FAIL for existing age logic and late callback/write behavior.

- [ ] **Step 3: Implement freshness and cancellation-safe watch lifecycle**

Use `isPositionFresh` for map/member visibility. Keep measured accuracy and measurement time unaltered. Give each active watch a generation token; `stop()` and room changes invalidate older callbacks, await any pending upsert, then remove the persisted position. Keep the current 2.5-second write throttle, allow retry after transient write failure, and make unsupported/denied/retrying status visible in the squad panel.

- [ ] **Step 4: Run focused, full, and type checks**

Run: `node --test tests/location-freshness.test.cjs tests/geolocation-lifecycle.test.cjs`; `npm test`; `npm run typecheck`
Expected: all tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit the location slice**

```powershell
git add hooks/use-geolocation.ts components/MapView.tsx app/page.tsx lib/location-freshness.cjs tests/location-freshness.test.cjs tests/geolocation-lifecycle.test.cjs
git commit -m "fix: keep live location accurate and stoppable"
```

### Task 4: Two-player browser proof and production rollout

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/private-lobby.spec.ts`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**
- Consumes: Tasks 1–3 APIs and UI states; production Supabase URL/key names already configured in Vercel.
- Produces: repeatable browser test for host create → second player joins → mocked accurate locations appear → stop/leave/close; documented two-real-device checklist.

- [ ] **Step 1: Add failing two-player mobile browser test**

Use two isolated browser contexts at a mobile viewport, separate anonymous identities, deterministic Supabase request fixtures, and Playwright geolocation overrides. Assert same lobby code, both members once, live marker updates, visible accuracy, stale status, retry after denied permission, and host close invalidates the code.

- [ ] **Step 2: Prove browser test fails before completing its fixture/flow**

Run: `npx playwright test tests/e2e/private-lobby.spec.ts`
Expected: FAIL on the first missing required UI transition; record the assertion. Implement only fixture wiring needed for repeatable browser proof, then rerun after Tasks 1–3.

- [ ] **Step 3: Finish end-to-end assertions and operator checklist**

Keep browser fixtures isolated from production data. Document manual test on two real HTTPS phones, exact-permission guidance, foreground-only GPS limits, and clean exit/close behavior.

- [ ] **Step 4: Run complete validation and review**

Run: `npm test`; `npx playwright test`; `npm run typecheck`; `npm run build`; `git diff --check`.
Expected: exit 0 for every command; reviewer confirms spec coverage and no unintended data reset, secret exposure, or location leakage.

- [ ] **Step 5: Apply and verify production database migration**

Confirm linked Supabase project matches production `NEXT_PUBLIC_SUPABASE_URL`; inspect migration list and `db push --dry-run`. If target differs, migration history is ambiguous, or preview shows any table/data drop, stop before applying. Otherwise apply only the reviewed forward migration and run linked rollback-scoped SQL contract tests. Verify create/join/stop/leave/close inside rollback-scoped SQL so production has no test lobbies or persistent test identities.

- [ ] **Step 6: Deploy and verify Vercel production**

Run: `vercel project inspect --non-interactive`; `vercel deploy --prod --yes`; `vercel inspect <returned-deployment-url>`.
Expected: exact project `hunt-lobby`, production target, `Ready`, alias `https://hunt-lobby.vercel.app`; then smoke-check UI load. Keep synthetic identities and positions in local browser fixtures, not production data.

- [ ] **Step 7: Commit the browser proof and operator guide**

```powershell
git add package.json package-lock.json playwright.config.ts tests/e2e/private-lobby.spec.ts README.md
git commit -m "test: verify private lobby on two mobile clients"
```
