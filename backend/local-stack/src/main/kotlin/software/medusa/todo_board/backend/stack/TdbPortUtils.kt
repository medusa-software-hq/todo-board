package software.medusa.todo_board.backend.stack

import java.net.ServerSocket

data object TdbPortUtils {
  /**
   * Finds a free local port and passes it to [block]. The port is guaranteed to stay occupied
   * during the execution of [block].
   *
   * Otherwise, this is a best-effort utility. After it returns, another process _might_ steal the
   * allocated port (although it's not likely).
   *
   * @return The result returned by [block].
   */
  fun <ResultT> allocate(block: (Int) -> ResultT): ResultT =
      ServerSocket(0).use { serverSocket -> block(serverSocket.localPort) }
}
