import { GoogleUserTokenVerifier } from './googleUserToken.ts';
import assert from 'node:assert/strict';
import { beforeEach, describe, it, mock } from 'node:test';

/**
 * What the verifier does with tokens, including the ones it should not believe.
 *
 * Google's part is played by a key generated here: the tokens are signed the way Google signs
 * them, and the key set is served the way Google serves it, by standing in for `fetch`. Nothing in
 * the verifier is arranged for this — it fetches the same URL and imports the same keys it always
 * does, and would not know the difference.
 */

const clientId = '1234.apps.googleusercontent.com';
const hostedDomain = 'medusa.software';
const keyId = 'test-key';

/** The claims Google would send about somebody we let in. */
function validClaims(): Record<string, unknown> {
  const nowSeconds = Math.floor(Date.now() / 1000);

  return {
    iss: 'https://accounts.google.com',
    aud: clientId,
    sub: '108423',
    email: 'someone@medusa.software',
    email_verified: true,
    hd: hostedDomain,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };
}

const keyPair = (await crypto.subtle.generateKey(
  {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  },
  true,
  ['sign', 'verify'],
)) as CryptoKeyPair;

const exportedKey = (await crypto.subtle.exportKey('jwk', keyPair.publicKey)) as JsonWebKey;

/** The public half, published the way Google publishes one: the key, its id, and what it is for. */
const publicJwk = {
  kty: exportedKey.kty,
  n: exportedKey.n,
  e: exportedKey.e,
  kid: keyId,
  alg: 'RS256',
  use: 'sig',
};

