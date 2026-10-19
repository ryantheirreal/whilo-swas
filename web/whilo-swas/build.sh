#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

ASSET_URL="https://github.com/ryantheirreal/whilo-swas/releases/download/v1.0.0/whilo-site-v1.0.2.tar.gz"
EXPECTED_SHA256="367032f5e1429ddd5e2e6e6205a6b9827749b60a689b197d36be8f5febcfc05e"
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

curl --fail --location --silent --show-error "$ASSET_URL" -o "$TMP"
echo "$EXPECTED_SHA256  $TMP" | sha256sum --check --status

rm -rf "$ROOT/public"
mkdir -p "$ROOT/public"
tar --extract --gzip --file "$TMP" --directory "$ROOT/public"
rm -f "$ROOT/public/vercel.json"
cp "$ROOT/whilo-enterprise.js" "$ROOT/public/whilo-enterprise.js"
cp "$ROOT/../../shared/whilo-agent-core/index.js" "$ROOT/public/whilo-agent-core.js"

node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const htmlPath = path.join(process.cwd(), "public", "index.html");
let html = fs.readFileSync(htmlPath, "utf8");
const coreScript = '<script src="/whilo-agent-core.js" defer></script>';
const enterpriseScript = '<script src="/whilo-enterprise.js" defer></script>';
if (!html.includes("/whilo-agent-core.js") || !html.includes("/whilo-enterprise.js")) {
  const pos = html.toLowerCase().lastIndexOf("</body>");
  if (pos < 0) throw new Error("Whilo index.html has no closing body tag");
  const tags = (html.includes("/whilo-agent-core.js") ? "" : coreScript) + (html.includes("/whilo-enterprise.js") ? "" : enterpriseScript);
  html = html.slice(0, pos) + tags + html.slice(pos);
}
fs.writeFileSync(htmlPath, html);
NODE

test -s "$ROOT/public/index.html"
test -s "$ROOT/public/whilo-auth.js"
test -s "$ROOT/public/whilo-runtime.js"
test -s "$ROOT/public/whilo-enterprise.js"
test -s "$ROOT/public/whilo-agent-core.js"
echo "Whilo web bundle ready: $ROOT/public"
