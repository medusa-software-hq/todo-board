import io.gitlab.arturbosch.detekt.extensions.DetektExtension
import org.gradle.api.tasks.testing.logging.TestExceptionFormat

plugins {
  alias(libs.plugins.kotlin.jvm) apply false
  alias(libs.plugins.shadow) apply false
  alias(libs.plugins.versionCatalogUpdate)
  alias(libs.plugins.ktfmt) apply false
  alias(libs.plugins.detekt) apply false
}

val kotlinJvmPluginId = libs.plugins.kotlin.jvm.get().pluginId
val ktfmtPluginId = libs.plugins.ktfmt.get().pluginId
val detektPluginId = libs.plugins.detekt.get().pluginId

val javaVersion = 21

allprojects {
  repositories {
    // Maven Central
    mavenCentral()

    // Organization's internal repository
    maven { url = uri("https://dl.cloudsmith.io/public/medusa-software/public/maven/") }
  }
}

// Configure Kotlin subprojects centrally
subprojects {
  pluginManager.withPlugin(kotlinJvmPluginId) {
    pluginManager.apply(ktfmtPluginId)
    pluginManager.apply(detektPluginId)

    // Configure Defekt
    extensions.configure<DetektExtension> {
      buildUponDefaultConfig = true
      config.setFrom(rootProject.file("detekt.yml"))
    }

    // Run ktfmt as
    tasks.named("check") {
      dependsOn(tasks.named("ktfmtCheck"))
    }

    // Force specific JDK version
    extensions.configure<JavaPluginExtension> {
      toolchain {
        languageVersion = JavaLanguageVersion.of(javaVersion)
      }
    }

    // Preserve parameter names in bytecode for runtime reflection
    tasks.withType<JavaCompile>().configureEach {
      options.compilerArgs.add("-parameters")
    }
  }

  // Include more details in testing output
  tasks.withType<Test>().configureEach {
    useJUnitPlatform()

    testLogging {
      events("failed")
      exceptionFormat = TestExceptionFormat.FULL
      showStackTraces = true
      showCauses = true
    }
  }
}
