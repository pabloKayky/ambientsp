// Aba "Alertas": todos os riscos ambientais do local (ar, inversão térmica,
// chuva/alagamento, cheia de rio, ar seco, calor/UV e queimadas), com nível,
// explicação, o que fazer e telefones de emergência.

import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, Text, View } from 'react-native';
import Grafico from '../componentes/Grafico';
import { Aviso, Botao, Carregando, Cartao, Falha, Tela, TituloSecao } from '../componentes/ui';
import { QUEIMADAS } from '../config';
import { dataCurta, horaCurta, numero } from '../logica/formato';
import { diagnosticoHora } from '../logica/inversao';
import { avaliarRiscos, NIVEIS } from '../logica/riscos';
import { criarEstilos, useTema } from '../tema';

const EMERGENCIA = [
  { numero: '199', nome: 'Defesa Civil', icone: 'shield' },
  { numero: '193', nome: 'Bombeiros', icone: 'flame' },
  { numero: '192', nome: 'SAMU', icone: 'medkit' },
];

export default function TelaAlertas({ painel, escala, local, onVerMapa }) {
  const st = useEstilos();
  const { carregando, ar, clima, rio, queimadas, atualizar } = painel;
  const algum = [ar, clima, rio, queimadas].some((f) => f && f.dados);
  if (!algum && carregando) return <Carregando texto="Consultando os servidores…" />;

  const riscos = avaliarRiscos({
    ar: ar && ar.dados,
    clima: clima && clima.dados,
    rio: rio && rio.dados,
    focos: queimadas && queimadas.dados,
    local,
    escala,
    raioKm: QUEIMADAS.raioKm,
  });
  if (!riscos.length) return <Falha mensagem="Nenhuma fonte de dados respondeu." onTentar={atualizar} />;

  const ativos = riscos.filter((r) => r.nivel >= 1).length;
  const pior = riscos[0];
  const indisponiveis = carregando ? [] : [
    !(ar && ar.dados) && 'qualidade do ar',
    !(clima && clima.dados) && 'meteorologia (inversão, chuva, calor, umidade)',
    !(rio && rio.dados) && 'rios',
    !(queimadas && queimadas.dados) && 'queimadas',
  ].filter(Boolean);

  return (
    <Tela onAtualizar={atualizar} atualizando={carregando}>
      <View style={[st.resumo, { backgroundColor: (ativos ? pior.cor : NIVEIS[0].cor) + '1f' }]}>
        <Ionicons name={ativos ? 'warning' : 'checkmark-circle'} size={30} color={ativos ? pior.cor : NIVEIS[0].cor} />
        <View style={{ flex: 1 }}>
          <Text style={st.resumoTitulo}>
            {ativos ? `${ativos} ${ativos === 1 ? 'alerta ativo' : 'alertas ativos'}` : 'Tudo tranquilo'}
          </Text>
          <Text style={st.resumoTexto}>
            {ativos ? `O mais importante agora: ${pior.titulo.toLowerCase()}.` : 'Nenhum risco ambiental relevante no momento.'}
          </Text>
        </View>
      </View>

      {indisponiveis.length ? (
        <Aviso tipo="cache" titulo="Algumas fontes não responderam" texto={`Sem dados de ${indisponiveis.join(', ')}. Os demais alertas continuam valendo.`} />
      ) : null}

      {riscos.map((r) => (
        <CartaoRisco key={r.id} risco={r} clima={clima && clima.dados} rio={rio && rio.dados} onVerMapa={onVerMapa} />
      ))}

      <TituloSecao>Emergência</TituloSecao>
      <View style={st.emergencias}>
        {EMERGENCIA.map((e) => (
          <Pressable
            key={e.numero}
            onPress={() => Linking.openURL(`tel:${e.numero}`)}
            style={({ pressed }) => [st.emergencia, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
            accessibilityLabel={`Ligar para ${e.nome}, ${e.numero}`}
          >
            <Ionicons name={e.icone} size={20} color="#e11d48" />
            <Text style={st.emergenciaNumero}>{e.numero}</Text>
            <Text style={st.emergenciaNome}>{e.nome}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={st.nota}>
        Alertas calculados pelo app a partir de dados públicos (Open-Meteo, CAMS, GloFAS e INPE). Em situação de risco,
        siga sempre as orientações oficiais da Defesa Civil.
      </Text>
    </Tela>
  );
}

function CartaoRisco({ risco, clima, rio, onVerMapa }) {
  const c = useTema();
  const st = useEstilos();
  return (
    <Cartao estilo={st.risco}>
      <View style={[st.faixa, { backgroundColor: risco.cor }]} />
      <View style={st.riscoTopo}>
        <View style={[st.riscoIcone, { backgroundColor: risco.cor + '22' }]}>
          <Ionicons name={risco.icone} size={22} color={risco.cor} />
        </View>
        <Text style={st.riscoTitulo}>{risco.titulo}</Text>
        <View style={[st.nivel, { backgroundColor: risco.cor }]}>
          <Text style={st.nivelTexto}>{risco.rotulo}</Text>
        </View>
      </View>
      <Text style={st.riscoResumo}>{risco.resumo}</Text>
      <View style={st.conselho}>
        <Ionicons name="bulb" size={16} color={c.primaria} />
        <Text style={st.conselhoTexto}>{risco.conselho}</Text>
      </View>
      {risco.id === 'inversao' && clima ? <Perfil clima={clima} /> : null}
      {risco.id === 'chuva' && clima ? <ChuvaHoras clima={clima} /> : null}
      {risco.id === 'rio' && rio ? <Vazao rio={rio} /> : null}
      {risco.id === 'queimadas' && risco.perto.length ? (
        <View style={{ marginTop: 10 }}>
          {risco.perto.slice(0, 3).map((f) => (
            <Text key={`${f.lat},${f.lon}`} style={st.foco}>
              🔥 a {Math.round(f.distancia)} km · {f.satelite} · {f.data.slice(11, 16)} UTC
            </Text>
          ))}
          <View style={{ marginTop: 10 }}>
            <Botao titulo="Ver focos no mapa" icone="map" variante="secundario" onPress={onVerMapa} />
          </View>
        </View>
      ) : null}
    </Cartao>
  );
}

// Perfil vertical de temperatura: barras de cima (mais alto) para baixo.
function Perfil({ clima }) {
  const st = useEstilos();
  const { perfil, inversao } = diagnosticoHora(clima, clima.idxAgora);
  if (perfil.length < 2) return null;
  const temps = perfil.map((p) => p.temperatura);
  const min = Math.min(...temps);
  const faixa = Math.max(1, Math.max(...temps) - min);
  return (
    <View style={st.perfil}>
      <Text style={st.perfilTitulo}>Temperatura por altitude agora</Text>
      {[...perfil].reverse().map((p) => {
        const quente = inversao.topo !== null && p.altura === inversao.topo;
        return (
          <View key={p.nivel} style={st.perfilLinha}>
            <Text style={st.perfilAltura}>{p.altura < 10 ? 'Solo' : `${p.altura} m`}</Text>
            <View style={{ flex: 1 }}>
              <View
                style={[
                  st.perfilBarra,
                  { width: `${25 + ((p.temperatura - min) / faixa) * 75}%`, backgroundColor: quente ? '#f97316' : '#60a5fa' },
                ]}
              />
            </View>
            <Text style={[st.perfilTemp, quente && { color: '#f97316' }]}>{numero(p.temperatura)} °C</Text>
          </View>
        );
      })}
      <Text style={st.perfilNota}>
        Normalmente o ar esfria com a altura. Se uma camada de cima está mais quente (laranja), ela funciona como uma tampa
        e prende a poluição perto do chão.
      </Text>
    </View>
  );
}

function ChuvaHoras({ clima }) {
  const st = useEstilos();
  const i0 = clima.idxAgora;
  const itens = clima.serie.chuva.slice(i0, i0 + 24).map((v, k) => ({
    chave: clima.serie.tempos[i0 + k],
    valor: v,
    cor: v >= 10 ? '#7c3aed' : v >= 2.5 ? '#2563eb' : '#93c5fd',
    rotulo: k === 0 ? 'agora' : k % 6 === 0 ? horaCurta(clima.serie.tempos[i0 + k]).slice(0, 2) + 'h' : '',
  }));
  if (!itens.some((i) => i.valor > 0)) return null;
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={st.perfilTitulo}>Chuva prevista (mm por hora)</Text>
      <Grafico itens={itens} larguraBarra={7} altura={60} />
    </View>
  );
}

function Vazao({ rio }) {
  const st = useEstilos();
  const itens = rio.dias.map((d, k) => ({
    chave: d.data,
    valor: d.vazao === null ? null : Math.round(d.vazao),
    cor: k < rio.hoje ? '#94a3b8' : '#0ea5e9',
    rotulo: k % 3 === 0 ? dataCurta(d.data) : '',
    destaque: k === rio.hoje,
  }));
  return (
    <View style={{ marginTop: 12 }}>
      <Text style={st.perfilTitulo}>Vazão do rio mais próximo (m³/s) — cinza: passado · azul: previsão</Text>
      <Grafico itens={itens} larguraBarra={12} altura={60} />
    </View>
  );
}

const useEstilos = criarEstilos((c) => ({
  resumo: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 20, padding: 16, marginBottom: 16 },
  resumoTitulo: { fontSize: 18, fontWeight: '800', color: c.texto },
  resumoTexto: { fontSize: 14, color: c.textoSec, marginTop: 2 },
  risco: { paddingLeft: 20, overflow: 'hidden' },
  faixa: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  riscoTopo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  riscoIcone: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  riscoTitulo: { flex: 1, fontSize: 16, fontWeight: '800', color: c.texto },
  nivel: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  nivelTexto: { color: '#fff', fontSize: 12, fontWeight: '800' },
  riscoResumo: { fontSize: 14, color: c.texto, marginTop: 12, lineHeight: 20 },
  conselho: { flexDirection: 'row', gap: 8, marginTop: 10, backgroundColor: c.superficie2, borderRadius: 12, padding: 10 },
  conselhoTexto: { flex: 1, fontSize: 13, color: c.textoSec, lineHeight: 19 },
  foco: { fontSize: 13, color: c.textoSec, marginTop: 4 },
  perfil: { marginTop: 12, backgroundColor: c.superficie2, borderRadius: 12, padding: 12 },
  perfilTitulo: { fontSize: 12, fontWeight: '700', color: c.textoSec, marginBottom: 8 },
  perfilLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 3 },
  perfilAltura: { width: 56, fontSize: 12, color: c.textoSec },
  perfilBarra: { height: 12, borderRadius: 6 },
  perfilTemp: { width: 62, textAlign: 'right', fontSize: 13, fontWeight: '700', color: c.texto },
  perfilNota: { fontSize: 12, color: c.textoTer, marginTop: 8, lineHeight: 17 },
  emergencias: { flexDirection: 'row', gap: 10 },
  emergencia: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    backgroundColor: c.superficie,
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: c.borda,
  },
  emergenciaNumero: { fontSize: 20, fontWeight: '800', color: c.texto },
  emergenciaNome: { fontSize: 12, color: c.textoSec },
  nota: { fontSize: 12, color: c.textoTer, marginTop: 14, lineHeight: 17, textAlign: 'center' },
}));
