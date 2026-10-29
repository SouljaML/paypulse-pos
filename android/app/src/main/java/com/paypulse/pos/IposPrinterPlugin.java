package com.paypulse.pos;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.os.IBinder;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.iposprinter.iposprinterservice.IPosPrinterCallback;
import com.iposprinter.iposprinterservice.IPosPrinterService;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Prints on terminals whose built-in printer is run by the iPOS printer
 * service app (com.iposprinter.iposprinterservice), e.g. the Q2i.
 */
@CapacitorPlugin(name = "IposPrinter")
public class IposPrinterPlugin extends Plugin {
    private static final String PKG = "com.iposprinter.iposprinterservice";
    private static final String ACTION = PKG + ".IPosPrintService";

    private IPosPrinterService service;
    private ServiceConnection connection;

    private final IPosPrinterCallback callback = new IPosPrinterCallback.Stub() {
        @Override public void onRunResult(boolean isSuccess) { }
        @Override public void onReturnString(String result) { }
    };

    private boolean installed() {
        try {
            getContext().getPackageManager().getPackageInfo(PKG, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    private synchronized IPosPrinterService connect() throws Exception {
        if (service != null && service.asBinder().isBinderAlive()) return service;
        final CountDownLatch latch = new CountDownLatch(1);
        ServiceConnection c = new ServiceConnection() {
            @Override public void onServiceConnected(ComponentName name, IBinder binder) {
                service = IPosPrinterService.Stub.asInterface(binder);
                latch.countDown();
            }
            @Override public void onServiceDisconnected(ComponentName name) { service = null; }
        };
        Context ctx = getContext();
        Intent i = new Intent();
        i.setPackage(PKG);
        i.setAction(ACTION);
        boolean ok = ctx.bindService(i, c, Context.BIND_AUTO_CREATE);
        if (!ok) {
            Intent j = new Intent();
            j.setComponent(new ComponentName(PKG, ACTION));
            ok = ctx.bindService(j, c, Context.BIND_AUTO_CREATE);
        }
        if (!ok) throw new Exception("Could not reach the terminal's printer service.");
        if (!latch.await(6, TimeUnit.SECONDS)) throw new Exception("The terminal's printer service did not respond.");
        connection = c;
        return service;
    }

    private static String statusMessage(int code) {
        switch (code) {
            case 0: return "Printer ready";
            case 1: return "Printer is out of paper";
            case 2: return "Printer head is too hot, wait a moment";
            case 3: return "Printer motor is too hot, wait a moment";
            case 4: return "Printer is busy";
            default: return "Printer problem (code " + code + ")";
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject r = new JSObject();
        r.put("available", installed());
        call.resolve(r);
    }

    @PluginMethod
    public void status(final PluginCall call) {
        new Thread(() -> {
            try {
                int code = connect().getPrinterStatus();
                JSObject r = new JSObject();
                r.put("code", code);
                r.put("ok", code == 0 || code == 4);
                r.put("message", statusMessage(code));
                call.resolve(r);
            } catch (Exception e) {
                call.reject(e.getMessage() == null ? "Printer status failed" : e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void printImage(final PluginCall call) {
        final String data = call.getString("data");
        final int size = call.getInt("size", 16);
        if (data == null) {
            call.reject("No image to print");
            return;
        }
        new Thread(() -> {
            try {
                String b64 = data.contains(",") ? data.substring(data.indexOf(',') + 1) : data;
                byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
                Bitmap src = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                if (src == null) throw new Exception("Could not read the receipt image.");
                Bitmap bmp = Bitmap.createBitmap(src.getWidth(), src.getHeight(), Bitmap.Config.ARGB_8888);
                Canvas canvas = new Canvas(bmp);
                canvas.drawColor(Color.WHITE);
                canvas.drawBitmap(src, 0, 0, null);

                IPosPrinterService s = connect();
                int code = s.getPrinterStatus();
                if (code != 0 && code != 4) throw new Exception(statusMessage(code));
                s.printerInit(callback);
                s.printBitmap(1, size, bmp, callback);
                s.printerPerformPrint(80, callback);
                call.resolve();
            } catch (Exception e) {
                call.reject(e.getMessage() == null ? "Printing failed" : e.getMessage());
            }
        }).start();
    }

    @Override
    protected void handleOnDestroy() {
        if (connection != null) {
            try { getContext().unbindService(connection); } catch (Exception ignored) { }
            connection = null;
            service = null;
        }
    }
}
