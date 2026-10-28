# Whilo: OpenMausBot implementation review — 2026-10-28

## Scope

This is an implementation-research log, not a claim that Whilo already has every OpenMausBot capability. The upstream project changes quickly; review each linked PR and diff again before importing further patches. Whilo should adopt proven contracts and tests, not copy the entire application architecture.

## Implemented in Whilo

- **ChatGPT plan usage stays local:** the desktop app now exposes a narrow bridge to the official Codex CLI. The CLI profile is isolated under Whilo Desktop user data, API-key environment variables are removed from child processes, and the browser renderer does not receive the Codex token.
- **OAuth is explicit:** device-code login uses the official CLI's login command with device authentication, with a timeout, cancellation and a subsequent login-status check. If the account/workspace has not enabled this flow, Whilo reports the limitation rather than trying to bypass a policy.
- **Local tasks are bounded:** tasks run against a user-selected Git repository with Codex CLI JSON events, ephemeral mode and read-only sandbox by default. Every run requires native Electron confirmation. Workspace-write mode is selected separately, has a different native confirmation, and never uses an unrestricted sandbox mode.
- **Remote website QA is separate:** /api/computer opens a short-lived Browserbase session for public HTTPS targets, restricts browser traffic to the target origin, captures a screenshot and records findings. The request is read-only, role-gated, audited and capped by an atomic Supabase reservation. This is website QA—not full local desktop control.
- **API-key model providers are separate:** Gemini, OpenAI API, Anthropic API and OpenRouter use the hosted BYOK model gateway. They are not the same as ChatGPT identity OAuth or a ChatGPT-plan Codex session.

## Upstream changes worth adapting

### High priority: consent, recovery, device safety

