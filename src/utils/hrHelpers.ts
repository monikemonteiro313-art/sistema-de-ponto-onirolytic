import { User, Jornada, PontosGlobal, Batida, FolgaRemunerada } from "../types";
import { getJornada, SUPERADMIN_MAT } from "../data/mockData";
import { getDiaPontoReferencia } from "../lib/firebaseService";
import { setPref } from "./preferencesService";
import { saveUsersToIndexedDB } from "../lib/indexedDbService";

/**
 * Atualização Instantânea do Cache Local de Autenticação (localStorage, @capacitor/preferences e IndexedDB)
 */
export function saveUserToLocalCache(updatedUser: User): void {
  try {
    if (!updatedUser || updatedUser.id === undefined) return;

    // 1. LocalStorage - hr_cached_users
    let list: User[] = [];
    try {
      const raw = localStorage.getItem("hr_cached_users");
      if (raw) list = JSON.parse(raw);
    } catch (_) {}
    if (!Array.isArray(list)) list = [];

    const idx = list.findIndex(
      u => Number(u.id) === Number(updatedUser.id) ||
      (u.matricula && updatedUser.matricula && isMatriculaMatch(u.matricula, updatedUser.matricula))
    );

    if (idx >= 0) {
      list[idx] = { ...list[idx], ...updatedUser };
    } else {
      list.push(updatedUser);
    }

    const updatedJson = JSON.stringify(list);
    try {
      localStorage.setItem("hr_cached_users", updatedJson);
    } catch (_) {}

    // 2. Preferences (@capacitor/preferences)
    setPref("hr_cached_users", updatedJson).catch(() => {});

    // 3. IndexedDB
    saveUsersToIndexedDB(list).catch(() => {});

    // 4. Current User Cache se for o usuário logado
    try {
      const rawCurr = localStorage.getItem("hr_current_user");
      if (rawCurr) {
        const curr = JSON.parse(rawCurr);
        if (
          Number(curr.id) === Number(updatedUser.id) ||
          (curr.matricula && updatedUser.matricula && isMatriculaMatch(curr.matricula, updatedUser.matricula))
        ) {
          const newCurr = { ...curr, ...updatedUser };
          const newCurrJson = JSON.stringify(newCurr);
          localStorage.setItem("hr_current_user", newCurrJson);
          setPref("hr_cached_current_user", newCurrJson).catch(() => {});
        }
      }
    } catch (_) {}
  } catch (err) {
    console.warn("[saveUserToLocalCache] Erro ao atualizar cache local do usuário:", err);
  }
}

export function isMatriculaMatch(uMat: string | null | undefined, searchMat: string | null | undefined): boolean {
  if (!uMat || !searchMat) return false;
  const clean1 = String(uMat).trim();
  const clean2 = String(searchMat).trim();
  if (!clean1 || !clean2) return false;
  if (clean1.toLowerCase() === clean2.toLowerCase()) return true;
  // Compare without leading zeros if both are numeric
  const norm1 = clean1.replace(/^0+/, "");
  const norm2 = clean2.replace(/^0+/, "");
  // Guard: "0" and "00" should not match empty string after normalization
  if (!norm1 || !norm2) return false;
  if (norm1.toLowerCase() === norm2.toLowerCase()) return true;
  return false;
}

export function genSenha(): string {
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const nums = "23456789";
  const special = "!@#$%&*";
  const all = lower + upper + nums + special;
  const pw = [lower, upper, nums, special].map(s => s[Math.floor(Math.random() * s.length)]);
  for (let i = 0; i < 6; i++) {
    pw.push(all[Math.floor(Math.random() * all.length)]);
  }
  return pw.sort(() => Math.random() - 0.5).join("");
}

export function genMatricula(users: User[]): string {
  const nums = users
    .filter(u => u && u.matricula && !isMatriculaMatch(u.matricula, SUPERADMIN_MAT) && /^\d+$/.test(String(u.matricula).trim()))
    .map(u => parseInt(String(u.matricula).trim(), 10));

  // A última matrícula informada é 200203. Garantimos que a base mínima seja 200203
  // para que a próxima gerada sequencialmente seja 200204 (ou superior se já houver maiores).
  const BASE_MATRICULA = 200203;
  let nextNum = Math.max(BASE_MATRICULA, ...nums) + 1;

  // Garantia rigorosa de unicidade: avança até encontrar um número de matrícula não utilizado
  while (users.some(u => isMatriculaMatch(u?.matricula, String(nextNum).padStart(6, "0")))) {
    nextNum++;
  }

  return String(nextNum).padStart(6, "0");
}

