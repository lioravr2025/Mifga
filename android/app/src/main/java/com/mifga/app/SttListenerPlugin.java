package com.mifga.app;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.getcapacitor.JSArray;
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
 *
 * No paid cloud STT involved - everything here is the free on-device intent
 * API, pushed as far as it goes: multiple ranked hypotheses (not just the
 * top one, which is often wrong on street names the recognizer has no
 * vocabulary for - the caller cross-checks each against a real address/city
 * search and picks whichever one actually matches something real), a
 * biasing phrase list (Android 13+, EXTRA_BIASING_STRINGS) built from the
 * caller's own known-good vocabulary (e.g. real Israeli city names) instead
 * of the recognizer's generic free-form language model, and a longer
 * silence tolerance so a natural mid-address pause ("רחוב הרצל... מספר
 * שתיים עשר... בחולון") doesn't get cut off before the rider finishes.
 */
@CapacitorPlugin(
    name = "SttListener",
    permissions = @Permission(strings = { android.Manifest.permission.RECORD_AUDIO }, alias = "microphone")
)
public class SttListenerPlugin extends Plugin {
    private static final int MAX_CANDIDATES = 5;
    // No documented cap on EXTRA_BIASING_STRINGS - capped defensively so a
    // very long phrase list can't degrade recognition or get silently
    // dropped by the OS instead of applied.
    private static final int MAX_BIASING_PHRASES = 500;

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
        JSArray biasingArg = call.getArray("biasing");
        ArrayList<String> biasing = new ArrayList<>();
        if (biasingArg != null) {
            int count = Math.min(biasingArg.length(), MAX_BIASING_PHRASES);
            for (int i = 0; i < count; i++) {
                try {
                    String s = biasingArg.getString(i);
                    if (!s.isEmpty()) biasing.add(s);
                } catch (org.json.JSONException e) {
                    // best-effort - skip a malformed entry rather than fail the whole call
                }
            }
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
                        JSArray candidates = new JSArray();
                        if (matches != null) {
                            for (String m : matches) candidates.put(m);
                        }
                        JSObject ret = new JSObject();
                        ret.put("candidates", candidates);
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
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, MAX_CANDIDATES);
            // The on-device/offline engine has a much smaller, generic
            // model - force the online (server-side Google) engine, which
            // is materially more accurate, same as Waze/Maps voice search
            // do by default.
            intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, false);
            // Default endpointer silence windows are tuned for short
            // single-phrase commands and were cutting off multi-part
            // addresses ("street... number... city") mid-utterance on a
            // natural breath pause. Stretched out so the rider gets to
            // finish speaking before the recognizer decides they're done.
            intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 3000);
            intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 3000);
            intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 3000);
            if (Build.VERSION.SDK_INT >= 33 && !biasing.isEmpty()) {
                intent.putStringArrayListExtra(RecognizerIntent.EXTRA_BIASING_STRINGS, biasing);
            }
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
