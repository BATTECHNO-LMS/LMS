import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
require(keystorePropertiesFile.exists()) {
    "Missing android/key.properties — required for release signing. " +
        "Do not fall back to debug signing for release builds."
}
keystoreProperties.load(FileInputStream(keystorePropertiesFile))

android {
    namespace = "com.battechno.lms"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        // Required by `flutter_local_notifications` (Phase 25).
        isCoreLibraryDesugaringEnabled = true
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_17.toString()
    }

    defaultConfig {
        applicationId = "com.battechno.lms"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties.getProperty("keyAlias")
                ?: error("keyAlias missing from key.properties")
            keyPassword = keystoreProperties.getProperty("keyPassword")
                ?: error("keyPassword missing from key.properties")
            storeFile = file(
                keystoreProperties.getProperty("storeFile")
                    ?: error("storeFile missing from key.properties"),
            )
            storePassword = keystoreProperties.getProperty("storePassword")
                ?: error("storePassword missing from key.properties")
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    // Required by `flutter_local_notifications` (Phase 25) — see
    // isCoreLibraryDesugaringEnabled above.
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.4")
}
