package com.mifga.app;

import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.Locale;

/**
 * Native Hebrew speech-to-text for dictating a destination address, same
 * reasoning as TtsSpeakerPlugin: the WebView doesn't reliably expose the Web
 * Speech Recognition API either (and where it does, it routes through a
 * cloud service tied to the WebView's own Google account state, not the
 * app's). This wraps android.speech.SpeechRecognizer directly instead.
 */
@CapacitorPlugin(
    name = "SttListener",
    permissions = @Permission(strings = { android.Manifest.permission.RECORD_AUDIO }, alias = "microphone")
)
public class SttListenerPlugin extends Plugin {
    private SpeechRecognizer recognizer;

    @PluginMethod
    public void startListening(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "micPermissionCallback");
            return;
        }
        doStartListening(call);
    }

    @PermissionCallback
    private void micPermissionCallback(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            doStartListening(call);
        } else {
            call.reject("MIC_PERMISSION_DENIED");
        }
    }

    private void doStartListening(PluginCall call) {
        if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
            call.reject("NOT_AVAILABLE");
            return;
        }
        getActivity().runOnUiThread(() -> {
            if (recognizer != null) {
                recognizer.destroy();
                recognizer = null;
            }
            recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(
                new RecognitionListener() {
                    @Override
                    public void onResults(Bundle results) {
                        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        String text = matches != null && !matches.isEmpty() ? matches.get(0) : "";
                        JSObject ret = new JSObject();
                        ret.put("text", text);
                        call.resolve(ret);
                        cleanup();
                    }

                    @Override
                    public void onError(int error) {
                        call.reject("STT_ERROR_" + error);
                        cleanup();
                    }

                    @Override
                    public void onReadyForSpeech(Bundle params) {}

                    @Override
                    public void onBeginningOfSpeech() {}

                    @Override
                    public void onRmsChanged(float rmsdB) {}

                    @Override
                    public void onBufferReceived(byte[] buffer) {}

                    @Override
                    public void onEndOfSpeech() {}

                    @Override
                    public void onPartialResults(Bundle partialResults) {}

                    @Override
                    public void onEvent(int eventType, Bundle params) {}

                    private void cleanup() {
                        getActivity().runOnUiThread(() -> {
                            if (recognizer != null) {
                                recognizer.destroy();
                                recognizer = null;
                            }
                        });
                    }
                }
            );

            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            // toLanguageTag() ("he-IL"), not toString() ("he_IL") - the
            // recognizer matches this against installed language packs by
            // BCP-47 tag, and the underscore form matched nothing on some
            // devices, leaving the recognizer waiting indefinitely with
            // neither onResults nor onError ever firing.
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, new Locale("he", "IL").toLanguageTag());
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
            recognizer.startListening(intent);
        });
    }

    @PluginMethod
    public void stopListening(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (recognizer != null) {
                recognizer.stopListening();
            }
        });
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (recognizer != null) {
            recognizer.destroy();
            recognizer = null;
        }
    }
}
