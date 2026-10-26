# Whilo implementation research: OpenMausBot (2026-10-25)

This document records an implementation-focused review of public upstream work. It is not a claim that Whilo is equivalent to OpenMausBot, and it does not authorize copying upstream source.

- Canonical repository: https://github.com/milind-soni/OpenMausBot
- PR #3513, gate owned Codex publication on canonical classification and observed triage: https://github.com/milind-soni/OpenMausBot/pull/3513
- PR #3511, do not display historical tool receipts as running after restart: https://github.com/milind-soni/OpenMausBot/pull/3511
- PR #3510, stop detached Linux sandbox helpers on interrupt: https://github.com/milind-soni/OpenMausBot/pull/3510
- PR #3514, remote engine hosts over SSH (draft): https://github.com/milind-soni/OpenMausBot/pull/3514
- PR #3457, phone apps as bot tools (server-side proposal): https://github.com/milind-soni/OpenMausBot/pull/3457

The repository describes itself as Apache-2.0. Before any code is ported, confirm the current license file, exact upstream commit, notices, and dependency/license obligations. Whilo should primarily port concepts and tests, not wholesale source.

## High-value patterns to adapt

### 1. Truthful execution state
Historical tool receipts must never be presented as currently running. Whilo routine runs should distinguish queued, running, awaiting approval, awaiting review, delivered, failed, cancelled, and unknown/unverified. A completed state must require a persisted result/evidence record; an interrupted job must not be marked successful. The existing Routines model should keep this invariant in its API, UI, and tests.

### 2. Publication gate for model output
Model-generated text and proposed actions should not become public output or an external side effect until the runtime classifies the complete response and applies the current task's permission envelope. Progress updates may be shown as progress; unverified final output should be held for verification. A model string, tool callback, or user-supplied metadata must not be treated as authorization.

### 3. Cancellation means process-tree cleanup
When Whilo gains a real local/desktop runtime, stopping a routine must stop its owned process tree and verify exit; killing only a parent process is insufficient. Record process identity/start time to avoid PID reuse, and fail closed when cleanup cannot be verified. Do not claim this exists for browser-only or server-only routines.

### 4. Device and phone capabilities
A paired device must be scoped to the owner, current task and explicitly granted capabilities. Read permissions do not imply write permissions. Routines should only target a user's phone or local computer when the request explicitly names that device or a saved routine target requires it; team/service contexts must not inherit personal-device authority. Keep credentials and host aliases out of companion payloads.

### 5. Remote engine hosts remain a separate release gate
The SSH engine-host proposal is draft research, not a production capability to enable by default. A future Whilo implementation needs per-host allowlists, workspace path mapping, dedicated internal authentication, capability isolation, host-loss handling, process cleanup, audit logs and real-host tests. A forwarded loopback port is not an authorization boundary by itself.

## Whilo-specific validation gates

- Every routine starts paused and manual by default.
- Schedules dispatch jobs; they do not falsely claim a run occurred.
- A computer runtime is advertised as available only with a recent owner-scoped heartbeat and required capabilities.
- Browser/API targets use DNS-aware public-address validation and revalidation at execution time.
- Library assets are structured data, not executable HTML/JavaScript.
- Consequential writes, purchases, deletes, outbound messages, credentials and account changes require explicit approval.
- Failed or interrupted work is visible with a recovery action and a truthful status.
- Tests cover duplicate delivery, restart/recovery, cancellation, stale receipts, SSRF, tenant isolation, authorization and replay.

## Current scope note

Whilo's production build currently runs its static security and product-contract tests, including routine target checks, library snapshots, Willow Bucks idempotency/refund handling, signed sessions and the model gateway. Those tests do not replace real end-to-end browser/device testing, provider sandbox tests, or a production incident drill.