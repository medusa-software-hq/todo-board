package software.medusa.todo_board.api.client

import com.sun.net.httpserver.HttpServer
import java.net.InetSocketAddress
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlinx.coroutines.runBlocking
import software.medusa.todo_board.api.TdbApiTypes
import software.medusa.todo_board.core.TdbCounterId

/**
 * What the client makes of a server that answers something other than what was promised.
 *
 * A real service never does, which is exactly why this cannot be tested against one. The server
 * here answers whatever it is told to.
 */
class TdbApiClientClassificationTest {
  private val counterId = TdbCounterId(value = "any-counter")

  /** Runs [block] against a service that answers every request with [statusCode] and [body]. */
  private fun <ResultT> answering(
      statusCode: Int,
      body: String,
      block: suspend (TdbApiClient) -> ResultT,
  ): ResultT {
    val server =
        HttpServer.create(InetSocketAddress(0), 0).apply {
          createContext("/") { exchange ->
            val bodyBytes = body.toByteArray()

            exchange.responseHeaders.add("Content-Type", "application/json")
            // A body length of zero means "no body" to the JDK's server, which is what a 204 needs.
            exchange.sendResponseHeaders(statusCode, bodyBytes.size.toLong())
            exchange.responseBody.use { it.write(bodyBytes) }
          }

          start()
        }

    return try {
      runBlocking {
        block(TdbApiClient.connect(baseUrl = "http://localhost:${server.address.port}"))
      }
    } finally {
      server.stop(0)
    }
  }

  @Test
  fun `the promised 200 is read`() {
    assertEquals(
        expected = TdbApiTypes.GetCountResponse.Retrieved(currentCount = 5),
        actual =
            answering(statusCode = 200, body = """{"count":5}""") {
              it.getCount(counterId = counterId)
            },
    )
  }

  @Test
  fun `a 2xx the operation was never promised is not treated as the one it was`() {
    // 207 carries a body this client could read, and reading it would mean believing a count that
    // was never sent.
    assertFailsWith<TdbApiClient.IncompatibilityError> {
      answering(statusCode = 207, body = """{"count":5}""") { it.getCount(counterId = counterId) }
    }
  }

  @Test
  fun `the promised 404 is an answer`() {
    assertEquals(
        expected = TdbApiTypes.GetCountResponse.NotFound,
        actual = answering(statusCode = 404, body = "") { it.getCount(counterId = counterId) },
    )
  }

  @Test
  fun `a 4xx the operation was never promised is not one`() {
    assertFailsWith<TdbApiClient.IncompatibilityError> {
      answering(statusCode = 418, body = "") { it.getCount(counterId = counterId) }
    }
  }

  @Test
  fun `a 5xx is the server's failure, not a disagreement about the contract`() {
    assertFailsWith<TdbApiClient.InternalServerError> {
      answering(statusCode = 500, body = "") { it.getCount(counterId = counterId) }
    }
  }

  @Test
  fun `a promised status with no body is not an answer either`() {
    assertFailsWith<TdbApiClient.IncompatibilityError> {
      answering(statusCode = 200, body = "") { it.getCount(counterId = counterId) }
    }
  }
}
