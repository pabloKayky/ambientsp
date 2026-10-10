// Mapa no celular: a página HTML roda numa WebView e recebe os dados por
// injeção de JavaScript. (No navegador, ver Mapa.web.js.)

import { useEffect, useRef, useState } from 'react';
import { WebView } from 'react-native-webview';
import { HTML_MAPA } from './mapaHtml';

export default function Mapa({ dados, onCidade, onErro, estilo }) {
  const ref = useRef(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    if (pronto && dados && ref.current) {
      const msg = JSON.stringify({ tipo: 'dados', dados });
      ref.current.injectJavaScript(`receber({ data: ${JSON.stringify(msg)} }); true;`);
    }
  }, [pronto, dados]);

  function aoReceber(e) {
    let m;
    try {
      m = JSON.parse(e.nativeEvent.data);
    } catch (erro) {
      return;
    }
    if (m.tipo === 'pronto') setPronto(true);
    else if (m.tipo === 'cidade' && onCidade) onCidade(m.id);
    else if (m.tipo === 'erro' && onErro) onErro(m.mensagem);
  }

  return (
    <WebView
      ref={ref}
      testID="mapa"
      style={[{ backgroundColor: 'transparent' }, estilo]}
      originWhitelist={['*']}
      source={{ html: HTML_MAPA }}
      onMessage={aoReceber}
      onLoadEnd={() => setPronto(true)}
      onError={() => onErro && onErro('Não foi possível abrir o mapa.')}
      javaScriptEnabled
      scrollEnabled={false}
      overScrollMode="never"
      setBuiltInZoomControls={false}
    />
  );
}
