package software.medusa.todo_board.api.server

import software.medusa.todo_board.api.TdbApiTypes
import software.medusa.todo_board.core.TdbCounterId

/**
 * What a backend implements to answer the API.
 *
 * The API in the product's own words: counter ids rather than strings, and an outcome per operation
 * rather than a status code. What that becomes on the wire is [ProperRawCounterController]'s
 * business, and an implementation of this never has to know.
 */
interface TdbApiHandler {
  /**
   * Creates a counter.
   *
   * @return The new counter's id.
   */
  suspend fun handleCreateCounter(): TdbCounterId

  /** Deletes the counter [counterId] identifies. */
  suspend fun handleDeleteCounter(counterId: TdbCounterId): TdbApiTypes.DeleteCounterResponse

  /** Reads the current count of the counter [counterId] identifies. */
  suspend fun handleGetCount(counterId: TdbCounterId): TdbApiTypes.GetCountResponse

  /** Increments the counter [counterId] identifies. */
  suspend fun handleIncrementCount(counterId: TdbCounterId): TdbApiTypes.IncrementCountResponse

  /** Decrements the counter [counterId] identifies. */
  suspend fun handleDecrementCount(counterId: TdbCounterId): TdbApiTypes.DecrementCountResponse
}
