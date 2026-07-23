export interface CidInfo {
  code: string;
  codeClean: string;
  titulo: string;
  categoria: string;
  descricao: string;
  oQueDizOAtestado: string;
  recomendacaoTrabalho: string;
}

const CID_DATABASE: Record<string, Omit<CidInfo, "code" | "codeClean">> = {
  "M54.5": {
    titulo: "Dor Lombar Baixa (Lumbago / Lombalgia)",
    categoria: "Sistema Osteomuscular e Coluna",
    descricao: "Condição dolorosa aguda ou crônica que afeta a região lombar da coluna vertebral.",
    oQueDizOAtestado: "O paciente apresenta dor intensa na região inferior das costas que limita movimentos como dobrar o tronco, caminhar e sentar por períodos prolongados.",
    recomendacaoTrabalho: "Afastamento temporário das atividades laborais, especialmente com esforço físico, carregamento de peso ou postura estática sentada. Recomenda-se repouso relativo, uso de analgésicos/anti-inflamatórios e fisioterapia."
  },
  "M54": {
    titulo: "Dorsalgia (Dores nas Costas)",
    categoria: "Sistema Osteomuscular e Coluna",
    descricao: "Dor localizada ao longo da coluna vertebral (cervical, torácica ou lombar).",
    oQueDizOAtestado: "Indica espasmos musculares ou alterações estruturais na coluna provocando desconforto e restrição postural.",
    recomendacaoTrabalho: "Necessita de repouso da coluna, analgésicos e repouso de atividades que demandem impacto ou repetição."
  },
  "M54.2": {
    titulo: "Cervicalgia (Dor no Pescoço)",
    categoria: "Sistema Osteomuscular e Coluna",
    descricao: "Dor e rigidez na região da coluna cervical e musculatura do pescoço.",
    oQueDizOAtestado: "Provoca limitação para rotação e flexão da cabeça, frequentemente acompanhada de dor irradiada para ombros.",
    recomendacaoTrabalho: "Afastamento de uso intensivo de telas e digitação, além de evitar esforço físico. Recomenda-se compressas mornas e medicamentos relaxantes musculares."
  },
  "M75": {
    titulo: "Lesões do Ombro / Tendinite",
    categoria: "Sistema Osteomuscular",
    descricao: "Processo inflamatório nos tendões dos manguitos rotadores ou articulação do ombro.",
    oQueDizOAtestado: "O paciente apresenta limitação funcional para elevação ou movimentação do membro superior afetado.",
    recomendacaoTrabalho: "Incapacidade temporária para atividades de digitação contínua, carregamento de carga ou elevação do braço acima dos ombros."
  },
  "M65": {
    titulo: "Sinovite e Tenossinovite (LER / DORT)",
    categoria: "Sistema Osteomuscular",
    descricao: "Inflamação da bainha de revestimento do tendão, associada a movimentos repetitivos.",
    oQueDizOAtestado: "O atestado atesta dor, inchaço e perda de força nas mãos ou punhos por sobrecarga de esforço.",
    recomendacaoTrabalho: "Repouso absoluto da articulação acometida. Recomendado uso de órteses de imobilização e medicação prescrevida pelo médico."
  },
  "J06.9": {
    titulo: "Infecção Aguda das Vias Aéreas Superiores (IVAS)",
    categoria: "Sistema Respiratório",
    descricao: "Quadro infeccioso agudo de origem viral que afeta garganta, nariz e seios da face (resfriado forte).",
    oQueDizOAtestado: "O colaborador apresenta febre, coriza, indisposição, dor no corpo e mal-estar geral de surgimento repentino.",
    recomendacaoTrabalho: "Isolamento domiciliar para prevenir contágio no ambiente de trabalho, repouso, ingesta de líquidos abundante e sintomáticos."
  },
  "J06": {
    titulo: "Infecção Aguda das Vias Aéreas Superiores",
    categoria: "Sistema Respiratório",
    descricao: "Resfriado comum, faringite ou laringite aguda de origem viral.",
    oQueDizOAtestado: "Quadro gripal agudo com sintomas respiratórios superiores e queda do estado geral.",
    recomendacaoTrabalho: "Afastamento laboral de 1 a 3 dias para recuperação da imunidade e evitar transmissão presencial."
  },
  "J11": {
    titulo: "Influenza / Gripe com Manifestações Respiratórias",
    categoria: "Sistema Respiratório",
    descricao: "Infecção viral sistêmica pelo vírus da Influenza.",
    oQueDizOAtestado: "Apresenta febre alta, calafrios, mialgia intensa (dores no corpo), dor de cabeça e tosse.",
    recomendacaoTrabalho: "Afastamento compulsório até a cessação da febre, com hidratação rigorosa e repouso no leito."
  },
  "J01": {
    titulo: "Sinusite Aguda",
    categoria: "Sistema Respiratório",
    descricao: "Inflamação da mucosa dos seios paranasais com acúmulo de secreção.",
    oQueDizOAtestado: "Provoca forte dor de cabeça facial, sensação de pressão nos olhos, congestão nasal e prostração.",
    recomendacaoTrabalho: "Repouso e lavagem nasal contínua, evitando ambientes com ar-condicionado frio ou poeira."
  },
  "J02": {
    titulo: "Faringite Aguda",
    categoria: "Sistema Respiratório",
    descricao: "Inflamação da faringe causando dor intensa ao engolir.",
    oQueDizOAtestado: "O paciente encontra-se com dor de garganta, febre e dificuldade de deglutição.",
    recomendacaoTrabalho: "Afastamento das funções para uso de antibióticos ou anti-inflamatórios e poupar a voz."
  },
  "J03": {
    titulo: "Amigdalite Aguda",
    categoria: "Sistema Respiratório",
    descricao: "Infecção bacteriana ou viral das amígdalas palatinas.",
    oQueDizOAtestado: "Causa febre elevada, placas purulentas na garganta e prostração física.",
    recomendacaoTrabalho: "Repouso em casa com antibioticoterapia prescrita e isolamento temporário."
  },
  "J20": {
    titulo: "Bronquite Aguda",
    categoria: "Sistema Respiratório",
    descricao: "Inflamação dos brônquios com tosse produtiva e falta de ar.",
    oQueDizOAtestado: "O paciente apresenta crises de tosse persistente, cansaço e chiado no peito.",
    recomendacaoTrabalho: "Afastamento de ambientes poluídos ou com mudanças bruscas de temperatura, com nebulização e medicação."
  },
  "A09": {
    titulo: "Diarreia e Gastroenterite de Origem Infecciosa",
    categoria: "Doenças Infecciosas / Aparelho Digestivo",
    descricao: "Infecção gastrointestinal aguda caracterizada por evacuation diarreica frequente e cólicas.",
    oQueDizOAtestado: "O paciente apresenta perda hídrica, dor abdominal, náuseas e risco elevado de desidratação.",
    recomendacaoTrabalho: "Incapacidade total de trabalho presencial pelo risco de incontinência e transmissão. Recomenda-se repouso absoluto, reidratação oral e dieta branda."
  },
  "K29": {
    titulo: "Gastrite e Duodenite",
    categoria: "Sistema Digestivo",
    descricao: "Inflamação do revestimento estomacal acompanhada de dor epigástrica (queimação no estômago).",
    oQueDizOAtestado: "Atesta dor intensa na boca do estômago, enjoo e intolerância alimentar temporária.",
    recomendacaoTrabalho: "Alívio sintomático com protetores gástricos e dieta leve, com repouso das atividades estressantes."
  },
  "F32": {
    titulo: "Episódio Depressivo",
    categoria: "Transtornos Mentais e Comportamentais",
    descricao: "Transtorno do humor com tristeza profunda, anedonia e falta de energia.",
    oQueDizOAtestado: "O colaborador está em acompanhamento psiquiátrico/psicológico para estabilização do quadro emocional e psíquico.",
    recomendacaoTrabalho: "Requer afastamento para readequação medicamentosa, psicoterapia e redução severa de estímulos estressantes."
  },
  "F41.1": {
    titulo: "Transtorno de Ansiedade Generalizada (TAG)",
    categoria: "Transtornos Mentais e Comportamentais",
    descricao: "Ansiedade excessiva e preocupação persistente acompanhada de sintomas físicos (taquicardia, tensão).",
    oQueDizOAtestado: "O atestado indica crise de ansiedade com comprometimento da concentração e exaustão psíquica.",
    recomendacaoTrabalho: "Afastamento temporário das pressões de metas e ambiente de trabalho, favorecendo o controle da crise."
  },
  "Z73.0": {
    titulo: "Esgotamento Físico e Mental (Síndrome de Burnout)",
    categoria: "Saúde Mental / Trabalho",
    descricao: "Estado de estresse crônico diretamente vinculado ao ambiente de trabalho.",
    oQueDizOAtestado: "Sensação de esgotamento total de energia, cinismo laboral e queda de eficácia profissional.",
    recomendacaoTrabalho: "Afastamento médico para acompanhamento multiprofissional e reestruturação do ritmo de vida e trabalho."
  },
  "R51": {
    titulo: "Cefaleia / Dor de Cabeça Intensa",
    categoria: "Sintomas e Achados Clínicos",
    descricao: "Sintoma de dor craniana de etiologia a esclarecer ou funcional.",
    oQueDizOAtestado: "O paciente apresentou episódio agudo de cefaleia com sensibilidade à luz e ao som.",
    recomendacaoTrabalho: "Repouso em local escuro e silencioso com medicação analgésica imediata."
  },
  "G43": {
    titulo: "Enxaqueca (Migrânea)",
    categoria: "Sistema Nervoso",
    descricao: "Cefaleia vascular pulsátil severa, frequentemente acompanhada de náuseas, fotofobia e aura.",
    oQueDizOAtestado: "O paciente encontra-se incapacitado durante o pico da crise enxaquecosa.",
    recomendacaoTrabalho: "Afastamento imediato de telas, ruídos e iluminação forte até a completa resolução da crise com medicação específica."
  },
  "H10": {
    titulo: "Conjuntivite Aguda",
    categoria: "Doenças dos Olhos",
    descricao: "Inflamação da conjuntiva ocular, de etiologia viral, bacteriana ou alérgica.",
    oQueDizOAtestado: "Apresenta olhos vermelhos, lacrimejamento, secreção purulenta e fotofobia.",
    recomendacaoTrabalho: "Afastamento de 5 a 7 dias em casos infecciosos devido ao altíssimo risco de transmissão no ambiente de trabalho."
  },
  "S93": {
    titulo: "Entorse e Distensão do Tornozelo",
    categoria: "Lesões e Traumas",
    descricao: "Lesão nos ligamentos do tornozelo provocada por torção articular.",
    oQueDizOAtestado: "O colaborador apresenta edema (inchaço), hematoma local e incapacidade de apoiar o pé no chão.",
    recomendacaoTrabalho: "Repouso do membro inferior com elevação, gelo e imobilização com bota ortopédica ou faixa."
  },
  "N39.0": {
    titulo: "Infecção do Trato Urinário (ITU)",
    categoria: "Sistema Geniturinário",
    descricao: "Infecção bacteriana da bexiga (cistite) ou uretra.",
    oQueDizOAtestado: "Provoca dor ao urinar (disúria), urgência miccional, dor no baixo ventre e mal-estar.",
    recomendacaoTrabalho: "Afastamento para início da antibioticoterapia, repouso e ingesta de água abundante."
  },
  "U07.1": {
    titulo: "COVID-19 (Vírus Identificado)",
    categoria: "Doenças Infecciosas Virais",
    descricao: "Infeção pelo Coronavírus SARS-CoV-2 comprovada por teste laboratorial.",
    oQueDizOAtestado: "O atestado confirma diagnóstico positivo para COVID-19 com sintomas respiratórios/sistêmicos.",
    recomendacaoTrabalho: "Isolamento sanitário estrito de 5 a 10 dias de acordo com protocolos vigentes da vigilância epidemiológica."
  },
  "B34.9": {
    titulo: "Infecção Viral Não Especificada (Virose)",
    categoria: "Doenças Infecciosas Virais",
    descricao: "Quadro viral sistêmico agudo conhecido popularmente como virose.",
    oQueDizOAtestado: "O paciente apresenta sintomas sistêmicos como febre baixa, prostração, dores pelo corpo e inapetência.",
    recomendacaoTrabalho: "Afastamento de 1 a 3 dias para repouso, hidratação oral e sintomáticos."
  },
  "Z76.3": {
    titulo: "Consulta de Acompanhante de Paciente",
    categoria: "Atendimento de Saúde",
    descricao: "Declaração de comparecimento como acompanhante legal ou responsável por dependente doente.",
    oQueDizOAtestado: "O colaborador esteve presente para acompanhar familiar em consulta, exames ou internação médica.",
    recomendacaoTrabalho: "Abono do período/dia especificado mediante comprovação do grau de parentesco e necessidade de auxílio."
  },
  "Z00.0": {
    titulo: "Exame Médico Geral / Consulta de Rotina",
    categoria: "Atendimento de Saúde",
    descricao: "Declaração de comparecimento a consulta de avaliação ou exames preventivos.",
    oQueDizOAtestado: "O trabalhador esteve em atendimento médico durante os horários indicados.",
    recomendacaoTrabalho: "Justificativa de ausência no período correspondente ao atendimento."
  }
};

