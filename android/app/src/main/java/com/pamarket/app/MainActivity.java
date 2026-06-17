package com.pamarket.app;

import android.graphics.Color;
import android.os.Bundle;
import android.webkit.WebView;

import androidx.core.splashscreen.SplashScreen;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

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

        final WebView webView = getBridge().getWebView();

        // Paint the WebView solid brand blue so nothing white/black leaks through
        // behind the HTML splash.
        webView.setBackgroundColor(Color.parseColor("#1A3A8F"));

        // ── Edge-to-edge handling (fixes status/nav-bar overlap on Android 15/16) ──
        // Android 15+ (targetSDK 35/36) forces edge-to-edge: the WebView draws
        // BEHIND the status and navigation bars, and android:statusBarColor is ignored.
        // CSS env(safe-area-inset-*) is unreliable here — on Android it only
        // reports display cutouts (0 on most phones, e.g. this Redmi), so headers
        // would render under the system clock. We opt into edge-to-edge explicitly
        // (identical behaviour on every Android version), keep white status-bar
        // icons over the navy header, and feed the REAL system-bar insets to CSS
        // as --safe-top / --safe-bottom so layouts pad correctly everywhere.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat ic = WindowCompat.getInsetsController(getWindow(), webView);
        if (ic != null) ic.setAppearanceLightStatusBars(false); // white icons on navy

        final float density = getResources().getDisplayMetrics().density;
        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars());
            int top = Math.round(bars.top / density);
            int bottom = Math.round(bars.bottom / density);
            final String js = "(function(){var d=document.documentElement;if(!d)return;" +
                "d.style.setProperty('--safe-top','" + top + "px');" +
                "d.style.setProperty('--safe-bottom','" + bottom + "px');})();";
            v.post(() -> webView.evaluateJavascript(js, null));
            return insets;
        });

        // Give the local HTML splash time to paint, then release the system splash
        // straight into it — blue-to-blue, no visible handoff — and re-apply insets
        // now that the HTML (and :root vars) are loaded.
        webView.postDelayed(() -> {
            contentReady = true;
            ViewCompat.requestApplyInsets(webView);
        }, 600);
    }
}
