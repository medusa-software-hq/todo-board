package software.medusa.todo_board.backend.stack

import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.time.Duration
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * The stack as it is actually run, driven with nothing but the JDK.
 *
 * The suite in `:backend` reaches the service through `:api:client`, which drags its own
 * dependencies onto the test classpath — so a module that forgot to declare something it needs at
 * run time still passed there, and only failed when someone started the thing for real. This test
 * sees the runtime classpath the stack really has, which is the whole point of it.
 */
class TdbBackendStackSmokeTest {
  /**
   * A request that never answers is the failure mode this test exists to catch, so it must not wait
   * for it: an unanswered call has to end the test rather than hang the build.
   */
  private val requestTimeout: Duration = Duration.ofSeconds(20)

  @Test
  fun `a counter can be made and counted on the assembled stack`() {
    TdbBackendStackStarter.start().use { stackHandle ->
      val baseUrl = "http://localhost:${stackHandle.serviceHandle.port}"
      val httpClient = HttpClient.newHttpClient()

      fun post(path: String): HttpResponse<String> =
          httpClient.send(
              HttpRequest.newBuilder(URI.create("$baseUrl$path"))
                  .timeout(requestTimeout)
                  .POST(HttpRequest.BodyPublishers.noBody())
                  .build(),
              HttpResponse.BodyHandlers.ofString(),
          )

      val created = post("/counters")

      assertEquals(
          expected = 200,
          actual = created.statusCode(),
      )

      val counterId = created.body().substringAfter("""{"counterId":"""").substringBefore('"')

      assertEquals(
          expected = """{"count":1}""",
          actual = post("/counters/$counterId/increment").body(),
      )
    }
  }
}
