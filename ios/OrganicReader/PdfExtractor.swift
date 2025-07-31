import Foundation
import PDFKit

@objc(PdfExtractor)
class PdfExtractor: NSObject {

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc(extractText:resolver:rejecter:)
  func extractText(_ fileUri: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.global(qos: .userInitiated).async {
      do {
        var url: URL?

        if fileUri.hasPrefix("file://") {
          url = URL(string: fileUri)
        } else if fileUri.hasPrefix("/") {
          url = URL(fileURLWithPath: fileUri)
        } else if fileUri.hasPrefix("file:") {
          url = URL(string: fileUri)
        } else {
          url = URL(fileURLWithPath: fileUri)
        }

        guard let fileUrl = url else {
          reject("INVALID_URI", "Invalid file URI", nil)
          return
        }

        guard let document = PDFDocument(url: fileUrl) else {
          reject("PDF_LOAD_ERROR", "Could not load PDF document", nil)
          return
        }

        var fullText = ""
        let pageCount = document.pageCount

        for i in 0..<pageCount {
          guard let page = document.page(at: i) else { continue }
          if let pageText = page.string {
            if i > 0 {
              fullText += "\n\n"
            }
            fullText += pageText
          }
        }

        if fullText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
          reject("NO_TEXT", "No text found in PDF. The document may be scanned.", nil)
          return
        }

        resolve(fullText)
      } catch {
        reject("PDF_ERROR", error.localizedDescription, error)
      }
    }
  }

  @objc(getPageCount:resolver:rejecter:)
  func getPageCount(_ fileUri: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.global(qos: .userInitiated).async {
      var url: URL?

      if fileUri.hasPrefix("file://") {
        url = URL(string: fileUri)
      } else if fileUri.hasPrefix("/") {
        url = URL(fileURLWithPath: fileUri)
      } else {
        url = URL(fileURLWithPath: fileUri)
      }

      guard let fileUrl = url else {
        reject("INVALID_URI", "Invalid file URI", nil)
        return
      }

      guard let document = PDFDocument(url: fileUrl) else {
        reject("PDF_LOAD_ERROR", "Could not load PDF document", nil)
        return
      }

      resolve(document.pageCount)
    }
  }
}