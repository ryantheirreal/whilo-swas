# One-time authorized security assessment trigger

This marker authorizes a single, repository-code-only Strix assessment of `web/whilo-swas` using the existing Anthropic Claude model configuration.

- Scope: source code and repository files only.
- Excluded: active black-box targets, production data, external websites, user devices, credentials and live account actions.
- Budget guard: the workflow passes `--max-budget 10` to Strix.
- Evidence: scan output must report status `completed`; an incomplete or missing report is not a clean result.
- Secret requirement: `ANTHROPIC_API_KEY` must be configured as a GitHub Actions repository secret. The workflow skips the actual scan if it is absent and emits a warning. It never prints the secret.
- Re-run policy: do not change this marker again unless the repository owner intentionally wants to launch another bounded scan.

This marker is not proof that a scan passed. Its purpose is to trigger the workflow and record the result separately.
