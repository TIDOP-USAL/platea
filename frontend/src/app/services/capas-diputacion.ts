import { Injectable } from '@angular/core';
import { Component, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { CapasService } from './capas.service';
import { urlFotoHidrante } from './foto-hidrante';
import { Grupo, Capa } from '../models/capas.model';

@Injectable({
  providedIn: 'root',
})
export class CapasDiputacion implements OnInit {
  /*grupoDiputacion = [{ id: 0, name: 'principal' },
  { id: 1, name: 'Áreas de interés' }
  ];
  capas = [
    { id: 0, idGrupo: 0, tipo: 'puntos', texto: 'Hidrantes', imagen: './assets/capas/icons/hidrantes.png', nombreSource: 'Hidrantes', nombreJson: './assets/capas/hidrantes.geojson', checked: false },
    { id: 1, idGrupo: 0, tipo: 'puntos', texto: 'Inventario de medios y recursos', imagen: './assets/capas/icons/inventario-medios-recursos.png', nombreSource: 'InventarioRecursos', nombreJson: './assets/capas/inventario-medios-recursos.geojson', checked: false },
    { id: 2, idGrupo: 0, tipo: 'relleno', texto: 'Terminos Municipales', imagen: './assets/capas/icons/terminos-municipales.png', nombreSource: 'TerminosMunicipales', nombreJson: './assets/capas/terminos-municipales.geojson', color: '#0000ff', checked: false },
    { id: 3, idGrupo: 0, tipo: 'puntos', texto: 'Poligonos Industriales', imagen: './assets/capas/icons/poligonos-industriales.png', nombreSource: 'PoligonosIndustriales', nombreJson: './assets/capas/poligonos-industriales.geojson', checked: false },
    { id: 4, idGrupo: 0, tipo: 'puntos', texto: 'Estaciones de Servicios', imagen: './assets/capas/icons/estaciones-servicio.png', nombreSource: 'EstacionesServicio', nombreJson: './assets/capas/estaciones-servicio.geojson', checked: false },
    { id: 5, idGrupo: 0, tipo: 'puntos', texto: 'Policia Local', imagen: './assets/capas/icons/policia-local.png', nombreSource: 'PoliciaLocal', nombreJson: './assets/capas/policia-local.geojson', checked: false },
    { id: 6, idGrupo: 0, tipo: 'linea', texto: 'Rutas Escolares', imagen: './assets/capas/icons/rutas-escolares.png', nombreSource: 'RutasEscolares', nombreJson: './assets/capas/rutas-escolares.geojson', color: '#0000ff', grosro: 1, checked: false },
    { id: 7, idGrupo: 0, tipo: 'puntos', texto: 'Centros Salud', imagen: './assets/capas/icons/centros-salud.png', nombreSource: 'CentrosSalud', nombreJson: './assets/capas/centros-salud.geojson', checked: false },
    { id: 8, idGrupo: 0, tipo: 'puntos', texto: 'Parques Extincion Salvamento', imagen: './assets/capas/icons/bomberos-tipo2.png', nombreSource: 'ParquesExtincionSalvamento', nombreJson: './assets/capas/parques-extincion-salvamento.geojson', checked: false },
    { id: 9, idGrupo: 0, tipo: 'relleno', texto: 'Interfaz Urbano Hidráulica', imagen: './assets/capas/icons/interfaz-hidraulica.png', nombreSource: 'UrbanoHidraulica', nombreJson: './assets/capas/interfaz-urbano-hidraulica.zip', color: '#0000ff', checked: false },
    { id: 10, idGrupo: 0, tipo: 'relleno', texto: 'Interfaz Urbano Forestal', imagen: './assets/capas/icons/interfaz-forestal.png', nombreSource: 'UrbanoForestal', nombreJson: './assets/capas/interfaz-urbano-forestal.zip', color: '#0000ff', checked: false },
    { id: 11, idGrupo: 0, tipo: 'relleno', texto: 'Área Riesgo Incendio Por Arbolado Proximo Lineas Alta Tension ', imagen: './assets/capas/icons/riesgo-incendio.png', nombreSource: 'RiesgoIncendioArbolado', nombreJson: './assets/capas/riesgo-incendio-arbolado.geojson', color: '#0000ff', checked: false },
    { id: 12, idGrupo: 1, tipo: 'linea', texto: 'Ávila (provincia)', imagen: './assets/capas/icons/area-interes-avila.png', nombreSource: 'AvilaProvincia', nombreJson: './assets/capas/area-interes/avila.geojson', color: '#0051ff', grosor: 4, checked: false },
    { id: 13, idGrupo: 1, tipo: 'linea', texto: 'Área interés PLATEA', imagen: './assets/capas/icons/area-interes-platea.png', nombreSource: 'AvilaPlatea', nombreJson: './assets/capas/area-interes/platea.geojson', color: '#ff0000', grosor: 2, checked: false },
    { id: 14, idGrupo: 1, tipo: 'linea', texto: 'Provincias Colindantes', imagen: './assets/capas/icons/area-interes-provincias.png', nombreSource: 'AvilaProvinciaColindantes', nombreJson: './assets/capas/area-interes/provincias.geojson', grosor: 1, color: '#000000', checked: false },
  ];*/

  gruposAbiertos: { [id: number]: boolean } = { 1: true };
  modalClick$ = new Subject<string>();  // emite HTML cuando se pincha un punto


  grupoDiputacion: Grupo[] = [];
  capas: Capa[] = [];

  constructor(private capasService: CapasService) { }

  async ngOnInit(): Promise<void> {
    // Funciona igual en Android (SQLite) y en Web (HTTP)

  }

  async cargarCapasDiputacion(map: maplibregl.Map) {
    this.grupoDiputacion = await this.capasService.getGruposSeccion('diputacion');

    if (this.capas.length == 0) {
      for (const grupo of this.grupoDiputacion) {
        //this.capas.push(...await this.capasService.getCapasGrupo(grupo.id));
        const capas = await this.capasService.getCapasGrupo(grupo.id);
        this.capas.push(...capas);
      }
    }

    //console.log("capas Diputacion", this.capas);
    //console.log("capas grupoDiputacion", this.grupoDiputacion);

    for (const capa of this.capas) {
      await this.cargarCapaDiputacion(map, capa);
    }
  }

  getCapaPorSource(source: string): Capa | undefined {
    return this.capas.find(c => c.nombre_source === source);
  }

  async cargarCapaDiputacion(map: maplibregl.Map, capa: any) {
    if (map.getSource(capa.nombre_source)) return;
    if (capa.nombre_source == 'UrbanoHidraulica' && capa.checked) {
      await this.cargarCapaInterfazHidraulica(map, capa.url_json, capa.nombre_source, capa.checked);
    } else if (capa.nombre_source == 'UrbanoForestal' && capa.checked) {
      await this.cargarCapaInterfazForestal(map, capa.url_json, capa.nombre_source, capa.checked);
    } else if (capa.nombre_source == 'RiesgoIncendioArbolado' && capa.checked) {
      await this.cargarCapaRiesgoIncendioArbolado(map, capa.url_json, capa.nombre_source, capa.checked);
    } else if (capa.nombre_source == 'ParquesExtincionSalvamento' && capa.checked) {
      await this.cargarCapaPuntosParquesExtincionSalvamento(map, capa.url_json, capa.nombre_source, capa.checked);
    } else if (capa.nombre_source == 'CentrosSalud' && capa.checked) {
      await this.cargarCapaPuntosCentrosSalud(map, capa.url_json, capa.nombre_source, capa.checked);
    } else if (capa.nombre_source == 'TerminosMunicipales' && capa.checked) {
      await this.cargarCapaTerminosMunicipales(map, capa.url_json, capa.nombre_source, capa.checked, capa.color!);
    } else if (capa.tipo == 'puntos' && capa.checked) {
      await this.cargarCapaPuntos(map, capa.url_json, capa.nombre_source, capa.imagen, capa.checked);
    } else if (capa.tipo == 'relleno' && capa.checked) {
      await this.cargarCapaRelleno(map, capa.url_json, capa.nombre_source, capa.checked, capa.color!);
    } else if (capa.tipo == 'linea' && capa.checked) {
      await this.cargarCapaLinea(map, capa.url_json, capa.nombre_source, capa.checked, capa.color!, parseFloat(capa.grosor!));
    }
  }

  /**Funciones para cargar las capas que pueden relleno, puntos o lineas*/
  async cargarCapaRelleno(map: maplibregl.Map, urlGeoJSON: string, nombreSource: string, checked: boolean, color: string,) {
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
        'visibility': checked ? 'visible' : 'none',
      },
      'paint': {
        'fill-color': color,
        'fill-opacity': 0.3,
      }
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

  async cargarCapaPuntos(map: maplibregl.Map, urlGeoJSON: string, nombreSource: string, imagen: string, checked: boolean) {
    //console.log("URL capa puntos", urlGeoJSON, imagen);
    //console.log("Checked", checked);
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
    } else if (nombreSource == "InventarioRecursos") {
      nombreEtiqueta = "nombre";
    } else if (nombreSource == "PoligonosIndustriales") {
      nombreEtiqueta = "pol_name";
    } else if (nombreSource == "EstacionesServicio") {
      nombreEtiqueta = "name";
    } else if (nombreSource == "PoliciaLocal") {
      nombreEtiqueta = "ayto";
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
      const feature = e.features?.[0];
      const propiedades = feature?.properties;
      let contenido = '';

      if (nombreCapa == "Hidrantes") {
        contenido = this.datosHidrantes(propiedades);
      } else if (nombreCapa == "InventarioRecursos") {
        contenido = this.datosInventarioRecursos(propiedades);
      } else if (nombreCapa == "PoligonosIndustriales") {
        contenido = this.datosPoligonosIndustriales(propiedades, feature?.geometry);
      } else if (nombreCapa == "EstacionesServicio") {
        contenido = this.datosEstacionesServicio(propiedades, feature?.geometry);
      } else if (nombreCapa == "PoliciaLocal") {
        contenido = this.datosPoliciaLocal(propiedades, feature?.geometry);
      }

      if (contenido != '')
        this.modalClick$.next(contenido);
    });
  }

  async cargarCapaLinea(map: maplibregl.Map, urlGeoJSON: string, nombreSource: string, checked: boolean, color: string, grosor: number) {
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
        'visibility': checked ? 'visible' : 'none',
        'line-join': 'round',
        'line-cap': 'round'
      },
      'paint': {
        'line-color': color,
        'line-width': grosor
      }
    });

    map?.on('click', nombreCapa, (e) => {
      //Cargar en el modal la informacion del punto pinchado
      let contenido = '';

      for (const elemento of e.features!) {
        const propiedades = elemento.properties;
        contenido += this.datosRutasEscolares(propiedades);
      }

      this.modalClick$.next(contenido);
    });
  }

  async cargarCapaTerminosMunicipales(map: maplibregl.Map, urlGeoJSON: string, nombreSource: string, checked: boolean, color: string,) {
    let nombreCapa = nombreSource;
    const respuesta = await fetch(urlGeoJSON);
    const datosJson = await respuesta.json();

    console.log('Propiedades:', datosJson.features[0].properties);

    map.addSource(nombreSource, {
      'type': 'geojson',
      'data': datosJson,
    });

    map?.addLayer({
      'id': nombreCapa,
      'type': 'line',
      'source': nombreSource,
      'layout': {
        'line-join': 'round',
        'line-cap': 'round',
        'visibility': checked ? 'visible' : 'none',
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
        'text-size': 10,
        'text-max-width': 10,
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-optional': true,
      },
      paint: {
        'text-color': '#0000ff',
        'text-halo-color': '#ffffff',
        'text-halo-width': 2,
      }
    });

    map?.addLayer({
      'id': nombreCapa + "_fill",
      'type': 'fill',
      'source': nombreSource,
      'layout': {
        'visibility': checked ? 'visible' : 'none',
      },
      'paint': {
        'fill-color': color,
        'fill-opacity': 0.3,
      }
    });

    map?.on('click', nombreCapa + "_fill", (e) => {
      console.log("click");
      //Cargar en el modal la informacion del punto pinchado
      const propiedades = e.features?.[0].properties;
      let contenido = '';
      contenido = this.datosTerminosMunicipales(propiedades);
      this.modalClick$.next(contenido);
    });
  }

  async cargarCapaPuntosCentrosSalud(map: maplibregl.Map, urlGeoJSON: string, nombreSource: string, checked: boolean) {

    let nombreCapa = nombreSource;

    const iconos = [
      { id: 'icono-hospital', url: '/assets/capas/icons/hospital.png' },
      { id: 'icono-centro-guardia', url: '/assets/capas/icons/centro-guardia.png' },
      { id: 'icono-centro-polivalente', url: '/assets/capas/icons/centro-polivalente.png' },
      { id: 'icono-centro-salud', url: '/assets/capas/icons/centro-salud.png' },
      { id: 'icono-atencion-continuada', url: '/assets/capas/icons/puntos-atencion-continuada.png' },
    ];

    for (const icono of iconos) {
      await this.cargarImagen(map, icono.id, icono.url);
    }

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
        'icon-image': [
          'match', ['get', 'd_tipocent'],
          'Hospital', 'icono-hospital',
          'Centro de Guardia', 'icono-centro-guardia',
          'Centro de especialidades o polivalente', 'icono-centro-polivalente',
          'Centro de Salud', 'icono-centro-salud',
          'Punto de Atención Continuada', 'icono-atencion-continuada',
          'icono-hospital'
        ],
        'icon-size': 0.5,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });

    map?.addLayer({
      id: nombreSource + '_label',
      type: 'symbol',
      source: nombreSource,
      layout: {
        'visibility': checked ? 'visible' : 'none',
        'text-field': ['concat', ['get', 'd_tipocent'], '(', ['get', 'a_nombre'], ')'],
        'text-size': 10,
        'text-max-width': 10,
        'text-variable-anchor': ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
        'text-radial-offset': 1,
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
      let contenido = '';

      for (const elemento of e.features!) {
        const propiedades = elemento.properties;
        const geometry = elemento.geometry;
        contenido += this.datosCentrosSalud(propiedades, geometry);
      }

      this.modalClick$.next(contenido);
    });
  }

  async cargarCapaPuntosParquesExtincionSalvamento(map: maplibregl.Map, urlGeoJSON: string, nombreSource: string, checked: boolean) {
    const respuesta = await fetch(urlGeoJSON);
    const datosJson = await respuesta.json();

    const iconos = [
      { id: 'icono-bomberos1', url: '/assets/capas/icons/bomberos-tipo1.png' },
      { id: 'icono-bomberos2', url: '/assets/capas/icons/bomberos-tipo2.png' },
      { id: 'icono-bomberos3', url: '/assets/capas/icons/bomberos-tipo3a.png' },
      { id: 'icono-bomberos-Externo', url: '/assets/capas/icons/bomberos-externo.png' },
      { id: 'icono-proteccion-civil', url: '/assets/capas/icons/agente-proteccion-civil.png' },
      { id: 'icono-colaborador', url: '/assets/capas/icons/agente-colaborador.png' },
    ];

    for (const icono of iconos) {
      await this.cargarImagen(map, icono.id, icono.url);
    }

    map?.addSource(nombreSource, {
      'type': 'geojson',
      'data': datosJson,
    });

    map?.addLayer({
      'id': nombreSource,
      'type': 'symbol',
      'source': nombreSource,
      'layout': {
        'visibility': checked ? 'visible' : 'none',
        'icon-image': [
          'match', ['get', 'type'],
          'Parque de bomberos (Tipo 1)', 'icono-bomberos1',
          'Parque de bomberos (Tipo 2)', 'icono-bomberos2',
          'Parque de bomberos (Tipo 3b)', 'icono-bomberos3',
          'Parque externo colaborador', 'icono-bomberos-Externo',
          'Agrupación de Protección Civil', 'icono-proteccion-civil',
          'Agente colaborador', 'icono-colaborador',
          'icono-bomberos1'
        ],
        'icon-size': 0.5,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      }
    });

    map?.addLayer({
      id: nombreSource + '_label',
      type: 'symbol',
      source: nombreSource,
      layout: {
        'visibility': checked ? 'visible' : 'none',
        'text-field': ['get', 'name'],
        'text-size': 10,
        'text-max-width': 10,
        'text-variable-anchor': ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
        'text-radial-offset': 1.5,
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

  async cargarCapaInterfazForestal(map: maplibregl.Map, urlGeoJSON: string, nombreSource: string, checked: boolean) {
    const respuesta = await fetch(urlGeoJSON);
    const data = await respuesta.json();

    map?.addSource(nombreSource, {
      'type': 'geojson',
      'data': data,
      'tolerance': 0.5,
    });

    map?.addLayer({
      'id': nombreSource,
      'type': 'fill',
      'source': nombreSource,
      'layout': {
        'visibility': checked ? 'visible' : 'none',
      },
      'paint': {
        'fill-color': ['match', ['get', 'type'],
          'F', '#94d180',
          'U', '#7d8b8f',
          'I0', '#ffffff',
          '#121212'
        ],
        'fill-opacity': ['match', ['get', 'type'],
          'I0', 1,
          'F', 0.5,
          'U', 0.5,
          0
        ],
      }
    });

    map?.addLayer({
      'id': nombreSource + '_border',
      'type': 'line',
      'source': nombreSource,
      'layout': {
        'visibility': checked ? 'visible' : 'none',
        'line-join': 'round',
        'line-cap': 'round'
      },
      'paint': {
        'line-color': '#000000',
        'line-width': ['match', ['get', 'type'],
          'F', 0,
          'U', 0,
          'I0', 1,
          0
        ],
      }
    });
  }

  async cargarCapaInterfazHidraulica(map: maplibregl.Map, urlGeoJSON: string, nombreSource: string, checked: boolean) {
    const respuesta = await fetch(urlGeoJSON);
    const data = await respuesta.json();

    map?.addSource(nombreSource, {
      'type': 'geojson',
      'data': data,
    });

    this.cargarImagen(map, 'cuadricula-hidraulica', '/assets/capas/icons/cuadricula.png');

    map?.addLayer({
      'id': `${nombreSource}_pattern`,
      'type': 'fill',
      'source': nombreSource,
      'layout': {
        'visibility': checked ? 'visible' : 'none',
      },
      'filter': ['==', ['get', 'type'], 'SE'],
      'paint': {
        'fill-pattern': 'cuadricula-hidraulica',
        'fill-opacity': 1,
      }
    });

    map?.addLayer({
      'id': nombreSource,
      'type': 'fill',
      'source': nombreSource,
      'layout': {
        'visibility': checked ? 'visible' : 'none',
      },
      'paint': {
        'fill-color': ['match', ['get', 'type'],
          'U', '#7d8b8f',
          'H', '#25b1b6',
          '#121212'
        ],
        'fill-opacity': ['match', ['get', 'type'],
          'PO', 0,
          'SE', 0,
          0.5
        ],
      }
    });

    map?.addLayer({
      'id': nombreSource + '_border',
      'type': 'line',
      'source': nombreSource,
      'layout': {
        'visibility': checked ? 'visible' : 'none',
        'line-join': 'round',
        'line-cap': 'round'
      },
      'paint': {
        'line-color': '#000000',
        'line-width': ['match', ['get', 'type'],
          'U', 0,
          'H', 0,
          2
        ],
      }
    });
  }

  async cargarCapaRiesgoIncendioArbolado(map: maplibregl.Map, urlGeoJSON: string, nombreSource: string, checked: boolean) {
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
          ['<=', ['get', 'distances'], 5], '#ff0000',
          ['<=', ['get', 'distances'], 10], '#ff8080',
          ['<=', ['get', 'distances'], 17], '#ffbbbb',
          ['==', ['get', 'distances'], 99], '#00ff00',
          '#0000ff'
        ],
        'fill-opacity': ['case',
          ['==', ['get', 'distances'], 99], 0,
          0.5
        ],
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
        'line-color': '#000000',
        'line-width': 1,
      }
    });
  }

  /**Fin funciones para cargar las capas */





  /**Funciones para mostrar la información de cada capa*/
  datosTerminosMunicipales(propiedades: any): string {
    const name = propiedades?.['NAMEUNIT'] ?? 'N/D';
    const pob = propiedades?.['pob2020'] ?? 'N/D';
    const comarca = propiedades?.['comarca'] ?? 'N/D';
    const km2 = propiedades?.['km2'] ?? 'N/D';
    const parque = propiedades?.['parque'] ?? 'N/D';

    const crearBotonGrs = (titulo: string, url?: string) => {
      if (!url) return '';
      return `<a href="${url}" target="_blank" rel="noopener" class="popup-btn btn-secondary">📄 ${titulo} ↗</a>`;
    };

    return `
      <div class="popup-card">
        <div class="popup-title">
          <span>🏛️</span> <span>${name}</span>
        </div>

        <div class="popup-info">
          <div class="popup-row"><span class="label">Población (2020)</span><span class="value">${pob} hab.</span></div>
          <div class="popup-row"><span class="label">Comarca</span><span class="value">${comarca}</span></div>
          <div class="popup-row"><span class="label">Superficie</span><span class="value">${km2} km²</span></div>
          <div class="popup-row"><span class="label">Parque Bomberos</span><span class="value badge">${parque}</span></div>
        </div>

        <div class="popup-links">
          ${crearBotonGrs('GRS Incendio Urbano', propiedades?.['grs_urban_fire'])}
          ${crearBotonGrs('GRS Incendio Forestal', propiedades?.['grs_non_urban_fire'])}
          ${crearBotonGrs('GRS Inundación', propiedades?.['grs_flood'])}
          ${crearBotonGrs('GRS Mercancías Peligrosas', propiedades?.['grs_transportation_dangerous_goods'])}
          ${crearBotonGrs('GRS Riesgo Químico', propiedades?.['grs_chemical_hazard'])}
        </div>
      </div>
    `;
  }

  datosInventarioRecursos(propiedades: any): string {
    const mostrar = (label: string, v: any): string => {
      if (v === null || v === undefined || v === '' || v === 'NULL' || v === 0 || v === '0') return '';
      const valor = v === true || v === 'true' ? 'Sí' : v === false || v === 'false' ? 'No' : v;
      return `<div class="popup-row"><span class="label">${label}</span><span class="value">${valor}</span></div>`;
    };

    const nombre = propiedades?.nombre ?? 'Recurso sin nombre';

    return `
      <div class="popup-card">
        <div class="popup-title">
          <span>📦</span> <span>${nombre}</span>
        </div>

        <div class="popup-info">
          ${mostrar('ID Formulario', propiedades?.id)}
          ${mostrar('Fecha actualización', propiedades?.date)}
          ${mostrar('Datos Medios Humanos', propiedades?.is_medioshumanos)}
          ${mostrar('Bomberos voluntarios', propiedades?.num_bomb_vol)}
          ${mostrar('Bomberos Prot. Civil', propiedades?.num_bomb_pc)}
          ${mostrar('Bomberos profesionales', propiedades?.num_bomb_pro)}
          ${mostrar('Observaciones humanas', propiedades?.gral_notes)}
          ${mostrar('Autobomba disponible', propiedades?.is_autobomba)}
          ${mostrar('Capacidad agua autobomba', propiedades?.cap_agua_autobomba ? propiedades.cap_agua_autobomba + ' m³' : null)}
          ${mostrar('Tipo autobomba', propiedades?.autobomba_tipo)}
          ${mostrar('Antigüedad autobomba', propiedades?.years_automba ? propiedades.years_automba + ' años' : null)}
          ${mostrar('Notas autobomba', propiedades?.autobomba_notes)}
          ${mostrar('Nº Mangueras', propiedades?.num_maguera)}
          ${mostrar('Mangueras 25mm', propiedades?.mangaje25)}
          ${mostrar('Mangueras 45mm', propiedades?.mangaje45)}
          ${mostrar('Mangueras 70mm', propiedades?.mangaje70)}
          ${mostrar('Nº Lanzas', propiedades?.num_lanza)}
          ${mostrar('Caudal de lanza', propiedades?.lanza_caudal)}
          ${mostrar('Tipo de bomba', propiedades?.bomba_tipo)}
          ${mostrar('Motobombas', propiedades?.is_motobombas)}
          ${mostrar('Tipo motobombas', propiedades?.motobombas_type)}
          ${mostrar('Capacidad motobomba', propiedades?.cap_agua_motomba ? propiedades.cap_agua_motomba + ' m³' : null)}
          ${mostrar('Rescate en altura', propiedades?.is_rescate)}
          ${mostrar('EPIs rescate altura', propiedades?.epis_rescate_altura)}
          ${mostrar('Accesorios altura', propiedades?.acc_rescate_altura)}
          ${mostrar('Tipo Escala', propiedades?.TipoEscala)}
          ${mostrar('Dimensiones escala', propiedades?.dim_escala)}
          ${mostrar('Accidentes tráfico', propiedades?.is_acc_trafico)}
          ${mostrar('EPIs tráfico', propiedades?.is_epis_trafico)}
          ${mostrar('Cabrestantes', propiedades?.is_cabrestantes)}
          ${mostrar('Equipamiento incendios', propiedades?.is_incendios)}
          ${mostrar('EPIs incendios', propiedades?.is_epis_incendios)}
          ${mostrar('Fecha ITV', propiedades?.date_itv)}
          ${mostrar('Material tecnológico', propiedades?.mat_tech_resp_notes)}
          ${mostrar('Equip. Inundaciones', propiedades?.is_inunda)}
          ${mostrar('Bomba de limpieza', propiedades?.is_bomba_limp)}
          ${mostrar('Bomba de achique', propiedades?.is_bomba_achique)}
          ${mostrar('EPIs inundaciones', propiedades?.is_epis_inunda)}
          ${mostrar('Accidentes químicos', propiedades?.is_quimico)}
          ${mostrar('Equipo respiración', propiedades?.is_equipo_resp)}
          ${mostrar('Trajes NRBQ', propiedades?.trajes_nrbq)}
          ${mostrar('Medio acuático', propiedades?.epis_medio_acuatico)}
          ${mostrar('Barca', propiedades?.barca)}
          ${mostrar('Tipo barca', propiedades?.barca_tipo)}
          ${mostrar('Contacto', propiedades?.contact)}
        </div>
      </div>
    `;
  }

  datosHidrantes(propiedades: any): string {
  if (!propiedades) return '<p class="popup-empty">Sin información disponible</p>';

  const id = propiedades.id ?? 'N/D';
  const lat = propiedades.lat ?? 'N/D';
  const long = propiedades.long ?? 'N/D';
  const origen = propiedades.source ?? 'N/D';
  const fecha = propiedades.date ?? 'N/D';
  const urlMaps = propiedades.url_google_maps;

  // Mapeo Tipo de Conector
  const mapaTipoConector: Record<string | number, string> = {
    1: 'Racor Barcelona',
    2: 'Racor Madrid',
    3: 'Racor rosca 40 mm'
  };
  const rawConector = propiedades.connector_type ?? propiedades.tipo_conector;
  const tipoConector = (rawConector !== null && rawConector !== undefined && mapaTipoConector[rawConector]) 
    ? mapaTipoConector[rawConector] 
    : 'No indicado';

  // Mapeo Tipo de Hidrante
  const mapaTipoHidrante: Record<string | number, string> = {
    1: 'Hidrante de columna',
    2: 'Hidrante de arqueta',
    3: 'Embalse'
  };
  const rawHidrante = propiedades.hydrant_type ?? propiedades.tipo_hidrante;
  const tipoHidrante = (rawHidrante !== null && rawHidrante !== undefined && mapaTipoHidrante[rawHidrante]) 
    ? mapaTipoHidrante[rawHidrante] 
    : 'No indicado';

  // Lógica de foto con manejo de rutas flexible
  let fotoHtml = '';
  let pathPhoto: string = propiedades.path_photo || '';
  if (pathPhoto.trim() !== '') {
    pathPhoto = pathPhoto.replace(/\\/g, '/');
    const nombreArchivo = pathPhoto.split('/').pop();
    if (nombreArchivo && nombreArchivo.trim() !== '') {
    //  const src = `/assets/foto_hidrantes/${nombreArchivo}`;
      fotoHtml = `<img src="${urlFotoHidrante(pathPhoto)}" alt="Foto Hidrante ${id}" class="popup-img" onerror="this.style.display='none'" />`;
    }
  }

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
      </div>
      ${urlMaps ? `
        <a href="${urlMaps}" target="_blank" rel="noopener noreferrer" class="popup-btn">
          <span>Ver en Google Maps</span> ↗
        </a>
      ` : ''}
    </div>
  `;
}

  datosPoligonosIndustriales(propiedades: any, geometry: any): string {
    const nombre = propiedades?.['pol_name'] ?? 'Polígono Industrial';
    const ttmm = propiedades?.['ttmm'] ?? 'N/D';
    const sector = propiedades?.['sector'] ?? 'N/D';
    const empresas = propiedades?.['companies'] ?? 'N/D';
    const actividades = propiedades?.['activities'];
    const esAgricola = propiedades?.['is_farming'] == 1 ? 'Sí' : 'No';

    const [lng, lat] = geometry?.coordinates ?? [0, 0];
    const urlMaps = `https://www.google.com/maps/place/${lat},${lng}`;

    return `
      <div class="popup-card">
        <div class="popup-title">
          <span>🏭</span> <span>${nombre}</span>
        </div>

        <div class="popup-info">
          <div class="popup-row"><span class="label">Municipio</span><span class="value">${ttmm}</span></div>
          <div class="popup-row"><span class="label">Sector Principal</span><span class="value">${sector}</span></div>
          <div class="popup-row"><span class="label">Empresas clave</span><span class="value">${empresas}</span></div>
          ${actividades ? `<div class="popup-row"><span class="label">Actividades</span><span class="value">${actividades}</span></div>` : ''}
          <div class="popup-row"><span class="label">Ind. Agrícola</span><span class="value badge">${esAgricola}</span></div>
        </div>

        <a href="${urlMaps}" target="_blank" rel="noopener" class="popup-btn">
          <span>Ver en Google Maps</span> ↗
        </a>
      </div>
    `;
  }

  datosEstacionesServicio(propiedades: any, geometry: any): string {
    const nombre = propiedades?.['name'] ?? 'Estación de Servicio';
    const direccion = propiedades?.['direction'] ?? 'N/D';
    const compania = propiedades?.['company'] ?? 'N/D';
    const horario = propiedades?.['horario'] ?? 'N/D';

    const [lng, lat] = geometry?.coordinates ?? [0, 0];
    const urlMaps = `https://www.google.com/maps/place/${lat},${lng}`;

    return `
      <div class="popup-card">
        <div class="popup-title">
          <span>⛽</span> <span>${nombre}</span>
        </div>

        <div class="popup-info">
          <div class="popup-row"><span class="label">Compañía</span><span class="value badge">${compania}</span></div>
          <div class="popup-row"><span class="label">Dirección</span><span class="value">${direccion}</span></div>
          <div class="popup-row"><span class="label">Horario</span><span class="value">${horario}</span></div>
        </div>

        <a href="${urlMaps}" target="_blank" rel="noopener" class="popup-btn">
          <span>Ver en Google Maps</span> ↗
        </a>
      </div>
    `;
  }

  datosPoliciaLocal(propiedades: any, geometry: any): string {
    const ayto = propiedades?.['ayto'] ?? 'Ayuntamiento';
    const tipo = propiedades?.['tipos'] ?? 'N/D';
    const provincia = propiedades?.['provincia'] ?? 'N/D';

    const [lng, lat] = geometry?.coordinates ?? [0, 0];
    const urlMaps = `https://www.google.com/maps/place/${lat},${lng}`;

    return `
      <div class="popup-card">
        <div class="popup-title">
          <span>👮</span> <span>Policía Local - ${ayto}</span>
        </div>

        <div class="popup-info">
          <div class="popup-row"><span class="label">Tipo</span><span class="value">${tipo}</span></div>
          <div class="popup-row"><span class="label">Provincia</span><span class="value">${provincia}</span></div>
        </div>

        <a href="${urlMaps}" target="_blank" rel="noopener" class="popup-btn">
          <span>Ver en Google Maps</span> ↗
        </a>
      </div>
    `;
  }

  datosRutasEscolares(propiedades: any): string {
    const nombre = propiedades?.['nombre'] ?? 'Ruta Escolar';

    return `
      <div class="popup-card">
        <div class="popup-title">🚌 <span>${nombre}</span></div>
      </div>
    `;
  }

  datosCentrosSalud(propiedades: any, geometry: any): string {
    const nombre = propiedades?.['a_nombre'] ?? 'Centro Sanitario';
    const tipo = propiedades?.['d_tipocent'] ?? 'N/D';
    const [lng, lat] = geometry?.coordinates ?? [0, 0];
    const urlMaps = `https://www.google.com/maps/place/${lat},${lng}`;

    return `
      <div class="popup-card">
        <div class="popup-title">🏥 <span>${nombre}</span></div>

        <div class="popup-info">
          <div class="popup-row">
            <span class="label">Tipo Centro</span>
            <span class="value badge">${tipo}</span>
          </div>
        </div>

        <a href="${urlMaps}" target="_blank" rel="noopener" class="popup-btn">
          <span>Ver en Google Maps</span> ↗
        </a>
      </div>
    `;
  }

  toggleGrupoDiputacion(grupo: any): void {
    const idGrupo = typeof grupo === 'object' ? grupo?.id : grupo;

    if (idGrupo !== undefined) {
      this.gruposAbiertos[idGrupo] = !this.gruposAbiertos[idGrupo];
    }
  }
}

