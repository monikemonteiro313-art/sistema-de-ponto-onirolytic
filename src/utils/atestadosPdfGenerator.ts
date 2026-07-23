import { getCidInfo } from "./cidHelper";

export interface AtestadoItem {
  userId: number;
  userName: string;
  userMatricula: string;
  dayKey: string; // YYYY-MM-DD
  cid: string;
  fotoAtestado?: string;
  obs?: string;
  registradoEm?: string;
  parcial?: boolean;
}

export interface EmpresaConfig {
  nome: string;
  cnpj: string;
}

const MESES_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function gerarRelatorioAtestadosPDF(
  atestados: AtestadoItem[],
  filtroMesAno: string, // "YYYY-MM" or "todos"
  empresaConfig: EmpresaConfig
) {
  // Filter by month if specific month selected
  const atestadosFiltrados = filtroMesAno === "todos"
    ? atestados
    : atestados.filter(a => a.dayKey.startsWith(filtroMesAno));

  let mesAnoLabel = "Todos os Registros";
  if (filtroMesAno !== "todos" && filtroMesAno.includes("-")) {
    const [y, m] = filtroMesAno.split("-");
    const mIdx = parseInt(m, 10) - 1;
    if (mIdx >= 0 && mIdx < 12) {
      mesAnoLabel = `${MESES_FULL[mIdx]} de ${y}`;
    }
  }

  const totalAtestados = atestadosFiltrados.length;
  const totalDiaInteiro = atestadosFiltrados.filter(a => !a.parcial).length;
  const totalParcial = atestadosFiltrados.filter(a => a.parcial).length;
  const colaboradoresUnicos = new Set(atestadosFiltrados.map(a => a.userId)).size;

  const dataEmissao = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório de Atestados Médicos - ${mesAnoLabel}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 15mm 15mm 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      margin: 0;
      padding: 20px;
      background: #fff;
      font-size: 11pt;
      line-height: 1.4;
    }
    .header-box {
      border-bottom: 2px solid #2563eb;
      padding-bottom: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .company-title {
      font-size: 16pt;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 4px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .company-sub {
      font-size: 10pt;
      color: #64748b;
      margin: 0;
    }
    .report-title {
      font-size: 13pt;
      font-weight: 700;
      color: #2563eb;
      margin: 16px 0 6px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 22px;
      page-break-inside: avoid;
    }
    .stat-card {
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      padding: 10px 12px;
      border-radius: 6px;
      text-align: center;
    }
    .stat-val {
      font-size: 16pt;
      font-weight: 800;
      color: #2563eb;
      margin-bottom: 2px;
    }
    .stat-lbl {
      font-size: 8pt;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
    }
    .atestado-card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 14px;
      page-break-inside: avoid;
      background: #ffffff;
    }
    .atestado-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 8px;
      margin-bottom: 8px;
    }
    .emp-name {
      font-size: 11pt;
      font-weight: 700;
      color: #0f172a;
    }
    .emp-mat {
      font-size: 9pt;
      color: #64748b;
    }
    .tag-tipo {
      font-size: 8pt;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .tag-inteiro {
      background: #dbeafe;
      color: #1e40af;
    }
    .tag-parcial {
      background: #fef3c7;
      color: #92400e;
    }
    .cid-box {
      background: #f1f5f9;
      border-left: 3px solid #2563eb;
      padding: 8px 10px;
      border-radius: 0 6px 6px 0;
      margin-top: 6px;
    }
    .cid-code {
      font-family: monospace;
      font-weight: 800;
      font-size: 10pt;
      color: #2563eb;
    }
    .cid-title {
      font-weight: 700;
      font-size: 10pt;
      color: #0f172a;
    }
    .cid-desc {
      font-size: 9pt;
      color: #334155;
      margin-top: 4px;
    }
    .cid-rec {
      font-size: 8.5pt;
      color: #475569;
      margin-top: 4px;
      font-style: italic;
    }
    .footer-sign {
      margin-top: 30px;
      padding-top: 16px;
      border-top: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
      font-size: 9pt;
      color: #64748b;
    }
    .ass-box {
      text-align: center;
      width: 200px;
    }
    .ass-line {
      border-top: 1px solid #0f172a;
      margin-top: 40px;
      padding-top: 4px;
      font-weight: 600;
      color: #0f172a;
    }
    .no-print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #2563eb;
      color: #fff;
      border: none;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    @media print {
      .no-print-btn { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>

  <button class="no-print-btn" onclick="window.print()">🖨️ Imprimir ou Salvar como PDF</button>

  <div class="header-box">
    <div>
      <h1 class="company-title">${empresaConfig.nome}</h1>
      <p class="company-sub">CNPJ: ${empresaConfig.cnpj} • Sistema de Controle de Frequência e Atestados</p>
    </div>
    <div style="text-align: right; font-size: 8.5pt; color: #64748b;">
      <div>Emissão: <strong>${dataEmissao}</strong></div>
      <div>Período: <strong>${mesAnoLabel}</strong></div>
    </div>
  </div>

  <div class="report-title">
    📋 RELATÓRIO MENSAL CONSOLIDADO DE ATESTADOS MÉDICOS
  </div>
  <p style="font-size: 9.5pt; color: #475569; margin: 0 0 16px 0;">
    Documento oficial sintetizando todos os atestados médicos recebidos e homologados para o período de <strong>${mesAnoLabel}</strong>, incluindo a classificação e diagnóstico técnico dos CIDs informados.
  </p>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-val">${totalAtestados}</div>
      <div class="stat-lbl">Total de Atestados</div>
    </div>
    <div class="stat-card">
      <div class="stat-val">${colaboradoresUnicos}</div>
      <div class="stat-lbl">Colaboradores</div>
    </div>
    <div class="stat-card">
      <div class="stat-val">${totalDiaInteiro}</div>
      <div class="stat-lbl">Dia Inteiro</div>
    </div>
    <div class="stat-card">
      <div class="stat-val">${totalParcial}</div>
      <div class="stat-lbl">Parciais (Horas)</div>
    </div>
  </div>

  ${totalAtestados === 0 ? `
    <div style="text-align: center; padding: 40px; border: 1px dashed #cbd5e1; border-radius: 8px; color: #64748b;">
      Nenhum atestado médico registrado para o período de <strong>${mesAnoLabel}</strong>.
    </div>
  ` : atestadosFiltrados.map((item, idx) => {
    const infoCid = getCidInfo(item.cid);
    const [y, m, d] = item.dayKey.split("-");
    const dataFmt = `${d}/${m}/${y}`;

    return `
      <div class="atestado-card">
        <div class="atestado-header">
          <div>
            <span class="emp-name">${idx + 1}. ${item.userName}</span>
            <span class="emp-mat">(Matrícula: ${item.userMatricula})</span>
          </div>
          <div>
            <span style="font-size: 9pt; font-weight: 700; color: #0f172a; margin-right: 10px;">Data: ${dataFmt}</span>
            <span class="tag-tipo ${item.parcial ? "tag-parcial" : "tag-inteiro"}">
              ${item.parcial ? "Atestado Parcial" : "Dia Completo"}
            </span>
          </div>
        </div>

        <div class="cid-box">
          <div>
            <span class="cid-code">[CID-10 ${infoCid.code}]</span>
            <span class="cid-title">${infoCid.titulo}</span>
            <span style="font-size: 8pt; color: #64748b; margin-left: 6px;">(${infoCid.categoria})</span>
          </div>
          <div class="cid-desc">
            <strong>Diagnóstico / Análise Técnica:</strong> ${infoCid.oQueDizOAtestado}
          </div>
          <div class="cid-rec">
            <strong>Recomendação Laboral:</strong> ${infoCid.recomendacaoTrabalho}
          </div>
        </div>

        ${item.obs ? `
          <div style="font-size: 8.5pt; color: #475569; margin-top: 6px; font-style: italic; background: #f8fafc; padding: 6px 8px; border-radius: 4px;">
            <strong>Observação registrada:</strong> "${item.obs}"
          </div>
        ` : ""}
      </div>
    `;
  }).join("")}

  <div class="footer-sign">
    <div>
      Relatório gerado automaticamente via Sistema de Gestão de Ponto.<br>
      Conforme diretrizes de controle de frequência e homologação médica.
    </div>
    <div class="ass-box">
      <div class="ass-line">Assinatura do RH / Gestão</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_atestados_${filtroMesAno}.html`;
    a.click();
  }
}
