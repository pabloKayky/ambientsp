// Página HTML do mapa (Leaflet + mapa base Esri). Roda numa WebView (celular)
// ou num iframe (navegador) e conversa com o app por mensagens JSON:
//   app  -> mapa: { tipo: 'dados', dados: { limites, raster, rampa, marcadores, focos, tema } }
//   mapa -> app : { tipo: 'pronto' } | { tipo: 'cidade', id } | { tipo: 'erro', mensagem }
//
// Camadas, de baixo para cima: mapa base -> manchas de calor -> nomes de
// ruas/cidades (ficam legíveis por cima das manchas) -> focos -> marcadores.

export const HTML_MAPA = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>
  html, body, #mapa { margin: 0; padding: 0; height: 100%; background: #dfe3e8; }
  body.escuro, body.escuro #mapa { background: #1b1f27; }
  .calor { filter: blur(6px) saturate(1.15); }
  .marcador {
    transform: translate(-50%, -50%);
    min-width: 34px; height: 34px; padding: 0 6px; box-sizing: border-box;
    border-radius: 17px; border: 2px solid #fff;
    display: flex; align-items: center; justify-content: center;
    font: 800 13px -apple-system, Roboto, sans-serif; color: #fff;
    box-shadow: 0 2px 6px rgba(0,0,0,.35);
    text-shadow: 0 1px 2px rgba(0,0,0,.35);
  }
  .marcador.destaque { outline: 3px solid #2563eb; outline-offset: 2px; }
  .leaflet-control-attribution { font-size: 9px; }
  .leaflet-top.leaflet-right { top: 54px; }
</style>
</head>
<body>
<div id="mapa"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var ESRI = 'https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/';
  var mapa = null, base = null, rotulos = null, calor = null, focos = null, marcadores = null;
  var pronto = false, pendente = null, enquadrado = false, temaAtual = null;

  function enviar(msg) {
    var s = JSON.stringify(msg);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s);
    else if (window.parent && window.parent !== window) window.parent.postMessage(s, '*');
  }

  function rgb(h) {
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }

  // Mesma regra de corNaRampa (src/logica/mapa.js): mistura as cores vizinhas.
  function cor(v, rampa) {
    if (v === null || v === undefined || !rampa.length) return null;
    if (v <= rampa[0].v) return { c: rgb(rampa[0].cor), a: rampa[0].a };
    var u = rampa[rampa.length - 1];
    if (v >= u.v) return { c: rgb(u.cor), a: u.a };
    for (var i = 1; i < rampa.length; i++) {
      if (v <= rampa[i].v) {
        var p = (v - rampa[i - 1].v) / (rampa[i].v - rampa[i - 1].v);
        var a = rgb(rampa[i - 1].cor), b = rgb(rampa[i].cor);
        return {
          c: [0, 1, 2].map(function (k) { return Math.round(a[k] + (b[k] - a[k]) * p); }),
          a: rampa[i - 1].a + (rampa[i].a - rampa[i - 1].a) * p
        };
      }
    }
    return null;
  }

  function imagem(raster, rampa) {
    var n = raster.n, tela = document.createElement('canvas');
    tela.width = n; tela.height = n;
    var ctx = tela.getContext('2d'), img = ctx.createImageData(n, n);
    var meio = (n - 1) / 2;
    for (var i = 0; i < n * n; i++) {
      var k = cor(raster.valores[i], rampa), o = i * 4;
      if (!k) { img.data[o + 3] = 0; continue; }
      // Esmaece em elipse a partir de 75% do raio: a mancha fica arredondada,
      // sem cantos de retângulo.
      var x = (i % n - meio) / meio, y = (Math.floor(i / n) - meio) / meio;
      var r = Math.sqrt(x * x + y * y), t = Math.max(0, Math.min(1, (1.02 - r) / 0.3));
      var suave = t * t * (3 - 2 * t);
      img.data[o] = k.c[0]; img.data[o + 1] = k.c[1]; img.data[o + 2] = k.c[2];
      img.data[o + 3] = Math.round(k.a * 255 * suave);
    }
    ctx.putImageData(img, 0, 0);
    return tela.toDataURL();
  }

  function aplicarTema(tema) {
    if (tema === temaAtual) return;
    temaAtual = tema;
    var estilo = tema === 'escuro' ? 'World_Dark_Gray' : 'World_Light_Gray';
    document.body.className = tema === 'escuro' ? 'escuro' : '';
    if (base) mapa.removeLayer(base);
    if (rotulos) mapa.removeLayer(rotulos);
    base = L.tileLayer(ESRI + estilo + '_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16, attribution: 'Esri, HERE, Garmin, &copy; OpenStreetMap'
    }).addTo(mapa);
    rotulos = L.tileLayer(ESRI + estilo + '_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16, pane: 'rotulos'
    }).addTo(mapa);
  }

  function atualizar(d) {
    if (!pronto) { pendente = d; return; }
    aplicarTema(d.tema);
    var b = d.limites, area = [[b.latMin, b.lonMin], [b.latMax, b.lonMax]];

    if (d.raster) {
      var url = imagem(d.raster, d.rampa);
      if (calor) calor.setUrl(url);
      else calor = L.imageOverlay(url, area, { className: 'calor' }).addTo(mapa);
    } else if (calor) {
      mapa.removeLayer(calor); calor = null;
    }
    if (!enquadrado) { mapa.fitBounds(area, { padding: [8, 8] }); enquadrado = true; }

    focos.clearLayers();
    (d.focos || []).forEach(function (f) {
      L.circleMarker([f.lat, f.lon], {
        radius: 6, color: '#fff', weight: 1.5, fillColor: '#ef4444', fillOpacity: 0.95, pane: 'focos'
      }).addTo(focos);
    });

    marcadores.clearLayers();
    lista = [];
    (d.marcadores || []).forEach(function (m) {
      var icone = L.divIcon({
        className: '', iconSize: null,
        html: '<div class="marcador' + (m.destaque ? ' destaque' : '') + '" style="background:' + m.cor + '">' + m.texto + '</div>'
      });
      var mk = L.marker([m.lat, m.lon], { icon: icone, keyboard: false })
        .on('click', function () { enviar({ tipo: 'cidade', id: m.id }); })
        .addTo(marcadores);
      lista.push({ mk: mk, destaque: m.destaque });
    });
    organizar();
    if (d.voce) {
      L.circleMarker([d.voce.lat, d.voce.lon], {
        radius: 9, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1
      }).addTo(marcadores);
    }
  }

  // Esconde marcadores que ficariam em cima de outro (a ordem da lista é a
  // prioridade: capital primeiro). Ao aproximar o zoom, eles reaparecem.
  var lista = [];
  function organizar() {
    var postos = [];
    lista.forEach(function (item) {
      var p = mapa.latLngToContainerPoint(item.mk.getLatLng());
      var bate = !item.destaque && postos.some(function (q) { return Math.abs(q.x - p.x) < 34 && Math.abs(q.y - p.y) < 30; });
      var el = item.mk.getElement();
      if (el) el.style.display = bate ? 'none' : '';
      if (!bate) postos.push(p);
    });
  }

  function receber(e) {
    try {
      var m = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (m && m.tipo === 'dados') atualizar(m.dados);
    } catch (erro) {}
  }
  window.addEventListener('message', receber);
  document.addEventListener('message', receber);

  if (!window.L) {
    enviar({ tipo: 'erro', mensagem: 'Não foi possível carregar o mapa. Verifique a internet.' });
  } else {
    mapa = L.map('mapa', { zoomControl: false, attributionControl: false, minZoom: 6, maxZoom: 14 })
      .setView([-23.55, -46.63], 9);
    L.control.attribution({ position: 'topright', prefix: 'Leaflet' }).addTo(mapa);
    mapa.createPane('rotulos').style.zIndex = 450;
    mapa.getPane('rotulos').style.pointerEvents = 'none';
    mapa.createPane('focos').style.zIndex = 550;
    focos = L.layerGroup().addTo(mapa);
    marcadores = L.layerGroup().addTo(mapa);
    mapa.on('zoomend', organizar);
    pronto = true;
    enviar({ tipo: 'pronto' });
    if (pendente) atualizar(pendente);
  }
</script>
</body>
</html>`;
