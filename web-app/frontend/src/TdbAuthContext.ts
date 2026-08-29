import { createContext, use } from 'react';
import { panic } from './panic.ts';

/** Who is signed in, as the token says. Shown, never believed — the edge is what believes it. */
export interface TdbAuthUser {
  readonly email: string;
  readonly name: string;
  readonly pictureUrl: string;
}

export const TdbAuthStatuses = {
  /** Google has not answered yet, one way or the other. */
  pending: 'pending',

  /** Nobody is signed in, and the API will not answer until somebody is. */
  signedOut: 'signedOut',

  signedIn: 'signedIn',

  /**
   * This build has no OAuth client, so there is nobody to sign in with and nothing to sign in to.
   * That is how the app runs on a developer's machine, where nothing stands between it and a
   * backend it started itself.
   */
  notRequired: 'notRequired',
} as const;

export type TdbAuthState =
  | { readonly status: typeof TdbAuthStatuses.pending }
  | { readonly status: typeof TdbAuthStatuses.signedOut }
  | {
      readonly status: typeof TdbAuthStatuses.signedIn;
      readonly token: string;
      readonly user: TdbAuthUser;
    }
  | { readonly status: typeof TdbAuthStatuses.notRequired };

export interface TdbAuth {
  readonly state: TdbAuthState;

  /** Asks Google who this is. */
  readonly signIn: () => void;

  /**
   * Forgets the token we are holding, and asks again.
   *
   * For the one thing the page cannot tell on its own: the edge refusing a token we thought was
   * good. Expiry we can see coming; a revoked account or a rotated client we cannot.
   */
  readonly forgetToken: () => void;
}

export const TdbAuthContext = createContext<TdbAuth | null>(null);

/** The signed-in state, for anything rendered inside the provider. */
export function useTdbAuth(): TdbAuth {
  return use(TdbAuthContext) ?? panic('there is no TdbAuthProvider above this');
}
