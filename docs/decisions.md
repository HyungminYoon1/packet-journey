# Decision log

## D10 — Sequential connection operations (2026-10-09, local implementation only)

- Context: owner requested more interactive and challenging networking learning; the existing six cases ended after a single correct action and wrong choices had no model consequences.
- Options: replace the six cases; attach more passive stages; add a sequential operation state machine alongside the existing cases and sandbox.
- Decision: make connection operations the initial mode. Four goals with three deterministic condition variants drive cache, DNS, route, TLS, transmission and loss-recovery decisions. Every action consumes modeled time and an attempt; inappropriate actions leave the incident unresolved. Keep all state transitions/assessment in missions.js, calculations/traces in model.js and only orchestration/rendering in app.js.
- Rationale: creates actual consequences and multi-hop recovery while retaining the documented pure-model/UI boundary and existing lessons.
- Affected files: dist/src/model.js, missions.js, app.js, dist/index.html, styles.css, test/operations.test.js, interface.test.js, README.md.
- Review: modeled routes are logical hops, not measured physical routes. DNS TTL and response freshness are predefined conditions, not a real cache expiry clock or HTTP revalidation implementation. Static hosting and connect-src 'none' remain intact; no backend, Neon, new dependency, external asset, runtime service or network diagnosis. Browser preview/QA belongs to the main agent.

## D11 — Budgeted goals and deterministic transport

- Context: route choice, congestion and packet loss must have observable tradeoffs and hard mode must remain solvable.
- Options: random uncontrolled failures; one universal correct path; deterministic conditions with several feasible strategies and explicit budgets.
- Decision: three routes with separate hop count, RTT, queue, outage and fixed loss sets. Burst/paced transfer, selective/full retransmission and reconnection expose different costs. A reconnect drops earlier received fragments and requires TLS again. In the simplified model retransmission succeeds once; pacing reduces queue to one quarter and uses a separate loss set. Only a complete authenticated response satisfies latest-response goals; the offline saved-copy goal can use an old stored response. TLS bypass never advances toward authenticated completion.
- Rationale: teaches route length versus latency, response completeness and endpoint trust without pretending to implement a TCP stack or real certificate administration.
- Affected files: dist/src/model.js, missions.js, test/operations.test.js, README.md.
- Review: general mode permits 12 actions and one hint; hard mode permits 7 actions, 70% of the time budget and no hint. Complete on the final allowed action is valid if within time. All 24 configuration combinations have a tested viable path. Fixed RTO/loss behavior and omitted congestion-window/ACK algorithms must stay documented.

## D12 — In-memory diagnostics and validation boundaries

- Context: replay, scoring and diagnostics need to support learning without retention or confusing past publication evidence with this local revision.
- Options: persisted scores/network telemetry; current-step-only display; session-local condition scores and decision/packet history.
- Decision: keep best score per operation/variant/difficulty and packet/decision history in memory. Award only after the decision trace has finished; replay does not spend another action or add time. Display one unobtrusive simulation identity plus packet ACK/LOST/retry states, chosen logical path, cumulative timings and expandable previous traces. Retain existing free-experiment WebMCP tools; reject missing required configuration fields before any UI mutation.
- Rationale: gives actionable evidence and replay with the existing no-storage/no-network boundary. Invalid tool inputs cannot partially change the screen. Node DOM/timer test doubles are labeled separately from browser and supported-WebMCP evidence.
- Affected files: dist/src/app.js, index.html, styles.css, test/interface.test.js, docs/verification.md, README.md.
- Review: reload clears scores/history. Client scores are not tamper-proof, global rankings or capability assessments. Existing 2026-10-08 browser/REMOTE_CI/LIVE records describe earlier code only. This session authorizes no commit, push, deployment or other remote mutation.

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
