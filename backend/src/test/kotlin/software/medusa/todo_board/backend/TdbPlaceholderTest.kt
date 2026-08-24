package software.medusa.todo_board.backend

import kotlin.test.Test
import kotlin.test.assertEquals

class TdbPlaceholderTest {
  @Test
  fun test_value() {
    assertEquals(
        expected = 0,
        actual = TdbPlaceholder.value,
    )
  }
}
