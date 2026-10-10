// Testes da lógica pura: escalas EPA e CETESB, parse, inversão e relatórios.

import { extrairIndice, faixaDoIndice } from '../App';
import { dataCurta, diaDaSemana, horaCurta, numero } from '../src/logica/formato';
import {
  faixaCetesb,
  indiceCetesb,
  indicePoluente,
  mediaMovel,
  POLUENTES_CETESB,
} from '../src/logica/indices';
import {
  analisarInversao,
  avaliarDispersao,
  diagnosticoHora,
  inversoesAFrente,
  perfilVertical,
} from '../src/logica/inversao';
import {
  extrairAtual,
  indiceDaHora,
  interpretarAr,
  interpretarClima,
  interpretarRegioes,
} from '../src/logica/parse';
import {
  agruparPorDia,
  distribuicaoPorFaixa,
  melhorHorario,
  pontosDaSerie,
  resumoPeriodo,
  tendencia,
} from '../src/logica/relatorio';
import { AGORA, jsonAr, jsonClima } from '../test-utils/fixtures';

// =============================================================================
// Escala EPA
// =============================================================================

describe('faixaDoIndice (EPA)', () => {
  test.each([
    [0, 'Bom', '#2e7d32'],
    [50, 'Bom', '#2e7d32'],
    [51, 'Moderado', '#f9a825'],
    [100, 'Moderado', '#f9a825'],
    [101, 'Insalubre p/ sensíveis', '#ef6c00'],
    [150, 'Insalubre p/ sensíveis', '#ef6c00'],
    [151, 'Insalubre', '#c62828'],
    [300, 'Insalubre', '#c62828'],
  ])('aqi %p -> %s', (aqi, rotulo, cor) => {
    expect(faixaDoIndice(aqi)).toMatchObject({ rotulo, cor });
  });

  test.each([[null], [undefined], [NaN]])('aqi %p -> Sem dado (cinza)', (aqi) => {
    expect(faixaDoIndice(aqi)).toMatchObject({ rotulo: 'Sem dado', cor: '#607d8b', nivel: null });
  });

  test('toda faixa tem conselho de saúde', () => {
    [0, 75, 120, 200, null].forEach((v) => expect(faixaDoIndice(v).conselho).toBeTruthy());
  });
});

// =============================================================================
// Escala CETESB
// =============================================================================

describe('CETESB', () => {
  const MP10 = POLUENTES_CETESB.find((p) => p.chave === 'mp10').limites;

  test.each([
    [0, 0],
    [50, 40], // topo da faixa Boa
    [100, 80], // topo da Moderada
    [150, 120],
    [250, 200],
    [75, 61], // meio da Moderada: 41 + 39/50 × 25 = 60,5 -> 61
    [1000, 400], // acima de tudo
  ])('MP10 %p µg/m³ -> índice %p', (conc, esperado) => {
    expect(indicePoluente(conc, MP10)).toBe(esperado);
  });

  test('concentração ausente -> null', () => {
    expect(indicePoluente(null, MP10)).toBeNull();
  });

  test.each([
    [40, 'Boa'],
    [41, 'Moderada'],
    [81, 'Ruim'],
    [150, 'Muito ruim'],
    [250, 'Péssima'],
  ])('índice %p -> %s', (i, rotulo) => {
    expect(faixaCetesb(i).rotulo).toBe(rotulo);
  });

  test('média móvel ignora buracos (null)', () => {
    expect(mediaMovel([10, null, 20, 30], 3, 3)).toBe(25);
    expect(mediaMovel([10, 20], 0, 24)).toBe(10);
    expect(mediaMovel([null, null], 1, 2)).toBeNull();
  });

  test('índice final é o do poluente crítico (pior)', () => {
    const { serie, idxAgora } = interpretarAr(jsonAr());
    const r = indiceCetesb(serie, idxAgora);
    // O₃ 50 µg/m³ -> 20 é o maior (MP2,5 9,1 -> 15; MP10 15,3 -> 12)
    expect(r.indice).toBe(20);
    expect(r.critico.nome).toBe('O₃');
    expect(r.faixa.rotulo).toBe('Boa');
    expect(r.porPoluente.find((p) => p.chave === 'mp25').indice).toBe(15);
  });

  test('CO é convertido de µg/m³ para ppm', () => {
    const { serie, idxAgora } = interpretarAr(jsonAr());
    const co = indiceCetesb(serie, idxAgora).porPoluente.find((p) => p.chave === 'co');
    expect(co.conc).toBeCloseTo(0.262, 2);
  });

  test('sem nenhuma concentração -> Sem dado', () => {
    const r = indiceCetesb({ mp10: [null], mp25: [], o3: [], co: [], no2: [], so2: [] }, 0);
    expect(r.indice).toBeNull();
    expect(r.faixa.rotulo).toBe('Sem dado');
  });
});

