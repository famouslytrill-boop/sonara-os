# Grounded Retrieval and Media Isolation v1

Status: executable contract only. This slice does not activate a background consumer, install a third-party framework, call an external provider, publish customer media, or change production data.

## Why this exists

The September 19 research intake repeatedly pointed at the same two missing platform guarantees: retrieval must be tenant-scoped and measurable rather than merely "RAG-shaped", and Creator/Media work must run behind an explicit isolation boundary rather than inheriting arbitrary process authority.

The implementation is deliberately small and reuses `lib/sonara-platform-kernel.cjs` instead of adding a second orchestration system.

## Grounded retrieval

`lib/sonara-grounded-retrieval-contract.cjs` defines a retrieval request with mandatory organization, actor, workflow, correlation, and idempotency identity.

A grounded answer is considered ready only when:

- at least one allowed source was retrieved;
- every source belongs to the request organization;
- every source is of an allowed source type;
- at least one claim exists; and
- every claim is cited to a known retrieved source.

The evaluation evidence event stores counts, mode, a SHA-256 query fingerprint, and citation coverage. It deliberately does not copy the raw query, claim text, or source content into the operational event stream.

This is an execution/evaluation contract, not a choice of vector database, embedding model, reranker, or external RAG framework. Those remain adapters behind the existing Provider Gateway and tenant boundary.

## Media isolation

`lib/sonara-media-processing-contract.cjs` defines preview-only processing for image, audio, and video assets.

The plan is fail-closed around these invariants:

- input is read-only;
- output is a new private preview asset;
- source and output storage objects cannot be the same;
- network access is disabled;
- external provider calls are disabled;
- publishing is disabled;
- destructive writes are disabled;
- customer-data export is disabled; and
- worker activation remains disabled by default.

Supported v1 operations are inspection and reversible preview derivations: thumbnail, waveform, transcode preview, and audio-normalization preview.

## Relationship to Platform Foundation v1

Both contracts create the existing Platform Kernel execution envelope. They inherit organization, actor, workflow, idempotency, correlation, lifecycle, event, and authority semantics instead of inventing product-specific copies.

Grounded retrieval uses the existing self-serve `summarise_records` action. Media preview processing uses the existing self-serve `draft_content` action. Neither action publishes, sends, deletes, changes security, or moves money.

## Activation boundary

A future runtime adapter may execute these plans only after the existing release/security gates pass. Media workers must implement the isolation fields as runtime enforcement, not documentation. Retrieval adapters must enforce the request organization in every database/vector lookup and preserve the evaluation contract.

Background consumer activation, third-party installs, provider credentials, production migrations, and public media publication are separate reviewed changes.
