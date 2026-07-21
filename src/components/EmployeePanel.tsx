import React, { useState, useEffect, useRef } from "react";
import { Check, Calendar, Clock, Unlock, Shield, SquarePen, ShieldCheck, Stethoscope, Folder, X, Upload, Camera, FileText, AlertTriangle, Eye, ArrowLeft, RefreshCw, File } from "lucide-react";
import { ThemeColors, User, Batida, DiaPontos, PontosGlobal, FolhaAceite } from "../types";
import { getOverlapWithNightShift, calcularDia, resumoMesCalculado } from "../utils/hrHelpers";
import { getJornada } from "../data/mockData";
import { LgpdModal } from "./LgpdModal";

function resizeAndCompressImage(base64Str: string, maxWidth = 480, maxHeight = 480, quality = 0.42): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Maintain aspect ratio
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
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
    img.src = base64Str;
  });
}

interface EmployeePanelProps {
  t: ThemeColors;
  currentUser: User;
  onLogout: () => void;
  pontosGlobal: PontosGlobal;
  setPontosGlobal: React.Dispatch<React.SetStateAction<PontosGlobal>>;
  onAddLog: (acao: string, alvo: string, detalhe?: string) => void;
  feriados?: string[];
  syncNow?: () => Promise<void>;
  isSyncing?: boolean;
  syncError?: string | null;
  setSyncError?: React.Dispatch<React.SetStateAction<string | null>>;
  registerPrePonto?: (userId: number, userName: string, matricula: string, dayKey: string, idx: number, tipo: "auto" | "manual") => Promise<string>;
  markPrePontoSuccess?: (prePontoId: string) => Promise<void>;
  cancelPrePonto?: (prePontoId: string) => Promise<void>;
  folhasAceite?: FolhaAceite[];
  setFolhasAceite?: React.Dispatch<React.SetStateAction<FolhaAceite[]>>;
  updateUserBloqueioAceite?: (userId: number, blocked: boolean) => Promise<void>;
}