function base64Url(bytes: Uint8Array | string): string {
  const raw = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  let binary = '';

  for (const byte of raw) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A token signed the way Google signs one, unless [header] says something else. */
async function mintToken(
  claims: Record<string, unknown>,
  header: Record<string, unknown> = { alg: 'RS256', kid: keyId },
): Promise<string> {
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`;

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    keyPair.privateKey,
    new TextEncoder().encode(signingInput),
  );

  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}

/**
 * Stands in for Google's key set endpoint, and counts how often it was asked.
 *
 * [maxAgeSeconds] is the real endpoint's way of saying how long its answer keeps: omitted here to
 * play one that does not say.
 */
function serveKeySet(maxAgeSeconds?: number): { calls: () => number } {
  const fetchMock = mock.method(globalThis, 'fetch', () =>
    Promise.resolve(
      new Response(JSON.stringify({ keys: [publicJwk] }), {
        status: 200,
        headers:
          maxAgeSeconds === undefined
            ? {}
            : { 'cache-control': `public, max-age=${maxAgeSeconds}, must-revalidate` },
      }),
    ),
  );

  return { calls: () => fetchMock.mock.callCount() };
}

describe('GoogleUserTokenVerifier', () => {
  let verifier: GoogleUserTokenVerifier;

  beforeEach(() => {
    mock.restoreAll();
    mock.timers.reset();
    verifier = new GoogleUserTokenVerifier(clientId, hostedDomain);
  });

  it('accepts a token Google signed for our client', async () => {
    serveKeySet();

    assert.deepEqual(await verifier.verify(await mintToken(validClaims())), {
      subject: '108423',
      email: 'someone@medusa.software',
    });
  });

  it('rejects a token issued to another application', async () => {
    serveKeySet();

    assert.equal(
      await verifier.verify(
        await mintToken({ ...validClaims(), aud: 'somebody-else.apps.googleusercontent.com' }),
      ),
      null,
    );
  });

  it('rejects a personal Google account, which carries no hosted domain', async () => {
    serveKeySet();
    const { hd: _, ...claims } = validClaims();

    assert.equal(await verifier.verify(await mintToken(claims)), null);
  });

  it('rejects an account from another hosted domain', async () => {
    serveKeySet();

    assert.equal(
      await verifier.verify(await mintToken({ ...validClaims(), hd: 'example.com' })),
      null,
    );
  });

  it('rejects an unverified address', async () => {
    serveKeySet();

    assert.equal(
      await verifier.verify(await mintToken({ ...validClaims(), email_verified: false })),
      null,
    );
  });

  it('rejects an expired token', async () => {
    serveKeySet();
    const nowSeconds = Math.floor(Date.now() / 1000);

    assert.equal(
      await verifier.verify(
        await mintToken({ ...validClaims(), iat: nowSeconds - 7200, exp: nowSeconds - 3600 }),
      ),
      null,
    );
  });

  it('rejects an issuer that is not Google', async () => {
    serveKeySet();

    assert.equal(
      await verifier.verify(
        await mintToken({ ...validClaims(), iss: 'https://accounts.example.com' }),
      ),
      null,
    );
  });

  // The one that matters most: everything above could be checked by reading the token, and none of
  // it means anything unless the signature is what says the token is Google's at all.
  it('rejects claims edited after signing', async () => {
    serveKeySet();
    const [header, , signature] = (await mintToken(validClaims())).split('.') as [
      string,
      string,
      string,
    ];
    const forged = base64Url(
      JSON.stringify({ ...validClaims(), email: 'someone-else@medusa.software' }),
    );

    assert.equal(await verifier.verify(`${header}.${forged}.${signature}`), null);
  });

  it('rejects a token that says it needs no signature', async () => {
    serveKeySet();
    const claims = base64Url(JSON.stringify(validClaims()));

    assert.equal(
      await verifier.verify(`${base64Url(JSON.stringify({ alg: 'none' }))}.${claims}.`),
      null,
    );
  });

  it('rejects a token that is not a token', async () => {
    serveKeySet();

    assert.equal(await verifier.verify('not-a-token'), null);
  });

  it('fetches the key set once and keeps it', async () => {
    const keySet = serveKeySet();

    await verifier.verify(await mintToken(validClaims()));
    await verifier.verify(await mintToken(validClaims()));

    assert.equal(keySet.calls(), 1);
  });

  it('keeps the set for as long as the answer says, and no longer', async () => {
    const keySet = serveKeySet(120);
    mock.timers.enable({ apis: ['Date'] });

    await verifier.verify(await mintToken(validClaims()));

    mock.timers.tick(119_000);
    await verifier.verify(await mintToken(validClaims()));
    assert.equal(keySet.calls(), 1);

    mock.timers.tick(2_000);
    await verifier.verify(await mintToken(validClaims()));
    assert.equal(keySet.calls(), 2);
  });

  it('will not hold a set for a moment, however brief the answer claims to be good for', async () => {
    const keySet = serveKeySet(0);
    mock.timers.enable({ apis: ['Date'] });

    await verifier.verify(await mintToken(validClaims()));

    mock.timers.tick(59_000);
    await verifier.verify(await mintToken(validClaims()));

    assert.equal(keySet.calls(), 1);
  });

  // A rotation faster than the published keys led us to expect would show up as a key id we do not
  // have, and looking again is how somebody real gets in anyway.
  it('looks again for an unknown key id', async () => {
    const keySet = serveKeySet();

    assert.equal(
      await verifier.verify(await mintToken(validClaims(), { alg: 'RS256', kid: 'rotated' })),
      null,
    );
    assert.equal(keySet.calls(), 2);
  });

  // The same path, from the other side: an invented `kid` is the cheap way to ask, so it must not
  // buy a request to Google per token. One per window, and the flood pays for nothing.
  it('does not let a made-up key id buy a fetch per token', async () => {
    const keySet = serveKeySet();
    mock.timers.enable({ apis: ['Date'] });

    for (let attempt = 0; attempt < 20; attempt++) {
      await verifier.verify(
        await mintToken(validClaims(), { alg: 'RS256', kid: `made-up-${attempt}` }),
      );
      mock.timers.tick(1_000);
    }

    // One for the set itself, one for the first unknown id, and nothing bought by the other 19.
    assert.equal(keySet.calls(), 2);
  });

  it('looks again once the window has passed', async () => {
    const keySet = serveKeySet();
    mock.timers.enable({ apis: ['Date'] });

    await verifier.verify(await mintToken(validClaims(), { alg: 'RS256', kid: 'unknown' }));
    mock.timers.tick(301_000);
    await verifier.verify(await mintToken(validClaims(), { alg: 'RS256', kid: 'unknown' }));

    assert.equal(keySet.calls(), 3);
  });
});
