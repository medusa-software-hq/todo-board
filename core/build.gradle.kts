plugins {
  alias(libs.plugins.kotlin.jvm)

  `java-library`
}

dependencies { testImplementation(libs.kotlin.test) }

base { archivesName = "core" }
