import { GoogleIdTokenMinter, type ServiceAccountKey } from './googleIdToken.ts';
import { GoogleUserTokenVerifier } from './googleUserToken.ts';
import { panic } from './panic.ts';

/**
 * The edge in front of Todo Board.
 *
 * `/api` is for people this organization knows: the caller proves it with a Google ID token, and
 * the edge proves itself to Cloud Run with one of its own. Everything else is the app's own files,
 * which anyone may have — there is no signing in without the page that asks you to.
 *
 * The checking happens here rather than behind Cloud Run because this is the cheap side of the
 * wall. A request with no credential is answered by a Worker and never becomes a container.
 */

export interface Env {
  /** The web app. Set at deploy time from the service's own URL. */
  WEB_TARGET?: string | undefined;

  /** The API. Set at deploy time from the service's own URL. */
  API_TARGET?: string | undefined;

  /** A service account key, as JSON. Rotated daily; expires weekly. */
  GCP_SA_KEY?: string | undefined;

  /** The OAuth client the app signs people in with, and the audience their tokens must name. */
  GOOGLE_CLIENT_ID?: string | undefined;

  /** The only hosted domain whose people are let in. */
  GOOGLE_ALLOWED_DOMAIN?: string | undefined;
}

/** The prefix the page calls its own origin on, and which the API never sees. */
const apiPathPrefix = '/api';

/**
 * What a caller is told when they presented nothing. RFC 6750 §3.1: a bare challenge, with no error
 * code, because nothing was wrong with a credential that was never offered.
 */
function missingCredential(): Response {
  return new Response(null, { status: 401, headers: { 'www-authenticate': 'Bearer' } });
}

/**
 * What a caller is told when they presented something and it was not good enough. One answer for
 * every way of failing: which check it failed is ours to know and would only help them guess.
 */
function invalidToken(): Response {
  return new Response(null, {
    status: 401,
    headers: { 'www-authenticate': 'Bearer error="invalid_token"' },
  });
}

/** The bearer token [request] carries, or `null` if it carries none worth looking at. */
function bearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  const prefix = 'Bearer ';

  if (authorization === null || !authorization.startsWith(prefix)) {
    return null;
  }

  return authorization.slice(prefix.length) || null;
}

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

/** Kept for the same reason, and holding the same kind of thing: Google's keys, once fetched. */
let verifier: GoogleUserTokenVerifier | undefined;

function verifierFor(clientId: string, hostedDomain: string): GoogleUserTokenVerifier {
  verifier ??= new GoogleUserTokenVerifier(clientId, hostedDomain);

  return verifier;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Everything the deploy was supposed to supply, taken once and before anything else. A Worker
    // missing any of it is misconfigured whichever path a request happens to take, and finding that
    // out on the first request is better than finding it out on the first request of one kind.
    const webTarget = env.WEB_TARGET ?? panic('WEB_TARGET is not set');
    const apiTarget = env.API_TARGET ?? panic('API_TARGET is not set');
    const serviceAccountKey = env.GCP_SA_KEY ?? panic('GCP_SA_KEY is not set');
    const clientId = env.GOOGLE_CLIENT_ID ?? panic('GOOGLE_CLIENT_ID is not set');
    const allowedDomain = env.GOOGLE_ALLOWED_DOMAIN ?? panic('GOOGLE_ALLOWED_DOMAIN is not set');

    const url = new URL(request.url);

    // Exactly `/api`, or something beneath it — never `/apifoo`.
    const isApi = url.pathname === apiPathPrefix || url.pathname.startsWith(`${apiPathPrefix}/`);

    try {
      if (isApi) {
        const presented = bearerToken(request);

        if (presented === null) {
          return missingCredential();
        }

        // Nothing has been spent on this request yet, and if the token is no good nothing will be.
        const user = await verifierFor(clientId, allowedDomain).verify(presented);

        if (user === null) {
          return invalidToken();
        }

        const idToken = await minterFor(serviceAccountKey).idTokenFor(apiTarget);

        return await forward(request, apiTarget, { pathPrefix: apiPathPrefix, idToken });
      }

      return await forward(request, webTarget);
    } catch (cause) {
      // Only an origin that would not answer reaches here. A deploy that left something out
      // panicked above and never got this far, which is the difference we want to keep.
      console.error('forwarding failed', cause);

      return upstreamFailure();
    }
  },
};
