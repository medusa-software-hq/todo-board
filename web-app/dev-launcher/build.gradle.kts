plugins {
  alias(libs.plugins.kotlin.jvm)

  application
}

// The whole app on this machine: the backend stack, and Vite pointed at it.
dependencies {
  implementation(project(":backend:local-stack"))

  runtimeOnly(libs.logback.classic)
}

application { mainClass = "software.medusa.todo_board.web_app.dev.MainKt" }

tasks.named<JavaExec>("run") {
  // The launcher is started by Gradle from wherever, and needs to know where the frontend lives.
  systemProperty("todoBoard.frontendDir", rootProject.file("web-app/frontend").absolutePath)
}

base { archivesName = "web-app-dev-launcher" }
