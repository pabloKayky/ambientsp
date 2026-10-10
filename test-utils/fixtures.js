// Respostas falsas no formato das APIs reais (Open-Meteo e INPE), com
// valores fixos para os testes poderem conferir números exatos.

function p2(n) {
  return String(n).padStart(2, '0');
}

// Horários "AAAA-MM-DDTHH:00" a partir de um dia, por `dias` dias.
export function horarios(inicio, dias) {
  const [a, m, d] = inicio.split('-').map(Number);
  const base = Date.UTC(a, m - 1, d);
  const lista = [];
  for (let i = 0; i < dias * 24; i++) {
    const t = new Date(base + i * 3600 * 1000);
    lista.push(`${t.getUTCFullYear()}-${p2(t.getUTCMonth() + 1)}-${p2(t.getUTCDate())}T${p2(t.getUTCHours())}:00`);
  }
  return lista;
}

function datas(inicio, dias) {
  return horarios(inicio, dias).filter((t) => t.endsWith('T00:00')).map((t) => t.slice(0, 10));
}

export const AGORA = '2026-10-09T15:00';

// Qualidade do ar: 7 dias antes + hoje + 2 dias, todos com o mesmo valor.
export function jsonAr({ aqi = 42, hora = AGORA, aqiHorario } = {}) {
  const time = horarios('2026-10-02', 10);
  const fill = (v) => time.map(() => v);
  return {
    latitude: -23.6,
    longitude: -46.6,
    elevation: 737,
    current: {
      time: hora,
      us_aqi: aqi,
      pm2_5: 9.1,
      pm10: 15.3,
      ozone: 50,
      nitrogen_dioxide: 20,
      carbon_monoxide: 300,
      sulphur_dioxide: 5,
      uv_index: 4.2,
    },
    hourly: {
      time,
      us_aqi: aqiHorario ? time.map(aqiHorario) : fill(aqi),
      pm2_5: fill(9.1),
      pm10: fill(15.3),
      ozone: fill(50),
      nitrogen_dioxide: fill(20),
      carbon_monoxide: fill(300),
      sulphur_dioxide: fill(5),
    },
  };
}

// Meteorologia (7 dias a partir de 09/10) com inversão: a ~230 m de altura
// está 3 °C mais quente que o solo. Chuva forte às 18h de hoje.
export function jsonClima({ inversao = true, chuvaForte = false, umidadeMin = 55 } = {}) {
  const time = horarios('2026-10-09', 7);
  const fill = (v) => time.map(() => v);
  const hora = (t) => Number(t.slice(11, 13));
  return {
    latitude: -23.55,
    longitude: -46.63,
    elevation: 760,
    current: {
      time: '2026-10-09T15:15',
      temperature_2m: 18,
      apparent_temperature: 19,
      relative_humidity_2m: 80,
      wind_speed_10m: 3,
      wind_direction_10m: 140,
      precipitation: 0,
      weather_code: 2,
      is_day: 1,
      uv_index: 4,
    },
    hourly: {
      time,
      temperature_2m: fill(18),
      apparent_temperature: fill(19),
      relative_humidity_2m: time.map((t) => (hora(t) === 14 ? umidadeMin : 70)),
      precipitation_probability: time.map((t) => (hora(t) === 18 ? 90 : 10)),
      precipitation: time.map((t) => (t === '2026-10-09T18:00' ? (chuvaForte ? 35 : 1) : 0)),
      weather_code: fill(2),
      uv_index: time.map((t) => (hora(t) === 12 ? 7 : 1)),
      wind_speed_10m: fill(3),
      boundary_layer_height: fill(100),
      temperature_900hPa: fill(inversao ? 21 : 14),
      temperature_850hPa: fill(inversao ? 19 : 11),
      temperature_800hPa: fill(inversao ? 15 : 8),
      is_day: time.map((t) => (hora(t) >= 6 && hora(t) < 18 ? 1 : 0)),
    },
    daily: {
      time: datas('2026-10-09', 7),
      weather_code: [2, 63, 95, 1, 0, 3, 61],
      temperature_2m_max: [27, 25, 24, 28, 30, 26, 23],
      temperature_2m_min: [17, 16, 15, 17, 18, 16, 15],
      precipitation_sum: [1, 12, 30, 0, 0, 2, 8],
      precipitation_probability_max: [90, 80, 95, 10, 5, 30, 70],
      uv_index_max: [7, 5, 4, 8, 9, 6, 5],
      sunrise: datas('2026-10-09', 7).map((d) => d + 'T05:40'),
      sunset: datas('2026-10-09', 7).map((d) => d + 'T18:10'),
      wind_speed_10m_max: [10, 12, 20, 8, 7, 9, 11],
    },
  };
}

