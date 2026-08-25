package software.medusa.todo_board.backend.service

import io.micronaut.context.ApplicationContext
import io.micronaut.runtime.server.EmbeddedServer
import software.medusa.todo_board.api.server.ProperRawCounterController

/** Service starter. */
data object TdbServiceStarter {
  private val anyFreePort = -1

  /** Starts the Service on an automatically allocated port. */
  fun start(): TdbServiceHandle {
    val counterStore = TdbInMemoryCounterStore()

    val counterController =
        ProperRawCounterController(
            apiHandler = TdbProperApiHandler(counterStore = counterStore),
        )

    val applicationContext =
        ApplicationContext.builder()
            .banner(false)
            .deduceEnvironment(false)
            // Fail the start, rather than whichever request arrives first.
            .eagerInitSingletons(true)
            .singletons(counterController)
            .properties(mapOf("micronaut.server.port" to anyFreePort))
            .start()

    val server = applicationContext.getBean(EmbeddedServer::class.java).start()

    return object : TdbServiceHandle {
      override val port: Int = server.port

      override fun close() {
        server.close()

        // Built here, so closed here.
        applicationContext.close()
      }
    }
  }
}
