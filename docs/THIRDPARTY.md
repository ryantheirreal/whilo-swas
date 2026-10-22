# Third-party software and licensing notes

This file records the directly used third-party code in the Whilo marketplace implementation. Review this inventory whenever dependencies are added, upgraded, bundled, or copied into the repository.

## Runtime dependencies

| Dependency | Pinned version | License | How it is used | Source |
|---|---:|---|---|---|
| Stripe Node SDK | 22.6.2 | MIT | Server-side Stripe Connect, Checkout, Subscription retrieval, and signed webhook verification. Do not expose API keys or instantiate it in browser code. | https://github.com/stripe/stripe-node/tree/v22.6.2 |
| qrcode | Existing range ^1.5.4 | Verify package metadata at lockfile generation | Existing QR-pairing support; retained from the pre-existing project. | https://www.npmjs.com/package/qrcode |

Stripe SDK installation is pinned in `web/whilo-swas/package.json`. The SDK's own package distribution includes its license. Preserve the license and copyright notices in deployments and software distribution where applicable.

## Open-source product references (not copied code)

- Telegram TDLib: https://github.com/tdlib/td — Boost Software License 1.0; an SDK for building clients on Telegram, not a hosted Telegram-compatible backend.
- Telegram Desktop: https://github.com/telegramdesktop/tdesktop — GPLv3 with an OpenSSL exception; client code is not copied into Whilo.
- Zulip: https://github.com/zulip/zulip — Apache-2.0; studied for topic-based threading and collaboration patterns.
- Element Web: https://github.com/element-hq/element-web — license obligations include GPL/AGPL and a commercial-license path; source is not copied into Whilo.
- Stripe Connect examples: https://github.com/stripe-samples/connect-destination-charge and https://github.com/stripe-samples/checkout-single-subscription — consult the current license files and revision before copying any sample code.

Whilo's current marketplace route and UI are original repo changes using the official Stripe SDK. The listed collaboration repositories inform product design/research; no Telegram, Zulip, or Element source file is represented as copied. Do not paste a repository wholesale into Whilo. Before incorporating any sample code, pin its exact commit, record the file paths and license, preserve required copyright notices, and review license compatibility with Whilo's planned distribution model.
