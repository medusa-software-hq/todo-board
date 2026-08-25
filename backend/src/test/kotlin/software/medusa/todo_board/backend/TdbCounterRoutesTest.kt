package software.medusa.todo_board.backend

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.fail
import kotlinx.coroutines.runBlocking
import software.medusa.todo_board.api.TdbApiTypes
import software.medusa.todo_board.api.client.TdbApiClient
import software.medusa.todo_board.backend.stack.TdbBackendStackHandle
import software.medusa.todo_board.backend.stack.TdbBackendStackStarter
import software.medusa.todo_board.core.TdbCounterId

class TdbCounterRoutesTest {
  private fun TdbBackendStackHandle.apiClient(): TdbApiClient =
      TdbApiClient.connect(baseUrl = "http://localhost:${serviceHandle.port}")

  /**
   * Runs [call], failing the test rather than crashing it when the API does not answer.
   *
   * A service that cannot be reached is a red test, not a broken one: nothing is wrong with the
   * code under test, and the report should not say there is. None of these errors carry anything —
   * what happened is in the log, written where the client gave up on it.
   */
  private inline fun <ResponseT> assertApiCallSucceeds(call: () -> ResponseT): ResponseT =
      try {
        call()
      } catch (callError: TdbApiClient.CallError) {
        // Exhaustive, so a new kind of failure fails to compile here rather than arriving as a
        // crash nobody chose a shade of red for.
        val what =
            when (callError) {
              TdbApiClient.NetworkError -> "the network did not carry it"
              TdbApiClient.IncompatibilityError -> "the server did not speak the contract"
              TdbApiClient.InternalServerError -> "the server failed the request"
            }

        fail("Expected the API call to succeed, but $what")
      }

  @Test
  fun `a created counter starts at zero`() = runBlocking {
    TdbBackendStackStarter.start().use { stackHandle ->
      val apiClient = stackHandle.apiClient()
      val counterId = assertApiCallSucceeds { apiClient.createCounter() }

      assertEquals(
          expected = TdbApiTypes.GetCountResponse.Retrieved(currentCount = 0),
          actual = assertApiCallSucceeds { apiClient.getCount(counterId = counterId) },
      )
    }
  }

  @Test
  fun `incrementing and decrementing move the counter, and the move sticks`() = runBlocking {
    TdbBackendStackStarter.start().use { stackHandle ->
      val apiClient = stackHandle.apiClient()
      val counterId = assertApiCallSucceeds { apiClient.createCounter() }

      assertEquals(
          expected = TdbApiTypes.IncrementCountResponse.Incremented(newCount = 1),
          actual = assertApiCallSucceeds { apiClient.incrementCount(counterId = counterId) },
      )

      assertEquals(
          expected = TdbApiTypes.IncrementCountResponse.Incremented(newCount = 2),
          actual = assertApiCallSucceeds { apiClient.incrementCount(counterId = counterId) },
      )

      assertEquals(
          expected = TdbApiTypes.DecrementCountResponse.Decremented(newCount = 1),
          actual = assertApiCallSucceeds { apiClient.decrementCount(counterId = counterId) },
      )

      // A separate request, so the count survived the one that changed it rather than only being
      // reported back by it.
      assertEquals(
          expected = TdbApiTypes.GetCountResponse.Retrieved(currentCount = 1),
          actual = assertApiCallSucceeds { apiClient.getCount(counterId = counterId) },
      )
    }
  }

  @Test
  fun `one counter moving leaves the others where they were`() = runBlocking {
    TdbBackendStackStarter.start().use { stackHandle ->
      val apiClient = stackHandle.apiClient()
      val movedCounterId = assertApiCallSucceeds { apiClient.createCounter() }
      val untouchedCounterId = assertApiCallSucceeds { apiClient.createCounter() }

      assertApiCallSucceeds { apiClient.incrementCount(counterId = movedCounterId) }

      assertEquals(
          expected = TdbApiTypes.GetCountResponse.Retrieved(currentCount = 1),
          actual = assertApiCallSucceeds { apiClient.getCount(counterId = movedCounterId) },
      )

      assertEquals(
          expected = TdbApiTypes.GetCountResponse.Retrieved(currentCount = 0),
          actual = assertApiCallSucceeds { apiClient.getCount(counterId = untouchedCounterId) },
      )
    }
  }

  @Test
  fun `a deleted counter is gone`() = runBlocking {
    TdbBackendStackStarter.start().use { stackHandle ->
      val apiClient = stackHandle.apiClient()
      val counterId = assertApiCallSucceeds { apiClient.createCounter() }

      assertEquals(
          expected = TdbApiTypes.DeleteCounterResponse.Deleted,
          actual = assertApiCallSucceeds { apiClient.deleteCounter(counterId = counterId) },
      )

      assertEquals(
          expected = TdbApiTypes.GetCountResponse.NotFound,
          actual = assertApiCallSucceeds { apiClient.getCount(counterId = counterId) },
      )

      assertEquals(
          expected = TdbApiTypes.DeleteCounterResponse.NotFound,
          actual = assertApiCallSucceeds { apiClient.deleteCounter(counterId = counterId) },
      )
    }
  }

  @Test
  fun `an id no counter has is not quietly created by using it`() = runBlocking {
    TdbBackendStackStarter.start().use { stackHandle ->
      val apiClient = stackHandle.apiClient()
      val strangerCounterId = TdbCounterId(value = "no-such-counter")

      assertEquals(
          expected = TdbApiTypes.IncrementCountResponse.NotFound,
          actual =
              assertApiCallSucceeds { apiClient.incrementCount(counterId = strangerCounterId) },
      )

      assertEquals(
          expected = TdbApiTypes.GetCountResponse.NotFound,
          actual = assertApiCallSucceeds { apiClient.getCount(counterId = strangerCounterId) },
      )
    }
  }

  @Test
  fun `a fresh stack has none of the counters the last one had`() = runBlocking {
    val counterId =
        TdbBackendStackStarter.start().use { stackHandle ->
          assertApiCallSucceeds { stackHandle.apiClient().createCounter() }
        }

    TdbBackendStackStarter.start().use { stackHandle ->
      assertEquals(
          expected = TdbApiTypes.GetCountResponse.NotFound,
          actual =
              assertApiCallSucceeds { stackHandle.apiClient().getCount(counterId = counterId) },
      )
    }
  }
}
