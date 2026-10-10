// Servidor falso (mock) para desenvolver sem internet. Gera respostas no
// MESMO formato das APIs reais (Open-Meteo e INPE), com valores que variam
// ao longo do dia e de lugar para lugar.

function p2(n) {
  return String(n).padStart(2, '0');
}

function isoLocal(d) {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:00`;
}

function dataLocal(d) {
  return isoLocal(d).slice(0, 10);
}

// Horários de (hoje - diasAntes) 00:00 até (hoje + diasDepois - 1) 23:00.
function horas(diasAntes, diasDepois) {
  const inicio = new Date();
  inicio.setHours(0, 0, 0, 0);
  inicio.setDate(inicio.getDate() - diasAntes);
  const lista = [];
  for (let i = 0; i < (diasAntes + diasDepois) * 24; i++) {
    const d = new Date(inicio);
    d.setHours(i);
    lista.push(isoLocal(d));
  }
  return lista;
}

function dias(diasAntes, diasDepois) {
  const lista = [];
  for (let i = -diasAntes; i < diasDepois; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    lista.push(dataLocal(d));
  }
  return lista;
}

function param(url, nome) {
  const m = url.match(new RegExp('[?&]' + nome + '=([^&]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

const r1 = (v) => Math.round(v * 10) / 10;
const hora = (t) => Number(t.slice(11, 13));

// --- Qualidade do ar: pico de manhã e à noite (trânsito) ------------------
function respostaAr(lat, lon, diasAntes, diasDepois) {
  const semente = lat * 7 + lon * 3;
  const tempos = horas(diasAntes, diasDepois);
  const s = { aqi: [], mp25: [], mp10: [], o3: [], no2: [], co: [], so2: [] };
  tempos.forEach((t, i) => {
    const h = hora(t);
    const dia = Math.floor(i / 24);
    const transito = Math.exp(-((h - 8) ** 2) / 6) + 0.8 * Math.exp(-((h - 19) ** 2) / 8);
    const urbano = Math.exp(-((lat + 23.55) ** 2 + (lon + 46.63) ** 2) / 0.08);
    const base = 10 + 8 * Math.sin(dia * 1.3 + semente) + (14 + 18 * urbano) * transito + 10 * urbano;
    s.mp25.push(r1(Math.max(3, base)));
    s.mp10.push(r1(Math.max(5, base * 1.5)));
    s.o3.push(r1(30 + 70 * Math.max(0, Math.sin(((h - 7) / 12) * Math.PI))));
    s.no2.push(r1(15 + 50 * transito * (0.5 + urbano)));
    s.co.push(r1(250 + 500 * transito));
    s.so2.push(r1(4 + 3 * transito));
    s.aqi.push(Math.round(Math.min(190, base * 2.6)));
  });
  const agora = isoLocal(new Date());
  const i = Math.max(0, tempos.indexOf(agora));
  return {
    latitude: lat,
    longitude: lon,
    elevation: 760,
    current: {
      time: agora,
      us_aqi: s.aqi[i],
      pm2_5: s.mp25[i],
      pm10: s.mp10[i],
      ozone: s.o3[i],
      nitrogen_dioxide: s.no2[i],
      carbon_monoxide: s.co[i],
      sulphur_dioxide: s.so2[i],
      uv_index: 0,
    },
    hourly: {
      time: tempos,
      us_aqi: s.aqi,
      pm2_5: s.mp25,
      pm10: s.mp10,
      ozone: s.o3,
      nitrogen_dioxide: s.no2,
      carbon_monoxide: s.co,
      sulphur_dioxide: s.so2,
    },
  };
}

// --- Meteorologia: inversão de madrugada, chuva no fim da tarde ----------
function respostaClima(lat, lon, completo) {
  const tempos = horas(0, completo ? 7 : 2);
  const sol = (t) => Math.max(0, Math.sin(((hora(t) - 6) / 12) * Math.PI));
  const chuva = (t, i) => {
    const h = hora(t);
    const dia = Math.floor(i / 24);
    return h >= 16 && h <= 19 && dia % 2 === 0 ? r1(2 + 6 * Math.exp(-((lon + 46.6) ** 2) / 0.2)) : 0;
  };
  const hourly = {
    time: tempos,
    temperature_2m: tempos.map((t) => r1(16 + 10 * sol(t) - (lat + 23.5) * 2)),
    precipitation: tempos.map(chuva),
  };
  const agora = isoLocal(new Date());
  const i = Math.max(0, tempos.indexOf(agora));
  if (!completo) {
    return { latitude: lat, longitude: lon, current: { time: agora, temperature_2m: hourly.temperature_2m[i] }, hourly };
  }
  Object.assign(hourly, {
    apparent_temperature: hourly.temperature_2m.map((v) => r1(v + 1.5)),
    relative_humidity_2m: tempos.map((t) => Math.round(85 - 45 * sol(t))),
    precipitation_probability: tempos.map((t, k) => (chuva(t, k) > 0 ? 80 : 15)),
    weather_code: tempos.map((t, k) => (chuva(t, k) > 0 ? 63 : sol(t) > 0.3 ? 1 : 2)),
    uv_index: tempos.map((t) => r1(9 * sol(t))),
    wind_speed_10m: tempos.map((t) => r1(4 + 8 * sol(t))),
    boundary_layer_height: tempos.map((t) => Math.round(80 + 1400 * sol(t))),
    temperature_900hPa: tempos.map((t) => r1(20 + 2 * sol(t))),
    temperature_850hPa: tempos.map((t) => r1(17 + 2 * sol(t))),
    temperature_800hPa: tempos.map((t) => r1(14 + 2 * sol(t))),
    is_day: tempos.map((t) => (hora(t) >= 6 && hora(t) < 18 ? 1 : 0)),
  });
  const ds = dias(0, 7);
  return {
    latitude: lat,
    longitude: lon,
    elevation: 760,
    current: {
      time: agora,
      temperature_2m: hourly.temperature_2m[i],
      apparent_temperature: hourly.apparent_temperature[i],
      relative_humidity_2m: hourly.relative_humidity_2m[i],
      wind_speed_10m: hourly.wind_speed_10m[i],
      wind_direction_10m: 140,
      precipitation: hourly.precipitation[i],
      weather_code: hourly.weather_code[i],
      is_day: hourly.is_day[i],
      uv_index: hourly.uv_index[i],
    },
    hourly,
    daily: {
      time: ds,
      weather_code: ds.map((_, k) => (k % 2 === 0 ? 63 : 2)),
      temperature_2m_max: ds.map((_, k) => 26 + (k % 3)),
      temperature_2m_min: ds.map((_, k) => 16 + (k % 2)),
      precipitation_sum: ds.map((_, k) => (k % 2 === 0 ? 12 : 0)),
      precipitation_probability_max: ds.map((_, k) => (k % 2 === 0 ? 80 : 15)),
      uv_index_max: ds.map(() => 9),
      sunrise: ds.map((d) => d + 'T05:40'),
      sunset: ds.map((d) => d + 'T18:10'),
      wind_speed_10m_max: ds.map(() => 12),
    },
  };
}

function respostaRio() {
  const ds = dias(7, 7);
  const vazao = ds.map((_, k) => r1(90 + (k > 7 ? 25 * (k - 7) : 5 * Math.sin(k))));
  return {
    daily: {
      time: ds,
      river_discharge: vazao,
      river_discharge_mean: vazao.map((v) => r1(v * 0.95)),
      river_discharge_max: vazao.map((v) => r1(v * 1.3)),
    },
  };
}

function respostaBusca(nome) {
  const base = [
    { id: 1, name: 'Sorocaba', latitude: -23.5, longitude: -47.46, admin1: 'São Paulo' },
    { id: 2, name: 'Ribeirão Preto', latitude: -21.18, longitude: -47.81, admin1: 'São Paulo' },
    { id: 3, name: 'Rio de Janeiro', latitude: -22.91, longitude: -43.18, admin1: 'Rio de Janeiro' },
  ];
  const t = (nome || '').toLowerCase();
  return { results: base.filter((c) => c.name.toLowerCase().includes(t)) };
}

function csvQueimadas() {
  return [
    'lat,lon,satelite,data',
    ' -23.10, -47.20,GOES-19,2026-10-10 15:00:00',
    ' -22.80, -46.90,GOES-19,2026-10-10 15:00:00',
    ' -21.50, -48.30,AQUA_M-T,2026-10-10 15:00:00',
  ].join('\n');
}

// Mesma assinatura de buscarJson/buscarTexto: devolve a resposta depois de
// um pequeno atraso, como se viesse da rede.
export async function buscarMock(url) {
  await new Promise((r) => setTimeout(r, 250));
  if (url.includes('dataserver-coids.inpe.br')) return csvQueimadas();
  if (url.includes('geocoding-api')) return respostaBusca(param(url, 'name'));
  if (url.includes('flood-api')) return respostaRio();
  const lats = (param(url, 'latitude') || '0').split(',').map(Number);
  const lons = (param(url, 'longitude') || '0').split(',').map(Number);
  let lista;
  if (url.includes('/forecast')) {
    const completo = lats.length === 1;
    lista = lats.map((lat, i) => respostaClima(lat, lons[i], completo));
  } else {
    const antes = Number(param(url, 'past_days') || 0);
    const depois = Number(param(url, 'forecast_days') || 1);
    lista = lats.map((lat, i) => respostaAr(lat, lons[i], antes, depois));
  }
  return lista.length === 1 ? lista[0] : lista;
}
