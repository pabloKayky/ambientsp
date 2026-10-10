// Interpretação (parse) das respostas JSON dos servidores Open-Meteo.
// Toda resposta é validada: se faltar o essencial, estoura um erro com
// mensagem clara em vez de deixar a tela quebrar mais adiante.

function verificarErroApi(json) {
  if (json && json.error === true) {
    throw new Error('A API recusou a requisição' + (json.reason ? ': ' + json.reason : '.'));
  }
}

// Tira o índice EPA de dentro da resposta. O modelo nem sempre tem valor
// para a hora pedida (us_aqi = null) — isso é erro, não uma cor válida.
export function extrairIndice(json) {
  verificarErroApi(json);
  const atual = json && json.current;
  const aqi = atual ? atual.us_aqi : null;
  if (aqi === null || aqi === undefined) {
    throw new Error('A resposta veio sem o índice (us_aqi).');
  }
  return {
    aqi,
    pm25: atual.pm2_5,
    pm10: atual.pm10,
    hora: atual.time,
  };
}

// Leitura atual completa: índice + todos os poluentes + UV.
export function extrairAtual(json) {
  const base = extrairIndice(json);
  const a = json.current;
  return {
    ...base,
    o3: a.ozone ?? null,
    no2: a.nitrogen_dioxide ?? null,
    co: a.carbon_monoxide ?? null,
    so2: a.sulphur_dioxide ?? null,
    uv: a.uv_index ?? null,
  };
}

// Série horária em colunas (um vetor por variável), formato que facilita
// calcular médias móveis.
export function extrairSerieAr(json) {
  verificarErroApi(json);
  const h = json && json.hourly;
  if (!h || !Array.isArray(h.time) || !h.time.length) {
    throw new Error('A resposta veio sem a série horária.');
  }
  const col = (nome) => (Array.isArray(h[nome]) ? h[nome] : h.time.map(() => null));
  return {
    tempos: h.time,
    aqi: col('us_aqi'),
    mp25: col('pm2_5'),
    mp10: col('pm10'),
    o3: col('ozone'),
    no2: col('nitrogen_dioxide'),
    co: col('carbon_monoxide'),
    so2: col('sulphur_dioxide'),
  };
}

// Posição do horário atual na série: último horário <= agora. As datas vêm
// no formato "AAAA-MM-DDTHH:MM", que dá para comparar como texto.
export function indiceDaHora(tempos, isoAgora) {
  if (!tempos || !tempos.length) return -1;
  if (!isoAgora) return tempos.length - 1;
  let idx = -1;
  for (let i = 0; i < tempos.length; i++) {
    if (tempos[i] <= isoAgora) idx = i;
    else break;
  }
  return idx;
}

// Resposta completa do servidor de qualidade do ar para um local.
export function interpretarAr(json) {
  const atual = extrairAtual(json);
  const serie = extrairSerieAr(json);
  const idxAgora = indiceDaHora(serie.tempos, atual.hora);
  return { atual, serie, idxAgora };
}

// Resposta do servidor meteorológico: tempo atual, série horária (inclui o
// perfil vertical de temperatura para a inversão térmica) e previsão diária.
export function interpretarClima(json) {
  verificarErroApi(json);
  const h = json && json.hourly;
  if (!h || !Array.isArray(h.time) || !h.time.length) {
    throw new Error('A resposta meteorológica veio sem a série horária.');
  }
  const col = (nome) => (Array.isArray(h[nome]) ? h[nome] : h.time.map(() => null));
  const c = json.current || {};
  const serie = {
    tempos: h.time,
    t2m: col('temperature_2m'),
    sensacao: col('apparent_temperature'),
    umidade: col('relative_humidity_2m'),
    probChuva: col('precipitation_probability'),
    chuva: col('precipitation'),
    codigo: col('weather_code'),
    uv: col('uv_index'),
    vento: col('wind_speed_10m'),
    camadaLimite: col('boundary_layer_height'),
    t900: col('temperature_900hPa'),
    t850: col('temperature_850hPa'),
    t800: col('temperature_800hPa'),
    dia: col('is_day'),
  };
  const d = json.daily;
  const dias =
    d && Array.isArray(d.time)
      ? d.time.map((data, i) => {
          const v = (nome) => (Array.isArray(d[nome]) ? d[nome][i] ?? null : null);
          return {
            data,
            codigo: v('weather_code'),
            max: v('temperature_2m_max'),
            min: v('temperature_2m_min'),
            chuva: v('precipitation_sum'),
            probChuva: v('precipitation_probability_max'),
            uvMax: v('uv_index_max'),
            nascer: v('sunrise'),
            por: v('sunset'),
            ventoMax: v('wind_speed_10m_max'),
          };
        })
      : [];
  return {
    atual: {
      hora: c.time ?? null,
      temperatura: c.temperature_2m ?? null,
      sensacao: c.apparent_temperature ?? null,
      umidade: c.relative_humidity_2m ?? null,
      vento: c.wind_speed_10m ?? null,
      direcaoVento: c.wind_direction_10m ?? null,
      chuva: c.precipitation ?? null,
      codigo: c.weather_code ?? null,
      dia: c.is_day === undefined ? null : c.is_day === 1,
      uv: c.uv_index ?? null,
    },
    elevacao: typeof json.elevation === 'number' ? json.elevation : null,
    serie,
    dias,
    idxAgora: indiceDaHora(serie.tempos, c.time),
  };
}

