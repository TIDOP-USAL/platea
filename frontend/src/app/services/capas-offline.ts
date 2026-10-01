import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { CapasService } from './capas.service';
import { Grupo, Capa } from '../models/capas.model';
import * as turf from '@turf/turf';
import type { FeatureCollection, Point } from 'geojson';


@Injectable({
  providedIn: 'root',
})
export class CapasOffline {

  /*grupoOffline = [{ id: 0, name: 'Limites administrativos' }, { id: 1, name: 'BIC' },
  { id: 2, name: 'Construcciones' }, { id: 3, name: 'Redes de Transporte' },
  { id: 4, name: 'Hidrografía' }, { id: 5, name: 'Condiciones y Transmisiones' },
  { id: 6, name: 'Relieve y Toponomia' }, { id: 7, name: 'Mapas de fondo' },
  ];
  capasOffline = [
    { id: 0, idGrupo: 0, tipo: 'linea', texto: 'IGR Recintos autonómicos', imagen: './assets/capas/offline/limites/icons/recintos-autonomicos.png', nombreSource: 'IGRRecintosAutonomicos', nombreJson: './assets/capas/offline/limites/igr-recintos-autonomicos.geojson', color: '#ff0000', checked: false },
    { id: 1, idGrupo: 0, tipo: 'linea', texto: 'IGR Recintos municipales', imagen: './assets/capas/offline/limites/icons/recintos-municipales.png', nombreSource: 'IGRRecintosMunicipales', nombreJson: './assets/capas/offline/limites/igr-recintos-municipales.geojson', color: '#0081c6', checked: false },
    { id: 2, idGrupo: 0, tipo: 'relleno', texto: 'BTN Entidad Poblacion', imagen: './assets/capas/offline/limites/icons/btn-entidad-poblacion.png', nombreSource: 'BtnPoblacion', nombreJson: './assets/capas/offline/limites/btn-entidad-poblacion.geojson', color: '', checked: false },
    { id: 3, idGrupo: 0, tipo: 'relleno', texto: 'BTN Zona protegida', imagen: './assets/capas/offline/limites/icons/btn-zona-protegida.png', nombreSource: 'ZonaProtegida', nombreJson: './assets/capas/offline/limites/btn-zona-protegida.geojson', color: '#15dd0e', checked: false },
  ];*/
  grupoOffline: Grupo[] = [];
  capasOffline: Capa[] = [];
  gruposAbiertosOffline: { [id: number]: boolean } = { 1: true };
  modalClick$ = new Subject<string>();

  constructor(private capasService: CapasService) {}

  //variable para mostrar u ocultar grupos de capas
  

