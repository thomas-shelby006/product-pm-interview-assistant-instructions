# PM Interview Metrics Library — Source File

Purpose: provide fast metric trees for PM interview answers.

## Metric answer pattern

Goal → primary metric → 2–4 input metrics → 1–3 guardrails → segmentation.

Never invent numbers.

## Pemo — B2B fintech SaaS / SME spend management

Primary metric options:
- activated companies managing spend through Pemo
- companies reaching first meaningful value
- successful expense workflows completed
- monthly active companies completing spend workflows

Inputs:
- onboarding completion
- KYC/document success
- time to first card activation
- first transaction rate
- receipt upload rate
- expense submission completion
- approval completion
- accounting integration setup
- finance-admin dashboard usage

Guardrails:
- KYC failures
- suspicious activity
- blocked transactions
- incorrect receipt matching
- support tickets
- accounting export errors
- finance-team trust

Segments:
company size, industry, country, acquisition channel, onboarding step, KYC status, admin vs employee, card type, integration status.

## DataCaliper — B2B SaaS & enterprise workflow products

Use for:
- dashboards
- analytics
- ERP / NetSuite / Odoo-adjacent workflows
- vendor/contractor records
- payment/status tracking
- admin tools
- approvals
- role-based access
- reporting and exports
- workflow automation
- client-facing product delivery

Primary metric options:
- workflow completion rate
- reporting accuracy
- dashboard adoption / repeat dashboard usage
- manual effort reduced
- requirement rework reduced
- release quality
- client satisfaction
- bug volume / post-release defects
- support-ticket volume
- time to clarify requirements
- successful export/report generation
- user-role or permission setup success

Inputs:
- active dashboard users by role
- report/filter/export usage
- task completion rate
- approval completion
- record creation/update success
- payment/status update completion
- error rate in forms or workflows
- number of clarification cycles before development
- QA pass rate
- UAT feedback volume
- bug reopen rate
- client demo feedback closed

Guardrails:
- incorrect report totals
- stale data
- broken filters/exports
- duplicate records
- permission errors
- payment-status mismatch
- role-access issues
- workflow confusion
- excessive customization
- engineering rework
- low client adoption

Segments:
client, user role, workflow type, module, dashboard/report type, ERP integration, record status, approval status, release version, support-ticket category, internal vs client-facing user.

Good live answer:

> “For a DataCaliper-style B2B workflow product, I’d measure whether the released workflow reduces ambiguity and helps users complete the business process. The primary metric could be workflow completion or reporting accuracy. Inputs would include dashboard adoption, task completion, export usage, QA pass rate, and support tickets. Guardrails would be incorrect data, permission errors, broken reports, and excessive customization.”

## TPI — manufacturing operations and quality systems

Primary metric options:
- operational issues identified and resolved faster
- inspection completion
- defect-data completeness
- issue-resolution time
- production-blocker escalation time
- dashboard adoption
- manual reporting effort reduced

Guardrails:
- inaccurate issue records
- missed escalations
- extra reporting burden
- low shop-floor adoption
- data freshness issues

Segments:
shift, production line, defect category, inspection stage, issue severity, responsible team, rework status.

## Data analytics / dashboard products

Primary metric:
- trusted insight used for a decision

Inputs:
- repeat dashboard usage
- insight-to-action rate
- data freshness
- metric-definition usage
- report generation success
- export/share actions
- stakeholder feedback

Guardrails:
- stale data
- wrong metric definitions
- low trust
- unsupported decisions
- manual workarounds

## Workflow automation products

Primary metric:
- workflow completed faster or with fewer errors

Inputs:
- task completion
- time to complete
- manual steps removed
- error rate
- approval completion
- user adoption
- support requests

Guardrails:
- confusing automation
- incorrect state changes
- permission errors
- process exceptions
- hidden manual work

## Metric-drop diagnosis playbook

Default shape:
1. Confirm metric definition and data quality.
2. Check timeframe and baseline.
3. Segment the drop.
4. Locate the funnel/workflow step.
5. Generate hypotheses.
6. Prioritize validation.
7. Mitigate if user/business impact is high.

Live phrasing:

> “I’d first confirm whether the drop is real or caused by tracking, definition, or data freshness. Then I’d segment by user type, workflow step, cohort, product version, and acquisition or client source. After that, I’d inspect where the drop starts and check recent releases, operational dependencies, support tickets, and qualitative feedback.”

## Final metric check

Before answering a metric question, silently check:
1. What is the product goal?
2. What workflow is being improved?
3. What is the primary outcome metric?
4. What inputs explain that outcome?
5. What guardrails protect quality, trust, or operations?
6. What segmentation would reveal root cause?
7. Am I inventing numbers?


## AI/tech PM metrics update

Use these metrics when the question involves AI-enabled workflows, automation, analytics, Technical PM, APIs, integrations, or enterprise software.

AI-enabled workflow metrics:
- task completion rate
- automation acceptance rate
- manual correction rate
- false positive / false negative rate where relevant
- fallback or human-review rate
- time saved
- support tickets
- user trust / confidence
- repeat usage
- compliance or risk flags

Pemo AI/automation metrics:
- receipt capture success
- receipt matching accuracy
- transaction categorization accuracy
- approval completion
- policy exception rate
- anomaly/risk flag review rate
- manual finance follow-up reduced
- finance-admin trust

DataCaliper technical/product metrics:
- workflow completion
- dashboard adoption
- insight-to-action rate
- report accuracy
- data freshness
- integration success rate
- role/permission error rate
- QA defect volume
- requirement rework
- client satisfaction

TPI operational analytics metrics:
- inspection completion
- defect-data completeness
- escalation time
- corrective-action closure
- dashboard adoption
- reporting accuracy
- manual reporting effort reduced

Do not invent exact numbers. Use these as metric categories unless exact data is supplied.
