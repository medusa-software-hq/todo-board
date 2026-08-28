# Web app infrastructure

The web app's Cloud Run service and its identity. It serves the built frontend and nothing else —
`/api` is split off by the edge Worker and never arrives here, so this stack no longer needs to know
where the API is.

Applied by CI, per environment.
