/**
 * *Sign in with Google* ID tokens, checked.
 *
 * The other half of `googleIdToken.ts`: that one mints the token the edge presents to Cloud Run,
 * this one checks the token a browser presents to the edge. Both are Google ID tokens and neither
 * is the other — a user proves who they are here, and the edge proves what it is there.
 *
 * Checked at the edge rather than by the API, so a caller who cannot prove anything is turned away
 * by a Worker that costs a fraction of a cent per million rather than by a container that has to be
 * started first.
 */

/**
 * Google's OpenID Connect endpoints, from its discovery document
 * (https://accounts.google.com/.well-known/openid-configuration). Pinned rather than discovered:
 * they change about as often as the company name, and a lookup before every lookup buys nothing.
 */
const googleJwksUri = 'https://www.googleapis.com/oauth2/v3/certs';

/** Google issues `iss` as the bare host or as the https URL, and means the same thing by both. */
const googleIssuers = new Set(['accounts.google.com', 'https://accounts.google.com']);

/** How far apart our clock and Google's may be before we call a fresh token expired. */
const clockSkewSeconds = 60;

/**
 * How long a fetched key set is reused, when the answer does not say.
 *
 * It normally does: the endpoint sends `Cache-Control: max-age`, counted down to a fixed expiry
 * some hours out. Google's own guidance is to reuse the keys until then, so that is what we do, and
 * this is only what to do if the header is missing or unreadable.
 */
const fallbackKeySetLifetimeSeconds = 3600;

/** Never reuse a key set for less than this, however short an answer claims to be good for. */
const minimumKeySetLifetimeSeconds = 60;

/**
 * Fetch this long before the set we hold stops being fresh.
 *
 * Google's own Java client keeps the same margin, and for the same reason: keys that expire while a
 * request is in flight are keys nobody can be verified against.
 */
const refreshMarginSeconds = 300;

/** Who the caller is. Everything else the token says about them is not ours to keep. */
export interface GoogleUser {
  /** Stable and unique, and unlike an address never reassigned to somebody else. */
  readonly subject: string;

  readonly email: string;
}

/**
 * One of Google's published keys. `JsonWebKey` is the shape WebCrypto imports, and says nothing
 * about the key id — which is the half a token names, so it has to be added back.
 */
interface GoogleJsonWebKey extends JsonWebKey {
  readonly kid?: string;
}

/** The header of a JWT, as far as we are willing to read one before checking its signature. */
interface JwtHeader {
  readonly alg?: unknown;
  readonly kid?: unknown;
}

/** The claims we require. Anything Google adds beyond these is not read. */
interface GoogleIdTokenClaims {
  readonly iss?: unknown;
  readonly aud?: unknown;
  readonly sub?: unknown;
  readonly email?: unknown;
  readonly email_verified?: unknown;
  readonly hd?: unknown;
  readonly iat?: unknown;
  readonly exp?: unknown;
}

/**
 * Accepts tokens issued to one OAuth client, for people in one hosted domain.
 *
 * Both bounds matter and neither implies the other: without the audience check any Google-signed
 * token for any application on earth would pass, and without the hosted domain every Google account
 * on earth would.
 */
export class GoogleUserTokenVerifier {
  private keys: Map<string, CryptoKey> | undefined;
  private keysUsableUntil = 0;

  constructor(
    private readonly clientId: string,
    private readonly hostedDomain: string,
  ) {}

  /**
   * Who [token] proves the caller to be, or `null` if it proves nothing.
   *
   * One `null` for every way of failing, on purpose: which check a rejected token failed is worth
   * knowing to us and worth nothing to whoever presented it. That is what the logging here is for —
   * the reason is written down at the point where it stops being carried.
   */
  async verify(token: string): Promise<GoogleUser | null> {
    const parts = token.split('.');

    if (parts.length !== 3) {
      console.warn('rejecting a token: not three parts');

      return null;
    }

    const [encodedHeader, encodedClaims, encodedSignature] = parts as [string, string, string];

    const header = decodeJson<JwtHeader>(encodedHeader);
    const claims = decodeJson<GoogleIdTokenClaims>(encodedClaims);

    if (header === null || claims === null) {
      console.warn('rejecting a token: the header or the claims are not JSON');

      return null;
    }

    // Only what Google signs its ID tokens with. Naming the algorithm rather than believing the
    // token's own account of it is what keeps `alg: none` from being an argument.
    if (header.alg !== 'RS256') {
      console.warn('rejecting a token: unexpected algorithm', header.alg);

      return null;
    }

    if (typeof header.kid !== 'string') {
      console.warn('rejecting a token: no key id');

      return null;
    }

    if (
      !(await this.hasValidSignature(
        header.kid,
        `${encodedHeader}.${encodedClaims}`,
        encodedSignature,
      ))
    ) {
      return null;
    }

    return this.userFrom(claims);
  }

