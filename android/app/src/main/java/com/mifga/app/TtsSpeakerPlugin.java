package com.mifga.app;

import android.speech.tts.TextToSpeech;
import android.speech.tts.Voice;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Native Hebrew turn-by-turn voice, bypassing the WebView entirely - remote
 * diagnostics from real devices confirmed Android's System WebView doesn't
 * implement window.speechSynthesis at all (it's present in a normal Chrome
 * browser on the same device, just not in the WebView component apps embed),
 * so the Web Speech API route used elsewhere in this app never had a chance
 * to work here. This wraps android.speech.tts.TextToSpeech directly instead,
 * same reasoning as MicRecorderPlugin bypassing the WebView's getUserMedia()
 * bridge for the walkie-talkie feature.
 */
@CapacitorPlugin(name = "TtsSpeaker")
public class TtsSpeakerPlugin extends Plugin {
    private TextToSpeech tts;
    private boolean ready = false;
    private final List<Runnable> pendingActions = new ArrayList<>();

    @Override
    public void load() {
        tts = new TextToSpeech(getContext(), status -> {
            ready = status == TextToSpeech.SUCCESS;
            if (ready) {
                tts.setLanguage(new Locale("he", "IL"));
            }
            List<Runnable> toRun;
            synchronized (pendingActions) {
                toRun = new ArrayList<>(pendingActions);
                pendingActions.clear();
            }
            for (Runnable r : toRun) r.run();
        });
    }

    @PluginMethod
    public void getVoices(PluginCall call) {
        if (!ready) {
            synchronized (pendingActions) {
                pendingActions.add(() -> getVoices(call));
            }
            return;
        }
        JSArray voices = new JSArray();
        if (tts.getVoices() != null) {
            for (Voice v : tts.getVoices()) {
                Locale locale = v.getLocale();
                String lang = locale != null ? locale.getLanguage() : "";
                // "iw" is the old ISO 639-1 code for Hebrew some engines still report.
                if (!"he".equals(lang) && !"iw".equals(lang)) continue;
                if (v.getFeatures() != null && v.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)) continue;

                JSObject o = new JSObject();
                o.put("id", v.getName());
                o.put("name", v.getName());
                o.put("requiresNetwork", v.isNetworkConnectionRequired());
                voices.put(o);
            }
        }
        JSObject ret = new JSObject();
        ret.put("voices", voices);
        call.resolve(ret);
    }

    @PluginMethod
    public void speak(PluginCall call) {
        if (!ready) {
            synchronized (pendingActions) {
                pendingActions.add(() -> speak(call));
            }
            return;
        }
        String text = call.getString("text");
        if (text == null || text.isEmpty()) {
            call.reject("NO_TEXT");
            return;
        }
        String voiceId = call.getString("voiceId");
        Voice matched = null;
        if (voiceId != null && tts.getVoices() != null) {
            for (Voice v : tts.getVoices()) {
                if (v.getName().equals(voiceId)) {
                    matched = v;
                    break;
                }
            }
        }
        if (matched != null) {
            tts.setVoice(matched);
        } else {
            tts.setLanguage(new Locale("he", "IL"));
        }
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "mifga-" + System.currentTimeMillis());
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (tts != null) tts.stop();
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
        }
    }
}
