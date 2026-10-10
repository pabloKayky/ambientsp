// Configuração central do AmbientSP: servidores, locais e parâmetros de rede.

// Enquanto estiver desenvolvendo sem internet, deixe true para usar dados
// falsos (mock) gerados no próprio app. Para valer, deixe false.
export const USAR_MOCK = false;

// Servidores (nós remotos do sistema distribuído). Cada um é independente:
// se um cair, o app continua mostrando o que os outros devolveram.
export const SERVIDORES = {
  ar: {
    nome: 'Qualidade do ar',
    host: 'air-quality-api.open-meteo.com',
    url: 'https://air-quality-api.open-meteo.com/v1/air-quality',
    fonte: 'CAMS / Copernicus (União Europeia)',
  },
  clima: {
    nome: 'Meteorologia',
    host: 'api.open-meteo.com',
    url: 'https://api.open-meteo.com/v1/forecast',
    fonte: 'Modelos meteorológicos globais',
  },
  rios: {
    nome: 'Rios e cheias',
    host: 'flood-api.open-meteo.com',
    url: 'https://flood-api.open-meteo.com/v1/flood',
    fonte: 'GloFAS / Copernicus',
  },
  queimadas: {
    nome: 'Queimadas (INPE)',
    host: 'dataserver-coids.inpe.br',
    url: 'https://dataserver-coids.inpe.br/queimadas/queimadas/focos/csv/10min/',
    fonte: 'Programa Queimadas — INPE',
  },
  busca: {
    nome: 'Busca de cidades',
    host: 'geocoding-api.open-meteo.com',
    url: 'https://geocoding-api.open-meteo.com/v1/search',
    fonte: 'GeoNames via Open-Meteo',
  },
  mapa: {
    nome: 'Mapa base',
    host: 'services.arcgisonline.com',
    fonte: 'Esri, OpenStreetMap',
  },
};

export const FUSO = 'America/Sao_Paulo';

// Tolerância a falhas na comunicação com os servidores.
export const REDE = {
  timeoutMs: 20000, // desiste de uma tentativa após 20 s
  tentativas: 3, // 1 tentativa + 2 retransmissões
  esperaBaseMs: 500, // espera 500 ms, depois 1000 ms (backoff exponencial)
};

// Queimadas: quantas horas para trás buscar (arquivos de 10 em 10 min) e o
// raio considerado "perto" do usuário.
export const QUEIMADAS = { horas: 2, raioKm: 150 };

// Cidades sugeridas. O modelo CAMS tem resolução de dezenas de km, então
// bairros da mesma cidade dariam o mesmo valor; por isso usamos cidades.
export const LOCAIS = [
  { id: 'sp', nome: 'São Paulo', regiao: 'Capital', lat: -23.55, lon: -46.63 },
  { id: 'gru', nome: 'Guarulhos', regiao: 'Grande SP', lat: -23.46, lon: -46.53 },
  { id: 'sto-andre', nome: 'Santo André', regiao: 'ABC', lat: -23.66, lon: -46.53 },
  { id: 'osasco', nome: 'Osasco', regiao: 'Grande SP', lat: -23.53, lon: -46.79 },
  { id: 'mogi', nome: 'Mogi das Cruzes', regiao: 'Alto Tietê', lat: -23.52, lon: -46.19 },
  { id: 'cubatao', nome: 'Cubatão', regiao: 'Baixada Santista', lat: -23.89, lon: -46.42 },
  { id: 'santos', nome: 'Santos', regiao: 'Baixada Santista', lat: -23.96, lon: -46.33 },
  { id: 'jundiai', nome: 'Jundiaí', regiao: 'Interior', lat: -23.19, lon: -46.88 },
  { id: 'campinas', nome: 'Campinas', regiao: 'Interior', lat: -22.91, lon: -47.06 },
  { id: 'sjc', nome: 'São José dos Campos', regiao: 'Vale do Paraíba', lat: -23.18, lon: -45.88 },
];

export const LOCAL_PADRAO = LOCAIS[0];

// Área do mapa (Grande SP, Baixada, Campinas e Vale) e pontos por lado da
// grade. 8 × 8 = 64 pontos por camada, todos numa única requisição.
export const MAPA = { latMin: -24.3, latMax: -22.5, lonMin: -47.5, lonMax: -45.5, divisoes: 8 };

// Atualização automática enquanto o app está aberto.
export const ATUALIZACAO_AUTOMATICA_MS = 15 * 60 * 1000;