export function sanitizeAndDeduplicateUsers(rawUsers: User[]): { cleanUsers: User[]; duplicatesFound: boolean; remappedMatriculas: Record<string, string> } {
  if (!rawUsers || rawUsers.length === 0) {
    return { cleanUsers: [], duplicatesFound: false, remappedMatriculas: {} };
  }

  let duplicatesFound = false;
  const remappedMatriculas: Record<string, string> = {};
  const seenIds = new Set<number>();
  const seenMatriculas = new Set<string>();

  const list: User[] = [];

  // Superadmin primary user (090909) MUST ONLY be identified by matricula "090909"
  const superAdmin = rawUsers.find(u => u && isMatriculaMatch(u.matricula, SUPERADMIN_MAT));

  for (const user of rawUsers) {
    if (!user) continue;
    let u = { ...user };
    u.matricula = u.matricula ? String(u.matricula).trim() : "";

    // Deduplicate ID if repeated among different users
    if (seenIds.has(u.id)) {
      duplicatesFound = true;
      let maxId = 0;
      for (const existingId of seenIds) {
        if (existingId > maxId) maxId = existingId;
      }
      u.id = maxId + 1;
    }
    seenIds.add(u.id);

    // Reserved matricula 090909 rule
    if (isMatriculaMatch(u.matricula, SUPERADMIN_MAT)) {
      if (superAdmin && u.id !== superAdmin.id && !isMatriculaMatch(superAdmin.matricula, SUPERADMIN_MAT)) {
        duplicatesFound = true;
        const oldMat = u.matricula;
        u.matricula = genMatricula([...list, ...rawUsers]);
        remappedMatriculas[String(u.id)] = `${oldMat} -> ${u.matricula}`;
      } else {
        // Superadmin 090909 must ALWAYS be Onirolytic, adm-dev, with primeiroAcesso = false
        u.nome = "Onirolytic";
        u.tipo = "adm-dev";
        u.matricula = SUPERADMIN_MAT;
        u.primeiroAcesso = false;
        if (!u.senha) u.senha = "Admin@090909";
      }
    }

    // General duplicate matricula rule: exact trimmed string comparison (lowercase)
    const cleanKey = u.matricula ? u.matricula.trim().toLowerCase() : "";
    if (cleanKey && seenMatriculas.has(cleanKey) && !isMatriculaMatch(u.matricula, SUPERADMIN_MAT)) {
      duplicatesFound = true;
      const oldMat = u.matricula;
      u.matricula = genMatricula([...list, ...rawUsers]);
      remappedMatriculas[String(u.id)] = `${oldMat} -> ${u.matricula}`;
      seenMatriculas.add(u.matricula.trim().toLowerCase());
    } else if (cleanKey) {
      seenMatriculas.add(cleanKey);
    }

    list.push(u);
  }

  return { cleanUsers: list, duplicatesFound, remappedMatriculas };
}

