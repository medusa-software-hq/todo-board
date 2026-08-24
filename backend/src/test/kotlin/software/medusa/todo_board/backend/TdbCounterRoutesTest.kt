package software.medusa.todo_board.backend

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import kotlin.test.Test
import kotlin.test.assertEquals
import okhttp3.OkHttpClient
import software.medusa.todo_board.api.client.TdbCounterClient
import software.medusa.todo_board.backend.stack.TdbBackendStackHandle
import software.medusa.todo_board.backend.stack.TdbBackendStackStarter

class TdbCounterRoutesTest {
  private fun TdbBackendStackHandle.counterClient(): TdbCounterClient =
      TdbCounterClient(
          objectMapper = ObjectMapper().registerKotlinModule(),
          baseUrl = "http://localhost:${serviceHandle.port}",
          okHttpClient = OkHttpClient(),
      )

  @Test
  fun `the counter starts at zero`() {
    TdbBackendStackStarter.start().use { stackHandle ->
      val counterClient = stackHandle.counterClient()

      assertEquals(
          expected = 0,
          actual = counterClient.getCount().data?.count,
      )
    }
  }

  @Test
  fun `incrementing and decrementing move the counter, and the move sticks`() {
    TdbBackendStackStarter.start().use { stackHandle ->
      val counterClient = stackHandle.counterClient()

      assertEquals(
          expected = 1,
          actual = counterClient.incrementCount().data?.count,
      )

      assertEquals(
          expected = 2,
          actual = counterClient.incrementCount().data?.count,
      )

      assertEquals(
          expected = 1,
          actual = counterClient.decrementCount().data?.count,
      )

      // A separate request, so the count survived the one that changed it rather than only being
      // reported back by it.
      assertEquals(
          expected = 1,
          actual = counterClient.getCount().data?.count,
      )
    }
  }

  @Test
  fun `a fresh stack counts from zero again`() {
    TdbBackendStackStarter.start().use { stackHandle ->
      stackHandle.counterClient().incrementCount()
    }

    TdbBackendStackStarter.start().use { stackHandle ->
      assertEquals(
          expected = 0,
          actual = stackHandle.counterClient().getCount().data?.count,
      )
    }
  }
}
