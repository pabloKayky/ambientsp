// AmbientSP — Informações ambientais da Grande São Paulo
// APS de Sistemas Distribuídos — app mobile (cliente) que consulta vários
// servidores públicos na nuvem (Open-Meteo: ar, tempo, rios e busca; INPE:
// queimadas; Esri: mapa base), em paralelo, com retransmissão, cache offline
// e tolerância à falha de qualquer um deles.
//
// Estrutura:
//   App.js              tema, cabeçalho, abas e estado global
//   src/config.js       servidores, cidades e parâmetros de rede
//   src/tema.js         temas claro/escuro
//   src/logica/         regras puras: escalas EPA/CETESB, parse, inversão, riscos, mapa, relatórios
//   src/servicos/       rede (HTTP + retransmissão), cache, APIs, mock, GPS
//   src/hooks/          dados e preferências
//   src/componentes/    peças visuais (ui, gráfico, mapa, seletor de local)
//   src/telas/          uma tela por aba

import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import SeletorLocal from './src/componentes/SeletorLocal';
import { QUEIMADAS, USAR_MOCK } from './src/config';
import { useMapa, usePainel } from './src/hooks/useDados';
import { usePreferencias } from './src/hooks/usePreferencias';
import { horaCurta } from './src/logica/formato';
import { avaliarRiscos } from './src/logica/riscos';
import TelaAlertas from './src/telas/TelaAlertas';
import TelaInicio from './src/telas/TelaInicio';
import TelaMais from './src/telas/TelaMais';
import TelaMapa from './src/telas/TelaMapa';
import TelaPrevisao from './src/telas/TelaPrevisao';
import { criarEstilos, TEMAS, TemaContext, useTema } from './src/tema';

// Funções puras reexportadas para os testes.
export { faixaDoIndice } from './src/logica/indices';
export { extrairIndice } from './src/logica/parse';

const ABAS = [
  { id: 'inicio', rotulo: 'Início', icone: 'home' },
  { id: 'mapa', rotulo: 'Mapa', icone: 'map' },
  { id: 'previsao', rotulo: 'Previsão', icone: 'calendar' },
  { id: 'alertas', rotulo: 'Alertas', icone: 'warning' },
  { id: 'mais', rotulo: 'Mais', icone: 'grid' },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <Raiz />
    </SafeAreaProvider>
  );
}

