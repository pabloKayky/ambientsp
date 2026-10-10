// Aba "Previsão": próximas horas, próximos 7 dias e histórico de 7 dias.

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Share, Text, View } from 'react-native';
import Grafico from '../componentes/Grafico';
import { Aviso, Botao, Carregando, Cartao, Falha, Linha, Segmentado, Selo, Tela } from '../componentes/ui';
import { dataCurta, dataHora, diaDaSemana, horaCurta, numero } from '../logica/formato';
import { faixaCetesb, faixaDoIndice } from '../logica/indices';
import {
  agruparPorDia,
  distribuicaoPorFaixa,
  legendaDaEscala,
  melhorHorario,
  pontosDaSerie,
  resumoPeriodo,
} from '../logica/relatorio';
import { descreverTempo } from '../logica/tempo';
import { criarEstilos, useTema } from '../tema';

const MODOS = [
  { valor: 'horas', rotulo: 'Próximas horas' },
  { valor: 'dias', rotulo: '7 dias' },
  { valor: 'historico', rotulo: 'Histórico' },
];

export default function TelaPrevisao({ painel, escala, local }) {
  const [modo, setModo] = useState('horas');
  const { carregando, ar, clima, atualizar } = painel;

  if (!ar || (carregando && !ar.dados)) return <Carregando />;
  if (!ar.dados) return <Falha mensagem={ar.erro} onTentar={atualizar} />;

  return (
    <Tela onAtualizar={atualizar} atualizando={carregando}>
      <View style={{ marginBottom: 16 }}>
        <Segmentado opcoes={MODOS} valor={modo} onMudar={setModo} />
      </View>
      {ar.origem === 'cache' ? (
        <Aviso
          tipo={carregando ? 'info' : 'cache'}
          titulo={carregando ? 'Atualizando…' : 'Dados salvos'}
          texto={`${carregando ? 'Mostrando' : 'Sem conexão. Mostrando'} os dados de ${dataHora(ar.atualizadoEm)}.`}
        />
      ) : null}
      {modo === 'horas' ? <Horas ar={ar.dados} clima={clima && clima.dados} escala={escala} /> : null}
      {modo === 'dias' ? <Dias ar={ar.dados} clima={clima && clima.dados} erroClima={clima && clima.erro} escala={escala} /> : null}
      {modo === 'historico' ? <Historico ar={ar.dados} escala={escala} local={local} /> : null}
    </Tela>
  );
}

function Legenda({ escala }) {
  const st = useEstilos();
  return (
    <View style={st.legenda}>
      {legendaDaEscala(escala).map((f) => (
        <View key={f.rotulo} style={st.legendaItem}>
          <View style={[st.legendaCor, { backgroundColor: f.cor }]} />
          <Text style={st.legendaTexto}>{f.rotulo}</Text>
        </View>
      ))}
    </View>
  );
}

