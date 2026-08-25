package software.medusa.todo_board.backend.service

import software.medusa.todo_board.core.TdbCounterId

/**
 * Stores counters, each one identified on its own.
 *
 * The read and write operations answer `null` for an id no counter has, rather than creating one: a
 * counter exists because someone created it, and a typo should not quietly become a counter.
 */
interface TdbCounterStore {
  /**
   * Creates a counter.
   *
   * @return The new counter's id.
   */
  fun create(): TdbCounterId

  /**
   * Deletes the counter [counterId] identifies.
   *
   * @return Whether there was such a counter.
   */
  fun delete(counterId: TdbCounterId): Boolean

  /**
   * @return The current value of the counter [counterId] identifies, or `null` if there is none.
   */
  fun getCurrent(counterId: TdbCounterId): Long?

  /**
   * Increments the counter [counterId] identifies.
   *
   * @return The incremented value, or `null` if there is no such counter.
   */
  fun increment(counterId: TdbCounterId): Long?

  /**
   * Decrements the counter [counterId] identifies.
   *
   * @return The decremented value, or `null` if there is no such counter.
   */
  fun decrement(counterId: TdbCounterId): Long?
}
