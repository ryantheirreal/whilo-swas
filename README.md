# Whilo — SWAS

> Seu time de agentes sempre ativos que termina trabalho verificável.

**Produção atual:** https://whilo-swas.vercel.app  
**Código:** https://github.com/ryantheirreal/whilo-swas

## Navegação do produto

A barra original continua sendo **Chat**, **Pets**, **Store** e **Rotinas**. Pets representam os agentes persistentes do usuário; Bots são especialistas temporários que um Pet pode coordenar para uma tarefa. Não existe uma segunda aba “Agents”.

O pacote de extensão editável em `deploy/whilo-enterprise.js` adiciona quatro áreas ao topo:
- **Work:** fila local de trabalhos, owner Pet, Bots especialistas planejados, prioridade e estado.
- **Company:** modelos de playbooks por departamento e a distinção entre Pets persistentes, Bots temporários e verificação.
- **Connect:** catálogo de sistemas e criação de tarefas de configuração.
- **Results:** indicadores calculados a partir dos trabalhos locais e pressupostos configuráveis de ROI.

**Limite atual:** essas quatro áreas são uma camada de produto local no navegador. A fila usa `localStorage`; o botão que muda o estado marca acompanhamento, não inicia um trabalho autônomo. As integrações são cartões de configuração, não conexões OAuth ativas. O trabalho ainda não é executado por um Mission Governor/Agent Runtime real.

## Login e sessão

- `web/whilo-auth.js`: tela de autenticação e sessão local; PBKDF2-SHA256, passkey WebAuthn e sessão HMAC conforme a versão de release empacotada.
- O fluxo atual é local ao dispositivo. Não há autenticação multi-dispositivo de produção, banco de usuários remoto ou OAuth de Google/GitHub conectado ao backend neste repositório.

## Computer Runtime: status honesto

- `web/whilo-runtime.js` emula no browser as rotas `/api/*` e o stream `/api/events` para permitir desenvolver/testar o shell estático.
- **Isso não é um computador virtual Linux remoto.** O site ainda precisa de um backend persistente conectado a um provedor de sessão Linux, com screenshot, input, navegador, terminal, streaming, políticas de segurança e controle de ciclo de vida.
- Não declarar um computador como “ready”, nem dizer que uma tarefa foi executada no computador, até um teste de ponta a ponta confirmar sessão real, ação, evidência, recuperação e desligamento.

Leia:
- [Estratégia Sequoia: Services as Software](docs/whilo-services-as-software-strategy.md)
- [Arquitetura Pets + Bots, Computer Runtime e desktop Linux](docs/agentic-runtime-and-linux-desktop.md)

## Deploy web atual

A pasta `deploy/` define o build estático:
1. `build.sh` baixa o site da release `v1.0.0`, verifica SHA-256 e extrai os arquivos compilados;
2. injeta `whilo-enterprise.js` no HTML gerado;
3. publica a pasta `public/`.

A release compilada permanece em [GitHub Releases](https://github.com/ryantheirreal/whilo-swas/releases). O deploy de produção ainda não foi verificado após as últimas alterações do repositório; a conexão Vercel usada neste trabalho negou permissão para criar um deployment. As alterações estão no GitHub, mas **não afirmar que já estão visíveis no domínio de produção**.

## Direção do produto

Whilo deve vender resultado completo, começando com uma tarefa terceirizada, estreita e verificável (primeira hipótese: Revenue Operations para serviços B2B), e expandir conforme haja retenção, qualidade e margem positivas. O objetivo de “operar uma empresa” é a expansão de longo prazo, não uma afirmação de que todos os departamentos já são autônomos.
