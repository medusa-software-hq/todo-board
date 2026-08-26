# Web app infrastructure

The web app's Cloud Run service and its identity. It serves the built frontend and forwards `/api`
to this environment's API, whose URL it reads from the backend stack's state.

Applied by CI, per environment, after `backend/infra`.