1. [OpenMausBot PR #3712 — Stop sharing stays stopped; a stale consent lookup does not write to another account](https://github.com/milind-soni/OpenMausBot/pull/3712)  
   **Whilo application:** any future computer-control lease needs a monotonic consent/revocation version. Re-check authorization after every asynchronous boundary; stopping a share must invalidate in-flight work, not just set a UI toggle.

2. [OpenMausBot commit ae1aada6 — screen lease and recent human input safeguards](https://github.com/milind-soni/OpenMausBot/commit/ae1aada6b67b68d03921f910f4b4b97a66cea1a7)  
   **Whilo application:** before keyboard/mouse support exists, design a single owner-scoped screen lease, short-lived call leases, cancellation and a refusal state when a person is actively using the computer. Do not implement global input injection before this contract and platform-specific permissions are tested.

3. [OpenMausBot PR #3669 — restore sign-in handoff and preserve sessions after timeouts](https://github.com/milind-soni/OpenMausBot/pull/3669)  
   **Whilo application:** browser sign-in is a human-owned state transition. Wait for the human handoff to settle, preserve the browser process if only a tool transport timed out, and do not report success until the resulting auth/session state is verified. The current Codex flow does verify login status, but browser-based login handoff for a future live browser runtime still needs its own end-to-end tests.

4. [OpenMausBot PR #3709 — keep a running browser profile's locks when the driver restarts](https://github.com/milind-soni/OpenMausBot/pull/3709)  
   **Whilo application:** if a persistent remote browser is added, profile-lock cleanup must happen per container/browser lifecycle—not on every driver restart. The current Browserbase QA session is deliberately short-lived and does not reuse an authenticated profile.

### High priority: browser correctness and file safety

5. [OpenMausBot PR #3691 — browser viewport fills the panel at desktop width](https://github.com/milind-soni/OpenMausBot/pull/3691)  
   **Whilo application:** when a live-browser view is added, use the actual displayed viewport for screenshot scaling and map click coordinates into browser pixels. The current QA output uses a fixed 1280×800 viewport and returns a screenshot; it has no interactive pointer mapping yet.

6. [OpenMausBot commit 6656b9e — stage browser uploads and verify source file identity](https://github.com/milind-soni/OpenMausBot/commit/6656b9e240ce3d64192d0f152294f909668f896f)  
   **Whilo application:** before adding upload or drag-and-drop tools, stage bounded copies, reject symlink/junction swaps, compare open-file identity and remove every staged file on batch failure. Whilo does not currently expose local browser upload control, so this is a gate for a future feature rather than a patch to import now.

7. [OpenMausBot PR #3488 — install AI tools without requiring Node.js](https://github.com/milind-soni/OpenMausBot/pull/3488)  
   **Whilo application:** a future Codex/OpenCode installer should use a vendor-published standalone release plus verified digest/signature and OS/architecture allowlists. The current desktop bridge intentionally requires the user to install the official Codex executable; it does not download or run an unverified binary.

### Model/login and runtime robustness

8. [OpenMausBot PR #3593 — subscription/free model policies and context/token optimization](https://github.com/milind-soni/OpenMausBot/pull/3593)  
   **Whilo application:** keep subscription-authenticated runtimes separate from paid per-token API keys. Add explicit context budgets, tool-call accounting and fallback policy before offering multiple hosted/local models as interchangeable choices. Whilo's Codex adapter currently uses the official CLI; it does not invent a ChatGPT API endpoint or proxy the consumer session.

9. [OpenMausBot PR #3496 — test each AI with a small task before choosing it as default](https://github.com/milind-soni/OpenMausBot/pull/3496)  
   **Whilo application:** add a bounded connection probe and cache the last successful test per provider/model, but never claim a model is available just because a credential was saved. Whilo's BYOK model console already queries live catalogs; model response smoke tests are still needed against real sandbox accounts before launch.

10. [OpenMausBot PR #3725 — a rail for multiple Clouds](https://github.com/milind-soni/OpenMausBot/pull/3725)  
    **Whilo application:** defer the multi-runtime switcher until Whilo really supports multiple live machines. A UI that implies several functioning Clouds before their workers are provisioned would overstate capability.

11. [OpenMausBot PR #3727 — own-server homes, tunnel-aware address and clean restart](https://github.com/milind-soni/OpenMausBot/pull/3727)  
    **Whilo application:** relevant if/when Whilo supports customer-operated persistent workers. Keep tunnel-derived IP information trusted only when its proxy headers come from an explicitly trusted ingress and add restart/recovery tests. Not currently part of Whilo's short-lived Browserbase QA route.

12. [OpenMausBot commit e3b9af2 — bind broker sessions to the current acting user](https://github.com/milind-soni/OpenMausBot/commit/e3b9af2547316251c0c5fbcbec3c8b4640c60230)  
    **Whilo application:** each future MCP/computer call must resolve identity from the authenticated owner and workspace, not from a client-supplied actor field; keep the permission scope tied to the active run.

## OAuth: two distinct paths

- **Sign in with ChatGPT (website identity):** the existing Whilo website OAuth is intentionally disabled with OPENAI_SIWC_ENABLED=false. It requires an approved OpenAI website OAuth client and the exact callback https://whilo-swas.vercel.app/api/auth/chatgpt/callback. Do not enable it by guessing client credentials. It authenticates identity only; it does not grant ChatGPT-plan model inference.
- **Use ChatGPT plan through Codex (native desktop):** this is the newly implemented local bridge. It launches the official Codex CLI and completes the CLI's device-code flow on the user's computer. The user's task and repository context go to OpenAI through that official service, but Whilo does not receive or proxy the Codex session token.

## Next implementation gates

1. Run npm run check in desktop/whilo-swas-desktop on macOS, Windows and Linux; cover the actual official CLI version in a test profile.
2. Install/configure the official Codex CLI on a test machine and verify: login, expired session, cancellation, logout, no-CLI case, read-only sandbox, workspace-write approval, timeout, partial file changes and Git diff recovery.
3. Configure Browserbase only in Vercel server-side environment variables, then run a real public-site QA test and verify screenshot, same-origin restrictions, DNS/SSRF rejection, role checks and the Supabase launch cap.
4. Before implementing full screen/mouse/keyboard control, design and test the device permission contract, recent-user-input detection, screen lease, explicit takeover UI, revocation, evidence trail, platform-specific access prompts and crash recovery. Do not label the current QA or Codex repo runner as full desktop control.

## Primary repositories and sources

- [OpenMausBot repository](https://github.com/milind-soni/OpenMausBot)
- [OpenMausBot architecture README](https://github.com/milind-soni/OpenMausBot#readme)
- [OpenAI Help Center — Using Codex with your ChatGPT plan](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan)
- [Codex CLI authentication](https://learn.chatgpt.com/docs/auth)
- [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)
