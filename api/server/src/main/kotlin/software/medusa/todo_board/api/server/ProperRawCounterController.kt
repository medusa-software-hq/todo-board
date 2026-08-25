package software.medusa.todo_board.api.server

import io.micronaut.http.HttpResponse
import io.micronaut.http.annotation.Controller
import software.medusa.todo_board.api.TdbApiTypes
import software.medusa.todo_board.api.raw.controllers.RawCounterController
import software.medusa.todo_board.api.raw.models.RawCountReply
import software.medusa.todo_board.api.raw.models.RawCounterCreatedReply
import software.medusa.todo_board.core.TdbCounterId

/** Mediates between the [apiHandler] and the [RawCounterController] HTTP-based interface. */
@Controller
class ProperRawCounterController(
    private val apiHandler: TdbApiHandler,
) : RawCounterController {
  companion object {
    private fun replyWithCount(count: Long): HttpResponse<RawCountReply> =
        HttpResponse.ok(RawCountReply(count = count))
  }

  override suspend fun createCounter(): HttpResponse<RawCounterCreatedReply> =
      HttpResponse.ok(
          RawCounterCreatedReply(counterId = apiHandler.handleCreateCounter().value),
      )

  override suspend fun deleteCounter(counterId: String): HttpResponse<Unit> =
      when (apiHandler.handleDeleteCounter(counterId = TdbCounterId(counterId))) {
        TdbApiTypes.DeleteCounterResponse.Deleted -> HttpResponse.noContent()
        TdbApiTypes.DeleteCounterResponse.NotFound -> HttpResponse.notFound()
      }

  override suspend fun getCount(counterId: String): HttpResponse<RawCountReply> =
      when (val response = apiHandler.handleGetCount(counterId = TdbCounterId(counterId))) {
        is TdbApiTypes.GetCountResponse.Retrieved -> replyWithCount(response.currentCount)
        TdbApiTypes.GetCountResponse.NotFound -> HttpResponse.notFound()
      }

  override suspend fun incrementCount(counterId: String): HttpResponse<RawCountReply> =
      when (val response = apiHandler.handleIncrementCount(counterId = TdbCounterId(counterId))) {
        is TdbApiTypes.IncrementCountResponse.Incremented -> replyWithCount(response.newCount)
        TdbApiTypes.IncrementCountResponse.NotFound -> HttpResponse.notFound()
      }

  override suspend fun decrementCount(counterId: String): HttpResponse<RawCountReply> =
      when (val response = apiHandler.handleDecrementCount(counterId = TdbCounterId(counterId))) {
        is TdbApiTypes.DecrementCountResponse.Decremented -> replyWithCount(response.newCount)
        TdbApiTypes.DecrementCountResponse.NotFound -> HttpResponse.notFound()
      }
}
