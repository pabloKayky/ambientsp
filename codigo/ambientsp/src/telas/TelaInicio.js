// Aba "Início": resumo do ar em linguagem simples, alertas ativos, o que fazer
// agora, tempo, próximas horas e poluentes.

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import InfoPoluente from '../componentes/InfoPoluente';
import { Aviso, Botao, Carregando, Cartao, Falha, Tela, TituloSecao } from '../componentes/ui';
import { QUEIMADAS } from '../config';
import { dataHora, horaCurta, numero } from '../logica/formato';
import { CO_UGM3_POR_PPM, faixaCetesb, indiceCetesb, indiceNaEscala } from '../logica/indices';
import { tendencia } from '../logica/relatorio';
import { avaliarRiscos, faixaAtual, gravidadeAr, recomendacoes } from '../logica/riscos';
import { descreverTempo, direcaoVento, nivelUV } from '../logica/tempo';
import { ajustarCor, criarEstilos, sombra, useTema } from '../tema';

const ROSTO = ['happy', 'happy-outline', 'sad-outline', 'sad'];
const TOM = { ok: '#12b76a', atencao: '#f59e0b', evite: '#ef4444' };

const DESCRICAO = {
  mp25: 'Partículas finas',
  mp10: 'Partículas inaláveis',
  o3: 'Ozônio',
  no2: 'Dióxido de nitrogênio',
  co: 'Monóxido de carbono',
  so2: 'Dióxido de enxofre',
};

