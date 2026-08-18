import React from "react";
import { ThemeColors, Jornada } from "../types";
import { JORNADAS_PREDEFINIDAS } from "../data/mockData";

interface ModalJornadaProps {
  t: ThemeColors;
  userId: number;
  users: any[];
  jornadaId: string;
  setJornadaId: (val: string) => void;
  jornadaCustom: Jornada;
  setJornadaCustom: React.Dispatch<React.SetStateAction<Jornada>>;
  onSalvar: (userId: number) => void;
  onFechar: () => void;
  DIAS: string[];
}

export function ModalJornada({
  t,
  userId,
  users,
  jornadaId,
  setJornadaId,
  jornadaCustom,
  setJornadaCustom,
  onSalvar,
  onFechar,
  DIAS
}: ModalJornadaProps) {
  const u = users.find(x => x.id === userId);

  function toggleDia(diaIdx: number) {
    setJornadaCustom(prev => {
      const dias = prev.diasSemana.includes(diaIdx)
        ? prev.diasSemana.filter(x => x !== diaIdx)
        : [...prev.diasSemana, diaIdx].sort();
      return { ...prev, diasSemana: dias };
    });
  }

  function handleCustomTime(campo: string, val: string) {
    setJornadaCustom(prev => {
      const p = { ...prev, [campo]: val };

      if (!p.entrada || !p.saida) return p;

      // Calculate simple hours supporting overnight shift
      const [eh, em] = p.entrada.split(":").map(Number);
      const [sh, sm] = p.saida.split(":").map(Number);
      let diffMin = (sh * 60 + sm) - (eh * 60 + em);
      if (diffMin <= 0) diffMin += 1440;

      if (p.saidaAlmoco && p.retornoAlmoco) {
        const [ah, am] = p.saidaAlmoco.split(":").map(Number);
        const [rh, rm] = p.retornoAlmoco.split(":").map(Number);
        let intervalMin = (rh * 60 + rm) - (ah * 60 + am);
        if (intervalMin < 0) intervalMin += 1440;
        diffMin -= intervalMin;
      }

      const h = Number((Math.max(0, diffMin) / 60).toFixed(2));
      return { ...p, horasDia: h };
    });
  }

  const isCustom = jornadaId === "personalizada";

  const totalHorasSemanais = React.useMemo(() => {
    let total = 0;
    jornadaCustom.diasSemana.forEach(diaIdx => {
      if (diaIdx === 6 && jornadaCustom.sabadoEspecial) {
        total += jornadaCustom.sabadoHoras ?? 4;
      } else {
        total += jornadaCustom.horasDia || 0;
      }
    });
    return Number(total.toFixed(2));
  }, [jornadaCustom]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 700,
        padding: 20
      }}
      onClick={onFechar}
    >
      <div
        style={{
          background: t.surface,
          border: `1.5px solid ${t.border}`,
          borderRadius: 20,
          width: "100%",
          maxWidth: 450,
          boxShadow: t.shadow,
          maxHeight: "90vh",
          overflowY: "auto"
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ padding: "24px 28px 16px", borderBottom: `1.5px solid ${t.border}` }}>
          <h3 style={{ margin: "0 0 4px", color: t.text, fontSize: 17, fontWeight: 700 }}>Definir Jornada</h3>
          <p style={{ margin: 0, color: t.textSub, fontSize: 13 }}>{u?.nome}</p>
        </div>

        <div style={{ padding: "20px 28px 24px" }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, color: t.textSub, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Selecione o modelo de jornada
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {JORNADAS_PREDEFINIDAS.map(j => (
                <button
                  key={j.id}
                  onClick={() => setJornadaId(j.id)}
                  style={{
                    background: jornadaId === j.id ? t.accentGlow : t.surfaceAlt,
                    border: `1.5px solid ${jornadaId === j.id ? t.accent : t.border}`,
                    borderRadius: 9,
                    padding: "10px 14px",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                    transition: "all 0.15s"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: jornadaId === j.id ? t.accent : t.text }}>{j.nome}</span>
                    <span style={{ fontSize: "12.5px", fontWeight: 700, color: t.textMuted, fontFamily: "monospace" }}>{j.horasDia}h/dia</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: t.textSub, marginTop: 3 }}>{j.descricao}</div>
                </button>
              ))}

              <button
                onClick={() => setJornadaId("personalizada")}
                style={{
                  background: isCustom ? t.accentGlow : t.surfaceAlt,
                  border: `1.5px solid ${isCustom ? t.accent : t.border}`,
                  borderRadius: 9,
                  padding: "10px 14px",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "inherit",
                  transition: "all 0.15s"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: isCustom ? t.accent : t.text }}>⚙️ Criar jornada personalizada</span>
                </div>
                <div style={{ fontSize: 11.5, color: t.textSub, marginTop: 3 }}>Configure horários específicos e dias da semana conforme contrato CLT.</div>
              </button>
            </div>
          </div>

          {isCustom && (
            <div
              style={{
                border: `1.5px solid ${t.borderFocus}`,
                borderRadius: 14,
                padding: "14px 16px",
                marginBottom: 20,
                background: t.surfaceAlt
              }}
            >
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 6, textTransform: "uppercase" }}>Dias de trabalho</label>
                <div style={{ display: "flex", gap: 4 }}>
                  {DIAS.map((d, idx) => {
                    const ativo = jornadaCustom.diasSemana.includes(idx);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleDia(idx)}
                        style={{
                          flex: 1,
                          padding: "6px 2px",
                          borderRadius: 6,
                          border: `1px solid ${ativo ? t.accent : t.border}`,
                          background: ativo ? t.accent : "transparent",
                          color: ativo ? "#fff" : t.textSub,
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: 11,
                          fontFamily: "inherit"
                        }}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Entrada</label>
                  <input
                    type="time"
                    value={jornadaCustom.entrada}
                    onChange={e => handleCustomTime("entrada", e.target.value)}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      background: t.inputBg,
                      border: `1.5px solid ${t.border}`,
                      borderRadius: 8,
                      color: t.text,
                      fontSize: 13,
                      padding: "7px 10px",
                      outline: "none"
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Saída Almoço</label>
                  <input
                    type="time"
                    value={jornadaCustom.saidaAlmoco || ""}
                    onChange={e => handleCustomTime("saidaAlmoco", e.target.value)}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      background: t.inputBg,
                      border: `1.5px solid ${t.border}`,
                      borderRadius: 8,
                      color: t.text,
                      fontSize: 13,
                      padding: "7px 10px",
                      outline: "none"
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Retorno Almoço</label>
                  <input
                    type="time"
                    value={jornadaCustom.retornoAlmoco || ""}
                    onChange={e => handleCustomTime("retornoAlmoco", e.target.value)}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      background: t.inputBg,
                      border: `1.5px solid ${t.border}`,
                      borderRadius: 8,
                      color: t.text,
                      fontSize: 13,
                      padding: "7px 10px",
                      outline: "none"
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Saída</label>
                  <input
                    type="time"
                    value={jornadaCustom.saida}
                    onChange={e => handleCustomTime("saida", e.target.value)}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      background: t.inputBg,
                      border: `1.5px solid ${t.border}`,
                      borderRadius: 8,
                      color: t.text,
                      fontSize: 13,
                      padding: "7px 10px",
                      outline: "none"
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTop: `1px dashed ${t.border}`, marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: t.textMuted }}>Horas por dia útil:</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.accent }}>{jornadaCustom.horasDia}h</span>
              </div>

              {/* Se Sábado estiver selecionado nos Dias da Semana */}
              {jornadaCustom.diasSemana.includes(6) && (
                <div style={{ paddingTop: 12, borderTop: `1px solid ${t.border}`, marginBottom: 10 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 10 }}>
                    <input
                      type="checkbox"
                      checked={!!jornadaCustom.sabadoEspecial}
                      onChange={e => {
                        const checked = e.target.checked;
                        setJornadaCustom(prev => {
                          const sabHoras = prev.sabadoHoras ?? 4;
                          return {
                            ...prev,
                            sabadoEspecial: checked,
                            sabadoEntrada: prev.sabadoEntrada || "08:00",
                            sabadoSaida: prev.sabadoSaida || (sabHoras === 8 ? "17:00" : "12:00"),
                            sabadoHoras: sabHoras
                          };
                        });
                      }}
                    />
                    <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
                      Configurar Horários Específicos do Sábado
                    </span>
                  </label>

                  {jornadaCustom.sabadoEspecial && (
                    <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: 12 }}>
                      <div style={{ marginBottom: 10 }}>
                        <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Horas no Sábado</label>
                        <select
                          value={jornadaCustom.sabadoHoras === 8 ? "8" : "4"}
                          onChange={e => {
                            const val = Number(e.target.value);
                            setJornadaCustom(prev => {
                              if (val === 8) {
                                return {
                                  ...prev,
                                  sabadoHoras: 8,
                                  sabadoEntrada: prev.sabadoEntrada || "08:00",
                                  sabadoSaida: prev.sabadoSaida || "17:00"
                                };
                              } else {
                                return {
                                  ...prev,
                                  sabadoHoras: 4,
                                  sabadoEntrada: prev.sabadoEntrada || "08:00",
                                  sabadoSaida: prev.sabadoSaida || "12:00"
                                };
                              }
                            });
                          }}
                          style={{
                            width: "100%",
                            background: t.inputBg,
                            border: `1.5px solid ${t.border}`,
                            borderRadius: 8,
                            color: t.text,
                            fontSize: 13,
                            padding: "7px 10px",
                            outline: "none"
                          }}
                        >
                          <option value="4">4 horas (meio período, 2 batidas)</option>
                          <option value="8">8 horas (dia integral, 4 batidas com almoço)</option>
                        </select>
                      </div>

                      {jornadaCustom.sabadoHoras === 8 ? (
                        <div>
                          <div style={{ fontSize: 11.5, color: t.textSub, marginBottom: 10 }}>
                            📌 No sábado serão registradas <strong>4 batidas (com intervalo de almoço)</strong> ou 8 horas de trabalho.
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <div>
                              <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Entrada Sábado</label>
                              <input
                                type="time"
                                value={jornadaCustom.sabadoEntrada || "08:00"}
                                onChange={e => {
                                  const val = e.target.value;
                                  setJornadaCustom(prev => ({ ...prev, sabadoEntrada: val }));
                                }}
                                style={{
                                  width: "100%",
                                  boxSizing: "border-box",
                                  background: t.inputBg,
                                  border: `1.5px solid ${t.border}`,
                                  borderRadius: 8,
                                  color: t.text,
                                  fontSize: 13,
                                  padding: "7px 10px",
                                  outline: "none"
                                }}
                              />
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Saída Sábado</label>
                              <input
                                type="time"
                                value={jornadaCustom.sabadoSaida || "17:00"}
                                onChange={e => {
                                  const val = e.target.value;
                                  setJornadaCustom(prev => ({ ...prev, sabadoSaida: val }));
                                }}
                                style={{
                                  width: "100%",
                                  boxSizing: "border-box",
                                  background: t.inputBg,
                                  border: `1.5px solid ${t.border}`,
                                  borderRadius: 8,
                                  color: t.text,
                                  fontSize: 13,
                                  padding: "7px 10px",
                                  outline: "none"
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 11.5, color: t.textSub, marginBottom: 10 }}>
                            📌 No sábado serão registradas apenas <strong>2 batidas (Entrada e Saída)</strong> sem intervalo de almoço.
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                            <div>
                              <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Entrada Sábado</label>
                              <input
                                type="time"
                                value={jornadaCustom.sabadoEntrada || "08:00"}
                                onChange={e => {
                                  const val = e.target.value;
                                  setJornadaCustom(prev => ({ ...prev, sabadoEntrada: val }));
                                }}
                                style={{
                                  width: "100%",
                                  boxSizing: "border-box",
                                  background: t.inputBg,
                                  border: `1.5px solid ${t.border}`,
                                  borderRadius: 8,
                                  color: t.text,
                                  fontSize: 13,
                                  padding: "7px 10px",
                                  outline: "none"
                                }}
                              />
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: 11, color: t.textMuted, marginBottom: 4 }}>Saída Sábado</label>
                              <input
                                type="time"
                                value={jornadaCustom.sabadoSaida || "12:00"}
                                onChange={e => {
                                  const val = e.target.value;
                                  setJornadaCustom(prev => ({ ...prev, sabadoSaida: val }));
                                }}
                                style={{
                                  width: "100%",
                                  boxSizing: "border-box",
                                  background: t.inputBg,
                                  border: `1.5px solid ${t.border}`,
                                  borderRadius: 8,
                                  color: t.text,
                                  fontSize: 13,
                                  padding: "7px 10px",
                                  outline: "none"
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div style={{ marginTop: 10, fontSize: 11.5, color: t.accent, fontWeight: 700 }}>
                        Horas no sábado: {jornadaCustom.sabadoHoras ?? 4}h
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 10, borderTop: `1.5px solid ${t.border}` }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: t.text }}>Total de horas semanais:</span>
                <span style={{ fontSize: 14, fontWeight: 800, color: t.accent, background: t.accentGlow, padding: "3px 8px", borderRadius: 6 }}>
                  {totalHorasSemanais}h / semana
                </span>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={onFechar}
              style={{
                flex: 1,
                background: t.surfaceAlt,
                border: `1.5px solid ${t.border}`,
                borderRadius: 10,
                padding: "11px",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 600,
                color: t.textSub
              }}
            >
              Cancelar
            </button>
            <button
              onClick={() => onSalvar(userId)}
              disabled={!jornadaId}
              style={{
                flex: 2,
                background: jornadaId ? `linear-gradient(135deg, ${t.accent}, #1E3BB2)` : t.surfaceAlt,
                border: "none",
                borderRadius: 10,
                padding: "11px",
                cursor: jornadaId ? "pointer" : "not-allowed",
                fontFamily: "inherit",
                fontSize: 14,
                fontWeight: 700,
                color: jornadaId ? "#fff" : t.textMuted,
                boxShadow: jornadaId ? `0 4px 16px ${t.accentGlow}` : "none",
                transition: "all 0.2s"
              }}
            >
              Salvar Jornada
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