function Raiz() {
  const prefs = usePreferencias();
  const sistema = useColorScheme();
  const nome = prefs.tema === 'auto' ? (sistema === 'dark' ? 'escuro' : 'claro') : prefs.tema;
  const tema = TEMAS[nome];
  return (
    <TemaContext.Provider value={tema}>
      <StatusBar style="light" />
      {prefs.carregadas ? (
        <Principal prefs={prefs} />
      ) : (
        <View style={{ flex: 1, backgroundColor: tema.fundo, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={tema.primaria} size="large" />
        </View>
      )}
    </TemaContext.Provider>
  );
}

function Principal({ prefs }) {
  const c = useTema();
  const st = useEstilos();
  const insets = useSafeAreaInsets();
  const [aba, setAba] = useState('inicio');
  const [seletorAberto, setSeletorAberto] = useState(false);
  const { local, escala } = prefs;
  const painel = usePainel(local);
  const mapa = useMapa(aba === 'mapa');

  const alertasAtivos = useMemo(
    () =>
      avaliarRiscos({
        ar: painel.ar && painel.ar.dados,
        clima: painel.clima && painel.clima.dados,
        rio: painel.rio && painel.rio.dados,
        focos: painel.queimadas && painel.queimadas.dados,
        local,
        escala,
        raioKm: QUEIMADAS.raioKm,
      }).filter((r) => r.nivel >= 2).length,
    [painel.ar, painel.clima, painel.rio, painel.queimadas, local, escala],
  );

  function escolherLocal(l) {
    prefs.escolherLocal(l);
    setSeletorAberto(false);
  }

  function abrirLocal(l) {
    prefs.escolherLocal(l);
    setAba('inicio');
  }

  let tela;
  if (aba === 'inicio') {
    tela = (
      <TelaInicio
        painel={painel}
        escala={escala}
        onEscala={(e) => prefs.definir('escala', e)}
        local={local}
        onAbrirAlertas={() => setAba('alertas')}
      />
    );
  } else if (aba === 'mapa') {
    tela = (
      <TelaMapa
        mapa={mapa}
        focos={painel.queimadas && painel.queimadas.dados}
        escala={escala}
        voce={local.id === 'gps' ? local : null}
        onAbrirLocal={abrirLocal}
      />
    );
  } else if (aba === 'previsao') {
    tela = <TelaPrevisao painel={painel} escala={escala} local={local} />;
  } else if (aba === 'alertas') {
    tela = <TelaAlertas painel={painel} escala={escala} local={local} onVerMapa={() => setAba('mapa')} />;
  } else {
    tela = <TelaMais prefs={prefs} local={local} onTrocarLocal={() => setSeletorAberto(true)} />;
  }

  return (
    <View style={st.raiz}>
      {aba === 'mapa' ? (
        <View style={{ height: insets.top, backgroundColor: c.cabecalho[0] }} />
      ) : (
        <LinearGradient colors={c.cabecalho} style={[st.cabecalho, { paddingTop: insets.top + 10 }]}>
          <Pressable
            onPress={() => setSeletorAberto(true)}
            style={({ pressed }) => [st.localBotao, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
            accessibilityLabel={`Local: ${local.nome}. Toque para trocar`}
          >
            <Text style={st.aba}>{ABAS.find((a) => a.id === aba).rotulo.toUpperCase()}</Text>
            <View style={st.localLinha}>
              <Ionicons name={local.id === 'gps' ? 'navigate' : 'location'} size={18} color="#fff" />
              <Text style={st.localNome} numberOfLines={1}>
                {local.id === 'gps' ? local.regiao : local.nome}
              </Text>
              <Ionicons name="chevron-down" size={18} color="#fff" />
            </View>
            <Text style={st.localRegiao} numberOfLines={1}>
              {local.id === 'gps' ? 'Minha localização' : local.regiao}
              {painel.ar && painel.ar.dados ? ` · atualizado às ${horaCurta(painel.ar.dados.atual.hora)}` : ''}
            </Text>
          </Pressable>
          <Conexao painel={painel} />
        </LinearGradient>
      )}

      <View style={st.corpo}>{tela}</View>

      <View style={[st.abas, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {ABAS.map((a) => {
          const ativa = a.id === aba;
          return (
            <Pressable
              key={a.id}
              style={st.abaBotao}
              onPress={() => setAba(a.id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: ativa }}
              accessibilityLabel={a.rotulo}
            >
              <View style={[st.abaIcone, ativa && { backgroundColor: c.primariaSuave }]}>
                <Ionicons name={ativa ? a.icone : `${a.icone}-outline`} size={22} color={ativa ? c.primaria : c.textoTer} />
                {a.id === 'alertas' && alertasAtivos > 0 ? (
                  <View style={st.badge}>
                    <Text style={st.badgeTexto}>{alertasAtivos}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[st.abaTexto, ativa && { color: c.primaria }]}>{a.rotulo}</Text>
            </Pressable>
          );
        })}
      </View>

      <SeletorLocal
        visivel={seletorAberto}
        localAtual={local}
        recentes={prefs.recentes}
        onEscolher={escolherLocal}
        onFechar={() => setSeletorAberto(false)}
        onLimparRecentes={prefs.limparRecentes}
      />
    </View>
  );
}

// Indicador de conexão no canto do cabeçalho.
function Conexao({ painel }) {
  const st = useEstilos();
  const fonte = painel.ar;
  let texto = 'Sem dados';
  let cor = '#fda29b';
  if (USAR_MOCK) {
    texto = 'Mock';
    cor = '#d6bbfb';
  } else if (painel.carregando) {
    texto = 'Atualizando';
    cor = '#fedf89';
  } else if (fonte && fonte.origem === 'rede') {
    texto = 'Online';
    cor = '#75e0a7';
  } else if (fonte && fonte.origem === 'cache') {
    texto = 'Offline';
    cor = '#fec84b';
  }
  return (
    <View style={st.conexao}>
      <View style={[st.conexaoPonto, { backgroundColor: cor }]} />
      <Text style={st.conexaoTexto}>{texto}</Text>
    </View>
  );
}

const useEstilos = criarEstilos((c) => ({
  raiz: { flex: 1, backgroundColor: c.fundo },
  cabecalho: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  localBotao: { flex: 1 },
  aba: { color: '#fff', opacity: 0.75, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  localLinha: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  localNome: { color: '#fff', fontSize: 22, fontWeight: '800', flexShrink: 1 },
  localRegiao: { color: '#fff', opacity: 0.8, fontSize: 13, marginTop: 2 },
  conexao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  conexaoPonto: { width: 8, height: 8, borderRadius: 4 },
  conexaoTexto: { color: '#fff', fontSize: 12, fontWeight: '700' },
  corpo: { flex: 1 },
  abas: {
    flexDirection: 'row',
    backgroundColor: c.superficie,
    borderTopWidth: 1,
    borderTopColor: c.borda,
    paddingTop: 6,
  },
  abaBotao: { flex: 1, alignItems: 'center', gap: 2 },
  abaIcone: { paddingHorizontal: 16, paddingVertical: 4, borderRadius: 999 },
  abaTexto: { fontSize: 11, color: c.textoTer, fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: -2,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#e11d48',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeTexto: { color: '#fff', fontSize: 11, fontWeight: '800' },
}));
