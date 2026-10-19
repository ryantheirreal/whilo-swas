# Whilo — Services-as-Software Strategy

Last updated: 2026-10-19

## Executive decision

**Whilo should sell completed business work, not just access to bots.** The long-term product is an AI-operated company: people define goals, policies and exceptions; Whilo runs the repeatable work, produces auditable deliverables and escalates judgement calls. The near-term wedge is a **Revenue Operations service for B2B service businesses**, delivered by Whilo plus a controlled human review loop.

This is a strategic hypothesis, not a validated market result. Validate it with paid design partners before building every department.

## Research anchor: Sequoia’s $1T thesis

Primary source: [“Services: The New Software” — Julien Bek, Sequoia Capital, March 5, 2026](https://sequoiacap.com/article/services-the-new-software).

The thesis is that the next category-defining company may look like a services firm while using software to deliver the work. The article argues that businesses spend roughly six dollars on services for every dollar on software, and recommends starting with intelligence-heavy work that is already outsourced. An existing outsourced budget is an easier vendor substitution than reorganizing internal headcount. Start with a narrow, verifiable outcome; win distribution; then expand toward judgement-heavy and internal work as domain data compounds.

**Whilo implication:** do not pitch “an AI team that can do anything.” Pitch a clearly scoped outcome with an existing budget, evidence of quality and a defined review path.

## Complete opportunity map in the Sequoia article

Sequoia's list is illustrative, not a validated ranking for Whilo. The market sizes below are the article's estimates, not independently verified figures. It separates industries by how much work is rule-based intelligence versus experience-heavy judgement, and by how much delivery is already outsourced.

| Vertical in the article | Estimate quoted by Sequoia | Key mechanism described | Whilo fit / caution |
|---|---:|---|---|
| Insurance brokerage | $140–200B | Standard commercial coverage often involves comparing options and filling standardized forms; distribution is fragmented. | Potential later vertical; licensing, carrier access and regulated advice are major gates. |
| Accounting and audit | $50–80B outsourced in the US | Bookkeeping and close work face labor shortages and has rules/evidence that can be checked. | Plausible future service, but only with accounting expertise, audit trails and professional review. |
| Healthcare revenue cycle | $50–80B outsourced in the US | Billing/coding translates records into standardized reimbursement codes. | High apparent automation fit, but protected health information, payer rules and compliance make it a poor first vertical without domain capacity. |
| Claims adjusting | $50–80B including third-party administrators | Standard claims combine policy interpretation, schedules and repeatable reserve calculations. | Potential later vertical; decisions affect people financially and require strong escalation and audit controls. |
| Tax advisory | $30–35B | Much underlying work is rules-based across jurisdictions, while credentials and local rules create a moat. | Expansion candidate only with jurisdiction-specific competence and qualified human oversight. |
| Transactional legal work | $20–25B | NDAs, contract drafts and filings are often outsourced and use verifiable formats. | A tempting wedge, but legal advice and filing authority require boundaries, reliable sourcing and review. |
| IT managed services | $100B+ | Patching, account provisioning and alert triage recur across SMB systems and are already frequently outsourced. | Strong adjacent candidate; require least-privilege access, change approvals, rollback and incident response. |
| Supply chain and procurement | $200B+ | The neglected long tail of suppliers and contract leakage leaves recoverable work that is not always explicitly budgeted. | Strong second/third-stage candidate once supplier data, approvals, purchasing limits and evidence capture exist. |
| Recruitment and staffing | $200B+ | Screening, matching and outreach are more standardized than final hiring judgement. | Candidate for later expansion; human decisions remain in hiring and fairness controls must be tested. |
| Management consulting | $300–400B | Data gathering and benchmarking can be separated from judgement-heavy strategy. | Decompose into narrow evidence-based components rather than attempting to automate executive judgement wholesale. |

### What the article says about market entry

1. **Copilot versus autopilot:** a copilot sells a productivity tool to a professional; an autopilot sells a result to the business that needs the work done. This changes the buyer, success metric and budget being captured.
2. **Intelligence versus judgement:** rule-heavy tasks become autonomously executable sooner. Experience, taste, context and responsibility still need oversight where the error cost is high.
3. **Outsourcing as the wedge:** replace an existing service vendor before asking a company to reorganize internal headcount. An accepted outsourced budget, established buyer and purchased outcome reduce adoption friction.
4. **Convergence through data:** start narrow, measure what good output looks like, collect permitted domain-specific feedback and use that evidence to automate progressively harder judgement.
5. **Distribution matters:** model quality alone is not a moat. Reach buyers, own the workflow, prove accepted outcomes and earn the right to expand.
6. **Incumbent dilemma:** existing copilots may know the customer and product well, but selling finished work can conflict with their tool-vendor business model. A purpose-built service operator can be positioned around the outcome from day one.

### Why Whilo should not pursue all ten at once

Whilo does not yet have a validated, secure, multi-tenant server runtime or proven computer execution in its current web deployment. The rational application of Sequoia's thesis is to select one repeated, outsourced, measurable workflow; sell it as a managed service; instrument quality, corrections, time and margin; then expand when renewals prove that the unit economics and operational controls work. The trillion-dollar thesis is a model for where value could accrue, not a prediction that Whilo will reach a particular valuation.

## Initial wedge: Whilo Revenue Operator

Target a narrow segment of B2B service businesses with recurring outbound, CRM and campaign work. Prefer businesses already paying an agency, SDR provider or operations contractor for those activities.

Initial service scope:
1. Research target accounts and build a documented prospect list using permitted sources.
2. Draft personalized outreach and campaign variants against an agreed ICP and offer.
3. Prepare follow-ups and CRM updates; require approval before external sends until quality and consent controls are proven.
4. Produce a weekly report showing activity, qualified pipeline movement, booked meetings where verified, exceptions and next actions.

Sell the work product and operating cadence—not a promise of guaranteed revenue, leads or meetings. Establish the customer’s baseline, definitions and attribution rules before claiming ROI. Pricing should be tested through paid pilots; a setup fee plus monthly service fee is a useful starting hypothesis, not a price validated by this document.

Why this wedge:
- The work is repeated and measurable.
- Agencies, SDR providers and RevOps contractors are an existing spend category.
- Whilo’s current Chat, Pets, Store and Routines create a plausible operator UI and reusable workforce.
- It matches the founder’s stated focus on B2B AI revenue systems and creative/copy-led growth.
- It offers a route into the customer’s systems of record and operating data.

## Keep the current navigation; add four outcome-oriented areas

Existing areas are preserved. Pets already represent the bots/agents; do **not** add a duplicate “Agents” tab.

| Navigation | Job to be done | Commercial role |
|---|---|---|
| **Chat** (existing) | Give instructions, clarify goals, review decisions and exceptions | The command surface |
| **Pets** (existing) | Select and manage Whilo’s AI workers, roles, skills and permissions | The workforce |
| **Store** (existing) | Discover and buy pets, approved playbooks and department packages | Distribution and expansion revenue |
| **Routines** (existing) | Schedule repeatable work and recurring reviews | Retention and automation |
| **Work** (new) | Queue jobs, define an acceptance test, assign an owner, review deliverables and see failures | Turns prompts into trackable units of work |
| **Company** (new) | Configure departments, business policies, playbooks, human owners and escalation paths | The operating model, not another chatbot |
| **Connect** (new) | Manage CRM, email, calendar, ads, support, knowledge and engineering integrations, permissions and health | Access to systems where work actually happens |
| **Results** (new) | Track verified outputs, acceptance, rework, cycle time, spend and attributed business outcomes | Proof of value, renewals and expansion |

The new interface must clearly distinguish a **saved plan** from a **queued job**, a **running job**, a **human-approved action**, and a **verified completed outcome**. Never show a connector as connected unless OAuth/API credentials are valid and a health check succeeds. Never label a task “done” merely because an LLM returned text.

## The path from one service to an AI-operated company

### Stage 1 — Wedge and proof
- Launch the Revenue Operator as a managed service with a small number of paid design partners.
- Keep a human accountable for offer quality, targeting, claims, outbound approval and customer communication.
- Measure baseline versus delivered work, human corrections, turnaround time, qualified outcomes and fully loaded cost.
- Use the same repeatable runbook across customers only after privacy and account boundaries are enforced.

### Stage 2 — Productize delivery
- Turn each recurring deliverable into a versioned playbook with inputs, acceptance checks, stop conditions and rollback.
- Add durable jobs, retries, idempotency, timeout/recovery handling and an event log.
- Connect one customer system at a time through OAuth with least-privilege scopes and revocation.
- Produce a receipt for each job: source evidence, actions taken, approvals, result, cost and exceptions.

### Stage 3 — Expand to adjacent functions
After the wedge renews and meets quality/margin targets, expand into Customer Support, Operations, Finance Operations, Recruiting, IT and Procurement. Each function needs a separate owner, compliance review, reference workflow, quality benchmark and unit economics. Do not open all departments as “autonomous” before they work end to end.

### Stage 4 — Enterprise operating layer
- Multi-tenant identity, roles, SSO/SCIM where required, audit logs and customer-specific data boundaries.
- Connector vault, least-privilege credentials, secret redaction and access revocation.
- Policies for approvals, spending limits, outbound communications and destructive actions.
- Evaluations, regression tests, incident handling, SLAs and transparent usage/cost controls.
- Knowledge and outcome data that compounds into better domain-specific decisions.

## Non-negotiable reliability requirements

1. **Identity and tenancy:** durable account records, cross-device sessions, role-based access and strict tenant isolation. The current README describes data as browser-local and says there is no backend; that is not enterprise-ready.
2. **Execution:** a durable queue, status state machine, retries, deduplication and recovery after refresh/deploy.
3. **Auditability:** every consequential action has an actor, timestamp, inputs, source evidence and result.
4. **Permissioning:** default read-only where possible; require approval for sends, purchases, access changes, deletions and legally/financially consequential actions.
5. **Security:** connector secrets on the server, scoped tokens, revocation, retention controls and no secrets in client-side logs.
6. **Quality:** structured acceptance criteria, evals, regression tests and explicit human escalation.
7. **Economics:** per-customer and per-job cost, gross margin, rework and latency. A busy agent is not necessarily an efficient service.
8. **Truthful metrics:** separate estimated time saved from measured time saved; separate activity from verified outcomes and attributed revenue.

## Metrics that decide whether to expand

**North-star candidate:** verified, customer-accepted outcomes delivered per account per week, at a target gross margin.

Supporting measures:
- acceptance rate on first review;
- human rework and escalation rate;
- median and p95 time from request to accepted output;
- cost per accepted outcome and gross margin;
- percent of actions with traceable evidence;
- weekly active customers and renewal/expansion;
- customer-specific business outcome (such as qualified pipeline), with an agreed attribution method.

Expansion is earned by paid retention and reliable unit economics—not by number of tabs, pets, model calls or demos.

## First 30 days

**Week 1:** make the web source reviewable and reproducible, inspect existing topbar and runtime behavior, add browser smoke tests and stop deploying opaque release bundles as the only editable source.

**Week 2:** pick one Revenue Operator workflow, define the ICP, inputs, deliverables, acceptance checklist, human approvals and baseline measurement with a design partner.

**Week 3:** wire the complete workflow to one real system of record with scoped access; persist jobs server-side; add an audit trail and failure/retry behavior.

**Week 4:** deliver the service, measure accepted outcomes and corrections, collect renewal intent, and publish a case study only after customer-approved evidence exists.

## Guardrails against the wrong strategy

- Do not build a generic horizontal agent marketplace as the primary value proposition.
- Do not claim that the current local browser work board is an autonomous agent runtime.
- Do not add duplicate “Agents” navigation; Pets already owns this concept.
- Do not promise “replace the entire company” in a sales claim before proving a bounded function. The company-replacement vision is the expansion path; the wedge is the entry point.
- Do not expand into regulated or high-impact functions without domain-specific controls and qualified human accountability.
- Do not confuse the Sequoia thesis with proof that Whilo can become a trillion-dollar company. The thesis identifies a business-model opportunity; execution, distribution, retention and economics decide the outcome.
