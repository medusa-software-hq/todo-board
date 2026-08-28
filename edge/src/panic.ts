/**
 * Fails, and says so.
 *
 * For what cannot be recovered from and was never an answer: a variable the deploy was supposed to
 * set, a case that was supposed to be impossible. Returning `never` lets it stand on the right of
 * `??`, so a value and the reason it must exist are one line rather than a branch.
 *
 * Reaching one is a bug here, not something a caller did.
 */
export function panic(message: string): never {
  throw new Error(message);
}
