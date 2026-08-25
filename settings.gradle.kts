plugins {
  // Allow automatic download of JDKs
  id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

rootProject.name = "todo-board"

include(
    ":core",
    ":api",
    ":api:client:raw",
    ":api:client",
    ":api:server",
    ":backend",
    ":backend:service",
    ":backend:local-stack",

    // The frontend, and the launcher that runs it against a backend stack.
    ":web-app:dev-launcher",
)
