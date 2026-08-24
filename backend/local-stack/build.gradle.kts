plugins {
  alias(libs.plugins.kotlin.jvm)

  application
}

dependencies {
  api(project(":backend:service"))

  runtimeOnly(libs.logback.classic)

  testImplementation(libs.kotlin.test)
}

application { mainClass = "software.medusa.todo_board.backend.stack.MainKt" }

base { archivesName = "backend-local-stack" }
