// Relatórios e estatísticas sobre a série horária (lógica pura).

import { indiceNaEscala, LEGENDA_CETESB, LEGENDA_EPA } from './indices';

export function legendaDaEscala(escala) {
  return escala === 'CETESB' ? LEGENDA_CETESB : LEGENDA_EPA;
}

// Índice de cada hora no intervalo [inicio, fim) na escala escolhida.
export function pontosDaSerie(serie, escala, inicio, fim) {
  const pontos = [];
  const a = Math.max(0, inicio);
  const b = Math.min(serie.tempos.length, fim);
  for (let i = a; i < b; i++) {
    const { indice, faixa } = indiceNaEscala(escala, serie, i);
    pontos.push({ idx: i, hora: serie.tempos[i], indice, faixa });
  }
  return pontos;
}

// Agrupa pontos horários por dia: média, máximo, mínimo e faixa do pior horário.
export function agruparPorDia(pontos) {
  const dias = [];
  const porDia = new Map();
  for (const p of pontos) {
    const dia = p.hora.slice(0, 10);
    if (!porDia.has(dia)) {
      const novo = { dia, valores: [], pior: null };
      porDia.set(dia, novo);
      dias.push(novo);
    }
    if (p.indice === null) continue;
    const d = porDia.get(dia);
    d.valores.push(p.indice);
    if (!d.pior || p.indice > d.pior.indice) d.pior = p;
  }
  return dias.map(({ dia, valores, pior }) => ({
    dia,
    horas: valores.length,
    media: valores.length ? Math.round(valores.reduce((s, v) => s + v, 0) / valores.length) : null,
    max: valores.length ? Math.max(...valores) : null,
    min: valores.length ? Math.min(...valores) : null,
    faixaPior: pior ? pior.faixa : null,
    horaPior: pior ? pior.hora : null,
  }));
}

// Quantas horas caíram em cada faixa da escala.
export function distribuicaoPorFaixa(pontos, escala) {
  const legenda = legendaDaEscala(escala);
  const contagem = legenda.map((f) => ({ ...f, horas: 0 }));
  let total = 0;
  for (const p of pontos) {
    if (p.faixa && p.faixa.nivel !== null && contagem[p.faixa.nivel]) {
      contagem[p.faixa.nivel].horas++;
      total++;
    }
  }
  return contagem.map((c) => ({ ...c, pct: total ? Math.round((c.horas / total) * 100) : 0 }));
}

// Resumo de um período: média geral, melhor e pior dia, horas ruins.
export function resumoPeriodo(pontos) {
  const validos = pontos.filter((p) => p.indice !== null);
  if (!validos.length) return null;
  const dias = agruparPorDia(validos).filter((d) => d.media !== null);
  const melhorDia = dias.reduce((a, b) => (b.media < a.media ? b : a));
  const piorDia = dias.reduce((a, b) => (b.media > a.media ? b : a));
  const pico = validos.reduce((a, b) => (b.indice > a.indice ? b : a));
  return {
    horas: validos.length,
    media: Math.round(validos.reduce((s, p) => s + p.indice, 0) / validos.length),
    melhorDia,
    piorDia,
    pico,
    horasAcimaDeModerado: validos.filter((p) => p.faixa.nivel >= 2).length,
  };
}

// Melhor horário para atividade ao ar livre nas próximas `horas`, só entre
// 6h e 20h (horário em que alguém faria exercício na rua).
export function melhorHorario(pontos) {
  const diurnos = pontos.filter((p) => {
    const h = Number(p.hora.slice(11, 13));
    return p.indice !== null && h >= 6 && h <= 20;
  });
  if (!diurnos.length) return null;
  return diurnos.reduce((a, b) => (b.indice < a.indice ? b : a));
}

// Tendência comparando o índice atual com o de daqui a `horas` horas.
export function tendencia(serie, escala, idx, horas = 3) {
  const agora = indiceNaEscala(escala, serie, idx).indice;
  const depois = indiceNaEscala(escala, serie, Math.min(idx + horas, serie.tempos.length - 1)).indice;
  if (agora === null || depois === null) return null;
  const diff = depois - agora;
  if (Math.abs(diff) < 5) return { direcao: 'estável', diff };
  return { direcao: diff > 0 ? 'piorando' : 'melhorando', diff };
}
