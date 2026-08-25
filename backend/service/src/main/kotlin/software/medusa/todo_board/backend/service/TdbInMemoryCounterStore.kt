package software.medusa.todo_board.backend.service

import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong
import software.medusa.todo_board.backend.TdbConstants
import software.medusa.todo_board.core.TdbCounterId

/** In-memory [TdbCounterStore]. */
class TdbInMemoryCounterStore : TdbCounterStore {
  private val counters = ConcurrentHashMap<TdbCounterId, AtomicLong>()

  override fun create(): TdbCounterId {
    val counterId = TdbCounterId(UUID.randomUUID().toString())

    counters[counterId] = AtomicLong(TdbConstants.initialCounterValue)

    return counterId
  }

  override fun delete(counterId: TdbCounterId): Boolean = counters.remove(counterId) != null

  override fun getCurrent(counterId: TdbCounterId): Long? = counters[counterId]?.get()

  override fun increment(counterId: TdbCounterId): Long? = counters[counterId]?.incrementAndGet()

  override fun decrement(counterId: TdbCounterId): Long? = counters[counterId]?.decrementAndGet()
}
