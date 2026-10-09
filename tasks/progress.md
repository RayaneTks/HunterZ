# SDD ledger — plan: tasks/plan.md
Ruling: native worktree tool cannot locate nested repository; isolated git worktree used within project workspace. No change to original checkout.
Ruling: Windows shell available; task scripts replaced by equivalent ledger and task-specific test logs.
Pre-flight: T1 release consumed by T6; voluntary open retained. T2 tokens consumed by T3/T4; semantic variables. T5 helper consumed by T6/T7; no change to game authority. T8–T13 share MatchSnapshot; server role projection and revision authoritative, private GPS introduced before playable match UI.
Task 1: in progress.
Ruling: T8–T13 server definitions deployed as one atomic migration and one validated action RPC, avoiding unsafe intermediate privacy states. Typed client wrappers retain planned operations.
Ruling: Any roster change cancels current match and requires fresh briefing rather than resuming altered roster. Cost: team restarts; privacy and consent preserved.
Ruling: Extraction point explicitly chosen as terrain centre during host preparation and accepted at briefing. Arbitrary second map point deferred; cost: fewer terrain configurations.
Task 1: complete — release-entry 2/2; two-client lobby fixed for real consent and passed.
Task 2: complete — 320/390/844 zoom + touch tests 3/3; typecheck green.
Task 3: complete — interactive rules and entry tested; authenticated flow covered by two-client lobby.
Task 5: complete — install classification 4/4; remaining browser/device install validation tracked for T14.
Task 6: partial — registration + public shell cache verified; production offline and update tests pending.
T8–T13: server authority in progress — PostgreSQL tests now exercise actual RLS and actions; API transport integration pending.
Task 4: complete — map-first lobby extracted, compact sheet and explicit expand button retained; two-client flow validated.
Ruling: Sheet uses accessible buttons rather than optional drag prototype. Cost: no drag gesture; avoids non-physical swipe shortcut and keeps map/list interactions independent.
Task 8–13: complete locally — 39 Node tests including real PostgreSQL roles, deadlines, extraction, capture and pending GPS purge; four-browser PostgreSQL round trip and rematch passed.
T14 gate: physical phones and deployed Supabase transport not available locally; document separately, no production-ready claim.
Task 6: complete locally — production offline reload and multi-tab voluntary update passed.
Task 7: complete locally — dedicated maskable icon, stable manifest identity, real viewport screenshots; physical install remains T14 gate.
Graphify final extraction: 662 nodes, 1018 relations; same three Gradle parser limitations as baseline.

Final review: fresh-context review of c8fa914..da11000 reported four Important findings, no Critical or Minor. Accepted all four; no findings declined or minor fixes deferred. One fix pass, no second review.
Review fix 1: stale room-only action could affect rematch. Expected match id required for non-create; action receipt binds payload. PostgreSQL RED -> GREEN.
Review fix 2: inaccurate fixes refreshed technical-pause deadline. Last admissible signal tracked independently; technical pause applied before timeout, elapsed capped at deadline; stop-sharing pauses before purge. PostgreSQL RED -> GREEN.
Review fix 3: membership trigger raced uncommitted match creation. Native PostgreSQL with independent connections reproduced join entering frozen match and leave leaving briefing active. Room lock before membership guard -> GREEN 2/2.
Review fix 4: rematch roster used historical participants. Current room members passed to preparation; four-browser flow confirms departed player removed and 3-player preparation disabled.
Ruling: Native PostgreSQL concurrency tooling isolated outside app; optional Windows script, no product dependency/system service. Cost: native test not included in Linux CI; local proof retained.
Final gate: npm test 41/41; typecheck PASS; build PASS (194 kB First Load JS); Playwright mobile 11/11; production 11/11; native PostgreSQL concurrency 2/2; git diff --check PASS.
T14: local gate complete. External gates remain open: deployed Supabase Auth/REST/Realtime, physical install/GPS/background, real virtual keyboard and screen readers. These are not presumed passing. No push, merge or deployment.
Performance evidence: localhost Chromium LCP 188 ms, CLS 0, event durations 24 ms; no field INP claim.
Review limits accepted: no additional concrete SQL GPS leak established; distant Realtime, native lifecycle and physical performance were not certified. Cost: external checks before publishing.
Final rulings and costs exhaustive in docs/validation/2026-10-09/VALIDATION.md; rollback in docs/work/2026-10-mobile-release.md. Final logs preserved in docs/validation/2026-10-09/logs before plan scratch cleanup.

Visual audit: map canvas asserted present before capture; initial blank capture was taken before dynamic map mount. Removed inherited grayscale filter to retain semantic clue/terrain colours; release announcement hidden during active briefing/match. Gameplay screenshots inspected; public basemap deliberately stubbed in test.
