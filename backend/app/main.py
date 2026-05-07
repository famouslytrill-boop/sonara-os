from __future__ import annotations

from datetime import datetime, timezone
from math import ceil
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import AnyHttpUrl, BaseModel, Field

app = FastAPI(title="SONARA Industries Operating API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

Status = Literal["excellent", "strong", "watch", "weak", "risky", "needs_review", "queued", "approved", "rejected"]
BrandScope = Literal["trackfoundry", "lineready", "noticegrid"]

RISKY_ACTIONS = {
    "public_notice_publishing",
    "mass_notifications",
    "billing_changes",
    "user_deletion",
    "role_escalation",
    "public_external_links",
    "public_civic_notices",
    "ai_generated_public_alerts",
    "payout_accounting_changes",
    "organization_data_export",
    "public_ai_claims",
    "qr_code_public_activation",
    "third_party_integration_activation",
}

APPROVAL_QUEUE: dict[str, dict] = {}

BRANDS = [
    {
        "key": "trackfoundry",
        "name": "TrackFoundry",
        "category": "Music creation and release-readiness software.",
        "tagline": "Build the artist. Shape the release.",
        "modules": ["Artist DNA", "Catalog Vault", "Release Desk", "Transcript Studio", "Prompt Foundry", "Market Pulse"],
        "warnings": ["Influence DNA only.", "No copying real artists.", "Commercial release still requires rights review."],
    },
    {
        "key": "lineready",
        "name": "LineReady",
        "category": "Restaurant operations and labor-control software.",
        "tagline": "Every shift ready.",
        "modules": ["Labor Control", "Schedule Grid", "Recipe Costing", "Crew Chat", "Vendor Links", "Compliance Board"],
        "warnings": ["External POS, payroll, and payment integrations are placeholders only.", "LineReady is not a payroll provider or payment processor."],
    },
    {
        "key": "noticegrid",
        "name": "NoticeGrid",
        "category": "Verified local information and public-notice software.",
        "tagline": "Local updates without the noise.",
        "modules": ["Verified Feeds", "Notice Builder", "Local Grid", "Organization Pages", "Weather + Transit Links", "Quiet Alerting"],
        "warnings": ["Not a government authority.", "Not voting, emergency dispatch, medical alert, or law-enforcement software."],
    },
]


class FormulaResponse(BaseModel):
    value: float
    score: float | None = None
    status: Status
    explanation: str
    inputs_used: dict
    recommended_next_step: str
    approval_required: bool = False


class ReadinessInput(BaseModel):
    completed_checks: int = Field(ge=0)
    total_checks: int = Field(gt=0)
    critical_blockers: int = Field(default=0, ge=0)
    asset_completeness: float = Field(ge=0, le=100)
    approval_completeness: float = Field(ge=0, le=100)


class BreakEvenInput(BaseModel):
    fixed_costs: float = Field(ge=0)
    price: float = Field(gt=0)
    variable_cost: float = Field(ge=0)


class TrackFoundryReadinessInput(BaseModel):
    identity_score: float = Field(ge=0, le=100)
    catalog_score: float = Field(ge=0, le=100)
    rights_placeholder_score: float = Field(ge=0, le=100)
    release_plan_score: float = Field(ge=0, le=100)
    approval_blockers: int = Field(default=0, ge=0)


class LaborCostInput(BaseModel):
    labor_cost: float = Field(ge=0)
    net_sales: float = Field(gt=0)


class MenuMarginInput(BaseModel):
    menu_price: float = Field(gt=0)
    food_cost: float = Field(ge=0)
    packaging_cost: float = Field(default=0, ge=0)


class ShiftPlacementInput(BaseModel):
    skill_match: float = Field(ge=0, le=100)
    availability_match: float = Field(ge=0, le=100)
    overtime_risk: float = Field(ge=0, le=100)
    certification_match: float = Field(ge=0, le=100)
    fairness_balance: float = Field(ge=0, le=100)


class AlertRiskInput(BaseModel):
    source_trust: float = Field(ge=0, le=100)
    public_impact: float = Field(ge=0, le=100)
    urgency: float = Field(ge=0, le=100)
    ambiguity: float = Field(ge=0, le=100)
    approval_missing: float = Field(default=0, ge=0, le=100)


class SourceTrustInput(BaseModel):
    verification_score: float = Field(ge=0, le=100)
    history_score: float = Field(ge=0, le=100)
    correction_rate: float = Field(ge=0, le=100)
    source_transparency: float = Field(ge=0, le=100)


class LinkInput(BaseModel):
    url: AnyHttpUrl
    organization_id: str = Field(min_length=1)
    brand_scope: BrandScope
    visibility: Literal["private", "organization", "public"] = "private"
    submitted_by_role: Literal["owner", "admin", "manager", "staff", "viewer", "public"] = "staff"


class BottleneckInput(BaseModel):
    waiting_items: int = Field(ge=0)
    average_age_hours: float = Field(ge=0)
    blocked_approvals: int = Field(ge=0)
    team_capacity: float = Field(gt=0)


class MoatInput(BaseModel):
    switching_costs: float = Field(ge=0, le=100)
    data_advantage: float = Field(ge=0, le=100)
    network_effects: float = Field(ge=0, le=100)
    brand_defensibility: float = Field(ge=0, le=100)
    workflow_integration: float = Field(ge=0, le=100)
    compliance_friction: float = Field(ge=0, le=100)


class ForecastConfidenceInput(BaseModel):
    data_history_days: int = Field(ge=0)
    sample_size: int = Field(ge=0)
    volatility: float = Field(ge=0, le=100)
    missing_fields: int = Field(ge=0)


class AutomationSafetyInput(BaseModel):
    user_role_risk: float = Field(ge=0, le=100)
    public_impact: float = Field(ge=0, le=100)
    reversibility: float = Field(ge=0, le=100)
    approval_present: bool = False
    auditability: float = Field(ge=0, le=100)


class ApprovalResponse(BaseModel):
    action_id: str
    status: Status
    message: str
    action: dict


def clamp(value: float, minimum: float = 0, maximum: float = 100) -> float:
    return max(minimum, min(maximum, value))


def weighted_score(items: list[tuple[float, float]]) -> float:
    total = sum(weight for _value, weight in items)
    return 0 if total == 0 else sum(value * weight for value, weight in items) / total


def status_for_score(score: float) -> Status:
    if score >= 85:
        return "excellent"
    if score >= 70:
        return "strong"
    if score >= 50:
        return "watch"
    return "weak"


def status_for_risk(score: float) -> Status:
    if score >= 70:
        return "risky"
    if score >= 40:
        return "needs_review"
    return "strong"


def formula(value: float, score: float | None, status: Status, explanation: str, inputs: BaseModel | dict, next_step: str, approval: bool = False) -> FormulaResponse:
    return FormulaResponse(
        value=round(value, 2),
        score=round(score, 2) if score is not None else None,
        status=status,
        explanation=explanation,
        inputs_used=inputs.model_dump(mode="json") if isinstance(inputs, BaseModel) else inputs,
        recommended_next_step=next_step,
        approval_required=approval,
    )


def queue_approval(action_type: str, payload: dict, risk_reason: str) -> ApprovalResponse:
    action_id = str(uuid4())
    record = {
        "id": action_id,
        "action_type": action_type,
        "risk_reason": risk_reason,
        "payload": payload,
        "status": "queued",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "note": "Risky actions are queued for human approval. The API does not execute them directly.",
    }
    APPROVAL_QUEUE[action_id] = record
    return ApprovalResponse(action_id=action_id, status="queued", message="Approval required before this action can proceed.", action=record)


@app.get("/health")
async def health():
    return {
        "status": "strong",
        "owner": "SONARA Industries",
        "tagline": "Independent systems. Shared infrastructure. Stronger markets.",
        "brands": [brand["key"] for brand in BRANDS],
        "ai_required": False,
        "request_ids_ready": True,
        "observability_optional": True,
    }


@app.get("/brands")
async def brands():
    return {
        "owner": "SONARA Industries",
        "positioning": "A technology holding company that owns independent software companies.",
        "shared_infrastructure": ["auth", "database", "billing", "audit logs", "approval queues", "link safety", "observability"],
        "brands": BRANDS,
    }


@app.post("/math/readiness", response_model=FormulaResponse)
async def math_readiness(input_data: ReadinessInput):
    completion = (input_data.completed_checks / input_data.total_checks) * 100
    score = clamp(weighted_score([(completion, 0.45), (input_data.asset_completeness, 0.30), (input_data.approval_completeness, 0.25)]) - input_data.critical_blockers * 15)
    return formula(score, score, status_for_score(score), "Readiness blends checklist completion, assets, approvals, and blocker penalties.", input_data, "Clear blockers before publishing or billing-sensitive actions.", input_data.critical_blockers > 0)


@app.post("/business/break-even", response_model=FormulaResponse)
async def business_break_even(input_data: BreakEvenInput):
    margin = input_data.price - input_data.variable_cost
    if margin <= 0:
        return formula(0, 0, "risky", "Break-even is blocked because contribution margin is zero or negative.", input_data, "Raise price, lower variable cost, or do not sell this offer yet.", True)
    units = ceil(input_data.fixed_costs / margin)
    return formula(units, None, "strong", "Break-even units equal fixed costs divided by contribution margin per unit.", input_data, "Validate whether the market can support this volume.")


@app.post("/trackfoundry/release-readiness", response_model=FormulaResponse)
async def trackfoundry_release_readiness(input_data: TrackFoundryReadinessInput):
    score = clamp(weighted_score([(input_data.identity_score, 0.25), (input_data.catalog_score, 0.25), (input_data.rights_placeholder_score, 0.25), (input_data.release_plan_score, 0.25)]) - input_data.approval_blockers * 12)
    return formula(score, score, "needs_review" if input_data.approval_blockers else status_for_score(score), "TrackFoundry readiness checks artist identity, catalog, rights placeholders, release plan, and approval blockers.", input_data, "Review rights, splits, and campaign assets before release export.", input_data.approval_blockers > 0)


@app.post("/lineready/labor-cost", response_model=FormulaResponse)
async def lineready_labor_cost(input_data: LaborCostInput):
    percentage = (input_data.labor_cost / input_data.net_sales) * 100
    score = clamp(100 - max(0, percentage - 25) * 4)
    return formula(percentage, score, "strong" if percentage <= 30 else "watch" if percentage <= 36 else "risky", "Labor cost percentage is labor cost divided by net sales. Targets vary by restaurant model.", input_data, "Review staffing levels, projected sales, and overtime before publishing the schedule.")


@app.post("/lineready/menu-margin", response_model=FormulaResponse)
async def lineready_menu_margin(input_data: MenuMarginInput):
    total_cost = input_data.food_cost + input_data.packaging_cost
    margin_percentage = ((input_data.menu_price - total_cost) / input_data.menu_price) * 100
    return formula(margin_percentage, clamp(margin_percentage), status_for_score(margin_percentage), "Menu margin is menu price minus food and packaging cost, expressed as a percentage of menu price.", input_data, "Reprice or adjust recipe cost when margin falls below target.")


@app.post("/lineready/shift-placement", response_model=FormulaResponse)
async def lineready_shift_placement(input_data: ShiftPlacementInput):
    score = clamp(weighted_score([(input_data.skill_match, 0.30), (input_data.availability_match, 0.25), (100 - input_data.overtime_risk, 0.20), (input_data.certification_match, 0.15), (input_data.fairness_balance, 0.10)]))
    return formula(score, score, status_for_score(score), "Shift placement balances skill, availability, overtime risk, certification fit, and fairness.", input_data, "Manager should review placements with low certification fit or high overtime risk.")


@app.post("/noticegrid/alert-risk", response_model=FormulaResponse)
async def noticegrid_alert_risk(input_data: AlertRiskInput):
    risk = clamp(weighted_score([(100 - input_data.source_trust, 0.30), (input_data.public_impact, 0.25), (input_data.urgency, 0.15), (input_data.ambiguity, 0.20), (input_data.approval_missing, 0.10)]))
    return formula(risk, risk, status_for_risk(risk), "Alert risk rises when trust is low, public impact is high, language is ambiguous, urgency is high, or approval is missing.", input_data, "Queue public notices and alerts for approval before publishing.", risk >= 40)


@app.post("/noticegrid/source-trust", response_model=FormulaResponse)
async def noticegrid_source_trust(input_data: SourceTrustInput):
    score = clamp(weighted_score([(input_data.verification_score, 0.35), (input_data.history_score, 0.25), (100 - input_data.correction_rate, 0.20), (input_data.source_transparency, 0.20)]))
    return formula(score, score, status_for_score(score), "Source trust blends verification, source history, correction rate, and transparency.", input_data, "Re-check sources below strong confidence before public notices rely on them.")


@app.post("/links")
async def create_external_link(input_data: LinkInput):
    payload = input_data.model_dump(mode="json")
    if input_data.visibility == "public" or input_data.submitted_by_role in {"viewer", "public"}:
        return queue_approval("public_external_links", payload, "Public links and public-role submissions require human approval.")
    return {"status": "strong", "message": "Private or organization-scoped link accepted. Public links require approval.", "link": payload}


@app.get("/approvals")
async def approvals():
    return {"status": "strong", "count": len(APPROVAL_QUEUE), "items": list(APPROVAL_QUEUE.values())}


@app.post("/approvals/{action_id}/approve", response_model=ApprovalResponse)
async def approve_action(action_id: str):
    action = APPROVAL_QUEUE.get(action_id)
    if not action:
        return ApprovalResponse(action_id=action_id, status="needs_review", message="No queued approval was found for this action.", action={"id": action_id})
    action["status"] = "approved"
    action["approved_at"] = datetime.now(timezone.utc).isoformat()
    return ApprovalResponse(action_id=action_id, status="approved", message="Action approved for the next workflow step. Approval does not auto-execute risky automation.", action=action)


@app.post("/approvals/{action_id}/reject", response_model=ApprovalResponse)
async def reject_action(action_id: str):
    action = APPROVAL_QUEUE.get(action_id)
    if not action:
        return ApprovalResponse(action_id=action_id, status="needs_review", message="No queued approval was found for this action.", action={"id": action_id})
    action["status"] = "rejected"
    action["rejected_at"] = datetime.now(timezone.utc).isoformat()
    return ApprovalResponse(action_id=action_id, status="rejected", message="Action rejected. No risky automation was executed.", action=action)


@app.post("/operating-intelligence/bottleneck", response_model=FormulaResponse)
async def operating_bottleneck(input_data: BottleneckInput):
    pressure = ((input_data.waiting_items + input_data.blocked_approvals * 2) / input_data.team_capacity) * 45
    age_pressure = min(40, input_data.average_age_hours / 2)
    score = clamp(pressure + age_pressure)
    return formula(score, score, status_for_risk(score), "Bottleneck score rises with waiting work, blocked approvals, item age, and limited capacity.", input_data, "Clear oldest blocked approvals before adding more automation.")


@app.post("/operating-intelligence/moat-score", response_model=FormulaResponse)
async def operating_moat_score(input_data: MoatInput):
    score = clamp(weighted_score([(input_data.switching_costs, 0.18), (input_data.data_advantage, 0.18), (input_data.network_effects, 0.14), (input_data.brand_defensibility, 0.16), (input_data.workflow_integration, 0.24), (input_data.compliance_friction, 0.10)]))
    return formula(score, score, status_for_score(score), "Moat score estimates defensibility from switching costs, data advantage, network effects, brand defensibility, workflow integration, and compliance friction.", input_data, "Deepen workflow value before relying on brand or distribution alone.")


@app.post("/operating-intelligence/forecast-confidence", response_model=FormulaResponse)
async def operating_forecast_confidence(input_data: ForecastConfidenceInput):
    score = clamp(weighted_score([(clamp((input_data.data_history_days / 90) * 100), 0.30), (clamp((input_data.sample_size / 100) * 100), 0.30), (100 - input_data.volatility, 0.25), (100 - input_data.missing_fields * 12, 0.15)]))
    return formula(score, score, status_for_score(score), "Forecast confidence increases with history and sample size, and decreases with volatility and missing fields. It is not a guarantee.", input_data, "Mark low-confidence projections as directional and keep human review.")


@app.post("/operating-intelligence/automation-safety", response_model=FormulaResponse)
async def operating_automation_safety(input_data: AutomationSafetyInput):
    risk = clamp(weighted_score([(input_data.user_role_risk, 0.20), (input_data.public_impact, 0.25), (100 - input_data.reversibility, 0.25), (0 if input_data.approval_present else 100, 0.20), (100 - input_data.auditability, 0.10)]))
    return formula(risk, 100 - risk, status_for_risk(risk), "Automation safety scores role risk, public impact, reversibility, approval presence, and auditability.", input_data, "Queue risky automation for approval and audit the result.", risk >= 40)
