# Whilo database & backend decision — 22 October 2026

## Decision

**Primary transactional database: Supabase-managed PostgreSQL.** Keep the existing migrations and add marketplace schema with migration 009. This is a continuity decision, not a claim that Supabase wins every benchmark. Whilo already relies on Supabase Auth, PostgREST, server-side service-role access, SQL constraints, row-level-security foundations, and migrations. Re-platforming now creates migration risk without validating demand or reducing current blockers.

**Do not move the whole platform to Railway.** Railway is a strong place to run workers and long-lived services; it is not a reason to discard the current Postgres/Auth model. For short Vercel request handlers, keep Vercel. Add a worker runtime only when a real queue consumer, browser/computer runner, or long-running task requires it.

**Portability rule:** PostgreSQL is the source of truth; keep domain logic in SQL constraints and ordinary server modules, keep vendor credentials server-side, and use provider-neutral interfaces for queues, object storage and model routing. Do not build an unnecessary multi-database architecture before traffic requires it.

## Fit criteria

Weights for Whilo: transactional correctness and tenant isolation (25%), auth/RLS fit (20%), realtime/storage integration (15%), total cost and predictability (15%), portability/export (10%), operational load (10%), AI/vector readiness (5%). These are Whilo-specific criteria, not an industry-wide ranking.

## Comparison: 27 plausible data platforms

Prices are directional snapshots from public pricing/documentation checked on 22 October 2026, in USD unless stated otherwise. Usage, region, backups, egress, support, tax and minimum compute change the actual bill. Use the linked official calculator before committing spend.

| Platform | Data model / strengths | Cost signal | Fit for Whilo now | Verdict |
|---|---|---|---|---|
| **1. Supabase** | Managed PostgreSQL + Auth, Storage, Realtime, APIs, SQL/RLS | Free tier; Pro starts at $25/month per organization, usage overages apply | Matches current migrations and auth patterns | **Choose** |
| 2. Firebase / Firestore | NoSQL documents, realtime listeners, mobile SDKs | Free daily quota then reads/writes/storage/network-based billing | Good for offline-first/mobile apps; Whilo has relational tenants, orders, entitlements and ledgers | Not now |
| 3. Convex | Reactive document-relational DB and TypeScript functions | Free + usage/plan-based scaling; verify current pricing | Strong developer experience for reactive state; replacing SQL/RLS is unnecessary churn | Greenfield alternative |
| 4. Neon | Serverless PostgreSQL, branching, scale-to-zero patterns | Free and usage-based paid compute/storage | Good portable Postgres option if isolated environments or DB compute become priorities | Re-evaluate later |
| 5. Railway | Deploy platform with Postgres/containers/workers | Hobby starts at $5/month applied to usage; CPU/RAM/egress/storage metered | Useful for mission workers and long-lived services; not a reason to rebuild auth/RLS | Worker candidate |
| 6. Render | Managed Postgres + web services/workers | Compute plus storage; listed Postgres storage around $0.30/GB/month | Solid persistent workers and managed Postgres; separate service/storage charges | Worker candidate |
| 7. Fly.io Managed Postgres | Managed Postgres, Machines and volumes | Managed Postgres Basic listed at $38/month; tiers rise with needs | Useful for region-aware compute and agent sandboxes, but adds runtime choices | Later |
| 8. Appwrite | Auth, storage, realtime and database services; self-hostable | Database serverless usage or dedicated compute from $10/database/month, plus platform plan | Viable BaaS, but migration of auth and schema adds risk | Alternative |
| 9. Nhost | PostgreSQL + Hasura GraphQL + Auth, functions, storage | Free tier; Pro starts at $25/month | Strong relational BaaS; GraphQL-first approach gives little benefit over existing setup | Runner-up |
| 10. MongoDB Atlas | Document database, search/vector options | Free cluster and usage-based dedicated tiers | Flexible documents, but transactions/ledger/entitlements are more natural in SQL | Not primary |
| 11. PlanetScale | Managed MySQL/Vitess and managed PostgreSQL offerings | Plan/compute/usage-based; verify edition and minimums | Strong database lifecycle tooling; no payoff from migrating now | Not now |
| 12. CockroachDB | Distributed SQL, multi-region resilience | Usage-based; vendor's current Standard example is about $0.092/vCPU-hour (~$203/month for its 2-vCPU/100-GB illustration) | Useful when multi-region transactional availability is proven necessary | Scale-stage |
| 13. Turso | SQLite/libSQL at edge, embedded replicas | Free; Developer $4.99/month billed annually; Scaler $24.92/month billed annually | Attractive edge-read/local-first patterns; not a drop-in for current Postgres backend | Specialized option |
| 14. Upstash Redis | Serverless Redis/cache/queues/vector | Free; pay-as-you-go $0.20 per 100k commands; fixed plan from $10/month | Useful cache, rate limiter or queue helper; not the money system of record | Add only when justified |
| 15. Amazon Aurora / RDS | Managed relational database, AWS IAM/VPC/networking | Instance/ACU, storage, I/O, backups, region and egress; no universal floor | Enterprise option with more cloud operations; Supabase already wraps Postgres and Auth | Later |
| 16. Google Cloud SQL | Managed PostgreSQL/MySQL/SQL Server | CPU, memory, storage, backups, HA and network by region | Strong enterprise service; more setup and no bundled product layer | Later |
| 17. Azure Database for PostgreSQL | Managed PostgreSQL integrated with Azure | Compute, storage, backup and HA vary by region | Best for Azure-centric enterprise procurement, not the current stack | Later |
| 18. DigitalOcean Managed Databases | Managed PostgreSQL and other engines | Cluster/node tier plus storage and backups | Straightforward separate database; less integrated than Supabase | Alternative |
| 19. Heroku Postgres | Managed PostgreSQL with Heroku operations | Plan and storage based; check current tier matrix | Easy operations but doesn't replace Auth/Storage/Realtime | Not now |
| 20. Xata | Developer data/search tooling with PostgreSQL heritage | Plan/usage-based; verify current product scope | Evaluate only if its search layer beats Postgres indexes directly | No migration case |
| 21. PocketBase | Embedded SQLite, auth/files/realtime in a single binary | Self-hosted software has no managed-service floor; server/storage/ops are yours | Excellent prototype/small-instance backend; not default for multi-tenant agent work at scale | Avoid as primary |
| 22. Cloudflare D1 | Serverless SQLite at edge | Usage quotas and usage pricing | Not selected; replacing APIs and current architecture adds churn, and Cloudflare isn't in the approved stack | Not now |
| 23. TiDB Cloud | Distributed MySQL-compatible SQL | Consumption or provisioned compute, region and storage | Consider only if MySQL compatibility or horizontal SQL scale is needed | Scale-stage |
| 24. YugabyteDB | Distributed PostgreSQL-compatible SQL | Cloud/self-managed compute and node-based pricing | Useful for distributed transactional deployments; too much complexity before traction | Scale-stage |
| 25. SurrealDB | Multi-model database/query language and graph/document patterns | Hosted/self-hosted tiers vary by plan | Interesting for graph-heavy relationships, not a reason to rewrite current transactional schema | No |
| 26. Aiven for PostgreSQL | Managed PostgreSQL with cloud/region choices | Instance/plan based, varies by cloud and HA | Technically sound alternative if portability/control becomes material | Alternative operator |
| 27. Crunchy Bridge | Managed PostgreSQL with Postgres-centric controls | Compute, storage and selected options determine total | Sound Postgres operator, but moving adds effort without a current benefit | Alternative operator |

