package software.medusa.todo_board.backend.service

/** Handle to a locally running Service. */
interface TdbServiceHandle : AutoCloseable {
  /** The port the Service is listening on. */
  val port: Int
}
