import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { CapasService } from './capas.service';
import { urlFotoHidrante } from './foto-hidrante';

// nombre_source de las capas de Diputación que usa la generación de emergencias
const SOURCE_PARQUES = 'ParquesExtincionSalvamento';
const SOURCE_INVENTARIO = 'InventarioRecursos';
const SOURCE_HIDRANTES = 'Hidrantes';
const SOURCE_TERMINOS = 'TerminosMunicipales';

export interface Emergencia {
  coordEste: number | null;
  coordNorte: number | null;
  denominacion: string;
  usuario: string;
  tipoEmergencia: string;
  distanciaMedios: number | null;
  distanciaHidrantes: number | null;
  notas: string;
  nombreInforme: string;
  abrirAlTerminar: boolean;
}
export interface ResultadosEmergencia {
  municipio: { nombre: string; codmuni: string; comarca: string; poblacion: number } | null;
  parques: any[];
  inventario: any[];
  hidrantes: any[];
}
@Injectable({
  providedIn: 'root'
})

export class EmergenciaService {
  seccionesAbiertas: { [key: string]: boolean } = {
    geo: true,
    params: true,
    archivo: true
  };
  private _emergencia: Emergencia = this.getEmergenciaVacia();
  resultados: ResultadosEmergencia | null = null;
  capasEmergenciaActiva: string[] = [];
  modalClick$ = new Subject<string>();

  constructor(private capasService: CapasService) {}

  toggleSeccion(nombreSeccion: string) {
    this.seccionesAbiertas[nombreSeccion] = !this.seccionesAbiertas[nombreSeccion];
  }

  get emergencia(): Emergencia {
    return this._emergencia;
  }

  getEmergenciaVacia(): Emergencia {
    return {
      coordEste: null,
      coordNorte: null,
      denominacion: '',
      usuario: '',
      tipoEmergencia: 'incendio_no_urbano',
      distanciaMedios: null,
      distanciaHidrantes: null,
      notas: 'No constan',
      nombreInforme: 'informe_emergencia.pdf',
      abrirAlTerminar: false
    };
  }


  resetEmergencia() {
    this._emergencia = this.getEmergenciaVacia();
    this.resultados = null;
  }

