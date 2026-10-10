# AmbientSP

App mobile com informações ambientais da Grande São Paulo: qualidade do ar,
tempo, inversão térmica, chuva, cheia de rios e focos de queimada, com alertas
e recomendações em linguagem simples.

Projeto da APS da disciplina de **Sistemas Distribuídos**. O app é o cliente de
um sistema distribuído: não tem backend próprio e monta cada tela consultando,
em paralelo, vários servidores públicos independentes na nuvem. Se algum deles
cair, demorar ou devolver dado inválido, o restante do app continua
funcionando.

Feito com React Native + Expo (SDK 57), em JavaScript.

---

## Sumário

- [Funcionalidades](#funcionalidades)
- [Como rodar](#como-rodar)
- [Arquitetura distribuída](#arquitetura-distribuída)
- [Tolerância a falhas](#tolerância-a-falhas)
- [Estrutura do código](#estrutura-do-código)
- [Escalas de qualidade do ar](#escalas-de-qualidade-do-ar)
- [Testes](#testes)
- [Configuração](#configuração)
- [Limitações](#limitações)
- [Créditos dos dados](#créditos-dos-dados)

---

## Funcionalidades

O app tem cinco abas:

| Aba | O que mostra |
|---|---|
| **Início** | Índice de qualidade do ar com cartão colorido, alertas ativos, "o que fazer agora", tempo atual (temperatura, umidade, vento, UV, chuva, nascer/pôr do sol), próximas horas e ficha de cada poluente. |
| **Mapa** | Mapa em tela cheia com camadas de qualidade do ar, chuva, temperatura e queimadas, linha do tempo até +24 h e ranking das cidades, da mais limpa à mais poluída. |
| **Previsão** | Qualidade do ar nas próximas 48 h, melhor horário para sair, previsão de 7 dias e histórico dos últimos 7 dias. |
| **Alertas** | Todos os riscos do local com nível de 0 a 3: ar, inversão térmica, chuva/alagamento, cheia de rio, ar seco, calor/UV e queimadas próximas. Inclui telefones de emergência. |
| **Mais** | Tema claro/escuro, escolha da escala (EPA ou CETESB), troca de local e o painel do sistema distribuído: servidores, latência, taxa de sucesso e registro de cada requisição. |

Para escolher o local, há três caminhos: uma das 10 cidades sugeridas da
região, a busca de qualquer cidade do Brasil pelo nome ou o GPS do aparelho.
As preferências e os locais recentes ficam salvos no aparelho.

---

## Como rodar

### Pré-requisitos

- [Node.js](https://nodejs.org) LTS
- App **Expo Go** no celular (Play Store / App Store)
- Celular e PC na **mesma rede Wi-Fi**

### Passos

```bash
git clone https://github.com/pabloKayky/ambientsp.git
cd ambientsp
npm install
npx expo start
```

Escaneie o QR code com o Expo Go e o app abre no celular.

Outras formas de rodar:

```bash
npm run web       # abre no navegador do PC
npm run android   # emulador Android
npm test          # roda os testes
```

---

## Arquitetura distribuída

```
                         ┌──────────────────────────────┐
                         │   App AmbientSP (cliente)    │
                         │  React Native / Expo         │
                         │  cache local (AsyncStorage)  │
                         └──────────────┬───────────────┘
                                        │ HTTPS, requisições em paralelo
      ┌──────────────┬──────────────┬───┴──────────┬──────────────┬──────────────┐
      ▼              ▼              ▼              ▼              ▼              ▼
 Open-Meteo     Open-Meteo     Open-Meteo     Open-Meteo        INPE          Esri
 Air Quality    Forecast       Flood          Geocoding       Queimadas      (mapa base)
 (ar)           (tempo)        (rios)         (busca)         (CSV 10 min)
```

| Servidor | Host | Dados | Fonte original |
|---|---|---|---|
| Qualidade do ar | `air-quality-api.open-meteo.com` | AQI, MP2,5, MP10, O₃, NO₂, CO, SO₂ (atual, 7 dias de histórico e 3 de previsão) | CAMS / Copernicus |
| Meteorologia | `api.open-meteo.com` | Tempo atual, previsão de 7 dias, temperatura em altitude (inversão térmica), camada limite | Modelos meteorológicos globais |
| Rios e cheias | `flood-api.open-meteo.com` | Vazão do rio mais próximo comparada com a vazão típica | GloFAS / Copernicus |
| Busca de cidades | `geocoding-api.open-meteo.com` | Nome → coordenadas | GeoNames |
| Queimadas | `dataserver-coids.inpe.br` | Focos de incêndio, um arquivo CSV a cada 10 min | Programa Queimadas — INPE |
| Mapa base | `services.arcgisonline.com` | Imagens do mapa (via Leaflet) | Esri, OpenStreetMap |

Nenhum desses serviços exige chave de API.

### Carregamento progressivo

O carregamento segue o padrão *stale-while-revalidate*
([src/hooks/useDados.js](src/hooks/useDados.js)):

1. Mostra na hora a última cópia salva de cada fonte, se houver.
2. Consulta todos os servidores **em paralelo**.
3. Cada fonte aparece assim que o seu servidor responde. Um servidor lento não
   segura os outros.

Cada carga recebe um número. Se o usuário trocar de local no meio, as respostas
antigas são descartadas. O painel se atualiza sozinho a cada 15 minutos e quando
o app volta para a frente. A aba Mapa só busca dados na primeira vez que é
aberta.

Sempre que possível, o app junta vários pontos numa única requisição: as 10
cidades do mapa vão numa chamada, e a grade de 8 × 8 = 64 pontos usada para
pintar a mancha do mapa vai em outra.

---

## Tolerância a falhas

| Falha | Como o app reage | Onde |
|---|---|---|
| Servidor não responde | Timeout de 20 s por tentativa | [http.js](src/servicos/http.js) |
| Falha transitória (rede, HTTP 5xx, 429) | Até 3 tentativas com backoff exponencial (500 ms, 1000 ms) | [http.js](src/servicos/http.js) |
| Erro do próprio pedido (HTTP 4xx, JSON inválido) | Não repete e mostra o motivo em português | [http.js](src/servicos/http.js) |
| Sem internet | Usa a última resposta boa salva no aparelho e avisa que os dados são antigos | [cache.js](src/servicos/cache.js) |
| Sem internet e sem cópia salva | Mensagem de erro com botão "Tentar de novo"; o app não quebra | telas |
| Um servidor fora do ar | Só a parte dele some; as outras fontes continuam | [openMeteo.js](src/servicos/openMeteo.js) |
| API devolve `us_aqi = null` | Tratado como erro: mostra mensagem e não pinta a cor | [parse.js](src/logica/parse.js) |
| Arquivos de queimada faltando | Baixa as últimas 2 h em paralelo e basta um arquivo chegar | [openMeteo.js](src/servicos/openMeteo.js) |
| GPS negado, desligado ou lento | Mensagem explicando o motivo; limite de 15 s | [localizacao.js](src/servicos/localizacao.js) |
| Armazenamento cheio ou cópia corrompida | Segue sem cache, sem quebrar | [cache.js](src/servicos/cache.js) |

No cabeçalho, um indicador mostra o estado da conexão: **Online**,
**Atualizando**, **Offline** (dados salvos), **Sem dados** ou **Mock**. Na aba
**Mais**, cada requisição fica registrada com servidor, status, latência e
número da tentativa, e há estatísticas por servidor.

---

## Estrutura do código

```
ambientsp/
├── App.js                 tema, cabeçalho, abas e estado global
├── src/
│   ├── config.js          servidores, cidades, parâmetros de rede, flag USAR_MOCK
│   ├── tema.js            temas claro e escuro
│   ├── logica/            regras puras, sem tela e sem rede (fáceis de testar)
│   │   ├── indices.js       escalas EPA e CETESB
│   │   ├── parse.js         interpretação e validação das respostas das APIs
│   │   ├── inversao.js      inversão térmica e condição de dispersão
│   │   ├── riscos.js        alertas (nível 0–3) e recomendações
│   │   ├── mapa.js          grade, interpolação IDW e escalas de cor
│   │   ├── relatorio.js     médias diárias, melhor horário, tendência
│   │   ├── formato.js       datas e números
│   │   └── tempo.js         códigos de tempo, vento e UV
│   ├── servicos/          tudo que fala com o mundo externo
│   │   ├── http.js          cliente HTTP com timeout, retransmissão e registro
│   │   ├── cache.js         cópia offline (AsyncStorage)
│   │   ├── openMeteo.js     URLs e chamadas de cada servidor
│   │   ├── localizacao.js   GPS
│   │   └── mock.js          dados falsos para desenvolver sem internet
│   ├── hooks/
│   │   ├── useDados.js      carregamento progressivo do painel e do mapa
│   │   └── usePreferencias.js
│   ├── componentes/       peças visuais (ui, gráfico, mapa Leaflet, seletor de local)
│   └── telas/             uma tela por aba
├── __tests__/             testes (Jest + Testing Library)
└── test-utils/            respostas de exemplo das APIs
```

A regra de organização é separar a **lógica pura** (`src/logica/`) da **rede**
(`src/servicos/`) e das **telas**. Assim, as regras de cálculo são testadas sem
precisar de internet nem de interface.

---

## Escalas de qualidade do ar

O app oferece duas escalas, com troca na aba Início ou em Mais:

- **EPA (EUA)**: o índice `us_aqi` vem pronto da API. Tem 4 faixas de cor no
  app: ≤ 50 verde, 51–100 amarelo, 101–150 laranja, > 150 vermelho.
- **CETESB (SP)**: a escala oficial do estado, conforme a resolução CONAMA
  491/2018. O app calcula o índice a partir das concentrações: média móvel de
  cada poluente na janela exigida, interpolação linear dentro da faixa e
  conversão do CO de µg/m³ para ppm. O índice final é o do **pior poluente**
  (poluente crítico), como faz a CETESB. Tem 5 faixas: Boa, Moderada, Ruim,
  Muito ruim e Péssima.

### Inversão térmica

Normalmente o ar esfria com a altitude. Quando uma camada mais alta está mais
quente que a de baixo, ela funciona como uma tampa e prende a poluição perto do
chão. O app compara a temperatura no solo com a dos níveis de 900, 850 e
800 hPa, e classifica a inversão como fraca, moderada (≥ 1 °C) ou forte
(≥ 3 °C). Depois combina inversão, vento e altura da camada de mistura numa
condição de dispersão: favorável, regular ou desfavorável.

---

## Testes

```bash
npm test
```

São 132 testes em 4 arquivos, todos passando:

| Arquivo | O que cobre |
|---|---|
| `logica.test.js` | Escalas EPA e CETESB, parse das respostas, inversão térmica, relatórios, mapa, riscos e recomendações |
| `App.test.js` | Telas de ponta a ponta: com e sem internet, erro HTTP, `us_aqi` nulo, cache offline, servidor fora do ar, servidor lento, troca de local, GPS negado, mapa e preferências |
| `servicos.test.js` | Retransmissão, timeout, quais erros são repetidos, cache offline e montagem das URLs |
| `mock.test.js` | Modo mock monta as telas sem nenhuma requisição real |

---

## Configuração

Tudo fica em [src/config.js](src/config.js):

| Constante | Padrão | Para que serve |
|---|---|---|
| `USAR_MOCK` | `false` | `true` usa dados falsos gerados no aparelho, para desenvolver sem internet |
| `REDE` | 20 s / 3 tentativas / 500 ms | Timeout, número de tentativas e espera base do backoff |
| `QUEIMADAS` | 2 h / 150 km | Janela de focos buscada e raio considerado "perto" |
| `LOCAIS` | 10 cidades | Cidades sugeridas na escolha de local |
| `MAPA` | Grande SP + Baixada + Campinas + Vale | Área do mapa e tamanho da grade |
| `ATUALIZACAO_AUTOMATICA_MS` | 15 min | Intervalo da atualização automática |

---

## Limitações

- **Os dados são de modelo, não de estação.** A qualidade do ar vem do modelo
  atmosférico CAMS, com resolução de dezenas de km, e não das estações de
  medição da CETESB. Por isso o app usa cidades, e não bairros: bairros da mesma
  cidade dariam o mesmo valor.
- **O índice CETESB do app é uma estimativa.** Ele é calculado a partir das
  concentrações do modelo, então pode diferir do boletim oficial da CETESB.
- **Os alertas são orientativos.** Os limites seguem referências públicas (OMS,
  Defesa Civil de SP e INMET), mas o app não substitui os avisos oficiais.
- **O mapa precisa de internet.** As bibliotecas do mapa (Leaflet) e as imagens
  de fundo são baixadas na hora. Sem conexão, a aba Mapa mostra um aviso.

---

## Créditos dos dados

- Qualidade do ar: **CAMS / Copernicus**, via [Open-Meteo](https://open-meteo.com)
- Meteorologia, rios e busca de cidades: [Open-Meteo](https://open-meteo.com)
  (GloFAS / Copernicus, GeoNames)
- Focos de queimada: **Programa Queimadas — INPE**
- Mapa base: **Esri, OpenStreetMap**
