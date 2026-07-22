import React, { useState } from "react";
import { Calendar, Trash2, ShieldAlert } from "lucide-react";
import { ThemeColors, User } from "../types";
import { Btn } from "./SharedUI";

interface FeriasModalProps {
  user: User;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setModal: (val: any) => void;
  t: ThemeColors;
  addLog: (acao: string, alvo: string, detalhe?: string) => void;
}

export function FeriasModal({ user, users, setUsers, setModal, t, addLog }: FeriasModalProps) {
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const listFerias = user.ferias || [];

  function handleAddPeriodo() {
    setError(null);
    if (!inicio || !fim) {
      setError("Selecione as datas de início e término.");
      return;
    }
    if (inicio > fim) {
      setError("A data de início não pode ser posterior à data de término.");
      return;
    }

    // Verificar sobreposição de férias
    const sobreposicao = listFerias.some(p => {
      return (inicio >= p.inicio && inicio <= p.fim) || 
             (fim >= p.inicio && fim <= p.fim) || 
             (inicio <= p.inicio && fim >= p.fim);
    });

    if (sobreposicao) {
      setError("Erro: Este período coincide com férias já agendadas.");
      return;
    }

    const novoPeriodo = { inicio, fim };
    const updatedFerias = [...listFerias, novoPeriodo];

    // Atualizar no estado de usuários
    setUsers(prev => prev.map(u => {
      if (u.id === user.id) {
        return { ...u, ferias: updatedFerias };
      }
      return u;
    }));

    // Formatar datas para o log de auditoria
    const [yI, mI, dI] = inicio.split("-").map(Number);
    const [yF, mF, dF] = fim.split("-").map(Number);
    const initFmt = new Date(yI, mI - 1, dI).toLocaleDateString("pt-BR");
    const endFmt = new Date(yF, mF - 1, dF).toLocaleDateString("pt-BR");

    addLog(
      "Agendou Férias",
      `${user.nome} (${user.matricula})`,
      `Período cadastrado: de ${initFmt} até ${endFmt}.`
    );

    // Atualizar o modal com o usuário modificado para refletir reativamente na UI
    setModal({ type: "ferias", user: { ...user, ferias: updatedFerias } });
    
    // Limpar os inputs
    setInicio("");
    setFim("");
  }

  function handleRemovePeriodo(idx: number) {
    if (!confirm("Tem certeza que deseja cancelar o agendamento deste período de férias?")) return;

    const periodRemoved = listFerias[idx];
    const updatedFerias = listFerias.filter((_, i) => i !== idx);

    // Atualizar no estado de usuários
    setUsers(prev => prev.map(u => {
      if (u.id === user.id) {
        return { ...u, ferias: updatedFerias };
      }
      return u;
    }));

    // Log de auditoria
    const [yI, mI, dI] = periodRemoved.inicio.split("-").map(Number);
    const [yF, mF, dF] = periodRemoved.fim.split("-").map(Number);
    const initFmt = new Date(yI, mI - 1, dI).toLocaleDateString("pt-BR");
    const endFmt = new Date(yF, mF - 1, dF).toLocaleDateString("pt-BR");

    addLog(
      "Cancelou Férias",
      `${user.nome} (${user.matricula})`,
      `Férias de ${initFmt} até ${endFmt} foram deletadas/canceladas.`
    );

    // Atualizar o modal para reatividade imediata
    setModal({ type: "ferias", user: { ...user, ferias: updatedFerias } });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 500,
        padding: 20
      }}
      onClick={() => setModal(null)}
    >
      <div
        style={{
          background: t.surface,
          border: `1.5px solid ${t.border}`,
          borderRadius: 18,
          padding: "32px 36px",
          width: "100%",
          maxWidth: 480,
          boxShadow: t.shadow
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 4px", color: t.text, fontSize: 18, fontWeight: 700 }}>Programar Férias</h3>
        <p style={{ margin: "0 0 18px", color: t.textSub, fontSize: 13.5 }}>
          {user.nome} • {user.matricula}
        </p>

        {/* Formulário de Adicionar Período */}
        <div style={{ background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text, display: "block", marginBottom: 12 }}>Nova Programação de Férias</span>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Início</label>
              <input
                type="date"
                value={inicio}
                onChange={e => setInicio(e.target.value)}
                style={{
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  borderRadius: 8,
                  color: t.text,
                  fontSize: 13,
                  padding: "6px 10px",
                  outline: "none",
                  width: "100%",
                  fontFamily: "inherit"
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: t.textMuted, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Término</label>
              <input
                type="date"
                value={fim}
                onChange={e => setFim(e.target.value)}
                style={{
                  background: t.surface,
                  border: `1px solid ${t.border}`,
                  borderRadius: 8,
                  color: t.text,
                  fontSize: 13,
                  padding: "6px 10px",
                  outline: "none",
                  width: "100%",
                  fontFamily: "inherit"
                }}
              />
            </div>
          </div>

          {error && (
            <div style={{ color: t.danger, fontSize: 12, fontWeight: 600, display: "flex", gap: 6, alignItems: "center", marginBottom: 12 }}>
              <ShieldAlert size={14} />
              {error}
            </div>
          )}

          <Btn onClick={handleAddPeriodo} t={t} style={{ width: "100%", padding: "8px 12px", fontSize: 12.5 }}>
            Agendar Férias
          </Btn>
        </div>

        {/* Histórico / Lista de Períodos */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text, display: "block" }}>Cronograma Atual ({listFerias.length})</span>
          
          <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, paddingRight: 4 }}>
            {listFerias.length === 0 ? (
              <div style={{ color: t.textMuted, fontSize: 12, textAlign: "center", padding: "16px 0", border: `1px dashed ${t.border}`, borderRadius: 8 }}>
                Nenhum período de férias programado ainda.
              </div>
            ) : (
              listFerias
                .slice()
                .sort((a,b) => a.inicio.localeCompare(b.inicio))
                .map((p, idx) => {
                  const [yI, mI, dI] = p.inicio.split("-").map(Number);
                  const [yF, mF, dF] = p.fim.split("-").map(Number);
                  const initFmt = new Date(yI, mI - 1, dI).toLocaleDateString("pt-BR");
                  const endFmt = new Date(yF, mF - 1, dF).toLocaleDateString("pt-BR");
                  
                  // Identificar se o período está ativo hoje ou é futuro
                  const hojeStr = new Date().toISOString().slice(0, 10);
                  const ativo = hojeStr >= p.inicio && hojeStr <= p.fim;
                  
                  return (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        background: ativo ? t.successBg : t.surfaceAlt,
                        border: `1.5px solid ${ativo ? t.successBorder : t.border}`,
                        borderRadius: 10,
                        padding: "8px 14px"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Calendar size={14} color={ativo ? t.success : t.textMuted} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>
                            {initFmt} — {endFmt}
                          </div>
                          {ativo && <span style={{ fontSize: 9, fontWeight: 700, color: t.success }}>PERÍODO ATIVO HOJE</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemovePeriodo(idx)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: t.danger,
                          padding: 6,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 6,
                          transition: "background 0.2s"
                        }}
                        title="Remover período de férias"
                      >
                        <Trash2 size={13.5} />
                      </button>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* Botão Fechar */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
          <Btn onClick={() => setModal(null)} variant="ghost" t={t} small>
            Fechar
          </Btn>
        </div>
      </div>
    </div>
  );
}
