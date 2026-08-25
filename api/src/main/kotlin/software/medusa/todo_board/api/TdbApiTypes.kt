package software.medusa.todo_board.api

/**
 * The answers each operation can give.
 *
 * A sealed type per operation, rather than a nullable reply or a thrown exception: an outcome the
 * contract describes is a value, and the compiler can then insist that a caller has a branch for
 * each one.
 */
data object TdbApiTypes {
  /** What deleting a counter can come to. */
  sealed interface DeleteCounterResponse {
    /** The counter was there, and is not any more. */
    data object Deleted : DeleteCounterResponse

    /** No counter has that id. */
    data object NotFound : DeleteCounterResponse
  }

  /** What reading a count can come to. */
  sealed interface GetCountResponse {
    /** The counter's current value. */
    data class Retrieved(val currentCount: Long) : GetCountResponse

    /** No counter has that id. */
    data object NotFound : GetCountResponse
  }

  /** What incrementing a counter can come to. */
  sealed interface IncrementCountResponse {
    /** The value after incrementing. */
    data class Incremented(val newCount: Long) : IncrementCountResponse

    /** No counter has that id. */
    data object NotFound : IncrementCountResponse
  }

  /** What decrementing a counter can come to. */
  sealed interface DecrementCountResponse {
    /** The value after decrementing. */
    data class Decremented(val newCount: Long) : DecrementCountResponse

    /** No counter has that id. */
    data object NotFound : DecrementCountResponse
  }
}
