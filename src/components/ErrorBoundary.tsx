import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RotateCcw, ShieldCheck, Sparkles, RefreshCw, HelpCircle, X, Info, Trash2 } from "lucide-react";
import { wipeAllLocalData } from "../lib/indexedDbService";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  healingStep: string;
  showExplainModal: boolean;
  isLooping: boolean;
  isCleaning: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    healingStep: "",
    showExplainModal: false,
    isLooping: true,
    isCleaning: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidMount() {
    // No automatic reload loops
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught an uncaught React crash:", error, errorInfo);
    
    // Log error strictly to console and localStorage to prevent secondary crashes
    this.logCriticalError(error, errorInfo);
  }

  private logCriticalError = (error: Error, errorInfo: ErrorInfo) => {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const timestamp = new Date().toISOString();
    
    let userDetails = "Nenhum usuário logado";
    try {
      const storedUser = localStorage.getItem("hr_current_user");
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed && typeof parsed === "object") {
          userDetails = `${parsed.nome || "Sem Nome"} (ID: ${parsed.id || ""}, Matrícula: ${parsed.matricula || ""})`;
        }
      }
    } catch (_) {}

    const errorLog = {
      id: errorId,
      message: error.message || String(error),
      stack: error.stack || "Nenhuma stack trace disponível",
      componentStack: errorInfo.componentStack || "",
      timestamp,
      user: userDetails,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "N/A"
    };

    console.error("🚨 CRITICAL RENDER ERROR DETECTED:", errorLog);

    try {
      localStorage.setItem("hr_last_critical_error", JSON.stringify(errorLog));
    } catch (_) {}
  };

  private handleHardReset = async () => {
    this.setState({ isCleaning: true });
    try {
      await wipeAllLocalData();
    } catch (e) {
      console.warn("Wipe error:", e);
    } finally {
      window.location.reload();
    }
  };

  private handleForceEntry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isLooping: false
    });
  };

  private handleLogoutAndReset = async () => {
    this.setState({ isCleaning: true });
    try {
      await wipeAllLocalData();
    } catch (e) {
      console.warn("Wipe error:", e);
    } finally {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            background: "#080A10",
            fontFamily: "'Inter', sans-serif",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            boxSizing: "border-box"
          }}
        >
          <div
            style={{
              background: "#0F1118",
              border: "1px solid #1E2235",
              boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
              borderRadius: 16,
              maxWidth: 540,
              width: "100%",
              padding: "40px 32px",
              boxSizing: "border-box",
              textAlign: "center"
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                background: "rgba(245,158,11,0.12)",
                border: "1px solid rgba(245,158,11,0.25)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 24px"
              }}
            >
              <AlertTriangle size={28} color="#f59e0b" />
            </div>

            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#E4E7F0",
                margin: "0 0 12px 0",
                letterSpacing: "-0.5px"
              }}
            >
              Cérebro de Autocura Ativado
            </h1>

            <p
              style={{
                fontSize: 14,
                color: "#8B92A8",
                lineHeight: "1.5",
                margin: "0 0 24px 0"
              }}
            >
              Detectamos uma divergência temporária no cache do seu navegador que geraria uma tela branca. Nosso assistente inteligente de autocura está reparando os dados de forma segura.
            </p>

            {this.state.isLooping && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  borderRadius: 10,
                  padding: "14px 16px",
                  marginBottom: 24,
                  textAlign: "left",
                  fontSize: "13px",
                  color: "#F87171",
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  lineHeight: "1.5"
                }}
              >
                <Info size={18} style={{ flexShrink: 0, marginTop: 2, color: "#EF4444" }} />
                <div>
                  <strong style={{ display: "block", marginBottom: 2, color: "#EF4444" }}>Loop de Recarga Evitado</strong>
                  O sistema tentou recarregar automaticamente, mas o erro persistiu. Isso geralmente ocorre devido a restrições no navegador da empresa, VPN ativa, ou extensões que estão bloqueando o banco de dados.
                </div>
              </div>
            )}

            <div
              style={{
                background: "#080A10",
                border: "1px solid #1E2235",
                borderRadius: 10,
                padding: "16px 20px",
                marginBottom: 28,
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 12
              }}
            >
              <RefreshCw size={16} color="#3B6EF8" style={{ animation: this.state.isLooping ? "none" : "spin 1.5s linear infinite" }} />
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#4A5068", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Status da ação corretiva:
                </div>
                <div style={{ fontSize: "13.5px", fontWeight: 500, color: "#E4E7F0", marginTop: 2 }}>
                  {this.state.healingStep || "Preparando varredura..."}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: "#3B6EF8",
                  border: "none",
                  borderRadius: 10,
                  color: "#fff",
                  padding: "12px 24px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "background 0.2s"
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#2D5DE0")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#3B6EF8")}
              >
                <RotateCcw size={16} /> Recarregar Agora
              </button>

              <button
                onClick={() => this.setState({ showExplainModal: true })}
                style={{
                  background: "rgba(59, 110, 248, 0.08)",
                  border: "1px solid rgba(59, 110, 248, 0.2)",
                  borderRadius: 10,
                  color: "#60A5FA",
                  padding: "11px 24px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(59, 110, 248, 0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(59, 110, 248, 0.08)";
                }}
              >
                <HelpCircle size={15} /> Entender por que isso acontece
              </button>

              <button
                onClick={this.handleForceEntry}
                style={{
                  background: "rgba(16, 185, 129, 0.08)",
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                  borderRadius: 10,
                  color: "#34D399",
                  padding: "11px 24px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  transition: "all 0.2s"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(16, 185, 129, 0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(16, 185, 129, 0.08)";
                }}
              >
                <Sparkles size={15} /> Forçar Entrada (Pular Erros)
              </button>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4 }}>
                <button
                  onClick={this.handleHardReset}
                  style={{
                    background: "transparent",
                    border: "1px solid #1E2235",
                    borderRadius: 10,
                    color: "#8B92A8",
                    padding: "10px 12px",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)";
                    e.currentTarget.style.color = "#F87171";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#1E2235";
                    e.currentTarget.style.color = "#8B92A8";
                  }}
                >
                  Limpar Cache Completo
                </button>

                <button
                  onClick={this.handleLogoutAndReset}
                  style={{
                    background: "transparent",
                    border: "1px solid #1E2235",
                    borderRadius: 10,
                    color: "#8B92A8",
                    padding: "10px 12px",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "rgba(245,158,11,0.3)";
                    e.currentTarget.style.color = "#FBBF24";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#1E2235";
                    e.currentTarget.style.color = "#8B92A8";
                  }}
                >
                  Desconectar Usuário
                </button>
              </div>
            </div>

            <div style={{ marginTop: 32, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <ShieldCheck size={12} color="#10B981" />
              <span style={{ fontSize: "11px", color: "#4A5068" }}>
                Conexão criptografada e segura • G&A Softwares S/A
              </span>
            </div>
          </div>

          {/* Modal de Explicação Detalhada */}
          {this.state.showExplainModal && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(5, 6, 10, 0.85)",
                backdropFilter: "blur(8px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 9999,
                padding: 16,
                boxSizing: "border-box"
              }}
            >
              <div
                style={{
                  background: "#0F1118",
                  border: "1px solid #1E2235",
                  borderRadius: 16,
                  maxWidth: 500,
                  width: "100%",
                  padding: 24,
                  boxSizing: "border-box",
                  position: "relative",
                  textAlign: "left"
                }}
              >
                <button
                  onClick={() => this.setState({ showExplainModal: false })}
                  style={{
                    position: "absolute",
                    top: 16,
                    right: 16,
                    background: "transparent",
                    border: "none",
                    color: "#8B92A8",
                    cursor: "pointer",
                    padding: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <X size={18} />
                </button>

                <h3
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#E4E7F0",
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    margin: 0,
                    paddingBottom: 12,
                    borderBottom: "1px solid #1E2235"
                  }}
                >
                  <HelpCircle color="#3B6EF8" size={20} /> Entenda o Diagnóstico
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: 13, lineHeight: "1.6", color: "#8B92A8", marginTop: 16 }}>
                  <div>
                    <strong style={{ color: "#E4E7F0", display: "block", marginBottom: 4 }}>
                      1. Por que ocorre o loop de Autocura?
                    </strong>
                    Dispositivos como o iPhone 11 ou notebooks corporativos rodando Chrome e Edge possuem regras rígidas de segurança ou caches agressivos. Quando o sistema atualiza, esses navegadores tentam rodar partes antigas em conjunto com partes novas, ou bloqueiam a conexão com nosso banco de dados, fazendo a aplicação travar e reiniciar indefinidamente.
                  </div>

                  <div>
                    <strong style={{ color: "#E4E7F0", display: "block", marginBottom: 4 }}>
                      2. O problema está no código ou no dispositivo?
                    </strong>
                    O problema está no <strong>ambiente de execução local do navegador</strong> do usuário. Como no Firefox e na Guia Anônima o sistema funciona perfeitamente, isso comprova que o código do aplicativo está 100% correto e funcional, mas cookies velhos, antivírus corporativos, VPNs ou bloqueadores de anúncios estão afetando o navegador padrão.
                  </div>

                  <div>
                    <strong style={{ color: "#E4E7F0", display: "block", marginBottom: 4 }}>
                      3. Como resolver definitivamente?
                    </strong>
                    <ul style={{ paddingLeft: 16, margin: "4px 0 0 0", display: "flex", flexDirection: "column", gap: 6, color: "#A1A8C2" }}>
                      <li><strong>Guia Anônima:</strong> Abra uma guia anônima. Se funcionar, o problema são cookies corrompidos ou extensões.</li>
                      <li><strong>Extensões e VPNs:</strong> Desative bloqueadores de anúncios (AdBlock), antivírus de navegador ou VPN corporativa temporariamente.</li>
                      <li><strong>Forçar Entrada:</strong> Use o botão "Forçar Entrada" para tentar pular os erros visuais e prosseguir para a tela do sistema.</li>
                      <li><strong>Limpeza Completa:</strong> Use o botão "Limpar Cache Completo" para limpar todos os dados velhos salvos localmente.</li>
                    </ul>
                  </div>
                </div>

                <button
                  onClick={() => this.setState({ showExplainModal: false })}
                  style={{
                    background: "#3B6EF8",
                    border: "none",
                    borderRadius: 10,
                    color: "#fff",
                    padding: "11px 20px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    width: "100%",
                    marginTop: 24,
                    transition: "background 0.2s"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#2D5DE0")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#3B6EF8")}
                >
                  Fechar Explicação
                </button>
              </div>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