// =============================================================================
// Parse das respostas
// =============================================================================

describe('extrairIndice', () => {
  test('resposta válida devolve índice, poluentes e hora', () => {
    const json = {
      current: { time: '2026-10-09T15:00', us_aqi: 57, pm2_5: 14.2, pm10: 22.8 },
    };
    expect(extrairIndice(json)).toEqual({ aqi: 57, pm25: 14.2, pm10: 22.8, hora: '2026-10-09T15:00' });
  });

  test('us_aqi = 0 é válido (não confundir com ausente)', () => {
    expect(extrairIndice({ current: { us_aqi: 0 } }).aqi).toBe(0);
  });

  test.each([
    ['us_aqi null', { current: { us_aqi: null } }],
    ['us_aqi ausente', { current: { pm10: 10 } }],
    ['sem current', {}],
    ['json null', null],
  ])('%s estoura erro', (_, json) => {
    expect(() => extrairIndice(json)).toThrow(/sem o índice/);
  });

  test('API com error:true estoura erro com o motivo', () => {
    expect(() => extrairIndice({ error: true, reason: 'Latitude inválida' })).toThrow(
      /recusou.*Latitude inválida/,
    );
  });
});

describe('interpretar respostas completas', () => {
  test('extrairAtual traz todos os poluentes', () => {
    expect(extrairAtual(jsonAr())).toMatchObject({ aqi: 42, o3: 50, no2: 20, co: 300, so2: 5, uv: 4.2 });
  });

  test('interpretarAr acha a hora atual na série', () => {
    const r = interpretarAr(jsonAr());
    expect(r.serie.tempos[r.idxAgora]).toBe(AGORA);
    expect(r.serie.aqi).toHaveLength(240);
  });

  test('série ausente estoura erro', () => {
    const json = jsonAr();
    delete json.hourly;
    expect(() => interpretarAr(json)).toThrow(/série horária/);
  });

  test('indiceDaHora usa o último horário <= agora', () => {
    const t = ['2026-10-09T14:00', '2026-10-09T15:00', '2026-10-09T16:00'];
    expect(indiceDaHora(t, '2026-10-09T15:30')).toBe(1);
    expect(indiceDaHora(t, '2026-10-09T13:00')).toBe(-1);
    expect(indiceDaHora([], 'x')).toBe(-1);
  });

  test('interpretarClima lê tempo atual e perfil', () => {
    const c = interpretarClima(jsonClima());
    expect(c.atual).toMatchObject({ temperatura: 18, umidade: 80, vento: 3 });
    expect(c.elevacao).toBe(760);
    expect(c.serie.tempos[c.idxAgora]).toBe('2026-10-09T15:00');
  });

  test('regiões: um local sem dado não derruba os outros', () => {
    const locais = [{ id: 'a' }, { id: 'b' }];
    const r = interpretarRegioes([jsonAr({ aqi: 30 }), jsonAr({ aqi: null })], locais);
    expect(r[0].ar.atual.aqi).toBe(30);
    expect(r[1].ar).toBeNull();
  });

  test('regiões: resposta com quantidade errada estoura erro', () => {
    expect(() => interpretarRegioes([jsonAr()], [{ id: 'a' }, { id: 'b' }])).toThrow(/incompleta/);
  });
});

// =============================================================================
// Inversão térmica
// =============================================================================

