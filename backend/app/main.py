from __future__ import annotations

from datetime import datetime, timezone
from math import ceil
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI
from prometheus_client import make_asgi_app
from pydantic import AnyHttpUrl, BaseModel, Field

from app.api.ai import router as ai_router
from app.api.evolution import router as evolution_router
from app.api.navigation import router as navigation_router
from app.api.system import router as system_router
from app.core.license_firewall import APPROVED_TECH, LicenseFirewall

app = FastAPI(title="SONARA Industries API", version="28.0.0")
app.include_router(evolution_router)
app.include_router(navigation_router)
app.include_router(ai_router)
app.include_router(system_router)
app.mount("/metrics", make_asgi_app())

Status = Literal["low", "healthy", "watch", "high", "blocked", "queued", "approved"]

RISKY_ACTIONS = {
    "public_notice_publishing",
    "mass_notifications",
    "billing_changes",
    "user_deletion",
    "role_escalation",
    "public_external_links",
    "public_civic_notices",
    "ai_generated_public_alerts",
}

APPROVAL_QUEUE: dict[str, dict] = {}

BRANDS = [
    {
        "key": "trackfoundry",
        "name": "TrackFoundry",
        "category": "Music creation and release-readiness software.",
        "tagline": "Build the artist. Shape the release.",
        "modules": ["Artist DNA", "Catalog Vault", "Release Desk", "Transcript Studio", "Prompt Foundry", "Market Pulse"],
    },
    {
        "key": "lineready",
        "name": "LineReady",
        "category": "Restaurant operations and labor-control software.",
        "tagline": "Every shift ready.",
        "modules": ["Labor Control", "Schedule Grid", "Recipe Costing", "Crew Chat", "Vendor Links", "Compliance Board"],
    },
    {
        "key": "noticegrid",
        "name": "NoticeGrid",
        "category": "Verified local information and public-notice software.",
        "tagline": "Local updates without the noise.",
        "modules": ["Verified Feeds", "Notice Builder", "Local Grid", "Organization Pages", "Weather + Transit Links", "Quiet Alerting"],
    },
]


class FormulaResponse(BaseModel):
    value: float
    score: float | None = None
    status: Status
    explanation: str
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
    asset_score: float = Field(ge=0, le=100)
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


class AlertRiskInput(BaseModel):
    source_trust: float = Field(ge=0, le=100)
    public_impact: float = Field(ge=0, le=100)
    urgency: float = Field(ge=0, le=100)
    ambiguity: float = Field(ge=0, le=100)
    approval_missing: float = Field(default=0, ge=0, le=100)


class LinkInput(BaseModel):
    url: AnyHttpUrl
    organization_id: str = Field(min_length=1)
    brand_scope: Literal["trackfoundry", "lineready", "noticegrid"]
    visibility: Literal["private", "organization", "public"] = "private"
    submitted_by_role: Literal["owner", "admin", "manager", "staff", "viewer", "public"] = "staff"


class ApprovalResponse(BaseModel):
    action_id: str
    status: Status
    message: str
    action: dict


def clamp(value: float, minimum: float = 0, maximum: float = 100) -> float:
    return max(minimum, min(maximum, value))


def weighted_score(items: list[tuple[float, float]]) -> float:
    total = sum(weight for _value, weight in items)
    if total == 0:
        return 0
    return sum(value * weight for value, weight in items) / total


def status_for_score(score: float) -> Status:
    if score >= 80:
        return "healthy"
    if score >= 60:
        return "watch"
    return "low"


def queue_approval(action_type: str, payload: dict) -> ApprovalResponse:
    action_id = str(uuid4())
    record = {
        "id": action_id,
        "action_type": action_type,
        "payload": payload,
        "status": "queued",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "note": "Risky actions are queued for human approval. The API does not execute them directly.",
    }
    APPROVAL_QUEUE[action_id] = record
    return ApprovalResponse(
        action_id=action_id,
        status="queued",
        message="Approval required before this action can proceed.",
        action=record,
    )


@app.get("/health")
async def health():
    firewall = LicenseFirewall()
    return {
        "status": "online",
        "owner": "SONARA Industries",
        "version": "v28",
        "approved_tech_count": len([tech for tech in APPROVED_TECH if firewall.can_ship(tech)]),
        "brands": [brand["key"] for brand in BRANDS],
        "ai_required": False,
    }


@app.get("/ready")
async def ready():
    return {"status": "ready", "required_systems": ["brands", "formulas", "approvals", "exports", "payments_placeholder"]}


@app.get("/live")
async def live():
    return {"status": "live"}


@app.get("/brands")
async def brands():
    return {
        "owner": "SONARA Industries",
        "positioning": "A technology holding company that owns independent software companies.",
        "tagline": "Independent systems. Shared infrastructure. Stronger markets.",
        "brands": BRANDS,
    }


