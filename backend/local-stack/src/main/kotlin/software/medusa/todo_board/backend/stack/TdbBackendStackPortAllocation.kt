package software.medusa.todo_board.backend.stack

/** Port allocation for the backend stack. */
data class TdbBackendStackPortAllocation(
    /** Service port. */
    val servicePort: Int,
) {
  companion object {
    /**
     * Allocates the ports.
     *
     * One so far. When there is a second, it is allocated inside this block rather than after it,
     * so every socket is still held while the next one is chosen and no two can come back the same.
     */
    fun allocate(): TdbBackendStackPortAllocation = TdbPortUtils.allocate { servicePort ->
      TdbBackendStackPortAllocation(
          servicePort = servicePort,
      )
    }
  }
}
