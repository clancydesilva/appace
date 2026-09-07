package com.clancy.appace

import android.app.Application
import android.content.res.Configuration
import android.graphics.Typeface

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.common.assets.ReactFontManager
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactNativeHost

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainApplication : Application(), ReactApplication {

  override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
      this,
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
            }

          override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

          override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

          override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
      }
  )

  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)

    try {
      val typeface = Typeface.createFromAsset(assets, "fonts/Bahnschrift.ttf")
      val boldTypeface = Typeface.create(typeface, Typeface.BOLD)
      val italicTypeface = Typeface.create(typeface, Typeface.ITALIC)
      val boldItalicTypeface = Typeface.create(typeface, Typeface.BOLD_ITALIC)
      ReactFontManager.getInstance().setTypeface("Bahnschrift", Typeface.NORMAL, typeface)
      ReactFontManager.getInstance().setTypeface("Bahnschrift", Typeface.BOLD, boldTypeface)
      ReactFontManager.getInstance().setTypeface("Bahnschrift", Typeface.ITALIC, italicTypeface)
      ReactFontManager.getInstance().setTypeface("Bahnschrift", Typeface.BOLD_ITALIC, boldItalicTypeface)
    } catch (e: Exception) {
      android.util.Log.w("MainApplication", "Failed to register Bahnschrift font family: ${e.message}")
    }

    CoroutineScope(Dispatchers.IO).launch {
      BalanceRepository(applicationContext).initIfEmpty()
    }
    AccrualWorker.schedule(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
