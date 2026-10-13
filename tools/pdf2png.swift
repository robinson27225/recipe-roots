// macOS fallback for rasterising PDF pages when poppler's pdftoppm isn't installed.
// Usage: swift tools/pdf2png.swift <in.pdf> <outdir> [scale]
import PDFKit
import AppKit
let a = CommandLine.arguments
guard a.count >= 3, let doc = PDFDocument(url: URL(fileURLWithPath: a[1])) else { print("cannot open"); exit(1) }
let scale = a.count > 3 ? CGFloat(Double(a[3]) ?? 2) : 2
try? FileManager.default.createDirectory(atPath: a[2], withIntermediateDirectories: true)
for i in 0..<doc.pageCount {
  guard let page = doc.page(at: i) else { continue }
  let r = page.bounds(for: .mediaBox)
  let img = NSImage(size: NSSize(width: r.width * scale, height: r.height * scale))
  img.lockFocus()
  NSColor.white.set(); NSRect(origin: .zero, size: img.size).fill()
  let ctx = NSGraphicsContext.current!.cgContext
  ctx.scaleBy(x: scale, y: scale)
  page.draw(with: .mediaBox, to: ctx)
  img.unlockFocus()
  let rep = NSBitmapImageRep(data: img.tiffRepresentation!)!
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "\(a[2])/page-\(String(format: "%03d", i + 1)).png"))
}
print(doc.pageCount)
