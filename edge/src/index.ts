/**
 * The edge in front of Todo Board.
 *
 * Round one: it forwards everything and decides nothing. What it proves is the path — DNS, TLS at
 * the new hostnames, the deploy, and this Worker being the only thing the public talks to. The
 * checks come next, and they come here, so that a request which fails one costs a Worker
 * invocation and nothing on Cloud Run.
 */

export interface Env {
  /**
   * Where to forward to.
   *
   * Set at deploy time from the service's own URL rather than written down here: a Cloud Run URL is
   * generated when the service is created, so the only copy that cannot go stale is the one read
   * back at the moment of deploying.
   */
  WEB_TARGET?: string | undefined;
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
 * `redirect: 'manual'` because a redirect is the origin's answer to the caller, not something for
 * this to follow on its behalf.
 */
async function forward(request: Request, target: string): Promise<Response> {
  const url = new URL(request.url);
  const upstream = new URL(url.pathname + url.search, target);

  const headers = new Headers(request.headers);
  headers.set('host', upstream.host);

  return fetch(
    new Request(upstream, {
      method: request.method,
      headers,
      body: request.body,
      redirect: 'manual',
    }),
  );
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!env.WEB_TARGET) {
      // No default. A Worker forwarding nowhere would fail exactly like an origin that is down,
      // and the log is the only place that difference can be recorded.
      console.error('WEB_TARGET is not set');

      return upstreamFailure();
    }

    try {
      return await forward(request, env.WEB_TARGET);
    } catch (cause) {
      // The origin is unreachable or answered unusably. Nothing here can tell the caller anything
      // more useful than that, and the detail belongs in the log rather than in the response.
      console.error('forwarding failed', cause);

      return upstreamFailure();
    }
  },
};
