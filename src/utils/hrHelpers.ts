import { User, Jornada, PontosGlobal, Batida } from "../types";
import { getJornada } from "../data/mockData";

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
    .filter(u => /^\d+$/.test(u.matricula))
    .map(u => parseInt(u.matricula, 10));
  return String((nums.length ? Math.max(...nums) : 100000) + 1).padStart(6, "0");
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
      return calcHoursBetween(j.sabadoEntrada, j.sabadoSaida);
    }
    return 4;
  }

  if (!j.entrada || !j.saida) return j.horasDia || 8;
  const toM = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  let total = toM(j.saida) - toM(j.entrada);
  if (j.saidaAlmoco && j.retornoAlmoco) {
    total -= (toM(j.retornoAlmoco) - toM(j.saidaAlmoco));
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
    const nightStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 22, 0, 0, 0);
    const nightEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 5, 0, 0, 0);

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

export function formatNightShiftOverlaps(overlaps: NightShiftOverlap[]): { totalHoras: number; texto: string } {
  const totalHoras = overlaps.reduce((sum, o) => sum + o.horas, 0);
  if (totalHoras === 0) {
    return { totalHoras: 0, texto: "" };
  }
  const parts = overlaps.map(o => `${o.textoIntervalo}`);
  let texto = parts.join(", ");
  return { totalHoras, texto };
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

export function calcularDia(
  userId: number,
  dayKey: string,
  users: User[],
  pontosGlobal: PontosGlobal,
  feriadosGlobais?: string[],
  toleranciaMin: number = 10
) {
  const u = users.find(x => x.id === userId);
  if (!u) return null;

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
  const hojeStr = new Date().toISOString().slice(0, 10);

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

  const entradaReal = new Date(bEntrada.hora);
  const saidaReal   = bSaida && bSaida.hora ? new Date(bSaida.hora) : null;
  const dSaidaAlm   = bSaidaAlm && bSaidaAlm.hora ? new Date(bSaidaAlm.hora) : null;
  const dRetorno    = bRetorno && bRetorno.hora ? new Date(bRetorno.hora) : null;

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
  const contaParaCartao = horasEfetivas >= metaHorasCartao;

  return { status, horasTrabalhadas, horasEfetivas, horasJornada, atrasoMin, saidaAntMin, horasExtra, contaParaCartao, adicNoturnoHoras, adicNoturnoTexto };
}

export function resumoMesCalculado(
  userId: number,
  ano: number,
  mes: number,
  users: User[],
  pontosGlobal: PontosGlobal,
  minimoHorasDia: number,
  feriadosGlobais?: string[]
) {
  const u = users.find(x => x.id === userId);
  const temDireito = u?.direitoAlimentacao !== false;

  const total = new Date(ano, mes + 1, 0).getDate();
  let horasTrabalhadas = 0, horasEsperadas = 0, horasExtra = 0;
  let minutosAtraso = 0, minutosAntecipacao = 0;
  let diasFalta = 0, diasAtestado = 0, diasAfastamento = 0, horasParaCartao = 0;
  let diasFerias = 0, diasFeriado = 0;
  let totalDiasAdicionalNoturno = 0;
  let totalHorasAdicionalNoturno = 0;

  for (let d = 1; d <= total; d++) {
    const date = new Date(ano, mes, d);
    const dayKey = date.toISOString().slice(0, 10);
    const r = calcularDia(userId, dayKey, users, pontosGlobal, feriadosGlobais);
    if (!r) continue;

    if (r.adicNoturnoHoras && r.adicNoturnoHoras > 0) {
      totalDiasAdicionalNoturno++;
      totalHorasAdicionalNoturno += r.adicNoturnoHoras;
    }

    if (r.status === "folga" || r.status === "futuro") continue;
    if (r.status === "ferias") {
      diasFerias++;
      continue;
    }
    if (r.status === "feriado") {
      diasFeriado++;
      continue;
    }
    horasEsperadas    += r.horasJornada;
    horasTrabalhadas  += r.horasTrabalhadas;
    horasExtra        += r.horasExtra;
    minutosAtraso     += r.atrasoMin;
    minutosAntecipacao+= r.saidaAntMin;
    if (r.status === "falta")       diasFalta++;
    if (r.status === "atestado")    diasAtestado++;
    if (r.status === "afastamento") diasAfastamento++;
    if (r.contaParaCartao && r.horasEfetivas >= minimoHorasDia) {
      horasParaCartao += 1;
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
    diasCartao:         temDireito ? Math.round(horasParaCartao) : 0,
    diasFerias,
    diasFeriado,
    diasAdicionalNoturno: totalDiasAdicionalNoturno,
    horasAdicionalNoturno: Math.round(totalHorasAdicionalNoturno * 10) / 10
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