// Vazão do rio mais próximo (GloFAS). O índice `hoje` é o primeiro dia de
// previsão, logo depois dos `diasPassados` de histórico.
export function interpretarRio(json, diasPassados = 7) {
  verificarErroApi(json);
  const d = json && json.daily;
  if (!d || !Array.isArray(d.time) || !d.time.length || !Array.isArray(d.river_discharge)) {
    throw new Error('Sem dados de rio para este local.');
  }
  const dias = d.time.map((data, i) => ({
    data,
    vazao: d.river_discharge[i] ?? null,
    media: Array.isArray(d.river_discharge_mean) ? d.river_discharge_mean[i] ?? null : null,
    max: Array.isArray(d.river_discharge_max) ? d.river_discharge_max[i] ?? null : null,
  }));
  if (dias.every((x) => x.vazao === null)) throw new Error('Sem dados de rio para este local.');
  return { dias, hoje: Math.min(diasPassados, dias.length - 1) };
}

// Resultado da busca de cidades (Geocoding).
export function interpretarBusca(json) {
  verificarErroApi(json);
  const lista = (json && Array.isArray(json.results) && json.results) || [];
  return lista
    .filter((r) => typeof r.latitude === 'number' && typeof r.longitude === 'number')
    .map((r) => ({
      id: 'geo-' + r.id,
      nome: r.name,
      regiao: [r.admin2 !== r.name ? r.admin2 : null, r.admin1].filter(Boolean).join(' · ') || r.country || '',
      lat: r.latitude,
      lon: r.longitude,
    }));
}

// Arquivos CSV de focos de queimada do INPE ("lat,lon,satelite,data").
// Vários arquivos podem repetir o mesmo foco: dedup pela posição.
export function interpretarFocos(textos) {
  const vistos = new Set();
  const focos = [];
  for (const texto of textos) {
    if (typeof texto !== 'string') continue;
    const linhas = texto.split(/\r?\n/);
    for (let i = 1; i < linhas.length; i++) {
      const partes = linhas[i].split(',');
      if (partes.length < 4) continue;
      const lat = parseFloat(partes[0]);
      const lon = parseFloat(partes[1]);
      if (Number.isNaN(lat) || Number.isNaN(lon)) continue;
      const chave = lat.toFixed(2) + ',' + lon.toFixed(2);
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      focos.push({ lat, lon, satelite: partes[2].trim(), data: partes[3].trim() });
    }
  }
  return focos;
}

// Distância em km entre dois pontos (fórmula de haversine).
export function distanciaKm(a, b) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const x =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// Focos dentro do raio, do mais perto para o mais longe.
export function focosProximos(focos, local, raioKm) {
  return focos
    .map((f) => ({ ...f, distancia: distanciaKm(local, f) }))
    .filter((f) => f.distancia <= raioKm)
    .sort((a, b) => a.distancia - b.distancia);
}

// Grade meteorológica do mapa (vários pontos): chuva e temperatura por hora.
export function interpretarGradeClima(json, pontos) {
  verificarErroApi(json);
  const lista = Array.isArray(json) ? json : json ? [json] : [];
  if (lista.length !== pontos.length) {
    throw new Error('A resposta da grade meteorológica veio incompleta.');
  }
  return pontos.map((local, i) => {
    const item = lista[i] || {};
    const h = item.hourly;
    if (!h || !Array.isArray(h.time)) return { local, clima: null };
    return {
      local,
      clima: {
        tempos: h.time,
        chuva: h.precipitation || [],
        temperatura: h.temperature_2m || [],
        idxAgora: indiceDaHora(h.time, item.current && item.current.time),
      },
    };
  });
}

// Resposta de vários locais numa única requisição. A API devolve uma lista
// (ou um objeto só, se houver um local). Um local sem dado não derruba os
// outros: ele vem marcado com indice null.
export function interpretarRegioes(json, locais) {
  verificarErroApi(json);
  const lista = Array.isArray(json) ? json : json ? [json] : [];
  if (lista.length !== locais.length) {
    throw new Error('A resposta de regiões veio incompleta.');
  }
  return locais.map((local, i) => {
    const item = lista[i] || {};
    let ar = null;
    try {
      ar = interpretarAr(item);
    } catch (e) {
      ar = null;
    }
    return { local, ar };
  });
}
