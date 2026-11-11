package app.criptface.mobile;

import android.content.ClipData;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

@CapacitorPlugin(name = "EncryptedExport")
public class EncryptedExportPlugin extends Plugin {
    @PluginMethod
    public void share(PluginCall call) {
        String name = call.getString("name");
        String data = call.getString("data");
        if (name == null || !name.matches("criptface-[0-9]+\\.ccr") || data == null || data.length() > 70_000_000) {
            call.reject("Arquivo criptografado inválido.");
            return;
        }
        try {
            byte[] bytes = Base64.decode(data, Base64.DEFAULT);
            if (bytes.length < 53 || bytes.length > 50 * 1024 * 1024) {
                call.reject("Tamanho de arquivo inválido.");
                return;
            }
            File directory = new File(getContext().getCacheDir(), "encrypted_exports");
            if (!directory.exists() && !directory.mkdirs()) {
                call.reject("Não foi possível preparar o arquivo.");
                return;
            }
            File file = new File(directory, name);
            try (FileOutputStream output = new FileOutputStream(file)) {
                output.write(bytes);
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("application/octet-stream");
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            intent.setClipData(ClipData.newRawUri("Gravação criptografada", uri));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(intent, "Salvar ou compartilhar gravação"));
            call.resolve();
        } catch (IllegalArgumentException | IOException | SecurityException | ActivityNotFoundException error) {
            call.reject("Não foi possível compartilhar o arquivo criptografado.", error);
        }
    }
}
