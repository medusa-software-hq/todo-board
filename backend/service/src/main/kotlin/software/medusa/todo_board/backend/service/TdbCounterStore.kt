package software.medusa.todo_board.backend.service

/** Stores a single, global counter. */
interface TdbCounterStore {
  /** @return The current value of the counter (initially: 0). */
  fun getCurrent(): Long

  /**
   * Increments the counter.
   *
   * @return The incremented value.
   */
  fun increment(): Long

  /**
   * Decrements the counter.
   *
   * @return The decremented value.
   */
  fun decrement(): Long
}
