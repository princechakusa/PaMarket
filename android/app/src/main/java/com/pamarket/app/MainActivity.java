package com.pamarket.app;

import android.os.Bundle;
import android.os.Handler;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean ready = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        splash.setKeepOnScreenCondition(() -> !ready);
        super.onCreate(savedInstanceState);
        new Handler().postDelayed(() -> ready = true, 1000);
    }
}