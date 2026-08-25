plugins {
  alias(libs.plugins.kotlin.jvm)

  `java-library`
}

dependencies {
  api(project(":api"))

  api(libs.kotlinx.coroutines.core)

  implementation(project(":api:client:raw"))
  implementation(libs.slf4j.api)

  testImplementation(libs.kotlin.test)
}

base { archivesName = "api-client" }
