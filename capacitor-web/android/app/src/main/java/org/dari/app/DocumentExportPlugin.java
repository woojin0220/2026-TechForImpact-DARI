package org.dari.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.OutputStream;
import java.io.File;
import java.io.FileInputStream;

/** Save to a location chosen by the user; no broad storage permission or cloud upload. */
@CapacitorPlugin(name = "DocumentExport")
public class DocumentExportPlugin extends Plugin {
    private boolean saving = false;
    @PluginMethod public void save(PluginCall call) {
        if (saving) { call.reject("A save dialog is already open", "SAVE_IN_PROGRESS"); return; }
        String filename = call.getString("filename", "");
        if (!(filename.endsWith(".pdf") || filename.endsWith(".hwp"))) {
            call.reject("Invalid document", "INVALID_DOCUMENT"); return;
        }
        try { sourceFile(call); }
        catch (Exception error) { call.reject("Invalid cached document", "INVALID_DOCUMENT", error); return; }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(filename.endsWith(".pdf") ? "application/pdf" : "application/x-hwp");
        intent.putExtra(Intent.EXTRA_TITLE, filename);
        saving = true;
        try { startActivityForResult(call, intent, "documentSelected"); }
        catch (Exception error) { saving=false; call.reject("Could not open the save dialog", "SAVE_FAILED", error); }
    }
    @ActivityCallback private void documentSelected(PluginCall call, ActivityResult result) {
        saving=false;
        if (call == null) return;
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            JSObject response = new JSObject(); response.put("saved", false); call.resolve(response); return;
        }
        getBridge().execute(() -> {
            try {
                // Keep only a small file URI in the saved PluginCall. Passing base64 here
                // exceeds Android's activity saved-state Binder limit for normal PDFs.
                try (FileInputStream input = new FileInputStream(sourceFile(call));
                     OutputStream stream = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                    if (stream == null) throw new java.io.IOException("No document output stream");
                    byte[] buffer = new byte[32768]; int count;
                    while ((count = input.read(buffer)) != -1) stream.write(buffer, 0, count);
                    stream.flush();
                }
                JSObject response = new JSObject(); response.put("saved", true); call.resolve(response);
            } catch (Exception error) { call.reject("Could not save the document", "SAVE_FAILED", error); }
        });
    }
    private File sourceFile(PluginCall call) throws java.io.IOException {
        Uri source = Uri.parse(call.getString("uri", ""));
        if (!"file".equals(source.getScheme()) || source.getPath() == null) throw new java.io.IOException("Expected a cached file URI");
        File file = new File(source.getPath()).getCanonicalFile();
        String cacheRoot = getContext().getCacheDir().getCanonicalPath() + File.separator;
        if (!file.getPath().startsWith(cacheRoot) || !file.isFile() || file.length() == 0) throw new java.io.IOException("Document is outside the cache");
        return file;
    }
}
