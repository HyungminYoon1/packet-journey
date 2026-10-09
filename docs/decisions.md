# Decision log

## D13 — Cache expiry and evaluated retry diagnostics (2026-10-09, LOCAL)

- Context: owner requested concrete cache-expiry and retry-cascade scenarios, executable branch choices and observed cause/result, preserving the old campaign.
- Options: append static explanations; replace the campaign; add separate pure diagnostic scenarios sharing the existing playback and choices.
- Decision: preserve 4 original operations and 6 cases. Add 2 diagnostics × 3 conditions × 2 difficulties through diagnostics.js. Cache age begins at 200 ms; max-age is 1/2/3 seconds with must-revalidate. Observe a fresh cache hit, advance exactly to expiry, then conditionally GET with ETag. Unchanged content returns 304 without a body; condition 02 returns 200 with v2. Freshness restarts on response receipt; rendering adds 25 ms. Reuse without validation and DNS clearing do not resolve expiry.
- Decision: the retry scenario has 3 logical GET clients, one FIFO worker, per-job service 120/160/200 ms, and each layer's timeout 80/100/120 ms. Client and gateway each allow at most 3 attempts. Abandonment does not cancel the server job or propagate cancellation to an older gateway group. A response exactly at the deadline is late. Replies stop future retries only when they still belong to the active attempt. The original policy creates 27 jobs and a maximum 24-job waiting queue. The repair removes gateway retries and uses a client timeout of 3 × service + 1 ms, letting all 3 original jobs complete; repeated policy and doubled timeout are genuinely re-simulated and assessed. Playback waits for each request group's queue to drain before starting a comparison group, so new batches are not claimed to run on an old queue. The final cause choice is required for completion.
- Rationale: exposes expired-but-retained cache content and duplicate work after caller timeout without fake network measurement, destinations, random score injection or a backend. Timings remain assumed units. Browser playback speed never changes model time.
- Affected: diagnostics.js, missions.js dispatch, app.js, index.html, styles.css, model.js concepts, diagnostic/interface tests, README.md and architecture.md.
- Follow-up: model omits retry jitter, adaptive deadlines, parallel workers, server cancellation/idempotency mechanisms and real HTTP Date/Age transport corrections. Its GET-only duplicate-work model is not advice to retry side-effecting requests. Official MDN caching and AWS retry references were opened successfully. Main handles browser/viewport QA and publication.

## D14 — Bounded local achievements and gallery summary

- Context: user explicitly approved local persistence and the cross-app `web-lab-progress-v1` schema; earlier D02/D09/D12 prohibited persistent progress.
- Options: retain session-only progress; copy histories to the gallery; persist only known independent completion IDs and publish aggregate counts.
- Decision: supersede only the no-persistence portions of D02/D09/D12. progress.js owns localStorage. The private key holds only version and a deduplicated subset of 42 whitelisted achievement IDs. A completed, zero-fault, no-hint run qualifies after its final trace; wrong choices may still finish and score but do not earn independent badges. A per-run UI latch prevents replay or clear-then-replay from creating completion. No hidden completion/score-setting tool is introduced.
- Decision: summary is recomputed from read-back durable IDs on actual completion, using a real current ISO timestamp. RMW keeps other records. Whitelist is the 15 service IDs inventoried by directory name; web-lab and QA/output directories are excluded. Exact schema, bounds, timestamp and version validation fail safely. Each payload is limited to 8192 characters; accepted fields contain ASCII only. Invalid private state is not silently reset; the visible clear control can remove it. Invalid shared state is never overwritten. Clearing deletes only this app's private key and its aggregate entry, never localStorage.clear(). No initial-view, hint, example or mere-visit writes. No names, seeds, actions, score histories or files in either key.
- Rationale: allows the same-origin gallery to display truthful device-local completion without observing private run data. Storage denial/quota failure cannot invent a durable count. Failure is shown concisely; the UI remains playable.
- Affected: progress.js, app.js, index.html, styles.css, progress/interface tests, architecture.md, README.md.
- Follow-up: client storage can be edited manually and is not trusted ranking state. Same-origin requirement and best-effort cross-tab RMW remain documented. Only the main agent modifies/verifies gallery copies; this repo has no account access, provisioning, public ranking or API.

## D15 — Concise presentation and provenance

- Context: user requested removal of filler, promotional and repeated defensive copy while retaining controls, objectives, assumptions and privacy/provenance.
- Options: remove all model caveats; keep repeated disclaimers; concise controls plus units and one expandable model/privacy/reference section.
- Decision: remove decorative slogans and repeated timing disclaimer, label main numeric displays `ms (가정)`, add useful cache/request comparison state and retain a single simulation label and compact model/privacy/AI attribution. Keep native responsive controls and touch targets.
- Rationale: the actual trace and result remain central and the source of modeled times stays visible.
- Affected: app.js, model.js, missions.js explanations, index.html, styles.css and README.md.
- Follow-up: main captures meaningful actual result screens, including 304/200 and 27-to-3 request reduction at mobile widths. Browser E2E and screenshots are NOT_RUN by this implementation agent.

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
