// Copyright (c) 2026 SONARA Industries. All rights reserved.
// Proprietary source. No licence is granted; see LICENSE.
import SwiftUI
import WebKit

// Deliberately limited to public, read-only pages for internal device proof.
// No payment flow, login, push, location, camera, microphone or file access.
@main
struct SonaraPilotApp: App {
    var body: some Scene {
        WindowGroup {
            PilotHomeView()
        }
    }
}

private struct PilotHomeView: View {
    @State private var showPublicPreview = false
    @State private var navigationStatus = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 18) {
                if showPublicPreview {
                    PublicPageWebView(navigationStatus: $navigationStatus)
                        .accessibilityLabel("SONARA public website preview")
                } else {
                    Image(systemName: "shield.lefthalf.filled")
                        .font(.system(size: 42))
                        .accessibilityHidden(true)
                    Text("SONARA iOS Pilot")
                        .font(.title2).bold()
                    Text("Internal testing only. This version opens approved public pages. Account access, purchases and private workflows are intentionally disabled.")
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                    Button("Open public preview") { showPublicPreview = true }
                        .buttonStyle(.borderedProminent)
                }
                if !navigationStatus.isEmpty {
                    Text(navigationStatus)
                        .font(.footnote)
                        .accessibilityAddTraits(.updatesFrequently)
                        .multilineTextAlignment(.center)
                }
            }
            .navigationTitle("SONARA")
            .toolbar {
                if showPublicPreview {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Close") { showPublicPreview = false }
                    }
                }
            }
        }
    }
}

// WKWebView never receives business credentials or a JavaScript bridge.
// Restrict the first pilot to publicly reviewable pages. All other paths
// are denied, including digital checkout, private workspace and account routes.
private struct PublicPageWebView: UIViewRepresentable {
    @Binding var navigationStatus: String

    private static let allowedHost = "sonaraindustries.com"
    private static let allowedPaths: Set<String> = [
        "/", "/about", "/privacy", "/terms"
    ]

    func makeCoordinator() -> Coordinator {
        Coordinator(onStatus: { navigationStatus = $0 })
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = false
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = context.coordinator
        view.allowsBackForwardNavigationGestures = false
        view.load(URLRequest(url: URL(string: "https://sonaraindustries.com/")!,
                             cachePolicy: .reloadIgnoringLocalCacheData))
        return view
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate {
        private let onStatus: (String) -> Void

        init(onStatus: @escaping (String) -> Void) {
            self.onStatus = onStatus
        }

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url,
                  url.scheme?.lowercased() == "https",
                  url.host?.lowercased() == PublicPageWebView.allowedHost,
                  PublicPageWebView.allowedPaths.contains(url.path)
            else {
                onStatus("This pilot does not open accounts, checkout or outside websites.")
                decisionHandler(.cancel)
                return
            }
            onStatus("")
            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!,
                     withError error: Error) {
            onStatus("Website unavailable. No offline customer data is stored.")
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!,
                     withError error: Error) {
            onStatus("The page could not load. Please try after the website is available.")
        }
    }
}
