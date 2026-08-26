# The frontend is built here rather than copied in, so what is deployed is built from the
# repository rather than from whatever happened to be in someone's `dist`.
#
#   docker build -f web-app/Dockerfile .
#
# The build context is the repository root, because the contract the API client is generated from
# lives outside `web-app`.

FROM node:24-alpine AS frontend-builder

WORKDIR /app

# Dependencies first, so a change to the sources does not reinstall them.
COPY web-app/frontend/package.json web-app/frontend/yarn.lock web-app/frontend/.yarnrc.yml ./
COPY web-app/frontend/.yarn ./.yarn
RUN node .yarn/releases/yarn-4.14.1.cjs install --immutable

COPY web-app/frontend/ ./
COPY api/openapi/ /contract/

RUN node .yarn/releases/yarn-4.14.1.cjs openapi-ts -i /contract/todo-board.yaml -o src/gen \
    && node scripts/exempt-generated.mjs \
    && node .yarn/releases/yarn-4.14.1.cjs vite build

# Nothing of the build survives into the image that runs: the app is a directory of files and a
# server that forwards `/api`.
FROM caddy:2-alpine

COPY web-app/Caddyfile /etc/caddy/Caddyfile
COPY --from=frontend-builder /app/dist /srv
