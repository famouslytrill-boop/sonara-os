import Link from "next/link";
import type { ReactNode } from "react";
import type { EntityConfig } from "../../lib/entities/config";
import { createEntityHeartbeatSummary } from "../../lib/entities/operations";
import { EntityBrowserWorkspace } from "./EntityBrowserWorkspace";
import { VoicePromptInput } from "./VoicePromptInput";

function SetupBadge({ label = "setup_required" }: { label?: string }) {
  return (
    <span className="inline-flex rounded-full border border-[#FFB454]/40 bg-[#FFB454]/10 px-2.5 py-1 text-xs font-black text-[#FFDA9A]">
      {label}
    </span>
  );
}

function Panel({ title, body, children }: { title: string; body?: string; children?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#332A40] bg-[#191522] p-5">
      <h2 className="text-xl font-black text-white">{title}</h2>
      {body ? <p className="mt-2 text-sm leading-6 text-[#C4BFD0]">{body}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

export function EntityBrowserView({ entity }: { entity: EntityConfig }) {
  return <EntityBrowserWorkspace entity={entity} />;
}

export function EntityBookmarksView({ entity }: { entity: EntityConfig }) {
  return (
    <Panel
      title="Entity Bookmarks"
      body="Bookmarks are scoped to this entity. Live persistence requires Supabase migration 008 and authenticated membership."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {entity.connectors.map((connector) => (
          <div key={connector.name} className="rounded-xl border border-[#332A40] bg-[#121018] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold text-white">{connector.name}</p>
              <SetupBadge />
            </div>
            <p className="mt-2 text-sm text-[#C4BFD0]">Use the browser workspace to validate source URLs before saving.</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function EntityNotesView() {
  return (
    <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <VoicePromptInput label="Research note" placeholder="Capture source-linked research notes for this entity." />
      <Panel
        title="Notes Policy"
        body="Research notes should stay source-linked, non-secret, and entity-scoped. Do not store login credentials, private tokens, or sensitive personal data in notes."
      />
    </div>
  );
}

export function EntityHeartbeatView({ entity }: { entity: EntityConfig }) {
  const heartbeat = createEntityHeartbeatSummary(entity);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel title="Health Score">
        <p className="text-5xl font-black text-white">{heartbeat.healthScore}</p>
        <p className="mt-2 text-sm font-bold text-[#C4BFD0]">{heartbeat.status}</p>
        <p className="mt-2 text-xs text-[#8F879C]">Last local check: {new Date(heartbeat.checkedAt).toLocaleString()}</p>
      </Panel>
      <Panel title="Heartbeat Types">
        <div className="flex flex-wrap gap-2">
          {entity.heartbeatTypes.map((type) => (
            <span key={type} className="rounded-full border border-[#332A40] bg-[#121018] px-3 py-1 text-xs font-bold text-[#C4BFD0]">
              {type}
            </span>
          ))}
        </div>
      </Panel>
      <Panel title="Blockers">
        <ul className="space-y-2 text-sm text-[#C4BFD0]">
          {heartbeat.blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

export function EntityActionsView({ entity }: { entity: EntityConfig }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <Panel title="Proactive Actions" body="Actions are recommendations and task records. High-risk or destructive work requires human approval.">
        <div className="space-y-3">
          {entity.proactiveActions.map((action) => (
            <div key={action.title} className="rounded-xl border border-[#332A40] bg-[#121018] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-white">{action.title}</p>
                <span className="rounded-full bg-[#211B2D] px-3 py-1 text-xs font-black text-[#C4BFD0]">{action.priority}</span>
              </div>
              <p className="mt-2 text-sm text-[#C4BFD0]">
                {action.actionType} · {action.requiresApproval ? "requires human approval" : "safe local action"}
              </p>
            </div>
          ))}
        </div>
      </Panel>
      <VoicePromptInput label="Action note" placeholder="Draft a proposed action or approval note." />
    </div>
  );
}

export function EntityAgentsView({ entity }: { entity: EntityConfig }) {
  return (
    <Panel
      title="Agent Operations"
      body="This registry is agent-ready. External runtimes, MCP servers, background queues, desktop control, and provider credentials are setup_required until configured and approved."
    >
      <div className="grid gap-3 md:grid-cols-3">
        {entity.tools.map((tool) => (
          <div key={tool.name} className="rounded-xl border border-[#332A40] bg-[#121018] p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-bold text-white">{tool.name}</p>
              <SetupBadge label={tool.status} />
            </div>
            <p className="mt-2 text-sm text-[#C4BFD0]">{tool.type}</p>
            <p className="mt-2 text-xs text-[#8F879C]">{tool.requiresApproval ? "Approval required for risky actions." : "Read-only or draft-only by default."}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function EntityAutomationsView({ entity }: { entity: EntityConfig }) {
  const triggers = ["manual", "schedule", "heartbeat_warning", "incident_created", "new_browser_note", "payment_event"];
  return (
    <Panel
      title="Automation Queue"
      body="Automation definitions are ready for worker or cron integration. Destructive or public-facing actions stay approval-gated."
    >
      <div className="grid gap-3 md:grid-cols-2">
        {triggers.map((trigger) => (
          <div key={trigger} className="rounded-xl border border-[#332A40] bg-[#121018] p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold text-white">{trigger}</p>
              <SetupBadge />
            </div>
            <p className="mt-2 text-sm text-[#C4BFD0]">{entity.shortName} automation trigger placeholder.</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function EntityConnectorsView({ entity }: { entity: EntityConfig }) {
  return (
    <Panel title="Connectors + MCP" body="No connector is live until credentials are configured in secret storage and the integration is reviewed.">
      <div className="grid gap-3 md:grid-cols-3">
        {entity.connectors.map((connector) => (
          <div key={connector.name} className="rounded-xl border border-[#332A40] bg-[#121018] p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-bold text-white">{connector.name}</p>
              <SetupBadge label={connector.status} />
            </div>
            <p className="mt-2 text-sm text-[#C4BFD0]">{connector.type}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function VisualReviewView() {
  const pages = ["/", "/dashboard/entities", "/dashboard/entities/parent-company", "/dashboard/entities/creator-music-technology/browser"];
  return (
    <Panel title="Visual Review Checklist" body="Use this page to verify app shell, entity navigation, mobile layout, and setup-required labels.">
      <div className="grid gap-3 sm:grid-cols-2">
        {pages.map((page) => (
          <Link key={page} href={page} className="rounded-xl border border-[#332A40] bg-[#121018] p-4 font-bold text-white hover:border-[#2DD4BF]">
            {page}
          </Link>
        ))}
      </div>
    </Panel>
  );
}
