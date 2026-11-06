import Foundation

@main struct ModelDump {
    static func main() {
        let city = CityModel()
        let blocks = city.lots.filter { !$0.landmark && !$0.owner }.prefix(200)
        let marks = city.lots.filter { $0.landmark }
        for l in Array(blocks) + marks {
            let values = [l.x, l.y, l.size, l.tall, l.brightness, l.scale].map { String(format: "%.9f", locale: Locale(identifier: "en_US_POSIX"), $0) }
            print(([String(l.idx), l.landmark ? "landmark" : "block"] + values + [l.flip ? "1" : "0", l.sprite]).joined(separator: "\t"))
        }
    }
}
