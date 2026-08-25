plugins {
  alias(libs.plugins.kotlin.jvm)

  `java-library`
}

dependencies {
  api(project(":core"))

  testImplementation(libs.kotlin.test)
}

base { archivesName = "api" }