export function EmployeePanel({ 
  t, 
  currentUser, 
  onLogout, 
  pontosGlobal, 
  setPontosGlobal, 
  onAddLog, 
  feriados = [],
  syncNow,
  isSyncing = false,
  syncError,
  setSyncError,
  registerPrePonto,
  markPrePontoSuccess,
  cancelPrePonto,
  folhasAceite = [],
  setFolhasAceite,
  updateUserBloqueioAceite
}: EmployeePanelProps) {
  const [now, setNow] = useState(new Date());
  const [isLgpdOpen, setIsLgpdOpen] = useState(false);

  const [modoLeve, setModoLeve] = useState<boolean>(() => {
    try {
      return localStorage.getItem("modo_leve") === "true";
    } catch (e) {
      return false;
    }
  });

  const toggleModoLeve = () => {
    const newValue = !modoLeve;
    setModoLeve(newValue);
    try {
      localStorage.setItem("modo_leve", String(newValue));
    } catch (e) {
      console.error(e);
    }
  };

  // Safe Monotonic NTP-like Clock Sync states
  const getInitialOffset = () => {
    try {
      const cached = localStorage.getItem("hr_clock_offset");
      return cached ? Number(cached) : 0;
    } catch (_) {
      return 0;
    }
  };

  const [baseRealTime, setBaseRealTime] = useState<number | null>(() => {
    return Date.now() + getInitialOffset();
  });
  const [basePerfTime, setBasePerfTime] = useState<number | null>(() => {
    return performance.now();
  });
  const [clockStatus, setClockStatus] = useState<"syncing" | "synced" | "local">("syncing");
  const [triggerSync, setTriggerSync] = useState(0);
  const [isRegistering, setIsRegistering] = useState(false);
  const [currentPrePontoId, setCurrentPrePontoId] = useState<string | null>(null);

  // Find any pending sheets for this employee
  const pendingFolha = (folhasAceite || []).find(f => f.userId === currentUser.id && f.status === "pendente");
  
  // Local state for the acceptance popup
  const [pdfVisualizado, setPdfVisualizado] = useState(false);
  const [aceitoConfirmText, setAceitoConfirmText] = useState("");
  const [motivoRecusa, setMotivoRecusa] = useState("");
  const [showRecusoInput, setShowRecusoInput] = useState(false);
  const [showAceitoInput, setShowAceitoInput] = useState(false);
  const [submittingAceite, setSubmittingAceite] = useState(false);
  const [aceiteError, setAceiteError] = useState("");
  const [signedSuccessFolha, setSignedSuccessFolha] = useState<FolhaAceite | null>(null);

  const handleConfirmAceite = async () => {
    if (!pendingFolha) return;
    if (aceitoConfirmText !== "ACEITO") {
      setAceiteError("Por favor, digite 'ACEITO' exatamente como solicitado para assinar digitalmente.");
      return;
    }
    setSubmittingAceite(true);
    setAceiteError("");
    try {
      const updated: FolhaAceite = {
        ...pendingFolha,
        status: "aceito",
        textoAceite: `Eu, ${currentUser.nome}, portador(a) da matrícula nº ${currentUser.matricula}, declaro para os devidos fins de direito e em conformidade com as diretrizes de relações trabalhistas, que visualizei, conferi e aceito integralmente esta folha de ponto digital referente ao período, atestando a exatidão de todos os horários e informações registradas, sem quaisquer ressalvas ou divergências.`,
        respondidoEm: new Date().toISOString()
      };
      if (setFolhasAceite) {
        setFolhasAceite(prev => prev.map(f => f.id === pendingFolha.id ? updated : f));
      }
      onAddLog("Aceitou Folha de Ponto", `${currentUser.nome} (Mês: ${pendingFolha.mes + 1}/${pendingFolha.ano})`, "Assinatura digital efetuada com sucesso.");
      
      setSignedSuccessFolha(updated);

      // reset states
      setPdfVisualizado(false);
      setAceitoConfirmText("");
      setShowRecusoInput(false);
      setShowAceitoInput(false);
      setMotivoRecusa("");
    } catch (err: any) {
      setAceiteError("Erro ao salvar aceite no servidor: " + err.message);
    } finally {
      setSubmittingAceite(false);
    }
  };

  const handleConfirmRecusa = async () => {
    if (!pendingFolha) return;
    if (!motivoRecusa.trim()) {
      setAceiteError("Por favor, informe o motivo da recusa.");
      return;
    }
    setSubmittingAceite(true);
    setAceiteError("");
    try {
      const updated: FolhaAceite = {
        ...pendingFolha,
        status: "recusado",
        motivoRecusa: motivoRecusa.trim(),
        respondidoEm: new Date().toISOString()
      };
      if (setFolhasAceite) {
        setFolhasAceite(prev => prev.map(f => f.id === pendingFolha.id ? updated : f));
      }
      onAddLog("Recusou Folha de Ponto", `${currentUser.nome} (Mês: ${pendingFolha.mes + 1}/${pendingFolha.ano})`, `Motivo: ${motivoRecusa.trim()}`);
      
      // Block the user!
      if (updateUserBloqueioAceite) {
        await updateUserBloqueioAceite(currentUser.id, true);
      }
      
      // reset states
      setPdfVisualizado(false);
      setAceitoConfirmText("");
      setShowRecusoInput(false);
      setShowAceitoInput(false);
      setMotivoRecusa("");
    } catch (err: any) {
      setAceiteError("Erro ao registrar recusa: " + err.message);
    } finally {
      setSubmittingAceite(false);
    }
  };

  const countPendingSync = () => {
    let count = 0;
    const userRegs = pontosGlobal[currentUser.id];
    if (userRegs) {
      for (const dayKey of Object.keys(userRegs)) {
        const day = userRegs[dayKey];
        if (day) {
          for (const b of day) {
            if (b && (b.gravadoOffline || b.serverTime === "pending")) {
              count++;
            }
          }
        }
      }
    }
    return count;
  };

  const getSyncDate = () => {
    if (baseRealTime !== null && basePerfTime !== null) {
      const elapsed = performance.now() - basePerfTime;
      return new Date(baseRealTime + elapsed);
    }
    return new Date(Date.now() + getInitialOffset());
  };

  const todayKey = () => {
    const syncDate = getSyncDate();
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });
      const parts = formatter.formatToParts(syncDate);
      const year = parts.find(p => p.type === "year")?.value;
      const month = parts.find(p => p.type === "month")?.value;
      const day = parts.find(p => p.type === "day")?.value;
      return `${year}-${month}-${day}`;
    } catch (e) {
      return syncDate.toISOString().slice(0, 10);
    }
  };

  // Safe Brasilia clock sync routine using same-origin to avoid instable/blocked external domains
  useEffect(() => {
    let active = true;

    async function syncTime() {
      setClockStatus("syncing");
      const url = window.location.origin + "/?t=" + Date.now();
      let resolved = false;

      try {
        const start = performance.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const res = await fetch(url, { 
          method: "HEAD",
          signal: controller.signal 
        });
        clearTimeout(timeoutId);

        if (res.ok && active) {
          const dateHeader = res.headers.get("date");
          if (dateHeader) {
            const apiEpoch = new Date(dateHeader).getTime();
            const rtt = performance.now() - start;
            const realEpoch = apiEpoch + rtt / 2;
            const offset = realEpoch - Date.now();
            
            try {
              localStorage.setItem("hr_clock_offset", String(offset));
            } catch (_) {}

            setBaseRealTime(realEpoch);
            setBasePerfTime(performance.now());
            setClockStatus("synced");
            resolved = true;
            console.log(`[Clock Sync] Sincronizado com o servidor. Offset: ${offset.toFixed(0)}ms. RTT: ${rtt.toFixed(1)}ms.`);

            // Audit log if offset is abnormally high (more than 3 minutes, indicating local clock manipulation)
            if (Math.abs(offset) > 3 * 60 * 1000) {
              const offsetMinutes = Math.round(offset / 60000);
              console.warn(`[Audit] Grande desvio de relógio detectado no painel: ${offsetMinutes} min.`);
              if (onAddLog) {
                onAddLog(
                  "Suspeita de Manipulação de Horário",
                  `${currentUser.nome} (${currentUser.matricula})`,
                  `Relógio do dispositivo desviado em ${offsetMinutes} min em relação ao servidor.`
                );
              }
            }
          }
        }
      } catch (e) {
        console.warn("[Clock Sync] Falha ao sincronizar com servidor, tentando local com cache.", e);
      }

      if (active && !resolved) {
        const cachedOffset = getInitialOffset();
        const localSynced = Date.now() + cachedOffset;
        setBaseRealTime(localSynced);
        setBasePerfTime(performance.now());
        setClockStatus("local");
      }
    }

    syncTime();

    return () => {
      active = false;
    };
  }, [triggerSync]);

  // Periodic re-sync of clock offset (every 1 hour) to cover long active sessions and prevent drift
  useEffect(() => {
    const interval = setInterval(() => {
      setTriggerSync(prev => prev + 1);
    }, 3600000); // 1 hour
    return () => clearInterval(interval);
  }, []);

  // UI state
  const [confirmModal, setConfirmModal] = useState<{ idx: number; dayKey: string } | null>(null);
  const [manualModal, setManualModal] = useState<{ idx: number; dayKey: string } | null>(null);
  const [manualHora, setManualHora] = useState("");
  const [manualJust, setManualJust] = useState("");
  const [manualError, setManualError] = useState("");
  const [calOpen, setCalOpen] = useState(false);
  const [calDay, setCalDay] = useState<string | null>(null);

  // Atestado e PDF states
  const [atestadoModalOpen, setAtestadoModalOpen] = useState(false);
  const [atestadoDataInicio, setAtestadoDataInicio] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [atestadoDataFim, setAtestadoDataFim] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [atestadoCid, setAtestadoCid] = useState("");
  const [atestadoFoto, setAtestadoFoto] = useState<string | null>(null); // base64 string
  const [atestadoFotoNome, setAtestadoFotoNome] = useState("");
  const [atestadoIsParcial, setAtestadoIsParcial] = useState(false);
  const [atestadoParcialInicio, setAtestadoParcialInicio] = useState("08:00");
  const [atestadoParcialFim, setAtestadoParcialFim] = useState("12:00");
  const [atestadoObs, setAtestadoObs] = useState("");
  const [atestadoError, setAtestadoError] = useState("");
  const [atestadoSucesso, setAtestadoSucesso] = useState(false);
  const [atestadoSubmitting, setAtestadoSubmitting] = useState(false);

  // Webcam states
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfMes, setPdfMes] = useState(() => new Date().getMonth());
  const [pdfAno, setPdfAno] = useState(() => new Date().getFullYear());

  // Geoloc states
  const [geoActiveFor, setGeoActiveFor] = useState<{
    idx: number;
    dayKey: string;
    tipo: "auto" | "manual";
    manualHora?: string;
    manualJust?: string;
  } | null>(null);

  const [geoConsentAccepted, setGeoConsentAccepted] = useState(false);
  const [geoCoords, setGeoCoords] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Progressive accuracy filter states
  const [geoWatchId, setGeoWatchId] = useState<number | null>(null);
  const [geoIntervalId, setGeoIntervalId] = useState<any | null>(null);
  const [geoCountdown, setGeoCountdown] = useState<number>(0);
  const [geoSamplesCount, setGeoSamplesCount] = useState<number>(0);
  const [bestGeoCoords, setBestGeoCoords] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);

  function clearGeo() {
    setGeoConsentAccepted(false);
    setGeoCoords(null);
    setBestGeoCoords(null);
    setGeoLoading(false);
    setGeoError(null);
    setGeoSamplesCount(0);
    setGeoCountdown(0);
    if (geoWatchId !== null) {
      navigator.geolocation.clearWatch(geoWatchId);
      setGeoWatchId(null);
    }
    if (geoIntervalId !== null) {
      clearInterval(geoIntervalId);
      setGeoIntervalId(null);
    }
  }

  // Auto clean up watch and timers on unmount
  useEffect(() => {
    return () => {
      if (geoWatchId !== null) {
        navigator.geolocation.clearWatch(geoWatchId);
      }
      if (geoIntervalId !== null) {
        clearInterval(geoIntervalId);
      }
    };
  }, [geoWatchId, geoIntervalId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(getSyncDate());
    }, 1000);
    return () => clearInterval(timer);
  }, [baseRealTime, basePerfTime]);

  // Background auto-sync interval when there are pending punches
  useEffect(() => {
    if (countPendingSync() === 0 || !syncNow) return;
    const interval = setInterval(() => {
      console.log("[Auto-Sync] Attempting background sync for pending punches...");
      syncNow().catch((err) => console.warn("[Auto-Sync] Failed:", err));
    }, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [pontosGlobal, syncNow]);

  // Webcam stream management side effect
  useEffect(() => {
    if (cameraAtiva && videoRef.current) {
      async function setupCamera() {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          setCameraStream(stream);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Camera access failed:", err);
          setAtestadoError("Não foi possível acessar a câmera do dispositivo. Por favor, carregue o arquivo de foto abaixo.");
          setCameraAtiva(false);
        }
      }
      setupCamera();
    } else {
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        setCameraStream(null);
      }
    }
  }, [cameraAtiva]);

  function capturarFoto() {
    if (videoRef.current) {
      try {
        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const rawQuality = modoLeve ? 0.4 : 0.6;
          const dataUrl = canvas.toDataURL("image/jpeg", rawQuality);
          
          const maxDim = modoLeve ? 320 : 480;
          const compQuality = modoLeve ? 0.3 : 0.42;
          
          resizeAndCompressImage(dataUrl, maxDim, maxDim, compQuality).then(compressed => {
            setAtestadoFoto(compressed);
            setAtestadoFotoNome(`captura_${new Date().getTime()}.jpg`);
            setCameraAtiva(false);
            setAtestadoError("");
          }).catch((err) => {
            console.error("Image compression failed:", err);
            setAtestadoFoto(dataUrl);
            setAtestadoFotoNome(`captura_${new Date().getTime()}.jpg`);
            setCameraAtiva(false);
            setAtestadoError("");
          });
        }
      } catch (err) {
        console.error("Failed to capture photo:", err);
        setAtestadoError("Falha ao capturar a foto através da câmera.");
      }
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setAtestadoError("");
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setAtestadoError("O arquivo excede o tamanho máximo de 5MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const rawBase64 = reader.result as string;
        
        const maxDim = modoLeve ? 320 : 480;
        const compQuality = modoLeve ? 0.3 : 0.42;

        resizeAndCompressImage(rawBase64, maxDim, maxDim, compQuality).then(compressed => {
          setAtestadoFoto(compressed);
          setAtestadoFotoNome(file.name);
        }).catch((err) => {
          console.error("Image compression failed:", err);
          setAtestadoFoto(rawBase64);
          setAtestadoFotoNome(file.name);
        });
      };
      reader.onerror = () => {
        setAtestadoError("Erro ao ler o arquivo selecionado.");
      };
      reader.readAsDataURL(file);
    }
  }

  async function enviarAtestado() {
    setAtestadoError("");
    if (!atestadoCid.trim()) {
      setAtestadoError("O preenchimento do CID é obrigatório.");
      return;
    }
    if (!atestadoFoto) {
      setAtestadoError("A foto do atestado é de envio obrigatório.");
      return;
    }

    if (!atestadoDataInicio || !atestadoDataFim) {
      setAtestadoError("As datas de início e retorno são obrigatórias.");
      return;
    }

    if (atestadoDataFim < atestadoDataInicio) {
      setAtestadoError("A data de retorno/fim do afastamento não pode ser anterior à data de início.");
      return;
    }

    if (atestadoIsParcial && atestadoDataInicio !== atestadoDataFim) {
      setAtestadoError("Atestados de horas (parciais) só podem ser lançados para um único dia. Selecione o mesmo dia no início e retorno.");
      return;
    }

    setAtestadoSubmitting(true);
    try {
      // Obter todas as datas no intervalo (inclusive)
      const datas: string[] = [];
      const start = new Date(atestadoDataInicio + "T12:00:00");
      const end = new Date(atestadoDataFim + "T12:00:00");
      const current = new Date(start);
      while (current <= end) {
        datas.push(current.toISOString().slice(0, 10));
        current.setDate(current.getDate() + 1);
      }

      const userRegs = pontosGlobal[currentUser.id] || {};
      const updatedDays = { ...userRegs };

      const timestamp = getSyncDate().toISOString();

      datas.forEach(dayKey => {
        const dayArray = [...(updatedDays[dayKey] || [null, null, null, null])];

        const atestadoObj: Batida = {
          ocorrencia: "atestado",
          parcial: atestadoIsParcial,
          cid: atestadoCid.trim().toUpperCase(),
          fotoAtestado: atestadoFoto,
          obs: atestadoObs.trim() || `Atestado Médico lançado pelo colaborador (CID: ${atestadoCid.trim().toUpperCase()})`,
          registradoEm: timestamp,
          tipo: "manual",
          serverTime: "pending"
        };

        // Set at index 1 to match system convention
        dayArray[1] = atestadoObj;

        if (atestadoIsParcial) {
          const baseDateString = `${dayKey}T`;
          if (!dayArray[0]) {
            dayArray[0] = {
              hora: new Date(baseDateString + atestadoParcialInicio + ":00").toISOString(),
              tipo: "manual",
              registradoEm: timestamp,
              serverTime: "pending"
            };
          }
          if (!dayArray[3]) {
            dayArray[3] = {
              hora: new Date(baseDateString + atestadoParcialFim + ":00").toISOString(),
              tipo: "manual",
              registradoEm: timestamp,
              cobertoPorAtestado: true,
              serverTime: "pending"
            };
          }
        } else {
          dayArray[0] = null;
          dayArray[2] = null;
          dayArray[3] = null;
        }

        updatedDays[dayKey] = dayArray;
      });

      setPontosGlobal(prev => ({
        ...prev,
        [currentUser.id]: updatedDays
      }));

      const descLog = atestadoDataInicio === atestadoDataFim
        ? `Atestado em ${atestadoDataInicio}`
        : `Atestado de ${atestadoDataInicio} até ${atestadoDataFim}`;

      onAddLog(
        "Lançou Atestado",
        `${currentUser.nome} (${currentUser.matricula})`,
        `${descLog} | CID: ${atestadoCid.trim().toUpperCase()} | Tipo: ${atestadoIsParcial ? "Parcial" : "Dia Inteiro"} | Foto incluída.`
      );

      setAtestadoSucesso(true);
      setTimeout(() => {
        setAtestadoSucesso(false);
        setAtestadoModalOpen(false);
        setAtestadoCid("");
        setAtestadoFoto(null);
        setAtestadoFotoNome("");
        setAtestadoObs("");
        setAtestadoIsParcial(false);
        const todayStr = new Date().toISOString().slice(0, 10);
        setAtestadoDataInicio(todayStr);
        setAtestadoDataFim(todayStr);
      }, 2000);
    } catch (err) {
      console.error("Error submitting medical certificate:", err);
      setAtestadoError("Falha ao salvar o atestado médico. Tente novamente.");
    } finally {
      setAtestadoSubmitting(false);
    }
  }

  function gerarEspelhoHTMLForEmployee(year: number, month: number) {
    const u = currentUser;
    const J = u.jornadaId === "personalizada" ? u.jornadaCustom : getJornada(u.jornadaId || "");
    const users = [u];

    const cachedMinimoHoras = (() => {
      try {
        return Number(localStorage.getItem("hr_cached_minimo_horas_dia") || "7");
      } catch {
        return 7;
      }
    })();

    const resumo = resumoMesCalculado(u.id, year, month, users, pontosGlobal, cachedMinimoHoras, feriados);
    const dias = [];
    const total = new Date(year, month + 1, 0).getDate();

    const MESES_FULL = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    const empresaConfig = (() => {
      try {
        return JSON.parse(localStorage.getItem("hr_cached_empresa_config") || '{"nome": "G&A Softwares S/A", "cnpj": "42.109.845/0001-90"}');
      } catch {
        return { nome: "G&A Softwares S/A", cnpj: "42.109.845/0001-90" };
      }
    })();

    for (let d = 1; d <= total; d++) {
      const date = new Date(year, month, d);
      const key = date.toISOString().slice(0, 10);
      const batidas = pontosGlobal[u.id]?.[key] || [null, null, null, null];
      const calc = calcularDia(u.id, key, users, pontosGlobal, feriados);
      const diaSem = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][date.getDay()];

      const fmtB = (b: any) => {
        if (!b) return "—";
        if (b.ocorrencia) {
          return b.ocorrencia === "atestado" ? (b.parcial ? "Atestado Parcial" : "Atestado") : b.ocorrencia === "afastamento" ? "Afastamento" : b.ocorrencia === "falta" ? "Falta" : b.ocorrencia;
        }
        let timeStr = new Date(b.hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        if (b.suspeitoHoraModificada) {
          timeStr += " ⚠️ Suspeito";
        }
        return b.latitude && b.longitude ? `${timeStr} 📍` : timeStr;
      };

      dias.push({ d, diaSem, key, batidas, calc, fmtB });
    }

    const corStatus: Record<string, string> = { completo: "#16a34a", parcial: "#d97706", falta: "#dc2626", atestado: "#2563eb", afastamento: "#7c3aed", folga: "#9ca3af", futuro: "#9ca3af", ferias: "#7c3aed", feriado: "#df2222" };
    const nomesStatus: Record<string, string> = { completo: "Completo", parcial: "Parcial", falta: "Falta", atestado: "Atestado", afastamento: "Afastamento", folga: "Folga", futuro: "A planejar", ferias: "Férias", feriado: "Feriado" };

    const fmtHPdf = (h: number) => {
      const hh = Math.floor(h);
      const mm = Math.round((h - hh) * 60);
      return `${hh}h ${String(mm).padStart(2, "0")}m`;
    };

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Espelho de Ponto — ${u.nome}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 11.5px; color: #111; background: #fff; padding: 20px; }
  .header { border-bottom: 2px solid #1e40af; padding-bottom: 12px; margin-bottom: 16px; }
  .empresa { font-size: 16px; font-weight: bold; color: #1e40af; }
  .cnpj { font-size: 11px; color: #555; margin-top: 2px; }
  .titulo { font-size: 13px; font-weight: bold; text-align: center; margin: 8px 0 4px; text-transform: uppercase; letter-spacing: 1px; }
  .colaborador { display: flex; gap: 40px; background: #f0f4ff; padding: 8px 12px; border-radius: 4px; margin-bottom: 12px; font-size: 11px; }
  .colaborador strong { display: block; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10.5px; }
  th { background: #1e40af; color: white; padding: 5px 6px; text-align: center; font-size: 10px; text-transform: uppercase; }
  td { padding: 4px 6px; text-align: center; border-bottom: 1px solid #e5e7eb; }
  tr.fim-semana td { background: #f9fafb; color: #9ca3af; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 9px; font-weight: bold; }
  .resumo { display: grid; grid-template-columns: repeat(5,1fr); gap: 8px; margin-bottom: 14px; }
  .card { border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px 10px; }
  .card-val { font-size: 16px; font-weight: bold; }
  .card-label { font-size: 9px; color: #6b7280; text-transform: uppercase; margin-top: 2px; }
  .cartao { text-align: center; padding: 10px; border-radius: 4px; font-weight: bold; font-size: 13px; margin-bottom: 14px; }
  .cartao.ok { background: #dcfce7; color: #16a34a; border: 1px solid #86efac; }
  .assinaturas { display: flex; justify-content: space-between; margin-top: 30px; padding-top: 10px; }
  .ass-linha { width: 200px; border-top: 1px solid #111; text-align: center; padding-top: 4px; font-size: 10px; color: #555; }
</style></head><body>
<div class="header">
  <div class="empresa">${empresaConfig.nome}</div>
  ${empresaConfig.cnpj ? `<div class="cnpj">CNPJ: ${empresaConfig.cnpj}</div>` : ""}
  <div class="titulo">Espelho de Ponto — ${MESES_FULL[month]} ${year}</div>
</div>
<div class="colaborador">
  <div><strong>${u.nome}</strong>Colaborador(a)</div>
  <div><strong>${u.matricula}</strong>Matrícula</div>
  <div><strong>${J ? J.nome : "—"}</strong>Jornada</div>
  <div><strong>${J?.entrada || "—"} às ${J?.saida || "—"}</strong>Horário</div>
  <div><strong>${u.insalubridade ? `${u.insalubridade}%` : "Não possui"}</strong>Insalubridade</div>
</div>
<div class="resumo">
  <div class="card"><div class="card-val">${fmtHPdf(resumo.horasTrabalhadas)}</div><div class="card-label">Horas trabalhadas</div></div>
  <div class="card"><div class="card-val" style="color:${resumo.horasTrabalhadas - resumo.horasEsperadas >= 0 ? "#16a34a" : "#dc2626"}">${resumo.horasTrabalhadas - resumo.horasEsperadas >= 0 ? "+" : ""}${fmtHPdf(Math.abs(resumo.horasTrabalhadas - resumo.horasEsperadas))}</div><div class="card-label">Saldo de horas</div></div>
  <div class="card"><div class="card-val" style="color:${resumo.diasFalta > 0 ? "#dc2626" : "#16a34a"}">${resumo.diasFalta}</div><div class="card-label">Faltas</div></div>
  <div class="card"><div class="card-val">${fmtHPdf(resumo.horasExtra)}</div><div class="card-label">Horas extras</div></div>
  <div class="card" style="background:#fefce8; border-color:#fef08a; text-align:center;"><div class="card-val" style="color:#b45309;">${resumo.diasAdicionalNoturno} dias <span style="font-size:10px;font-weight:normal;">(${fmtHPdf(resumo.horasAdicionalNoturno)})</span></div><div class="card-label" style="color:#b45309;">Adicional Noturno</div></div>
</div>
<div class="cartao ok">
  🎴 Cartão Alimentação: ${resumo.diasCartao} dias concedidos (mínimo ${cachedMinimoHoras}h/dia)
</div>
<table>
  <tr><th>Dia</th><th>Data</th><th>Entrada</th><th>S. Almoço</th><th>Retorno</th><th>Saída</th><th>H. Trab.</th><th>Adic. Noturno</th><th>Ocorrência</th></tr>
  ${dias
    .map(({ d, diaSem, key, batidas, calc, fmtB }) => {
      const isFds = [0, 6].includes(new Date(key + "T12:00:00").getDay());
      const ocTag = calc?.status && calc.status !== "completo" && calc.status !== "futuro" ? `<span class="badge" style="background:${corStatus[calc.status]}22;color:${corStatus[calc.status]}">${nomesStatus[calc.status] || calc.status}</span>` : "";
      const adicStr = calc?.adicNoturnoHoras > 0 ? `<span style="font-weight: 600; color:#b45309; font-size: 9.5px;">${calc.adicNoturnoTexto} (${fmtHPdf(calc.adicNoturnoHoras)})</span>` : "—";
      return `<tr class="${isFds ? "fim-semana" : ""}">
      <td>${diaSem}</td>
      <td>${String(d).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}</td>
      <td>${fmtB(batidas[0])}</td><td>${fmtB(batidas[1])}</td>
      <td>${fmtB(batidas[2])}</td><td>${fmtB(batidas[3])}</td>
      <td>${calc?.horasTrabalhadas > 0 ? fmtHPdf(calc.horasTrabalhadas) : "—"}</td>
      <td>${adicStr}</td>
      <td>${ocTag}</td>
    </tr>`;
    })
    .join("")}
</table>
<div class="assinaturas">
  <div class="ass-linha">Assinatura do Colaborador</div>
  <div class="ass-linha">Assinatura do Responsável</div>
</div>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (!win) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `espelho_${u.matricula}.html`;
      a.click();
    }
  }

  const tk = todayKey();
  const todayBatidas = pontosGlobal[currentUser.id]?.[tk] || [null, null, null, null];
  const temAlmoco = todayBatidas[1] !== null;

  const steps = [
    { label: "Registrar Entrada", done: "Entrada", color: "#22C55E", light: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.35)" },
    { label: "Saída para Almoço", done: "Almoço", color: "#F59E0B", light: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.35)" },
    { label: "Retorno do Almoço", done: "Volta", color: "#3B82F6", light: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.35)" },
    { 
      label: temAlmoco ? "Encerrar Expediente" : "Saída Sem Almoço", 
      done: temAlmoco ? "Saída" : "Saída Sem Almoço", 
      color: "#EF4444", 
      light: "rgba(239,68,68,0.12)", 
      border: "rgba(239,68,68,0.35)" 
    }
  ];

  const nextIdx = todayBatidas.findIndex(b => b === null);
  const allDone = todayBatidas[3] !== null || nextIdx === -1;
  const current = allDone ? null : steps[nextIdx];

  function isStepClickable(i: number): boolean {
    if (allDone) return false;
    if (i === 0) {
      return todayBatidas[0] === null;
    }
    if (i === 1) {
      return todayBatidas[0] !== null && todayBatidas[1] === null;
    }
    if (i === 2) {
      return todayBatidas[1] !== null && todayBatidas[2] === null;
    }
    if (i === 3) {
      if (todayBatidas[1] === null) {
        return todayBatidas[0] !== null && todayBatidas[3] === null;
      } else {
        return todayBatidas[2] !== null && todayBatidas[3] === null;
      }
    }
    return false;
  }

  function calcHoras(batidas: DiaPontos): string | null {
    const [e, sA, rA, s] = batidas.map(b => (b && b.hora && !b.duplicadoOculto ? new Date(b.hora) : null));
    if (!e) return null;
    const fim = s || now;
    let ms = fim.getTime() - e.getTime();
    if (sA && rA) {
      ms -= rA.getTime() - sA.getTime();
    } else if (sA && !rA) {
      ms -= now.getTime() - sA.getTime();
    }
    if (ms < 0) ms = 0;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${String(m).padStart(2, "0")}min`;
  }

  function capturarLocalizacao() {
    setGeoLoading(true);
    setGeoError(null);
    setGeoConsentAccepted(true);
    setGeoSamplesCount(0);
    setBestGeoCoords(null);
    setGeoCoords(null);

    if (!navigator.geolocation) {
      setGeoError("Geolocalização não é suportada por este navegador.");
      setGeoLoading(false);
      return;
    }

    let bestCoords: { latitude: number; longitude: number; accuracy?: number } | null = null;
    let samples = 0;
    let watchId: number | null = null;
    let intervalId: any = null;

    const totalDuration = 10;
    setGeoCountdown(totalDuration);

    function stopAndSelectBest(wId: number, coords: typeof bestCoords) {
      if (wId !== null) {
        navigator.geolocation.clearWatch(wId);
      }
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
      setGeoWatchId(null);
      setGeoIntervalId(null);
      setGeoLoading(false);
      setGeoCountdown(0);
      
      if (coords) {
        setGeoCoords(coords);
        setBestGeoCoords(coords);
      } else {
        // Fallback to rapid single query if watch did not return anything
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const finalCoords = {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy
            };
            setGeoCoords(finalCoords);
            setBestGeoCoords(finalCoords);
          },
          (err) => {
            console.warn("Erro ao obter localização:", err);
            setGeoError("Tempo limite atingido e nenhum sinal de geolocalização válido foi recebido.");
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      }
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    };

    try {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          samples++;
          setGeoSamplesCount(samples);
          const curAcc = position.coords.accuracy;
          const newCoords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: curAcc
          };

          if (!bestCoords || (curAcc !== undefined && (bestCoords.accuracy === undefined || curAcc < bestCoords.accuracy))) {
            bestCoords = newCoords;
            setBestGeoCoords(newCoords);
          }

          // Strict filter: accuracy <= 30 meters
          if (curAcc !== undefined && curAcc <= 30) {
            stopAndSelectBest(watchId!, newCoords);
          }
        },
        (error) => {
          console.warn("Localizacao erro no watchPosition:", error);
          if (bestCoords) {
            stopAndSelectBest(watchId!, bestCoords);
            return;
          }

          let msg = "Não foi possível obter a sua localização.";
          if (error.code === error.PERMISSION_DENIED) {
            msg = "Acesso à geolocalização recusado pelo navegador. O registro de ponto eletrônico exige a comprovação de presença física do colaborador, em conformidade com as diretrizes da Portaria 671/MTE e a LGPD. Sem essa comprovação, o ponto não pode ser validado juridicamente.";
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            msg = "Sinal de localização indisponível. Certifique-se de que o GPS ou o sinal de Wi-Fi de triangulação do aparelho estão ativados e tente novamente.";
          } else if (error.code === error.TIMEOUT) {
            msg = "Tempo limite excedido ao obter sinal de GPS. Fique próximo a uma janela ou área aberta e tente novamente.";
          }
          setGeoError(msg);
          setGeoLoading(false);
          if (watchId !== null) navigator.geolocation.clearWatch(watchId);
          if (intervalId !== null) clearInterval(intervalId);
        },
        options
      );

      setGeoWatchId(watchId);

      let remaining = totalDuration;
      intervalId = setInterval(() => {
        remaining--;
        setGeoCountdown(remaining);
        if (remaining <= 0) {
          stopAndSelectBest(watchId!, bestCoords);
        }
      }, 1000);

      setGeoIntervalId(intervalId);
    } catch (e) {
      console.error(e);
      setGeoError("Erro ao iniciar o watchPosition de geolocalização.");
      setGeoLoading(false);
    }
  }

  function finalizarComGeo() {
    if (!geoActiveFor || isRegistering) return;
    setIsRegistering(true);

    try {
      const { idx, dayKey, tipo, manualHora, manualJust } = geoActiveFor;
      const lat = geoCoords?.latitude || undefined;
      const lng = geoCoords?.longitude || undefined;
      const acc = geoCoords?.accuracy !== undefined ? geoCoords.accuracy : undefined;
      const timestamp = getSyncDate().toISOString();

      const isOffline = clockStatus === "local";

      if (tipo === "auto") {
        const reg: Batida = {
          hora: timestamp,
          tipo: "auto",
          registradoEm: timestamp,
          serverTime: "pending",
          latitude: lat,
          longitude: lng,
          accuracy: acc,
          consentimentoGeoloc: true,
          dispositivoLocalHora: new Date().toISOString(),
          gravadoOffline: isOffline ? true : undefined
        };
        setPontosGlobal(prev => {
          const userRegs = prev[currentUser.id] || {};
          const day = [...(userRegs[dayKey] || [null, null, null, null])];
          while (day.length < 4) day.push(null);
          day[idx] = reg;
          return {
            ...prev,
            [currentUser.id]: {
              ...userRegs,
              [dayKey]: day
            }
          };
        });
        onAddLog(
          isOffline ? "Registrou Ponto Offline" : "Registrou Ponto",
          `${currentUser.nome} (${currentUser.matricula})`,
          `Batida #${idx + 1} (${steps[idx].done}) registrada às ${new Date(timestamp).toLocaleTimeString()} com Geolocalização${isOffline ? " [MODO OFFLINE]" : ""}. Coordenadas: Lat: ${lat || "N/D"}, Long: ${lng || "N/D"}${acc !== undefined ? ` (Precisão: ${acc.toFixed(1)}m)` : ""}. Termo de consentimento aceito.`
        );
      } else {
        const d = new Date(dayKey + "T00:00:00");
        if (manualHora) {
          const [hh, mm] = manualHora.split(":").map(Number);
          d.setHours(hh, mm, 0, 0);
        }
        const reg: Batida = {
          hora: d.toISOString(),
          tipo: "manual",
          obs: manualJust?.trim(),
          registradoEm: timestamp,
          serverTime: "pending",
          latitude: lat,
          longitude: lng,
          accuracy: acc,
          consentimentoGeoloc: true,
          dispositivoLocalHora: new Date().toISOString(),
          gravadoOffline: isOffline ? true : undefined
        };
        setPontosGlobal(prev => {
          const userRegs = prev[currentUser.id] || {};
          const day = [...(userRegs[dayKey] || [null, null, null, null])];
          while (day.length < 4) day.push(null);
          day[idx] = reg;
          return {
            ...prev,
            [currentUser.id]: {
              ...userRegs,
              [dayKey]: day
            }
          };
        });
        onAddLog(
          isOffline ? "Inseriu Ponto Manual Offline" : "Inseriu Ponto Manual",
          `${currentUser.nome} (${currentUser.matricula})`,
          `Dia ${dayKey} às ${manualHora} (Batida #${idx + 1}): "${manualJust?.trim()}" inserido com Geolocalização${isOffline ? " [MODO OFFLINE]" : ""}. Coordenadas: Lat: ${lat || "N/D"}, Long: ${lng || "N/D"}${acc !== undefined ? ` (Precisão: ${acc.toFixed(1)}m)` : ""}. Termo de consentimento aceito.`
        );
      }

      if (currentPrePontoId && markPrePontoSuccess) {
        markPrePontoSuccess(currentPrePontoId);
        setCurrentPrePontoId(null);
      }
    } catch (err) {
      console.error("[Punch Error]", err);
    } finally {
      setGeoActiveFor(null);
      clearGeo();
      setTimeout(() => {
        setIsRegistering(false);
      }, 500);
    }
  }

  function dispensarGeo() {
    if (currentPrePontoId && cancelPrePonto) {
      cancelPrePonto(currentPrePontoId);
      setCurrentPrePontoId(null);
    }
    setGeoActiveFor(null);
    clearGeo();
  }

  async function registrarAgora(idx: number, dayKey: string) {
    if (registerPrePonto) {
      const pId = await registerPrePonto(currentUser.id, currentUser.nome, currentUser.matricula, dayKey, idx, "auto");
      setCurrentPrePontoId(pId);
    }
    setGeoActiveFor({ idx, dayKey, tipo: "auto" });
    setConfirmModal(null);
    clearGeo();
  }

  async function iniciarManualComGeo() {
    if (!manualHora.match(/^\d{2}:\d{2}$/)) {
      setManualError("Informe HH:MM.");
      return;
    }
    const [hh, mm] = manualHora.split(":").map(Number);
    if (hh > 23 || mm > 59) {
      setManualError("Horário inválido.");
      return;
    }
    if (!manualModal) return;
    const { idx, dayKey } = manualModal;
    if (registerPrePonto) {
      const pId = await registerPrePonto(currentUser.id, currentUser.nome, currentUser.matricula, dayKey, idx, "manual");
      setCurrentPrePontoId(pId);
    }
    setGeoActiveFor({
      idx,
      dayKey,
      tipo: "manual",
      manualHora,
      manualJust: manualJust.trim()
    });
    setManualModal(null);
    clearGeo();
  }

  function confirmarManual() {
    iniciarManualComGeo();
  }

  function abrirConfirm(idx: number, dayKey: string) {
    setConfirmModal({ idx, dayKey });
  }

  function abrirManual(idx: number, dayKey: string) {
    let h = "";
    let m = "";
    try {
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Sao_Paulo",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
      const parts = formatter.formatToParts(now);
      h = parts.find(p => p.type === "hour")?.value || "12";
      m = parts.find(p => p.type === "minute")?.value || "00";
    } catch {
      h = String(now.getHours()).padStart(2, "0");
      m = String(now.getMinutes()).padStart(2, "0");
    }
    setManualHora(`${h}:${m}`);
    setManualJust("");
    setManualError("");
    setManualModal({ idx, dayKey });
    setConfirmModal(null);
  }

  function fmt(batida: Batida | null) {
    if (!batida || !batida.hora) return "—";
    return new Date(batida.hora).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  }

  function fmtFull(dateStr: string | undefined) {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  function getLast30Days() {
    const days = [];
    const baseDate = getSyncDate();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(baseDate.getTime());
      d.setDate(d.getDate() - i);
      try {
        const formatter = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/Sao_Paulo",
          year: "numeric",
          month: "2-digit",
          day: "2-digit"
        });
        const parts = formatter.formatToParts(d);
        const year = parts.find(p => p.type === "year")?.value;
        const month = parts.find(p => p.type === "month")?.value;
        const day = parts.find(p => p.type === "day")?.value;
        days.push(`${year}-${month}-${day}`);
      } catch {
        days.push(d.toISOString().slice(0, 10));
      }
    }
    return days;
  }

  function dayLabel(key: string) {
    const d = new Date(key + "T12:00:00");
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  }

  function dayStatus(key: string) {
    const userFerias = currentUser.ferias || [];
    const eFerias = userFerias.some(p => key >= p.inicio && key <= p.fim);
    if (eFerias) return "ferias";

    if (feriados.includes(key)) return "feriado";

    const b = pontosGlobal[currentUser.id]?.[key];
    if (!b) return "vazio";
    const filled = b.filter(Boolean).length;
    if (filled === 0) return "vazio";
    if (filled === 4) return "completo";
    return "parcial";
  }

  function isToday(key: string) {
    return key === todayKey();
  }

  const firstName = currentUser?.nome?.split(" ")[0] || "Colaboradora";
  const dateStr = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "long" });
  const timeStr = now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const btnColor = allDone ? "#22C55E" : (current?.color || "#3B6EF8");
  const btnLight = allDone ? "rgba(34,197,94,0.13)" : (current?.light || "rgba(59,110,248,0.15)");
  const btnBorder = allDone ? "rgba(34,197,94,0.35)" : (current?.border || "rgba(59,110,248,0.35)");

  const nightShiftLast30 = getLast30Days().reduce((acc, key) => {
    const batidas = pontosGlobal[currentUser.id]?.[key];
    if (!batidas || batidas[0] === null) return acc;
    const [e, sA, rA, s] = batidas.map(b => (b && b.hora ? new Date(b.hora) : null));
    if (!e) return acc;
    const listOverlaps = [];
    if (sA) {
      listOverlaps.push(...getOverlapWithNightShift(e, sA));
      if (rA && s) {
        listOverlaps.push(...getOverlapWithNightShift(rA, s));
      }
    } else if (s) {
      listOverlaps.push(...getOverlapWithNightShift(e, s));
    }
    const h = listOverlaps.reduce((sum, o) => sum + o.horas, 0);
    if (h > 0) {
      acc.dias++;
      acc.horas += h;
    }
    return acc;
  }, { dias: 0, horas: 0 });

  const calBatidas = calDay ? pontosGlobal[currentUser.id]?.[calDay] || [null, null, null, null] : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: t.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        fontFamily: "'DM Sans','Segoe UI',sans-serif"
      }}
    >
      {/* Top Header */}
      <div style={{ width: "100%", maxWidth: 420, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setAtestadoModalOpen(true)}
            title="Lançar Atestado Médico"
            style={{
              background: t.surfaceAlt,
              border: `1.5px solid ${t.border}`,
              borderRadius: 10,
              padding: "8px 9.5px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.05)";
              e.currentTarget.style.background = t.accentGlow;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.background = t.surfaceAlt;
            }}
          >
            <Stethoscope size={19} color={t.accent} />
          </button>
          <button
            onClick={() => setPdfModalOpen(true)}
            title="Visualizar Espelho de Ponto (PDF)"
            style={{
              background: t.surfaceAlt,
              border: `1.5px solid ${t.border}`,
              borderRadius: 10,
              padding: "8px 9.5px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.05)";
              e.currentTarget.style.background = t.accentGlow;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
              e.currentTarget.style.background = t.surfaceAlt;
            }}
          >
            <Folder size={19} color={t.accent} />
          </button>
          <div>
            <div style={{ fontSize: 19, fontWeight: 700, color: t.text, lineHeight: 1.2 }}>Olá, {firstName}! 👋</div>
            <div style={{ fontSize: "12.5px", color: t.textSub, marginTop: 2, textTransform: "capitalize" }}>{dateStr}</div>
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{
            background: t.surfaceAlt,
            border: `1px solid ${t.border}`,
            borderRadius: 9,
            padding: "7px 13px",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            color: t.textSub,
            fontFamily: "inherit"
          }}
        >
          Sair
        </button>
      </div>

      {/* Expandable History Calendar */}
      {calOpen && (
        <div style={{ width: "100%", maxWidth: 420, background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 16, padding: "18px 16px", marginBottom: 20, boxShadow: t.shadow }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: t.textSub, marginBottom: 14, letterSpacing: "0.4px", textTransform: "uppercase" }}>
            Últimos 30 dias
          </div>

          {nightShiftLast30.horas > 0 && (
            <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10, padding: "10px 12px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: t.textSub, fontWeight: 550 }}>🌙 Adicional Noturno (Últimos 30 dias)</span>
              <strong style={{ fontSize: 13, color: "#D97706", fontFamily: "monospace" }}>
                {nightShiftLast30.dias} {nightShiftLast30.dias === 1 ? "dia" : "dias"} ({nightShiftLast30.horas.toFixed(1).replace(".", ",")}h)
              </strong>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5, marginBottom: calDay ? 16 : 0 }}>
            {getLast30Days().map(key => {
              const st = dayStatus(key);
              const today = isToday(key);
              const sel = calDay === key;

              const eFerias = st === "ferias";
              const eFeriado = st === "feriado";

              const bg = sel
                ? t.accent
                : today
                  ? t.accentGlow
                  : eFerias
                    ? "rgba(124,58,237,0.13)"
                    : eFeriado
                      ? "rgba(223,34,34,0.11)"
                      : st === "completo"
                        ? "rgba(34,197,94,0.15)"
                        : st === "parcial"
                          ? "rgba(245,158,11,0.13)"
                          : t.surfaceAlt;

              const border = sel
                ? t.accent
                : today
                  ? t.accent
                  : eFerias
                    ? "rgba(124,58,237,0.35)"
                    : eFeriado
                      ? "rgba(223,34,34,0.35)"
                      : st === "completo"
                        ? "rgba(34,197,94,0.4)"
                        : st === "parcial"
                          ? "rgba(245,158,11,0.4)"
                          : t.border;

              const color = sel
                ? "#fff"
                : today
                  ? t.accent
                  : eFerias
                    ? "#7C3AED"
                    : eFeriado
                      ? "#DF2222"
                      : st === "completo"
                        ? "#22C55E"
                        : st === "parcial"
                          ? "#F59E0B"
                          : t.textMuted;

              return (
                <button
                  key={key}
                  onClick={() => setCalDay(sel ? null : key)}
                  style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 8, padding: "6px 2px", cursor: "pointer", fontFamily: "inherit", transition: "all 0.18s" }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, color, textAlign: "center", lineHeight: 1.3 }}>
                    {new Date(key + "T12:00:00").getDate()}
                  </div>
                  <div style={{ fontSize: 9, color: sel ? "rgba(255,255,255,0.7)" : t.textMuted, textAlign: "center" }}>
                    {new Date(key + "T12:00:00").toLocaleDateString("pt-BR", { month: "short" })}
                  </div>
                  <div style={{ textAlign: "center", marginTop: 2, fontSize: 8, fontWeight: "bold", color }}>
                    {eFerias ? "✈️" : eFeriado ? "🎉" : st === "completo" ? "✓" : st === "parcial" ? "~" : "·"}
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
            {[
              ["rgba(34,197,94,0.15)", "rgba(34,197,94,0.4)", "Completo"],
              ["rgba(245,158,11,0.13)", "rgba(245,158,11,0.4)", "Parcial"],
              ["rgba(124,58,237,0.13)", "rgba(124,58,237,0.35)", "Férias"],
              ["rgba(223,34,34,0.11)", "rgba(223,34,34,0.35)", "Feriado"],
              [null, null, "Sem registro"]
            ].map(([bg, brd, label]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: bg || t.surfaceAlt, border: `1.5px solid ${brd || t.border}` }} />
                <span style={{ fontSize: 11, color: t.textMuted }}>{label}</span>
              </div>
            ))}
          </div>

          {/* Selected Day details */}
          {calDay && calBatidas && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>
                    {dayLabel(calDay)}
                    {isToday(calDay) ? " — Hoje" : ""}
                  </div>
                  {dayStatus(calDay) === "ferias" && (
                    <div style={{ color: "#7C3AED", background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.22)", fontSize: 11, padding: "5px 10px", borderRadius: 8, marginTop: 6, fontWeight: 600 }}>
                      ✈️ Férias Programadas. Sem expediente nesta data.
                    </div>
                  )}
                  {dayStatus(calDay) === "feriado" && (
                    <div style={{ color: "#DF2222", background: "rgba(223,34,34,0.06)", border: "1px solid rgba(223,34,34,0.18)", fontSize: 11, padding: "5px 10px", borderRadius: 8, marginTop: 6, fontWeight: 600 }}>
                      🎉 Feriado Corporativo. Abono e folga geral.
                    </div>
                  )}
                  {calBatidas.some(b => b && b.pendenteJustificativa) && (
                    <div style={{ color: "#D97706", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", fontSize: 11.5, padding: "8px 12px", borderRadius: 10, marginTop: 6, fontWeight: 600 }}>
                      ⚠️ <strong>Atenção:</strong> Batida Ímpar (Ponto Órfão) identificada. 
                      O Cérebro de Autocura sinalizou este dia como pendente. Por favor, regularize este dia inserindo a batida faltante e informando a justificativa.
                    </div>
                  )}
                </div>
              </div>
              {steps.map((s, i) => {
                const batida = calBatidas[i];
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${t.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: batida ? s.color : t.surfaceAlt,
                          border: `2px solid ${batida ? s.color : t.border}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0
                        }}
                      >
                        {batida ? <Check size={12} color="#fff" /> : <div style={{ width: 6, height: 6, borderRadius: "50%", background: t.border }} />}
                      </div>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: batida ? 600 : 400, color: batida ? t.text : t.textMuted }}>{s.done}</div>
                        {batida?.tipo === "manual" && (
                          <div style={{ fontSize: 10, color: "#F59E0B", marginTop: 1 }}>
                            MANUAL · reg. {fmtFull(batida.registradoEm)}
                            {batida.obs ? ` · "${batida.obs}"` : ""}
                            {batida.suspeitoHoraModificada && <span style={{ color: t.danger, fontWeight: 700, marginLeft: 6 }}>[⚠️ Suspeito - Hora Modificada]</span>}
                            {batida.gravadoOffline && <span style={{ color: "#D97706", fontWeight: 700, marginLeft: 6 }}>[⚠️ Gravado Offline]</span>}
                          </div>
                        )}
                        {batida?.tipo === "auto" && (
                          <div style={{ fontSize: 10, color: t.textMuted, marginTop: 1 }}>
                            {batida.suspeitoHoraModificada && <span style={{ color: t.danger, fontWeight: 700 }}>[⚠️ Suspeito - Hora Modificada] </span>}
                            {batida.gravadoOffline && <span style={{ color: "#D97706", fontWeight: 700 }}>[⚠️ Gravado Offline (Aguardando Rede)] </span>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace", color: batida ? s.color : t.textMuted }}>{fmt(batida)}</span>
                      {!batida && calDay === todayKey() && (
                        <button
                          onClick={() => abrirManual(i, calDay)}
                          title="Inserir horário"
                          style={{
                            background: t.surfaceAlt,
                            border: `1.5px solid ${t.border}`,
                            borderRadius: 7,
                            padding: "4px 8px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            fontFamily: "inherit",
                            fontSize: 12,
                            color: t.textSub,
                            fontWeight: 600
                          }}
                        >
                          <SquarePen size={12} />
                          Inserir
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {calcHoras(calBatidas) && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
                  <span style={{ fontSize: 13, color: t.textSub }}>Total do dia</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: t.text, fontFamily: "monospace" }}>{calcHoras(calBatidas)}</span>
                </div>
              )}
              {calDay && calBatidas && (() => {
                const [e, sA, rA, s] = calBatidas.map(b => (b && b.hora ? new Date(b.hora) : null));
                if (!e) return null;
                const listOverlaps = [];
                if (sA) {
                  listOverlaps.push(...getOverlapWithNightShift(e, sA));
                  if (rA && s) {
                    listOverlaps.push(...getOverlapWithNightShift(rA, s));
                  }
                } else if (s) {
                  listOverlaps.push(...getOverlapWithNightShift(e, s));
                }
                const h = listOverlaps.reduce((sum, o) => sum + o.horas, 0);
                if (h > 0) {
                  const parts = listOverlaps.map(o => `${o.textoIntervalo}`);
                  return (
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 10, padding: "8px 10px", background: "rgba(245,158,11,0.06)", border: "1.5px dashed rgba(245,158,11,0.3)", borderRadius: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 12.5, color: "#D97706", fontWeight: 700 }}>🌙 Adicional Noturno</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#D97706", fontFamily: "monospace" }}>
                          {h.toFixed(1).replace(".", ",")}h
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: t.textSub, marginTop: 2 }}>
                        Período: {parts.join(", ")}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          )}
        </div>
      )}

      {/* Clock Face with Sync Status */}
      <div style={{ marginBottom: 24, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 54, fontWeight: 700, letterSpacing: "-2px", color: t.text, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
          {timeStr}
        </div>
        
        <div 
          onClick={() => setTriggerSync(prev => prev + 1)}
          title="Clique para sincronizar o horário novamente"
          style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: 6, 
            padding: "5px 12px", 
            borderRadius: 20, 
            background: clockStatus === "synced" ? "rgba(34,197,94,0.08)" : clockStatus === "syncing" ? "rgba(59,130,246,0.08)" : "rgba(245,158,11,0.08)",
            border: `1px solid ${clockStatus === "synced" ? "rgba(34,197,94,0.25)" : clockStatus === "syncing" ? "rgba(59,130,246,0.25)" : "rgba(245,158,11,0.25)"}`,
            fontSize: 11,
            color: clockStatus === "synced" ? "#16a34a" : clockStatus === "syncing" ? "#2563eb" : "#d97706",
            fontWeight: 600,
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
            cursor: "pointer",
            transition: "all 0.2s ease-in-out",
            userSelect: "none"
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.03)";
            e.currentTarget.style.opacity = "0.9";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.opacity = "1";
          }}
        >
          {clockStatus === "synced" ? (
            <>
              <span style={{ position: "relative", display: "flex", height: 8, width: 8 }}>
                <span className="animate-ping" style={{ position: "absolute", inlineSize: "100%", blockSize: "100%", borderRadius: "50%", background: "#4ade80", opacity: 0.75 }}></span>
                <span style={{ position: "relative", inlineSize: 8, blockSize: 8, borderRadius: "50%", background: "#22c55e" }}></span>
              </span>
              🛰️ Horário Seguro de Brasília (Sincronizado)
            </>
          ) : clockStatus === "syncing" ? (
            <>
              <div className="animate-spin" style={{ width: 10, height: 10, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%" }} />
              Sincronizando com relógio atômico...
            </>
          ) : (
            <>
              <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#d97706" }} />
              ⚠️ Gravado Offline (Aguardando Rede)
            </>
          )}
        </div>

        {/* Persistent Modo Leve / Economia de Dados Toggle */}
        <div 
          onClick={toggleModoLeve}
          title={modoLeve ? "Clique para desativar o modo leve e usar qualidade padrão" : "Clique para ativar a compressão inteligente de fotos e otimização de banda"}
          style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: 6, 
            padding: "5px 12px", 
            borderRadius: 20, 
            background: modoLeve ? "rgba(34,197,94,0.11)" : t.surfaceAlt,
            border: `1px solid ${modoLeve ? "rgba(34,197,94,0.3)" : t.border}`,
            fontSize: 10.5,
            color: modoLeve ? "#16a34a" : t.textSub,
            fontWeight: 700,
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
            cursor: "pointer",
            transition: "all 0.2s ease-in-out",
            userSelect: "none",
            marginTop: 4
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.03)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: modoLeve ? "#22c55e" : "#64748b" }} />
          <span>⚡ Modo Economia: {modoLeve ? "ATIVADO" : "DESATIVADO"}</span>
        </div>

        {countPendingSync() > 0 && (
          <div
            onClick={syncNow}
            title="Clique para sincronizar suas batidas com o servidor"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              borderRadius: 20,
              background: "rgba(59, 130, 246, 0.1)",
              border: "1px solid rgba(59, 130, 246, 0.3)",
              fontSize: 11.5,
              color: "#3b82f6",
              fontWeight: 700,
              cursor: isSyncing ? "not-allowed" : "pointer",
              transition: "all 0.2s ease",
              marginTop: 4,
              boxShadow: "0 2px 10px rgba(59,130,246,0.1)",
              userSelect: "none"
            }}
            onMouseEnter={(e) => {
              if (!isSyncing) e.currentTarget.style.transform = "scale(1.04)";
            }}
            onMouseLeave={(e) => {
              if (!isSyncing) e.currentTarget.style.transform = "scale(1)";
            }}
          >
            {isSyncing ? (
              <>
                <RefreshCw className="animate-spin" size={12} />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw size={12} />
                {countPendingSync()} batida(s) offline. Sincronizar agora
              </>
            )}
          </div>
        )}
      </div>

      {/* Gauge and Button Trigger */}
      {!calOpen && (
        currentUser.bloqueadoAceite ? (
          <div style={{
            width: "100%",
            maxWidth: 380,
            background: "rgba(239, 68, 68, 0.08)",
            border: "2.5px solid #ef4444",
            borderRadius: 20,
            padding: "28px 24px",
            textAlign: "center",
            marginBottom: 24,
            boxShadow: "0 8px 32px rgba(239, 68, 68, 0.15)",
          }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)" }}>
              <AlertTriangle size={24} color="white" />
            </div>
            <h2 style={{ fontSize: "14px", fontWeight: 800, color: "#ef4444", marginBottom: 12, letterSpacing: "0.2px", lineHeight: "1.4" }}>
              SE A SUA FOLHA DE PONTO ESTÁ INCORRETA POR FAVOR PROCURE A ADMINISTRAÇÃO IMEDIATAMENTE, VOCÊ NÃO PODE MARCAR MAIS PONTOS ATÉ O ADMINISTRADOR DESBLOQUEAR
            </h2>
            <p style={{ fontSize: "12px", color: t.textSub, lineHeight: "1.5", margin: 0 }}>
              Seu registro de batidas de ponto está temporariamente suspenso devido à contestação da folha de ponto mensal.
            </p>
          </div>
        ) : (
          <div style={{ marginBottom: 24, width: "100%", maxWidth: 380, textAlign: "center" }}>
            {allDone ? (
              <div style={{ background: btnLight, border: `2.5px solid ${btnBorder}`, borderRadius: 20, padding: "28px 24px" }}>
                <div style={{ fontSize: 40, marginBottom: 6 }}>🎉</div>
                <div style={{ fontSize: 21, fontWeight: 700, color: btnColor }}>Expediente encerrado!</div>
                <div style={{ fontSize: 13, color: t.textSub, marginTop: 5 }}>Bom descanso, {firstName}!</div>
                <div style={{ fontSize: 13, color: t.textMuted, marginTop: 3 }}>
                  Seu total de hoje: <strong style={{ color: t.text }}>{calcHoras(todayBatidas)}</strong>
                </div>
              </div>
            ) : todayBatidas[0] !== null && todayBatidas[1] === null ? (
              /* Special state: Antes do almoço. Show both option buttons stacked! */
              <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
                <button
                  onClick={() => abrirConfirm(1, tk)}
                  style={{
                    width: "100%",
                    border: `2px solid ${steps[1].border}`,
                    borderRadius: 16,
                    padding: "16px 20px",
                    background: `linear-gradient(160deg, ${steps[1].light}, ${steps[1].color}12)`,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    fontFamily: "inherit",
                    boxShadow: `0 4px 12px ${steps[1].color}15`,
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: steps[1].color, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 2px 8px ${steps[1].color}44` }}>
                      <Clock size={18} color="white" />
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: steps[1].color }}>
                        {steps[1].label}
                      </div>
                      <div style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>Seguir com o fluxo normal de almoço</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 18, color: steps[1].color }}>➔</span>
                </button>

                <button
                  onClick={() => abrirConfirm(3, tk)}
                  style={{
                    width: "100%",
                    border: `2px solid ${steps[3].border}`,
                    borderRadius: 16,
                    padding: "16px 20px",
                    background: `linear-gradient(160deg, ${steps[3].light}, ${steps[3].color}12)`,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    fontFamily: "inherit",
                    boxShadow: `0 4px 12px ${steps[3].color}15`,
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: steps[3].color, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 2px 8px ${steps[3].color}44` }}>
                      <Clock size={18} color="white" />
                    </div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: steps[3].color }}>
                        {steps[3].label}
                      </div>
                      <div style={{ fontSize: 12, color: t.textSub, marginTop: 2 }}>Encerrar hoje direto sem almoço</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 18, color: steps[3].color }}>➔</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => abrirConfirm(nextIdx, tk)}
                style={{
                  width: "100%",
                  border: `2.5px solid ${btnBorder}`,
                  borderRadius: 20,
                  padding: "28px 24px",
                  background: `linear-gradient(160deg, ${btnLight}, ${btnColor}18)`,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  fontFamily: "inherit",
                  boxShadow: `0 8px 32px ${btnColor}30`
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: "50%",
                      background: btnColor,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto",
                      boxShadow: `0 4px 16px ${btnColor}55`
                    }}
                  >
                    <Clock size={26} color="white" />
                  </div>
                  <div style={{ fontSize: 21, fontWeight: 800, color: btnColor, letterSpacing: "-0.3px" }}>
                    {current?.label}
                  </div>
                  <div style={{ fontSize: 13, color: t.textSub }}>Toque aqui para registrar</div>
                </div>
              </button>
            )}
            
            {countPendingSync() > 0 && (
              <div style={{
                background: "rgba(245,158,11,0.06)",
                border: "1.5px dashed rgba(245,158,11,0.3)",
                borderRadius: 16,
                padding: "16px",
                width: "100%",
                maxWidth: 380,
                marginBottom: 20,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                textAlign: "left",
                boxShadow: "0 4px 14px rgba(245,158,11,0.08)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: "#d97706" }}>
                  <AlertTriangle size={16} />
                  <span>Marcações Pendentes de Sincronização</span>
                </div>
                <p style={{ fontSize: 12, color: t.textSub, margin: 0, lineHeight: 1.45 }}>
                  Você tem <strong>{countPendingSync()} marcação(ões)</strong> salvas localmente neste aparelho que ainda não subiram para o servidor devido à instabilidade de rede ou limite de cota.
                </p>
                {syncError && (
                  <div style={{
                    background: "rgba(239,68,68,0.06)",
                    border: "1.5px solid rgba(239,68,68,0.2)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    fontSize: 12,
                    color: t.danger,
                    marginTop: 4,
                    lineHeight: 1.45
                  }}>
                    <strong>Status:</strong> {syncError}
                  </div>
                )}
                <div style={{ fontSize: 11, color: t.textMuted, fontStyle: "italic", marginTop: -2 }}>
                  Seus registros estão 100% seguros localmente no aparelho. O sistema tentará sincronizar em segundo plano.
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <button
                    onClick={syncNow}
                    disabled={isSyncing}
                    style={{
                      flex: 1,
                      background: "#d97706",
                      border: "none",
                      borderRadius: 10,
                      padding: "10px 14px",
                      color: "#fff",
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: isSyncing ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      boxShadow: "0 2px 8px rgba(217,119,6,0.25)",
                      transition: "all 0.18s"
                    }}
                  >
                    <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
                    {isSyncing ? "Sincronizando..." : "Tentar Novamente"}
                  </button>
                  {syncError && (
                    <button
                      onClick={() => {
                        if (setSyncError) setSyncError(null);
                      }}
                      style={{
                        background: t.surfaceAlt,
                        border: `1.5px solid ${t.border}`,
                        borderRadius: 10,
                        padding: "10px 14px",
                        color: t.textSub,
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.18s"
                      }}
                    >
                      Sincronizar Depois
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      )}

      {/* Today's Registrations log */}
      {!calOpen && (
        <div style={{ width: "100%", maxWidth: 380, background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 16, padding: "6px 8px", marginBottom: 14 }}>
          {steps.map((s, i) => {
            const batida = todayBatidas[i];
            const isNext = !allDone && nextIdx === i;
            const clickable = !currentUser.bloqueadoAceite && isStepClickable(i);
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: clickable ? `${s.color}0D` : isNext ? `${s.color}08` : "transparent",
                  border: clickable ? `1px dashed ${s.color}60` : "1px solid transparent",
                  cursor: clickable ? "pointer" : "default",
                  transition: "all 0.15s ease",
                  marginBottom: 4
                }}
                onClick={clickable ? () => abrirConfirm(i, tk) : undefined}
                title={clickable ? `Clique para registrar: ${s.label}` : undefined}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: batida ? s.color : clickable ? `${s.color}1c` : isNext ? `${s.color}22` : t.surfaceAlt,
                      border: `2px solid ${batida ? s.color : clickable ? s.color : isNext ? s.color : t.border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: clickable ? `0 0 8px ${s.color}33` : "none"
                    }}
                  >
                    {batida ? (
                      <Check size={13} color="#fff" />
                    ) : clickable ? (
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.color }} className="animate-pulse" />
                    ) : isNext ? (
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: s.color }} />
                    ) : (
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: t.border }} />
                    )}
                  </div>
                  <div>
                    <div style={{ 
                      fontSize: 14, 
                      fontWeight: batida || isNext || clickable ? 600 : 400, 
                      color: batida || isNext || clickable ? t.text : t.textMuted,
                      display: "flex",
                      alignItems: "center",
                      gap: 6
                    }}>
                      {s.done}
                      {clickable && (
                        <span style={{ fontSize: 9, color: s.color, background: `${s.color}15`, padding: "1px 5px", borderRadius: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3px" }}>
                          Clicável
                        </span>
                      )}
                    </div>
                    {batida?.tipo === "manual" && <div style={{ fontSize: 10, color: "#F59E0B" }}>MANUAL · reg. {fmtFull(batida.registradoEm)}</div>}
                  </div>
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace", color: batida ? s.color : clickable ? s.color : t.textMuted }}>
                  {batida ? fmt(batida) : clickable ? "➔" : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!calOpen && calcHoras(todayBatidas) && (
        <div style={{ width: "100%", maxWidth: 380, background: t.surface, border: `1.5px solid ${t.border}`, borderRadius: 12, padding: "11px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "13.5px", color: t.textSub }}>Horas trabalhadas hoje</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: "monospace" }}>{calcHoras(todayBatidas)}</span>
        </div>
      )}

      {/* LGPD footnote */}
      <div 
        onClick={() => setIsLgpdOpen(true)}
        title="Clique para ver a conformidade com a LGPD"
        style={{ 
          marginTop: 22, 
          display: "flex", 
          alignItems: "center", 
          gap: 6,
          cursor: "pointer",
          opacity: 0.85,
          transition: "opacity 0.2s"
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.85"; }}
      >
        <Shield size={11} color="#22c55e" />
        <span style={{ fontSize: 11, color: t.textSub, textDecoration: "underline", textDecorationStyle: "dotted" }}>
          Dados protegidos conforme LGPD
        </span>
      </div>

      <LgpdModal isOpen={isLgpdOpen} onClose={() => setIsLgpdOpen(false)} t={t} />

      {/* Lançar Atestado Médico Modal */}
      {atestadoModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(5px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16
          }}
        >
          <div
            style={{
              background: t.surface,
              border: `1.5px solid ${t.border}`,
              borderRadius: 18,
              width: "100%",
              maxWidth: 440,
              padding: 24,
              boxShadow: `0 10px 30px rgba(0,0,0,0.3)`,
              maxHeight: "90vh",
              overflowY: "auto",
              position: "relative"
            }}
          >
            <button
              onClick={() => {
                setAtestadoModalOpen(false);
                setCameraAtiva(false);
                setAtestadoError("");
              }}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: t.textSub
              }}
            >
              <X size={20} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ background: t.accentGlow, padding: 8, borderRadius: 10, display: "flex" }}>
                <Stethoscope size={24} color={t.accent} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: t.text }}>
                  Lançar Atestado Médico
                </h3>
                <span style={{ fontSize: 12, color: t.textSub }}>Preenchimento obrigatório de CID e foto</span>
              </div>
            </div>

            {atestadoSucesso ? (
              <div style={{ textAlign: "center", padding: "30px 10px" }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(34,197,94,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Check size={28} color="#16a34a" />
                </div>
                <h4 style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 6 }}>Lançado com sucesso!</h4>
                <p style={{ fontSize: 13, color: t.textSub, margin: 0 }}>O atestado foi registrado no sistema e aguarda homologação.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                
                {atestadoError && (
                  <div style={{ background: t.dangerBg, border: `1px solid ${t.dangerBorder}`, padding: "10px 12px", borderRadius: 10, color: t.danger, fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}>
                    <AlertTriangle size={16} />
                    <span>{atestadoError}</span>
                  </div>
                )}

                {/* Datas: Início e Fim/Retorno */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: t.textSub, marginBottom: 6, textTransform: "uppercase" }}>
                      Data de Início
                    </label>
                    <input
                      type="date"
                      value={atestadoDataInicio}
                      onChange={(e) => setAtestadoDataInicio(e.target.value)}
                      style={{
                        width: "100%",
                        background: t.surfaceAlt,
                        border: `1.5px solid ${t.border}`,
                        borderRadius: 10,
                        padding: "10px 12px",
                        color: t.text,
                        fontSize: 14,
                        outline: "none"
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: t.textSub, marginBottom: 6, textTransform: "uppercase" }}>
                      Data de Retorno
                    </label>
                    <input
                      type="date"
                      value={atestadoDataFim}
                      onChange={(e) => setAtestadoDataFim(e.target.value)}
                      style={{
                        width: "100%",
                        background: t.surfaceAlt,
                        border: `1.5px solid ${t.border}`,
                        borderRadius: 10,
                        padding: "10px 12px",
                        color: t.text,
                        fontSize: 14,
                        outline: "none"
                      }}
                    />
                  </div>
                </div>

                {(() => {
                  const start = new Date(atestadoDataInicio + "T12:00:00");
                  const end = new Date(atestadoDataFim + "T12:00:00");
                  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
                    return null;
                  }
                  const diffTime = Math.abs(end.getTime() - start.getTime());
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                  return (
                    <div style={{ fontSize: 12, color: t.accent, fontWeight: 600, background: `${t.accentGlow}`, padding: "6px 12px", borderRadius: 8, display: "inline-block", alignSelf: "flex-start" }}>
                      📅 Período selecionado: <strong>{diffDays} {diffDays === 1 ? "dia" : "dias"}</strong> de afastamento
                    </div>
                  );
                })()}

                {/* CID - Mandatory */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 6, textTransform: "uppercase" }}>
                    Código CID-10 <span style={{ color: t.danger }}>* Obrigatório</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: M54.5 (Dor Lombar Baixa)"
                    value={atestadoCid}
                    onChange={(e) => {
                      setAtestadoCid(e.target.value);
                      setAtestadoError("");
                    }}
                    style={{
                      width: "100%",
                      background: t.surfaceAlt,
                      border: `1.5px solid ${t.border}`,
                      borderRadius: 10,
                      padding: "10px 12px",
                      color: t.text,
                      fontSize: 14,
                      outline: "none"
                    }}
                  />
                </div>

                {/* Parcial toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: t.surfaceAlt, padding: "10px 12px", borderRadius: 10, border: `1px solid ${t.border}` }}>
                  <input
                    type="checkbox"
                    id="atestadoParcialCheck"
                    checked={atestadoIsParcial}
                    onChange={(e) => setAtestadoIsParcial(e.target.checked)}
                    style={{ cursor: "pointer", width: 16, height: 16 }}
                  />
                  <label htmlFor="atestadoParcialCheck" style={{ fontSize: 13, fontWeight: 600, color: t.text, cursor: "pointer", userSelect: "none" }}>
                    Atestado de Horas (Parcial)
                  </label>
                </div>

                {atestadoIsParcial && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "4px 8px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 4 }}>Início da Ausência</label>
                      <input
                        type="time"
                        value={atestadoParcialInicio}
                        onChange={(e) => setAtestadoParcialInicio(e.target.value)}
                        style={{
                          width: "100%",
                          background: t.surface,
                          border: `1px solid ${t.border}`,
                          borderRadius: 8,
                          padding: "6px 8px",
                          color: t.text,
                          fontSize: 13
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: t.textMuted, marginBottom: 4 }}>Fim da Ausência</label>
                      <input
                        type="time"
                        value={atestadoParcialFim}
                        onChange={(e) => setAtestadoParcialFim(e.target.value)}
                        style={{
                          width: "100%",
                          background: t.surface,
                          border: `1px solid ${t.border}`,
                          borderRadius: 8,
                          padding: "6px 8px",
                          color: t.text,
                          fontSize: 13
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Photo Upload & Camera - Mandatory */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 6, textTransform: "uppercase" }}>
                    Foto do Documento <span style={{ color: t.danger }}>* Obrigatório</span>
                  </label>

                  {atestadoFoto ? (
                    <div style={{ position: "relative", borderRadius: 12, border: `1.5px solid ${t.border}`, overflow: "hidden", background: t.surfaceAlt }}>
                      <img src={atestadoFoto} alt="Preview Atestado" style={{ width: "100%", height: 160, objectFit: "contain", background: "#000" }} />
                      <div style={{ padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", background: t.surface }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "75%" }}>
                          {atestadoFotoNome || "atestado.jpg"}
                        </span>
                        <button
                          onClick={() => {
                            setAtestadoFoto(null);
                            setAtestadoFotoNome("");
                          }}
                          style={{ background: "none", border: "none", color: t.danger, cursor: "pointer", fontSize: 12, fontWeight: 700 }}
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      
                      {cameraAtiva ? (
                        <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: `2px solid ${t.accent}`, background: "#000", display: "flex", flexDirection: "column" }}>
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            style={{ width: "100%", height: 220, objectFit: "cover" }}
                          />
                          <div style={{ display: "flex", gap: 10, padding: 10, background: "rgba(0,0,0,0.85)" }}>
                            <button
                              onClick={capturarFoto}
                              type="button"
                              style={{ flex: 1, background: t.accent, border: "none", borderRadius: 8, padding: "8px", color: "#fff", fontWeight: 700, cursor: "pointer" }}
                            >
                              📸 Capturar Foto
                            </button>
                            <button
                              onClick={() => setCameraAtiva(false)}
                              type="button"
                              style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "8px 12px", color: "#fff", fontWeight: 600, cursor: "pointer" }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 8 }}>
                          {/* File input disguised as drag and drop */}
                          <label
                            style={{
                              flex: 1,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              border: `2px dashed ${t.border}`,
                              borderRadius: 12,
                              padding: "16px",
                              cursor: "pointer",
                              background: t.surfaceAlt,
                              transition: "all 0.2s"
                            }}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              e.preventDefault();
                              const file = e.dataTransfer.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  const rawBase64 = reader.result as string;
                                  const maxDim = modoLeve ? 320 : 480;
                                  const compQuality = modoLeve ? 0.3 : 0.42;
                                  resizeAndCompressImage(rawBase64, maxDim, maxDim, compQuality).then(compressed => {
                                    setAtestadoFoto(compressed);
                                    setAtestadoFotoNome(file.name);
                                  }).catch((err) => {
                                    console.error("Image compression failed:", err);
                                    setAtestadoFoto(rawBase64);
                                    setAtestadoFotoNome(file.name);
                                  });
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          >
                            <Upload size={20} color={t.textSub} style={{ marginBottom: 4 }} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>Enviar Arquivo</span>
                            <span style={{ fontSize: 10, color: t.textMuted }}>Até 5MB</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleFileUpload}
                              style={{ display: "none" }}
                            />
                          </label>

                          {/* Use Camera */}
                          <button
                            type="button"
                            onClick={() => setCameraAtiva(true)}
                            style={{
                              flex: 1,
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              border: `1.5px solid ${t.border}`,
                              borderRadius: 12,
                              padding: "16px",
                              cursor: "pointer",
                              background: t.surfaceAlt,
                              color: t.text,
                              fontFamily: "inherit",
                              transition: "all 0.2s"
                            }}
                          >
                            <Camera size={20} color={t.accent} style={{ marginBottom: 4 }} />
                            <span style={{ fontSize: 12, fontWeight: 600 }}>Tirar Foto Agora</span>
                            <span style={{ fontSize: 10, color: t.textMuted }}>Usar webcam/câmera</span>
                          </button>
                        </div>
                      )}

                      {/* Mock Capture simulator button to ensure seamless desktop testing! */}
                      {!cameraAtiva && (
                        <button
                          type="button"
                          onClick={() => {
                            const mockCanvas = document.createElement("canvas");
                            mockCanvas.width = 400;
                            mockCanvas.height = 300;
                            const ctx = mockCanvas.getContext("2d");
                            if (ctx) {
                              ctx.fillStyle = "#ffffff";
                              ctx.fillRect(0, 0, 400, 300);
                              ctx.fillStyle = "#1e40af";
                              ctx.font = "bold 16px sans-serif";
                              ctx.fillText("ATESTADO MÉDICO SIMULADO", 20, 40);
                              ctx.fillStyle = "#333333";
                              ctx.font = "12px sans-serif";
                              ctx.fillText(`Colaborador: ${currentUser.nome}`, 20, 80);
                              ctx.fillText(`Período: ${atestadoDataInicio} a ${atestadoDataFim}`, 20, 110);
                              ctx.fillText(`Código CID-10: ${atestadoCid || "M54.5"}`, 20, 140);
                              ctx.fillText("Assinatura do Médico Dr. Silva CRM 123456", 20, 200);
                              
                              ctx.strokeStyle = "rgba(220,38,38,0.15)";
                              ctx.lineWidth = 10;
                              ctx.beginPath();
                              ctx.moveTo(200, 100);
                              ctx.lineTo(200, 200);
                              ctx.moveTo(150, 150);
                              ctx.lineTo(250, 150);
                              ctx.stroke();

                              setAtestadoFoto(mockCanvas.toDataURL("image/jpeg"));
                              setAtestadoFotoNome("atestado_medico_simulado.jpg");
                              setAtestadoError("");
                            }
                          }}
                          style={{
                            background: "rgba(59,130,246,0.06)",
                            border: `1px dashed rgba(59,130,246,0.3)`,
                            borderRadius: 8,
                            padding: "6px 12px",
                            fontSize: 11,
                            color: t.accent,
                            fontWeight: 600,
                            cursor: "pointer",
                            width: "100%",
                            transition: "all 0.15s"
                          }}
                        >
                          🧪 Simular Captura Digital de Atestado (Ambiente de Testes)
                        </button>
                      )}

                    </div>
                  )}

                </div>

                {/* Observations */}
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 6, textTransform: "uppercase" }}>
                    Observações / Justificativa
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Alguma observação complementar (opcional)..."
                    value={atestadoObs}
                    onChange={(e) => setAtestadoObs(e.target.value)}
                    style={{
                      width: "100%",
                      background: t.surfaceAlt,
                      border: `1.5px solid ${t.border}`,
                      borderRadius: 10,
                      padding: "10px 12px",
                      color: t.text,
                      fontSize: 13,
                      outline: "none",
                      resize: "none",
                      fontFamily: "inherit"
                    }}
                  />
                </div>

                {/* Action Buttons */}
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button
                    onClick={() => {
                      setAtestadoModalOpen(false);
                      setCameraAtiva(false);
                      setAtestadoError("");
                    }}
                    type="button"
                    style={{
                      flex: 1,
                      background: t.surfaceAlt,
                      border: `1px solid ${t.border}`,
                      borderRadius: 12,
                      padding: "12px",
                      color: t.textSub,
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer"
                    }}
                  >
                    Fechar
                  </button>
                  <button
                    onClick={enviarAtestado}
                    disabled={atestadoSubmitting}
                    type="button"
                    style={{
                      flex: 1,
                      background: t.accent,
                      border: "none",
                      borderRadius: 12,
                      padding: "12px",
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: "pointer",
                      opacity: atestadoSubmitting ? 0.6 : 1,
                      boxShadow: `0 4px 12px ${t.accentGlow}`
                    }}
                  >
                    {atestadoSubmitting ? "Enviando..." : "Lançar Atestado"}
                  </button>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {/* Pastinha / PDF Selector Modal */}
      {pdfModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(5px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16
          }}
        >
          <div
            style={{
              background: t.surface,
              border: `1.5px solid ${t.border}`,
              borderRadius: 18,
              width: "100%",
              maxWidth: 480,
              padding: 24,
              boxShadow: `0 10px 30px rgba(0,0,0,0.3)`,
              maxHeight: "90vh",
              overflowY: "auto",
              position: "relative"
            }}
          >
            <button
              onClick={() => setPdfModalOpen(false)}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: t.textSub
              }}
            >
              <X size={20} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ background: t.accentGlow, padding: 8, borderRadius: 10, display: "flex" }}>
                <Folder size={24} color={t.accent} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: t.text }}>
                  Espelho de Ponto Mensal
                </h3>
                <span style={{ fontSize: 12, color: t.textSub }}>Selecione o mês para visualizar ou gerar o relatório</span>
              </div>
            </div>

            {/* Selectors */}
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12, marginBottom: 18 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: t.textSub, marginBottom: 4, textTransform: "uppercase" }}>Mês</label>
                <select
                  value={pdfMes}
                  onChange={(e) => setPdfMes(Number(e.target.value))}
                  style={{
                    width: "100%",
                    background: t.surfaceAlt,
                    border: `1.5px solid ${t.border}`,
                    borderRadius: 10,
                    padding: "10px",
                    color: t.text,
                    fontSize: 14,
                    outline: "none"
                  }}
                >
                  {["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"].map((m, idx) => (
                    <option key={idx} value={idx}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: t.textSub, marginBottom: 4, textTransform: "uppercase" }}>Ano</label>
                <select
                  value={pdfAno}
                  onChange={(e) => setPdfAno(Number(e.target.value))}
                  style={{
                    width: "100%",
                    background: t.surfaceAlt,
                    border: `1.5px solid ${t.border}`,
                    borderRadius: 10,
                    padding: "10px",
                    color: t.text,
                    fontSize: 14,
                    outline: "none"
                  }}
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Read-Only Points Preview Section */}
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <FileText size={14} color={t.accent} />
                <span>Marcações Registradas:</span>
              </h4>

              <div
                style={{
                  maxHeight: 220,
                  overflowY: "auto",
                  border: `1.5px solid ${t.border}`,
                  borderRadius: 12,
                  background: t.surfaceAlt,
                  padding: 8
                }}
              >
                {(() => {
                  const daysInMonth = new Date(pdfAno, pdfMes + 1, 0).getDate();
                  const rowElements = [];
                  for (let d = 1; d <= daysInMonth; d++) {
                    const date = new Date(pdfAno, pdfMes, d);
                    const dayKey = date.toISOString().slice(0, 10);
                    const batidas = pontosGlobal[currentUser.id]?.[dayKey] || [null, null, null, null];
                    
                    const calc = calcularDia(currentUser.id, dayKey, [currentUser], pontosGlobal, feriados);
                    const weekday = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][date.getDay()];

                    const pointsStr = batidas
                      .map((b: any) => {
                        if (!b) return null;
                        if (b.ocorrencia === "atestado") return b.parcial ? "Atestado H." : "Atestado";
                        return new Date(b.hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                      })
                      .filter(Boolean)
                      .join(" | ");

                    const corStatus: Record<string, string> = { completo: "#16a34a", parcial: "#d97706", falta: "#dc2626", atestado: "#2563eb", afastamento: "#7c3aed", folga: "#9ca3af", futuro: "#9ca3af", ferias: "#7c3aed", feriado: "#df2222" };
                    const statusText: Record<string, string> = { completo: "C", parcial: "P", falta: "F", atestado: "AT", afastamento: "AF", folga: "F", futuro: "-", ferias: "FE", feriado: "FR" };

                    rowElements.push(
                      <div
                        key={d}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 10px",
                          borderBottom: d === daysInMonth ? "none" : `1px solid ${t.border}`,
                          fontSize: 12.5,
                          color: t.text
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 11.5, color: t.textSub, width: 30, textTransform: "capitalize" }}>
                            {weekday}
                          </span>
                          <strong style={{ fontSize: 13, color: t.text }}>
                            {String(d).padStart(2, "0")}
                          </strong>
                        </div>
                        <div style={{ flex: 1, paddingLeft: 12, fontSize: 12, color: pointsStr ? t.text : t.textMuted, fontStyle: pointsStr ? "normal" : "italic" }}>
                          {pointsStr || "Nenhum registro"}
                        </div>
                        {calc?.status && calc.status !== "completo" && calc.status !== "futuro" && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              background: `${corStatus[calc.status]}15`,
                              color: corStatus[calc.status],
                              border: `1px solid ${corStatus[calc.status]}30`,
                              padding: "1px 6px",
                              borderRadius: 4
                            }}
                          >
                            {statusText[calc.status] || calc.status}
                          </span>
                        )}
                      </div>
                    );
                  }
                  return rowElements;
                })()}
              </div>
            </div>

            {/* Print/Generate Action Button */}
            <button
              onClick={() => gerarEspelhoHTMLForEmployee(pdfAno, pdfMes)}
              style={{
                width: "100%",
                background: t.accent,
                border: "none",
                borderRadius: 12,
                padding: "14px",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 800,
                color: "#fff",
                fontFamily: "inherit",
                boxShadow: `0 4px 14px ${t.accentGlow}`,
                transition: "all 0.15s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginBottom: 10
              }}
            >
              <File size={16} />
              <span>Gerar & Imprimir Espelho PDF</span>
            </button>

            <button
              onClick={() => setPdfModalOpen(false)}
              style={{
                width: "100%",
                background: t.surfaceAlt,
                border: `1px solid ${t.border}`,
                borderRadius: 12,
                padding: "12px",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                color: t.textSub,
                fontFamily: "inherit"
              }}
            >
              Fechar
            </button>

          </div>
        </div>
      )}

      {/* Confirmation modal */}
      {confirmModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(5px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 500,
            padding: 20
          }}
          onClick={() => setConfirmModal(null)}
        >
          <div
            style={{
              background: t.surface,
              border: `1px solid ${t.border}`,
              borderRadius: 20,
              padding: "32px 28px",
              width: "100%",
              maxWidth: 360,
              boxShadow: t.shadow
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: "50%",
                  background: steps[confirmModal.idx].light,
                  border: `2px solid ${steps[confirmModal.idx].border}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 14px"
                }}
              >
                <Clock size={24} color={steps[confirmModal.idx].color} />
              </div>
              <h3 style={{ margin: "0 0 6px", color: t.text, fontSize: 18, fontWeight: 700 }}>
                {steps[confirmModal.idx].label}
              </h3>
              <p style={{ margin: 0, color: t.textSub, fontSize: 13 }}>Como deseja registrar?</p>
            </div>

            {/* Now option */}
            <button
              onClick={() => registrarAgora(confirmModal.idx, confirmModal.dayKey)}
              style={{
                width: "100%",
                background: `linear-gradient(135deg, ${steps[confirmModal.idx].light}, ${steps[confirmModal.idx].color}22)`,
                border: `2px solid ${steps[confirmModal.idx].border}`,
                borderRadius: 14,
                padding: "18px 16px",
                cursor: "pointer",
                marginBottom: 12,
                fontFamily: "inherit",
                transition: "all 0.18s",
                boxShadow: `0 4px 18px ${steps[confirmModal.idx].color}22`
              }}
            >
              <div style={{ fontSize: 17, fontWeight: 800, color: steps[confirmModal.idx].color }}>✓ Registrar agora</div>
              <div style={{ fontSize: 13, color: t.textSub, marginTop: 4, fontFamily: "monospace", fontWeight: 600 }}>
                {now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
              </div>
            </button>

            {/* Manual missed-punches options */}
            <button
              onClick={() => abrirManual(confirmModal.idx, confirmModal.dayKey)}
              style={{
                width: "100%",
                background: t.surfaceAlt,
                border: `1.5px solid ${t.border}`,
                borderRadius: 14,
                padding: "16px 16px",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.18s"
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Incorp. manual de ponto</div>
              <div style={{ fontSize: "12.5px", color: t.textSub, marginTop: 4 }}>
                Insira o horário em que realmente cumpriu a batida.
              </div>
            </button>

            <button
              onClick={() => setConfirmModal(null)}
              style={{
                width: "100%",
                marginTop: 10,
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
                color: t.textMuted,
                padding: "6px"
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Manual Input modal */}
      {manualModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(5px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 600,
            padding: 20
          }}
          onClick={() => setManualModal(null)}
        >
          <div
            style={{
              background: t.surface,
              border: `1.5px solid ${t.border}`,
              borderRadius: 20,
              padding: "32px 28px",
              width: "100%",
              maxWidth: 340,
              boxShadow: t.shadow
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "rgba(245,158,11,0.12)",
                  border: "2.5px solid rgba(245,158,11,0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px"
                }}
              >
                <SquarePen size={20} color="#F59E0B" />
              </div>
              <h3 style={{ margin: "0 0 4px", color: t.text, fontSize: 17, fontWeight: 700 }}>Horário manual</h3>
              <p style={{ margin: 0, color: t.textSub, fontSize: 13 }}>
                {steps[manualModal.idx].done}
                {manualModal.dayKey !== todayKey() ? ` · ${dayLabel(manualModal.dayKey)}` : ""}
              </p>
            </div>

            <div style={{ background: "rgba(245,158,11,0.09)", border: "1.5px solid rgba(245,158,11,0.28)", borderRadius: 8, padding: "9px 12px", marginBottom: 16, fontSize: 12, color: "#F59E0B", lineHeight: 1.5 }}>
              ⚠️ Este registro ficará salvo com o carimbo do horário real da inserção por auditoria.
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, color: t.textSub, marginBottom: 7, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Horário realizado
              </label>
              <input
                type="time"
                value={manualHora}
                onChange={e => {
                  setManualHora(e.target.value);
                  setManualError("");
                }}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: t.inputBg,
                  border: `1.5px solid ${manualError ? "#F59E0B" : t.border}`,
                  borderRadius: 9,
                  color: t.text,
                  fontSize: 28,
                  fontWeight: 700,
                  padding: "12px",
                  outline: "none",
                  fontFamily: "monospace",
                  textAlign: "center",
                  letterSpacing: "3px"
                }}
              />
              {manualError && (
                <span style={{ fontSize: 12, color: "#F59E0B", marginTop: 4, display: "block" }}>
                  {manualError}
                </span>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: "block", fontSize: "11.5px", fontWeight: 700, color: t.textSub, marginBottom: 7, letterSpacing: "0.5px", textTransform: "uppercase" }}>
                Justificativa <span style={{ fontWeight: 400, color: t.textMuted }}>(opcional)</span>
              </label>
              <textarea
                value={manualJust}
                onChange={e => setManualJust(e.target.value)}
                placeholder="Ex: Esqueci de registrar na entrada..."
                rows={2}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: t.inputBg,
                  border: `1.5px solid ${t.border}`,
                  borderRadius: 9,
                  color: t.text,
                  fontSize: "13.5px",
                  padding: "10px 13px",
                  outline: "none",
                  fontFamily: "inherit",
                  resize: "none"
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setManualModal(null)}
                style={{
                  flex: 1,
                  background: t.surfaceAlt,
                  border: `1px solid ${t.border}`,
                  borderRadius: 10,
                  padding: "11px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 600,
                  fontSize: 14,
                  color: t.textSub
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmarManual}
                style={{
                  flex: 2,
                  background: "linear-gradient(135deg, #F59E0B, #D97706)",
                  border: "none",
                  borderRadius: 10,
                  padding: "11px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 700,
                  fontSize: 14,
                  color: "#fff",
                  boxShadow: "0 4px 16px rgba(245,158,11,0.3)"
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Geolocation Consent & Capture modal */}
      {geoActiveFor && (
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
          onClick={dispensarGeo}
        >
          <div
            style={{
              background: t.surface,
              border: `1.5px solid ${t.border}`,
              borderRadius: 20,
              padding: "28px 24px",
              width: "100%",
              maxWidth: 680,
              boxShadow: t.shadow
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: "50%",
                  background: geoError ? "rgba(239,68,68,0.1)" : geoCoords ? "rgba(34,197,94,0.1)" : "rgba(59,130,246,0.1)",
                  border: `2px solid ${geoError ? t.danger : geoCoords ? t.success : t.accent}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 12px"
                }}
              >
                <Clock size={22} color={geoError ? t.danger : geoCoords ? t.success : t.accent} />
              </div>
              <h3 style={{ margin: "0 0 4px", color: t.text, fontSize: 18, fontWeight: 700 }}>
                Consentimento de Localização
              </h3>
              <p style={{ margin: 0, color: t.textSub, fontSize: 13 }}>
                Registrando: <strong>{steps[geoActiveFor.idx].done}</strong> ({geoActiveFor.tipo === "auto" ? "Automático" : `Manual - ${geoActiveFor.manualHora}`})
              </p>
            </div>

            {/* Consent Term Explanation */}
            <div
              style={{
                background: t.surfaceAlt,
                border: `1px solid ${t.border}`,
                borderRadius: 12,
                padding: "12px 14px",
                marginBottom: 16,
                fontSize: "12px",
                color: t.textSub,
                lineHeight: 1.5,
                maxHeight: "150px",
                overflowY: "auto"
              }}
            >
              <div style={{ fontWeight: 700, color: t.text, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                🛡️ Termo de Consentimento (LGPD):
              </div>
              "Para fins de autenticidade jurídica, declaração de presença física e auditoria de registro de ponto (conforme Portaria 671/MTE e regulamentos da LGPD), autorizo o sistema a capturar a geolocalização aproximada do meu dispositivo exclusivamente neste instante da batida de ponto."
            </div>

            {/* State: Waiting Consent and Capture */}
            {!geoConsentAccepted && !geoCoords && !geoError && (
              <button
                onClick={capturarLocalizacao}
                style={{
                  width: "100%",
                  background: t.accent,
                  border: "none",
                  borderRadius: 12,
                  padding: "14px",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#fff",
                  fontFamily: "inherit",
                  boxShadow: `0 4px 14px ${t.accentGlow}`,
                  transition: "all 0.15s"
                }}
              >
                🔓 Aceitar Termo e Capturar GPS
              </button>
            )}

            {/* State: Loading with Progressive Filter Radar */}
            {geoLoading && (
              <div style={{ textAlign: "center", padding: "16px 0", color: t.textSub, fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                {/* Radar effect with bouncing rings */}
                <div style={{ position: "relative", width: 64, height: 64, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div className="animate-ping" style={{ position: "absolute", width: "100%", height: "100%", borderRadius: "50%", background: t.accent, opacity: 0.15 }} />
                  <div className="animate-pulse" style={{ position: "absolute", width: "70%", height: "70%", borderRadius: "50%", background: t.accentGlow, opacity: 0.4 }} />
                  <div style={{ position: "relative", width: 40, height: 40, borderRadius: "50%", background: t.accent, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 12px ${t.accentGlow}` }}>
                    <span style={{ fontSize: 16, color: "#fff" }}>🛰️</span>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <strong style={{ color: t.text, fontSize: 14 }}>Refinando Sinal GPS...</strong>
                  <span style={{ fontSize: 12, color: t.textMuted }}>
                    Filtro progressivo ativo ({geoCountdown}s restantes)
                  </span>
                </div>

                <div style={{ width: "100%", background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: 12, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                    <span style={{ color: t.textMuted }}>Amostras coletadas:</span>
                    <strong style={{ color: t.text, fontFamily: "monospace" }}>{geoSamplesCount} leituras</strong>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, alignItems: "center" }}>
                    <span style={{ color: t.textMuted }}>Melhor precisão obtida:</span>
                    {bestGeoCoords && bestGeoCoords.accuracy !== undefined ? (
                      <span style={{ 
                        fontFamily: "monospace", 
                        fontWeight: 700, 
                        color: bestGeoCoords.accuracy <= 10 ? "#16a34a" : bestGeoCoords.accuracy <= 30 ? "#d97706" : "#dc2626",
                        background: bestGeoCoords.accuracy <= 10 ? "rgba(34,197,94,0.12)" : bestGeoCoords.accuracy <= 30 ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.12)",
                        padding: "2px 6px",
                        borderRadius: 6
                      }}>
                        {bestGeoCoords.accuracy.toFixed(1)}m
                      </span>
                    ) : (
                      <span style={{ fontStyle: "italic", color: t.textMuted }}>Aguardando sinal...</span>
                    )}
                  </div>
                </div>

                {bestGeoCoords && (
                  <button
                    onClick={() => {
                      if (geoWatchId !== null) navigator.geolocation.clearWatch(geoWatchId);
                      if (geoIntervalId !== null) clearInterval(geoIntervalId);
                      setGeoWatchId(null);
                      setGeoIntervalId(null);
                      setGeoLoading(false);
                      setGeoCountdown(0);
                      setGeoCoords(bestGeoCoords);
                    }}
                    style={{
                      width: "100%",
                      marginTop: 4,
                      background: t.surfaceAlt,
                      border: `1.5px solid ${t.border}`,
                      borderRadius: 10,
                      padding: "8px 12px",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      color: t.accent,
                      fontFamily: "inherit",
                      transition: "all 0.15s"
                    }}
                  >
                    ⏹️ Interromper e Usar Precisão Atual
                  </button>
                )}
              </div>
            )}

            {/* State: Error */}
            {geoError && (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    background: t.dangerBg || "rgba(239,68,68,0.06)",
                    border: `1.5px solid ${t.dangerBorder || "rgba(239,68,68,0.2)"}`,
                    borderRadius: 12,
                    padding: "16px",
                    color: t.danger,
                    fontSize: 13,
                    lineHeight: 1.5,
                    textAlign: "left"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, marginBottom: 8, fontSize: 14 }}>
                    <span>⚠️</span>
                    <span>Localização Requerida para Auditoria</span>
                  </div>
                  
                  {geoError.includes("Portaria 671") ? (
                    <div>
                      <p style={{ margin: "0 0 12px 0", color: t.textSub }}>
                        O registro de ponto eletrônico exige a comprovação de presença física do colaborador, em conformidade com as diretrizes da <strong>Portaria 671/MTE</strong> e da <strong>LGPD</strong>. Sem este dado, o ponto não pode ser validado juridicamente.
                      </p>
                      <strong style={{ display: "block", marginBottom: 6, color: t.text }}>Como liberar o acesso:</strong>
                      <div style={{ fontSize: 12, color: t.textSub, background: t.surface, padding: "10px 12px", borderRadius: 8, border: `1px solid ${t.border}`, display: "flex", flexDirection: "column", gap: 6, boxShadow: "inset 0 1px 3px rgba(0,0,0,0.05)" }}>
                        <div>📍 <strong>1. Configurações de Site:</strong> No topo da tela (ao lado do link do site), clique no ícone de cadeado 🔒 ou opções de permissão.</div>
                        <div>👉 <strong>2. Localização:</strong> Mude o interruptor de "Localização" ou "Acesso" para <strong>Permitir / Ativado</strong>.</div>
                        <div>📱 <strong>3. GPS do Celular:</strong> Confirme se o GPS global do seu celular está ativado nas configurações rápidas do aparelho.</div>
                      </div>
                    </div>
                  ) : (
                    <div>{geoError}</div>
                  )}
                </div>
                <button
                  onClick={capturarLocalizacao}
                  style={{
                    width: "100%",
                    marginTop: 12,
                    background: "linear-gradient(135deg, #3B82F6, #2563EB)",
                    border: "none",
                    borderRadius: 12,
                    padding: "12px",
                    cursor: "pointer",
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: "#fff",
                    fontFamily: "inherit",
                    boxShadow: "0 4px 12px rgba(37,99,235,0.25)",
                    transition: "all 0.2s"
                  }}
                >
                  🔄 Tentar capturar novamente
                </button>
              </div>
            )}

            {/* State: Captured successfully (Visible Information) */}
            {geoCoords && (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    background: "rgba(34,197,94,0.08)",
                    border: "1.5px solid rgba(34,197,94,0.22)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    color: "#16a34a",
                    fontSize: 12.5,
                    textAlign: "center",
                    maxWidth: 360,
                    margin: "0 auto"
                  }}
                >
                  <div style={{ fontSize: 15, marginBottom: 2 }}>📍</div>
                  <strong style={{ display: "block", fontSize: 12.5, marginBottom: 2 }}>Localização capturada e estabilizada!</strong>
                  <span style={{ fontSize: 10, color: t.textMuted, display: "block", marginBottom: 6 }}>Filtro de Precisão Progressivo Concluído</span>
                  
                  <div style={{ fontFamily: "monospace", fontSize: 10.5, color: t.textSub, marginTop: 4, background: t.surface, padding: 6, borderRadius: 8, border: `1px solid ${t.border}` }}>
                    Latitude: <strong>{geoCoords.latitude.toFixed(6)}</strong><br />
                    Longitude: <strong>{geoCoords.longitude.toFixed(6)}</strong>
                  </div>

                  {geoCoords.accuracy !== undefined && (
                    <div style={{
                      marginTop: 6,
                      padding: "4px 8px",
                      borderRadius: 6,
                      fontSize: 10,
                      fontWeight: 700,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      background: geoCoords.accuracy <= 10 
                        ? "rgba(34,197,94,0.15)" 
                        : geoCoords.accuracy <= 30 
                        ? "rgba(245,158,11,0.15)" 
                        : "rgba(239,68,68,0.15)",
                      color: geoCoords.accuracy <= 10 
                        ? "#15803d" 
                        : geoCoords.accuracy <= 30 
                        ? "#b45309" 
                        : "#b91c1c",
                      border: `1px solid ${
                        geoCoords.accuracy <= 10 
                          ? "rgba(34,197,94,0.3)" 
                          : geoCoords.accuracy <= 30 
                          ? "rgba(245,158,11,0.3)" 
                          : "rgba(239,68,68,0.3)"
                      }`
                    }}>
                      <span>{geoCoords.accuracy <= 10 ? "🎯" : geoCoords.accuracy <= 30 ? "📡" : "⚠️"}</span>
                      <span>
                        Precisão: <strong>{geoCoords.accuracy.toFixed(1)}m</strong> 
                        ({geoCoords.accuracy <= 10 ? "Máxima / <10m" : geoCoords.accuracy <= 30 ? "Média" : "Baixa"})
                      </span>
                    </div>
                  )}

                </div>

                {geoCoords.accuracy !== undefined && geoCoords.accuracy > 10 && (
                  <div style={{
                    fontSize: 11,
                    color: t.textSub,
                    background: t.surfaceAlt,
                    border: `1px solid ${t.border}`,
                    borderRadius: 10,
                    padding: "10px 12px",
                    marginTop: 10,
                    textAlign: "left",
                    lineHeight: 1.45
                  }}>
                    <strong style={{ display: "block", color: t.text, marginBottom: 4, fontSize: 11.5 }}>💡 Como alcançar precisão de 10m:</strong>
                    • Acesse por um <strong>celular / smartphone</strong> (computadores terrestres não possuem chips de GPS reais e estimam por IP).<br />
                    • Ative o <strong>Wi-Fi</strong> do celular (mesmo se usar dados móveis, ajuda na triangulação Wi-FI SSID).<br />
                    • Evite subsolos. Fique próximo a <strong>janelas</strong> ou áreas externas para conectar com satélites GPS.<br />
                    • Verifique se o navegador tem permissão para usar a <strong>"Localização Precisa"</strong>.
                  </div>
                )}

                <button
                  onClick={finalizarComGeo}
                  disabled={isRegistering}
                  style={{
                    width: "100%",
                    marginTop: 14,
                    background: "linear-gradient(135deg, #22C55E, #16A34A)",
                    border: "none",
                    borderRadius: 14,
                    padding: "18px 24px",
                    cursor: isRegistering ? "not-allowed" : "pointer",
                    fontSize: 16,
                    fontWeight: 800,
                    color: "#fff",
                    fontFamily: "inherit",
                    boxShadow: "0 6px 20px rgba(34,197,94,0.45)",
                    opacity: isRegistering ? 0.6 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    transition: "all 0.18s ease-in-out"
                  }}
                  onMouseEnter={(e) => {
                    if (!isRegistering) {
                      e.currentTarget.style.transform = "scale(1.025)";
                      e.currentTarget.style.boxShadow = "0 8px 24px rgba(34,197,94,0.55)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isRegistering) {
                      e.currentTarget.style.transform = "scale(1)";
                      e.currentTarget.style.boxShadow = "0 6px 20px rgba(34,197,94,0.45)";
                    }
                  }}
                >
                  {isRegistering ? (
                    <>
                      <RefreshCw className="animate-spin" size={16} />
                      <span>Processando Registro...</span>
                    </>
                  ) : (
                    <span>🚀 Confirmar e Enviar para Auditoria</span>
                  )}
                </button>
              </div>
            )}

            <button
              onClick={dispensarGeo}
              style={{
                width: "100%",
                marginTop: 8,
                background: "none",
                border: "none",
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 13,
                color: t.textMuted,
                padding: "6px"
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Pop-up de Aceite de Folha de Ponto */}
      {(pendingFolha || signedSuccessFolha) && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 16
          }}
        >
          {signedSuccessFolha ? (
            <div
              style={{
                background: t.surface,
                border: `2px solid ${t.border}`,
                borderRadius: 24,
                width: "100%",
                maxWidth: 520,
                padding: "28px 24px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
                maxHeight: "92vh",
                overflowY: "auto",
                textAlign: "left"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ background: "rgba(34, 197, 94, 0.12)", padding: 10, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ShieldCheck size={24} color="#22c55e" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: t.text, letterSpacing: "-0.4px" }}>
                    Folha de Ponto Assinada!
                  </h3>
                  <span style={{ fontSize: 13, color: t.textSub }}>
                    Referente a {["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"][signedSuccessFolha.mes]} de {signedSuccessFolha.ano}
                  </span>
                </div>
              </div>

              <div style={{ background: "rgba(34, 197, 94, 0.08)", border: "1px solid rgba(34, 197, 94, 0.2)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#16a34a", display: "block", marginBottom: 6 }}>
                  ✓ Assinatura Digital Efetuada com Sucesso
                </span>
                <p style={{ fontSize: 13, color: t.text, lineHeight: 1.5, margin: 0 }}>
                  Sua folha de ponto mensal consolidada foi assinada digitalmente e registrada para fins de auditoria.
                </p>
              </div>

              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: t.textSub, textTransform: "uppercase", display: "block", marginBottom: 6, letterSpacing: "0.5px" }}>
                  Termo de Aceite Assinado:
                </span>
                <div style={{ background: t.surfaceAlt, border: `1.5px solid ${t.border}`, borderRadius: 12, padding: 14, fontSize: 12.5, color: t.text, lineHeight: 1.5, fontStyle: "italic" }}>
                  "{signedSuccessFolha.textoAceite}"
                </div>
                {signedSuccessFolha.respondidoEm && (
                  <span style={{ fontSize: 11, color: t.textMuted, display: "block", marginTop: 6, textAlign: "right" }}>
                    Assinado em: {new Date(signedSuccessFolha.respondidoEm).toLocaleString("pt-BR")}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  onClick={() => {
                    gerarEspelhoHTMLForEmployee(signedSuccessFolha.ano, signedSuccessFolha.mes);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    width: "100%",
                    padding: "14px",
                    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                    border: "none",
                    borderRadius: 14,
                    color: "#fff",
                    fontSize: "14px",
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.3)",
                    transition: "all 0.15s"
                  }}
                >
                  <FileText size={18} />
                  <span>Visualizar Folha Completa (Baixar PDF)</span>
                </button>

                <button
                  onClick={() => {
                    setSignedSuccessFolha(null);
                  }}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: t.border,
                    border: "none",
                    borderRadius: 12,
                    color: t.text,
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    textAlign: "center"
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                background: t.surface,
                border: `2px solid ${t.border}`,
                borderRadius: 24,
                width: "100%",
                maxWidth: 520,
                padding: "28px 24px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
                maxHeight: "92vh",
                overflowY: "auto",
                textAlign: "left"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{ background: "rgba(59, 130, 246, 0.12)", padding: 10, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Folder size={24} color="#3b82f6" />
                </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: t.text, letterSpacing: "-0.4px" }}>
                  Assinatura de Folha de Ponto
                </h3>
                <span style={{ fontSize: 13, color: t.textSub }}>
                  Referente a {["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"][pendingFolha.mes]} de {pendingFolha.ano}
                </span>
              </div>
            </div>

            <p style={{ fontSize: 13.5, color: t.textSub, lineHeight: 1.5, marginBottom: 20 }}>
              Olá, <strong>{currentUser.nome}</strong>. Sua folha de ponto mensal consolidada foi enviada pela administração para sua conferência e assinatura eletrônica obrigatória.
            </p>

            {/* Resumo Card */}
            <div
              style={{
                background: t.surfaceAlt,
                border: `1.5px solid ${t.border}`,
                borderRadius: 16,
                padding: 16,
                marginBottom: 20,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: t.textSub, textTransform: "uppercase" }}>Horas Trabalhadas</span>
                <strong style={{ fontSize: 15, color: t.text }}>{pendingFolha.horasTrabalhadas.toFixed(1)}h</strong>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: t.textSub, textTransform: "uppercase" }}>Horas Extras</span>
                <strong style={{ fontSize: 15, color: pendingFolha.horasExtra > 0 ? "#16a34a" : t.text }}>
                  {pendingFolha.horasExtra > 0 ? `${pendingFolha.horasExtra.toFixed(1)}h` : "—"}
                </strong>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: t.textSub, textTransform: "uppercase" }}>Adicional Noturno</span>
                <strong style={{ fontSize: 15, color: pendingFolha.horasAdicionalNoturno > 0 ? "#dfa111" : t.text }}>
                  {pendingFolha.horasAdicionalNoturno > 0 ? `${pendingFolha.horasAdicionalNoturno.toFixed(1)}h (Noturnas)` : "—"}
                </strong>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: t.textSub, textTransform: "uppercase" }}>Faltas e Atrasos</span>
                <strong style={{ fontSize: 15, color: (pendingFolha.faltas || 0) > 0 ? "#dc2626" : t.text }}>
                  {(pendingFolha.faltas || 0) > 0 ? `${pendingFolha.faltas} falta(s)` : ""}
                  {(pendingFolha.atrasos || 0) > 0 ? ` ${pendingFolha.atrasos}h de atraso` : ""}
                  {!(pendingFolha.faltas || 0) && !(pendingFolha.atrasos || 0) ? "Nenhum" : ""}
                </strong>
              </div>
              <div style={{ gridColumn: "span 2", borderTop: `1px solid ${t.border}`, paddingTop: 10, marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: t.textSub, textTransform: "uppercase" }}>Adicional de Insalubridade</span>
                <strong style={{ fontSize: 13, color: t.text, fontWeight: 600 }}>{pendingFolha.insalubridadeTexto || "Não aplicável / Não alterado no período."}</strong>
              </div>
            </div>

            {/* View Full Sheet Required Step */}
            <div style={{ marginBottom: 20 }}>
              <button
                onClick={() => {
                  gerarEspelhoHTMLForEmployee(pendingFolha.ano, pendingFolha.mes);
                  setPdfVisualizado(true);
                  setAceiteError("");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  width: "100%",
                  padding: "20px 24px",
                  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                  border: "none",
                  borderRadius: 16,
                  color: "#fff",
                  fontSize: "17px",
                  fontWeight: 800,
                  cursor: "pointer",
                  boxShadow: "0 6px 20px rgba(37, 99, 235, 0.4)",
                  transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "scale(1.02)";
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(37, 99, 235, 0.5)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "scale(1)";
                  e.currentTarget.style.boxShadow = "0 6px 20px rgba(37, 99, 235, 0.4)";
                }}
              >
                <FileText size={22} />
                <span>Visualizar Folha Completa (Baixar PDF)</span>
              </button>
              
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, padding: "8px 12px", borderRadius: 10, background: pdfVisualizado ? "rgba(34,197,94,0.08)" : "rgba(245,158,11,0.08)", border: `1px solid ${pdfVisualizado ? "rgba(34,197,94,0.2)" : "rgba(245,158,11,0.2)"}` }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: pdfVisualizado ? "#22c55e" : "#f59e0b" }} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: pdfVisualizado ? "#16a34a" : "#b45309" }}>
                  {pdfVisualizado ? "Folha de ponto completa baixada com sucesso!" : "Obrigatório: Você precisa baixar o espelho antes de assinar."}
                </span>
              </div>
            </div>

            {/* Error Message */}
            {aceiteError && (
              <div style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 10, padding: "10px 12px", color: "#dc2626", fontSize: 13, fontWeight: 600, marginBottom: 18, lineHeight: 1.4 }}>
                ⚠️ {aceiteError}
              </div>
            )}

            {/* Action Buttons to Select Path */}
            {!showRecusoInput && !showAceitoInput && (
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12, marginTop: 12 }}>
                <button
                  onClick={() => {
                    if (!pdfVisualizado) {
                      setAceiteError("Você precisa clicar em 'Visualizar Folha Completa (Baixar PDF)' e analisar o documento antes de realizar o aceite.");
                      return;
                    }
                    setShowAceitoInput(true);
                    setAceitoConfirmText("");
                    setShowRecusoInput(false);
                    setAceiteError("");
                  }}
                  style={{
                    background: "#22c55e",
                    border: "none",
                    borderRadius: 12,
                    padding: "14px",
                    color: "#fff",
                    fontWeight: 800,
                    fontSize: 14,
                    cursor: "pointer",
                    boxShadow: "0 4px 12px rgba(34,197,94,0.25)",
                    transition: "all 0.15s"
                  }}
                >
                  Confirmar e Aceitar
                </button>
                <button
                  onClick={() => {
                    if (!pdfVisualizado) {
                      setAceiteError("Você precisa clicar em 'Visualizar Folha Completa (Baixar PDF)' e analisar o documento antes de realizar a recusa.");
                      return;
                    }
                    setShowRecusoInput(true);
                    setShowAceitoInput(false);
                    setAceitoConfirmText("");
                    setAceiteError("");
                  }}
                  style={{
                    background: "rgba(220,38,38,0.08)",
                    border: "1.5px solid #dc2626",
                    borderRadius: 12,
                    padding: "12px",
                    color: "#dc2626",
                    fontWeight: 700,
                    fontSize: 13.5,
                    cursor: "pointer",
                    transition: "all 0.15s"
                  }}
                >
                  Recusar / Contestar
                </button>
              </div>
            )}

            {/* PATH A: Accept View */}
            {showAceitoInput && (
              <div style={{ marginTop: 12, borderTop: `1px solid ${t.border}`, paddingTop: 16 }}>
                <h4 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: t.text }}>
                  Declaração de Aceite Eletrônico
                </h4>
                <div style={{ background: t.surfaceAlt, border: `1px solid ${t.border}`, borderRadius: 12, padding: 12, fontSize: 12, color: t.textSub, lineHeight: 1.5, marginBottom: 16, fontStyle: "italic" }}>
                  "Eu, <strong>{currentUser.nome}</strong>, visualizei e aceitei essa folha de ponto e concordo com tudo nela."
                </div>

                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 6, textTransform: "uppercase" }}>
                  Para confirmar, digite <strong style={{ color: t.text }}>ACEITO</strong> abaixo:
                </label>
                <input
                  type="text"
                  placeholder="Digite ACEITO em maiúsculo"
                  value={aceitoConfirmText}
                  onChange={(e) => {
                    setAceitoConfirmText(e.target.value);
                    setAceiteError("");
                  }}
                  style={{
                    width: "100%",
                    background: t.surfaceAlt,
                    border: `1.5px solid ${t.border}`,
                    borderRadius: 10,
                    padding: "10px 12px",
                    color: t.text,
                    fontSize: 14,
                    outline: "none",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    marginBottom: 16
                  }}
                />

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={handleConfirmAceite}
                    disabled={submittingAceite || aceitoConfirmText !== "ACEITO"}
                    style={{
                      flex: 1,
                      background: aceitoConfirmText === "ACEITO" ? "#22c55e" : t.border,
                      border: "none",
                      borderRadius: 12,
                      padding: "14px",
                      color: aceitoConfirmText === "ACEITO" ? "#fff" : t.textMuted,
                      fontWeight: 800,
                      fontSize: 14,
                      cursor: aceitoConfirmText === "ACEITO" ? "pointer" : "not-allowed",
                      boxShadow: aceitoConfirmText === "ACEITO" ? "0 4px 12px rgba(34,197,94,0.3)" : "none"
                    }}
                  >
                    {submittingAceite ? "Processando..." : "Assinar Eletronicamente"}
                  </button>
                  <button
                    onClick={() => {
                      setShowAceitoInput(false);
                      setAceitoConfirmText("");
                      setAceiteError("");
                    }}
                    style={{
                      background: t.surfaceAlt,
                      border: `1px solid ${t.border}`,
                      borderRadius: 12,
                      padding: "12px 18px",
                      color: t.textSub,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer"
                    }}
                  >
                    Voltar
                  </button>
                </div>
              </div>
            )}

            {/* PATH B: Recusa View */}
            {showRecusoInput && (
              <div style={{ marginTop: 12, borderTop: `1px solid ${t.border}`, paddingTop: 16 }}>
                <h4 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "#dc2626" }}>
                  Contestar Folha de Ponto
                </h4>
                <p style={{ fontSize: 12, color: t.textSub, lineHeight: 1.45, marginBottom: 12 }}>
                  Descreva detalhadamente qual marcação ou valor está incorreto para que o departamento de recursos humanos analise e faça as correções necessárias.
                </p>

                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: t.textSub, marginBottom: 6, textTransform: "uppercase" }}>
                  Motivo da Recusa <span style={{ color: "#dc2626" }}>* Obrigatório</span>
                </label>
                <textarea
                  placeholder="Ex: No dia 14/07 o almoço ficou marcado errado, trabalhei direto..."
                  value={motivoRecusa}
                  onChange={(e) => {
                    setMotivoRecusa(e.target.value);
                    setAceiteError("");
                  }}
                  rows={4}
                  style={{
                    width: "100%",
                    background: t.surfaceAlt,
                    border: `1.5px solid ${t.border}`,
                    borderRadius: 10,
                    padding: "10px 12px",
                    color: t.text,
                    fontSize: 13.5,
                    outline: "none",
                    fontFamily: "inherit",
                    resize: "none",
                    marginBottom: 16
                  }}
                />

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={handleConfirmRecusa}
                    disabled={submittingAceite || !motivoRecusa.trim()}
                    style={{
                      flex: 1,
                      background: "#dc2626",
                      border: "none",
                      borderRadius: 12,
                      padding: "14px",
                      color: "#fff",
                      fontWeight: 800,
                      fontSize: 14,
                      cursor: motivoRecusa.trim() ? "pointer" : "not-allowed",
                      boxShadow: motivoRecusa.trim() ? "0 4px 12px rgba(220,38,38,0.3)" : "none"
                    }}
                  >
                    {submittingAceite ? "Processando..." : "Contestar & Bloquear Acesso"}
                  </button>
                  <button
                    onClick={() => {
                      setShowRecusoInput(false);
                      setMotivoRecusa("");
                      setAceiteError("");
                    }}
                    style={{
                      background: t.surfaceAlt,
                      border: `1px solid ${t.border}`,
                      borderRadius: 12,
                      padding: "12px 18px",
                      color: t.textSub,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: "pointer"
                    }}
                  >
                    Voltar
                  </button>
                </div>
              </div>
            )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
