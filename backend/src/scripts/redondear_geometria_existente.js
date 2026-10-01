// scripts/redondear_geometria_existente.js
//
// Redondea a 6 decimales las coordenadas de la geometría ya guardada en
// contenido_capas (para las capas subidas ANTES de añadir el redondeo
// automático al guardar). Reduce el tamaño sin pérdida de precisión real
// para este uso (6 decimales ≈ 11 cm).
//
// Uso: node scripts/redondear_geometria_existente.js [--dry-run] [--capa-id=26]

const pool = require('../db');

const DRY_RUN = process.argv.includes('--dry-run');
const soloCapaArg = process.argv.find(a => a.startsWith('--capa-id='));
const soloCapaId = soloCapaArg ? Number(soloCapaArg.split('=')[1]) : null;

function redondearCoordenadas(coords, decimales) {
  if (typeof coords[0] === 'number') {
    return coords.map(n => Number(n.toFixed(decimales)));
  }
  return coords.map(c => redondearCoordenadas(c, decimales));
}

function redondearGeometria(geometry, decimales = 6) {
  if (!geometry) return geometry;
  if (Array.isArray(geometry.coordinates)) {
    return { ...geometry, coordinates: redondearCoordenadas(geometry.coordinates, decimales) };
  }
  if (Array.isArray(geometry.geometries)) {
    return { ...geometry, geometries: geometry.geometries.map(g => redondearGeometria(g, decimales)) };
  }
  return geometry;
}

async function main() {
  console.log(DRY_RUN ? '── Dry run ──' : '── Redondeando geometría existente ──');

  const where = soloCapaId
    ? `WHERE deleted = false AND capa_id = ${Number(soloCapaId)}`
    : 'WHERE deleted = false';

  const { rows } = await pool.query(
    `SELECT id, capa_id, geometry FROM contenido_capas ${where} ORDER BY id`
  );
  console.log(`Filas a procesar: ${rows.length}`);

  let antesTotal = 0;
  let despuesTotal = 0;
  let procesadas = 0;

  for (const fila of rows) {
    const antes = fila.geometry;
    let geomOriginal;
    try {
      geomOriginal = JSON.parse(antes);
    } catch (e) {
      console.warn(`  Fila ${fila.id} (capa ${fila.capa_id}): geometry no es JSON válido, se omite`);
      continue;
    }
    const geomRedondeada = redondearGeometria(geomOriginal);
    const despues = JSON.stringify(geomRedondeada);

    antesTotal += antes.length;
    despuesTotal += despues.length;

    if (despues.length < antes.length) {
      if (!DRY_RUN) {
        await pool.query('UPDATE contenido_capas SET geometry = $1 WHERE id = $2', [despues, fila.id]);
      }
      procesadas++;
    }
  }

  const ahorro = antesTotal ? (100 * (antesTotal - despuesTotal) / antesTotal).toFixed(1) : 0;
  console.log(`\nFilas modificadas: ${procesadas} / ${rows.length}`);
  console.log(`Tamaño antes:   ${(antesTotal / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Tamaño después: ${(despuesTotal / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Ahorro: ${ahorro}%`);

  await pool.end();
}

main().catch(err => {
  console.error('Error inesperado:', err);
  process.exit(1);
});