  async obtenerUbicacionActual(): Promise<{ coordEste: number; coordNorte: number }> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          coordEste: parseFloat(pos.coords.longitude.toFixed(6)),
          coordNorte: parseFloat(pos.coords.latitude.toFixed(6))
        }),
        (err) => reject(err)
      );
    });
  }

  async usarUbicacionActual() {
    try {
      const coords = await this.obtenerUbicacionActual();
      this._emergencia.coordEste = coords.coordEste;
      this._emergencia.coordNorte = coords.coordNorte;
    } catch (err) {
      console.error('Error obteniendo ubicación:', err);
      throw err;
    }
  }

  /**
   * Comprueba si la emergencia tiene los datos minimos necesarios
   * @returns true si la emergencia es valida, false en caso contrario
   */
  esValida(): boolean {
    return !!(
      this._emergencia.coordEste &&
      this._emergencia.coordNorte &&
      this._emergencia.denominacion &&
      this._emergencia.tipoEmergencia &&
      this._emergencia.distanciaHidrantes &&
      this._emergencia.distanciaMedios
    );
  }


  /**
   * Calcula la distancia en km entre dos puntos usando la formula de Haversine
   * @param lat1 Latitud del primer punto
   * @param lon1 Longitud del primer punto
   * @param lat2 Latitud del segundo punto
   * @param lon2 Longitud del segundo punto
   * @returns Distancia en km
   */
  private distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Cache en memoria de las capas de la sección "diputacion" (mismo Capa[] que usa el mapa)
  private capasDiputacionCache: any[] | null = null;

  private async getCapasDiputacion(): Promise<any[]> {
    if (this.capasDiputacionCache) return this.capasDiputacionCache;
    const grupos = await this.capasService.getGruposSeccion('diputacion');
    const capas: any[] = [];
    for (const grupo of grupos) {
      capas.push(...await this.capasService.getCapasGrupo(grupo.id));
    }
    this.capasDiputacionCache = capas;
    return capas;
  }

  // Carga el GeoJSON de una capa de Diputación por su nombre_source
  // (antes se leía un archivo estático en assets/, ahora sale de contenido_capas)
  private async cargarGeoJSON(nombreSource: string): Promise<any> {
    const capas = await this.getCapasDiputacion();
    const capa = capas.find((c: any) => c.nombre_source === nombreSource);
    if (capa) await this.capasService.asegurarContenido(capa);
    if (!capa || !capa.url_json) {
      throw new Error(`No se encontró la capa "${nombreSource}" para generar la emergencia`);
    }
    const res = await fetch(capa.url_json);
    if (!res.ok) {
      throw new Error(`Error cargando la capa "${nombreSource}" (${res.status})`);
    }
    return res.json();
  }

  /**
   * Calcula la distancia en km entre dos puntos usando la API de OSRM
   * @param lat1 Latitud del primer punto
   * @param lon1 Longitud del primer punto
   * @param lat2 Latitud del segundo punto
   * @param lon2 Longitud del segundo punto
   * @returns Distancia en km
   */
  async calcularDistanciaRuta(lat1: number, lon1: number, lat2: number, lon2: number): Promise<number | null> {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.code !== 'Ok') return null;
      return data.routes[0].distance / 1000; // metros -> km
    } catch (e) {
      console.error('Error calculando ruta', e);
      return null;
    }
  }
  /**
   * Comprueba si un punto esta dentro de un polígono usando el algoritmo ray casting
   * se usa para saber que recursos caen dentro del radio de la emergencia
   * @param lat Latitud del punto
   * @param lon Longitud del punto
   * @param coordsAnillo Coordenadas del polígono
   * @returns true si el punto esta dentro del polígono, false en caso contrario
   */
  private puntoEnPoligono(lat: number, lon: number, coordsAnillo: number[][]): boolean {
    let dentro = false;
    for (let i = 0, j = coordsAnillo.length - 1; i < coordsAnillo.length; j = i++) {
      const xi = coordsAnillo[i][0], yi = coordsAnillo[i][1];
      const xj = coordsAnillo[j][0], yj = coordsAnillo[j][1];
      if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
        dentro = !dentro;
      }
    }
    return dentro;
  }

  /**
   * Comprueba si un municipio contiene el punto de la emergencia para saber su nombre y sus datos
   * @param geometry La geometria del municipio
   * @param lat Latitud del punto
   * @param lon Longitud del punto
   * @returns true si el municipio contiene el punto, false en caso contrario
   */
  private municipioContienePunto(geometry: any, lat: number, lon: number): boolean {
    if (geometry.type === 'Polygon') {
      return this.puntoEnPoligono(lat, lon, geometry.coordinates[0]);
    }
    if (geometry.type === 'MultiPolygon') {
      return geometry.coordinates.some((poly: number[][][]) =>
        this.puntoEnPoligono(lat, lon, poly[0])
      );
    }
    return false;
  }

  /**
   * Busca los recursos necesarios para la emergencia
   * @returns Resultados de la emergencia
   */
  async buscarRecursos(): Promise<ResultadosEmergencia> {
    const { coordEste: lon, coordNorte: lat, distanciaMedios, distanciaHidrantes } = this.emergencia;
    if (!lat || !lon) throw new Error('Coordenadas no definidas');

    const [geoParques, geoInventario, geoHidrantes, geoTerminos] = await Promise.all([
      this.cargarGeoJSON(SOURCE_PARQUES),
      this.cargarGeoJSON(SOURCE_INVENTARIO),
      this.cargarGeoJSON(SOURCE_HIDRANTES),
      this.cargarGeoJSON(SOURCE_TERMINOS)
    ]);

    // Municipio que contiene el punto
    const municipioFeature = geoTerminos.features.find((f: any) =>
      this.municipioContienePunto(f.geometry, lat, lon)
    );
    const municipio = municipioFeature ? {
      nombre: municipioFeature.properties.NAMEUNIT,
      codmuni: municipioFeature.properties.codmuni,
      comarca: municipioFeature.properties.comarca,
      poblacion: municipioFeature.properties.pob2020
    } : null;
    

    // Parques dentro del radio de medios
    const parques = await Promise.all(geoParques.features
      .filter((f: any) => {
        const [flon, flat] = f.geometry.coordinates;
        return this.distanciaKm(lat, lon, flat, flon) <= this._emergencia.distanciaMedios!;
      })
      .map(async (f: any) => {
        const [flon, flat] = f.geometry.coordinates;
        const distanciaRuta = await this.calcularDistanciaRuta(lat, lon, flat, flon);
        return {
          ...f.properties,
          lat: flat,
          lon: flon,
          distancia: this.distanciaKm(lat, lon, flat, flon).toFixed(6),
          distanciaRuta: distanciaRuta !== null ? distanciaRuta.toFixed(3) : null
        };
      })
    );
    parques.sort((a: any, b: any) => a.distancia - b.distancia);

    // Inventario medios/recursos dentro del radio
    const inventario =  await Promise.all(geoInventario.features
      .filter((f: any) => {
        const [flon, flat] = f.geometry.coordinates;
        return this.distanciaKm(lat, lon, flat, flon) <= this._emergencia.distanciaMedios!;
      })
      .map(async (f: any) => {
        const [flon, flat] = f.geometry.coordinates;
        const distanciaRuta = await this.calcularDistanciaRuta(lat, lon, flat, flon);
        return {
          ...f.properties,
          lat: flat,
          lon: flon,
          distancia: this.distanciaKm(lat, lon, flat, flon).toFixed(6),
          distanciaRuta: distanciaRuta !== null ? distanciaRuta.toFixed(3) : null
        };
      })
    );
      inventario.sort((a: any, b: any) => a.distancia - b.distancia);

    // Hidrantes dentro del radio de hidrantes
    const hidrantes =  await Promise.all(geoHidrantes.features
      .filter((f: any) => {
        const [flon, flat] = f.geometry.coordinates;
        return this.distanciaKm(lat, lon, flat, flon) <= this._emergencia.distanciaHidrantes!;
      })
      .map(async (f: any) => {
        const [flon, flat] = f.geometry.coordinates;
        const distanciaRuta = await this.calcularDistanciaRuta(lat, lon, flat, flon);
        return {
          ...f.properties,
          lat: flat,
          lon: flon,
          distancia: this.distanciaKm(lat, lon, flat, flon).toFixed(6),
          distanciaRuta: distanciaRuta !== null ? distanciaRuta.toFixed(3) : null
        };
      }));
      hidrantes.sort((a: any, b: any) => a.distancia - b.distancia);

    this.resultados = { municipio, parques, inventario, hidrantes };
    return this.resultados;
  }

  /**
   * Dibuja la emergencia en el mapa con las capas necesarias
   * @param map El mapa
   */
  dibujarEmergenciaEnMapa(map: maplibregl.Map) {
    if (this.emergencia.coordEste == null || this.emergencia.coordNorte == null) return;
    const emergencia = this.emergencia;    
    const resultados = this.resultados;
    const { coordEste: lon, coordNorte: lat, distanciaMedios, distanciaHidrantes } = emergencia;
    this.limpiarCapasEmergencia(map);

    // ── 1. Punto de la emergencia ──
    map.addSource('emergencia-punto', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lon!, lat!] },
        properties: {
          nombre: emergencia.denominacion || 'Emergencia',          
          tipo: emergencia.tipoEmergencia,
          coordEste: emergencia.coordEste || null,
          coordNorte: emergencia.coordNorte || null,
          usuario: emergencia.usuario || null,
          distanciaMedios: emergencia.distanciaMedios || null,
          distanciaHidrantes: emergencia.distanciaHidrantes || null,
          notas: emergencia.notas || null,
        }
      }
    });
    map.addLayer({
      id: 'emergencia-punto-layer',
      type: 'circle',
      source: 'emergencia-punto',
      paint: {
        'circle-radius': 10,
        'circle-color': '#e63946',
        'circle-stroke-width': 3,
        'circle-stroke-color': '#ffffff'
      }
    });

    // ── 2. Círculo radio medios/recursos ──
    map.addSource('emergencia-radio-medios', {
      type: 'geojson',
      data: this.crearCirculoGeoJSON(lon!, lat!, distanciaMedios!)
    });
    map.addLayer({
      id: 'emergencia-radio-medios-fill',
      type: 'fill',
      source: 'emergencia-radio-medios',
      paint: { 'fill-color': '#e63946', 'fill-opacity': 0.05 }
    });
    map.addLayer({
      id: 'emergencia-radio-medios-line',
      type: 'line',
      source: 'emergencia-radio-medios',
      paint: { 'line-color': '#e63946', 'line-width': 2, 'line-dasharray': [4, 3] }
    });

    // ── 3. Círculo radio hidrantes ──
    map.addSource('emergencia-radio-hidrantes', {
      type: 'geojson',
      data: this.crearCirculoGeoJSON(lon!, lat!, distanciaHidrantes!)
    });
    map.addLayer({
      id: 'emergencia-radio-hidrantes-fill',
      type: 'fill',
      source: 'emergencia-radio-hidrantes',
      paint: { 'fill-color': '#0077b6', 'fill-opacity': 0.05 }
    });
    map.addLayer({
      id: 'emergencia-radio-hidrantes-line',
      type: 'line',
      source: 'emergencia-radio-hidrantes',
      paint: { 'line-color': '#0077b6', 'line-width': 2, 'line-dasharray': [4, 3] }
    });

    // ── 4. Parques ──
    map.addSource('emergencia-parques', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: resultados!.parques.map((p: any) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
          properties: { nombre: p.name, tipo: p.type, distancia: p.distancia, distanciaRuta: p.distanciaRuta, tlf: p.tlf || '—' }
        }))
      }
    });
    map.addLayer({
      id: 'emergencia-parques-layer',
      type: 'circle',
      source: 'emergencia-parques',
      paint: {
        'circle-radius': 8,
        'circle-color': '#ff6b35',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });

    // ── 5. Inventario recursos humanos ──
    map.addSource('emergencia-inventario', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: resultados!.inventario.map((inv: any) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [inv.lon, inv.lat] },
          properties: { ...inv }
        }))
      }
    });
    map.addLayer({
      id: 'emergencia-inventario-layer',
      type: 'circle',
      source: 'emergencia-inventario',
      paint: {
        'circle-radius': 8,
        'circle-color': '#2dc653',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });

    // ── 6. Hidrantes ──
    map.addSource('emergencia-hidrantes', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: resultados!.hidrantes.map((h: any) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [h.lon, h.lat] },
          properties: { ...h }
        }))
      }
    });
    map.addLayer({
      id: 'emergencia-hidrantes-layer',
      type: 'circle',
      source: 'emergencia-hidrantes',
      paint: {
        'circle-radius': 6,
        'circle-color': '#0077b6',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff'
      }
    });

    // ── Popups en click ──
  // 1. Punto de Emergencia
    this.añadirPopup(map, 'emergencia-punto-layer', (p) => {
      if (!p) return '<p class="popup-empty">Sin información disponible</p>';
      return `
        <div class="popup-card">
          <div class="popup-title">
            <span>🚨</span> <span>${p.nombre || 'Punto de Emergencia'}</span>
          </div>
          <div class="popup-info">
            <div class="popup-row">
              <span class="label">Tipo</span>
              <span class="value badge">${p.tipo || 'No indicado'}</span>
            </div>
            <div class="popup-row">
              <span class="label">Coordenadas</span>
              <span class="value">${p.coordEste ?? '—'}, ${p.coordNorte ?? '—'}</span>
            </div>
            <div class="popup-row">
              <span class="label">Usuario</span>
              <span class="value">${p.usuario || '—'}</span>
            </div>
            <div class="popup-row">
              <span class="label">Distancia medios</span>
              <span class="value">${p.distanciaMedios ?? '—'} km</span>
            </div>
            <div class="popup-row">
              <span class="label">Distancia hidrantes</span>
              <span class="value">${p.distanciaHidrantes ?? '—'} km</span>
            </div>
            <div class="popup-row">
              <span class="label">Notas</span>
              <span class="value">${p.notas || 'Sin notas'}</span>
            </div>
          </div>
        </div>
      `;
    });

    // 2. Parques de Extinción
    this.añadirPopup(map, 'emergencia-parques-layer', (p) => {
      if (!p) return '<p class="popup-empty">Sin información disponible</p>';
      return `
        <div class="popup-card">
          <div class="popup-title">
            <span>🚒</span> <span>${p.nombre || 'Parque de Extinción'}</span>
          </div>
          <div class="popup-info">
            <div class="popup-row">
              <span class="label">Tipo</span>
              <span class="value badge">${p.tipo || 'No indicado'}</span>
            </div>
            <div class="popup-row">
              <span class="label">Línea recta</span>
              <span class="value">${p.distancia ?? '—'} km</span>
            </div>
            <div class="popup-row">
              <span class="label">Distancia ruta</span>
              <span class="value">${p.distanciaRuta ?? '—'} km</span>
            </div>
            <div class="popup-row">
              <span class="label">Teléfono</span>
              <span class="value">${p.tlf ? `<a href="tel:${p.tlf}">${p.tlf}</a>` : '—'}</span>
            </div>
          </div>
        </div>
      `;
    });

    // 3. Inventario / Recursos Humanos
    this.añadirPopup(map, 'emergencia-inventario-layer', (p) => {
      if (!p) return '<p class="popup-empty">Sin información disponible</p>';
      return `
        <div class="popup-card">
          <div class="popup-title">
            <span>👥</span> <span>${p.nombre || 'Recurso / Inventario'}</span>
          </div>
          <div class="popup-info">
            <div class="popup-row">
              <span class="label">Bomberos Voluntarios</span>
              <span class="value badge">${p.num_bomb_vol ?? 0}</span>
            </div>
            <div class="popup-row">
              <span class="label">Bomberos Protección</span>
              <span class="value badge">${p.num_bomb_pc ?? 0}</span>
            </div>
            <div class="popup-row">
              <span class="label">Línea recta</span>
              <span class="value">${p.distancia ?? '—'} km</span>
            </div>
            <div class="popup-row">
              <span class="label">Distancia ruta</span>
              <span class="value">${p.distanciaRuta ?? '—'} km</span>
            </div>
            <div class="popup-row">
              <span class="label">Contacto</span>
              <span class="value">${p.contact || '—'}</span>
            </div>
            <div class="popup-row">
              <span class="label">Fecha actualización</span>
              <span class="value">${p.date || '—'}</span>
            </div>
            <div class="popup-row">
              <span class="label">Nº Mangueras</span>
              <span class="value">${p.num_maguera || '—'}</span>
            </div>
            <div class="popup-row">
              <span class="label">Mangueras 25 mm</span>
              <span class="value">${p.mangaje25 || '—'}</span>
            </div>
            <div class="popup-row">
              <span class="label">Mangueras 45 mm</span>
              <span class="value">${p.mangaje45 || '—'}</span>
            </div>
            <div class="popup-row">
              <span class="label">Mangueras 70 mm</span>
              <span class="value">${p.mangaje70 || '—'}</span>
            </div>
            <div class="popup-row">
              <span class="label">Capacidad agua (m³)</span>
              <span class="value">${p.cap_agua_autobomba || '—'}</span>
            </div>
            <div class="popup-row">
              <span class="label">Antigüedad autobomba</span>
              <span class="value">${p.years_automba ? p.years_automba + ' años' : '—'}</span>
            </div>
            <div class="popup-row">
              <span class="label">Tipo autobomba</span>
              <span class="value">${p.autobomba_tipo || '—'}</span>
            </div>
            <div class="popup-row">
              <span class="label">Notas autobomba</span>
              <span class="value">${p.autobomba_notes || '—'}</span>
            </div>
          </div>
        </div>
      `;
    });
 this.añadirPopup(map, 'emergencia-hidrantes-layer', (p) => {
      if (!p) return '<p class="popup-empty">Sin información disponible</p>';

      const id = p.id ?? 'N/D';
      const lat = p.lat ?? 'N/D';
      const long = p.lon ?? p.long ?? 'N/D'; // Compatible con lon o long
      const origen = p.source ?? 'N/D';
      const fecha = p.date ?? 'N/D';
      const urlMaps = p.url_google_maps;

      // Mapeo Tipo de Conector
      const mapaTipoConector: Record<string | number, string> = {
        1: 'Racor Barcelona',
        2: 'Racor Madrid',
        3: 'Racor rosca 40 mm'
      };
      const rawConector = p.connector_type ?? p.tipo_conector;
      const tipoConector = (rawConector !== null && rawConector !== undefined && mapaTipoConector[rawConector]) 
        ? mapaTipoConector[rawConector] 
        : 'No indicado';

      // Mapeo Tipo de Hidrante
      const mapaTipoHidrante: Record<string | number, string> = {
        1: 'Hidrante de columna',
        2: 'Hidrante de arqueta',
        3: 'Embalse'
      };
      const rawHidrante = p.hydrant_type ?? p.tipo_hidrante;
      const tipoHidrante = (rawHidrante !== null && rawHidrante !== undefined && mapaTipoHidrante[rawHidrante]) 
        ? mapaTipoHidrante[rawHidrante] 
        : 'No indicado';

      // Lógica de foto con manejo de rutas flexible
      let fotoHtml = '';
      let pathPhoto: string = p.path_photo || '';
      if (pathPhoto.trim() !== '') {
        pathPhoto = pathPhoto.replace(/\\/g, '/');
        const nombreArchivo = pathPhoto.split('/').pop();
        if (nombreArchivo && nombreArchivo.trim() !== '' && pathPhoto.split('foto_hidrantes/')[1]?.trim() !== '') {
          const src = urlFotoHidrante(pathPhoto);
          fotoHtml = `<img src="${src}" alt="Foto Hidrante ${id}" class="popup-img" onerror="this.style.display='none'" />`;
        }
      }

      // Estructura HTML idéntica a datosHidrantes
      return `
        <div class="popup-card">
          <div class="popup-title">
            <span>🧯</span> <span>Hidrante #${id}</span>
          </div>
          ${fotoHtml}
          <div class="popup-info">
            <div class="popup-row">
              <span class="label">Tipo Conector</span>
              <span class="value badge">${tipoConector}</span>
            </div>
            <div class="popup-row">
              <span class="label">Tipo Hidrante</span>
              <span class="value badge">${tipoHidrante}</span>
            </div>
            <div class="popup-row">
              <span class="label">Coordenadas</span>
              <span class="value">${lat}, ${long}</span>
            </div>
            <div class="popup-row">
              <span class="label">Origen Datos</span>
              <span class="value">${origen}</span>
            </div>
            <div class="popup-row">
              <span class="label">Fecha</span>
              <span class="value">${fecha}</span>
            </div>
            <div class="popup-row">
              <span class="label">Distancia línea recta</span>
              <span class="value">${p.distancia} km</span>
            </div>
            <div class="popup-row">
              <span class="label">Distancia ruta</span>
              <span class="value">${p.distanciaRuta} km</span>
            </div>
          </div>
          ${urlMaps ? `
            <a href="${urlMaps}" target="_blank" rel="noopener noreferrer" class="popup-btn">
              <span>Ver en Google Maps</span> ↗
            </a>
          ` : ''}
        </div>
      `;
    });
    // Guarda los ids para limpiar luego
    this.capasEmergenciaActiva = [
      'emergencia-punto-layer',
      'emergencia-radio-medios-fill', 'emergencia-radio-medios-line',
      'emergencia-radio-hidrantes-fill', 'emergencia-radio-hidrantes-line',
      'emergencia-parques-layer',
      'emergencia-inventario-layer',
      'emergencia-hidrantes-layer',
    ];

    // Centra el mapa
    map.flyTo({ center: [lon!, lat!], zoom: 10 });

  }

  /**
   * Crea un circulo GeoJSON alrededor de la emergencia
   * @param lon Longitud de la emergencia
   * @param lat Latitud de la emergencia
   * @param radioKm Radio del circulo en kilometros
   * @param puntos Numero de puntos para crear el circulo
   * @returns Circulo GeoJSON
   */
  crearCirculoGeoJSON(lon: number, lat: number, radioKm: number, puntos = 64): any {
    const coords = [];
    for (let i = 0; i < puntos; i++) {
      const angulo = (i * 360) / puntos;
      const rad = angulo * Math.PI / 180;
      const dLat = (radioKm / 111.32) * Math.cos(rad);
      const dLon = (radioKm / (111.32 * Math.cos(lat * Math.PI / 180))) * Math.sin(rad);
      coords.push([lon + dLon, lat + dLat]);
    }
    coords.push(coords[0]); // cierra el polígono
    return {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [coords] },
      properties: {}
    };
  }
  /**
   * Añade un popup a una capa del mapa para cuando se pincha en un punto de emergencia
   * @param map El mapa
   * @param layerId El id de la capa
   * @param contenido El contenido del popup
   */
  añadirPopup(map:maplibregl.Map, layerId: string, contenido: (props: any) => string) {
    map.on('click', layerId, (e: any) => {
      const props = e.features[0].properties; 
      //console.log(props)
      let html= contenido(props);
      this.modalClick$.next(html);

    });

  }
  /*Limpia las capas de la emergencia del mapa*/
  limpiarCapasEmergencia(map:maplibregl.Map) {

    const sources = [
      'emergencia-punto',
      'emergencia-radio-medios',
      'emergencia-radio-hidrantes',
      'emergencia-parques',
      'emergencia-inventario',
      'emergencia-hidrantes'
    ];

    this.capasEmergenciaActiva.forEach(id => {
      if (map.getLayer(id)) map.removeLayer(id);
    });
    sources.forEach(id => {
      if (map.getSource(id)) map.removeSource(id);
    });

    this.capasEmergenciaActiva = [];
    this._emergencia = this.getEmergenciaVacia();
  }
}