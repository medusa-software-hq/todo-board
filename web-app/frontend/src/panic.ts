/**
 * Fails, and says so.
 *
 * For what cannot be recovered from and was never an answer: a value the build was supposed to
 * provide, a case that was supposed to be impossible. Reaching one is a bug here, not something a
 * user did.
 */
export function panic(message: string): never {
  throw new Error(message);
}