describe('inversão térmica', () => {
  test('ar mais quente acima do solo = inversão forte', () => {
    const r = analisarInversao([
      { altura: 2, temperatura: 18 },
      { altura: 230, temperatura: 21 },
      { altura: 700, temperatura: 19 },
    ]);
    expect(r).toMatchObject({ temInversao: true, intensidade: 3, topo: 230, nivel: 'Forte' });
  });

  test('temperatura caindo com a altura = sem inversão', () => {
    const r = analisarInversao([
      { altura: 2, temperatura: 25 },
      { altura: 230, temperatura: 22 },
      { altura: 700, temperatura: 19 },
    ]);
    expect(r).toMatchObject({ temInversao: false, nivel: 'Ausente', topo: null });
  });

  test.each([
    [0.5, 'Fraca'],
    [1.5, 'Moderada'],
    [3.2, 'Forte'],
  ])('intensidade %p °C -> %s', (delta, nivel) => {
    const r = analisarInversao([
      { altura: 2, temperatura: 20 },
      { altura: 230, temperatura: 20 + delta },
    ]);
    expect(r.nivel).toBe(nivel);
  });

  test('perfil insuficiente -> Sem dado', () => {
    expect(analisarInversao([{ altura: 2, temperatura: 20 }]).conhecida).toBe(false);
  });

  test('perfil descarta níveis abaixo do relevo e valores nulos', () => {
    const serie = { t2m: [20], t900: [22], t850: [null], t800: [15] };
    // Elevação 1000 m: o nível de 900 hPa (~990 m) fica abaixo do solo.
    const p = perfilVertical(serie, 0, 1000);
    expect(p.map((x) => x.nivel)).toEqual(['Solo (2 m)', '800 hPa']);
  });

  test('dispersão desfavorável com inversão + vento fraco + camada baixa', () => {
    const d = avaliarDispersao({
      inversao: { temInversao: true, intensidade: 3 },
      vento: 3,
      camadaLimite: 100,
    });
    expect(d.condicao).toBe('Desfavorável');
    expect(d.motivos).toEqual(['inversão térmica', 'vento fraco', 'camada de mistura baixa']);
  });

  test('dispersão favorável sem inversão e com vento', () => {
    const d = avaliarDispersao({ inversao: { temInversao: false }, vento: 20, camadaLimite: 1500 });
    expect(d.condicao).toBe('Favorável');
  });

  test('diagnóstico e previsão a partir da resposta da API', () => {
    const clima = interpretarClima(jsonClima());
    expect(diagnosticoHora(clima, clima.idxAgora).inversao.nivel).toBe('Forte');
    const prox = inversoesAFrente(clima, clima.idxAgora, 24);
    expect(prox).toHaveLength(24);
    expect(prox.every((h) => h.temInversao)).toBe(true);
    const semInv = interpretarClima(jsonClima({ inversao: false }));
    expect(diagnosticoHora(semInv, semInv.idxAgora).inversao.temInversao).toBe(false);
  });
});

// =============================================================================
// Relatórios
// =============================================================================

describe('relatórios', () => {
  // Índice = hora do dia × 5 (0 à meia-noite, 115 às 23h).
  const ar = interpretarAr(jsonAr({ aqiHorario: (t) => Number(t.slice(11, 13)) * 5 }));
  const pontos = pontosDaSerie(ar.serie, 'EPA', 0, 48);

  test('agrupa por dia com média, máx e mín', () => {
    const dias = agruparPorDia(pontos);
    expect(dias).toHaveLength(2);
    expect(dias[0]).toMatchObject({ dia: '2026-10-02', horas: 24, min: 0, max: 115, media: 58 });
    expect(dias[0].faixaPior.rotulo).toBe('Insalubre p/ sensíveis');
  });

  test('distribuição por faixa soma 100%', () => {
    const d = distribuicaoPorFaixa(pontos, 'EPA');
    expect(d.map((f) => f.horas)).toEqual([22, 20, 6, 0]);
    expect(d.reduce((s, f) => s + f.horas, 0)).toBe(48);
  });

  test('resumo do período', () => {
    const r = resumoPeriodo(pontos);
    expect(r.media).toBe(58);
    expect(r.pico.indice).toBe(115);
    expect(r.horasAcimaDeModerado).toBe(6);
  });

  test('resumo sem dados -> null', () => {
    expect(resumoPeriodo([{ hora: AGORA, indice: null, faixa: {} }])).toBeNull();
  });

  test('melhor horário só considera 6h–20h', () => {
    const m = melhorHorario(pontosDaSerie(ar.serie, 'EPA', 0, 24));
    expect(m.hora.slice(11, 16)).toBe('06:00');
  });

  test('tendência compara com 3 horas depois', () => {
    const idx = ar.serie.tempos.indexOf('2026-10-09T10:00');
    expect(tendencia(ar.serie, 'EPA', idx, 3)).toEqual({ direcao: 'piorando', diff: 15 });
    const idx2 = ar.serie.tempos.indexOf('2026-10-09T22:00');
    expect(tendencia(ar.serie, 'EPA', idx2, 3).direcao).toBe('melhorando');
  });

  test('relatório também funciona na escala CETESB', () => {
    const p = pontosDaSerie(ar.serie, 'CETESB', 30, 40);
    expect(p.every((x) => x.indice === 20)).toBe(true);
  });
});

