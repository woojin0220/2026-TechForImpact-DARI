package org.dari.app;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(MlKitTranslationPlugin.class);
        registerPlugin(OnDeviceLlmPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