## Official vendor pages checked

- Supabase pricing: https://supabase.com/pricing
- Firebase Firestore billing: https://firebase.google.com/docs/firestore/pricing
- Convex pricing: https://www.convex.dev/pricing
- Neon pricing: https://neon.tech/pricing
- Railway plans: https://docs.railway.com/pricing/plans
- Render pricing: https://render.com/pricing
- Fly.io pricing: https://fly.io/pricing/
- Appwrite pricing: https://appwrite.io/pricing
- Nhost pricing: https://nhost.io/pricing
- MongoDB Atlas pricing: https://www.mongodb.com/pricing
- PlanetScale: https://planetscale.com/pricing
- CockroachDB pricing: https://www.cockroachlabs.com/pricing/
- Turso pricing: https://turso.tech/pricing
- Upstash Redis pricing: https://upstash.com/pricing/redis
- Amazon RDS: https://aws.amazon.com/rds/pricing/
- Google Cloud SQL: https://cloud.google.com/sql/pricing
- Azure Database for PostgreSQL: https://azure.microsoft.com/pricing/details/azure-database-postgresql/
- DigitalOcean managed databases: https://www.digitalocean.com/pricing/managed-databases
- Heroku Postgres: https://www.heroku.com/postgres
- Xata pricing: https://xata.io/pricing
- PocketBase production notes: https://pocketbase.io/docs/going-to-production/
- Cloudflare D1 pricing: https://developers.cloudflare.com/d1/platform/pricing/
- TiDB Cloud: https://www.pingcap.com/tidb-cloud/
- YugabyteDB pricing: https://www.yugabyte.com/pricing/
- SurrealDB pricing: https://surrealdb.com/pricing
- Aiven pricing: https://aiven.io/pricing
- Crunchy Bridge pricing: https://www.crunchydata.com/products/crunchy-bridge

## Target architecture

1. **Supabase Postgres:** organizations, identity-linked profiles, Pets/Bots manifests, missions, tasks, chat, listings, entitlements, orders and immutable commission ledger.
2. **Supabase Auth:** identity and sessions. Never expose the service-role key.
3. **Supabase Storage (initially):** preview images/artifacts with signed upload/download policies. Do not store executable creator bundles as trusted code.
4. **Vercel API:** short authenticated requests, validation, payment-session creation and signed webhook handling.
5. **Worker runtime (later):** persistent mission claim/heartbeat/retry loop; choose Railway/Render/Fly after measuring browser and computer workloads.
6. **Cache/queue (later):** PostgreSQL queue first; add Upstash Redis only when rate limits, fan-out or throughput justify its extra moving parts and bill.
7. **Analytics (later):** derive metrics from audited product events; do not make an analytics warehouse the source of truth for money.

## Cost and reliability guardrails

- Create a staging Supabase project separate from production before applying future migrations.
- Apply versioned SQL in order; never edit an already-applied migration to change production history.
- Keep backups, verify restore procedures, and define RPO/RTO before production payments.
- Add query limits, pagination, request caps, rate limiting and per-tenant quotas.
- Track database size, egress, storage, realtime connections, slow SQL and failed jobs.
- Do not shard, add multiple primary databases, or run Kubernetes solely to look enterprise. Make each new service earn its complexity.
- Re-evaluate the database decision against measured bottlenecks, not marketing.

## Verdict

Supabase wins for the next product milestone because it ships faster on existing code. A future scale design can move workload-specific services, but the marketplace ledger should remain on a transactional SQL database with idempotent payment webhooks and explicit tenant boundaries.
