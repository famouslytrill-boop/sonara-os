# Docker Final Setup

Docker is optional for MVP if Vercel static hosting is enough.

Checklist:

- Add or verify `Dockerfile` only if self-hosting is selected.
- Add or verify `docker-compose.yml` for local stack support if used.
- Add `.dockerignore`.
- Add healthcheck behavior.
- Do not bake secrets into images.
- Do not pass secret values as public build args.
- Document local dev stack commands.
- Document production container strategy before using it.

If no container deployment is used, mark Docker as `skipped_for_mvp`, not failed.
