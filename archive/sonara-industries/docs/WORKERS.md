# Workers

Queues:
- `media_queue`
- `transcription_queue`
- `feed_import_queue`
- `alert_delivery_queue`
- `billing_queue`
- `backup_queue`
- `analytics_queue`

The worker is Redis/RQ-ready and included in Docker Compose. Jobs must be idempotent and risky actions must create approval records instead of publishing directly.

Sample jobs:
- uploaded media metadata
- transcription placeholder
- RSS import
- Data.gov metadata import
- GTFS-Realtime placeholder
- LineReady labor recalculation
- TrackFoundry readiness recalculation
- NoticeGrid delivery placeholder
