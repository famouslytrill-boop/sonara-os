# SONARA Open Source Software Catalog

This catalog tracks open-source software mentioned during SONARA planning. It does not automatically install or activate every tool. That would be dependency soup, and soup is not infrastructure.

## Purpose

The catalog lets SONARA track tools by:

- category
- product area
- use case
- integration mode
- maturity status
- risk level
- license review status
- security review status

## Database migration

```text
supabase/migrations/017_open_source_software_catalog.sql
```

Adds:

- `open_source_software_catalog`
- `open_source_software_capabilities`
- `open_source_adapter_runs`

## Product areas

- `business_builder`
- `creator_studio`
- `growth_studio`
- `all`

## Integration modes

- `dependency`: safe to consider as a package/library after review
- `service`: should run as a separate service or worker
- `adapter_candidate`: should be represented by an adapter before implementation
- `manual_export`: first version should support manual import/export
- `self_hosted`: requires hosting, monitoring, backups, and security operations
- `external_api`: depends on external terms and rate limits
- `research_only`: do not ship as user-facing production feature yet
- `disabled`: intentionally unavailable

## Major tool groups included

### Core infrastructure

FastAPI, PostgreSQL, pgvector, PostGIS, Supabase, Docker, Kubernetes, K3s, Helm, Argo CD, OpenTofu, Terraform, Ansible, Coolify, Proxmox VE, Talos Linux, Nginx, Caddy, cert-manager.

### Security and identity

Keycloak, Authentik, Open Policy Agent, Casbin, Vault, OpenBao, SOPS, Trivy, Falco, Wazuh, Sigstore/Cosign.

### Search, analytics, observability

OpenSearch, Meilisearch, Typesense, Qdrant, Milvus, Weaviate, Chroma, Faiss, ClickHouse, DuckDB, Polars, Apache Arrow, PostHog, Matomo, Metabase, OpenTelemetry, Prometheus, Grafana, Loki, Tempo, Uptime Kuma.

### Creator Studio music/audio/media

Essentia, librosa, Demucs, Basic Pitch, music21, LilyPond, OpenL3, Chromaprint, Mutagen, FFmpeg, OBS Studio, whisper.cpp, faster-whisper, Vosk, MeloTTS, PaddleSpeech, beets, LiveKit, Jitsi, PeerTube, Owncast, Icecast, AzuraCast, LibreTime, MediaMTX, OvenMediaEngine.

### Business Builder documents, operations, commerce

PaddleOCR, Tesseract, docTR, pdfplumber, Camelot, Unstructured, invoice2data, Marker, MinerU, Odoo, Medusa, Saleor, Vendure, ZXing, html5-qrcode, QRCode.js.

### Growth Studio, automation, civic/data

Flowise, n8n, Activepieces, Temporal, Apache Airflow, Argo Workflows, Ray, Optuna, MLflow, DVC, Ollama, Open WebUI, vLLM, ONNX Runtime, PyTorch, JAX, scikit-learn, XGBoost, LightGBM, CatBoost, OR-Tools, SciPy, CVXPY, NetworkX, NocoDB, CKAN, Scrapy, Playwright, OpenStreetMap, GTFS, Open311, Decidim, Consul Democracy.

### Research-only / deferred candidates

NVIDIA Cosmos, Domoticz, CockroachDB, Chef, and other heavier systems are tracked as candidates only. They are not production dependencies.

## Rules

1. Do not install everything.
2. Do not expose admin-only tooling to customers.
3. Do not run heavy AI/audio/OCR tools inside the Express web server.
4. Use worker services for expensive jobs.
5. Review licenses before activation.
6. Review security before activation.
7. Review operating cost before activation.
8. Do not label a tool connected unless it has a real adapter or working integration.
9. Do not build fake buttons for cataloged tools.
10. Prefer simple manual export first when direct integration is risky.

## Suggested UI

Admin page:

```text
/admin/open-source-software
```

Public language:

- Software Library
- Available Tools
- Under Review
- Connected
- Manual Export
- Research Only
- Disabled

Avoid showing normal users terms like dependency, RLS, adapter runtime, or service mesh. They did not wake up asking for Kubernetes vocabulary trauma.

## Next source-code routes

- `GET /admin/open-source-software`
- `GET /api/open-source-software`
- `GET /api/open-source-software/capabilities`
- `POST /api/open-source-software/adapter-runs`
- `GET /api/open-source-software/readiness`

## Definition of done

The catalog is working when admin can see tools grouped by product area, status, and risk level, and can clearly tell which tools are active, planned, research-only, or blocked.

No tool should become user-facing until a real adapter, route, worker, or manual export workflow exists.
