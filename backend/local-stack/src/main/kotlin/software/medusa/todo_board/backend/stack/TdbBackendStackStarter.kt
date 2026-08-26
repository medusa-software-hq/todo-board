package software.medusa.todo_board.backend.stack

import software.medusa.todo_board.backend.service.TdbServiceHandle
import software.medusa.todo_board.backend.service.TdbServiceStarter

/** Backend stack starter. */
data object TdbBackendStackStarter {
  /**
   * Starts the backend stack on a port nobody has to choose.
   *
   * The Service takes the port it is told to take, the same on this machine as on Cloud Run.
   * Finding a free one is what running several of these at once needs, and that is this module's
   * concern — it is the harness — rather than something the Service carries around for it.
   */
  fun start(): TdbBackendStackHandle {
    // Allocated before anything starts, and let go of by the time it does: a port cannot be taken
    // while it is still being held to keep it free.
    val portAllocation = TdbBackendStackPortAllocation.allocate()

    val serviceHandle = TdbServiceStarter.start(port = portAllocation.servicePort)

    return object : TdbBackendStackHandle {
      override val serviceHandle: TdbServiceHandle = serviceHandle

      override fun close() {
        serviceHandle.close()
      }
    }
  }
}
