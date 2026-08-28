import { GoogleIdTokenMinter, type ServiceAccountKey } from './googleIdToken.ts';

/**
 * The edge in front of Todo Board.
 *
 * Round two: `/api` goes to the API service with a Google ID token, and everything else still goes
 * to the web app untouched. Nothing is checked yet — Cloud Run is still public, so a token that is
 * wrong costs nothing and can be found out about safely. Round three takes `allUsers` away, and
 * then this is the only way in.
 */

export interface Env {
  /** The web app. Set at deploy time from the service's own URL. */
  WEB_TARGET?: string | undefined;

  /** The API. Set at deploy time from the service's own URL. */
  API_TARGET?: string | undefined;

  /** A service account key, as JSON. Rotated daily; expires weekly. */
  GCP_SA_KEY?: string | undefined;
}

/** The prefix the page calls its own origin on, and which the API never sees. */
const apiPathPrefix = '/api';

/** What a caller is told when the origin could not answer. The reason is in the log, not here. */
function upstreamFailure(): Response {
  return new Response(JSON.stringify({ error: 'upstream' }), {
    status: 502,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Forwards [request] to [target], keeping the path, the query and the method.
 *
 * [pathPrefix] is removed on the way through, so the API sees the paths its contract describes
 * rather than the ones this origin publishes. [idToken], when given, is what makes the call
 * something Cloud Run will accept once it stops accepting everyone.
 */
async function forward(
  request: Request,
  target: string,
  options: { pathPrefix?: string | undefined; idToken?: string | undefined } = {},
): Promise<Response> {
  const url = new URL(request.url);
  const path = options.pathPrefix
    ? url.pathname.slice(options.pathPrefix.length) || '/'
    : url.pathname;
  const upstream = new URL(path + url.search, target);

  const headers = new Headers(request.headers);
  headers.set('host', upstream.host);

  if (options.idToken) {
    // Whatever the caller sent is not what the origin is told. Once this is the only way in, the
    // authorization header is the edge's own and nobody else's.
    headers.set('authorization', `Bearer ${options.idToken}`);
  }

  return fetch(
    new Request(upstream, {
      method: request.method,
      headers,
      body: request.body,
      redirect: 'manual',
    }),
  );
}

/**
 * Built once per isolate rather than per request, so the key is parsed and the token minted as
 * rarely as the platform allows.
 */
let minter: GoogleIdTokenMinter | undefined;

function minterFor(serviceAccountKeyJson: string): GoogleIdTokenMinter {
  minter ??= new GoogleIdTokenMinter(JSON.parse(serviceAccountKeyJson) as ServiceAccountKey);

  return minter;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Exactly `/api`, or something beneath it — never `/apifoo`.
    const isApi = url.pathname === apiPathPrefix || url.pathname.startsWith(`${apiPathPrefix}/`);

    try {
      if (isApi) {
        if (!env.API_TARGET || !env.GCP_SA_KEY) {
          console.error('API_TARGET or GCP_SA_KEY is not set');

          return upstreamFailure();
        }

        const idToken = await minterFor(env.GCP_SA_KEY).idTokenFor(env.API_TARGET);

        return await forward(request, env.API_TARGET, { pathPrefix: apiPathPrefix, idToken });
      }

      if (!env.WEB_TARGET) {
        console.error('WEB_TARGET is not set');

        return upstreamFailure();
      }

      return await forward(request, env.WEB_TARGET);
    } catch (cause) {
      console.error('forwarding failed', cause);

      return upstreamFailure();
    }
  },
};
