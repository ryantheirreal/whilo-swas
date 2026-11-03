# Whilo navigation consolidation — 2026-11-02

## Scope delivered in this branch
- Preserve the shell's native primary navigation. Remove the Enterprise layer's injected Messages, @Routines, Work, Company, Connect, Account and Results buttons from the main bar.
- Rename the existing Store/Marketplace entry to **Apps**; do not add a duplicate.
- Expose exactly three primary destinations inside the existing Apps surface: **Apps**, **Plugins** and **Skills**.
- Keep My Library, Creator Studio, Review Queue and Plans reachable under one **Manage** disclosure.
- Add a first-class Skills catalog of source references. Third-party skill instructions remain untrusted data and are not executed automatically.
- Retain the Leis Legal Desk in Plugins, including its source and professional-review boundaries.

## OpenMausBot changes reviewed as design/engineering references
These upstream commits were inspected for patterns, not copied wholesale:
- [18a81845 — thin top bar, 36px rail and rounded app card](https://github.com/milind-soni/OpenMausBot/commit/18a81845bf65c938054573b96cd7ad4e380f5a1): navigation hierarchy and restrained chrome; desktop window chrome should not be transplanted into the web app.
- [ccb66496 — sidebar returned inside the app card](https://github.com/milind-soni/OpenMausBot/commit/ccb66496fae2f29adac2ba3def78dc1e43abeebd): one coherent surface instead of stacked navigation layers.
- [1f35a344 — waiting threads appear beneath their bot in Simple mode](https://github.com/milind-soni/OpenMausBot/commit/1f35a3449721f083f75152388813b438b61a0a10): show work in the place where the user expects to find it.
- [af125b41 — offer browser installation in the panel already in use](https://github.com/milind-soni/OpenMausBot/commit/af125b41d2934f7b408aa976f85d05a225553011): context-aware actions instead of extra global tabs.
- [ee7d52ce — recover a failed page without blanking the shell](https://github.com/milind-soni/OpenMausBot/commit/ee7d52ce66b6c852aaf6df8c1015c668e3b2c8d0): retain app context through recoverable errors.
- [6d32b86b — steer, queue or restart a message while a bot is working](https://github.com/milind-soni/OpenMausBot/commit/6d32b86b285b016afc444f86b052cd09ade16654): improve the active-run composer without expanding global navigation.
- [fb283eab — explain when a saved model key has no runnable engine](https://github.com/milind-soni/OpenMausBot/commit/fb283eab7570e1c767ee56c77d7787bdc2c68dad) and [9d01d6bb — refresh engine status after setup](https://github.com/milind-soni/OpenMausBot/commit/9d01d6bb46da991ab72764584c93f03f24c3b1bb): credentials saved is not equivalent to a model runtime being ready.
- [d40f17d7 — keep active automations visible across conversations](https://github.com/milind-soni/OpenMausBot/commit/d40f17d7fd4de9c9e897b037393a87951a2b0522): ongoing work should remain visible from its owning workspace.

The upstream commit review included the latest 100 commits returned for the inspected date window. This is a relevance-focused sample, not a claim that every upstream commit since October 24 was exhaustively compared.

## Regression coverage
`scripts/test-marketplace-navigation.cjs` checks:
- The three primary destinations.
- Preservation of management destinations under Manage.
- Skills routing and source references.
- Recognition and relabeling of the existing shell Marketplace entry as Apps.
- Removal of legacy top-level navigation injections.

The test is part of `npm run check`.

## Local continuation gates
1. Pull the branch and run the repository checks plus the Vercel-root build.
2. Verify the UI at desktop and mobile widths, including focus, keyboard access, menu dismissal and horizontal overflow.
3. Test the full identity lifecycle: sign-up, email confirmation, sign-in, password recovery, session refresh, logout, workspace isolation and provider OAuth callbacks.
4. Trace one mission end-to-end: goal → governed plan → approval → task graph → bounded tool call → streamed events → cancellation/recovery → independent verification → persisted outcome receipt.
5. Distinguish website QA, local Codex CLI tasks and persistent computer control. Do not represent the read-only Browserbase QA endpoint as full computer control.
6. Add provider-backed streaming/tool-call tests only with sandbox credentials. Keep ChatGPT website identity OAuth, the official Codex CLI login and API-key model providers separate.
7. Deploy Preview first. Promote only after checks, browser smoke tests and release evidence pass.
