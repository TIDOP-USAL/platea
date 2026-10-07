import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';  // ← de Angular
import { FormsModule } from '@angular/forms';
import { IonListHeader, IonModal, IonButton, IonButtons, IonIcon, IonLabel, IonCheckbox, IonHeader, IonToolbar, IonTitle, IonList, IonRadioGroup, IonRadio, IonItem, IonContent } from '@ionic/angular/standalone';

import { closeCircleOutline, locationOutline, documentTextOutline, saveOutline,
   closeOutline, navigateOutline, documentOutline, alertCircleOutline, 
   cloudUpload, chevronUpOutline, chevronDownOutline, 
   globe, albums, close, download, 
   flash, syncOutline} from 'ionicons/icons';
import { ModalController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { constructOutline, sunnyOutline, moonOutline } from 'ionicons/icons';
import { MapaService } from '../services/mapa-service';
import { CapasDiputacion } from '../services/capas-diputacion';
import { CapasOffline } from '../services/capas-offline';
import { CapasOnline } from '../services/capas-online';
import { EmergenciaService, Emergencia, ResultadosEmergencia } from '../services/emergencia';
import { ModalEmergenciaComponent } from '../components/modal-emergencia/modal-emergencia.component';
import { CapasService } from '../services/capas.service';
import { CapasSqliteService } from '../services/capas-sqlite.service';
import { ActualizarCapasComponent } from '../components/actualizar-capas/actualizar-capas.component';
import { Capacitor } from '@capacitor/core';
//import { IonButtons } from '@ionic/angular';
//import { IonImg } from '@ionic/angular';
addIcons({
  'construct-outline': constructOutline,
  'sunny-outline': sunnyOutline,
  'moon-outline': moonOutline
});
@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [CommonModule, FormsModule, IonListHeader, IonModal, IonButton, IonButtons, IonIcon, IonLabel, IonCheckbox, IonHeader, IonToolbar, IonTitle, IonList, IonRadioGroup, IonRadio, IonItem, IonContent],
})
export class HomePage implements OnInit {
  mostrarListaCapas = false;
  mostrarListaCapasOffline = false;
  mostrarListaCapasOnline = false;
  mostrarListaTerrenos = false;
  // El botón de actualizar capas solo existe en el móvil (en la web las capas van en vivo)
  esNativo = Capacitor.isNativePlatform();
  sinCapasDescargadas = false;
  mostrarOpcionLeyendas = false;
  mostrarLeyendas = false;
  isModalOpen = false;
  modalContent: string = "";

  isModalEmergenciaOpen = false;
  modoSeleccionMapa: boolean = false;
  coordsSeleccionadas: { coordEste: number, coordNorte: number } | null = null;  
 
  capasEmergenciaActiva: string[] = [];
  mostrarLimpiarEmergencias = false;
  leyendasInforme = false;
  emergencia: Emergencia;
  resultadosEmergencia: ResultadosEmergencia | null = null;
  esModoOscuro = false;

 toggleDarkMode() {
    this.esModoOscuro = !this.esModoOscuro;
    document.body.classList.toggle('dark', this.esModoOscuro);
  }
  constructor(public mapa: MapaService,
    private modalCtrl: ModalController,
    public capasDiputacion: CapasDiputacion,
    public capasOffline: CapasOffline,
    public capasOnline: CapasOnline,
    public emergenciaService: EmergenciaService,
    private capasService: CapasService,
    private capasSqlite: CapasSqliteService) {
    addIcons({ closeCircleOutline, locationOutline, documentTextOutline, saveOutline, closeOutline, 
              navigateOutline, documentOutline, alertCircleOutline, constructOutline, 
              cloudUpload, chevronUpOutline, chevronDownOutline, globe, albums, close, download, syncOutline });
    this.emergencia = this.emergenciaService.getEmergenciaVacia();
  }

  ngOnInit() {
    this.capasDiputacion.modalClick$.subscribe((html: string) => {
      this.modalContent = html;
      this.setOpen(true);
    });
    this.capasOffline.modalClick$.subscribe((html: string) => {
      this.modalContent = html;
      this.setOpen(true);
    });
    this.capasOnline.modalClick$.subscribe((html: string) => {
      this.modalContent = html;
      this.setOpen(true);
    });
    this.emergenciaService.modalClick$.subscribe((html: string) => {
      this.modalContent = html;
      this.setOpen(true);
    });
  }

