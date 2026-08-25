plugins {
  alias(libs.plugins.kotlin.jvm)
  alias(libs.plugins.ksp)
  alias(libs.plugins.micronaut.library)

  `java-library`
}

// The Service: the store, the handler that answers the API out of it, and the starter that brings
// the whole thing up. The routes themselves belong to `:api:server`.
dependencies {
  implementation(project(":backend"))
  // `api`: the store and the handler are written in these.
  api(project(":core"))
  api(project(":api:server"))

  implementation("io.micronaut:micronaut-http-server-netty")
  implementation("io.micronaut.kotlin:micronaut-kotlin-runtime")

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
