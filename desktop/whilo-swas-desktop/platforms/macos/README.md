# macOS packaging

Build on a macOS runner with `npm run dist:mac`. The output is DMG and ZIP. For public distribution, configure Developer ID code signing and notarization; store certificates and Apple credentials as repository/environment secrets and never commit them. Before enabling local screen/control tools, request OS permissions explicitly and provide a visible stop-control state. The initial client currently opens the hosted Whilo web app only.
