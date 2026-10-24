# Whilo security review runbook

## Scope and verified controls

Whilo's application data plane is intentionally server-only. Browser roles do not have direct table privileges in the exposed `public` schema; requests must pass through authenticated server routes, which use the service role only on the server. RLS remains defense in depth. Internal RLS helper functions are kept in the `private` schema, integration metadata views use `security_invoker`, and connector secrets are excluded from the safe-view column allowlist.

Routine launch controls include workspace/creator authorization before idempotency lookups, conflict checks for reused idempotency keys, a per-user manual-launch limit, explicit computer read/control scopes plus a recent device heartbeat, and bounded projections of user-created library metadata for both manual and scheduled mission planning. User-provided titles and descriptions are still untrusted input. Routine launches create approval-gated missions; no configured autonomous desktop worker is claimed. These controls prevent unapproved starts; they do not imply a desktop worker is configured or that a routine executed.

## Automated review entrypoints

### 1. Repository checker

From `web/whilo-swas`, run:

```bash
npm run check
npm run build
```

The checker validates JavaScript syntax, Vercel function-count limits, critical schema invariants, server-only table grants, routine access gates, paid-only Stripe wallet credits, bounded library-context projections, dynamic Stripe Checkout and secret hygiene. The build invokes `npm run check`, which includes SSRF regression tests, library-context projection tests and the new saved-library routine-analysis regression suite.

### 2. Strix white-box scan

The manual GitHub Actions workflow is `.github/workflows/strix-assessment.yml`. It uses `workflow_dispatch`, requires an explicit ownership/authorization input, constrains the target to `repository-code-only`, scans `./web/whilo-swas` in a disposable GitHub-hosted runner, and has a 45-minute timeout. It uploads the `strix_runs/` artifact for 14 days. **The workflow does not currently configure a model-spend budget cap**, and it does not perform an active black-box pentest of production.

Before dispatching, configure the GitHub repository secret `ANTHROPIC_API_KEY` **outside chat**. The workflow pins Strix 1.7.0, uses `anthropic/claude-sonnet-4-6`, runs a bounded quick scan with a 45-minute job timeout, and uploads `strix_runs/` as a 14-day artifact. Use the Actions tab → **Strix Authorized Repository Assessment** → **Run workflow**, explicitly confirm repository ownership, and keep scope set to `repository-code-only`. Review the entire artifact; a timeout, missing report, or incomplete run is not a clean result. The workflow has not been executed from this environment, so no Strix finding-free result is claimed.

Official references: [Strix Quick Start](https://github.com/usestrix/strix/blob/main/docs/quickstart.mdx), [Strix CI security scanning skill](https://github.com/usestrix/strix/blob/main/skills/ci-security-scanning-with-strix/SKILL.md).

### 3. Anthropic Claude Security review

This environment does not expose a connected Claude Code / Claude Security execution tool, so the Anthropic scan itself cannot be claimed as completed here. In a connected Claude Code session, run the documented `/security-review` command and review all findings before accepting patches. The Anthropic Claude Security plugin performs broader threat modeling and multi-file analysis when installed in a supported Claude Code environment.

Official references: [Anthropic automated security reviews in Claude Code](https://support.claude.com/en/articles/11932705-automated-security-reviews-in-claude-code), [official Claude Security plugin repository](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/claude-security).

### 4. Threat-model checklist before production launch

- Cross-tenant/BOLA: test two different workspaces; no routine, asset, run, message, billing or audit record may cross tenant boundaries.
- Agent prompt injection: treat web pages, library content, documents, comments and tool output as untrusted data, not control instructions.
- Least privilege: each integration and computer bridge receives only its needed scopes; no implicit elevation from pairing or a prompt.
- Human approval: outbound communication, data mutation, purchases, deletion and other irreversible actions are approval-gated.
- SSRF: any future worker fetching user-supplied target URLs must resolve DNS, block loopback/private/link-local/metadata addresses, defend against DNS rebinding, and re-check every redirect. Routine setup currently stores targets and builds reviewable missions; it is not a general-purpose server-side URL fetcher.
- Payments/credits: signed provider webhooks, idempotent ledger RPCs, server-derived cost, duplicate delivery tests, refund/dispute paths, and a disabled live payout kill switch until sandbox validation.
- Secrets/supply chain: keep service-role and model keys in server-only secret stores; pin dependencies and review scanner findings before updates.
- Evidence: distinguish queued, awaiting approval, running, verified, failed and completed states. Never label a queued mission as executed.

## Current verification boundary

The Supabase grant checks and security/performance advisors were run after database hardening. Verified results: `anon` and `authenticated` cannot select `organization_members`; `anon` cannot execute the private RLS helpers; authenticated users can execute the helpers required by RLS; browser roles cannot select integration records or encrypted secret columns. A catalog-wide privilege query returned zero public tables/views with direct SELECT or INSERT granted to `anon` or `authenticated`. The 21 remaining `rls_enabled_no_policy` notices are INFO-level on server-only tables; the 101 unused-index notices are also INFO-level telemetry. Do not add browser grants to silence the former or drop indexes before representative traffic just to silence the latter. The latest Vercel build at commit `953f7be` is READY and includes the new saved-library analysis tests. However, the public `/api/health` probe returns HTTP 503 because `SUPABASE_SERVICE_ROLE_KEY` is absent from Vercel; Stripe sandbox credentials are also missing, so authenticated app, billing and payout E2E workflows remain blocked. No authenticated live routine execution, Stripe sandbox purchase/refund, computer-control session, Strix scan or Anthropic Claude Security scan is claimed as passed unless a matching test result is recorded.
