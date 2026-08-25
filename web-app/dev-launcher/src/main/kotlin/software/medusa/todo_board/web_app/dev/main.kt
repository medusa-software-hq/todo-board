package software.medusa.todo_board.web_app.dev

import java.io.File
import software.medusa.todo_board.backend.stack.TdbBackendStackStarter

/** Where the frontend lives, handed over by the Gradle task that starts this. */
private const val frontendDirProperty = "todoBoard.frontendDir"

/**
 * The whole app on this machine: the backend stack, and a Vite dev server pointed at it.
 *
 * The service takes whatever port is free and tells this launcher which one it got; the launcher
 * puts that in Vite's environment. So no port is written down anywhere, and two of these can run
 * side by side without either one knowing about the other.
 */
fun main() {
  val frontendDir =
      File(
          checkNotNull(System.getProperty(frontendDirProperty)) {
            "$frontendDirProperty is not set — start this with `./gradlew :web-app:dev-launcher:run`"
          }
      )

  TdbBackendStackStarter.start().use { stackHandle ->
    val apiUrl = "http://localhost:${stackHandle.serviceHandle.port}"

    println("Todo Board service on $apiUrl")

    val viteProcess =
        ProcessBuilder("corepack", "yarn", "vite")
            .directory(frontendDir)
            .inheritIO()
            // Not a `VITE_` name: this is for the dev server to proxy to, not for the bundle.
            .apply { environment()["TODO_BOARD_API_URL"] = apiUrl }
            .start()

    // Ctrl-C kills this process, and would otherwise leave Vite behind holding its port.
    Runtime.getRuntime().addShutdownHook(Thread { viteProcess.destroy() })

    viteProcess.waitFor()
  }
}