// =============================================================================
// Formatação
// =============================================================================

describe('formatação', () => {
  test('datas e números', () => {
    expect(horaCurta('2026-10-09T15:00')).toBe('15:00');
    expect(horaCurta(null)).toBe('—');
    expect(dataCurta('2026-10-09')).toBe('09/10');
    expect(diaDaSemana('2026-10-09')).toBe('sex');
    expect(numero(14.25)).toBe('14,3');
    expect(numero(null)).toBe('—');
  });
});

// =============================================================================
// Mapa
// =============================================================================

describe('mapa', () => {
  const {
    corHex,
    corNaRampa,
    gradeDePontos,
    horaDoDeslocamento,
    interpolar,
    rampaDaCamada,
    rasterizar,
    resumoDaGrade,
    valoresDaCamada,
    valoresNaHora,
  } = require('../src/logica/mapa');
  const { MAPA } = require('../src/config');
  const { interpretarGradeClima } = require('../src/logica/parse');
  const { jsonGradeClima } = require('../test-utils/fixtures');

  test('grade 8 × 8 cobre a área inteira', () => {
    const g = gradeDePontos(MAPA);
    expect(g).toHaveLength(64);
    expect(g[0]).toMatchObject({ lat: MAPA.latMin, lon: MAPA.lonMin });
    expect(g[63]).toMatchObject({ lat: MAPA.latMax, lon: MAPA.lonMax });
    expect(new Set(g.map((p) => p.id)).size).toBe(64);
  });

  test('interpolação: no ponto vale o próprio valor; no meio, a média', () => {
    const pontos = [
      { lat: 0, lon: 0, v: 20 },
      { lat: 0, lon: 2, v: 100 },
    ];
    expect(interpolar(pontos, 0, 0)).toBe(20);
    expect(interpolar(pontos, 0, 1)).toBeCloseTo(60);
    expect(interpolar(pontos, 0, 0.2)).toBeLessThan(25);
    expect(interpolar([{ lat: 0, lon: 0, v: null }], 0, 0)).toBeNull();
  });

  test('raster n × n com norte na primeira linha', () => {
    const pontos = [
      { lat: MAPA.latMax, lon: -46.6, v: 150 },
      { lat: MAPA.latMin, lon: -46.6, v: 10 },
    ];
    const r = rasterizar(pontos, MAPA, 10);
    expect(r.valores).toHaveLength(100);
    expect(r.valores[5]).toBeGreaterThan(r.valores[95]);
  });

  test('valores de ar numa hora futura e fora da série', () => {
    const itens = [
      {
        local: { id: 'a', nome: 'A', lat: 0, lon: 0 },
        ar: interpretarAr(jsonAr({ aqiHorario: (t) => Number(t.slice(11, 13)) })),
      },
    ];
    expect(valoresNaHora(itens, 'EPA', 0)[0].v).toBe(15);
    expect(valoresNaHora(itens, 'EPA', 3)[0].v).toBe(18);
    expect(valoresNaHora(itens, 'EPA', 9999)[0].v).toBeNull();
    expect(horaDoDeslocamento(itens, 6)).toBe('2026-10-09T21:00');
  });

  test('camadas de chuva e temperatura vêm da grade meteorológica', () => {
    const pontos = [0, 1, 2].map((i) => ({ id: 'p' + i, nome: 'P' + i, lat: 0, lon: i }));
    const grade = interpretarGradeClima(jsonGradeClima(3), pontos);
    expect(valoresDaCamada(grade, 'chuva', 'EPA', 0).map((p) => p.v)).toEqual([0, 0.5, 1]);
    expect(valoresDaCamada(grade, 'temperatura', 'EPA', 2).map((p) => p.v)).toEqual([18, 19, 20]);
    expect(horaDoDeslocamento(grade, 1)).toBe('2026-10-09T16:00');
  });

  test('rampa de cores mistura as cores vizinhas', () => {
    const rampa = [
      { v: 0, cor: '#000000', a: 0 },
      { v: 10, cor: '#ffffff', a: 1 },
    ];
    expect(corNaRampa(5, rampa)).toEqual({ rgb: [128, 128, 128], a: 0.5 });
    expect(corNaRampa(-1, rampa).a).toBe(0);
    expect(corNaRampa(99, rampa).rgb).toEqual([255, 255, 255]);
    expect(corNaRampa(null, rampa)).toBeNull();
    expect(corHex(10, rampa)).toBe('#ffffff');
    expect(corHex(null, rampa)).toBe('#98a2b3');
  });

  test('rampas existem para as camadas com mancha', () => {
    ['ar', 'chuva', 'temperatura'].forEach((c) => expect(rampaDaCamada(c, 'EPA').length).toBeGreaterThan(3));
    expect(rampaDaCamada('ar', 'CETESB')[0].v).toBe(20);
    expect(rampaDaCamada('queimadas', 'EPA')).toEqual([]);
    expect(rampaDaCamada('chuva', 'EPA')[0].a).toBe(0); // sem chuva = transparente
  });

  test('resumo da grade', () => {
    expect(resumoDaGrade([{ v: 10 }, { v: 30 }, { v: null }])).toEqual({ pontos: 2, media: 20, min: 10, max: 30 });
    expect(resumoDaGrade([{ v: null }])).toBeNull();
  });
});

