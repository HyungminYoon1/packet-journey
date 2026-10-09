# Architecture

## Scope

Independent static GitHub Pages project. Browser-only HTML, CSS, ES modules and native browser APIs. No backend, runtime npm dependencies, database, login, external API calls or analytics.

## Layers

- `dist/index.html`: semantic interface and public content.
- `dist/styles.css`: tokens, layout, responsive and reduced-motion presentation.
- `dist/src/model.js`: pure calculations; independently testable without a browser.
- `dist/src/missions.js`: predefined case evidence, choices and pure assessment; no remote diagnosis or system changes.
- `dist/src/diagnostics.js`: deterministic HTTP cache freshness/revalidation and bounded two-layer retry/FIFO queue simulation. Pure state transitions, traces and cause assessment; no DOM, storage, clocks or network.
- `dist/src/progress.js`: the sole persistence boundary. Validates bounded completion IDs and the allowlisted gallery summary; browser storage access is guarded and injectable for tests.
- `dist/src/app.js`: UI state, event orchestration and completion gating. Requests persistence only after the final trace of an unaided, fault-free completion; never on initial view, example, hint or replay.
- `tools/`: localhost static preview and syntax/asset checks; never deployed.
- `test/`: focused pure-model tests; never deployed.
- `.github/workflows/pages.yml`: test first, upload only `dist`, deploy via GitHub Pages.

## State and safety

Request histories, input choices and scores live in memory until navigation/reload. The approved persistence exception is localStorage: `packet-journey-achievements-v1` stores only `{version:1,achievements:[knownCompletionId]}`. The fixed catalog has 42 independent achievements: 6 base cases, 4 original operations × 3 conditions × 2 difficulties, and 2 diagnostics × 3 conditions × 2 difficulties. Duplicate IDs never increase the count. Completion requires zero mistakes and no hint in that run; partial, failed, hinted and replay-only activity is not an achievement. The original campaign and scoring rules remain intact.

On actual completion, read back the durable unique IDs and read-modify-write `web-lab-progress-v1` as `{version:1,apps:{[repoId]:{completed,total,updatedAt}}}`. Only this app's count, total and current ISO completion/update time enter the shared summary. The 15 app IDs in progress.js are the explicit whitelist; every record must have exact fields, integer `0 <= completed <= total <= 1000`, and a canonical ISO timestamp. Each storage payload is bounded to 8192 characters (accepted fields are ASCII). Unknown IDs/fields, malformed JSON, incompatible versions, denial and quota failures fail safely. Invalid existing summaries are not overwritten. A successful private write with a failed summary update is surfaced in the UI; the next actual completion can repair the summary. Reading/reloading never manufactures dates or summaries.

Clear removes only the app's private achievement key and its own aggregate entry, preserving other app entries and unrelated keys. A corrupt shared summary is preserved and the incomplete clear is reported. No private run payload is exposed to the gallery. localStorage is origin-scoped: the deployed gallery can read the summary only on the same origin; separate localhost ports do not share it. Multi-tab read-modify-write is best-effort, not an atomic database transaction or trusted ranking. No names, seeds, actions, files or full runs are persisted. No backend, ranking, cookies, uploaded files, profile, credentials or service-worker cache.

External reference links open only when clicked. CSP disallows app-initiated network connections and inline scripts. GitHub's hosting logs are outside the app's control. Hosting response headers cannot be configured arbitrarily; CSP metadata is not a complete security boundary.

The preview server binds to loopback only and limits file access to `dist`. Public deployment exposes only `dist`; the public repository also contains code and documentation. No private inputs are included.

## Delivery

GitHub Actions on main or manual dispatch. Actions are pinned to exact upstream commit hashes; deployment permissions exist only on the deploy job. No user-supplied secret is needed. GitHub-provided short-lived workflow credentials are never printed. Relative asset paths support project Pages subdirectories.
