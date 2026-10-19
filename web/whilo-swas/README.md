# whilo-swas — Web

This folder is the source/deployment boundary for the browser product. Vercel should use this folder as its root, run `npm run build`, and publish `public/`.

## Build

Requirements: Node.js 22+ (24 recommended), Bash, curl and sha256sum.

```sh
npm run check
npm run build
```

The build retrieves the pinned Whilo site bundle from the GitHub release, verifies SHA-256, then injects the editable `whilo-enterprise.js` layer. The base bundle is still release-built rather than native source in this repository; migrating its auth/runtime to first-party source remains a deliberate follow-up, not something this folder pretends has already happened.

## Current capability boundary

The existing site provides Chat, Pets, Store and Rotinas. Pets are persistent agent identities; specialist Bots are task-scoped workers coordinated by a Pet. The enterprise extension adds Work, Company, Connect and Results. Those views currently save local work tracking in the browser; they do not, on their own, launch autonomous jobs, establish OAuth connections, or provision a Linux computer.

See `../../docs/agentic-runtime-and-linux-desktop.md` and `../../docs/whilo-services-as-software-strategy.md`.
