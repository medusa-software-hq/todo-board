plugins {
  alias(libs.plugins.kotlin.jvm)

  `java-library`
}

dependencies {
  testImplementation(project(":backend:local-stack"))
  testImplementation(project(":api:client"))
  testImplementation(libs.kotlin.test)
}

base { archivesName = "backend" }