export function getCidInfo(cidRaw: string | undefined | null): CidInfo {
  const raw = (cidRaw || "").trim().toUpperCase();
  if (!raw || raw === "N/A" || raw === "SEM CID" || raw === "OUTRO") {
    return {
      code: raw || "N/A",
      codeClean: "N/A",
      titulo: "CID Não Especificado / Sem Código",
      categoria: "Atestado sem indicação de código CID-10",
      descricao: "Atestado médico fornecido sem especificação do código internacional de doenças.",
      oQueDizOAtestado: "O profissional médico optou por omitir o código da doença, direito garantido pela Resolução CFM nº 1.658/2002 ao paciente.",
      recomendacaoTrabalho: "O atestado médico possui validade legal normal para justificativa da ausência, devendo ser acolhido pela empresa."
    };
  }

  // Clean format: e.g. "M54.5" or "M545" or "J06"
  const clean = raw.replace(/[^A-Z0-9]/g, "");
  
  // Try exact lookup first
  if (CID_DATABASE[raw]) {
    return { code: raw, codeClean: clean, ...CID_DATABASE[raw] };
  }

  // Try dot insertion if missing e.g. M545 -> M54.5
  let withDot = raw;
  if (!raw.includes(".") && clean.length > 3) {
    withDot = `${clean.slice(0, 3)}.${clean.slice(3)}`;
  }
  if (CID_DATABASE[withDot]) {
    return { code: raw, codeClean: clean, ...CID_DATABASE[withDot] };
  }

  // Try 3-character prefix lookup e.g. M54.5 -> M54
  const prefix3 = clean.slice(0, 3);
  if (CID_DATABASE[prefix3]) {
    return { code: raw, codeClean: clean, ...CID_DATABASE[prefix3] };
  }

  // Fallback: Chapter / Range Classification based on CID-10 standard letters
  const letter = clean.charAt(0);
  const numVal = parseInt(clean.slice(1, 3), 10) || 0;

  let categoria = "Classificação Internacional de Doenças (CID-10)";
  let titulo = `Código CID-10: ${raw}`;
  let descricao = "Código registrado conforme atestado apresentado pelo colaborador.";
  let oQueDizOAtestado = "Atesta incapacidade temporária de trabalho decorrente de condição médica identificada.";
  let recomendacaoTrabalho = "Afastamento e acolhimento das justificativas para o período assinalado no documento.";

  if (letter === "A" || letter === "B") {
    categoria = "Doenças Infecciosas e Parasitárias";
    titulo = `CID ${raw} - Doença Infecciosa / Parasitária`;
    descricao = "Infeção bacteriana, viral ou parasitária identificada por avaliação médica.";
    oQueDizOAtestado = "O colaborador apresenta processo infeccioso agudo com necessidade de isolamento e cuidados com contágio.";
    recomendacaoTrabalho = "Repouso, hidratação, uso de medicação específica e afastamento do convívio laboral presencial.";
  } else if (letter === "C" || (letter === "D" && numVal < 50)) {
    categoria = "Neoplasias (Tumores)";
    titulo = `CID ${raw} - Acompanhamento Oncológico / Neoplásico`;
    descricao = "Condição neoplásica em tratamento ou investigação clínica.";
    oQueDizOAtestado = "Acompanhamento médico especializado ou efeitos de terapias específicas.";
    recomendacaoTrabalho = "Flexibilização de rotina, repouso do trabalhador e apoio às recomendações da equipe médica.";
  } else if (letter === "E") {
    categoria = "Doenças Endócrinas e Metabólicas";
    titulo = `CID ${raw} - Distúrbio Endócrino ou Metabólico`;
    descricao = "Condição relacionada ao metabolismo ou glândulas endócrinas.";
    oQueDizOAtestado = "Alteração no equilíbrio metabólico que compromete a disposição física.";
    recomendacaoTrabalho = "Ajuste do esquema terapêutico, repouso das atividades e acompanhamento médico.";
  } else if (letter === "F") {
    categoria = "Transtornos Mentais e Comportamentais";
    titulo = `CID ${raw} - Transtorno Psíquico / Emocional`;
    descricao = "Quadro do espectro da saúde mental (estresse, ansiedade, humor, sono ou sobrecarga psíquica).";
    oQueDizOAtestado = "Incapacidade laborativa temporária motivada por sofrimento psíquico ou crise emocional.";
    recomendacaoTrabalho = "Afastamento das pressões de trabalho, repouso em ambiente calmo e suporte multiprofissional.";
  } else if (letter === "G") {
    categoria = "Doenças do Sistema Nervoso";
    titulo = `CID ${raw} - Condição Neurológica`;
    descricao = "Afecção afetando o sistema nervoso central ou periférico.";
    oQueDizOAtestado = "O paciente apresenta sintomas como dor intensa, tonturas ou limitações motoras/sensoriais.";
    recomendacaoTrabalho = "Evitar uso de máquinas pesadas, telas ou esforço físico. Repouso até cessação dos sintomas.";
  } else if (letter === "H" && numVal < 60) {
    categoria = "Doenças dos Olhos e Anexos";
    titulo = `CID ${raw} - Alteração Oftalmológica`;
    descricao = "Processo inflamatório, infeccioso ou alérgico nos olhos.";
    oQueDizOAtestado = "Limitação na acuidade visual temporária ou risco de transmissão ocular.";
    recomendacaoTrabalho = "Pausa no trabalho computacional/visual. Uso de colírios prescrevidos e higienização.";
  } else if (letter === "H" && numVal >= 60) {
    categoria = "Doenças do Ouvido e Labirinto";
    titulo = `CID ${raw} - Alteração Otológica / Vestibular`;
    descricao = "Condição afetando audição ou equilíbrio (ex: otite, labirintite).";
    oQueDizOAtestado = "Sintomas de zumbido, vertigem, diminuição auditiva ou tontura.";
    recomendacaoTrabalho: "Proibido trabalho em altura ou com máquinas perigosas. Repouso físico imediato.";
  } else if (letter === "I") {
    categoria = "Doenças do Sistema Circulatório";
    titulo = `CID ${raw} - Condição Cardiovascular`;
    descricao = "Alteração hemodinâmica ou vascular (pressão arterial, arritmia, circulação).";
    oQueDizOAtestado = "Instabilidade cardiovascular requerendo monitoramento e medicação.";
    recomendacaoTrabalho = "Repouso, restrição total a esforços físicos e redução de estresse.";
  } else if (letter === "J") {
    categoria = "Doenças do Sistema Respiratório";
    titulo = `CID ${raw} - Afecção Respiratória`;
    descricao = "Quadro agudo do trato respiratório (pulmões, brônquios, garganta ou nariz).";
    oQueDizOAtestado = "Sintomas como tosse, febre, dor no peito e dificuldade respiratória.";
    recomendacaoTrabalho = "Afastamento, repouso domiciliar, inalações e evitar exposição ao frio/poeira.";
  } else if (letter === "K") {
    categoria = "Doenças do Sistema Digestivo";
    titulo = `CID ${raw} - Condição Gastrointestinal`;
    descricao = "Alteração no estômago, intestinos, fígado ou vesícula.";
    oQueDizOAtestado = "Dor abdominal, náuseas, alterações de trânsito intestinal ou desconforto digestivo.";
    recomendacaoTrabalho = "Repouso, dieta adequada, hidratação e medicação prescrevida.";
  } else if (letter === "L") {
    categoria = "Doenças da Pele e Tecido Subcutâneo";
    titulo = `CID ${raw} - Lesão / Infecção de Pele`;
    descricao = "Processo dermatológico inflamatório ou infeccioso.";
    oQueDizOAtestado = "Apresenta lesão cutânea exigindo tratamento local e repouso.";
    recomendacaoTrabalho = "Evitar contaminação local, produtos químicos e exposição solar.";
  } else if (letter === "M") {
    categoria = "Sistema Osteomuscular e Coluna";
    titulo = `CID ${raw} - Condição Ortopédica / Muscular`;
    descricao = "Acometimento de músculos, articulações, tendões ou coluna vertebral.";
    oQueDizOAtestado = "Dor e restrição física nos movimentos do corpo, membros ou costas.";
    recomendacaoTrabalho = "Repouso físico, medicação analgésica e imobilização/postura adequada.";
  } else if (letter === "N") {
    categoria = "Sistema Geniturinário";
    titulo = `CID ${raw} - Afecção Renal ou Urinária`;
    descricao = "Infecção, inflamação ou dor nos rins, bexiga ou vias urinárias.";
    oQueDizOAtestado = "Dor ao urinar, cólica ou desconforto pélvico incapacitante.";
    recomendacaoTrabalho = "Ingestão hídrica abundante, repouso e medicação prescrevida.";
  } else if (letter === "O") {
    categoria = "Gravidez, Parto e Puerpério";
    titulo = `CID ${raw} - Acompanhamento Obstétrico`;
    descricao = "Cuidados durante o período gestacional ou pós-parto.";
    oQueDizOAtestado = "Necessidade de repouso maternal ou exames pré-natais.";
    recomendacaoTrabalho = "Preservação da saúde da mãe e do bebê com repouso assinalado.";
  } else if (letter === "R") {
    categoria = "Sintomas e Sinais Clínicos";
    titulo = `CID ${raw} - Sintoma Clínico Agudo`;
    descricao = "Manifestação sintomática aguda (febre, dor, tontura, mal-estar a esclarecer).";
    oQueDizOAtestado = "O colaborador esteve em atendimento de emergência ou avaliação sintomática.";
    recomendacaoTrabalho = "Afastamento temporário para estabilização do sintoma.";
  } else if (letter === "S" || letter === "T") {
    categoria = "Lesões, Traumas e Causas Externas";
    titulo = `CID ${raw} - Trauma / Lesão Física`;
    descricao = "Contusão, fratura, entorse, queimadura ou ferimento decorrente de impacto/acidente.";
    oQueDizOAtestado = "Limitação física decorrente de lesão traumática recente.";
    recomendacaoTrabalho = "Imobilização, curativos, repouso do membro afetado e cicatrização.";
  } else if (letter === "Z") {
    categoria = "Atendimento de Saúde / Acompanhamento";
    titulo = `CID ${raw} - Comparecimento / Acompanhamento Médico`;
    descricao = "Consulta de acompanhamento, exames admissionais/periódicos ou acompanhamento de familiar.";
    oQueDizOAtestado = "Atesta o comparecimento ao estabelecimento de saúde no período citado.";
    recomendacaoTrabalho = "Justificativa legal do tempo/dia ausente.";
  }

  return {
    code: raw,
    codeClean: clean,
    titulo,
    categoria,
    descricao,
    oQueDizOAtestado,
    recomendacaoTrabalho
  };
}
