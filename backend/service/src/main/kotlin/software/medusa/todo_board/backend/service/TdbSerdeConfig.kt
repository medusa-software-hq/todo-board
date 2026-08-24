package software.medusa.todo_board.backend.service

import io.micronaut.serde.annotation.SerdeImport
import software.medusa.todo_board.api.models.TdbCountReply

/**
 * Serde is locked down by default, so each externally-defined model is registered here rather than
 * by editing generated code.
 */
@SerdeImport(TdbCountReply::class) class TdbSerdeConfig
