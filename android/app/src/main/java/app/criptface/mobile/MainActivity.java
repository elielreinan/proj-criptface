package app.criptface.mobile;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(EncryptedExportPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
