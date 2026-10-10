// Escalas de qualidade do ar: EPA (a que a API devolve pronta) e CETESB
// (a oficial do estado de SP, calculada aqui a partir das concentrações).
// Lógica pura, sem tela e sem rede — fácil de testar.

const SEM_DADO = {
  nivel: null,
  rotulo: 'Sem dado',
  cor: '#607d8b',
  conselho: 'Não há dado disponível para este horário.',
};

// =============================================================================
// EPA (us_aqi)
// =============================================================================

const FAIXAS_EPA = [
  {
    nivel: 0,
    max: 50,
    rotulo: 'Bom',
    cor: '#2e7d32',
    conselho: 'Ar limpo. Ótimo momento para atividades ao ar livre.',
  },
  {
    nivel: 1,
    max: 100,
    rotulo: 'Moderado',
    cor: '#f9a825',
    conselho:
      'Aceitável. Pessoas muito sensíveis devem evitar esforço prolongado ao ar livre.',
  },
  {
    nivel: 2,
    max: 150,
    rotulo: 'Insalubre p/ sensíveis',
    cor: '#ef6c00',
    conselho:
      'Crianças, idosos e quem tem asma ou doença cardíaca devem reduzir o esforço ao ar livre.',
  },
  {
    nivel: 3,
    max: Infinity,
    rotulo: 'Insalubre',
    cor: '#c62828',
    conselho:
      'Todos podem sentir efeitos. Evite exercícios ao ar livre e mantenha janelas fechadas.',
  },
];

function semNumero(v) {
  return v === null || v === undefined || Number.isNaN(v);
}

// Recebe o índice EPA (us_aqi) e devolve a faixa com rótulo, cor e conselho.
export function faixaDoIndice(aqi) {
  if (semNumero(aqi)) return SEM_DADO;
  return FAIXAS_EPA.find((f) => aqi <= f.max);
}

export const LEGENDA_EPA = FAIXAS_EPA.map((f, i) => ({
  ...f,
  faixa: i === 0 ? '0–50' : i === FAIXAS_EPA.length - 1 ? '> 150' : `${FAIXAS_EPA[i - 1].max + 1}–${f.max}`,
}));

// =============================================================================
// CETESB (índice de SP, CONAMA 491/2018)
// =============================================================================

const FAIXAS_CETESB = [
  {
    nivel: 0,
    iMin: 0,
    iMax: 40,
    rotulo: 'Boa',
    cor: '#2e7d32',
    conselho: 'Qualidade boa. Pode praticar atividades ao ar livre normalmente.',
  },
  {
    nivel: 1,
    iMin: 41,
    iMax: 80,
    rotulo: 'Moderada',
    cor: '#f9a825',
    conselho:
      'Pessoas de grupos sensíveis podem ter sintomas como tosse seca e cansaço.',
  },
  {
    nivel: 2,
    iMin: 81,
    iMax: 120,
    rotulo: 'Ruim',
    cor: '#ef6c00',
    conselho:
      'Toda a população pode ter sintomas. Sensíveis devem evitar esforço ao ar livre.',
  },
  {
    nivel: 3,
    iMin: 121,
    iMax: 200,
    rotulo: 'Muito ruim',
    cor: '#c62828',
    conselho:
      'Agravamento de sintomas respiratórios. Evite atividades ao ar livre.',
  },
  {
    nivel: 4,
    iMin: 201,
    iMax: 400,
    rotulo: 'Péssima',
    cor: '#6a1b9a',
    conselho: 'Risco sério à saúde de toda a população. Permaneça em ambientes fechados.',
  },
];

export const LEGENDA_CETESB = FAIXAS_CETESB.map((f) => ({
  ...f,
  faixa: f.nivel === 4 ? '> 200' : `${f.iMin}–${f.iMax}`,
}));

// Fator de conversão do CO: a API devolve µg/m³ e a CETESB usa ppm.
// ppm = µg/m³ × 24,45 / (28,01 × 1000)
export const CO_UGM3_POR_PPM = (28.01 * 1000) / 24.45;

