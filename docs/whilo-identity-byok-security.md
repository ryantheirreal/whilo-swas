# Whilo identity, BYOK models, Routines and security boundaries

## Provider architecture

```text
Browser
  ├── Supabase Auth: email / Google identity (PKCE)
  ├── OpenAI website OIDC: ChatGPT identity only; enabled only for an approved client
  ├── Connect: Gemini Developer API key / OpenAI API key
  │       └── HTTPS -> server validates key -> AES-256-GCM encrypted row
  └── BYOK Model Console
          └── authenticated Whilo API -> workspace membership check
                -> decrypt server-side key -> live model discovery cache
                -> official provider API -> output + provider-reported token usage
```

Google OAuth proves a Google identity; it does not provide the user's consumer Gemini Free/Pro/Ultra quota. Gemini Developer API requests are billed against the Google API project/key configured by the workspace owner. OpenAI API keys use the Developer API account and billing, not ChatGPT Plus/Pro consumer quotas.

The hosted ChatGPT identity button is disabled by configuration until an approved OpenAI website OAuth client, exact registered callback and server secrets are configured. Its implemented OIDC scope is `openid profile email`; the hosted code deliberately does not request `chatgpt.tokens.use.direct` or store provider inference credentials. An existing Whilo account is never merged solely because the OpenAI and Whilo email strings match. An authenticated user can initiate an explicit identity link; OAuth state is bound to that initiating account.

Antigravity third-party OAuth is not implemented. Its current terms prohibit using consumer Antigravity credentials through unrelated third-party clients. Use Google's official Gemini Developer API for model calls instead.

## Secret handling and guardrails

- Provider API keys are verified against the official model endpoint, then stored only in `integration_connections` using AES-256-GCM. Keys never appear in API responses, local storage or logs.
- Only workspace owners/admins may change shared AI provider keys.
- The model list is discovered from each provider, cached in memory for 60 seconds, and model IDs must belong to that live list.
- Requests are bounded to 15,000 prompt characters, 4,000 system-context characters and 2,048 output tokens. OpenAI Responses requests set `store: false`.
- Provider 401/403/429/quota errors are mapped to actionable errors. The gateway returns provider-reported token counts when supplied and never invents a remaining-quota percentage.
- Every successful request writes a metadata-only audit event; prompt text and keys are not written to Whilo's audit ledger.
- Willow Bucks is a separate Whilo usage wallet. It is not a cash balance, crypto asset or representation of a provider subscription. Existing checkout/ledger logic applies to Whilo-priced services; direct BYOK provider calls are billed by the connected API provider.

## HTTP paths

- `GET /api/model-gateway?provider=gemini-api|openai-api` — retrieve current models available to the connected API key.
- `POST /api/model-gateway` — body `{ provider, model, prompt, system?, maxOutputTokens? }`.
- `GET /api/auth/chatgpt/start` — optional approved ChatGPT identity login.
- `POST /api/auth/chatgpt/link-start` — start ChatGPT identity linking from an authenticated Whilo session.
- `GET /api/auth/chatgpt/callback` — consume a single-use, browser-bound transaction, verify OIDC signature/nonce, and create/link the Whilo identity.

## Operational production gates

1. Configure Supabase Google Auth and exact redirect allowlists.
2. Leave `OPENAI_SIWC_ENABLED=false` until OpenAI approves the website client and the callback/auth method match the registered configuration.
3. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `WHILO_CONNECTOR_ENCRYPTION_KEY` (base64 of 32 random bytes), and the public URL in the Vercel server environment. Never expose service-role, encryption or OpenAI client secrets to frontend variables.
4. Run the project build/regression suite. Run the Strix workflow and review `strix_runs/<run>/penetration_test_report.md`, `run.json` status/cost, SARIF and all findings. A skipped or incomplete scan is not a clean result.
5. Routine scheduling, library asset context and approvals exist in the current product, but a routine that needs actual desktop/browser interaction still requires a supported, isolated computer-runtime adapter and end-to-end proof. The UI alone is not evidence of working remote computer control.
