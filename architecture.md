# Architecture

## Scope

Independent static GitHub Pages project. Browser-only HTML, CSS, ES modules and native browser APIs. No backend, runtime npm dependencies, database, login, external API calls or analytics.

## Layers

- `dist/index.html`: semantic interface and public content.
- `dist/styles.css`: tokens, layout, responsive and reduced-motion presentation.
- `dist/src/model.js`: pure calculations; independently testable without a browser.
- `dist/src/missions.js`: predefined case evidence, choices and pure assessment; no remote diagnosis or system changes.
- `dist/src/app.js`: UI state and event orchestration. SENSE LAB additionally separates browser audio/canvas lifecycle in `experiments.js`.
- `tools/`: localhost static preview and syntax/asset checks; never deployed.
- `test/`: focused pure-model tests; never deployed.
- `.github/workflows/pages.yml`: test first, upload only `dist`, deploy via GitHub Pages.

## State and safety

State lives in memory until navigation/reload; no localStorage, cookies, uploaded files, personal profile, credentials or service-worker cache. External reference links open only when clicked. CSP disallows app-initiated network connections and inline scripts. GitHub's hosting logs are outside the app's control. Hosting response headers cannot be configured arbitrarily; CSP metadata is not a complete security boundary.

The preview server binds to loopback only and limits file access to `dist`. Public deployment exposes only `dist`; the public repository also contains code and documentation. No private inputs are included.

## Delivery

GitHub Actions on main or manual dispatch. Actions are pinned to exact upstream commit hashes; deployment permissions exist only on the deploy job. No user-supplied secret is needed. GitHub-provided short-lived workflow credentials are never printed. Relative asset paths support project Pages subdirectories.
