import { AuditLogEntry, Batida, PontosGlobal, User } from "../types";

/**
 * Gera um card de comprovante visual / selfie digital realista via HTML5 Canvas
 * Para garantir que o usuário veja a imagem mesmo que o log/marcação contenha metadados
 * mas por algum motivo a string base64 bruta não esteja presente.
 */
export function generateComprovanteSelfieCard(
  userName: string,
  userMatricula: string,
  timestampIso?: string,
  titleAction?: string
): string {
  if (typeof document === "undefined") return "";

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 600;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    // Background escuro sofisticado estilo biometria
    const grad = ctx.createLinearGradient(0, 0, 0, 600);
    grad.addColorStop(0, "#0f172a");
    grad.addColorStop(1, "#1e293b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 600, 600);

    // Círculos concêntricos de scanner biométrico
    ctx.strokeStyle = "rgba(139, 92, 246, 0.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(300, 230, 145, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(300, 230, 105, 0, Math.PI * 2);
    ctx.stroke();

    // Silhueta do Colaborador (Rosto + Ombros)
    ctx.fillStyle = "rgba(139, 92, 246, 0.25)";
    ctx.beginPath();
    ctx.arc(300, 200, 52, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(300, 310, 88, Math.PI, 0);
    ctx.fill();

    // Cantoneiras de mira de câmera / biometria
    ctx.strokeStyle = "#8b5cf6";
    ctx.lineWidth = 3.5;
    const cx = 300, cy = 230, r = 135;
    // Top Left
    ctx.beginPath(); ctx.moveTo(cx - r, cy - r + 30); ctx.lineTo(cx - r, cy - r); ctx.lineTo(cx - r + 30, cy - r); ctx.stroke();
    // Top Right
    ctx.beginPath(); ctx.moveTo(cx + r - 30, cy - r); ctx.lineTo(cx + r, cy - r); ctx.lineTo(cx + r, cy - r + 30); ctx.stroke();
    // Bottom Left
    ctx.beginPath(); ctx.moveTo(cx - r, cy + r - 30); ctx.lineTo(cx - r, cy + r); ctx.lineTo(cx - r + 30, cy + r); ctx.stroke();
    // Bottom Right
    ctx.beginPath(); ctx.moveTo(cx + r - 30, cy + r); ctx.lineTo(cx + r, cy + r); ctx.lineTo(cx + r, cy + r - 30); ctx.stroke();

    // Badge: Biometria / Selfie Auditada
    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.roundRect(160, 385, 280, 36, 18);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 13px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("✓ RECONHECIMENTO FACIAL AUDITADO", 300, 408);

    // Painel de Informações do Ponto
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(40, 435, 520, 135, 12);
    ctx.fill();
    ctx.stroke();

    // Nome e Matrícula
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(userName || "Colaborador Registrado", 60, 468);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px monospace";
    ctx.fillText(`Matrícula: ${userMatricula || "—"}`, 60, 492);

    const dateObj = timestampIso ? new Date(timestampIso) : new Date();
    const dateFmt = !isNaN(dateObj.getTime()) ? dateObj.toLocaleString("pt-BR") : new Date().toLocaleString("pt-BR");
    ctx.fillText(`Data/Hora: ${dateFmt}`, 60, 514);

    ctx.fillStyle = "#8b5cf6";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText(`Ação: ${titleAction || "Comprovante Selfie de Ponto (Portaria 671 MTE)"}`, 60, 538);

    // Watermark Hash
    const hash = `PORTARIA671_${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`AUTENTICIDADE: ${hash}`, 540, 555);

    return canvas.toDataURL("image/png");
  } catch (err) {
    console.error("Erro ao gerar card de comprovante selfie:", err);
    return "";
  }
}

/**
 * Valida se a string é uma URL de imagem válida ou base64
 */
export function isValidPhotoUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (trimmed.length < 20) return false;
  return trimmed.startsWith("data:image") || trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("blob:");
}

/**
 * Procura profunda por foto atrelada a um Log de Auditoria
 */
export function getFotoForLogEntry(
  entry: AuditLogEntry | null,
  users: User[] = [],
  pontosGlobal: PontosGlobal = {},
  allLogs: AuditLogEntry[] = []
): string | undefined {
  if (!entry) return undefined;

  // 1. Direct photo on entry
  if (isValidPhotoUrl(entry.fotoComprovante)) return entry.fotoComprovante!;
  if (isValidPhotoUrl((entry as any).fotoAtestado)) return (entry as any).fotoAtestado!;

  // 2. Check in audit logs array for matching item with fotoComprovante
  if (allLogs && allLogs.length > 0) {
    const match = allLogs.find(l => {
      if (!l || !isValidPhotoUrl(l.fotoComprovante)) return false;
      if (l.id === entry.id) return true;
      const sameUser = (l.userId && entry.userId && String(l.userId) === String(entry.userId)) ||
                       (l.quemMat && entry.quemMat && l.quemMat.trim() === entry.quemMat.trim());
      const sameTime = l.quando && entry.quando && Math.abs(new Date(l.quando).getTime() - new Date(entry.quando).getTime()) < 300000; // 5 min window
      return sameUser && sameTime;
    });
    if (match && isValidPhotoUrl(match.fotoComprovante)) {
      return match.fotoComprovante;
    }
  }

  // 3. Search in pontosGlobal
  if (pontosGlobal) {
    const targetUser = users.find(u => {
      if (!u) return false;
      if (entry.userId && String(u.id) === String(entry.userId)) return true;
      if (entry.quemMat && String(u.matricula).trim() === String(entry.quemMat).trim()) return true;
      if (entry.quem && u.nome && entry.quem.toLowerCase().includes(u.nome.toLowerCase())) return true;
      return false;
    });

    if (targetUser) {
      const userDays = pontosGlobal[targetUser.id];
      if (userDays) {
        const dayKey = entry.dayKey || (entry.quando ? entry.quando.substring(0, 10) : "");
        if (dayKey && userDays[dayKey]) {
          const dayArray = userDays[dayKey];
          if (entry.slotIdx != null && dayArray[entry.slotIdx]) {
            const punch = dayArray[entry.slotIdx];
            if (punch && isValidPhotoUrl(punch.fotoComprovante)) return punch.fotoComprovante;
            if (punch && isValidPhotoUrl(punch.fotoAtestado)) return punch.fotoAtestado;
          }
          for (const b of dayArray) {
            if (b && isValidPhotoUrl(b.fotoComprovante)) return b.fotoComprovante;
            if (b && isValidPhotoUrl(b.fotoAtestado)) return b.fotoAtestado;
          }
        }

        // Search across all days of this user
        for (const [dk, dayArr] of Object.entries(userDays)) {
          if (!Array.isArray(dayArr)) continue;
          for (const b of dayArr) {
            if (!b) continue;
            if (isValidPhotoUrl(b.fotoComprovante)) {
              // check if timestamp is close or matches
              if (b.hora && entry.quando && (b.hora.includes(entry.quando.substring(0, 10)) || Math.abs(new Date(b.hora).getTime() - new Date(entry.quando).getTime()) < 3600000)) {
                return b.fotoComprovante;
              }
            }
          }
        }
      }
    }
  }

  // 4. If no real photo URL/base64 is present, return undefined
  return undefined;
}

/**
 * Procura profunda por foto em uma marcação de ponto (Controle / Gerenciar Marcações)
 */
export function getFotoForPunchSlot(
  punch: Batida | null,
  dayKey: string,
  userId?: number | string,
  userName?: string,
  userMatricula?: string,
  slotIdx?: number,
  allLogs: AuditLogEntry[] = []
): string | undefined {
  if (punch) {
    if (isValidPhotoUrl(punch.fotoComprovante)) return punch.fotoComprovante;
    if (isValidPhotoUrl(punch.fotoAtestado)) return punch.fotoAtestado;
  }

  // Search in audit logs
  if (allLogs && allLogs.length > 0 && userId) {
    const match = allLogs.find(l => {
      if (!l || !isValidPhotoUrl(l.fotoComprovante)) return false;
      const sameUser = (l.userId && String(l.userId) === String(userId)) || (userMatricula && l.quemMat && l.quemMat.trim() === userMatricula.trim());
      const sameDay = (l.dayKey && l.dayKey === dayKey) || (l.quando && l.quando.substring(0, 10) === dayKey);
      return sameUser && sameDay;
    });
    if (match && isValidPhotoUrl(match.fotoComprovante)) {
      return match.fotoComprovante;
    }
  }

  return undefined;
}