export function reconcileUsers(localUsers: User[], firestoreUsers: User[]): { merged: User[]; changed: boolean } {
  const userMap = new Map<number, User>();
  const matToIdMap = new Map<string, number>();

  // Helper to check if a password is just the default pattern
  const isDefaultPw = (pw: string, mat: string) => {
    if (!pw) return true;
    const cleanP = pw.trim();
    const cleanM = mat.trim();
    return cleanP === `Senha@${cleanM}` || cleanP === `Senha@${cleanM.replace(/^0+/, "")}`;
  };

  // 1. Process Firestore users first (Firestore is source of truth)
  for (const fsU of firestoreUsers || []) {
    if (!fsU || !fsU.id) continue;
    const mat = fsU.matricula ? String(fsU.matricula).trim() : "";
    const senha = fsU.senha ? String(fsU.senha).trim() : `Senha@${mat}`;
    const cleanU: User = {
      ...fsU,
      matricula: mat,
      senha: senha
    };
    userMap.set(fsU.id, cleanU);
    if (mat) {
      matToIdMap.set(mat.toLowerCase(), fsU.id);
    }
  }

  // 2. Merge local cache users
  for (const locU of localUsers || []) {
    if (!locU || !locU.id) continue;
    const locMat = locU.matricula ? String(locU.matricula).trim() : "";
    const locSenha = locU.senha ? String(locU.senha).trim() : `Senha@${locMat}`;

    // Find existing by ID or by Matricula
    let matchedId = locU.id;
    if (!userMap.has(matchedId) && locMat && matToIdMap.has(locMat.toLowerCase())) {
      matchedId = matToIdMap.get(locMat.toLowerCase())!;
    }

    const existing = userMap.get(matchedId);

    if (!existing) {
      // User only exists in local storage
      const newLoc: User = {
        ...locU,
        matricula: locMat,
        senha: locSenha
      };
      userMap.set(locU.id, newLoc);
      if (locMat) {
        matToIdMap.set(locMat.toLowerCase(), locU.id);
      }
    } else {
      // User exists in BOTH Firestore and Local cache
      const fsMat = existing.matricula ? String(existing.matricula).trim() : "";
      const fsSenha = existing.senha ? String(existing.senha).trim() : "";
      const fsTime = Number(existing.senhaAlteradaEm) || 0;
      const locTime = Number(locU.senhaAlteradaEm) || 0;

      // Prefer Firestore matricula if present
      const finalMat = fsMat || locMat;

      // Validação por Timestamp (senhaAlteradaEm): escolhe a senha do lado com timestamp mais recente
      let finalSenha = fsSenha;
      let finalSenhaTime = fsTime;

      if (fsTime > locTime) {
        finalSenha = fsSenha || locSenha;
        finalSenhaTime = fsTime;
      } else if (locTime > fsTime) {
        finalSenha = locSenha || fsSenha;
        finalSenhaTime = locTime;
      } else {
        if (isDefaultPw(fsSenha, finalMat) && locSenha && !isDefaultPw(locSenha, finalMat)) {
          finalSenha = locSenha;
        } else {
          finalSenha = fsSenha || locSenha || `Senha@${finalMat}`;
        }
      }

      const isSuper = isMatriculaMatch(finalMat, SUPERADMIN_MAT);

      const isTermosAceitos = Boolean(
        existing.termosAceitos || existing.termoAceito || locU.termosAceitos || locU.termoAceito
      );
      const termosEm = existing.termosAceitosEm || existing.termoAceitoEm || locU.termosAceitosEm || locU.termoAceitoEm || null;

      const merged: User = {
        ...locU,
        ...existing, // Firestore attributes override stale local cache
        matricula: finalMat,
        senha: finalSenha,
        senhaAlteradaEm: finalSenhaTime || existing.senhaAlteradaEm || locU.senhaAlteradaEm,
        termoAceito: isTermosAceitos,
        termosAceitos: isTermosAceitos,
        termoAceitoEm: isTermosAceitos ? (termosEm || new Date().toISOString()) : null,
        termosAceitosEm: isTermosAceitos ? (termosEm || new Date().toISOString()) : null,
        nome: isSuper ? "Onirolytic" : (existing.nome || locU.nome),
        primeiroAcesso: isSuper ? false : (existing.primeiroAcesso ?? locU.primeiroAcesso),
      };
      userMap.set(existing.id, merged);
    }
  }

  const rawList = Array.from(userMap.values());
  const { cleanUsers, duplicatesFound } = sanitizeAndDeduplicateUsers(rawList);

  return { merged: cleanUsers, changed: duplicatesFound };
}

export function validateAdminPw(pw: string): boolean {
  return (
    /[a-z]/.test(pw) &&
    /[A-Z]/.test(pw) &&
    /[0-9]/.test(pw) &&
    /[^a-zA-Z0-9]/.test(pw) &&
    pw.length >= 8
  );
}

