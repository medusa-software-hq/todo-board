plugins {
  alias(libs.plugins.kotlin.jvm)

  `java-library`
}

dependencies {
  testImplementation(project(":backend:local-stack"))
  testImplementation(project(":api:client"))
  testImplementation(libs.kotlinx.coroutines.core)
  testImplementation(libs.kotlin.test)
}

base { archivesName = "backend" }
