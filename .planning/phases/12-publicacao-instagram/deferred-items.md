# Deferred Items — Phase 12

- [12-05 Task 2] Pre-existing: `app/api/cron/daily/__tests__/route.test.ts` has 2 failing tests (200-path + continue-on-throw) because the test mock never stubs `reconcileOrphanedConsumes` (added to the route by a prior plan). Confirmed failing identically before/after my Task 2 change via git stash. Out of scope — not caused by the instagram job. Fix later by adding `reconcileOrphanedConsumes: vi.fn()` to the test mock.
