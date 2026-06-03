# Rancher Desktop Health Check

Checked with local Rancher Desktop and Kubernetes CLIs.

## Status

- `rdctl` available.
- Rancher Desktop client version: `v1.22.3`.
- Container engine: `moby`.
- Kubernetes is enabled in Rancher settings.
- Kubernetes node observed: `desktop-control-plane` ready.
- `kubectl` client available.
- `helm` available.
- `nerdctl` returned a containerd socket error for the default address.

## Project Need

SONARA production on Vercel does not require Rancher Desktop or Kubernetes. No Kubernetes workloads were added.

Use Rancher only if a separate local infrastructure or Kubernetes deployment plan is approved.
