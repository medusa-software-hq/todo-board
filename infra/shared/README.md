# Shared infrastructure

What every environment shares: the shared GCP project, the Artifact Registry repository images are
pushed to and pulled from, and the service account GitHub Actions federates into.

One registry and one CI/CD identity, deliberately. Promoting to production means deploying the image
staging already ran, which only means something if it is the same image; and which environment a
deploy may touch is decided by the grants `infra/main` makes per workspace, not by handing out a
second credential.

Applied once, before `infra/main` — which reads this stack's state.