function Horas({ ar, clima, escala }) {
  const c = useTema();
  const st = useEstilos();
  const pontos = pontosDaSerie(ar.serie, escala, ar.idxAgora, ar.idxAgora + 48);
  const melhor = melhorHorario(pontos.slice(0, 24));
  const barras = pontos.map((p, i) => ({
    chave: p.hora,
    valor: p.indice,
    cor: p.faixa.cor,
    // Rótulo a cada 6h, mas longe do "agora" para não encostar nele.
    rotulo: i === 0 ? 'agora' : i >= 3 && Number(p.hora.slice(11, 13)) % 6 === 0 ? p.hora.slice(11, 13) + 'h' : '',
    destaque: i === 0,
  }));
  const posClima = clima ? new Map(clima.serie.tempos.map((t, i) => [t, i])) : new Map();

  return (
    <>
      <Cartao titulo={`Qualidade do ar · 48 horas (${escala})`} icone="leaf">
        <Grafico itens={barras} larguraBarra={8} altura={120} />
        <Legenda escala={escala} />
      </Cartao>

      <Cartao titulo="Melhor horário para sair" icone="walk">
        {melhor ? (
          <View style={st.melhor}>
            <View style={[st.melhorCirculo, { backgroundColor: melhor.faixa.cor }]}>
              <Text style={st.melhorValor}>{melhor.indice}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.melhorHora}>
                {diaDaSemana(melhor.hora)}, {horaCurta(melhor.hora)}
              </Text>
              <Text style={st.texto}>
                Ar mais limpo entre 6h e 20h nas próximas 24 horas ({melhor.faixa.rotulo.toLowerCase()}). Bom para
                caminhada, corrida ou bicicleta.
              </Text>
            </View>
          </View>
        ) : (
          <Text style={st.texto}>Sem previsão diurna disponível.</Text>
        )}
      </Cartao>

      <Cartao titulo="Hora a hora" icone="time">
        {pontos.slice(0, 24).map((p, k) => {
          const i = posClima.get(p.hora);
          const tempo = i === undefined ? null : descreverTempo(clima.serie.codigo[i], clima.serie.dia[i] !== 0);
          return (
            <View key={p.hora} style={[st.hora, k === 23 && { borderBottomWidth: 0 }]}>
              <Text style={st.horaRotulo}>{k === 0 ? 'Agora' : horaCurta(p.hora)}</Text>
              {tempo ? <Ionicons name={tempo.icone} size={20} color={c.textoSec} /> : <View style={{ width: 20 }} />}
              <Text style={st.horaTemp}>{i === undefined ? '—' : `${numero(clima.serie.t2m[i], 0)}°`}</Text>
              <View style={st.horaChuva}>
                <Ionicons name="water" size={12} color="#3b82f6" />
                <Text style={st.horaChuvaTexto}>{i === undefined ? '—' : `${clima.serie.probChuva[i] ?? 0}%`}</Text>
              </View>
              <View style={{ flex: 1 }} />
              {p.indice !== null ? <Selo texto={`${p.indice} · ${p.faixa.rotulo}`} cor={p.faixa.cor} claro /> : null}
            </View>
          );
        })}
      </Cartao>
    </>
  );
}

