# whilo-swas-desktop

Whilo desktop client for **macOS, Windows and Linux**. It is kept in the same monorepo but packaged independently from the browser product.

## Current milestone: secure desktop shell

This Electron shell opens the hosted Whilo app at `https://whilo-swas.vercel.app/` (override for QA with `WHILO_WEB_URL=https://your-staging-host/`). It has context isolation, renderer sandboxing, Node integration disabled, same-origin navigation restrictions and external HTTP(S) links opened in the system browser.

It now includes a permission-gated **local Codex task bridge** for selected Git repositories. It is not a general desktop-control agent: it does not yet provide arbitrary screen capture, mouse/keyboard control, or the persistent OpenMausBot-style live browser panel. Those capabilities need separate platform permission, screen-ownership/lease rules, revocation, recovery and end-to-end acceptance tests.

## ChatGPT OAuth through the official local Codex CLI

Whilo Desktop can connect ChatGPT on this computer through the **official Codex CLI**. This is separate from the website's optional “Sign in with ChatGPT” identity OAuth:

- Install the official Codex CLI yourself and enable device-code login in your ChatGPT security settings or workspace policy if it is available for your account.
- In Whilo Chat, choose **Codex via ChatGPT · this computer**, select **Connect ChatGPT**, complete the device approval, and select a Git repository.
- Whilo runs `codex exec --json --ephemeral --sandbox read-only` by default. A native confirmation appears before each task. Choosing workspace-write requires a separate explicit selection and a native confirmation.
- Codex uses its own profile inside Whilo Desktop's user-data folder. Whilo does not copy the Codex session token into Supabase, Vercel, the browser UI or the hosted model gateway. The task and the data Codex reads are still sent to OpenAI as part of the official Codex service.
- Only a standalone Codex executable is launched; the bridge doesn't invoke a shell, doesn't accept arbitrary executable paths from the web page, strips API-key environment variables, caps output and stops tasks after 10 minutes.

Device-code login may not be enabled by every account or workspace. Whilo displays the official CLI's result and does not attempt to bypass a policy. The web site's **Sign in with ChatGPT** button is a different OpenID Connect identity flow; it requires an approved OpenAI website OAuth client and the exact registered callback before it can be enabled.

Official references: [Codex CLI authentication](https://learn.chatgpt.com/docs/auth), [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode), [Using Codex with your ChatGPT plan](https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan).

## Development

```sh
npm install
npm run check
npm start
```

## Build installers

Run on the matching OS (recommended for repeatable signing and platform testing):

```sh
npm run dist:mac
npm run dist:win
npm run dist:linux
```

Artifacts appear in `release/`. macOS distribution requires Apple signing/notarization credentials; Windows signing also requires a configured certificate for a trusted publisher experience. Unsigned builds are for internal testing only.

## Planned desktop parity

- Shared Pets/Bots mission semantics with web, not a second independent agent brain.
- Cloud Computer viewer and durable job timeline, with approval, evidence and recovery states.
- Optional, explicit local-computer control only through a platform-specific permission/consent layer.
- macOS Screen Recording/Accessibility permissions, Windows consent/least privilege, Linux Xorg support and fail-closed behavior when Wayland control is not safely verified.
- No secret credentials in renderer storage; use OS credential storage when local secrets are introduced.

See `platforms/macos/README.md`, `platforms/windows/README.md` and `platforms/linux/README.md`.
