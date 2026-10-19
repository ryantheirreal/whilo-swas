# whilo-swas-desktop

Whilo desktop client for **macOS, Windows and Linux**. It is kept in the same monorepo but packaged independently from the browser product.

## Current milestone: secure desktop shell

This initial Electron shell opens the hosted Whilo app at `https://whilo-swas.vercel.app/` (override for QA with `WHILO_WEB_URL=https://your-staging-host/`). It has context isolation, renderer sandboxing, Node integration disabled, same-origin navigation restrictions and external HTTP(S) links opened in the system browser.

This is a desktop client shell, **not yet a native computer-control agent**. It does not expose host filesystem, shell, screen or keyboard/mouse control to page JavaScript. A real computer runtime must be connected through a separate, permissioned main-process/provider bridge and tested before those features are enabled.

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
