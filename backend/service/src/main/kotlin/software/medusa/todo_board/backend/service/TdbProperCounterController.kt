package software.medusa.todo_board.backend.service

import io.micronaut.http.HttpResponse
import io.micronaut.http.annotation.Controller
import software.medusa.todo_board.api.controllers.TdbCounterController
import software.medusa.todo_board.api.models.TdbCountReply

/** Serves the counter routes, implementing the interface generated from the API contract. */
@Controller
class TdbProperCounterController(
    private val counterStore: TdbCounterStore,
) : TdbCounterController {
  override fun getCount(): HttpResponse<TdbCountReply> =
      HttpResponse.ok(TdbCountReply(count = counterStore.getCurrent()))

  override fun incrementCount(): HttpResponse<TdbCountReply> =
      HttpResponse.ok(TdbCountReply(count = counterStore.increment()))

  override fun decrementCount(): HttpResponse<TdbCountReply> =
      HttpResponse.ok(TdbCountReply(count = counterStore.decrement()))
}