// Poluentes do índice CETESB: limite superior de concentração de cada faixa
// (Boa, Moderada, Ruim, Muito ruim, Péssima) e janela da média em horas.
export const POLUENTES_CETESB = [
  { chave: 'mp10', nome: 'MP10', unidade: 'µg/m³', janela: 24, limites: [50, 100, 150, 250, 600] },
  { chave: 'mp25', nome: 'MP2,5', unidade: 'µg/m³', janela: 24, limites: [25, 50, 75, 125, 300] },
  { chave: 'o3', nome: 'O₃', unidade: 'µg/m³', janela: 8, limites: [100, 130, 160, 200, 800] },
  { chave: 'co', nome: 'CO', unidade: 'ppm', janela: 8, limites: [9, 11, 13, 15, 50] },
  { chave: 'no2', nome: 'NO₂', unidade: 'µg/m³', janela: 1, limites: [200, 240, 320, 1130, 3750] },
  { chave: 'so2', nome: 'SO₂', unidade: 'µg/m³', janela: 24, limites: [20, 40, 365, 800, 2620] },
];

export function faixaCetesb(indice) {
  if (semNumero(indice)) return SEM_DADO;
  return FAIXAS_CETESB.find((f) => indice <= f.iMax) || FAIXAS_CETESB[4];
}

// Converte uma concentração em índice CETESB por interpolação linear dentro
// da faixa: I = Iini + (Ifin - Iini) / (Cfin - Cini) × (C - Cini).
export function indicePoluente(conc, limites) {
  if (semNumero(conc)) return null;
  if (conc < 0) conc = 0;
  for (let k = 0; k < limites.length; k++) {
    if (conc <= limites[k]) {
      const f = FAIXAS_CETESB[k];
      const cIni = k === 0 ? 0 : limites[k - 1];
      const iIni = f.iMin;
      return Math.round(iIni + ((f.iMax - iIni) / (limites[k] - cIni)) * (conc - cIni));
    }
  }
  return 400;
}

// Média dos valores válidos dos últimos `janela` pontos até `fim` (inclusive).
export function mediaMovel(valores, fim, janela) {
  let soma = 0;
  let n = 0;
  for (let i = Math.max(0, fim - janela + 1); i <= fim; i++) {
    const v = valores[i];
    if (!semNumero(v)) {
      soma += v;
      n++;
    }
  }
  return n ? soma / n : null;
}

// Calcula o índice CETESB num horário da série horária. O índice final é o
// do pior poluente (poluente crítico), como faz a CETESB.
// serie: { mp10: [], mp25: [], o3: [], co: [] (µg/m³), no2: [], so2: [] }
export function indiceCetesb(serie, idx) {
  const porPoluente = POLUENTES_CETESB.map((p) => {
    let conc = mediaMovel(serie[p.chave] || [], idx, p.janela);
    if (p.chave === 'co' && conc !== null) conc = conc / CO_UGM3_POR_PPM;
    const indice = indicePoluente(conc, p.limites);
    return { chave: p.chave, nome: p.nome, unidade: p.unidade, janela: p.janela, conc, indice };
  });
  const validos = porPoluente.filter((p) => p.indice !== null);
  if (!validos.length) return { indice: null, faixa: SEM_DADO, critico: null, porPoluente };
  const critico = validos.reduce((a, b) => (b.indice > a.indice ? b : a));
  return { indice: critico.indice, faixa: faixaCetesb(critico.indice), critico, porPoluente };
}

// Índice e faixa de um ponto da série na escala escolhida.
export function indiceNaEscala(escala, serie, idx) {
  if (idx < 0 || idx >= serie.tempos.length) return { indice: null, faixa: SEM_DADO };
  if (escala === 'CETESB') {
    const c = indiceCetesb(serie, idx);
    return { indice: c.indice, faixa: c.faixa };
  }
  const aqi = serie.aqi ? serie.aqi[idx] : null;
  return { indice: semNumero(aqi) ? null : aqi, faixa: faixaDoIndice(aqi) };
}