// =============================================================================
// Tempo, rios, busca e queimadas
// =============================================================================

describe('tempo, rios, busca e queimadas', () => {
  const { descreverTempo, direcaoVento, nivelUV } = require('../src/logica/tempo');
  const {
    distanciaKm,
    focosProximos,
    interpretarBusca,
    interpretarFocos,
    interpretarRio,
  } = require('../src/logica/parse');
  const { CSV_FOCOS, jsonBusca, jsonRio } = require('../test-utils/fixtures');

  test('códigos de tempo da OMM', () => {
    expect(descreverTempo(0, true)).toEqual({ texto: 'Céu limpo', icone: 'sunny' });
    expect(descreverTempo(0, false).icone).toBe('moon');
    expect(descreverTempo(95).texto).toBe('Tempestade');
    expect(descreverTempo(1234).texto).toBe('—');
  });

  test('direção do vento e UV', () => {
    expect(direcaoVento(0)).toBe('N');
    expect(direcaoVento(135)).toBe('SE');
    expect(direcaoVento(359)).toBe('N');
    expect(direcaoVento(null)).toBe('');
    expect(nivelUV(2).rotulo).toBe('Baixo');
    expect(nivelUV(7).rotulo).toBe('Alto');
    expect(nivelUV(11).rotulo).toBe('Extremo');
  });

  test('clima completo traz previsão diária', () => {
    const c = interpretarClima(jsonClima());
    expect(c.dias).toHaveLength(7);
    expect(c.dias[0]).toMatchObject({ data: '2026-10-09', max: 27, min: 17, nascer: '2026-10-09T05:40' });
    expect(c.atual).toMatchObject({ sensacao: 19, codigo: 2, dia: true, uv: 4 });
    expect(c.serie.tempos).toHaveLength(168);
  });

  test('rio: separa histórico e previsão', () => {
    const r = interpretarRio(jsonRio(), 7);
    expect(r.dias).toHaveLength(14);
    expect(r.hoje).toBe(7);
    expect(() => interpretarRio({ daily: { time: ['x'], river_discharge: [null] } })).toThrow(/Sem dados de rio/);
    expect(() => interpretarRio({})).toThrow(/Sem dados de rio/);
  });

  test('busca de cidades', () => {
    expect(interpretarBusca(jsonBusca())).toEqual([
      { id: 'geo-3447399', nome: 'Sorocaba', regiao: 'São Paulo', lat: -23.50167, lon: -47.45806 },
    ]);
    expect(interpretarBusca({})).toEqual([]);
  });

  test('focos de queimada: lê vários CSV e remove repetidos', () => {
    const focos = interpretarFocos([CSV_FOCOS, CSV_FOCOS, null, 'lixo']);
    expect(focos).toHaveLength(3);
    expect(focos[0]).toMatchObject({ lat: -23.6, lon: -46.45, satelite: 'GOES-19' });
  });

  test('distância e focos próximos', () => {
    expect(distanciaKm({ lat: -23.55, lon: -46.63 }, { lat: -22.91, lon: -47.06 })).toBeCloseTo(84, 0);
    const perto = focosProximos(interpretarFocos([CSV_FOCOS]), { lat: -23.55, lon: -46.63 }, 150);
    expect(perto).toHaveLength(2);
    expect(perto[0].distancia).toBeLessThan(perto[1].distancia);
  });
});

// =============================================================================
// Riscos e recomendações
// =============================================================================

