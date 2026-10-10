// Aba "Mais": aparência, escala, local, sistema distribuído (servidores,
// latência, registro de requisições) e informações sobre o app.

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Aviso, Botao, Cartao, Linha, Segmentado, Tela, TituloSecao } from '../componentes/ui';
import { REDE, SERVIDORES, USAR_MOCK } from '../config';
import { horaComSegundos } from '../logica/formato';
import { limparTudo } from '../servicos/cache';
import { estatisticasPorServidor, limparRegistros, obterRegistros, ouvirRegistros } from '../servicos/http';
import { criarEstilos, useTema } from '../tema';

const TEMAS = [
  { valor: 'auto', rotulo: 'Automático' },
  { valor: 'claro', rotulo: 'Claro' },
  { valor: 'escuro', rotulo: 'Escuro' },
];

const ESCALAS = [
  { valor: 'EPA', rotulo: 'EPA (EUA)', acessivel: 'Escala EPA' },
  { valor: 'CETESB', rotulo: 'CETESB (SP)', acessivel: 'Escala CETESB' },
];

const NOS = ['ar', 'clima', 'rios', 'queimadas', 'busca', 'mapa'];

export default function TelaMais({ prefs, local, onTrocarLocal }) {
  const c = useTema();
  const st = useEstilos();
  const [registros, setRegistros] = useState(obterRegistros());
  const [verTodos, setVerTodos] = useState(false);
  useEffect(() => ouvirRegistros(setRegistros), []);
  const stats = estatisticasPorServidor(registros);

  function limparCache() {
    Alert.alert('Apagar dados salvos', 'Os dados usados quando você está sem internet serão apagados.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => limparTudo() },
    ]);
  }

  return (
    <Tela>
      <TituloSecao>Preferências</TituloSecao>
      <Cartao titulo="Aparência" icone="contrast">
        <Segmentado opcoes={TEMAS} valor={prefs.tema} onMudar={(v) => prefs.definir('tema', v)} />
        <Text style={st.ajuda}>“Automático” segue o modo claro/escuro do celular.</Text>
      </Cartao>
      <Cartao titulo="Escala de qualidade do ar" icone="speedometer">
        <Segmentado opcoes={ESCALAS} valor={prefs.escala} onMudar={(v) => prefs.definir('escala', v)} />
        <Text style={st.ajuda}>
          EPA é a escala americana que a API entrega pronta (0–500). CETESB é a escala oficial do estado de São Paulo
          (Boa, Moderada, Ruim, Muito ruim, Péssima), calculada pelo app com as médias de cada poluente.
        </Text>
      </Cartao>
      <Cartao titulo="Local" icone="location">
        <Pressable onPress={onTrocarLocal} style={st.local} accessibilityRole="button" accessibilityLabel="Trocar local">
          <View style={{ flex: 1 }}>
            <Text style={st.localNome}>{local.nome}</Text>
            <Text style={st.ajuda}>{local.regiao}</Text>
          </View>
          <Text style={st.trocar}>Trocar</Text>
          <Ionicons name="chevron-forward" size={18} color={c.primaria} />
        </Pressable>
      </Cartao>

      <TituloSecao>Sistema distribuído</TituloSecao>
      {USAR_MOCK ? (
        <Aviso tipo="info" titulo="Modo de desenvolvimento (mock)" texto="Os dados são gerados no aparelho; nenhuma requisição real é feita." />
      ) : null}
      <Cartao titulo="Arquitetura" icone="git-network">
        <View style={st.no}>
          <Ionicons name="phone-portrait" size={20} color={c.primaria} />
          <View style={{ flex: 1 }}>
            <Text style={st.noTitulo}>Cliente: app AmbientSP</Text>
            <Text style={st.noTexto}>Interface, cálculo CETESB, alertas, mapa de calor e cache offline</Text>
          </View>
        </View>
        <View style={st.seta}>
          <Ionicons name="swap-vertical" size={16} color={c.textoTer} />
          <Text style={st.setaTexto}>HTTPS · JSON/CSV · requisições em paralelo</Text>
        </View>
        {NOS.map((k) => {
          const s = SERVIDORES[k];
          const est = stats.find((x) => x.servidor === s.nome);
          const online = est && est.ultima && est.ultima.ok;
          return (
            <View key={k} style={st.servidor}>
              <View style={[st.ponto, { backgroundColor: !est ? c.textoTer : online ? c.ok : c.erro }]} />
              <View style={{ flex: 1 }}>
                <Text style={st.noTitulo}>{s.nome}</Text>
                <Text style={st.noTexto}>
                  {s.host} · {s.fonte}
                </Text>
              </View>
              <Text style={st.latencia}>
                {est ? (est.latenciaMedia !== null ? `${est.latenciaMedia} ms` : 'falhando') : k === 'mapa' ? 'via mapa' : '—'}
              </Text>
            </View>
          );
        })}
      </Cartao>

      <Cartao titulo="Saúde dos servidores" icone="pulse">
        {stats.length === 0 ? (
          <Text style={st.ajuda}>Nenhuma requisição registrada ainda.</Text>
        ) : (
          stats.map((s, i) => (
            <Linha
              key={s.servidor}
              rotulo={`${s.servidor} (${s.total} req.)`}
              valor={`${s.taxaSucesso}% ok`}
              cor={s.taxaSucesso >= 90 ? c.ok : s.taxaSucesso >= 50 ? c.alerta : c.erro}
              ultimo={i === stats.length - 1}
            />
          ))
        )}
      </Cartao>

      <Cartao titulo="Tolerância a falhas" icone="shield-checkmark">
        <Linha rotulo="Tempo limite por tentativa" valor={`${REDE.timeoutMs / 1000} s`} />
        <Linha rotulo="Tentativas por requisição" valor={`até ${REDE.tentativas}`} />
        <Linha rotulo="Espera entre tentativas" valor={`${REDE.esperaBaseMs} ms, ${REDE.esperaBaseMs * 2} ms…`} />
        <Linha rotulo="Sem internet" valor="usa dados salvos" />
        <Linha rotulo="Um servidor fora do ar" valor="os outros continuam" ultimo />
        <Text style={st.ajuda}>
          Falta de rede, tempo esgotado, erro 5xx e 429 são repetidos (falhas passageiras). Erros 4xx não, porque repetir
          o mesmo pedido daria o mesmo erro.
        </Text>
      </Cartao>

      <Cartao
        titulo="Registro de requisições"
        icone="list"
        direita={<Text style={st.ajudaCurta}>{registros.length}</Text>}
      >
        {registros.length === 0 ? (
          <Text style={st.ajuda}>Nada registrado.</Text>
        ) : (
          registros.slice(0, verTodos ? 40 : 8).map((r) => (
            <View key={r.id} style={st.registro}>
              <Ionicons name={r.ok ? 'checkmark-circle' : 'alert-circle'} size={16} color={r.ok ? c.ok : c.erro} />
              <Text style={st.registroHora}>{horaComSegundos(r.quando)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={st.registroTexto} numberOfLines={1}>
                  {r.servidor} · {r.ok ? `HTTP ${r.status}` : r.erro}
                </Text>
                <Text style={st.registroDetalhe}>
                  {r.ms} ms · tentativa {r.tentativa}
                </Text>
              </View>
            </View>
          ))
        )}
        {registros.length > 8 ? (
          <Pressable onPress={() => setVerTodos((v) => !v)} style={{ marginTop: 10 }} accessibilityRole="button">
            <Text style={st.trocar}>{verTodos ? 'Mostrar menos' : 'Mostrar mais'}</Text>
          </Pressable>
        ) : null}
      </Cartao>
      <View style={{ gap: 10, marginBottom: 14 }}>
        <Botao titulo="Limpar registro" icone="trash" variante="secundario" onPress={limparRegistros} />
        <Botao titulo="Apagar dados salvos (offline)" icone="trash" variante="secundario" onPress={limparCache} />
      </View>

      <TituloSecao>Sobre</TituloSecao>
      <Cartao titulo="AmbientSP" icone="leaf">
        <Text style={st.texto}>
          App de informações ambientais urbanas da Grande São Paulo: qualidade do ar, inversão térmica, chuva e
          alagamento, cheia de rios, ar seco, calor e queimadas. Desenvolvido como APS de Sistemas Distribuídos.
        </Text>
        <Text style={st.subtitulo}>Fontes de dados (APIs públicas)</Text>
        <Text style={st.texto}>
          • Open-Meteo: qualidade do ar (CAMS/Copernicus), meteorologia, rios (GloFAS) e busca de cidades{'\n'}• INPE:
          Programa Queimadas{'\n'}• Mapa base: Esri e OpenStreetMap
        </Text>
        <Text style={st.subtitulo}>Limitações conhecidas</Text>
        <Text style={st.texto}>
          • Os dados vêm de modelos (não de estações de medição) e podem diferir dos boletins oficiais.{'\n'}• A escala
          CETESB é calculada no app a partir do modelo; a CETESB oficial usa as estações.{'\n'}• A resolução do modelo de ar
          é de dezenas de km: as manchas do mapa são interpoladas entre os pontos.{'\n'}• A inversão térmica é estimada pela
          temperatura em 900, 850 e 800 hPa.{'\n'}• Os alertas são informativos; siga sempre a Defesa Civil.
        </Text>
      </Cartao>
    </Tela>
  );
}