export default function TelaInicio({ painel, escala, onEscala, local, onAbrirAlertas }) {
  const st = useEstilos();
  const [poluente, setPoluente] = useState(null);
  const { carregando, ar, clima, rio, queimadas, atualizar } = painel;

  if (!ar || (carregando && !ar.dados)) return <Carregando texto="Consultando os servidores…" />;
  if (!ar.dados) {
    return (
      <Tela onAtualizar={atualizar} atualizando={carregando}>
        <Falha mensagem={ar.erro} onTentar={atualizar} />
        <Text style={st.credito}>Dados: CAMS / Open-Meteo</Text>
      </Tela>
    );
  }

  const dadosClima = clima && clima.dados;
  const riscos = avaliarRiscos({
    ar: ar.dados,
    clima: dadosClima,
    rio: rio && rio.dados,
    focos: queimadas && queimadas.dados,
    local,
    escala,
    raioKm: QUEIMADAS.raioKm,
  });
  const ativos = riscos.filter((r) => r.nivel >= 1 && r.id !== 'ar');
  const atual = faixaAtual(ar.dados, escala);
  const recs = recomendacoes({ gravidade: gravidadeAr(atual.faixa), clima: dadosClima });

  return (
    <Tela onAtualizar={atualizar} atualizando={carregando}>
      {ar.origem === 'cache' && carregando ? (
        <Aviso tipo="info" titulo="Atualizando…" texto={`Mostrando os dados salvos em ${dataHora(ar.atualizadoEm)} enquanto o servidor responde.`} />
      ) : null}
      {ar.origem === 'cache' && !carregando ? (
        <Aviso
          tipo="cache"
          titulo="Você está vendo dados salvos"
          texto={`${ar.erro} Última atualização em ${dataHora(ar.atualizadoEm)}.`}
        />
      ) : null}

      <Destaque ar={ar.dados} escala={escala} onEscala={onEscala} atual={atual} />

      <TituloSecao acao={{ rotulo: 'Ver todos', onPress: onAbrirAlertas }}>Alertas</TituloSecao>
      {ativos.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.alertas} contentContainerStyle={{ gap: 10 }}>
          {ativos.map((r) => (
            <Pressable
              key={r.id}
              onPress={onAbrirAlertas}
              style={({ pressed }) => [st.alerta, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
              accessibilityLabel={`Alerta: ${r.titulo}, nível ${r.rotulo}`}
            >
              <View style={[st.alertaIcone, { backgroundColor: r.cor + '26' }]}>
                <Ionicons name={r.icone} size={20} color={r.cor} />
              </View>
              <Text style={st.alertaTitulo} numberOfLines={1}>
                {r.titulo}
              </Text>
              <Text style={[st.alertaNivel, { color: r.cor }]}>{r.rotulo}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : (
        <Cartao estilo={st.tudoBem}>
          <View style={st.linhaIcone}>
            <Ionicons name="checkmark-circle" size={22} color="#12b76a" />
            <Text style={st.tudoBemTexto}>Nenhum alerta ambiental no momento.</Text>
          </View>
        </Cartao>
      )}

      <TituloSecao>O que fazer agora</TituloSecao>
      <Cartao>
        {recs.map((r, i) => (
          <View key={r.id} style={[st.rec, i === recs.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={[st.recIcone, { backgroundColor: TOM[r.tom] + '22' }]}>
              <Ionicons name={r.icone} size={18} color={TOM[r.tom]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.recTitulo}>{r.titulo}</Text>
              <Text style={st.recTexto}>{r.texto}</Text>
            </View>
          </View>
        ))}
      </Cartao>

      {dadosClima ? (
        <>
          <TituloSecao>Tempo agora</TituloSecao>
          <TempoAgora clima={dadosClima} />
          <TituloSecao>Próximas horas</TituloSecao>
          <ProximasHoras ar={ar.dados} clima={dadosClima} escala={escala} />
        </>
      ) : !clima && carregando ? null : (
        <Aviso
          tipo="erro"
          titulo="Meteorologia indisponível"
          texto={`${clima ? clima.erro : ''} A qualidade do ar continua funcionando normalmente.`}
        />
      )}

      <TituloSecao>Poluentes</TituloSecao>
      <Poluentes ar={ar.dados} onAbrir={setPoluente} />

      <Botao titulo="Atualizar" icone="refresh" variante="secundario" onPress={atualizar} desabilitado={carregando} />
      <Text style={st.credito}>Dados: CAMS / Open-Meteo · INPE · GloFAS</Text>
      <InfoPoluente poluente={poluente} onFechar={() => setPoluente(null)} />
    </Tela>
  );
}

function Destaque({ ar, escala, onEscala, atual }) {
  const st = useEstilos();
  const g = gravidadeAr(atual.faixa);
  const tend = tendencia(ar.serie, escala, ar.idxAgora, 3);
  const cor = atual.faixa.cor;
  return (
    <LinearGradient
      colors={[cor, ajustarCor(cor, 0.3)]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={st.destaque}
      testID="cartao-indice"
    >
      <View style={st.destaqueTopo}>
        <View style={{ flex: 1 }}>
          <Text style={st.destaqueRotulo}>QUALIDADE DO AR AGORA</Text>
          <Text style={st.destaqueFaixa}>{atual.faixa.rotulo}</Text>
        </View>
        <View style={st.circulo}>
          <Text style={st.circuloValor}>{atual.indice ?? '—'}</Text>
          <Text style={st.circuloEscala}>{escala}</Text>
        </View>
      </View>
      <View style={st.linhaIcone}>
        <Ionicons name={g === null ? 'help-circle' : ROSTO[g]} size={22} color="#fff" />
        <Text style={st.destaqueConselho}>{atual.faixa.conselho}</Text>
      </View>
      {atual.critico ? <Text style={st.destaqueDetalhe}>Poluente que mais pesa: {atual.critico.nome}</Text> : null}
      <View style={st.destaqueRodape}>
        <Text style={st.destaqueDetalhe}>
          Atualizado às {horaCurta(ar.atual.hora)}
          {tend ? ` · ${tend.direcao === 'estável' ? 'estável' : tend.direcao} nas próximas 3h` : ''}
        </Text>
        <View style={st.escalas}>
          {['EPA', 'CETESB'].map((e) => (
            <Pressable
              key={e}
              onPress={() => onEscala(e)}
              style={[st.escala, escala === e && st.escalaAtiva]}
              accessibilityRole="button"
              accessibilityLabel={`Escala ${e}`}
              accessibilityState={{ selected: escala === e }}
            >
              <Text style={[st.escalaTexto, escala === e && { color: cor }]}>{e}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    </LinearGradient>
  );
}

function TempoAgora({ clima }) {
  const c = useTema();
  const st = useEstilos();
  const a = clima.atual;
  const tempo = descreverTempo(a.codigo, a.dia !== false);
  const hoje = clima.dias[0];
  const prob = clima.serie.probChuva.slice(clima.idxAgora, clima.idxAgora + 6).filter((v) => v !== null);
  const itens = [
    { icone: 'water-outline', rotulo: 'Umidade', valor: `${numero(a.umidade, 0)}%` },
    { icone: 'navigate-outline', rotulo: 'Vento', valor: `${numero(a.vento, 0)} km/h ${direcaoVento(a.direcaoVento)}` },
    { icone: 'sunny-outline', rotulo: 'UV', valor: `${numero(a.uv, 0)} · ${nivelUV(a.uv).rotulo}` },
    { icone: 'umbrella-outline', rotulo: 'Chuva (6h)', valor: prob.length ? `${Math.max(...prob)}%` : '—' },
    { icone: 'arrow-up-circle-outline', rotulo: 'Nascer do sol', valor: hoje ? horaCurta(hoje.nascer) : '—' },
    { icone: 'arrow-down-circle-outline', rotulo: 'Pôr do sol', valor: hoje ? horaCurta(hoje.por) : '—' },
  ];
  return (
    <Cartao>
      <View style={st.tempoTopo}>
        <Ionicons name={tempo.icone} size={44} color={c.primaria} />
        <View style={{ flex: 1 }}>
          <Text style={st.tempoTemp}>{numero(a.temperatura, 0)}°C</Text>
          <Text style={st.tempoDesc}>
            {tempo.texto} · sensação de {numero(a.sensacao, 0)}°
          </Text>
        </View>
        {hoje ? (
          <Text style={st.tempoMaxMin}>
            ↑ {numero(hoje.max, 0)}°{'\n'}↓ {numero(hoje.min, 0)}°
          </Text>
        ) : null}
      </View>
      <View style={st.tempoGrade}>
        {itens.map((i) => (
          <View key={i.rotulo} style={st.tempoItem}>
            <Ionicons name={i.icone} size={18} color={c.textoSec} />
            <Text style={st.tempoItemRotulo}>{i.rotulo}</Text>
            <Text style={st.tempoItemValor}>{i.valor}</Text>
          </View>
        ))}
      </View>
    </Cartao>
  );
}

function ProximasHoras({ ar, clima, escala }) {
  const c = useTema();
  const st = useEstilos();
  const posAr = new Map(ar.serie.tempos.map((t, i) => [t, i]));
  const horas = clima.serie.tempos.slice(clima.idxAgora, clima.idxAgora + 24).map((t, k) => {
    const i = clima.idxAgora + k;
    const idxAr = posAr.get(t);
    const qa = idxAr === undefined ? null : indiceNaEscala(escala, ar.serie, idxAr);
    return {
      t,
      agora: k === 0,
      temp: clima.serie.t2m[i],
      prob: clima.serie.probChuva[i],
      tempo: descreverTempo(clima.serie.codigo[i], clima.serie.dia[i] !== 0),
      qa,
    };
  });
  return (
    <Cartao estilo={{ paddingHorizontal: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {horas.map((h) => (
          <View key={h.t} style={[st.hora, h.agora && st.horaAgora]}>
            <Text style={[st.horaRotulo, h.agora && { color: c.primaria }]}>{h.agora ? 'Agora' : horaCurta(h.t)}</Text>
            <Ionicons name={h.tempo.icone} size={22} color={c.textoSec} />
            <Text style={st.horaTemp}>{numero(h.temp, 0)}°</Text>
            <Text style={st.horaChuva}>{h.prob >= 20 ? `${h.prob}%` : ' '}</Text>
            {h.qa && h.qa.indice !== null ? (
              <View style={[st.horaAr, { backgroundColor: h.qa.faixa.cor }]}>
                <Text style={st.horaArTexto}>{h.qa.indice}</Text>
              </View>
            ) : (
              <View style={[st.horaAr, { backgroundColor: c.superficie2 }]} />
            )}
          </View>
        ))}
      </ScrollView>
      <Text style={st.legendaHoras}>Bolinha colorida = índice de qualidade do ar ({escala}) previsto para a hora.</Text>
    </Cartao>
  );
}

function Poluentes({ ar, onAbrir }) {
  const c = useTema();
  const st = useEstilos();
  const { porPoluente } = indiceCetesb(ar.serie, ar.idxAgora);
  const agora = {
    mp25: ar.atual.pm25,
    mp10: ar.atual.pm10,
    o3: ar.atual.o3,
    no2: ar.atual.no2,
    so2: ar.atual.so2,
    co: ar.atual.co == null ? null : ar.atual.co / CO_UGM3_POR_PPM,
  };
  return (
    <Cartao estilo={{ paddingVertical: 6 }}>
      {porPoluente.map((p, i) => {
        const faixa = faixaCetesb(p.indice);
        return (
          <Pressable
            key={p.chave}
            onPress={() => onAbrir(p)}
            style={({ pressed }) => [st.pol, i === porPoluente.length - 1 && { borderBottomWidth: 0 }, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel={`Saiba mais sobre ${p.nome}`}
          >
            <View style={[st.polPonto, { backgroundColor: faixa.cor }]} />
            <View style={{ flex: 1 }}>
              <Text style={st.polNome}>{p.nome}</Text>
              <Text style={st.polDesc}>
                {DESCRICAO[p.chave]} · {faixa.rotulo}
              </Text>
            </View>
            <Text style={st.polValor}>
              {numero(agora[p.chave], p.chave === 'co' ? 2 : 1)}
              <Text style={st.polUnidade}> {p.unidade}</Text>
            </Text>
            <Ionicons name="chevron-forward" size={18} color={c.textoTer} />
          </Pressable>
        );
      })}
    </Cartao>
  );
}

const useEstilos = criarEstilos((c) => ({
  credito: { marginTop: 18, fontSize: 12, color: c.textoTer, textAlign: 'center' },
  destaque: { borderRadius: 24, padding: 20, marginBottom: 18, ...sombra(c, 2) },
  destaqueTopo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  destaqueRotulo: { color: '#fff', opacity: 0.85, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  destaqueFaixa: { color: '#fff', fontSize: 30, fontWeight: '800', marginTop: 4, lineHeight: 36 },
  circulo: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circuloValor: { color: '#fff', fontSize: 36, fontWeight: '800', lineHeight: 40 },
  circuloEscala: { color: '#fff', fontSize: 11, fontWeight: '700', opacity: 0.9 },
  linhaIcone: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  destaqueConselho: { flex: 1, color: '#fff', fontSize: 15, lineHeight: 21, fontWeight: '500' },
  destaqueDetalhe: { color: '#fff', opacity: 0.92, fontSize: 13, marginTop: 8, flexShrink: 1 },
  destaqueRodape: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
  },
  escalas: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.15)', borderRadius: 999, padding: 2 },
  escala: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  escalaAtiva: { backgroundColor: '#fff' },
  escalaTexto: { color: '#fff', fontSize: 12, fontWeight: '800' },
  alertas: { marginBottom: 18, marginHorizontal: -16, paddingHorizontal: 16 },
  alerta: {
    width: 132,
    backgroundColor: c.superficie,
    borderRadius: 18,
    padding: 12,
    borderWidth: c.escuro ? 1 : 0,
    borderColor: c.borda,
    ...sombra(c),
  },
  alertaIcone: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  alertaTitulo: { fontSize: 14, fontWeight: '700', color: c.texto },
  alertaNivel: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  tudoBem: { paddingVertical: 12 },
  tudoBemTexto: { flex: 1, color: c.texto, fontSize: 14, fontWeight: '600' },
  rec: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: c.borda },
  recIcone: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  recTitulo: { fontSize: 15, fontWeight: '700', color: c.texto },
  recTexto: { fontSize: 14, color: c.textoSec, marginTop: 2, lineHeight: 19 },
  tempoTopo: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tempoTemp: { fontSize: 38, fontWeight: '800', color: c.texto, lineHeight: 44 },
  tempoDesc: { fontSize: 14, color: c.textoSec },
  tempoMaxMin: { fontSize: 14, fontWeight: '700', color: c.textoSec, textAlign: 'right', lineHeight: 22 },
  tempoGrade: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, rowGap: 10 },
  tempoItem: { width: '33.33%', alignItems: 'center', gap: 2 },
  tempoItemRotulo: { fontSize: 12, color: c.textoTer },
  tempoItemValor: { fontSize: 13, fontWeight: '700', color: c.texto, textAlign: 'center' },
  hora: { width: 60, alignItems: 'center', gap: 4, paddingVertical: 8, borderRadius: 14 },
  horaAgora: { backgroundColor: c.primariaSuave },
  horaRotulo: { fontSize: 12, fontWeight: '700', color: c.textoSec },
  horaTemp: { fontSize: 15, fontWeight: '800', color: c.texto },
  horaChuva: { fontSize: 11, color: '#3b82f6', fontWeight: '700', height: 14 },
  horaAr: { minWidth: 30, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  horaArTexto: { color: '#fff', fontSize: 11, fontWeight: '800' },
  legendaHoras: { fontSize: 11, color: c.textoTer, marginTop: 8, marginHorizontal: 8 },
  pol: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.borda },
  polPonto: { width: 12, height: 12, borderRadius: 6 },
  polNome: { fontSize: 15, fontWeight: '700', color: c.texto },
  polDesc: { fontSize: 12, color: c.textoSec },
  polValor: { fontSize: 16, fontWeight: '800', color: c.texto },
  polUnidade: { fontSize: 11, fontWeight: '500', color: c.textoSec },
}));