function Dias({ ar, clima, erroClima, escala }) {
  const c = useTema();
  const st = useEstilos();
  if (!clima) {
    return <Aviso tipo="erro" titulo="Previsão do tempo indisponível" texto={erroClima || ''} />;
  }
  const arPorDia = new Map(
    agruparPorDia(pontosDaSerie(ar.serie, escala, ar.idxAgora, ar.serie.tempos.length)).map((d) => [d.dia, d]),
  );
  const minSemana = Math.min(...clima.dias.map((d) => d.min ?? 99));
  const maxSemana = Math.max(...clima.dias.map((d) => d.max ?? -99));
  const faixa = Math.max(1, maxSemana - minSemana);
  return (
    <Cartao>
      {clima.dias.map((d, k) => {
        const tempo = descreverTempo(d.codigo, true);
        const qa = arPorDia.get(d.data);
        return (
          <View key={d.data} style={[st.dia, k === clima.dias.length - 1 && { borderBottomWidth: 0 }]}>
            <View style={{ width: 62 }}>
              <Text style={st.diaNome}>{k === 0 ? 'Hoje' : diaDaSemana(d.data)}</Text>
              <Text style={st.diaData}>{dataCurta(d.data)}</Text>
            </View>
            <Ionicons name={tempo.icone} size={26} color={c.primaria} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={st.diaDesc} numberOfLines={1}>
                {tempo.texto}
              </Text>
              <View style={st.faixaTemp}>
                <Text style={st.diaMin}>{numero(d.min, 0)}°</Text>
                <View style={st.trilhoTemp}>
                  <View
                    style={[
                      st.barraTemp,
                      {
                        left: `${((d.min - minSemana) / faixa) * 100}%`,
                        width: `${Math.max(8, ((d.max - d.min) / faixa) * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={st.diaMax}>{numero(d.max, 0)}°</Text>
              </View>
              <Text style={st.diaInfo}>
                💧 {numero(d.chuva, 1)} mm ({d.probChuva ?? 0}%) · UV {numero(d.uvMax, 0)}
              </Text>
            </View>
            {qa && qa.faixaPior ? (
              <View style={[st.diaAr, { backgroundColor: qa.faixaPior.cor }]}>
                <Text style={st.diaArValor}>{qa.max}</Text>
                <Text style={st.diaArRotulo}>ar</Text>
              </View>
            ) : (
              <View style={st.diaArVazio} />
            )}
          </View>
        );
      })}
      <Text style={st.nota}>
        A bolinha “ar” mostra o pior índice previsto do dia ({escala}). A previsão de qualidade do ar vai até 3 dias.
      </Text>
    </Cartao>
  );
}

const HORAS_PERIODO = 7 * 24;

export function montarRelatorio(serie, idxAgora, escala) {
  const pontos = pontosDaSerie(serie, escala, idxAgora - HORAS_PERIODO + 1, idxAgora + 1);
  return {
    resumo: resumoPeriodo(pontos),
    dias: agruparPorDia(pontos),
    distribuicao: distribuicaoPorFaixa(pontos, escala),
  };
}

export function textoParaCompartilhar({ local, escala, resumo, dias, distribuicao }) {
  return [
    'AmbientSP — Relatório de qualidade do ar',
    `${local.nome}${local.regiao ? ' (' + local.regiao + ')' : ''} · últimos 7 dias · escala ${escala}`,
    '',
    `Média do período: ${resumo.media}`,
    `Pico: ${resumo.pico.indice} em ${dataCurta(resumo.pico.hora)} às ${horaCurta(resumo.pico.hora)}`,
    `Melhor dia: ${dataCurta(resumo.melhorDia.dia)} (média ${resumo.melhorDia.media})`,
    `Pior dia: ${dataCurta(resumo.piorDia.dia)} (média ${resumo.piorDia.media})`,
    '',
    'Média por dia:',
    ...dias.map((d) => `  ${diaDaSemana(d.dia)} ${dataCurta(d.dia)}: ${d.media ?? '—'} (máx ${d.max ?? '—'})`),
    '',
    'Horas por faixa:',
    ...distribuicao.map((f) => `  ${f.rotulo}: ${f.horas} h (${f.pct}%)`),
    '',
    'Dados: CAMS / Open-Meteo (modelo atmosférico, não estação de medição).',
  ].join('\n');
}

function Historico({ ar, escala, local }) {
  const st = useEstilos();
  const { resumo, dias, distribuicao } = montarRelatorio(ar.serie, ar.idxAgora, escala);
  if (!resumo) return <Aviso tipo="info" titulo="Sem histórico" texto="Não há dados suficientes dos últimos 7 dias." />;
  const faixaDe = escala === 'CETESB' ? faixaCetesb : faixaDoIndice;
  const faixaMedia = faixaDe(resumo.media);

  async function compartilhar() {
    try {
      await Share.share({ message: textoParaCompartilhar({ local, escala, resumo, dias, distribuicao }) });
    } catch (e) {
      Alert.alert('Não foi possível compartilhar', e.message);
    }
  }

  return (
    <>
      <View style={st.blocos}>
        <View style={[st.bloco, { backgroundColor: faixaMedia.cor }]}>
          <Text style={st.blocoValor}>{resumo.media}</Text>
          <Text style={st.blocoRotulo}>Média 7 dias</Text>
          <Text style={st.blocoRotulo}>{faixaMedia.rotulo}</Text>
        </View>
        <View style={[st.bloco, { backgroundColor: resumo.pico.faixa.cor }]}>
          <Text style={st.blocoValor}>{resumo.pico.indice}</Text>
          <Text style={st.blocoRotulo}>Pico</Text>
          <Text style={st.blocoRotulo}>
            {dataCurta(resumo.pico.hora)} {horaCurta(resumo.pico.hora)}
          </Text>
        </View>
      </View>
      <Cartao titulo={`Média por dia · ${escala}`} icone="bar-chart">
        <Grafico
          itens={dias.map((d) => ({ chave: d.dia, valor: d.media, cor: faixaDe(d.media).cor, rotulo: dataCurta(d.dia) }))}
          larguraBarra={24}
          altura={110}
          mostrarValor
          rolavel={false}
        />
      </Cartao>
      <Cartao titulo="Horas em cada faixa" icone="pie-chart">
        <View style={st.empilhada}>
          {distribuicao
            .filter((f) => f.horas > 0)
            .map((f) => (
              <View key={f.rotulo} style={{ flex: f.horas, backgroundColor: f.cor }} />
            ))}
        </View>
        {distribuicao.map((f, i) => (
          <Linha key={f.rotulo} rotulo={`${f.rotulo} (${f.faixa})`} valor={`${f.horas} h · ${f.pct}%`} ultimo={i === distribuicao.length - 1} />
        ))}
      </Cartao>
      <Cartao titulo="Destaques" icone="trophy">
        <Linha rotulo="Melhor dia" valor={`${diaDaSemana(resumo.melhorDia.dia)} ${dataCurta(resumo.melhorDia.dia)} · ${resumo.melhorDia.media}`} />
        <Linha rotulo="Pior dia" valor={`${diaDaSemana(resumo.piorDia.dia)} ${dataCurta(resumo.piorDia.dia)} · ${resumo.piorDia.media}`} />
        <Linha
          rotulo={escala === 'CETESB' ? 'Horas com ar ruim ou pior' : 'Horas insalubres (≥ 101)'}
          valor={`${resumo.horasAcimaDeModerado} de ${resumo.horas}`}
          ultimo
        />
      </Cartao>
      <Botao titulo="Compartilhar relatório" icone="share-social" onPress={compartilhar} />
      <Text style={st.nota}>
        Valores de modelo atmosférico (CAMS), hora a hora. Na escala CETESB, cada hora usa as médias móveis exigidas pela
        norma.
      </Text>
    </>
  );
}

const useEstilos = criarEstilos((c) => ({
  texto: { fontSize: 14, color: c.textoSec, lineHeight: 20 },
  nota: { fontSize: 12, color: c.textoTer, marginTop: 10, lineHeight: 17 },
  legenda: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  legendaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendaCor: { width: 10, height: 10, borderRadius: 3 },
  legendaTexto: { fontSize: 12, color: c.textoSec },
  melhor: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  melhorCirculo: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  melhorValor: { color: '#fff', fontSize: 20, fontWeight: '800' },
  melhorHora: { fontSize: 18, fontWeight: '800', color: c.texto, marginBottom: 2 },
  hora: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: c.borda },
  horaRotulo: { width: 48, fontSize: 14, fontWeight: '700', color: c.texto },
  horaTemp: { width: 36, fontSize: 15, fontWeight: '700', color: c.texto },
  horaChuva: { flexDirection: 'row', alignItems: 'center', gap: 3, width: 48 },
  horaChuvaTexto: { fontSize: 13, color: c.textoSec },
  dia: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.borda },
  diaNome: { fontSize: 15, fontWeight: '800', color: c.texto, textTransform: 'capitalize' },
  diaData: { fontSize: 12, color: c.textoTer },
  diaDesc: { fontSize: 13, color: c.textoSec },
  faixaTemp: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  diaMin: { width: 28, fontSize: 13, color: c.textoSec, textAlign: 'right' },
  diaMax: { width: 28, fontSize: 13, fontWeight: '800', color: c.texto },
  trilhoTemp: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.superficie2 },
  barraTemp: { position: 'absolute', top: 0, bottom: 0, borderRadius: 3, backgroundColor: '#f59e0b' },
  diaInfo: { fontSize: 12, color: c.textoSec },
  diaAr: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  diaArVazio: { width: 40 },
  diaArValor: { color: '#fff', fontSize: 13, fontWeight: '800', lineHeight: 15 },
  diaArRotulo: { color: '#fff', fontSize: 9, fontWeight: '700' },
  blocos: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  bloco: { flex: 1, borderRadius: 20, padding: 16, alignItems: 'center' },
  blocoValor: { color: '#fff', fontSize: 36, fontWeight: '800' },
  blocoRotulo: { color: '#fff', fontSize: 13, fontWeight: '600' },
  empilhada: { flexDirection: 'row', height: 16, borderRadius: 8, overflow: 'hidden', marginBottom: 6, backgroundColor: c.superficie2 },
}));
