# Whilo Messages — human collaboration architecture

Updated: 22 October 2026

## Product thesis

Whilo Messages is a human-first communications surface inside the Whilo operating system. Chat remains the command surface for Whilo; **Messages is where real people coordinate work**. The product should not become another generic messenger with AI pasted into a sidebar. Its distinctive loop is:

1. People discuss work in DMs, groups, supergroups and channels.
2. A human can turn a decision or request into a Work mission without losing the conversation context.
3. A persistent Pet owns that mission; specialist Bots get narrowly scoped tasks only when helpful.
4. High-impact actions remain approval-gated.
5. The mission returns a receipt, evidence and outcome back to the conversation.

A Pet/Bot is always labelled as an agent identity, never disguised as a human participant. Workspace owners control which agents can enter which conversations, what message history they can read, and whether they can draft or post. The default is human-only until permissions are explicitly granted.

## Implemented in this increment

- The top-bar **Messages** entry is inserted immediately after Chat (second position) and opens a dedicated messenger workspace.
- Inbox and public-channel discovery views.
- Database model for direct messages, groups, supergroups and channels, with conversation memberships and roles.
- Workspace-scoped human profile directory with pseudonymous @username handles; private email addresses are not returned in people search.
- Conversation creation that checks every selected participant belongs to the same workspace.
- Message timeline, message sending, edit/delete for the author, moderator override, emoji reactions, read receipts, replies and thread replies.
- Public channels can be discovered and joined by workspace members. Channel owners/admins/moderators publish; subscribers are read-only.
- Workspace invitation endpoint which asks Supabase Auth to send an invite email where possible, plus a copyable single-use link. Acceptance checks the invited email against the authenticated account.
- Browser message list refreshes while the window is open; real-time event delivery is still a backend activation task.
- Static validation for JavaScript/API syntax and migration/security invariants.

## Database and authorization invariants

The migrations are in supabase/migrations/202610220006_whilo_human_messages.sql, 202610220007_fix_human_profile_visibility.sql and 202610220008_workspace_invitations.sql, after the earlier platform migrations.

- All messages and channel membership are scoped to an organization.
- The browser does not get the Supabase service-role key. Every write goes through a server endpoint that resolves the organization from the authenticated user.
- A participant must be an active member to read or send messages.
- Only owner/admin/moderator roles can publish to a channel. Public discovery is limited to channels explicitly marked public inside the workspace.
- Direct-message pairs are idempotent, avoiding a new conversation every time the same two people start a DM.
- Threads require a root message in the same conversation. Reactions are allow-listed and unique per message/user/emoji.
- Invitation links are random, single-use tokens stored as hashes, have expiry, and must be accepted by an authenticated user whose email matches the invitation.
- No credential, email address, invite token or raw message content is written into the audit log.

## Open-source research and reuse decision

### Telegram

Telegram's official apps page states that its client applications are open source and lists TDLib, licensed under Boost 1.0. It lists Telegram Web A/Web K and Telegram Desktop clients under GPLv3. That does not mean Telegram's hosted messaging backend is available as an ordinary drop-in self-hosted server. A Telegram client fork also communicates with Telegram's service; it is not a ready-made, independently owned Whilo network. Exact code reuse therefore requires checking the license of the exact repository and distribution.

Source: https://telegram.org/apps/

### Matrix / Element

Element Web/Desktop exposes useful patterns for rooms, spaces, threads and message reactions, with end-to-end encryption and cross-platform support. The Element project lists AGPL/GPL licensing and commercial licensing options; Synapse, the Matrix homeserver, is AGPL-3.0. Matrix is the better direction to evaluate if federation and interoperable messaging become strategic requirements, but it introduces protocol, server operation, moderation and encryption decisions.

Sources:
- https://matrix.org/ecosystem/clients/element/
- https://github.com/element-hq/synapse

### Zulip

Zulip is an Apache-2.0 open-source team chat system with topic-oriented threads. Its information architecture is a strong reference for separating a high-volume room into focused discussions without losing asynchronous context. It is more relevant to work-centric conversations than cloning Telegram's client code.

Source: https://github.com/zulip/zulip

### Decision for Whilo

Use **independent implementation and design** for the current product: familiar messenger interaction patterns, but Whilo visual language, navigation, code and server schema. Do not transplant Telegram Web source into the current codebase. Re-evaluate Matrix only if federation, standards interoperability or proven end-to-end encryption becomes a top-level product requirement. Reuse Zulip's publicly documented interaction ideas rather than importing its implementation.

## Differentiators to build beyond a generic messenger

1. **Conversation → Work mission:** select a message or thread and create a mission with provenance, participants and acceptance criteria.
2. **Outcome receipts:** a Pet posts a structured summary of completed work, sources, verification failures and human approvals back into the originating conversation.
3. **Agent membership permissions:** a Pet joins only by explicit invitation; admins scope channel visibility, message history, allowed tools and whether the agent may draft or send.
4. **Human/AI identity transparency:** unique badges and audit records for human, Pet, Bot and system senders.
5. **Decision memory with consent:** explicit saved decisions/knowledge cards instead of silently using all message history as permanent model memory.
6. **Cross-channel operational actions:** messages can reference a mission, issue, document, approval or connector event without pretending that a link or attachment has been executed.

## Current activation boundary

The product code and schema are in GitHub. The intended Vercel environment did not yet have Supabase project credentials when the implementation was made, and the migrations have not been applied to a live database. Until Supabase is configured and migrations 001–008 are applied, the real-human message APIs return a configuration error, and real users cannot exchange persistent messages. The current UI is not evidence that realtime delivery or media uploads are live.

Not implemented yet: voice/video calls, read receipt delivery to all devices, push notifications, media/file storage, edit history/versioning, message forwarding, admin moderation queue, end-to-end encryption, abuse rate limits/anti-spam, organization invitations audit UI, live typing/presence, or agent participation in Messages. Do not claim these capabilities until each is built and tested.