  async cargarCapasOffline(map: maplibregl.Map) {
    this.grupoOffline = await this.capasService.getGruposSeccion('offline');

    if (this.capasOffline.length == 0){
      for (const grupo of this.grupoOffline) {
        const capas = await this.capasService.getCapasGrupo(grupo.id);
        this.capasOffline.push(...capas);
      }
    }
    for (const capa of this.capasOffline) {
      await this.cargarCapaOffline(map, capa);
    }
  }
  getCapaPorSource(source: string): Capa | undefined {
    return this.capasOffline.find(c => c.nombre_source === source);
  }
  async cargarCapaOffline(map: maplibregl.Map, capa: any) {
    if (map.getSource(capa.nombre_source)) return;
    if (capa.nombre_source == 'BTN_yacimiento_arqueologico_poligono' && capa.checked) {
      await this.cargarCapaBtnYacimientoArqueologicoPoligono(map, capa.url_json, capa.nombre_source, capa.imagen, capa.checked, capa.color!);
    } else if (capa.nombre_source == 'BTN_referencia_visual' && capa.checked) {
      await this.cargarCapaBtnReferenciaVisual(map, capa.url_json, capa.nombre_source, capa.imagen, capa.checked, capa.color!);
    } else if (capa.nombre_source == 'BTN_edificio_religioso' && capa.checked) {
      await this.cargarCapaBtnEdificioReligioso(map, capa.url_json, capa.nombre_source, capa.imagen, capa.checked, capa.color!);
    } else if (capa.nombre_source == 'IGRRecintosAutonomicos' && capa.checked) {
      await this.cargarCapaRecintos(map, capa.url_json, capa.nombre_source, capa.checked, capa.color!, 15);
    } else if (capa.nombre_source == 'IGRRecintosMunicipales' && capa.checked) {
      await this.cargarCapaRecintos(map, capa.url_json, capa.nombre_source, capa.checked, capa.color!, 10);
    } else if (capa.nombre_source == 'BtnPoblacion' && capa.checked) {
      await this.cargarCapaBtnPoblacion(map, capa.url_json, capa.nombre_source, capa.checked);
    } else if (capa.tipo == 'puntos' && capa.checked) {
      await this.cargarCapaPuntosOffline(map, capa.url_json, capa.nombre_source, capa.imagen, capa.checked);
    } else if (capa.tipo == 'relleno' && capa.checked) {
      await this.cargarCapaRellenoOffline(map, capa.url_json, capa.nombre_source, capa.checked, capa.color!);
    } else if (capa.tipo == 'linea' && capa.checked) {
      await this.cargarCapaLineaOffline(map, capa.url_json, capa.nombre_source, capa.checked, capa.color!);
    }
  }
  /**Funciones para cargar las capas que pueden relleno, puntos o lineas**/
  async cargarCapaRellenoOffline(map: maplibregl.Map, urlGeoJSON: string, nombreSource: string, checked: boolean, color: string,) {
    let nombreCapa = nombreSource;
    const respuesta = await fetch(urlGeoJSON);
    const datosJson = await respuesta.json();
    map.addSource(nombreSource, {
      'type': 'geojson',
      'data': datosJson,
    });
    map?.addLayer({
      'id': nombreCapa,
      'type': 'fill',
      'source': nombreSource,
      'layout': {
        'visibility': 'visible',
      },
      'paint': {
        'fill-color': color,
        'fill-opacity': 0.5,
      }
    });
    map?.setLayoutProperty(nombreCapa, 'visibility', checked ? 'visible' : 'none');
    map?.on('click', nombreCapa, (e) => {
      //Cargar en el modal la informacion del punto pinchado
      const propiedades = e.features?.[0].properties;
      let contenido = '';
      this.modalClick$.next(contenido);
    });

  }
  async cargarImagen(map: maplibregl.Map, nombreImagen: string, imagen: string) {
    if (!map?.hasImage(nombreImagen)) {
      const imageResponse = await map?.loadImage(imagen);
      if (imageResponse) {
        map?.addImage(nombreImagen, imageResponse.data);
      }
    }
  }
  async cargarCapaPuntosOffline(map: maplibregl.Map, urlGeoJSON: string, nombreSource: string, imagen: string, checked: boolean) {
    let nombreImagen = nombreSource;
    let nombreCapa = nombreSource;
    await this.cargarImagen(map, nombreImagen, imagen);
    const respuesta = await fetch(urlGeoJSON);
    const datosJson = await respuesta.json();
    map?.addSource(nombreSource, {
      'type': 'geojson',
      'data': datosJson,
    });
    map?.addLayer({
      'id': nombreCapa,
      'type': 'symbol',
      'source': nombreSource,
      'layout': {
        'visibility': checked ? 'visible' : 'none',
        'icon-image': nombreImagen,
        'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.4, 10, 0.6, 14, 0.8],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      }
    });
    let nombreEtiqueta = '';
    if (nombreSource == "Hidrantes") {
      nombreEtiqueta = "id";
    }
    map?.addLayer({
      id: nombreSource + '_label',
      type: 'symbol',
      source: nombreSource,
      layout: {
        'visibility': checked ? 'visible' : 'none',
        'text-field': ['get', nombreEtiqueta],
        'text-size': 10,
        'text-max-width': 10,
        'text-variable-anchor': ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
        'text-offset': [0, 1.5],
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-optional': true,
      },
      paint: {
        'text-color': '#000000',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2,
      }
    });

    map?.on('click', nombreCapa, (e) => {
      //Cargar en el modal la informacion del punto pinchado
      const propiedades = e.features?.[0].properties;
      let contenido = '';
      if (nombreCapa == "Hidrantes") {
        //contenido = this.datosHidrantes(propiedades);
      }
      this.modalClick$.next(contenido);
    });
  }
  async cargarCapaLineaOffline(map: maplibregl.Map, urlGeoJSON: string, nombreSource: string, checked: boolean, color: string) {
    let nombreCapa = nombreSource;
    const respuesta = await fetch(urlGeoJSON);
    const datosJson = await respuesta.json();
    map?.addSource(nombreSource, {
      'type': 'geojson',
      'data': datosJson,
    });
    map?.addLayer({
      'id': nombreSource,
      'type': 'line',
      'source': nombreSource,
      'layout': {
        'line-join': 'round',
        'line-cap': 'round'
      },
      'paint': {
        'line-color': color,
        'line-width': 2
      }
    });
    map?.setLayoutProperty(nombreCapa, 'visibility', checked ? 'visible' : 'none');
    map?.on('click', nombreCapa, (e) => {
      //Cargar en el modal la informacion del punto pinchado
      let contenido = '';
      for (const elemento of e.features!) {
        const propiedades = elemento.properties;
        //contenido += this.datosRutasEscolares(propiedades);
      }
      this.modalClick$.next(contenido);
    });
  }
  async cargarCapaBtnPoblacion(map: maplibregl.Map, urlGeoJSON: string, nombreSource: string, checked: boolean) {
    const respuesta = await fetch(urlGeoJSON);
    const datosJson = await respuesta.json();
    map?.addSource(nombreSource, {
      'type': 'geojson',
      'data': datosJson,
    });
    map?.addLayer({
      'id': nombreSource,
      'type': 'fill',
      'source': nombreSource,
      'layout': {
        'visibility': checked ? 'visible' : 'none',
      },
      'paint': {
        'fill-color': ['case',
          ['all', ['==', ['get', 'TIPO_0502'], '01'], ['==', ['get', 'INE_0502'], '01']], '#e31a1c',
          ['all', ['==', ['get', 'TIPO_0502'], '01'], ['==', ['get', 'INE_0502'], '00']], '#ff7f00',
          ['all', ['==', ['get', 'TIPO_0502'], '02'], ['==', ['get', 'INE_0502'], '01']], '#e31a1c',
          ['all', ['==', ['get', 'TIPO_0502'], '03'], ['==', ['get', 'INE_0502'], '01']], '#e31a1c',
          ['all', ['==', ['get', 'TIPO_0502'], '03'], ['==', ['get', 'INE_0502'], '00']], '#ff7f00',
          '#ffffff'
        ],
        'fill-opacity': 0.5
      }
    });
    map?.addLayer({
      'id': nombreSource + '_border',
      'type': 'line',
      'source': nombreSource,
      'layout': {
        'line-join': 'round',
        'line-cap': 'round'
      },
      'paint': {
        'line-color': ['case',
          ['all', ['==', ['get', 'TIPO_0502'], '01'], ['==', ['get', 'INE_0502'], '01']], '#e31a1c',
          ['all', ['==', ['get', 'TIPO_0502'], '01'], ['==', ['get', 'INE_0502'], '00']], '#ff7f00',
          ['all', ['==', ['get', 'TIPO_0502'], '02'], ['==', ['get', 'INE_0502'], '01']], '#e31a1c',
          ['all', ['==', ['get', 'TIPO_0502'], '03'], ['==', ['get', 'INE_0502'], '01']], '#e31a1c',
          ['all', ['==', ['get', 'TIPO_0502'], '03'], ['==', ['get', 'INE_0502'], '00']], '#ff7f00',
          '#ffffff'
        ],
        'line-width': 1,
      }
    });
    map?.on('click', nombreSource, (e) => {
      //Cargar en el modal la informacion del punto pinchado
      const propiedades = e.features?.[0].properties;
      let contenido = '';
      console.log(propiedades)
      contenido = this.datosBtnPoblacion(propiedades);
      this.modalClick$.next(contenido);
    });
  }

  async cargarCapaRecintos(map: maplibregl.Map, urlGeoJSON: string, nombreSource: string, checked: boolean, color: string, tamanoLetra: number) {
    const respuesta = await fetch(urlGeoJSON);
    const datosJson = await respuesta.json();
    map?.addSource(nombreSource, {
      'type': 'geojson',
      'data': datosJson,
    });
    map?.addLayer({
      'id': nombreSource,
      'type': 'line',
      'source': nombreSource,
      'layout': {
        'visibility': checked ? 'visible' : 'none',
        'line-join': 'round',
        'line-cap': 'round'
      },
      'paint': {
        'line-color': color,
        'line-width': 2
      }
    });
    map?.addLayer({
      id: nombreSource + '_label',
      type: 'symbol',
      source: nombreSource,
      layout: {
        'visibility': checked ? 'visible' : 'none',
        'text-field': ['get', 'NAMEUNIT'],
        'text-size': tamanoLetra,
        'text-max-width': 20,
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-optional': true,
      },
      paint: {
        'text-color': '#000000',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2,
      }
    });


  }

  async cargarCapaBtnEdificioReligioso(map: maplibregl.Map, urlGeoJSON: string, nombreSource: string, imagen: string, checked: boolean, color: string) {
    const respuesta = await fetch(urlGeoJSON);
    const datosJson = await respuesta.json();
    map?.addSource(nombreSource, {
      'type': 'geojson',
      'data': datosJson,
    });
    map?.addLayer({
      'id': nombreSource,
      'type': 'fill',
      'source': nombreSource,
      'layout': {
        'visibility': checked ? 'visible' : 'none',
      },
      'paint': {
        'fill-color': color,
        'fill-opacity': 0.5
      }
    });
    map?.addLayer({
      'id': nombreSource + "_border",
      'type': 'line',
      'source': nombreSource,
      'layout': {
        'visibility': checked ? 'visible' : 'none',
        'line-join': 'round',
        'line-cap': 'round'
      },
      'paint': {
        'line-color': color,
        'line-width': 2
      }
    });
    

    
    const puntosCentro = this.calcularPuntosCentro(datosJson);
    map?.addSource(nombreSource + '_icono', {
      'type': 'geojson',
      'data': puntosCentro
    });

    // Cargar el icono si no existe ya
    let nombreImagen = nombreSource;
    await this.cargarImagen(map, nombreImagen, imagen);
    
    map?.addLayer({
      'id': nombreSource + '_icono',
      'type': 'symbol',
      'source': nombreSource + '_icono',
      'layout': {
        'visibility': checked ? 'visible' : 'none',
        'icon-image': nombreImagen,
        'icon-size': 0.4,
        'icon-allow-overlap': true
      }       
    });

  }
  calcularPuntosCentro(datosJson: any){
    const featuresValidas = datosJson.features.filter((feature: any) => {
      const geom = feature?.geometry;
      if (!geom || !Array.isArray(geom.coordinates)) return false;
      return ['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(geom.type)
        && geom.coordinates.length > 0;
    });

    const puntosCentro = turf.featureCollection(
      featuresValidas.map((feature: any) => {
        const tipo = feature.geometry.type;
        let punto;

        if (tipo === 'LineString' || tipo === 'MultiLineString') {
          const longitud = turf.length(feature, { units: 'kilometers' });
          punto = turf.along(feature, longitud / 2, { units: 'kilometers' });
        } else {
          // Polygon o MultiPolygon: centroide (centro de masa, cae dentro del edificio)
          punto = turf.centroid(feature);
        }

        punto.properties = feature.properties;
        return punto;
      })
    );
    return puntosCentro;
  }
  async cargarCapaBtnReferenciaVisual(map: maplibregl.Map, urlGeoJSON: string, nombreSource: string, imagen: string, checked: boolean, color: string) {

    const respuesta = await fetch(urlGeoJSON);
    const datosJson = await respuesta.json();
    map?.addSource(nombreSource, {
      'type': 'geojson',
      'data': datosJson,
    });
    map?.addLayer({
      'id': nombreSource,
      'type': 'fill',
      'source': nombreSource,
      'layout': {
        'visibility': checked ? 'visible' : 'none',
      },
      'paint': {
        'fill-color': color,
        'fill-opacity': 0.5
      }
    });
    map?.addLayer({
      'id': nombreSource + "_border",
      'type': 'line',
      'source': nombreSource,
      'layout': {
        'visibility': checked ? 'visible' : 'none',
        'line-join': 'round',
        'line-cap': 'round'
      },
      'paint': {
        'line-color': color,
        'line-width': 2
      }
    });
    const puntosCentro = this.calcularPuntosCentro(datosJson);
    map?.addSource(nombreSource + '_icono', {
      'type': 'geojson',
      'data': puntosCentro
    });
    // Cargar el icono si no existe ya
    let nombreImagen = nombreSource;
    await this.cargarImagen(map, nombreImagen, imagen);
    
    map?.addLayer({
      'id': nombreSource + '_icono',
      'type': 'symbol',
      'source': nombreSource+ '_icono',
      'layout': {
        'visibility': checked ? 'visible' : 'none',
        'icon-image': nombreImagen,
        'icon-size': 0.4,
        'icon-allow-overlap': true
      }       
    });
  }
  async cargarCapaBtnYacimientoArqueologicoPoligono(map: maplibregl.Map, urlGeoJSON: string, nombreSource: string, imagen: string, checked: boolean, color: string,) {
    let nombreCapa = nombreSource;
    const respuesta = await fetch(urlGeoJSON);
    const datosJson = await respuesta.json();
    map.addSource(nombreSource, {
      'type': 'geojson',
      'data': datosJson,
    });
    map?.addLayer({
      'id': nombreCapa,
      'type': 'fill',
      'source': nombreSource,
      'layout': {
        'visibility': 'visible',
      },
      'paint': {
        'fill-color': color,
        'fill-opacity': 0.5,
      }
    });
    const puntosCentro = this.calcularPuntosCentro(datosJson);
    map?.addSource(nombreSource + '_icono', {
      'type': 'geojson',
      'data': puntosCentro
    });
    // Cargar el icono si no existe ya
    let nombreImagen = nombreSource;
    await this.cargarImagen(map, nombreImagen, imagen);
    
    map?.addLayer({
      'id': nombreSource + '_icono',
      'type': 'symbol',
      'source': nombreSource+ '_icono',
      'layout': {
        'visibility': checked ? 'visible' : 'none',
        'icon-image': nombreImagen,
        'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.4, 10, 0.6, 14, 0.8],
        'icon-allow-overlap': true
      }       
    });
  }

  datosBtnPoblacion(propiedades: any): string {
    let contenido = '';
    contenido += '<h1>BTN Entidad Poblacion</h1>';
    contenido += '<b>Nombre:</b> ' + propiedades?.['NOMBRE'] + "<br>";

    return contenido;
  }
  /**Funcion para mostrar u ocultar grupos de capas */
  toggleGrupoOffline(grupo: any): void {
    this.gruposAbiertosOffline[grupo.id] = !this.gruposAbiertosOffline[grupo.id];
  }
}