package software.medusa.todo_board.api.client

import com.fasterxml.jackson.core.JacksonException
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.registerKotlinModule
import java.io.IOException
import java.net.HttpURLConnection
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import org.slf4j.LoggerFactory
import software.medusa.todo_board.api.TdbApiTypes
import software.medusa.todo_board.api.raw.client.ApiClientException
import software.medusa.todo_board.api.raw.client.ApiException
import software.medusa.todo_board.api.raw.client.ApiResponse
import software.medusa.todo_board.api.raw.client.ApiServerException
import software.medusa.todo_board.api.raw.client.RawCounterClient
import software.medusa.todo_board.core.TdbCounterId

private val logger = LoggerFactory.getLogger(TdbApiClient::class.java)

/** Todo Board API client. */
class TdbApiClient(
    private val rawCounterClient: RawCounterClient,
) {
  /**
   * The call was not answered.
   *
   * Sealed, so that a caller deciding what to do about a failure has to decide about all of them: a
   * new one added here stops compiling wherever the old ones were handled, rather than falling
   * through as something nobody expected.
   *
   * These carry nothing — no message, no cause, no stack trace. What happened is in the log, put
   * there where it was discarded.
   */
  sealed class CallError : Exception() {
    final override fun fillInStackTrace(): Throwable = this
  }

  /** The client didn't receive a proper response over the network in time. */
  @Suppress("ObjectInheritsException", "JavaIoSerializableObjectMustHaveReadResolve")
  data object NetworkError : CallError()

  /**
   * The server returned an unexpected response. It might indicate that it doesn't speak the exact
   * API protocol this client understands (potentially, it's newer) or it's misconfigured or
   * misbehaving.
   */
  @Suppress("ObjectInheritsException", "JavaIoSerializableObjectMustHaveReadResolve")
  data object IncompatibilityError : CallError()

  /** The server encountered an unexpected internal error during processing the request. */
  @Suppress("ObjectInheritsException", "JavaIoSerializableObjectMustHaveReadResolve")
  data object InternalServerError : CallError()

  companion object {
    /** Connects to the service at [baseUrl]. */
    fun connect(baseUrl: String): TdbApiClient =
        TdbApiClient(
            rawCounterClient =
                RawCounterClient(
                    objectMapper = ObjectMapper().registerKotlinModule(),
                    baseUrl = baseUrl,
                    okHttpClient = OkHttpClient(),
                ),
        )
  }

  /**
   * Creates a counter.
   *
   * @return The new counter's id.
   */
  suspend fun createCounter(): TdbCounterId =
      callRaw(
          operation = "createCounter",
          call = { rawCounterClient.createCounter() },
          onSuccess = { response ->
            when (response.statusCode) {
              HttpURLConnection.HTTP_OK ->
                  TdbCounterId(value = response.requireData(operation = "createCounter").counterId)

              else -> null
            }
          },
          // The contract gives this operation no 4xx at all.
          onClientError = { null },
      )

  /** Deletes the counter [counterId] identifies. */
  suspend fun deleteCounter(counterId: TdbCounterId): TdbApiTypes.DeleteCounterResponse =
      callRaw(
          operation = "deleteCounter",
          call = { rawCounterClient.deleteCounter(counterId = counterId.value) },
          onSuccess = { response ->
            when (response.statusCode) {
              HttpURLConnection.HTTP_NO_CONTENT -> TdbApiTypes.DeleteCounterResponse.Deleted

              else -> null
            }
          },
          onClientError = { exception ->
            when (exception.statusCode) {
              HttpURLConnection.HTTP_NOT_FOUND -> TdbApiTypes.DeleteCounterResponse.NotFound

              else -> null
            }
          },
      )

  /** Reads the current count of the counter [counterId] identifies. */
  suspend fun getCount(counterId: TdbCounterId): TdbApiTypes.GetCountResponse =
      callRaw(
          operation = "getCount",
          call = { rawCounterClient.getCount(counterId = counterId.value) },
          onSuccess = { response ->
            when (response.statusCode) {
              HttpURLConnection.HTTP_OK ->
                  TdbApiTypes.GetCountResponse.Retrieved(
                      currentCount = response.requireData(operation = "getCount").count,
                  )

              else -> null
            }
          },
          onClientError = { exception ->
            when (exception.statusCode) {
              HttpURLConnection.HTTP_NOT_FOUND -> TdbApiTypes.GetCountResponse.NotFound

              else -> null
            }
          },
      )

  /** Increments the counter [counterId] identifies. */
  suspend fun incrementCount(counterId: TdbCounterId): TdbApiTypes.IncrementCountResponse =
      callRaw(
          operation = "incrementCount",
          call = { rawCounterClient.incrementCount(counterId = counterId.value) },
          onSuccess = { response ->
            when (response.statusCode) {
              HttpURLConnection.HTTP_OK ->
                  TdbApiTypes.IncrementCountResponse.Incremented(
                      newCount = response.requireData(operation = "incrementCount").count,
                  )

              else -> null
            }
          },
          onClientError = { exception ->
            when (exception.statusCode) {
              HttpURLConnection.HTTP_NOT_FOUND -> TdbApiTypes.IncrementCountResponse.NotFound

              else -> null
            }
          },
      )

  /** Decrements the counter [counterId] identifies. */
  suspend fun decrementCount(counterId: TdbCounterId): TdbApiTypes.DecrementCountResponse =
      callRaw(
          operation = "decrementCount",
          call = { rawCounterClient.decrementCount(counterId = counterId.value) },
          onSuccess = { response ->
            when (response.statusCode) {
              HttpURLConnection.HTTP_OK ->
                  TdbApiTypes.DecrementCountResponse.Decremented(
                      newCount = response.requireData(operation = "decrementCount").count,
                  )

              else -> null
            }
          },
          onClientError = { exception ->
            when (exception.statusCode) {
              HttpURLConnection.HTTP_NOT_FOUND -> TdbApiTypes.DecrementCountResponse.NotFound

              else -> null
            }
          },
      )

  /**
   * Calls the generated client, on a thread that may block, and classifies what came back.
   *
   * [onSuccess] and [onClientError] answer `null` for a status this operation was not promised — a
   * 2xx included. A server that says 207 where the contract says 200 is not speaking the contract,
   * and a client that shrugs and assumes 200 was meant is a client that will one day report a count
   * nobody ever sent it.
   *
   * Everything the errors deliberately do not carry is written to the log here, because here is
   * where it stops existing. A caller that retries and then succeeds would otherwise leave no
   * record that anything went wrong at all.
   */
  @Suppress("ThrowsCount")
  private suspend fun <RawResultT : Any, ResultT : Any> callRaw(
      operation: String,
      call: () -> ApiResponse<RawResultT>,
      onSuccess: (ApiResponse<RawResultT>) -> ResultT?,
      onClientError: (ApiClientException) -> ResultT?,
  ): ResultT =
      withContext(Dispatchers.IO) {
        try {
          val response = call()

          onSuccess(response)
              ?: run {
                logger.error(
                    "{}: the server answered {}, which this operation was not promised",
                    operation,
                    response.statusCode,
                )

                throw IncompatibilityError
              }
        } catch (exception: JacksonException) {
          // Before `IOException`, which this extends: a body that cannot be read is the server
          // failing to speak the contract, not the network failing to carry it.
          logger.error("{}: the response body could not be read", operation, exception)

          throw IncompatibilityError
        } catch (exception: IOException) {
          logger.warn("{}: the call did not complete over the network", operation, exception)

          throw NetworkError
        } catch (exception: ApiServerException) {
          logger.error("{}: the server failed the request", operation, exception)

          throw InternalServerError
        } catch (exception: ApiClientException) {
          onClientError(exception)
              ?: run {
                logger.error("{}: the server rejected the request", operation, exception)

                throw IncompatibilityError
              }
        } catch (exception: ApiException) {
          // A redirect, or a status the generated client has no class for.
          logger.error("{}: the server answered unusably", operation, exception)

          throw IncompatibilityError
        }
      }

  /** A response with nothing in it, where the contract promises a body. */
  private fun <RawResultT> ApiResponse<RawResultT>.requireData(operation: String): RawResultT =
      when (val retrievedData = data) {
        null -> {
          logger.error("{}: the server answered {} with no body", operation, statusCode)

          throw IncompatibilityError
        }

        else -> retrievedData
      }
}
