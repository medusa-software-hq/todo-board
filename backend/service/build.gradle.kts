import com.ncorti.ktfmt.gradle.tasks.KtfmtBaseTask
import io.gitlab.arturbosch.detekt.Detekt

plugins {
  alias(libs.plugins.kotlin.jvm)
  alias(libs.plugins.ksp)
  alias(libs.plugins.micronaut.library)
  alias(libs.plugins.fabrikt)

  `java-library`
}

dependencies {
  ksp("io.micronaut.serde:micronaut-serde-processor")

  implementation(project(":backend"))

  implementation("io.micronaut:micronaut-http-server-netty")
  implementation("io.micronaut.kotlin:micronaut-kotlin-runtime")
  implementation("io.micronaut.serde:micronaut-serde-jackson")

  testImplementation(libs.kotlin.test)
}

micronaut {
  runtime("netty")
  testRuntime("junit5")
  processing {
    incremental(true)
    annotations("software.medusa.todo_board.*")
  }
}

base { archivesName = "backend-service" }

// The models and the controller interfaces, generated from the contract.
fabrikt {
  generate("todoBoard") {
    apiFile = rootProject.file("api/openapi/todo-board.yaml")
    basePackage = "software.medusa.todo_board.api"
    validationLibrary = NoValidation

    model { micronautIntrospection = true }

    controller {
      generate = true
      groupByTag = true
      target = Micronaut
    }
  }
}

// KSP needs an explicit dependency on the Fabrikt generation task
tasks
    .matching { it.name == "kspKotlin" }
    .configureEach { dependsOn(tasks.named("fabriktGenerate")) }

// Generated sources live on the compile path but must not be linted/formatted.
run {
  tasks.withType<KtfmtBaseTask>().configureEach {
    exclude { it.file.absolutePath.contains("/generated/") }
  }

  tasks.withType<Detekt>().configureEach { exclude("**/generated/**") }
}
