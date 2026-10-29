package com.iposprinter.iposprinterservice;

import android.graphics.Bitmap;
import com.iposprinter.iposprinterservice.IPosPrinterCallback;

// Reverse-engineered from the terminal's own IPosPrinterService app
// (transaction numbers 1..19 in this exact order). Do not reorder.
interface IPosPrinterService {
    int getPrinterStatus();                                                                   // 1
    void printerInit(in IPosPrinterCallback callback);                                        // 2
    void setPrinterPrintDepth(int depth, in IPosPrinterCallback callback);                    // 3
    void setPrinterPrintFontType(String typeface, in IPosPrinterCallback callback);           // 4
    void setPrinterPrintFontSize(int fontsize, in IPosPrinterCallback callback);              // 5
    void setPrinterPrintAlignment(int alignment, in IPosPrinterCallback callback);            // 6
    void printerFeedLines(int lines, in IPosPrinterCallback callback);                        // 7
    void printBlankLines(int lines, int height, in IPosPrinterCallback callback);             // 8
    void printText(String text, in IPosPrinterCallback callback);                             // 9
    void printSpecifiedTypeText(String text, String typeface, int fontsize, in IPosPrinterCallback callback); // 10
    void PrintSpecFormatText(String text, String typeface, int fontsize, int alignment, in IPosPrinterCallback callback); // 11
    void printColumnsText(in String[] colsTextArr, in int[] colsWidthArr, in int[] colsAlign, int isContinuousPrint, in IPosPrinterCallback callback); // 12
    void printBitmap(int alignment, int bitmapSize, in Bitmap bitmap, in IPosPrinterCallback callback); // 13
    void printBarCode(String data, int symbology, int height, int width, int textposition, in IPosPrinterCallback callback); // 14
    void printQRCode(String data, int modulesize, int errorlevel, in IPosPrinterCallback callback); // 15
    void printRawData(in byte[] rawPrintData, in IPosPrinterCallback callback);               // 16
    void sendUserCMDData(in byte[] data, in IPosPrinterCallback callback);                    // 17
    void printerPerformPrint(int feedlines, in IPosPrinterCallback callback);                 // 18
    void printBoldText(String text, String typeface, int fontsize, int alignment, in IPosPrinterCallback callback); // 19
}
