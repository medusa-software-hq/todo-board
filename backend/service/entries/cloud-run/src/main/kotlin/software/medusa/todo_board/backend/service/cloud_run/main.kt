package software.medusa.todo_board.backend.service.cloud_run

import software.medusa.todo_board.backend.service.TdbServiceStarter

/** The port Cloud Run routes to. */
private const val portVariableName = "PORT"

/**
 * The Service on Cloud Run.
 *
 * Nothing else: no Temporal, no database, no second half — the counters live in this process and go
 * when the revision does. That is the whole of what is deployed so far, and saying so here is
 * better than a stack that pretends to assemble something.
 */
fun main() {
  // No default. Cloud Run always sets this, so an absent one means this is not running where it
  // thinks it is — and a service listening on a port nothing routes to looks healthy from here.
  val portText = checkNotNull(System.getenv(portVariableName)) { "$portVariableName is not set" }

  val port = checkNotNull(portText.toIntOrNull()) { "$portVariableName is not a number: $portText" }

  TdbServiceStarter.start(port = port).use { handle ->
    println("Todo Board service listening on ${handle.port}")

    Thread.currentThread().join()
  }
}
