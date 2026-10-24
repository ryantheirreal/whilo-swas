# Whilo security review runbook

## Scope and verified controls

Whilo's application data plane is intentionally server-only. Browser roles do not have direct table privileges in the exposed `public` schema; requests must pass through authenticated server routes, which use the service role only on the server. RLS remains defense in depth. Internal RLS helper functions are kept in the `private` schema, integration metadata views use `security_invoker`, and connector secrets are excluded from the safe-view column allowlist.

Routine launch controls include workspace/creator authorization before idempotency lookups, conflict checks for reused idempotency keys, a per-user manual-launch limit, and explicit computer read/control scopes plus a recent device heartbeat. These controls prevent unapproved starts; they do not imply a desktop worker is configured or that a routine executed.

## Automated review entrypoints

### 1. Repository checker

From `web/whilo-swas`, run:

```bash
npm run check
npm run build
```

The checker validates JavaScript syntax, Vercel function-count limits, critical schema invariants, server-only table grants, routine access gates, and secret hygiene.

### 2. Strix white-box scan

The manual GitHub Actions workflow is `.github/workflows/strix-assessment.yml`. It scans the checked-out repository in a disposable GitHub-hosted runner. It is manual-only, restricted to the `main` branch, caps the scan's model budget at US$10, fails when the scanner does not complete, and retains the report for 30 days. It does not perform an active black-box pentest of production.

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

The Supabase database grant checks and advisory queries were run during this implementation. The static source checker and production deployment must pass after the latest commits. Recent deployment attempts exposed brittle regular expressions in the checker; the current source corrects the 3D-motion assertions and must be rebuilt before the new code is considered live. No end-to-end authenticated routine execution, Stripe sandbox purchase/refund, computer-control session, Strix scan or Anthropic Claude Security scan is represented as passed unless a matching CI run or deployment result is recorded.
