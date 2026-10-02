# SONARA domain vocabulary

SONARA Industries is the parent company. SONARA One is the shared application platform. Business Builder, Creator Studio and Growth Studio are the three product workspaces; shared identity, billing and storage do not erase their individual purposes.

**Creator Project**: private, organization-scoped creative work connecting owned source assets, timeline clips and explicit timed captions. Its positive revision controls concurrent edits. A project export is a portable description or caption file; it is not rendered media, publication, rights clearance or proof of file duration.

**Source**: reference to an existing workspace asset plus a user-declared duration. It introduces no new storage or permission.

**Clip**: part of a source placed at a timeline position, with an explicit mute setting. Its source must exist in the same project.

**Caption**: creator-entered text with start and end times on the project timeline. It is not an automatically inferred transcript.

**Device Draft**: a validated Creator Project snapshot edited in an already-open browser page. Its original workspace revision is preserved. Device persistence is an explicit action, scoped to the captured user, organization and project, with a separate local revision to detect competing tabs. Saving to the workspace rechecks the current identity, subscription, source permissions and project revision. A local draft contains references and text, not copies of source media or provider credentials.

See `docs/architecture/CREATOR_PROJECT_GRAPH_V1.md` for the implementation, source research, routes, limitations and remaining work.
