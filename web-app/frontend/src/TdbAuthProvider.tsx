import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  TdbAuthContext,
  TdbAuthStatuses,
  type TdbAuthState,
  type TdbAuthUser,
} from './TdbAuthContext.ts';

/**
 * Signing in with Google.
 *
 * The token this obtains is the one the edge checks. Nothing here is a security decision — the
 * claims are read to put a name on the screen, and a page that lied to itself about them would
 * still be turned away at `/api`. Everything that has to be true is checked where it cannot be
 * edited by whoever is looking at it.
 */

/**
 * The OAuth client this build signs in with, empty when it has none.
 *
 * Baked in at build time, so staging and production are different bundles. That is deliberate and
 * is what Counter does: the client id names the environment, and a bundle that could be pointed at
 * either would be a bundle that could be pointed at the wrong one.
 */
const clientId = (import.meta.env['VITE_GOOGLE_CLIENT_ID'] as string | undefined) ?? '';

/** The domain to offer accounts from. A hint to Google; the edge is what enforces it. */
const hostedDomain = import.meta.env['VITE_GOOGLE_ALLOWED_DOMAIN'] as string | undefined;

/** Where a token is kept between reloads, so a refresh is not a sign-in. */
const tokenStorageKey = 'tdb.googleIdToken';

/** Ask for a new token this long before the one we hold expires. */
const refreshMarginSeconds = 60;

/** What a Google ID token says about its holder. Read for display, and to know when it dies. */
interface TdbTokenClaims {
  readonly email?: unknown;
  readonly name?: unknown;
  readonly picture?: unknown;
  readonly exp?: unknown;
}

/** The claims [token] carries, or `null` if it carries none we can read. */
function claimsOf(token: string): TdbTokenClaims | null {
  const encodedClaims = token.split('.')[1];

  if (encodedClaims === undefined) {
    return null;
  }

  try {
    const json = atob(encodedClaims.replace(/-/g, '+').replace(/_/g, '/'));

    return JSON.parse(json) as TdbTokenClaims;
  } catch {
    return null;
  }
}

/** Seconds until [claims] expire, or `null` if they do not say. */
function secondsUntilExpiry(claims: TdbTokenClaims): number | null {
  return typeof claims.exp === 'number' ? claims.exp - Date.now() / 1000 : null;
}

function userOf(claims: TdbTokenClaims): TdbAuthUser {
  return {
    email: typeof claims.email === 'string' ? claims.email : '',
    name: typeof claims.name === 'string' ? claims.name : '',
    pictureUrl: typeof claims.picture === 'string' ? claims.picture : '',
  };
}

/** A token kept from a previous visit, if it is still worth holding. */
function storedToken(): string | null {
  const token = localStorage.getItem(tokenStorageKey);

  if (token === null) {
    return null;
  }

  const claims = claimsOf(token);
  const remaining = claims === null ? null : secondsUntilExpiry(claims);

  if (remaining === null || remaining < refreshMarginSeconds) {
    localStorage.removeItem(tokenStorageKey);

    return null;
  }

  return token;
}

/** Loads Google's sign-in library, once per page. */
function loadGoogleIdentityServices(): Promise<void> {
  const scriptId = 'google-identity-services';

  return new Promise((resolve, reject) => {
    if (document.getElementById(scriptId) !== null) {
      resolve();

      return;
    }

    const script = document.createElement('script');

    script.id = scriptId;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      resolve();
    };
    script.onerror = () => {
      reject(new Error('could not load Google Identity Services'));
    };

    document.head.appendChild(script);
  });
}

export function TdbAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TdbAuthState>(() => {
    if (clientId === '') {
      // Said once, out loud: a build with no client asks nobody to sign in, and the difference
      // between that and everyone being welcome is the edge in front of the deployed one.
      console.info('no OAuth client is configured; the API is called without a token');

      return { status: TdbAuthStatuses.notRequired };
    }

    return { status: TdbAuthStatuses.pending };
  });

  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const acceptToken = useCallback((token: string) => {
    const claims = claimsOf(token);

    if (claims === null) {
      // Google gave us something we cannot read. Nothing to hold and nothing to show.
      console.error('the credential Google returned is not a readable token');
      setState({ status: TdbAuthStatuses.signedOut });

      return;
    }

    localStorage.setItem(tokenStorageKey, token);
    setState({ status: TdbAuthStatuses.signedIn, token, user: userOf(claims) });

    const remaining = secondsUntilExpiry(claims);

    if (refreshTimer.current !== null) {
      clearTimeout(refreshTimer.current);
    }

    if (remaining !== null && remaining > refreshMarginSeconds) {
      // Ask again before it dies, so the app does not have to find out by being refused.
      refreshTimer.current = setTimeout(
        () => {
          google.accounts.id.prompt();
        },
        (remaining - refreshMarginSeconds) * 1000,
      );
    }
  }, []);

  const signIn = useCallback(() => {
    google.accounts.id.prompt();
  }, []);

  const forgetToken = useCallback(() => {
    if (refreshTimer.current !== null) {
      clearTimeout(refreshTimer.current);
    }

    localStorage.removeItem(tokenStorageKey);
    setState({ status: TdbAuthStatuses.signedOut });
    google.accounts.id.prompt();
  }, []);

  useEffect(() => {
    if (clientId === '') {
      return;
    }

    let abandoned = false;

    loadGoogleIdentityServices()
      .then(() => {
        if (abandoned) {
          return;
        }

        google.accounts.id.initialize({
          client_id: clientId,
          callback: (credential) => {
            acceptToken(credential.credential);
          },
          ...(hostedDomain === undefined ? {} : { hd: hostedDomain }),
          auto_select: true,
        });

        const kept = storedToken();

        if (kept !== null) {
          acceptToken(kept);
        }

        google.accounts.id.prompt((notification) => {
          if (abandoned) {
            return;
          }

          // Google declined to ask — the account chooser was dismissed before, or there is no
          // session to offer. Whoever is here has to say so themselves.
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            setState((previous) =>
              previous.status === TdbAuthStatuses.pending
                ? { status: TdbAuthStatuses.signedOut }
                : previous,
            );
          }
        });
      })
      .catch((cause: unknown) => {
        if (abandoned) {
          return;
        }

        // The library did not load. There is no signing in without it, and pretending otherwise
        // would leave the page waiting for something that is not coming.
        console.error('Google Identity Services could not be loaded', cause);
        setState({ status: TdbAuthStatuses.signedOut });
      });

    return () => {
      abandoned = true;

      if (refreshTimer.current !== null) {
        clearTimeout(refreshTimer.current);
      }
    };
  }, [acceptToken]);

  return <TdbAuthContext value={{ state, signIn, forgetToken }}>{children}</TdbAuthContext>;
}
