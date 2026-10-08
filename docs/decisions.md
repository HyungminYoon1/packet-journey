# Decision log

## D08 — Evidence-led missions (2026-10-08 redesign)

- Context: owner approved a complete redesign around solving connection incidents instead of passively watching a route.
- Options: real DNS/server diagnosis with extra services; fabricated real measurements; predefined deterministic case simulation.
- Decision: six cases covering DNS, HTTP 500, offline, fresh response cache, valid DNS cache and repeat-visit optimization. Inspect the full trace before selecting actions; wrong answers give causal feedback without changing configuration; correct actions replay the changed flow and show before/after.
- Rationale: a static Pages project can teach causal differences without claiming to inspect or repair visitors' devices.
- Affected: dist/index.html, styles.css, src/app.js, missions.js, test/missions.test.js, README.md.
- Review: cache-removal cases intentionally reveal a failure; successful learning does not always mean a successful request. Restore the free simulator and its existing agent tools; no backend, network calls or system access.

## D09 — Local score and transparent presentation

- Context: meaningful replay is desired without more defensive labels or personal disclosure.
- Options: persistent/global leaderboard; local per-case scores with no retention.
- Decision: 100 points per case, minus 15 per wrong answer and 20 for an optional hint, floor 10; keep session-best per case in memory. Remove unused example address and the repeated prominent timing warning; retain one simulation identity and fold model assumptions into expandable help.
- Rationale: rewards investigation without invented rankings or extra storage. Keeps actual activity central while preserving the distinction between modeled and measured time.
- Affected: src/app.js, missions.js, index.html, README.md.
- Review: client-side scoring is not tamper-proof and has no competitive or diagnostic authority. Reload clears all progress; old D06's reserved-address choice is superseded by removing that display.

## D06 — Educational network model

- Context: a Pages site cannot inspect arbitrary remote DNS/TCP/TLS flows from a browser without adding services.
- Options: real network measurements; prerecorded video; deterministic interactive model.
- Decision: a labeled HTTPS-over-TCP model, reserved example address, invented timing values, fresh-cache assumptions and explicit simplifications. DNS cache stays browser-side; HTTP 500 is a server response, not a connection failure.
- Rationale: transparent, reproducible, useful learning without misleading measurement claims.
- Affected: dist/src/model.js, app.js, index.html, test/model.test.js.
- Review: any future real measurements require a separate approved architecture, privacy review and evidence labels.

## D07 — Public commit identity

- Context: the existing global Git email is not a GitHub noreply address.
- Options: reuse it; change global settings; use repository-local GitHub noreply identity.
- Decision: configure only these repositories with the verified account's GitHub noreply identity.
- Rationale: public commits should not expose a private email, and unrelated repositories must keep their settings.
- Affected: local .git/config (not tracked), public commit metadata.
- Review: owner may change the repo-local identity later; never print the pre-existing email.

2026-10-08. Authorized automated implementation session: two independent repositories, push and GitHub Pages deployment.

## D01 — Static architecture and hosting

- Context: separate experiments should run on GitHub Pages without maintaining a paid service.
- Options: native static modules; framework export; external backend.
- Decision: HTML/CSS/ES modules with browser APIs, no runtime dependencies or backend. Deploy only dist through GitHub Actions to the requested provider.
- Rationale: matches Pages and the small interactive scope; avoids API keys, costs, account setup and dependency supply-chain exposure.
- Affected: dist, package.json, tools, architecture.md, .github/workflows/pages.yml.
- Review: revisit only when genuine server-side requirements appear; do not imply that Pages supports a backend.

## D02 — Public access and data lifecycle

- Context: a public coursework demonstration is requested, while personal disclosure is undesirable.
- Options: private access with extra hosting; public content with personal profile; public neutral-topic experiment.
- Decision: public neutral-topic repositories and sites, no biography, private email, forms, login, analytics, remote data writes, persistent browser storage or secret files. Keep all settings in page memory.
- Rationale: visitors can try the experiments without giving personal information; reload provides a clean state.
- Affected: index.html, app.js, .gitignore, README.md.
- Review: GitHub can keep hosting logs independently; do not claim that the host records no visitor data. No license grant is added without owner choice.

## D03 — Publication and automation access

- Context: source and deployed site must remain separately verifiable.
- Options: branch publishing; Actions deploying repository root; test-gated Actions deploying dist only.
- Decision: separate main branches; test-gated Pages Actions; exact commit pins; contents-read verification and scoped pages-write/id-token-write deployment. Preserve the pre-existing personal Pages repository.
- Rationale: excludes development files from the site and separates local checks, remote CI and live deployment.
- Affected: .github/workflows/pages.yml, docs/verification.md.
- Review: update action pins deliberately; inspect origin before every push. Local and live UI checks are manual agent/browser evidence, not a persistent cross-browser CI guarantee.

## D04 — Accessibility, motion and device support

- Context: visual experiences should remain operable without a mouse and on smaller screens.
- Options: canvas-only controls; semantic controls with labeled visualizations.
- Decision: semantic native inputs and buttons, keyboard focus, touch support, responsive layouts and reduced-motion handling. No automatic audio. Main interface is Korean with short English exhibit labels.
- Rationale: experiments remain understandable and actionable without relying only on color or animation.
- Affected: index.html, styles.css, src.
- Review: browser QA covers selected desktop/mobile sizes, not a formal WCAG certification or every device.

## D05 — Optional browser agent tools

- Context: the website-building workflow calls for structured access to primary interactions where supported.
- Options: no structured access; new hidden capabilities; progressive-enhancement WebMCP tools sharing existing UI actions.
- Decision: feature-detect document.modelContext and register only visible, local configuration/navigation/step operations. Validate input before changing state, handle unsupported browsers, unregister on page exit. Never enable audio or export files through a tool.
- Rationale: no hidden network or persistence capability; ordinary browsers work without WebMCP.
- Affected: src/app.js.
- Review: distinguish runtime validation in a supported context from unsupported/unverified states.
