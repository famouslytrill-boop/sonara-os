# Container Development Environment

Docker/Moby-style containers may be documented for local development only. Local services should use explicit ports, local-only env files, and development data.

Never mount production secrets locally. Never run destructive production commands from local scripts. Safe cleanup commands must name local resources and avoid computed production paths. Reset commands require a local stack confirmation.
