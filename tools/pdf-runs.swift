// Dumps every page of a PDF as JSON: text runs (font name, size, text, x, y) and hyperlinks (text, url).
// macOS only (PDFKit). Usage: pdf-runs <file.pdf>   (JSON on stdout; PDFKit's own log noise goes to stderr)
import PDFKit
import AppKit
import Foundation

let args = CommandLine.arguments
guard args.count > 1, let doc = PDFDocument(url: URL(fileURLWithPath: args[1])) else {
  FileHandle.standardError.write("cannot open PDF\n".data(using: .utf8)!)
  exit(1)
}
var pages: [[String: Any]] = []
for i in 0..<doc.pageCount {
  guard let page = doc.page(at: i) else { continue }
  var runs: [[String: Any]] = []
  if let attr = page.attributedString {
    attr.enumerateAttributes(in: NSRange(location: 0, length: attr.length)) { attrs, range, _ in
      let font = attrs[.font] as? NSFont
      // Position of the run's first line (PDF space: origin bottom-left), so callers can restore reading order.
      let box = page.selection(for: NSRange(location: range.location, length: min(range.length, 1)))?.bounds(for: page) ?? .zero
      runs.append(["font": font?.fontName ?? "", "size": Double(font?.pointSize ?? 0), "text": (attr.string as NSString).substring(with: range), "x": Double(box.minX), "y": Double(box.maxY)])
    }
  }
  var links: [[String: String]] = []
  for annotation in page.annotations {
    if let url = annotation.url {
      links.append(["text": page.selection(for: annotation.bounds)?.string ?? "", "url": url.absoluteString])
    }
  }
  pages.append(["runs": runs, "links": links])
}
FileHandle.standardOutput.write(try! JSONSerialization.data(withJSONObject: pages))
