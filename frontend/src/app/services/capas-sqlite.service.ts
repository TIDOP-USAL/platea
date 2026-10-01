// ─────────────────────────────────────────────
// src/app/services/capas-sqlite.service.ts
// Usado en Android (Capacitor nativo)
//
// La app arranca VACÍA. Al pulsar "Actualizar" se pide el catálogo al
// backend; las capas obligatorias se descargan/actualizan solas si hay
// cambios y el resto las elige el usuario. Cada capa guarda la fecha de su
// última sincronización y las siguientes veces solo baja lo que cambió.
// ─────────────────────────────────────────────

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { firstValueFrom } from 'rxjs';
import { CapasBaseService } from './capas-base.service';
import { Capa, GrupoConCapas, SeccionTipo, Grupo } from '../models/capas.model';
import { environment } from '../environments/environment';

// ── Capas que SIEMPRE se descargan/actualizan si hay cambios ───────────────
// (las necesita la generación de emergencias). Se identifican por nombre_source.
// Ojo: emergencia.ts también usa TerminosMunicipales; si no la quieres
// obligatoria, quítala de aquí.
const NOMBRES_SOURCE_OBLIGATORIAS = [
  'Hidrantes',
  'InventarioRecursos',
  'ParquesExtincionSalvamento',
  'TerminosMunicipales',
];

const TAM_PAGINA = 2000; // filas de contenido_capas por petición

// ── Tipos del catálogo (GET /api/capas/catalogo) ───────────────────────────

export interface CatalogoCapa {
  id: number;
  texto: string;
  tipo: string | null;
  nombre_source: string | null;
  color: string | null;
  grosor: number | null;
  capa_wms: string | null;
  url: string | null;
  imagen: string | null;
  checked: boolean;
  orden: number;
  n_features: number;
  tamano_bytes: number;
  ultima_actualizacion: string | null;
}
export interface CatalogoGrupo   { id: number; nombre: string; orden: number; capas: CatalogoCapa[]; }
export interface CatalogoSeccion { id: number; nombre: string; grupos: CatalogoGrupo[]; }

interface FilaContenido {
  id: number;
  geometry: string;
  properties: string | null;
  updated_at: string;
  deleted: boolean;
}
interface RespuestaFilas {
  capa_id: number;
  generado_en: string;
  incremental: boolean;
  siguiente_id: number | null;
  contenido: FilaContenido[];
}

// ── Tipos de la pantalla de actualización ──────────────────────────────────

export type EstadoCapa = 'nueva' | 'con_cambios' | 'actualizada';

export interface ItemActualizacion {
  seccion: { id: number; nombre: string };
  grupo:   { id: number; nombre: string; orden: number };
  capa:    CatalogoCapa;
  estado:  EstadoCapa;
  obligatoria: boolean;   // se descarga sí o sí si estado != 'actualizada'
  sinContenido: boolean;  // WMS/WMTS: solo metadatos, no hay geometría que bajar
}

export interface PlanActualizacion {
  items: ItemActualizacion[];
  eliminadasEnServidor: number[]; // capas locales que ya no existen en el backend
}

export interface ProgresoActualizacion {
  indice: number;
  total: number;
  capa: string;
  fase: 'metadatos' | 'imagen' | 'contenido' | 'fin';
  filasDescargadas?: number;
}

export interface ResultadoActualizacion {
  correctas: number[];
  errores: { id: number; texto: string; error: string }[];
  eliminadas: number[];
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class CapasSqliteService extends CapasBaseService {
  private sqlite: SQLiteConnection = new SQLiteConnection(CapacitorSQLite);
  private db!: SQLiteDBConnection;
  private api = environment.apiUrl;
  // Blob URLs generadas por capa, para liberarlas al regenerar
  private blobUrls = new Map<number, string>();

  constructor(private http: HttpClient) {
    super();
  }

  // ── Init ─────────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    this.db = await this.sqlite.createConnection('plateagis', false, 'no-encryption', 1, false);
    await this.db.open();
    await this.crearTablas();
    // Ya no se importa nada al arrancar: la app empieza vacía.
  }

