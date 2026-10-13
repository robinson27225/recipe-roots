// Recolours the WikiTree heart logo for the cover: the red heart becomes a pastel colour and the white tree is
// knocked out (transparent), so the cover shows through it. macOS only (CoreGraphics).
// Usage: swift tools/recolor-logo.swift <wikitree-heart.png> <out.png> [R G B]   (default pastel yellow 253 236 150)
import AppKit
let a = CommandLine.arguments
guard a.count >= 3, let src = NSImage(contentsOfFile: a[1]), let cg = src.cgImage(forProposedRect: nil, context: nil, hints: nil) else { print("cannot read input"); exit(1) }
let (cr, cgr, cb): (UInt8, UInt8, UInt8) = a.count >= 6 ? (UInt8(a[3]) ?? 253, UInt8(a[4]) ?? 236, UInt8(a[5]) ?? 150) : (253, 236, 150)
let w = cg.width, h = cg.height
var px = [UInt8](repeating: 0, count: w * h * 4)
let ctx = CGContext(data: &px, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
for i in 0..<(w * h) {
  let o = i * 4
  let alpha = Double(px[o + 3]) / 255
  // premultiplied: un-premultiply, then "redness" is how far red sits above green (heart: ~190, white tree: 0)
  let r = alpha > 0 ? Double(px[o]) / alpha : 0, g = alpha > 0 ? Double(px[o + 1]) / alpha : 0
  let keep = alpha * max(0, min(1, (r - g) / 190))
  px[o] = UInt8(Double(cr) * keep); px[o + 1] = UInt8(Double(cgr) * keep); px[o + 2] = UInt8(Double(cb) * keep); px[o + 3] = UInt8(keep * 255)
}
let out = ctx.makeImage()!
let rep = NSBitmapImageRep(cgImage: out)
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: a[2]))
print("wrote \(a[2]) (\(w)x\(h))")
