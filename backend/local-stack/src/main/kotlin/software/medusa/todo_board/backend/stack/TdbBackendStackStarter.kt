package software.medusa.todo_board.backend.stack

import software.medusa.todo_board.backend.service.TdbServiceHandle
import software.medusa.todo_board.backend.service.TdbServiceStarter

/** Backend stack starter. */
data object TdbBackendStackStarter {
  /** Starts the backend stack. */
  fun start(): TdbBackendStackHandle {
    val serviceHandle = TdbServiceStarter.start()

    return object : TdbBackendStackHandle {
      override val serviceHandle: TdbServiceHandle = serviceHandle

      override fun close() {
        serviceHandle.close()
      }
    }
  }
}
