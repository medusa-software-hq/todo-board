package software.medusa.todo_board.backend.stack

/** Entry point for the local stack. */
fun main() {
  TdbBackendStackStarter.start().use { stackHandle ->
    println("Todo Board service port: ${stackHandle.serviceHandle.port}")

    Thread.currentThread().join()
  }
}