  ocultarLoader () {
      const loader = document.getElementById('app-loader');
      if (loader && !loader.classList.contains('hidden')) {
        loader.classList.add('hidden');
        //setTimeout(() => loader.remove(), 400);
      }
    };
  async ngAfterViewInit() {
    await this.capasService.whenReady();
    if (this.esNativo) {
      this.sinCapasDescargadas = !(await this.capasSqlite.tieneCapasDescargadas());
    }
    this.mapa.inicializar('map');
    await this.capasDiputacion.cargarCapasDiputacion(this.mapa.map!);
    await this.capasOffline.cargarCapasOffline(this.mapa.map!);
    this.capasOnline.cargarCapasOnline(this.mapa.map!);
    
    
    this.mapa.map!.once('idle', this.ocultarLoader);  

    if (this.mapa.map!.loaded()) {
      this.ocultarLoader();
    } else {
      this.mapa.map!.once('load', this.ocultarLoader);   // ← 'load' en vez de 'idle'
      setTimeout(this.ocultarLoader, 2000);               // fallback por si acaso
    }
  }

  ionViewDidEnter() {
    this.mapa.resize();
  }

  ngOnDestroy() {
    this.mapa.destruir();
  }

  /**
   * Cambia el estilo del mapa
   * @param event El evento que se ha producido
   * @returns void
   */
  changeStyleMap(event: Event): void {
    this.mapa.changeStyleMap(event);
    this.mapa.map?.once('styledata', () => {
      this.capasDiputacion.cargarCapasDiputacion(this.mapa.map!);
      this.capasOffline.cargarCapasOffline(this.mapa.map!);
      this.capasOnline.cargarCapasOnline(this.mapa.map!);
      if (this.mostrarLimpiarEmergencias) 
        this.dibujarEmergenciaEnMapa();
    });
    this.mostrarListaTerrenos = false;
  }


  /**
   * Abre o cierra el modal que muestra la informacion del punto pinchado
   * @param isOpen true para abrir el modal, false para cerrar el modal
   */
 setOpen(isOpen: boolean) {
  console.log('Cambiando estado del modal a:', isOpen);
  this.isModalOpen = isOpen;
}
  /**
   * Carga una capa en el mapa cuando se marca una capa en el checkbox
   * @param capa La capa que se va a cargar
   * @param tipo El tipo de capa (diputacion, offline, online)
   * @param event El evento que se ha producido
   * @returns void
   */
  async onCapasChange(capa: any, tipo: string, event: any): Promise<void> {
    capa.checked = event.detail.checked;
    //Si la capa no existe en el mapa, se carga
    if (!this.mapa.map?.getLayer(capa.nombre_source)) {
      //Al cargar una capa muestro el loader
      const loader = document.getElementById('app-loader');
      if (loader && loader.classList.contains('hidden')) {
        loader.classList.remove('hidden');
      }
      //En Android el GeoJSON se construye desde SQLite solo ahora (no al arrancar)
      if (capa.checked) await this.capasService.asegurarContenido(capa);
      //Se carga la capa
      if (tipo == 'diputacion')
        this.capasDiputacion.cargarCapaDiputacion(this.mapa.map!, capa);
      else if (tipo == 'offline')
        this.capasOffline.cargarCapaOffline(this.mapa.map!, capa);
      else if (tipo == 'online')
        this.capasOnline.cargarCapaOnline(this.mapa.map!, capa);
      //Una vez cargada la capa se quita el loader
      this.mapa.map!.once('idle', this.ocultarLoader);  
      return;
    }
    //Si la capa existe en el mapa, se oculta o se muestra
    this.mapa.onCapasChange(capa, event);
  }

  /**
   * Abre el modal de emergencia y maneja la logica de seleccion de coordenadas en el mapa
   * @param coords Coordenadas {coordEste, coordNorte} opcionales para inicializar la emergencia
   */
  async abrirModalEmergencia(coords?: { coordEste: number, coordNorte: number }) {
    if (coords) {
      this.emergenciaService.emergencia.coordEste = coords.coordEste;
      this.emergenciaService.emergencia.coordNorte = coords.coordNorte;
    }
    const modal = await this.modalCtrl.create({
      component: ModalEmergenciaComponent
    });
    await modal.present();

    const { data } = await modal.onDidDismiss();
 
    if (data?.accion === 'mostrar_en_mapa') {
      this.emergencia = data.emergencia;
      this.resultadosEmergencia = data.resultados;
      this.dibujarEmergenciaEnMapa();
    } else if (data?.accion === 'seleccionar_mapa') {
      this.activarSeleccionMapa();
    }

  }
  