const useEstilos = criarEstilos((c) => ({
  ajuda: { fontSize: 13, color: c.textoSec, marginTop: 8, lineHeight: 18 },
  ajudaCurta: { fontSize: 13, color: c.textoSec },
  local: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  localNome: { fontSize: 17, fontWeight: '800', color: c.texto },
  trocar: { color: c.primaria, fontWeight: '700', fontSize: 14 },
  no: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.superficie2, borderRadius: 12, padding: 10 },
  noTitulo: { fontSize: 14, fontWeight: '700', color: c.texto },
  noTexto: { fontSize: 12, color: c.textoSec },
  seta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  setaTexto: { fontSize: 11, color: c.textoTer },
  servidor: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.borda },
  ponto: { width: 10, height: 10, borderRadius: 5 },
  latencia: { fontSize: 12, fontWeight: '700', color: c.textoSec },
  registro: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: c.borda },
  registroHora: { fontSize: 12, color: c.textoSec, fontVariant: ['tabular-nums'] },
  registroTexto: { fontSize: 13, color: c.texto },
  registroDetalhe: { fontSize: 11, color: c.textoTer },
  texto: { fontSize: 14, color: c.textoSec, lineHeight: 21 },
  subtitulo: { fontSize: 14, fontWeight: '800', color: c.texto, marginTop: 14, marginBottom: 4 },
}));
