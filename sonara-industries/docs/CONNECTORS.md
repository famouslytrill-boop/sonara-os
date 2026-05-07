# Source Connectors

Connector policy:
- Use official APIs or RSS when available.
- Respect rate limits.
- Store source trust score and last successful import.
- Never auto-publish high-risk imported public alerts without approval.

NoticeGrid connectors:
- RSS/Atom
- Data.gov CKAN metadata
- GTFS-Realtime placeholder
- National Weather Service placeholder
- CSV/JSON upload import

TrackFoundry connectors:
- file upload intake
- audio/video metadata placeholder
- transcription queue placeholder
- optional bring-your-own provider keys later

LineReady connectors:
- external link registry for POS, payroll, vendors, health insurance, menus, delivery, repairs
- CSV imports for employees, schedules, vendors, and recipes
- QR link route scaffold
