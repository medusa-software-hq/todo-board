package software.medusa.todo_board.backend.stack

import software.medusa.todo_board.backend.service.TdbServiceHandle

/** Handle to a locally running full backend stack (currently just the Service). */
interface TdbBackendStackHandle : AutoCloseable {
  /** Service handle. */
  val serviceHandle: TdbServiceHandle
}