export function validateEmployeePw(pw: string): boolean {
  return /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw) && pw.length >= 8;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Math.floor((new Date().getTime() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function toMin(timeStr: string | null): number | null {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

export function calcularHorasDia(jornadaId: string | null, jornadaCustom: Jornada | null, diaSemana?: number): number {
  const j = jornadaId === "personalizada" ? jornadaCustom : (jornadaId ? getJornada(jornadaId) : null);
  if (!j) return 8;

  if (diaSemana === 6 && j.sabadoEspecial) {
    if (j.sabadoHoras !== undefined) return j.sabadoHoras;
    if (j.sabadoEntrada && j.sabadoSaida) {
      const toM = (t: string) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
      };
      let diff = toM(j.sabadoSaida) - toM(j.sabadoEntrada);
      if (diff <= 0) diff += 1440;
      return diff / 60;
    }
    return 4;
  }

  if (!j.entrada || !j.saida) return j.horasDia || 8;
  const toM = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  let total = toM(j.saida) - toM(j.entrada);
  if (total <= 0) total += 1440;
  if (j.saidaAlmoco && j.retornoAlmoco) {
    let almoco = toM(j.retornoAlmoco) - toM(j.saidaAlmoco);
    if (almoco < 0) almoco += 1440;
    total -= almoco;
  }
  return Math.max(0, total / 60);
}

export interface NightShiftOverlap {
  horas: number;
  textoIntervalo: string;
}

export function getOverlapWithNightShift(start: Date, end: Date): NightShiftOverlap[] {
  const overlaps: NightShiftOverlap[] = [];

  const startDate = new Date(start.getTime() - 2 * 24 * 3600 * 1000);
  const endDate = new Date(end.getTime() + 2 * 24 * 3600 * 1000);

  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  for (let d = new Date(startDay); d <= endDay; d.setDate(d.getDate() + 1)) {
    const nightStart = new Date(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}T22:00:00-03:00`);
    const nightEnd = new Date(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()+1).padStart(2,"0")}T05:00:00-03:00`);

    const overlapStart = new Date(Math.max(start.getTime(), nightStart.getTime()));
    const overlapEnd = new Date(Math.min(end.getTime(), nightEnd.getTime()));

    if (overlapStart < overlapEnd) {
      const ms = overlapEnd.getTime() - overlapStart.getTime();
      const horas = ms / 3600000;

      const fmtTime = (date: Date) => {
        const hh = String(date.getHours()).padStart(2, "0");
        const mm = String(date.getMinutes()).padStart(2, "0");
        return `${hh}:${mm}`;
      };

      overlaps.push({
        horas,
        textoIntervalo: `das ${fmtTime(overlapStart)} às ${fmtTime(overlapEnd)}`
      });
    }
  }
  return overlaps;
}

export function formatNightShiftOverlaps(overlaps: NightShiftOverlap[]): { totalHoras: number; totalHorasRelogio: number; texto: string } {
  const totalHorasRelogio = overlaps.reduce((sum, o) => sum + o.horas, 0);
  if (totalHorasRelogio === 0) {
    return { totalHoras: 0, totalHorasRelogio: 0, texto: "" };
  }
  // Aplicação da Hora Ficta Noturna da CLT (Art. 73 § 1º: 1 hora noturna = 52m30s -> Fator 60 / 52.5 = 1.142857)
  const totalHoras = totalHorasRelogio * (60 / 52.5);
  const parts = overlaps.map(o => `${o.textoIntervalo}`);
  let texto = parts.join(", ");
  return { totalHoras, totalHorasRelogio, texto };
}

export function baixarArquivoAtestado(base64OrUrl: string, filename: string) {
  if (!base64OrUrl) return;
  const link = document.createElement("a");
  link.href = base64OrUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function compressImageBase64(
  base64Str: string,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.65
): Promise<string> {
  return new Promise((resolve) => {
    if (!base64Str || typeof base64Str !== "string" || !base64Str.startsWith("data:image")) {
      return resolve(base64Str);
    }
    // Safety: skip compression for extremely large base64 strings to prevent browser freeze
    if (base64Str.length > 15_000_000) {
      console.warn("[compressImageBase64] Image too large (>15MB base64), skipping compression.");
      return resolve(base64Str);
    }
    const img = new Image();
    img.onload = () => {
      let width = img.width || 800;
      let height = img.height || 800;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "medium";
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => resolve(base64Str);
    img.src = base64Str;
  });
}

export function calcHoursBetween(startStr?: string, endStr?: string): number {
  if (!startStr || !endStr) return 0;
  const [h1, m1] = startStr.split(":").map(Number);
  const [h2, m2] = endStr.split(":").map(Number);
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) return 0;
  let minStart = h1 * 60 + m1;
  let minEnd = h2 * 60 + m2;
  if (minEnd < minStart) {
    minEnd += 24 * 60;
  }
  return Math.max(0, (minEnd - minStart) / 60);
}

export function parsePunchDate(b: Batida | null, dayKey: string): Date | null {
  if (!b) return null;
  const raw = b.iso || b.hora;
  if (!raw) return null;
  if (typeof raw === "string" && raw.includes("T")) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
  }
  if (typeof raw === "string" && /^\d{1,2}:\d{2}(:\d{2})?$/.test(raw)) {
    const timeWithSeconds = raw.length === 5 ? `${raw}:00` : raw;
    // WARNING: This creates a Date in the browser's local timezone.
    // Near midnight, TZ shifts may cause a 1-day offset. Differences cancel out in calculations.
    const d = new Date(`${dayKey}T${timeWithSeconds}-03:00`);
    if (!isNaN(d.getTime())) return d;
  }
  const fallback = new Date(raw);
  return isNaN(fallback.getTime()) ? null : fallback;
}

export function calcularDia(
  userId: number,
  dayKey: string,
  users: User[],
  pontosGlobal: PontosGlobal,
  feriadosGlobais?: string[],
  toleranciaMin: number = 10,
  folgasRemuneradas?: FolgaRemunerada[]
) {
  const u = users.find(x => x.id === userId);
  if (!u) return null;

  // ADM não entra nos cálculos de frequência, faltas ou folha
  if (u.tipo === "adm-dev") {
    return { status: "folga" as const, horasTrabalhadas: 0, horasEfetivas: 0, horasJornada: 0, atrasoMin: 0, saidaAntMin: 0, horasExtra: 0, contaParaCartao: false, adicNoturnoHoras: 0, adicNoturnoTexto: "" };
  }

  // 1. Verificar férias
  const emFerias = u.ferias?.some(p => dayKey >= p.inicio && dayKey <= p.fim);
  if (emFerias) {
    return { status: "ferias" as const, horasTrabalhadas: 0, horasEfetivas: 0, horasJornada: 0, atrasoMin: 0, saidaAntMin: 0, horasExtra: 0, contaParaCartao: false, adicNoturnoHoras: 0, adicNoturnoTexto: "" };
  }

  // 2. Verificar feriado corporativo
  const eFeriado = feriadosGlobais?.includes(dayKey);
  if (eFeriado) {
    return { status: "feriado" as const, horasTrabalhadas: 0, horasEfetivas: 0, horasJornada: 0, atrasoMin: 0, saidaAntMin: 0, horasExtra: 0, contaParaCartao: false, adicNoturnoHoras: 0, adicNoturnoTexto: "" };
  }

  // 3. Verificar folga remunerada
  const folgaRem = folgasRemuneradas?.find(fr => {
    const appliesToUser = fr.aplicarATodosAtivos || (fr.userIds && fr.userIds.includes(userId));
    return appliesToUser && !u.desativado && dayKey >= fr.dataInicio && dayKey <= fr.dataFim;
  });

  if (folgaRem && folgaRem.tipo === "completo") {
    const dateTemp = new Date(dayKey + "T12:00:00");
    const dNumTemp = dateTemp.getDate();
    let jId = u.jornadaId;
    let jCust = u.jornadaCustom;
    if (u.trocaJornadaDia && u.trocaJornadaIdAnterior && dNumTemp < u.trocaJornadaDia) {
      jId = u.trocaJornadaIdAnterior;
      jCust = null;
    }
    const diaSemTemp = dateTemp.getDay();
    const horasJornadaTemp = jId ? calcularHorasDia(jId, jCust, diaSemTemp) : 8;
    return {
      status: "folga_remunerada" as const,
      horasTrabalhadas: horasJornadaTemp,
      horasEfetivas: 0,
      horasJornada: horasJornadaTemp,
      atrasoMin: 0,
      saidaAntMin: 0,
      horasExtra: 0,
      contaParaCartao: false,
      adicNoturnoHoras: 0,
      adicNoturnoTexto: "",
      motivoFolgaRemunerada: folgaRem.motivo || "Folga Remunerada"
    };
  }

  const date = new Date(dayKey + "T12:00:00");
  const dNum = date.getDate();

  let jornadaIdParaODia = u.jornadaId;
  let jornadaCustomParaODia = u.jornadaCustom;

  if (u.trocaJornadaDia && u.trocaJornadaIdAnterior) {
    if (dNum < u.trocaJornadaDia) {
      jornadaIdParaODia = u.trocaJornadaIdAnterior;
      jornadaCustomParaODia = null;
    }
  }

  const jornada = jornadaIdParaODia === "personalizada" ? jornadaCustomParaODia : (jornadaIdParaODia ? getJornada(jornadaIdParaODia) : null);
  const rawBatidas = pontosGlobal[userId]?.[dayKey] || [null, null, null, null];
  const batidas = rawBatidas.map(b => (b && b.duplicadoOculto ? null : b));
  const diaSem = date.getDay();
  const diasUteis = jornada?.diasSemana || [1, 2, 3, 4, 5];
  const hojeStr = getDiaPontoReferencia();

  // Dia não útil ou futuro
  if (!diasUteis.includes(diaSem)) {
    return { status: "folga" as const, horasTrabalhadas: 0, horasEfetivas: 0, horasJornada: 0, atrasoMin: 0, saidaAntMin: 0, horasExtra: 0, contaParaCartao: false, adicNoturnoHoras: 0, adicNoturnoTexto: "" };
  }
  if (dayKey > hojeStr) {
    return { status: "futuro" as const, horasTrabalhadas: 0, horasEfetivas: 0, horasJornada: 0, atrasoMin: 0, saidaAntMin: 0, horasExtra: 0, contaParaCartao: false, adicNoturnoHoras: 0, adicNoturnoTexto: "" };
  }

  const isSabadoEspecial = diaSem === 6 && !!jornada?.sabadoEspecial;
  const horasJornada = jornadaIdParaODia ? calcularHorasDia(jornadaIdParaODia, jornadaCustomParaODia, diaSem) : 8;
  const ocorrencia = batidas.find((b): b is Batida => b !== null && !!b.ocorrencia && (b.ocorrencia !== "atestado" || b.statusAtestado !== "recusado"));

  // Dia Vazio / Sem Vínculo (ex: admissão no meio do mês, isento de cálculo)
  if (ocorrencia?.ocorrencia === "dia_vazio" || ocorrencia?.ocorrencia === "vazio" || ocorrencia?.ocorrencia === "sem_vinculo" || ocorrencia?.ocorrencia === "isento") {
    return { status: "dia_vazio" as const, horasTrabalhadas: 0, horasEfetivas: 0, horasJornada: 0, atrasoMin: 0, saidaAntMin: 0, horasExtra: 0, contaParaCartao: false, adicNoturnoHoras: 0, adicNoturnoTexto: "", motivoDiaVazio: ocorrencia.obs || "Dia Vazio / Sem Vínculo" };
  }

  // Afastamento
  if (ocorrencia?.ocorrencia === "afastamento") {
    return { status: "afastamento" as const, horasTrabalhadas: 0, horasEfetivas: 0, horasJornada, atrasoMin: 0, saidaAntMin: 0, horasExtra: 0, contaParaCartao: false, adicNoturnoHoras: 0, adicNoturnoTexto: "" };
  }

  // Falta
  if (ocorrencia?.ocorrencia === "falta" || (!ocorrencia && batidas.every(b => b === null || (b.ocorrencia === "atestado" && b.statusAtestado === "recusado" && !b.hora)))) {
    if (u.apenasSomarHoras) {
      return { status: "folga" as const, horasTrabalhadas: 0, horasEfetivas: 0, horasJornada: 0, atrasoMin: 0, saidaAntMin: 0, horasExtra: 0, contaParaCartao: false, adicNoturnoHoras: 0, adicNoturnoTexto: "" };
    }
    return { status: "falta" as const, horasTrabalhadas: 0, horasEfetivas: 0, horasJornada, atrasoMin: 0, saidaAntMin: Math.round(horasJornada * 60), horasExtra: 0, contaParaCartao: false, adicNoturnoHoras: 0, adicNoturnoTexto: "" };
  }

  // Atestado dia inteiro
  if (ocorrencia?.ocorrencia === "atestado" && !ocorrencia.parcial && ocorrencia.statusAtestado !== "recusado") {
    return { status: "atestado" as const, horasTrabalhadas: 0, horasEfetivas: 0, horasJornada, atrasoMin: 0, saidaAntMin: 0, horasExtra: 0, contaParaCartao: false, adicNoturnoHoras: 0, adicNoturnoTexto: "" };
  }

  // Atestado parcial ou horários comuns
  const bEntrada = batidas[0] && (!batidas[0].ocorrencia || batidas[0].statusAtestado === "recusado") && batidas[0].hora ? batidas[0] : null;
  const bSaidaAlm = batidas[1] && (!batidas[1].ocorrencia || batidas[1].statusAtestado === "recusado") && batidas[1].hora ? batidas[1] : null;
  const bRetorno  = batidas[2] && (!batidas[2].ocorrencia || batidas[2].statusAtestado === "recusado") && batidas[2].hora ? batidas[2] : null;
  const bSaida    = batidas[3] && (!batidas[3].ocorrencia || batidas[3].statusAtestado === "recusado") && batidas[3].hora ? batidas[3] : null;

  if (!bEntrada || !bEntrada.hora) {
    if (u.apenasSomarHoras) {
      return { status: "folga" as const, horasTrabalhadas: 0, horasEfetivas: 0, horasJornada: 0, atrasoMin: 0, saidaAntMin: 0, horasExtra: 0, contaParaCartao: false, adicNoturnoHoras: 0, adicNoturnoTexto: "" };
    }
    return { status: "parcial" as const, horasTrabalhadas: 0, horasEfetivas: 0, horasJornada, atrasoMin: 0, saidaAntMin: Math.round(horasJornada * 60), horasExtra: 0, contaParaCartao: false, adicNoturnoHoras: 0, adicNoturnoTexto: "" };
  }

  const entradaReal = parsePunchDate(bEntrada, dayKey);
  const saidaReal   = parsePunchDate(bSaida, dayKey);
  const dSaidaAlm   = parsePunchDate(bSaidaAlm, dayKey);
  const dRetorno    = parsePunchDate(bRetorno, dayKey);

  // Horas efetivamente trabalhadas no posto (brutas, descontando intervalo de almoço)
  let msEfetivo = 0;
  if (saidaReal) {
    msEfetivo = saidaReal.getTime() - entradaReal.getTime();
    if (dSaidaAlm && dRetorno) {
      msEfetivo -= (dRetorno.getTime() - dSaidaAlm.getTime());
    }
  } else if (dSaidaAlm) {
    // Saiu para almoço/médico e não retornou
    msEfetivo = dSaidaAlm.getTime() - entradaReal.getTime();
  }
  const horasEfetivas = Math.max(0, msEfetivo / 3600000);

  // Atestado Parcial (Abono de horas)
  const atestadoParcialObj = batidas.find(
    b => b && b.ocorrencia === "atestado" && b.parcial && b.statusAtestado !== "recusado"
  );
  let horasAtestadoParcial = 0;
  if (atestadoParcialObj) {
    if (atestadoParcialObj.horaInicioParcial && atestadoParcialObj.horaFimParcial) {
      horasAtestadoParcial = calcHoursBetween(atestadoParcialObj.horaInicioParcial, atestadoParcialObj.horaFimParcial);
    }
  }

  // Horas efetivamente trabalhadas no dia
  const horasTrabalhadas = horasEfetivas;

  // Horas com abono de atestado para fins de verificação de faltas/atrasos
  const horasAbonadasTotal = horasEfetivas + horasAtestadoParcial;

  // Atraso, Saída antecipada e Hora extra
  let atrasoMin = 0;
  let saidaAntMin = 0;
  let horasExtra = 0;

  const isFlexible = !!u.apenasSomarHoras || !jornada || (!isSabadoEspecial && (!jornada.entrada || !jornada.saida)) || (isSabadoEspecial && (!jornada.sabadoEntrada || !jornada.sabadoSaida));

  if (isFlexible) {
    const minutosCredito = Math.round(horasAbonadasTotal * 60);
    const minutosJornada = Math.round(horasJornada * 60);
    const diffMin = minutosCredito - minutosJornada;

    if (diffMin > toleranciaMin) {
      horasExtra = diffMin / 60;
    } else if (diffMin < -toleranciaMin) {
      saidaAntMin = Math.abs(diffMin);
    }
  } else {
    // 1. Entrada atrasada
    const entradaEsperada = isSabadoEspecial ? (jornada.sabadoEntrada || jornada.entrada) : jornada.entrada;
    if (entradaEsperada && bEntrada) {
      const prevEntrada = toMin(entradaEsperada);
      if (prevEntrada !== null) {
        const realEntrada = entradaReal.getHours() * 60 + entradaReal.getMinutes();
        const diff = realEntrada - prevEntrada;
        if (diff > toleranciaMin) {
          atrasoMin += diff;
        } else if (diff < -toleranciaMin) {
          horasExtra += Math.abs(diff) / 60;
        }
      }
    }

    // Calcular déficit total em minutos em relação à jornada esperada do dia
    const totalMinJornada = Math.round(horasJornada * 60);
    const totalMinCredito = Math.round(horasAbonadasTotal * 60);
    const deficitTotalMin = totalMinJornada - totalMinCredito;

    if (deficitTotalMin > toleranciaMin) {
      if (atrasoMin > 0) {
        const restoDeficit = deficitTotalMin - atrasoMin;
        if (restoDeficit > 0) {
          saidaAntMin = restoDeficit;
        }
      } else {
        saidaAntMin = deficitTotalMin;
      }
    } else if (deficitTotalMin < -toleranciaMin) {
      const extraCand = Math.abs(deficitTotalMin) / 60;
      if (extraCand > horasExtra) {
        horasExtra = extraCand;
      }
    }
  }

  // Calcular Adicional Noturno
  let adicNoturnoHoras = 0;
  let adicNoturnoTexto = "";
  if (entradaReal) {
    const listOverlaps: NightShiftOverlap[] = [];
    if (dSaidaAlm) {
      listOverlaps.push(...getOverlapWithNightShift(entradaReal, dSaidaAlm));
      if (dRetorno && saidaReal) {
        listOverlaps.push(...getOverlapWithNightShift(dRetorno, saidaReal));
      }
    } else if (saidaReal) {
      listOverlaps.push(...getOverlapWithNightShift(entradaReal, saidaReal));
    }
    const formatted = formatNightShiftOverlaps(listOverlaps);
    adicNoturnoHoras = formatted.totalHoras;
    adicNoturnoTexto = formatted.texto;
  }

  const isAtestadoParcial = !!atestadoParcialObj;
  const status = isAtestadoParcial ? ("atestado" as const) : (atrasoMin > 0 || saidaAntMin > 0) ? ("parcial" as const) : ("completo" as const);

  // Vale-Alimentação: se sábado especial, exige a própria jornada do sábado (ex: 4h), senão 7h
  const metaHorasCartao = isSabadoEspecial ? (jornada?.sabadoHoras ?? 4) : 7;
  // FIXED: now considers partial medical leave hours toward the meal-card threshold
  const horasCreditadas = horasEfetivas + horasAtestadoParcial;
  const contaParaCartao = horasCreditadas >= metaHorasCartao;

  return { status, horasTrabalhadas, horasEfetivas, horasJornada, atrasoMin, saidaAntMin, horasExtra, contaParaCartao, adicNoturnoHoras, adicNoturnoTexto, horasAbonadas: horasAtestadoParcial };
}

export function resumoMesCalculado(
  userId: number,
  ano: number,
  mes: number,
  users: User[],
  pontosGlobal: PontosGlobal,
  minimoHorasDia: number,
  feriadosGlobais?: string[],
  folgasRemuneradas?: FolgaRemunerada[]
) {
  const u = users.find(x => x.id === userId);
  if (!u || u.tipo === "adm-dev") {
    return {
      horasTrabalhadas: 0,
      horasEsperadas: 0,
      horasExtra: 0,
      minutosAtraso: 0,
      minutosAntecipacao: 0,
      diasFalta: 0,
      diasAtestado: 0,
      diasAfastamento: 0,
      diasCartao: 0,
      diasFerias: 0,
      diasFeriado: 0,
      diasFolgaRemunerada: 0,
      diasAdicionalNoturno: 0,
      horasAdicionalNoturno: 0,
      horasAbonadas: 0
    };
  }

  const temDireito = u?.direitoAlimentacao !== false;

  const total = new Date(ano, mes + 1, 0).getDate();
  let horasTrabalhadas = 0, horasEsperadas = 0, horasExtra = 0;
  let minutosAtraso = 0, minutosAntecipacao = 0;
  let diasFalta = 0, diasAtestado = 0, diasAfastamento = 0, diasParaCartao = 0;
  let diasFerias = 0, diasFeriado = 0, diasFolgaRemunerada = 0;
  let totalDiasAdicionalNoturno = 0;
  let totalHorasAdicionalNoturno = 0;
  let horasAbonadas = 0;

  for (let d = 1; d <= total; d++) {
    const dayKey = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const r = calcularDia(userId, dayKey, users, pontosGlobal, feriadosGlobais, 10, folgasRemuneradas);
    if (!r) continue;

    if (r.adicNoturnoHoras && r.adicNoturnoHoras > 0) {
      totalDiasAdicionalNoturno++;
      totalHorasAdicionalNoturno += r.adicNoturnoHoras;
    }

    if (r.status === "folga" || r.status === "futuro" || r.status === "dia_vazio") continue;
    if (r.status === "ferias") {
      diasFerias++;
      continue;
    }
    if (r.status === "feriado") {
      diasFeriado++;
      continue;
    }
    if (r.status === "folga_remunerada") {
      diasFolgaRemunerada++;
      horasEsperadas += r.horasJornada;
      horasTrabalhadas += r.horasTrabalhadas;
      continue;
    }
    horasEsperadas    += r.horasJornada;
    horasTrabalhadas  += r.horasTrabalhadas;
    horasExtra        += r.horasExtra;
    minutosAtraso     += r.atrasoMin;
    minutosAntecipacao+= r.saidaAntMin;
    if (r.horasAbonadas) horasAbonadas += r.horasAbonadas;
    if (r.status === "falta")       diasFalta++;
    if (r.status === "atestado")    diasAtestado++;
    if (r.status === "afastamento") diasAfastamento++;
    if (r.contaParaCartao && r.horasEfetivas >= minimoHorasDia) {
      diasParaCartao += 1;
    }
  }

  return {
    horasTrabalhadas:   Math.round(horasTrabalhadas * 10) / 10,
    horasEsperadas:     Math.round(horasEsperadas * 10) / 10,
    horasExtra:         Math.round(horasExtra * 10) / 10,
    minutosAtraso,
    minutosAntecipacao,
    diasFalta,
    diasAtestado,
    diasAfastamento,
    diasCartao:         temDireito ? diasParaCartao : 0,
    diasFerias,
    diasFeriado,
    diasFolgaRemunerada,
    diasAdicionalNoturno: totalDiasAdicionalNoturno,
    horasAdicionalNoturno: Math.round(totalHorasAdicionalNoturno * 10) / 10,
    horasAbonadas: Math.round(horasAbonadas * 10) / 10
  };
}

export function getRegularNightIntersection(entrada: string | null, saida: string | null): string {
  if (!entrada || !saida) return "das 22:00 às 05:00";

  const [h1, m1] = entrada.split(":").map(Number);
  const [h2, m2] = saida.split(":").map(Number);
  const mEnt = h1 * 60 + m1;
  let mSai = h2 * 60 + m2;

  if (mSai < mEnt) {
    mSai += 24 * 60;
  }

  // NOTE: This covers up to 3 consecutive night-shift days.
  // For shifts longer than 72h, additional windows would need to be added.
  const windows = [
    { start: 0, end: 300 },
    { start: 1320, end: 1740 },
    { start: 2760, end: 3180 }
  ];

  let bestOStart = -1;
  let bestOEnd = -1;
  let maxOverlap = 0;

  for (const w of windows) {
    const oStart = Math.max(mEnt, w.start);
    const oEnd = Math.min(mSai, w.end);
    if (oStart < oEnd) {
      const overlap = oEnd - oStart;
      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        bestOStart = oStart;
        bestOEnd = oEnd;
      }
    }
  }

  if (maxOverlap > 0) {
    const formatMin = (totMin: number) => {
      const h = Math.floor(totMin / 60) % 24;
      const m = totMin % 60;
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    };
    return `das ${formatMin(bestOStart)} às ${formatMin(bestOEnd)}`;
  }

  return "das 22:00 às 05:00";
}