describe('riscos e recomendações', () => {
  const {
    avaliarRiscos,
    recomendacoes,
    riscoAr,
    riscoCalor,
    riscoChuva,
    riscoInversao,
    riscoQueimadas,
    riscoRio,
    riscoUmidade,
  } = require('../src/logica/riscos');
  const { interpretarFocos, interpretarRio } = require('../src/logica/parse');
  const { CSV_FOCOS, jsonRio } = require('../test-utils/fixtures');
  const SP = { lat: -23.55, lon: -46.63 };

  test('ar: nível acompanha a faixa', () => {
    expect(riscoAr(interpretarAr(jsonAr({ aqi: 42 })), 'EPA')).toMatchObject({ nivel: 0, rotulo: 'Baixo' });
    expect(riscoAr(interpretarAr(jsonAr({ aqi: 160 })), 'EPA')).toMatchObject({ nivel: 3 });
    expect(riscoAr(null, 'EPA')).toBeNull();
  });

  test('inversão forte = nível 3', () => {
    expect(riscoInversao(interpretarClima(jsonClima()))).toMatchObject({ nivel: 3, horas: 24 });
    expect(riscoInversao(interpretarClima(jsonClima({ inversao: false })))).toMatchObject({ nivel: 0 });
  });

  test('chuva: 35 mm/h = muito alto; chuva fraca com chance alta = moderado', () => {
    expect(riscoChuva(interpretarClima(jsonClima({ chuvaForte: true })))).toMatchObject({ nivel: 3 });
    expect(riscoChuva(interpretarClima(jsonClima()))).toMatchObject({ nivel: 1, probMax: 90 });
  });

  test('rio: pico 2,5× a vazão típica = alto', () => {
    expect(riscoRio(interpretarRio(jsonRio({ pico: 250 })))).toMatchObject({ nivel: 2, tipica: 100, pico: 250 });
    expect(riscoRio(interpretarRio(jsonRio({ pico: 110 })))).toMatchObject({ nivel: 0 });
    expect(riscoRio(null)).toBeNull();
  });

  test.each([
    [55, 0],
    [25, 1],
    [15, 2],
    [10, 3],
  ])('umidade mínima %p%% -> nível %p (Defesa Civil)', (umid, nivel) => {
    expect(riscoUmidade(interpretarClima(jsonClima({ umidadeMin: umid }))).nivel).toBe(nivel);
  });

  test('calor/UV: UV 7 = alto', () => {
    expect(riscoCalor(interpretarClima(jsonClima()))).toMatchObject({ nivel: 2, uvMax: 7 });
  });

  test('queimadas: foco a 20 km = alto', () => {
    const focos = interpretarFocos([CSV_FOCOS]);
    expect(riscoQueimadas(focos, SP, 150)).toMatchObject({ nivel: 2 });
    expect(riscoQueimadas([], SP, 150)).toMatchObject({ nivel: 0 });
    expect(riscoQueimadas(null, SP, 150)).toBeNull();
  });

  test('avaliarRiscos ordena do mais grave e ignora fontes ausentes', () => {
    const base = { local: SP, escala: 'EPA', raioKm: 150 };
    const lista = avaliarRiscos({ ...base, ar: interpretarAr(jsonAr()), clima: null, rio: null, focos: null });
    expect(lista.map((r) => r.id)).toEqual(['ar']);
    const todos = avaliarRiscos({
      ...base,
      ar: interpretarAr(jsonAr()),
      clima: interpretarClima(jsonClima()),
      rio: interpretarRio(jsonRio()),
      focos: interpretarFocos([CSV_FOCOS]),
    });
    expect(todos).toHaveLength(7);
    for (let i = 1; i < todos.length; i++) expect(todos[i - 1].nivel).toBeGreaterThanOrEqual(todos[i].nivel);
  });

  test('recomendações mudam com a gravidade e com o tempo', () => {
    const ids = (g, clima) => recomendacoes({ gravidade: g, clima }).map((r) => r.id);
    expect(ids(0, null)).toEqual(['exercicio', 'janelas', 'sensiveis']);
    expect(ids(3, null)).toContain('mascara');
    expect(recomendacoes({ gravidade: 3, clima: null })[0].tom).toBe('evite');
    // A partir das 8h, as próximas 12 horas pegam o UV do meio-dia, o ar seco
    // das 14h e a chuva das 18h.
    const clima = interpretarClima(jsonClima({ umidadeMin: 20 }));
    clima.idxAgora = clima.serie.tempos.indexOf('2026-10-09T08:00');
    const comTempo = ids(0, clima);
    expect(comTempo).toEqual(expect.arrayContaining(['guarda-chuva', 'protetor', 'agua']));
  });
});