@app.post("/math/readiness", response_model=FormulaResponse)
async def math_readiness(input_data: ReadinessInput):
    completion = (input_data.completed_checks / input_data.total_checks) * 100
    score = clamp(
        weighted_score(
            [
                (completion, 0.45),
                (input_data.asset_completeness, 0.30),
                (input_data.approval_completeness, 0.25),
            ]
        )
        - input_data.critical_blockers * 15
    )
    return FormulaResponse(
        value=round(score, 2),
        score=round(score, 2),
        status="blocked" if input_data.critical_blockers and score < 60 else status_for_score(score),
        explanation="Readiness blends completed checks, asset completeness, approval completeness, and critical blocker penalties.",
    )


@app.post("/business/break-even", response_model=FormulaResponse)
async def business_break_even(input_data: BreakEvenInput):
    margin = input_data.price - input_data.variable_cost
    if margin <= 0:
        return FormulaResponse(value=0, status="blocked", explanation="Break-even is blocked because contribution margin is zero or negative.")
    units = ceil(input_data.fixed_costs / margin)
    return FormulaResponse(value=units, status="healthy", explanation="Break-even units equal fixed costs divided by contribution margin per unit.")


@app.post("/trackfoundry/release-readiness", response_model=FormulaResponse)
async def trackfoundry_release_readiness(input_data: TrackFoundryReadinessInput):
    score = clamp(
        weighted_score(
            [
                (input_data.identity_score, 0.25),
                (input_data.asset_score, 0.25),
                (input_data.rights_placeholder_score, 0.25),
                (input_data.release_plan_score, 0.25),
            ]
        )
        - input_data.approval_blockers * 12
    )
    return FormulaResponse(
        value=round(score, 2),
        score=round(score, 2),
        status="blocked" if input_data.approval_blockers and score < 65 else status_for_score(score),
        explanation="TrackFoundry readiness checks artist identity, assets, rights placeholders, release plan, and approval blockers.",
        approval_required=input_data.approval_blockers > 0,
    )


@app.post("/lineready/labor-cost", response_model=FormulaResponse)
async def lineready_labor_cost(input_data: LaborCostInput):
    percentage = (input_data.labor_cost / input_data.net_sales) * 100
    return FormulaResponse(
        value=round(percentage, 2),
        score=round(clamp(100 - max(0, percentage - 25) * 4), 2),
        status="healthy" if percentage <= 30 else "watch" if percentage <= 36 else "high",
        explanation="Labor cost percentage is labor cost divided by net sales. Targets vary by restaurant model.",
    )


@app.post("/lineready/menu-margin", response_model=FormulaResponse)
async def lineready_menu_margin(input_data: MenuMarginInput):
    total_cost = input_data.food_cost + input_data.packaging_cost
    margin_percentage = ((input_data.menu_price - total_cost) / input_data.menu_price) * 100
    return FormulaResponse(
        value=round(margin_percentage, 2),
        score=round(clamp(margin_percentage), 2),
        status="healthy" if margin_percentage >= 65 else "watch" if margin_percentage >= 50 else "low",
        explanation="Menu margin is menu price minus food and packaging cost, expressed as a percentage of menu price.",
    )


@app.post("/noticegrid/alert-risk", response_model=FormulaResponse)
async def noticegrid_alert_risk(input_data: AlertRiskInput):
    risk = clamp(
        weighted_score(
            [
                (100 - input_data.source_trust, 0.30),
                (input_data.public_impact, 0.25),
                (input_data.urgency, 0.15),
                (input_data.ambiguity, 0.20),
                (input_data.approval_missing, 0.10),
            ]
        )
    )
    return FormulaResponse(
        value=round(risk, 2),
        score=round(risk, 2),
        status="high" if risk >= 70 else "watch" if risk >= 40 else "healthy",
        explanation="Alert risk rises when trust is low, public impact is high, ambiguity is high, urgency is high, or approval is missing.",
        approval_required=risk >= 40,
    )


@app.post("/links")
async def create_external_link(input_data: LinkInput):
    payload = input_data.model_dump(mode="json")
    if input_data.visibility == "public":
        return queue_approval("public_external_links", payload)
    return {
        "status": "accepted",
        "message": "Private or organization-scoped link accepted. Public links require approval.",
        "link": payload,
    }


@app.post("/approvals/{action_id}/approve", response_model=ApprovalResponse)
async def approve_action(action_id: str):
    action = APPROVAL_QUEUE.get(action_id)
    if not action:
        return ApprovalResponse(
            action_id=action_id,
            status="blocked",
            message="No queued approval was found for this action.",
            action={"id": action_id},
        )
    action["status"] = "approved"
    action["approved_at"] = datetime.now(timezone.utc).isoformat()
    return ApprovalResponse(
        action_id=action_id,
        status="approved",
        message="Action approved for the next workflow step. Approval does not auto-execute risky automation.",
        action=action,
    )
