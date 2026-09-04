package it.volleyvision.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override public void onCreate(Bundle stato) {
    // La registrazione va dichiarata prima di `super`: dopo, il ponte e gia
    // costruito e il plugin non risulterebbe al codice web.
    registerPlugin(VideoNativoPlugin.class);
    super.onCreate(stato);
  }
}
