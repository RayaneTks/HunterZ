# Task 3 report — Accurate, stoppable live location

## Result

Implemented cancellation-safe GPS sharing and one shared 45-second freshness rule. No database/schema changes, service-role key, or production deployment.

## TDD evidence

- Initial focused run failed because freshness and lifecycle modules did not exist.
- Added regression tests, observed red, then green for duplicate `start()` invalidating an active watcher (0 writes vs 1 expected).
- Observed red when a failed old-room position removal warning disappeared after a successful new-room write; preserved the warning.
- Observed red when two slow writes ran concurrently (2 writes started vs 1 expected); serialized writes so older points cannot finish last and overwrite newer points.
- Final focused suite: 10/10 passing.

## Behavior delivered

- Browser watch keeps `enableHighAccuracy: true`, `maximumAge: 0`, `timeout: 12000`.
- Stores browser measurement timestamp and measured accuracy unchanged; accuracy remains a measurement, not an AirTag/UWB guarantee.
- Retains 2.5-second write throttle; failed sends become retryable on next GPS sample.
- `stop()` and room changes invalidate callbacks, drain queued/in-flight writes, then call existing `stop_sharing` before proceeding.
- Expired, invalid, and future positions are hidden using shared `isPositionFresh`; lobby UI schedules expiration without waiting for another snapshot.
- Denied, unavailable, and retrying states remain visible and are announced to assistive technology.

## Verification

- `node --test tests/location-freshness.test.cjs tests/geolocation-lifecycle.test.cjs` — 10/10.
- `npm test` — 28/28.
- `npm run typecheck` — passed.
- `npm run build` — passed.
- `git diff --check` — passed.

## Remaining check

No live two-device GPS/permission test was run. Validate on two real phones over HTTPS before relying on field accuracy; actual precision depends on device and environment. Build prints a non-blocking Next.js workspace-root warning because both parent checkout and worktree contain lockfiles.
