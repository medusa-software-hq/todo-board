import com.ncorti.ktfmt.gradle.tasks.KtfmtBaseTask
import io.gitlab.arturbosch.detekt.Detekt

plugins {
  alias(libs.plugins.kotlin.jvm)
  alias(libs.plugins.fabrikt)

  `java-library`
}

dependencies {
  api(libs.okhttp)
  api(libs.jackson.module.kotlin)

  testImplementation(libs.kotlin.test)
}

fabrikt {
  generate("todoBoard") {
    apiFile = rootProject.file("api/openapi/todo-board.yaml")
    basePackage = "software.medusa.todo_board.api"
    validationLibrary = NoValidation

    client {
      generate = true
      groupByTag = true
      target = OkHttp
    }
  }
}

// Exclude generated sources from being linted/formatted.
run {
  tasks.withType<KtfmtBaseTask>().configureEach {
    exclude { it.file.absolutePath.contains("/generated/") }
  }

  tasks.withType<Detekt>().configureEach { exclude("**/generated/**") }
}

base { archivesName = "api-client" }
