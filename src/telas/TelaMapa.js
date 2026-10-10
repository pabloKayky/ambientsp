// Aba "Mapa": mapa em tela cheia com camadas (qualidade do ar, chuva,
// temperatura e queimadas), linha do tempo até +24h e ranking das cidades.

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Mapa from '../componentes/Mapa';
import { Aviso, Botao } from '../componentes/ui';
import { LOCAIS, MAPA } from '../config';
import { diaDaSemana, horaCurta } from '../logica/formato';
import { faixaCetesb, faixaDoIndice } from '../logica/indices';
import {
  CAMADAS,
  corHex,
  horaDoDeslocamento,
  interpolar,
  rampaDaCamada,
  rasterizar,
  valoresDaCamada,
} from '../logica/mapa';
import { criarEstilos, sombra, useTema } from '../tema';

export const DESLOCAMENTOS = [0, 3, 6, 9, 12, 15, 18, 21, 24];
const INTERVALO_ANIMACAO_MS = 1300;
const MARGEM_FOCOS = 0.3; // graus além da área do mapa

function textoDoValor(camada, v) {
  if (v === null || v === undefined) return '—';
  if (camada === 'chuva') return v < 0.05 ? '0' : v.toFixed(1).replace('.', ',');
  if (camada === 'temperatura') return `${Math.round(v)}°`;
  return String(Math.round(v));
}

// Valores das cidades na camada (ar: direto da API; clima: interpolado da grade).
export function valoresDasCidades({ camada, escala, deslocamento, cidades, gradeClima }) {
  if (camada === 'ar') {
    if (!cidades) return [];
    const faixaDe = escala === 'CETESB' ? faixaCetesb : faixaDoIndice;
    return valoresDaCamada(cidades, 'ar', escala, deslocamento).map((m) => {
      const faixa = faixaDe(m.v);
      return { ...m, cor: faixa.cor, rotulo: faixa.rotulo };
    });
  }
  if ((camada === 'chuva' || camada === 'temperatura') && gradeClima) {
    const base = valoresDaCamada(gradeClima, camada, escala, deslocamento);
    const rampa = rampaDaCamada(camada, escala);
    return LOCAIS.map((l) => {
      const v = interpolar(base, l.lat, l.lon);
      return { id: l.id, nome: l.nome, lat: l.lat, lon: l.lon, v, cor: corHex(v, rampa), rotulo: camada === 'chuva' ? 'mm/h' : '°C' };
    });
  }
  return [];
}

// Ordena para o ranking: ar do mais limpo ao mais poluído; chuva e
// temperatura do maior para o menor. Sem dado vai para o fim.
export function rankingDaCamada(valores, camada) {
  return [...valores].sort((a, b) => {
    if (a.v === null || a.v === undefined) return 1;
    if (b.v === null || b.v === undefined) return -1;
    return camada === 'ar' ? a.v - b.v : b.v - a.v;
  });
}

