# Whilo — SWAS

> Seu time de agentes sempre ativos que terminam o trabalho.

**Produção:** https://whilo-swas.vercel.app

## O que tem aqui
- **Auth do /whilo** (`web/whilo-auth.js`): tela #121212 com FloatingBots, e-mail + senha (PBKDF2-SHA256 210k), Passkey (WebAuthn ES256 com assinatura verificada), convidado, sessão assinada HMAC (`whilo-auth-session`), bloqueio progressivo após 5 erros, menu de conta (Chave de IA, Passkey, Trocar conta, Sair).
- **Whilo Cloud Runtime** (`web/whilo-runtime.js`): emula `/api/*` e o stream `/api/events` no navegador, por usuário — o shell (Chat, Pets, Store, Rotinas) funciona 100% em hospedagem estática.
- **Elenco:** Whilo, Fynn, Nori, Capuccino, Ollie, Pico.
- **IA real opcional:** cole uma chave OpenRouter (`sk-or-…`) ou OpenAI (`sk-…`) no menu da conta.
- Rebrand total OpenMausBot → Whilo.

## Deploy
O site compilado vive como asset das [releases](https://github.com/ryantheirreal/whilo-swas/releases). A pasta `deploy/` contém o que a Vercel usa: `build.sh` baixa o asset, confere o SHA-256 e publica em `public/`.

## Sincronização do código
O workflow `.github/workflows/sync-from-release.yml` extrai `index.html`, `whilo-auth.js`, `whilo-runtime.js` do asset mais recente para `web/` (rode em Actions → Run workflow).

## Limitações atuais
- Contas/dados ficam no dispositivo (sem backend ainda). Próximo passo: Supabase/Clerk para multi-dispositivo, OAuth Google/GitHub e código por e-mail.
