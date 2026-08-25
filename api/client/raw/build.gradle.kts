plugins {
  alias(libs.plugins.kotlin.jvm)
  alias(libs.plugins.fabrikt)

  `java-library`
}

// The client exactly as Fabrikt writes it: wire types, wire errors, nothing named after anything in
// this product. `:api:client` is what the rest of the world should hold.
dependencies {
  // `api`: these appear in the generated client's own signatures.
  api(libs.okhttp)
  api(libs.jackson.module.kotlin)

  testImplementation(libs.kotlin.test)
}

fabrikt {
  generate("todoBoard") {
    apiFile = rootProject.file("api/openapi/todo-board.yaml")
    basePackage = "software.medusa.todo_board.api.raw"
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
  tasks.withType<com.ncorti.ktfmt.gradle.tasks.KtfmtBaseTask>().configureEach {
    exclude { it.file.absolutePath.contains("/generated/") }
  }

  tasks.withType<io.gitlab.arturbosch.detekt.Detekt>().configureEach { exclude("**/generated/**") }
}

base { archivesName = "api-client-raw" }
