# Docker Live Path

Docker is a local/dev/self-host path unless a production hosting plan is approved.

## Checklist

- Dockerfile exists before self-hosting.
- `.dockerignore` prevents secrets and build artifacts from leaking.
- Healthcheck documented.
- No secrets baked into images.
- Build args do not leak secrets.
- Container rollback plan exists.

## MVP Position

Docker is optional for production launch if Vercel is the chosen host.
