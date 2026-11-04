// Angola 365º — app iPhone
// Abre a plataforma (https://turismo-digital-360.vercel.app) num WKWebView com as funções do telemóvel:
// localização, câmara e fotografias para carregar imagens, microfone para a ENDA, partilha,
// ligações externas (táxis, transportadoras, mapas, WhatsApp, telefone) abertas nas apps certas.
import SwiftUI
import WebKit

@main
struct Angola365App: App {
    var body: some Scene {
        WindowGroup {
            PlataformaView()
                .ignoresSafeArea(.container, edges: .bottom)
                .background(Color(red: 0.055, green: 0.075, blue: 0.141))
        }
    }
}

enum Config {
    static let inicio = URL(string: "https://turismo-digital-360.vercel.app/")!
    static let dominio = "turismo-digital-360.vercel.app"
    static let agente = "Angola365-iOS/1.0"
}

struct PlataformaView: UIViewRepresentable {
    func makeCoordinator() -> Coordenador { Coordenador() }

    func makeUIView(context: Context) -> WKWebView {
        let conf = WKWebViewConfiguration()
        conf.limitsNavigationsToAppBoundDomains = true
        conf.allowsInlineMediaPlayback = true
        conf.websiteDataStore = .default()
        conf.applicationNameForUserAgent = Config.agente
        let web = WKWebView(frame: .zero, configuration: conf)
        web.navigationDelegate = context.coordinator
        web.uiDelegate = context.coordinator
        web.allowsBackForwardNavigationGestures = true
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.055, green: 0.075, blue: 0.141, alpha: 1)
        let refresh = UIRefreshControl()
        refresh.addTarget(context.coordinator, action: #selector(Coordenador.recarregar(_:)), for: .valueChanged)
        web.scrollView.refreshControl = refresh
        context.coordinator.web = web
        web.load(URLRequest(url: Config.inicio))
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

final class Coordenador: NSObject, WKNavigationDelegate, WKUIDelegate {
    weak var web: WKWebView?
    private var janelas: [WKWebView] = []

    @objc func recarregar(_ sender: UIRefreshControl) {
        if web?.url == nil || web?.url?.scheme == "about" { web?.load(URLRequest(url: Config.inicio)) } else { web?.reload() }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1) { sender.endRefreshing() }
    }

    private func interna(_ url: URL) -> Bool {
        guard let h = url.host else { return url.scheme == "about" || url.scheme == "blob" || url.scheme == "data" }
        return h == Config.dominio
    }

    // Ligações para fora da plataforma: abrem no Safari ou na app respectiva (Yango, Waze, WhatsApp, telefone…)
    private func abrirFora(_ url: URL) {
        var destino = url
        if url.scheme == "geo" { // geo:lat,lon?q=… não existe no iPhone: usa os Mapas da Apple
            let corpo = url.absoluteString.replacingOccurrences(of: "geo:", with: "")
            let ll = corpo.split(separator: "?").first.map(String.init) ?? ""
            if let u = URL(string: "https://maps.apple.com/?ll=\(ll)&q=\(ll)") { destino = u }
        }
        UIApplication.shared.open(destino, options: [:], completionHandler: nil)
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { return decisionHandler(.cancel) }
        if interna(url) {
            // descarga do APK Android não faz sentido no iPhone
            if url.path.hasPrefix("/api/app/") { return decisionHandler(.cancel) }
            return decisionHandler(.allow)
        }
        abrirFora(url)
        decisionHandler(.cancel)
        if webView !== web { fecharJanela(webView) }
    }

    // window.open / target=_blank: o site abre 'about:blank' e depois muda o endereço (COMO VIAJAR)
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url, url.scheme != "about", !url.absoluteString.isEmpty {
            if interna(url) { webView.load(action.request) } else { abrirFora(url) }
            return nil
        }
        let janela = WKWebView(frame: .zero, configuration: configuration)
        janela.navigationDelegate = self
        janela.uiDelegate = self
        janelas.append(janela)
        return janela
    }

    func webViewDidClose(_ webView: WKWebView) { fecharJanela(webView) }
    private func fecharJanela(_ w: WKWebView) { janelas.removeAll { $0 === w } }

    // Câmara e microfone: o próprio iOS pergunta ao utilizador (textos no Info.plist)
    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(origin.host == Config.dominio ? .prompt : .deny)
    }

    // Alertas e confirmações do site
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        mostrar(message, cancelar: false) { _ in completionHandler() }
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        mostrar(message, cancelar: true, completionHandler)
    }
    private func mostrar(_ msg: String, cancelar: Bool, _ fim: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: msg, preferredStyle: .alert)
        if cancelar { a.addAction(UIAlertAction(title: "Cancelar", style: .cancel) { _ in fim(false) }) }
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in fim(true) })
        topo()?.present(a, animated: true)
    }
    private func topo() -> UIViewController? {
        let cena = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first
        var vc = cena?.windows.first(where: { $0.isKeyWindow })?.rootViewController
        while let p = vc?.presentedViewController { vc = p }
        return vc
    }

    // Sem internet: página própria com botão para tentar outra vez
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let e = error as NSError
        if e.domain == NSURLErrorDomain && e.code == NSURLErrorCancelled { return }
        if webView === web { webView.loadHTMLString(Coordenador.semLigacao, baseURL: nil) }
    }

    static let semLigacao = """
    <!doctype html><html lang="pt"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    body{margin:0;font-family:-apple-system,system-ui,sans-serif;background:#0E1324;color:#fff;display:grid;place-items:center;min-height:100vh;text-align:center}
    a{display:inline-block;margin-top:18px;padding:14px 26px;border-radius:999px;background:#C8102E;color:#fff;text-decoration:none;font-weight:700}
    p{opacity:.85;max-width:300px;margin:10px auto 0}</style></head><body><div><h2>Sem ligação à internet</h2>
    <p>Verifique os dados móveis ou o Wi-Fi e tente outra vez.</p><a href="https://turismo-digital-360.vercel.app/">Tentar outra vez</a></div></body></html>
    """
}
