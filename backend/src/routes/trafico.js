const express = require('express');
const router  = express.Router();

const URL_DGT = 'https://nap.dgt.es/datex2/v3/dgt/SituationPublication/datex2_v37.xml';
const BBOX_AVILA = { oeste: -5.8, sur: 40.0, este: -4.2, norte: 41.3 };
const DURACION_CACHE = 3 * 60 * 1000;

const TIPOS = {
  roadworks: 'Obras',
  vehicleStuck: 'Vehículo detenido',
  vehicleOnFire: 'Vehículo en llamas',
  objectOnTheRoad: 'Objeto en la calzada',
  spillageOnTheRoad: 'Vertido en la calzada',
  accident: 'Accidente',
  rockfalls: 'Desprendimientos',
  flooding: 'Inundación',
  avalanches: 'Aludes',
  damagedRoadSurface: 'Firme en mal estado',
  slowTraffic: 'Retención',
  rain: 'Lluvia',
  other: 'Restricción de circulación',
};

let cache = { fecha: 0, datos: null };

function valor(texto, etiqueta) {
  const m = texto.match(new RegExp(`<${etiqueta}>([^<]*)</${etiqueta}>`));
  if (!m) return null;
  const utf8 = Buffer.from(m[1], 'latin1').toString('utf8');
  return utf8.includes('�') ? m[1] : utf8;
}

function incidenciaAFeature(registro) {
  const lat = parseFloat(valor(registro, 'loc:latitude'));
  const lon = parseFloat(valor(registro, 'loc:longitude'));
  if (isNaN(lat) || isNaN(lon)) return null;
  if (lon < BBOX_AVILA.oeste || lon > BBOX_AVILA.este || lat < BBOX_AVILA.sur || lat > BBOX_AVILA.norte) return null;

  const detalle = registro.match(/<sit:detailedCauseType>\s*<sit:\w+>(\w+)</);
  const tipo = detalle ? detalle[1] : valor(registro, 'sit:causeType');

  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: {
      id: registro.match(/ id="([^"]+)"/)?.[1],
      tipo,
      descripcion: TIPOS[tipo] ?? 'Incidencia',
      carretera: valor(registro, 'loc:roadName'),
      km: valor(registro, 'lse:kilometerPoint'),
      municipio: valor(registro, 'lse:municipality'),
      inicio: valor(registro, 'com:overallStartTime'),
    },
  };
}

async function obtenerIncidencias() {
  if (cache.datos && Date.now() - cache.fecha < DURACION_CACHE) return cache.datos;

  const respuesta = await fetch(URL_DGT);
  if (!respuesta.ok) throw new Error(`DGT respondió ${respuesta.status}`);
  const xml = Buffer.from(await respuesta.arrayBuffer()).toString('latin1');

  const registros = xml.match(/<sit:situationRecord [\s\S]*?<\/sit:situationRecord>/g) ?? [];
  const features = registros.map(incidenciaAFeature).filter(Boolean);

  cache = { fecha: Date.now(), datos: { type: 'FeatureCollection', features } };
  return cache.datos;
}

router.get('/', async (req, res) => {
  try {
    res.json(await obtenerIncidencias());
  } catch (err) {
    console.error(err);
    if (cache.datos) return res.json(cache.datos);
    res.status(502).json({ error: 'Error obteniendo incidencias de tráfico.' });
  }
});

module.exports = router;