  private async crearTablas(): Promise<void> {
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS seccion (
        id     INTEGER PRIMARY KEY,
        nombre TEXT NOT NULL UNIQUE
      );`);
    await this.db.execute(`CREATE TABLE IF NOT EXISTS grupo (
        id         INTEGER PRIMARY KEY,
        id_seccion INTEGER NOT NULL,
        nombre     TEXT    NOT NULL,
        orden      INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (id_seccion) REFERENCES seccion(id)
      );`);
    // imagen = ruta RELATIVA en Directory.Data (no una URL); ultima_actualizacion
    // = generado_en del servidor en la última sincronización COMPLETA de la capa
    // (NULL = descarga a medias o metadatos solo).
    await this.db.execute(`CREATE TABLE IF NOT EXISTS capa (
        id                   INTEGER PRIMARY KEY,
        id_grupo             INTEGER NOT NULL,
        tipo                 TEXT,
        texto                TEXT    NOT NULL,
        imagen               TEXT,
        nombre_source        TEXT,
        url                  TEXT,
        capa_wms             TEXT,
        color                TEXT,
        grosor               REAL,
        checked              BOOLEAN NOT NULL DEFAULT FALSE,
        orden                INTEGER NOT NULL DEFAULT 0,
        ultima_actualizacion TEXT,
        FOREIGN KEY (id_grupo) REFERENCES grupo(id)
      );`);
    await this.db.execute(`CREATE TABLE IF NOT EXISTS contenido_capas (
        id         INTEGER PRIMARY KEY,
        capa_id    INTEGER NOT NULL,
        geometry   TEXT    NOT NULL,
        properties TEXT,
        updated_at TEXT    NOT NULL,
        deleted    BOOLEAN NOT NULL DEFAULT FALSE,
        FOREIGN KEY (capa_id) REFERENCES capa(id)
      );`);
    await this.db.execute(`CREATE INDEX IF NOT EXISTS idx_contenido_capas_capa
        ON contenido_capas(capa_id);`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  ACTUALIZACIÓN (botón "Actualizar" de la app)
  // ══════════════════════════════════════════════════════════════════════════

  /** ¿Hay alguna capa descargada? (para mostrar el estado "vacío" de la app) */
  async tieneCapasDescargadas(): Promise<boolean> {
    const { values } = await this.db.query('SELECT COUNT(*) AS n FROM capa;');
    return !!values && values[0]?.n > 0;
  }

  /**
   * Paso 1: pide el catálogo al backend y lo compara con lo que hay en el
   * dispositivo. Devuelve qué capas son nuevas / tienen cambios / están al día.
   * Las obligatorias con estado distinto de 'actualizada' hay que descargarlas;
   * el resto las decide el usuario.
   */
  async prepararActualizacion(): Promise<PlanActualizacion> {
    const catalogo = await firstValueFrom(
      this.http.get<CatalogoSeccion[]>(`${this.api}/capas/catalogo`)
    );

    const { values } = await this.db.query('SELECT id, ultima_actualizacion FROM capa;');
    const locales = new Map<number, string | null>(
      (values ?? []).map((v: any) => [v.id, v.ultima_actualizacion])
    );

    const items: ItemActualizacion[] = [];
    const idsCatalogo = new Set<number>();

    for (const s of catalogo) {
      for (const g of s.grupos) {
        for (const c of g.capas) {
          idsCatalogo.add(c.id);
          const sinContenido = this.esSinContenido(c);
          const obligatoria = sinContenido || NOMBRES_SOURCE_OBLIGATORIAS.includes(c.nombre_source ?? '');
          
          let estado: EstadoCapa;
          if (!locales.has(c.id)) {
            estado = 'nueva';
          } else if (sinContenido) {
            estado = 'con_cambios'; // solo metadatos: se refrescan siempre (coste ~0)
          } else {
            const local = locales.get(c.id);
            if (!local) estado = 'nueva'; // descarga anterior incompleta
            else if (c.ultima_actualizacion && new Date(c.ultima_actualizacion) > new Date(local)) estado = 'con_cambios';
            else estado = 'actualizada';
          }

          items.push({
            seccion: { id: s.id, nombre: s.nombre },
            grupo: { id: g.id, nombre: g.nombre, orden: g.orden },
            capa: c, estado, obligatoria, sinContenido,
          });
        }
      }
    }

    const eliminadasEnServidor = [...locales.keys()].filter(id => !idsCatalogo.has(id));
    return { items, eliminadasEnServidor };
  }

  /** Items que hay que descargar sí o sí (obligatorios con cambios o nuevos). */
  itemsObligatoriosPendientes(plan: PlanActualizacion): ItemActualizacion[] {
    return plan.items.filter(i => i.obligatoria && i.estado !== 'actualizada');
  }

  /**
   * Paso 2: descarga/actualiza las capas indicadas (las obligatorias
   * pendientes + las que haya elegido el usuario). Un fallo en una capa no
   * detiene las demás.
   */
  async ejecutarActualizacion(
    items: ItemActualizacion[],
    eliminadasEnServidor: number[] = [],
    onProgreso?: (p: ProgresoActualizacion) => void,
  ): Promise<ResultadoActualizacion> {
    const resultado: ResultadoActualizacion = { correctas: [], errores: [], eliminadas: [] };

    for (const id of eliminadasEnServidor) {
      try {
        await this.eliminarCapaLocal(id);
        resultado.eliminadas.push(id);
      } catch (err) {
        console.error('[SQLite] Error eliminando capa local', id, err);
      }
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        await this.sincronizarCapa(item, (fase, filas) =>
          onProgreso?.({ indice: i + 1, total: items.length, capa: item.capa.texto, fase, filasDescargadas: filas })
        );
        resultado.correctas.push(item.capa.id);
      } catch (err: any) {
        console.error('[SQLite] Error sincronizando capa', item.capa.id, err);
        resultado.errores.push({ id: item.capa.id, texto: item.capa.texto, error: err?.message ?? String(err) });
      }
      onProgreso?.({ indice: i + 1, total: items.length, capa: item.capa.texto, fase: 'fin' });
    }
    return resultado;
  }

  // ── Sincronizar una capa ─────────────────────────────────────────────────

  private async sincronizarCapa(
    item: ItemActualizacion,
    progreso: (fase: ProgresoActualizacion['fase'], filas?: number) => void,
  ): Promise<void> {
    const { seccion, grupo, capa, sinContenido } = item;

    const { values } = await this.db.query(
      'SELECT ultima_actualizacion, imagen, checked FROM capa WHERE id = ?;', [capa.id]
    );
    const local = values && values[0] ? values[0] : null;
    const since: string | null = !sinContenido && local?.ultima_actualizacion ? local.ultima_actualizacion : null;

    // 1) Imagen (se guarda en el dispositivo)
    progreso('imagen');
    let imagenRuta: string | null = local?.imagen ?? null;
    if (capa.imagen) {
      const nueva = await this.descargarImagen(capa.id, capa.imagen);
      if (imagenRuta && imagenRuta !== nueva) await this.borrarArchivo(imagenRuta);
      imagenRuta = nueva;
    } else if (imagenRuta) {
      await this.borrarArchivo(imagenRuta);
      imagenRuta = null;
    }

    // 2) Metadatos: seccion/grupo/capa con UPSERT (INSERT OR REPLACE borraría la
    //    fila y rompería las claves foráneas de los hijos). `checked` se respeta
    //    si la capa ya existía (es una preferencia del usuario en este dispositivo).
    progreso('metadatos');
    await this.db.run(
      `INSERT INTO seccion (id, nombre) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre;`,
      [seccion.id, seccion.nombre]
    );
    await this.db.run(
      `INSERT INTO grupo (id, id_seccion, nombre, orden) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET id_seccion = excluded.id_seccion, nombre = excluded.nombre, orden = excluded.orden;`,
      [grupo.id, seccion.id, grupo.nombre, grupo.orden]
    );
    await this.db.run(
      `INSERT INTO capa (id, id_grupo, tipo, texto, imagen, nombre_source, url, capa_wms, color, grosor, checked, orden, ultima_actualizacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         id_grupo = excluded.id_grupo, tipo = excluded.tipo, texto = excluded.texto,
         imagen = excluded.imagen, nombre_source = excluded.nombre_source, url = excluded.url,
         capa_wms = excluded.capa_wms, color = excluded.color, grosor = excluded.grosor,
         orden = excluded.orden;`,
      [
        capa.id, grupo.id, capa.tipo, capa.texto, imagenRuta, capa.nombre_source, capa.url,
        capa.capa_wms, capa.color, capa.grosor,
        local ? (local.checked ? 1 : 0) : (capa.checked ? 1 : 0),
        capa.orden,
        since, // en descarga completa queda NULL hasta que termine con éxito
      ]
    );

    // 3) Contenido (geometría): completo la primera vez, delta después
    if (!sinContenido) {
      progreso('contenido', 0);
      const generadoEn = await this.descargarContenido(capa.id, since, n => progreso('contenido', n));
      await this.db.run('UPDATE capa SET ultima_actualizacion = ? WHERE id = ?;', [generadoEn, capa.id]);
    }
  }

  /**
   * Baja el contenido de una capa por páginas. Sin `since` = descarga completa
   * (vacía antes lo que hubiera); con `since` = solo cambios desde esa fecha.
   * Devuelve el `generado_en` de la PRIMERA página (marca para la próxima vez:
   * lo que cambie mientras se descarga se volverá a pedir).
   */
  private async descargarContenido(
    capaId: number,
    since: string | null,
    onFilas: (acumuladas: number) => void,
  ): Promise<string> {
    if (!since) {
      await this.db.run('DELETE FROM contenido_capas WHERE capa_id = ?;', [capaId]);
    }

    let cursor = 0;
    let generadoEn: string | null = null;
    let total = 0;

    do {
      let url = `${this.api}/capas/${capaId}/geojson?formato=filas&limit=${TAM_PAGINA}&after_id=${cursor}`;
      if (since) url += `&since=${encodeURIComponent(since)}`;

      const pagina = await firstValueFrom(this.http.get<RespuestaFilas>(url));
      if (generadoEn === null) generadoEn = pagina.generado_en;

      await this.aplicarFilas(capaId, pagina.contenido);
      total += pagina.contenido.length;
      onFilas(total);

      cursor = pagina.siguiente_id ?? 0;
    } while (cursor);

    return generadoEn!;
  }

  private async aplicarFilas(capaId: number, filas: FilaContenido[]): Promise<void> {
    if (!filas.length) return;
    const set = filas.map(f => f.deleted
      ? { statement: 'DELETE FROM contenido_capas WHERE id = ?;', values: [f.id] }
      : {
          statement: `INSERT OR REPLACE INTO contenido_capas (id, capa_id, geometry, properties, updated_at, deleted)
                      VALUES (?, ?, ?, ?, ?, 0);`,
          values: [f.id, capaId, f.geometry, f.properties, f.updated_at],
        }
    );
    await this.db.executeSet(set, true); // una transacción por página
  }

  // ── Eliminar una capa del dispositivo ────────────────────────────────────

  async eliminarCapaLocal(capaId: number): Promise<void> {
    const { values } = await this.db.query('SELECT id_grupo, imagen FROM capa WHERE id = ?;', [capaId]);
    const fila = values && values[0];
    if (!fila) return;

    await this.db.run('DELETE FROM contenido_capas WHERE capa_id = ?;', [capaId]);
    await this.db.run('DELETE FROM capa WHERE id = ?;', [capaId]);
    if (fila.imagen) await this.borrarArchivo(fila.imagen);

    const prev = this.blobUrls.get(capaId);
    if (prev) { URL.revokeObjectURL(prev); this.blobUrls.delete(capaId); }

    // Limpiar grupo/sección si se han quedado vacíos
    await this.db.run(
      'DELETE FROM grupo WHERE id = ? AND NOT EXISTS (SELECT 1 FROM capa WHERE id_grupo = grupo.id);',
      [fila.id_grupo]
    );
    await this.db.run(
      'DELETE FROM seccion WHERE NOT EXISTS (SELECT 1 FROM grupo WHERE id_seccion = seccion.id);'
    );
  }

  // ── Imágenes en el dispositivo ───────────────────────────────────────────

  private async descargarImagen(capaId: number, urlImagen: string): Promise<string> {
    const nombre = decodeURIComponent(urlImagen.split('/').pop()!.split('?')[0]);
    const rutaRelativa = `capas/${capaId}_${nombre}`;

    const respuesta = await fetch(urlImagen);
    if (!respuesta.ok) throw new Error(`No se pudo descargar la imagen (${respuesta.status})`);
    const base64 = await this.blobABase64(await respuesta.blob());

    await Filesystem.writeFile({
      path: rutaRelativa,
      data: base64,
      directory: Directory.Data,
      recursive: true,
    });
    return rutaRelativa;
  }

  private async borrarArchivo(rutaRelativa: string): Promise<void> {
    try {
      await Filesystem.deleteFile({ path: rutaRelativa, directory: Directory.Data });
    } catch { /* si ya no existe, da igual */ }
  }

  private blobABase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private async resolverImagenLocal(rutaRelativa: string | null): Promise<string | null> {
    if (!rutaRelativa) return null;
    try {
      const { uri } = await Filesystem.getUri({ path: rutaRelativa, directory: Directory.Data });
      return Capacitor.convertFileSrc(uri);
    } catch {
      return null;
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  LECTURA PARA EL MAPA (solo capas descargadas)
  // ══════════════════════════════════════════════════════════════════════════

  private esSinContenido(c: CatalogoCapa): boolean {
    return !!c.capa_wms || c.tipo === 'wms' || c.tipo === 'wmts';
  }

  // Reconstruye el GeoJSON de la capa desde contenido_capas y lo expone como
  // Blob URL en url_json, para que capas-diputacion.ts / capas-offline.ts /
  // emergencia.ts sigan haciendo fetch(capa.url_json) sin enterarse.
  private async construirUrlJsonDesdeContenido(idCapa: number): Promise<string | null> {
    const { values } = await this.db.query(
      'SELECT geometry, properties FROM contenido_capas WHERE capa_id = ? AND deleted = 0;',
      [idCapa]
    );
    if (!values || !values.length) return null;

    const featureCollection = {
      type: 'FeatureCollection',
      features: values.map((r: any) => ({
        type: 'Feature',
        geometry: JSON.parse(r.geometry),
        properties: r.properties ? JSON.parse(r.properties) : {},
      })),
    };
    const anterior = this.blobUrls.get(idCapa);
    if (anterior) URL.revokeObjectURL(anterior);

    const url = URL.createObjectURL(new Blob([JSON.stringify(featureCollection)], { type: 'application/json' }));
    this.blobUrls.set(idCapa, url);
    return url;
  }

  // El GeoJSON solo se construye para las capas marcadas (las que se dibujan al
  // arrancar). Para el resto se hace bajo demanda con asegurarContenido(), que
  // llaman home.page (al marcar la capa) y emergencia.ts.
  private async enriquecerCapa(capa: any): Promise<Capa> {
    const checked = !!capa.checked;
    return {
      ...capa,
      checked,
      imagen: await this.resolverImagenLocal(capa.imagen),
      url_json: checked ? await this.construirUrlJsonDesdeContenido(capa.id) : null,
    } as Capa;
  }

  override async asegurarContenido(capa: Capa): Promise<void> {
    if (capa.url_json) return;
    capa.url_json = await this.construirUrlJsonDesdeContenido(capa.id);
  }

  async getGruposSeccion(seccion: SeccionTipo): Promise<Grupo[]> {
    const { values } = await this.db.query(`
      SELECT g.id, g.nombre, g.orden
      FROM grupo g
      JOIN seccion s ON g.id_seccion = s.id
      WHERE s.nombre = ?
      ORDER BY g.orden;
    `, [seccion]);
    return (values ?? []) as Grupo[];
  }

  async getCapasGrupo(idGrupo: number): Promise<Capa[]> {
    const { values } = await this.db.query(
      'SELECT * FROM capa WHERE id_grupo = ? ORDER BY orden;', [idGrupo]
    );
    const resultado: Capa[] = [];
    for (const c of (values ?? [])) resultado.push(await this.enriquecerCapa(c));
    return resultado;
  }

  async getCapasPorSeccion(seccion: SeccionTipo): Promise<GrupoConCapas[]> {
    const grupos = await this.getGruposSeccion(seccion);
    const resultado: GrupoConCapas[] = [];
    for (const grupo of grupos) {
      resultado.push({ ...grupo, capas: await this.getCapasGrupo(grupo.id) });
    }
    return resultado;
  }

  async toggleCapa(id: number, checked: boolean): Promise<void> {
    await this.db.run('UPDATE capa SET checked = ? WHERE id = ?;', [checked ? 1 : 0, id]);
  }

  async updateOrdenCapa(id: number, orden: number): Promise<void> {
    await this.db.run('UPDATE capa SET orden = ? WHERE id = ?;', [orden, id]);
  }

  async getCapasActivas(seccion: SeccionTipo): Promise<Capa[]> {
    const { values } = await this.db.query(`
      SELECT c.* FROM capa c
      JOIN grupo g ON c.id_grupo = g.id
      JOIN seccion s ON g.id_seccion = s.id
      WHERE s.nombre = ? AND c.checked = 1
      ORDER BY c.orden;
    `, [seccion]);
    const resultado: Capa[] = [];
    for (const c of (values ?? [])) resultado.push(await this.enriquecerCapa(c));
    return resultado;
  }

  async resetCapas(seccion: SeccionTipo): Promise<void> {
    await this.db.run(`
      UPDATE capa SET checked = 0
      WHERE id_grupo IN (
        SELECT g.id FROM grupo g
        JOIN seccion s ON g.id_seccion = s.id
        WHERE s.nombre = ?
      );
    `, [seccion]);
  }
}