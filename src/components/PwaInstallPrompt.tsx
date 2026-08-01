import React, { useState, useEffect } from "react";
import { ThemeColors } from "../types";
import { Download, Share, PlusSquare, Smartphone, X, Check, Info, Sparkles } from "lucide-react";

interface PwaInstallPromptProps {
  t: ThemeColors;
}

export const PwaInstallPrompt: React.FC<PwaInstallPromptProps> = ({ t }) => {
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [isAndroid, setIsAndroid] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    return localStorage.getItem("pwa_install_dismissed") === "true";
  });
  const [showModal, setShowModal] = useState<boolean>(false);
  const [installedSuccess, setInstalledSuccess] = useState<boolean>(false);

  useEffect(() => {
    // Check if app is running in standalone mode (already installed as PWA)
    const checkStandalone = () => {
      const matchStandalone = window.matchMedia("(display-mode: standalone)").matches;
      const isNavStandalone = (window.navigator as any).standalone === true;
      const isAndroidApp = document.referrer.includes("android-app://");
      return matchStandalone || isNavStandalone || isAndroidApp;
    };

    if (checkStandalone()) {
      setIsStandalone(true);
      return;
    }

    // Platform detection
    const ua = navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const androidDevice = /android/.test(ua);

    setIsIOS(iosDevice);
    setIsAndroid(androidDevice);

    // Capture beforeinstallprompt for Android / Chrome / Chromium browsers
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Auto-open prompt modal if not previously dismissed
      if (!isDismissed) {
        setShowModal(true);
      }
    };

    const handleAppInstalled = () => {
      setIsStandalone(true);
      setShowModal(false);
      setInstalledSuccess(true);
      setTimeout(() => setInstalledSuccess(false), 5000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // If iOS and not dismissed, show modal after brief delay
    if (iosDevice && !isDismissed) {
      const timer = setTimeout(() => setShowModal(true), 1500);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [isDismissed]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          console.log("[PWA] User accepted installation prompt");
          setInstalledSuccess(true);
          setShowModal(false);
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn("[PWA] Error triggering install prompt:", err);
      }
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    setShowModal(false);
    localStorage.setItem("pwa_install_dismissed", "true");
  };

  const handleResetDismiss = () => {
    setIsDismissed(false);
    setShowModal(true);
  };

  if (isStandalone) {
    return null;
  }

  return (
    <>
      {/* Floating mini trigger button if user dismissed banner but wants to install */}
      {isDismissed && !showModal && (
        <button
          onClick={handleResetDismiss}
          style={{
            position: "fixed",
            bottom: "16px",
            right: "16px",
            zIndex: 9990,
            background: t.accent,
            color: "#FFFFFF",
            padding: "8px 14px",
            borderRadius: "24px",
            boxShadow: t.shadow,
            border: "none",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
            backdropFilter: "blur(8px)"
          }}
          title="Instalar aplicativo no seu celular"
        >
          <Smartphone size={15} />
          <span>Instalar App</span>
        </button>
      )}

      {/* Main Installation Banner / Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            backgroundColor: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            padding: "16px",
            animation: "fadeIn 0.25s ease-out"
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "460px",
              backgroundColor: t.surface,
              borderRadius: "20px",
              border: `1px solid ${t.border}`,
              padding: "20px",
              boxShadow: t.shadow,
              color: t.text,
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              position: "relative"
            }}
          >
            {/* Close button */}
            <button
              onClick={handleDismiss}
              style={{
                position: "absolute",
                top: "14px",
                right: "14px",
                background: "transparent",
                border: "none",
                color: t.textSub,
                cursor: "pointer",
                padding: "6px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <X size={18} />
            </button>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: t.accentGlow,
                  border: `1px solid ${t.borderFocus}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: t.accent,
                  flexShrink: 0
                }}
              >
                <Smartphone size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: t.text }}>
                  Instalar Ponto Digital
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: t.textSub }}>
                  Acesso rápido, funcionamento offline e sem ocupar memória.
                </p>
              </div>
            </div>

            {/* iOS Instructions */}
            {isIOS ? (
              <div
                style={{
                  backgroundColor: t.surfaceAlt,
                  borderRadius: "14px",
                  padding: "14px",
                  border: `1px solid ${t.border}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px"
                }}
              >
                <div style={{ fontSize: "12.5px", fontWeight: 600, color: t.text, display: "flex", alignItems: "center", gap: "6px" }}>
                  <Sparkles size={14} color={t.accent} />
                  <span>Passo a passo para iPhone / iPad (Safari):</span>
                </div>
                
                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "12px", color: t.text }}>
                  <span style={{ background: t.accent, color: "#fff", width: "20px", height: "20px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, flexShrink: 0 }}>1</span>
                  <span>
                    Toque no botão <strong>Compartilhar</strong> <Share size={14} style={{ display: "inline", verticalAlign: "middle", margin: "0 2px" }} /> na barra inferior ou superior do Safari.
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "12px", color: t.text }}>
                  <span style={{ background: t.accent, color: "#fff", width: "20px", height: "20px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, flexShrink: 0 }}>2</span>
                  <span>
                    Role o menu e selecione <PlusSquare size={14} style={{ display: "inline", verticalAlign: "middle", margin: "0 2px" }} /> <strong>Adicionar à Tela de Início</strong>.
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "12px", color: t.text }}>
                  <span style={{ background: t.accent, color: "#fff", width: "20px", height: "20px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, flexShrink: 0 }}>3</span>
                  <span>
                    Toque em <strong>Adicionar</strong> no canto superior direito para concluir.
                  </span>
                </div>
              </div>
            ) : isAndroid && deferredPrompt ? (
              /* Android Prompt ready */
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <p style={{ margin: 0, fontSize: "12.5px", color: t.textSub }}>
                  Instale o aplicativo diretamente no seu dispositivo Android para bater ponto com um toque mesmo sem internet.
                </p>
                <button
                  onClick={handleInstallClick}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "12px",
                    background: t.accent,
                    color: "#FFFFFF",
                    border: "none",
                    fontWeight: 700,
                    fontSize: "14px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    boxShadow: t.shadow
                  }}
                >
                  <Download size={18} />
                  <span>Instalar Agora</span>
                </button>
              </div>
            ) : (
              /* Generic Android / Desktop Fallback Instructions */
              <div
                style={{
                  backgroundColor: t.surfaceAlt,
                  borderRadius: "14px",
                  padding: "12px",
                  border: `1px solid ${t.border}`,
                  fontSize: "12px",
                  color: t.textSub,
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px"
                }}
              >
                <div style={{ fontWeight: 600, color: t.text, display: "flex", alignItems: "center", gap: "6px" }}>
                  <Info size={14} color={t.accent} />
                  <span>Instruções de instalação:</span>
                </div>
                <span>
                  No Chrome, Edge ou Brave, clique no menu de opções (⋮ ou ícone de instalação na barra de endereço) e selecione <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
                </span>
              </div>
            )}

            {/* Footer action buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                onClick={handleDismiss}
                style={{
                  padding: "8px 16px",
                  borderRadius: "10px",
                  background: t.surfaceAlt,
                  border: `1px solid ${t.border}`,
                  color: t.textSub,
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Agora não
              </button>
              {isIOS && (
                <button
                  onClick={handleDismiss}
                  style={{
                    padding: "8px 18px",
                    borderRadius: "10px",
                    background: t.accent,
                    border: "none",
                    color: "#FFFFFF",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                >
                  Entendi
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {installedSuccess && (
        <div
          style={{
            position: "fixed",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            backgroundColor: t.success,
            color: "#FFFFFF",
            padding: "10px 18px",
            borderRadius: "30px",
            boxShadow: t.shadow,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "13px",
            fontWeight: 600,
            animation: "fadeIn 0.3s ease-out"
          }}
        >
          <Check size={16} />
          <span>Aplicativo Ponto Digital instalado com sucesso!</span>
        </div>
      )}
    </>
  );
};
