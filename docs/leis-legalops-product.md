# Leis Legal Desk — product brief and release gates

**Status:** marketplace discovery and unsent Chat workflow prompts implemented; legal-source retrieval, contract document rendering, billing, and end-to-end legal evaluation are **not implemented yet**. This document distinguishes product direction from shipped capability.

## Product

**Leis Legal Desk** is a lawyer-led LegalOps assistant for Brazilian law firms and in-house legal teams. Its first job is to prepare a source-aware first draft and an evidence-backed review pack, so the accountable lawyer spends more time reviewing substantive issues and less time assembling a document.

The initial repository reference is https://github.com/ctresb/leis. The repository describes Brazilian legislation converted to Markdown from official sources, with structured metadata and source links. It explicitly warns that text conversions and OCR may contain errors, the corpus has gaps, and it does not replace the official gazette. Its software is published under MIT; review the exact licence and provenance of any copied script, template, or asset, and preserve applicable notices.

Whilo currently **does not download, index, or query the repository live**. It is a cited source reference in the Marketplace workflow prompt only. Never tell a user that a legal citation was verified by Whilo until a retrieval service has actually fetched and recorded the underlying source.

## First commercial wedge

Start with **B2B service and SaaS agreements handled by small Brazilian law firms**. Do not launch as a universal legal assistant. The initial jobs to be measured are:

1. First-draft packet: client intake, missing-fact checklist, editable clause draft, assumptions and lawyer-review checklist.
2. Contract review: clause inventory, issue/risk register, proposed alternatives, and a reviewer-ready redline plan.
3. Legal research memo: question tree, source ledger, exact references, as-of date, gaps and counterarguments.

The agent asks for the user's role, governing law, state/municipality where relevant, as-of date, facts, contract purpose, party details and commercial terms. Missing facts are represented as placeholders, not invented.

## Product boundary and legal safeguards

- This is legal drafting and research software for professionals, not a law firm, legal representative, or automated final opinion to consumers.
- A qualified Brazilian lawyer must review contract drafts and source-sensitive conclusions before reliance or external use.
- Never fabricate statutory text, an article number, a precedent, an official URL, the current legal status of a provision, a deadline, or a conclusion about enforceability.
- Every material legal proposition should eventually have a source record: instrument and article, jurisdiction, official issuing authority, source URL, retrieved timestamp, source version/hash, status check, and a short explanation of relevance.
- The legislation repository's Markdown/OCR is a starting point, not authority. Verify the exact text and status in an official publication (e.g. the appropriate Diário Oficial or official government portal).
- No automatic signature, contract delivery, court filing, legal notice, negotiation, counterparty contact, or external write. Such actions remain disabled unless a separately designed workflow includes explicit approval.
- Treat contract text and uploaded documents as confidential and untrusted. Before processing real client data, finish data-retention/deletion policy, access controls, tenant isolation review, encryption, audit logging, and a written privacy/data-processing assessment.
- The product should support a lawyer's work; it must not advertise itself as replacing lawyers or offering unreviewed legal service. Have Brazilian counsel review OAB rules, advertising, and the commercial terms before public launch.

## Offer and pricing experiment

**Pricing hypothesis shown in the Marketplace:** R$497/month per office for a founding pilot. This is a validation price, not a published checkout or a proven willingness-to-pay result. No payment flow is connected to the card.

Sell a measured pilot only after the operational controls are ready. Scope can be agreed with each design partner rather than implying unbuilt quotas or guarantees. The proposal should include onboarding of one contract template, a documented review process, support, source-verification boundaries, and a clear statement that a lawyer owns all final decisions.

Primary buyer: a partner or operations lead at a small law firm doing recurring B2B contracts. Secondary buyer after proof: the legal-ops lead in an SME. Do not start with broad consumer legal advice.

## Acquisition experiment

Lead with one concrete demonstration:
- Start from a fictional, non-confidential client intake.
- Show the missing-information checklist before generating any clause.
- Generate a first draft with placeholders and assumptions.
- Review a sample agreement and produce a clause-by-clause risk register with proposed alternatives.
- Display the source ledger and explicitly flag any source not verified against an official publication.

Test ads and organic content around *less manual assembly, clearer missing facts, and a reviewable clause matrix*; do not claim guaranteed enforceability, perfect compliance, or that the product replaces a lawyer. Use synthetic examples in public demos. Do not upload real client contracts to unreviewed systems.

## 30-day proof plan

1. **Days 1–5: buyer discovery.** Interview 10 lawyers in the chosen contract niche. Ask for anonymized examples, current cycle time, recurring corrections, and what makes a draft acceptable. Do not treat interest as willingness to pay.
2. **Days 6–10: assisted prototype.** Complete one contract template and one review template with a lawyer. Build a reference set of statutes from official sources with retrieval dates and hashes. Test source-currency failures and missing information.
3. **Days 11–20: paid design partners.** Offer the assisted pilot only to offices that agree to explicit human-review and data-handling boundaries. Keep a human operator in the loop; log all corrections and source checks.
4. **Days 21–30: decide on scale.** Evaluate attorney acceptance, material correction rate, citation accuracy, time to a reviewable draft, repeat use, support effort, gross margin, and willingness to renew. Continue only if the evidence is positive.

## Technical roadmap and release gates

### Gate 1 — Marketplace pilot entry (implemented)
- Featured Leis Legal Desk card links the source repository.
- Three buttons prepare unsent Chat drafts: contract draft, agreement review, and legal research.
- Prompts require Brazilian Portuguese by default, jurisdiction/as-of-date intake, no invented citations, a source ledger, and lawyer review.
- The UI clearly states that live repository indexing and checkout are not enabled.

### Gate 2 — Source retrieval (not implemented)
- Build an index that respects repository coverage and preserves each source path, Git revision, source URL, text hash and retrieval timestamp.
- Resolve each legal claim to exact text and official source; separate official text from repository conversion.
- Detect OCR/source conflicts, missing files, superseded versions and stale index states. Unknown status must remain unknown, not be inferred.
- Evaluate retrieval on a fixed corpus of lawyer-reviewed questions before enabling citations in generated output.

### Gate 3 — Document workflow (not implemented)
- Add secure document ingestion, structured intake, clause library, DOCX output, side-by-side revisions, comments and a claim/source ledger.
- Add version history, reviewer identities, approval states, export and deletion controls.
- Require the reviewer to approve material clauses and source-dependent claims; a draft is not a signed/final instrument.

### Gate 4 — Commercial checkout and rollout (not implemented)
- Configure prices and entitlements only after the paid pilot design and safety gates are validated.
- Keep the Marketplace price explicitly labelled as experimental until billing, limits, refunds and cancellation behavior are implemented and tested.
- No production launch solely because the UI renders. Require end-to-end tests and a signed-off legal/data-security review.

## References

- Source repository: https://github.com/ctresb/leis
- Repository readme: https://github.com/ctresb/leis#readme
- Repository license: https://github.com/ctresb/leis/blob/main/LICENSE
- OAB Federal Council, public position on AI companies and legal practice (17 August 2026): https://www.oab.org.br/noticia/64465/oab-defende-advocacia-contra-empresas-de-ia-que-praticarem-atos-exclusivos-da-classe
