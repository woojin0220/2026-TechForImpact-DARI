import Capacitor

final class DariBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(MlKitTranslationPlugin())
    }
}
