import AppKit

@main struct SpriteCheck {
    static func pixels(_ img: CGImage) -> [UInt8] {
        var px = [UInt8](repeating: 0, count: img.width * img.height * 4)
        px.withUnsafeMutableBytes { b in
            let c = CGContext(data: b.baseAddress, width: img.width, height: img.height, bitsPerComponent: 8, bytesPerRow: img.width * 4,
                              space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
            c.draw(img, in: CGRect(x: 0, y: 0, width: img.width, height: img.height))
        }
        return px
    }
    static func image(_ px: [UInt8], _ w: Int, _ h: Int) -> CGImage {
        CGImage(width: w, height: h, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: w * 4,
                space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.premultipliedLast.rawValue),
                provider: CGDataProvider(data: Data(px) as CFData)!, decode: nil, shouldInterpolate: true, intent: .defaultIntent)!
    }
    static func save(_ img: CGImage, _ path: String) {
        let rep = NSBitmapImageRep(cgImage: img)
        try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: path))
    }
    static func main() {
        let out = CommandLine.arguments[1]
        // Transparent, half-transparent colour, opaque black (must not disappear), opaque colour.
        let rgba: [UInt8] = [0,0,0,0, 0,80,120,128, 0,0,0,255, 40,220,255,255]
        save(image(rgba, 4, 1), out + "/rgba-test.png")
        let original = Sprites.load(URL(fileURLWithPath: out + "/rgba-test.png"))!
        for solid in [false, true] { precondition(pixels(Sprites.key(original, solid: solid)) == pixels(original), "RGBA alpha/colour changed") }
        let rgb: [UInt8] = [0,0,0,255, 4,16,20,255, 10,70,90,255, 50,200,240,255]
        let keyed = Sprites.key(image(rgb, 4, 1), solid: false), p = pixels(keyed)
        precondition(p[3] == 0 && p[7] > 0 && p[7] < 255 && p[11] == 255 && p[15] == 255, "Legacy matte lost its soft edge")
        precondition(p[5] >= 12, "Legacy edge was multiplied by alpha twice")
        // A magnified, native compositing control on a mid-tone background.
        let ctx = CGContext(data: nil, width: 960, height: 300, bitsPerComponent: 8, bytesPerRow: 0,
                            space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        ctx.setFillColor(RGB(0x34485c).cg()); ctx.fill(CGRect(x: 0, y: 0, width: 960, height: 300))
        ctx.interpolationQuality = .none
        ctx.draw(Sprites.key(original, solid: true), in: CGRect(x: 40, y: 70, width: 400, height: 160))
        ctx.draw(keyed, in: CGRect(x: 520, y: 70, width: 400, height: 160))
        save(ctx.makeImage()!, out + "/shots/s1-after-native-alpha-control.png")
        print("PASS: RGBA preserved for solid/scenery, legacy alpha is soft, edge is not double-premultiplied")
    }
}
