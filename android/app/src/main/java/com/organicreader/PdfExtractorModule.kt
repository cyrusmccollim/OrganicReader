package com.organicreader

import android.net.Uri
import com.facebook.react.bridge.*
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.text.PDFTextStripper
import java.io.InputStream

class PdfExtractorModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "PdfExtractor"

    override fun initialize() {
        super.initialize()
        PDFBoxResourceLoader.init(reactApplicationContext)
    }

    @ReactMethod
    fun extractText(fileUri: String, promise: Promise) {
        Thread {
            try {
                val inputStream: InputStream = when {
                    fileUri.startsWith("content://") -> {
                        reactApplicationContext.contentResolver.openInputStream(Uri.parse(fileUri))
                    }
                    fileUri.startsWith("file://") -> {
                        reactApplicationContext.contentResolver.openInputStream(Uri.parse(fileUri))
                            ?: java.io.File(fileUri.substring(7)).inputStream()
                    }
                    else -> {
                        java.io.File(fileUri).inputStream()
                    }
                } ?: throw Exception("Could not open file: $fileUri")

                val document = PDDocument.load(inputStream)
                val stripper = PDFTextStripper()
                val text = stripper.getText(document)
                document.close()
                inputStream.close()

                promise.resolve(text)
            } catch (e: Exception) {
                promise.reject("PDF_ERROR", e.message ?: "Failed to extract PDF text")
            }
        }.start()
    }

    @ReactMethod
    fun getPageCount(fileUri: String, promise: Promise) {
        Thread {
            try {
                val inputStream: InputStream = when {
                    fileUri.startsWith("content://") -> {
                        reactApplicationContext.contentResolver.openInputStream(Uri.parse(fileUri))
                    }
                    fileUri.startsWith("file://") -> {
                        reactApplicationContext.contentResolver.openInputStream(Uri.parse(fileUri))
                            ?: java.io.File(fileUri.substring(7)).inputStream()
                    }
                    else -> {
                        java.io.File(fileUri).inputStream()
                    }
                } ?: throw Exception("Could not open file: $fileUri")

                val document = PDDocument.load(inputStream)
                val pageCount = document.numberOfPages
                document.close()
                inputStream.close()

                promise.resolve(pageCount)
            } catch (e: Exception) {
                promise.reject("PDF_ERROR", e.message ?: "Failed to get page count")
            }
        }.start()
    }
}