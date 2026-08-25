/**
 * Fails to compile if [value] can still be something.
 *
 * A `switch` over a union decides nothing the compiler can check when the surrounding function
 * returns nothing: there is no return type for a missing case to be wrong about, so a new member of
 * the union simply falls through. Calling this in `default` narrows [value] to `never`, which a new
 * member is not — so adding one stops the build here instead of doing nothing at run time.
 *
 * Reaching it is a bug in this page, not an answer from anywhere, so it panics.
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${JSON.stringify(value)}`);
}