export default function TelaMapa({ mapa, focos, escala, voce, onAbrirLocal }) {
  const c = useTema();
  const st = useEstilos();
  const { carregando, cidades, grade, gradeClima } = mapa;
  const [camada, setCamada] = useState('ar');
  const [deslocamento, setDeslocamento] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [selecionado, setSelecionado] = useState(null);
  const [rankingAberto, setRankingAberto] = useState(false);
  const [erroMapa, setErroMapa] = useState(null);

  useEffect(() => {
    if (!tocando) return undefined;
    const t = setInterval(() => {
      setDeslocamento((d) => DESLOCAMENTOS[(DESLOCAMENTOS.indexOf(d) + 1) % DESLOCAMENTOS.length]);
    }, INTERVALO_ANIMACAO_MS);
    return () => clearInterval(t);
  }, [tocando]);

  const dCidades = cidades && cidades.dados;
  const dGrade = grade && grade.dados;
  const dClima = gradeClima && gradeClima.dados;

  const focosNaArea = useMemo(
    () =>
      (focos || []).filter(
        (f) =>
          f.lat >= MAPA.latMin - MARGEM_FOCOS &&
          f.lat <= MAPA.latMax + MARGEM_FOCOS &&
          f.lon >= MAPA.lonMin - MARGEM_FOCOS &&
          f.lon <= MAPA.lonMax + MARGEM_FOCOS,
      ),
    [focos],
  );

  const valores = useMemo(
    () => valoresDasCidades({ camada, escala, deslocamento, cidades: dCidades, gradeClima: dClima }),
    [camada, escala, deslocamento, dCidades, dClima],
  );

  const disponivel =
    camada === 'ar' ? !!(dGrade || dCidades) : camada === 'queimadas' ? !!focos : !!dClima;

  const dadosMapa = useMemo(() => {
    let base = null;
    if (camada === 'ar') base = valoresDaCamada(dGrade || dCidades || [], 'ar', escala, deslocamento);
    else if (camada !== 'queimadas' && dClima) base = valoresDaCamada(dClima, camada, escala, deslocamento);
    return {
      limites: MAPA,
      raster: base && base.some((p) => p.v !== null) ? rasterizar(base, MAPA, 90) : null,
      rampa: rampaDaCamada(camada, escala),
      marcadores: valores
        .filter((m) => m.v !== null && m.v !== undefined)
        .map((m) => ({ id: m.id, lat: m.lat, lon: m.lon, cor: m.cor, texto: textoDoValor(camada, m.v), destaque: m.id === selecionado })),
      focos: camada === 'queimadas' ? focosNaArea : [],
      tema: c.escuro ? 'escuro' : 'claro',
      voce: voce ? { lat: voce.lat, lon: voce.lon } : null,
    };
  }, [camada, escala, deslocamento, dGrade, dCidades, dClima, valores, selecionado, focosNaArea, c.escuro, voce]);

  const fonteHora = camada === 'ar' ? dGrade || dCidades : dClima;
  const hora = fonteHora ? horaDoDeslocamento(fonteHora, deslocamento) : null;
  const escolhida = selecionado ? valores.find((v) => v.id === selecionado) : null;
  const infoCamada = CAMADAS.find((k) => k.id === camada);

  return (
    <View style={st.raiz}>
      <Mapa dados={dadosMapa} estilo={StyleSheet.absoluteFill} onCidade={setSelecionado} onErro={setErroMapa} />

      <View style={st.topo} pointerEvents="box-none">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.camadas}>
          {CAMADAS.map((k) => {
            const ativa = k.id === camada;
            return (
              <Pressable
                key={k.id}
                onPress={() => {
                  setCamada(k.id);
                  setSelecionado(null);
                }}
                style={[st.camada, ativa && st.camadaAtiva]}
                accessibilityRole="button"
                accessibilityLabel={`Camada ${k.rotulo}`}
                accessibilityState={{ selected: ativa }}
              >
                <Ionicons name={k.icone} size={15} color={ativa ? c.sobrePrimaria : c.texto} />
                <Text style={[st.camadaTexto, ativa && { color: c.sobrePrimaria }]}>{k.rotulo}</Text>
              </Pressable>
            );
          })}
          {camada !== 'queimadas' ? (
            <Pressable
              onPress={() => setRankingAberto(true)}
              style={st.camada}
              accessibilityRole="button"
              accessibilityLabel="Ver ranking das cidades"
            >
              <Ionicons name="podium" size={15} color={c.texto} />
              <Text style={st.camadaTexto}>Ranking</Text>
            </Pressable>
          ) : null}
        </ScrollView>
        {carregando ? (
          <View style={st.carregando}>
            <ActivityIndicator size="small" color={c.primaria} />
            <Text style={st.carregandoTexto}>Atualizando o mapa…</Text>
          </View>
        ) : null}
      </View>

      <View style={st.painel}>
        {erroMapa ? <Aviso tipo="erro" titulo="Mapa indisponível" texto={erroMapa} /> : null}
        {escolhida ? (
          <CartaoCidade
            cidade={escolhida}
            camada={camada}
            hora={hora}
            onFechar={() => setSelecionado(null)}
            onDetalhes={() => {
              const local = LOCAIS.find((l) => l.id === escolhida.id);
              if (local) onAbrirLocal(local);
            }}
          />
        ) : !disponivel && !carregando ? (
          <>
            <Aviso
              tipo="erro"
              titulo={`Camada “${infoCamada.rotulo}” indisponível`}
              texto={
                (camada === 'ar'
                  ? (cidades && cidades.erro) || (grade && grade.erro)
                  : camada === 'queimadas'
                    ? 'Os dados do INPE não responderam.'
                    : gradeClima && gradeClima.erro) || 'Sem resposta do servidor.'
              }
            />
            <Botao titulo="Tentar de novo" icone="refresh" variante="secundario" onPress={mapa.atualizar} />
          </>
        ) : camada === 'queimadas' ? (
          <View>
            <Text style={st.painelTitulo}>
              {focosNaArea.length} {focosNaArea.length === 1 ? 'foco de incêndio' : 'focos de incêndio'} na região
            </Text>
            <Text style={st.painelTexto}>
              Detectados por satélite nas últimas horas (INPE). A fumaça de queimadas piora a qualidade do ar.
            </Text>
          </View>
        ) : (
          <>
            <View style={st.tempo}>
              <Pressable
                onPress={() => setTocando((t) => !t)}
                style={st.play}
                accessibilityRole="button"
                accessibilityLabel={tocando ? 'Pausar animação' : 'Animar previsão'}
              >
                <Ionicons name={tocando ? 'pause' : 'play'} size={18} color={c.sobrePrimaria} />
              </Pressable>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {DESLOCAMENTOS.map((d) => {
                  const ativo = d === deslocamento;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => {
                        setTocando(false);
                        setDeslocamento(d);
                      }}
                      style={[st.passo, ativo && st.passoAtivo]}
                      accessibilityRole="button"
                      accessibilityLabel={d === 0 ? 'Agora' : `Mais ${d} horas`}
                      accessibilityState={{ selected: ativo }}
                    >
                      <Text style={[st.passoTexto, ativo && { color: c.primaria }]}>{d === 0 ? 'Agora' : `+${d}h`}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
            <Text style={st.painelTitulo}>
              {infoCamada.rotulo}
              {camada === 'ar' ? ` (${escala})` : ''} · {deslocamento === 0 ? 'agora' : `previsão +${deslocamento}h`}
              {hora ? `, ${diaDaSemana(hora)} ${horaCurta(hora)}` : ' · carregando…'}
            </Text>
            <Legenda camada={camada} escala={escala} />
          </>
        )}
      </View>

      <Ranking
        visivel={rankingAberto}
        camada={camada}
        escala={escala}
        valores={valores}
        onFechar={() => setRankingAberto(false)}
        onEscolher={(id) => {
          setRankingAberto(false);
          const local = LOCAIS.find((l) => l.id === id);
          if (local) onAbrirLocal(local);
        }}
      />
    </View>
  );
}

function Legenda({ camada, escala }) {
  const st = useEstilos();
  const rampa = rampaDaCamada(camada, escala);
  const rotulos =
    camada === 'ar'
      ? ['Bom', 'Moderado', 'Ruim', 'Péssimo']
      : camada === 'chuva'
        ? ['fraca', '2 mm/h', '8 mm/h', 'forte']
        : [`${rampa[0].v}°`, '19°', '27°', `${rampa[rampa.length - 1].v}°`];
  return (
    <View>
      <LinearGradient
        colors={rampa.map((r) => r.cor)}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={st.gradiente}
      />
      <View style={st.rotulos}>
        {rotulos.map((r) => (
          <Text key={r} style={st.rotulo}>
            {r}
          </Text>
        ))}
      </View>
    </View>
  );
}

function CartaoCidade({ cidade, camada, hora, onFechar, onDetalhes }) {
  const c = useTema();
  const st = useEstilos();
  return (
    <View>
      <View style={st.cidadeTopo}>
        <View style={[st.cidadeValor, { backgroundColor: cidade.cor }]}>
          <Text style={st.cidadeValorTexto}>{textoDoValor(camada, cidade.v)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.cidadeNome}>{cidade.nome}</Text>
          <Text style={st.painelTexto}>
            {camada === 'ar' ? cidade.rotulo : CAMADAS.find((k) => k.id === camada).rotulo} · {horaCurta(hora)}
          </Text>
        </View>
        <Pressable onPress={onFechar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar cidade">
          <Ionicons name="close-circle" size={26} color={c.textoTer} />
        </Pressable>
      </View>
      <Pressable onPress={onDetalhes} style={st.detalhes} accessibilityRole="button" accessibilityLabel={`Ver detalhes de ${cidade.nome}`}>
        <Text style={st.detalhesTexto}>Ver detalhes</Text>
        <Ionicons name="arrow-forward" size={16} color={c.sobrePrimaria} />
      </Pressable>
    </View>
  );
}

function Ranking({ visivel, camada, escala, valores, onFechar, onEscolher }) {
  const c = useTema();
  const st = useEstilos();
  const insets = useSafeAreaInsets();
  const lista = rankingDaCamada(valores, camada);
  const comDado = lista.filter((v) => v.v !== null && v.v !== undefined);
  const max = Math.max(1, ...comDado.map((v) => Math.abs(v.v)));
  const titulo = camada === 'ar' ? `Qualidade do ar (${escala})` : camada === 'chuva' ? 'Chuva agora (mm/h)' : 'Temperatura (°C)';
  return (
    <Modal visible={visivel} animationType="slide" transparent onRequestClose={onFechar}>
      <Pressable style={st.fundoModal} onPress={onFechar} accessibilityLabel="Fechar ranking" />
      <View style={[st.folha, { paddingBottom: insets.bottom + 20 }]}>
        <View style={st.alca} />
        <View style={st.cidadeTopo}>
          <Text style={[st.cidadeNome, { flex: 1 }]}>Ranking · {titulo}</Text>
          <Pressable onPress={onFechar} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar">
            <Ionicons name="close-circle" size={26} color={c.textoTer} />
          </Pressable>
        </View>
        {camada === 'ar' && comDado.length ? (
          <Text style={st.painelTexto}>
            Mais limpa: {comDado[0].nome} ({comDado[0].v}) · Mais poluída: {comDado[comDado.length - 1].nome} (
            {comDado[comDado.length - 1].v})
          </Text>
        ) : null}
        <ScrollView style={{ marginTop: 8 }}>
          {lista.map((v, i) => (
            <Pressable
              key={v.id}
              onPress={() => onEscolher(v.id)}
              style={({ pressed }) => [st.item, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
              accessibilityLabel={`${v.nome}, ${textoDoValor(camada, v.v)}`}
            >
              <Text style={st.posicao}>{v.v === null ? '–' : i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={st.itemNome}>{v.nome}</Text>
                <View style={st.trilho}>
                  <View
                    style={[st.barra, { width: `${v.v === null ? 0 : Math.max(4, (Math.abs(v.v) / max) * 100)}%`, backgroundColor: v.cor }]}
                  />
                </View>
              </View>
              <Text style={[st.itemValor, { color: v.cor }]}>{textoDoValor(camada, v.v)}</Text>
              <Ionicons name="chevron-forward" size={18} color={c.textoTer} />
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const useEstilos = criarEstilos((c) => ({
  raiz: { flex: 1, backgroundColor: c.fundo },
  topo: { position: 'absolute', top: 10, left: 0, right: 0 },
  camadas: { gap: 8, paddingHorizontal: 12 },
  camada: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: c.superficie,
    ...sombra(c, 2),
  },
  camadaAtiva: { backgroundColor: c.primaria },
  camadaTexto: { fontSize: 13, fontWeight: '700', color: c.texto },
  carregando: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    backgroundColor: c.superficie,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    ...sombra(c),
  },
  carregandoTexto: { fontSize: 12, color: c.textoSec, fontWeight: '600' },
  painel: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: c.superficie,
    borderRadius: 22,
    padding: 14,
    ...sombra(c, 3),
  },
  painelTitulo: { fontSize: 14, fontWeight: '800', color: c.texto, marginTop: 10, marginBottom: 8 },
  painelTexto: { fontSize: 13, color: c.textoSec, lineHeight: 18 },
  tempo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  play: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.primaria, alignItems: 'center', justifyContent: 'center' },
  passo: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, marginRight: 4 },
  passoAtivo: { backgroundColor: c.primariaSuave },
  passoTexto: { fontSize: 13, fontWeight: '700', color: c.textoSec },
  gradiente: { height: 10, borderRadius: 5 },
  rotulos: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  rotulo: { fontSize: 11, color: c.textoSec, fontWeight: '600' },
  cidadeTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cidadeValor: { minWidth: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  cidadeValorTexto: { color: '#fff', fontSize: 18, fontWeight: '800' },
  cidadeNome: { fontSize: 18, fontWeight: '800', color: c.texto },
  detalhes: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: c.primaria,
    borderRadius: 12,
    paddingVertical: 11,
    marginTop: 12,
  },
  detalhesTexto: { color: c.sobrePrimaria, fontWeight: '700', fontSize: 15 },
  fundoModal: { flex: 1, backgroundColor: c.sobreposicao },
  folha: { maxHeight: '75%', backgroundColor: c.superficie, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingTop: 10 },
  alca: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: c.borda, marginBottom: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: c.borda },
  posicao: { width: 22, textAlign: 'center', fontSize: 15, fontWeight: '800', color: c.textoTer },
  itemNome: { fontSize: 15, fontWeight: '700', color: c.texto, marginBottom: 6 },
  trilho: { height: 6, borderRadius: 3, backgroundColor: c.superficie2 },
  barra: { height: 6, borderRadius: 3 },
  itemValor: { fontSize: 18, fontWeight: '800', minWidth: 44, textAlign: 'right' },
}));
