package com.iposprinter.iposprinterservice;

// Reverse-engineered from the terminal's own IPosPrinterService app.
// Method ORDER matters: it fixes the binder transaction numbers.
interface IPosPrinterCallback {
    void onRunResult(boolean isSuccess);
    void onReturnString(String result);
}
