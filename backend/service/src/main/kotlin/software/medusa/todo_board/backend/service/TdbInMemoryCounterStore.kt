package software.medusa.todo_board.backend.service

import java.util.concurrent.atomic.AtomicLong
import software.medusa.todo_board.backend.TdbConstants

/** In-memory [TdbCounterStore]. */
class TdbInMemoryCounterStore : TdbCounterStore {
  private val value = AtomicLong(TdbConstants.initialCounterValue)

  override fun getCurrent(): Long = value.get()

  override fun increment(): Long = value.incrementAndGet()

  override fun decrement(): Long = value.decrementAndGet()
}
