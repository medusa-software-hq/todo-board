package software.medusa.todo_board.backend.service

import software.medusa.todo_board.api.TdbApiTypes
import software.medusa.todo_board.api.server.TdbApiHandler
import software.medusa.todo_board.core.TdbCounterId

/** Answers the API out of a [TdbCounterStore]. */
class TdbProperApiHandler(
    private val counterStore: TdbCounterStore,
) : TdbApiHandler {
  override suspend fun handleCreateCounter(): TdbCounterId = counterStore.create()

  override suspend fun handleDeleteCounter(
      counterId: TdbCounterId
  ): TdbApiTypes.DeleteCounterResponse =
      when (counterStore.delete(counterId = counterId)) {
        true -> TdbApiTypes.DeleteCounterResponse.Deleted
        false -> TdbApiTypes.DeleteCounterResponse.NotFound
      }

  override suspend fun handleGetCount(counterId: TdbCounterId): TdbApiTypes.GetCountResponse =
      when (val currentCount = counterStore.getCurrent(counterId = counterId)) {
        null -> TdbApiTypes.GetCountResponse.NotFound
        else -> TdbApiTypes.GetCountResponse.Retrieved(currentCount = currentCount)
      }

  override suspend fun handleIncrementCount(
      counterId: TdbCounterId
  ): TdbApiTypes.IncrementCountResponse =
      when (val newCount = counterStore.increment(counterId = counterId)) {
        null -> TdbApiTypes.IncrementCountResponse.NotFound
        else -> TdbApiTypes.IncrementCountResponse.Incremented(newCount = newCount)
      }

  override suspend fun handleDecrementCount(
      counterId: TdbCounterId
  ): TdbApiTypes.DecrementCountResponse =
      when (val newCount = counterStore.decrement(counterId = counterId)) {
        null -> TdbApiTypes.DecrementCountResponse.NotFound
        else -> TdbApiTypes.DecrementCountResponse.Decremented(newCount = newCount)
      }
}