  /** Whether Google signed [signingInput], as the key named by [kid] would prove. */
  private async hasValidSignature(
    kid: string,
    signingInput: string,
    encodedSignature: string,
  ): Promise<boolean> {
    const signature = decodeBase64Url(encodedSignature);

    if (signature === null) {
      console.warn('rejecting a token: the signature is not base64url');

      return false;
    }

    // A key id we do not hold is a token we cannot verify, and that is the end of it. Google
    // publishes a key long before it signs anything with it, so this is not what a rotation looks
    // like reaching us — it is what an invented `kid` looks like, and fetching on the strength of
    // one would let anybody spend our requests to Google. Google's own clients reject here too.
    const key = (await this.keySet()).get(kid);

    if (key === undefined) {
      console.warn('rejecting a token: no such key id', kid);

      return false;
    }

    const verified = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      signature,
      new TextEncoder().encode(signingInput),
    );

    if (!verified) {
      console.warn('rejecting a token: the signature does not match');
    }

    return verified;
  }

  /** Who the claims say the caller is, or `null` if they are not someone we let in. */
  private userFrom(claims: GoogleIdTokenClaims): GoogleUser | null {
    if (typeof claims.iss !== 'string' || !googleIssuers.has(claims.iss)) {
      console.warn('rejecting a token: unexpected issuer', claims.iss);

      return null;
    }

    // The token names the application it was issued to. One signed for somebody else's client is
    // authentic and still not ours to accept.
    if (claims.aud !== this.clientId) {
      console.warn('rejecting a token: unexpected audience', claims.aud);

      return null;
    }

    // The Workspace / Cloud Identity domain the account belongs to. A personal Google account has
    // no `hd` at all, which is exactly the case this turns away.
    if (claims.hd !== this.hostedDomain) {
      console.warn('rejecting a token: unexpected hosted domain', claims.hd);

      return null;
    }

    // Google sets this itself for a domain account, so requiring it costs nothing and means an
    // address is never taken on the word of whoever typed it.
    if (claims.email_verified !== true) {
      console.warn('rejecting a token: the address is unverified');

      return null;
    }

    if (typeof claims.iat !== 'number' || typeof claims.exp !== 'number') {
      console.warn('rejecting a token: no issued-at or no expiry');

      return null;
    }

    const nowSeconds = Date.now() / 1000;

    if (claims.exp + clockSkewSeconds < nowSeconds) {
      console.warn('rejecting a token: expired');

      return null;
    }

    if (claims.iat - clockSkewSeconds > nowSeconds) {
      console.warn('rejecting a token: issued in the future');

      return null;
    }

    if (typeof claims.sub !== 'string' || typeof claims.email !== 'string') {
      console.warn('rejecting a token: no subject or no address');

      return null;
    }

    return { subject: claims.sub, email: claims.email };
  }

  /** Google's signing keys, by key id — the ones we hold, until they are too old to hold. */
  private async keySet(): Promise<Map<string, CryptoKey>> {
    const cached = this.keys;

    if (cached !== undefined && this.keysUsableUntil > Date.now() / 1000) {
      return cached;
    }

    return this.fetchKeySet();
  }

  /** Google's signing keys, asked for again whatever we are holding. */
  private async fetchKeySet(): Promise<Map<string, CryptoKey>> {
    const response = await fetch(googleJwksUri);

    if (!response.ok) {
      // Not the caller's doing, and not something to answer them about: this throws, and the one
      // place that turns a failure into a reply decides what they are told.
      console.error('fetching Google’s signing keys failed', response.status);

      throw new Error('could not fetch Google’s signing keys');
    }

    const body = (await response.json()) as { keys?: readonly GoogleJsonWebKey[] };
    const keys = new Map<string, CryptoKey>();

    for (const jwk of body.keys ?? []) {
      // A key set may carry keys for algorithms we do not accept; importing those would fail, and
      // failing on them would let one unusable key deny every token.
      if (jwk.kid === undefined || jwk.alg !== 'RS256') {
        continue;
      }

      keys.set(
        jwk.kid,
        await crypto.subtle.importKey(
          'jwk',
          jwk,
          { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
          false,
          ['verify'],
        ),
      );
    }

    this.keys = keys;
    this.keysUsableUntil = Date.now() / 1000 + reusableForSeconds(response);

    return keys;
  }
}

/**
 * How long [response] says it may be reused, within what we are willing to believe.
 *
 * `Age` is what a shared cache has already spent of that time before the answer reached us, so it
 * comes off the top — as it does in Google's Java client, which is where the arithmetic is from.
 */
function reusableForSeconds(response: Response): number {
  const maxAge = /max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '');

  if (maxAge === null) {
    return fallbackKeySetLifetimeSeconds;
  }

  const age = Number(response.headers.get('age') ?? 0);
  const remaining = Number(maxAge[1]) - (Number.isFinite(age) ? age : 0) - refreshMarginSeconds;

  return Math.max(remaining, minimumKeySetLifetimeSeconds);
}

/** [encoded] as the JSON it should be, or `null` if it is not that. */
function decodeJson<ValueT>(encoded: string): ValueT | null {
  const bytes = decodeBase64Url(encoded);

  if (bytes === null) {
    return null;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as ValueT;
  } catch {
    return null;
  }
}

/** [encoded] as bytes, or `null` if it is not base64url. */
function decodeBase64Url(encoded: string): Uint8Array | null {
  const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');

  try {
    return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}