// Grade meteorológica do mapa: chuva cresce para o leste.
export function jsonGradeClima(n) {
  const time = horarios('2026-10-09', 2);
  return Array.from({ length: n }, (_, i) => ({
    current: { time: '2026-10-09T15:15', temperature_2m: 20 },
    hourly: { time, precipitation: time.map(() => (i % 8) * 0.5), temperature_2m: time.map(() => 18 + (i % 8)) },
  }));
}

// Rio: 7 dias de histórico ~100 m³/s e previsão subindo para 250 m³/s.
export function jsonRio({ pico = 250 } = {}) {
  const time = datas('2026-10-02', 14);
  const vazao = time.map((_, k) => (k < 7 ? 100 : k === 8 ? pico : 110));
  return {
    daily: {
      time,
      river_discharge: vazao,
      river_discharge_mean: time.map(() => 100),
      river_discharge_max: vazao,
    },
  };
}

export function jsonBusca() {
  return {
    results: [
      { id: 3447399, name: 'Sorocaba', latitude: -23.50167, longitude: -47.45806, admin1: 'São Paulo', admin2: 'Sorocaba' },
    ],
  };
}

// CSV de focos: um a 20 km de São Paulo, outro a ~120 km, outro longe.
export const CSV_FOCOS = [
  'lat,lon,satelite,data',
  ' -23.60, -46.45,GOES-19,2026-10-09 17:50:00',
  ' -22.90, -47.50,GOES-19,2026-10-09 17:50:00',
  ' -10.00, -60.00,GOES-19,2026-10-09 17:50:00',
].join('\n');

export function resposta(corpo, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(corpo),
    text: () => Promise.resolve(typeof corpo === 'string' ? corpo : JSON.stringify(corpo)),
  });
}

const N_GRADE = 64;

// fetch falso que responde conforme o servidor da URL. Cada fonte pode ser
// trocada para simular falhas: ar, clima, regioes, grade, gradeClima, rio,
// busca, queimadas.
export function roteador({
  ar = () => resposta(jsonAr()),
  clima = () => resposta(jsonClima()),
  rio = () => resposta(jsonRio()),
  busca = () => resposta(jsonBusca()),
  queimadas = () => resposta(CSV_FOCOS),
  regioes,
  grade,
  gradeClima,
} = {}) {
  return jest.fn((url) => {
    if (url.includes('dataserver-coids.inpe.br')) return queimadas(url);
    if (url.includes('geocoding-api')) return busca(url);
    if (url.includes('flood-api')) return rio(url);
    const n = (url.match(/latitude=([^&]*)/) || ['', ''])[1].split(',').length;
    if (url.includes('/forecast')) {
      if (n > 1) return gradeClima ? gradeClima(url) : resposta(jsonGradeClima(n));
      return clima(url);
    }
    if (n > 1) {
      if (n === N_GRADE && grade) return grade(url);
      if (n !== N_GRADE && regioes) return regioes(url);
      return resposta(Array.from({ length: n }, (_, i) => jsonAr({ aqi: 20 + i * 15 })));
    }
    return ar(url);
  });
}

export const semRede = () => Promise.reject(new TypeError('Network request failed'));
