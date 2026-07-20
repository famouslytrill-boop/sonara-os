# Production health endpoint

The canonical unauthenticated production health endpoint is:

- `GET /api/health`

A healthy response returns HTTP 200 with `ok: true`, the application identifier, runtime, deployment commit SHA, branch, environment, and timestamp.

`/health` is not part of the current Express production contract. Production connectivity and release verification must use `/api/health` and compare `deployment.commitSha` with the expected `main` commit.

This document exists to prevent monitoring configuration from regressing to the obsolete `/health` path.
