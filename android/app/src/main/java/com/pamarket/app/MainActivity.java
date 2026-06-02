package com.pamarket.app;

import android.graphics.Color;
import android.os.Bundle;

import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    // Flipped once the WebView has had time to paint the HTML splash.
    private boolean contentReady = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Android 12+ always shows a system splash on cold start; it cannot be
        // disabled. installSplashScreen() lets us hold that (blue, branded) splash
        // on screen until the WebView has rendered the HTML splash, so the user
        // never sees the intermediate window/WebView frames (no black/white gap).
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

        splashScreen.setKeepOnScreenCondition(() -> !contentReady);

        // Paint the WebView solid brand blue so nothing white/black leaks through
        // behind the HTML splash.
        getBridge().getWebView().setBackgroundColor(Color.parseColor("#1A3A8F"));

        // Give the local HTML splash time to paint, then release the system splash
        // straight into it — blue-to-blue, no visible handoff.
        getBridge().getWebView().postDelayed(() -> contentReady = true, 600);
    }
}