  /**
   * Activa el modo de seleccion de coordenadas en el mapa
   * El usuario debe hacer clic en el mapa para seleccionar las coordenadas
   */
  activarSeleccionMapa() {
    //console.log("dentro activar seleccion");
    this.modoSeleccionMapa = true;
    // Cambia el cursor o muestra un aviso al usuario
    this.mapa.map!.once('click', async (e: any) => {
      const coords = e.lngLat; // o e.coordinate según tu librería de mapas
      
      // Guarda las coordenadas donde tengas el objeto emergencia
      this.coordsSeleccionadas = {
        coordEste: parseFloat(coords.lng.toFixed(6)),
        coordNorte: parseFloat(coords.lat.toFixed(6))
      };

      this.modoSeleccionMapa = false;
      this.isModalOpen = false;
      // Vuelve a abrir el modal con las coordenadas ya rellenas
      await this.abrirModalEmergencia(this.coordsSeleccionadas);
    });
  }

  /**
   * Dibuja la emergencia en el mapa con las capas necesarias
   */
  dibujarEmergenciaEnMapa() {
    this.emergenciaService.dibujarEmergenciaEnMapa(this.mapa.map!);
    this.mostrarLimpiarEmergencias = true;
    this.leyendasInforme = true;
  }
  
  /**
   * Limpia las capas de la emergencia del mapa
  */
  limpiarCapasEmergencia() {
    this.emergenciaService.limpiarCapasEmergencia(this.mapa.map!);
    this.mostrarLimpiarEmergencias = false;
    this.leyendasInforme = false;
  }

  /**
   * Abre la ventana de actualización de capas (solo móvil). Al cerrarla, si se
   * ha descargado/actualizado/eliminado algo, se recargan las capas del mapa.
   */
  async abrirActualizarCapas() {
    this.mostrarListaCapas = false;
    this.mostrarListaCapasOffline = false;
    this.mostrarListaCapasOnline = false;
    this.mostrarListaTerrenos = false;
    this.mostrarOpcionLeyendas = false;

    const modal = await this.modalCtrl.create({
      component: ActualizarCapasComponent,
      backdropDismiss: false,
    });
    await modal.present();

    const { data } = await modal.onDidDismiss();
    if (data?.actualizado) {
      await this.recargarCapasDelMapa();
    }
  }

  /**
   * Quita del mapa las capas de datos y las vuelve a cargar desde SQLite, para
   * reflejar lo que se acaba de descargar, actualizar o eliminar.
   */
  private async recargarCapasDelMapa() {
    const map = this.mapa.map!;
    const loader = document.getElementById('app-loader');
    loader?.classList.remove('hidden');

    // 1) Quitar del mapa lo que ya estaba cargado (capas y sus sources, incluido *_icono)
    const fuentes = new Set<string>();
    for (const c of [...this.capasDiputacion.capas, ...this.capasOffline.capasOffline, ...this.capasOnline.capasOnline]) {
      if (c.nombre_source) {
        fuentes.add(c.nombre_source);
        fuentes.add(c.nombre_source + '_icono');
      }
    }
    for (const layer of [...(map.getStyle()?.layers ?? [])] as any[]) {
      if (fuentes.has(layer.source)) map.removeLayer(layer.id);
    }
    for (const s of fuentes) {
      if (map.getSource(s)) map.removeSource(s);
    }

    // 2) Vaciar las cachés de los servicios y volver a leer de SQLite
    this.capasDiputacion.capas = [];
    this.capasOffline.capasOffline = [];
    this.capasOnline.capasOnline = [];
    await this.capasDiputacion.cargarCapasDiputacion(map);
    await this.capasOffline.cargarCapasOffline(map);
    await this.capasOnline.cargarCapasOnline(map);

    this.sinCapasDescargadas = !(await this.capasSqlite.tieneCapasDescargadas());
    map.once('idle', this.ocultarLoader);
    setTimeout(this.ocultarLoader, 2000); // por si no llega a emitirse 'idle'
  }

}