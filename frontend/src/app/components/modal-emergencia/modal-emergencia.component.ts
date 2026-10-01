import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular/standalone';
import { EmergenciaService, ResultadosEmergencia } from '../../services/emergencia';
import { addIcons } from 'ionicons';
import {mapOutline,
  locationOutline, documentTextOutline, saveOutline,
  chevronUpOutline, chevronDownOutline, closeOutline,
  alertCircleOutline, navigateOutline, documentOutline,
  arrowBackOutline, businessOutline, flameOutline, peopleOutline, waterOutline
} from 'ionicons/icons';
import { IonNote,
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonButton, IonIcon, IonList, IonListHeader, IonItem,
  IonLabel, IonInput, IonSelect, IonSelectOption,
  IonTextarea
} from '@ionic/angular/standalone';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal-emergencia',
  templateUrl: './modal-emergencia.component.html',
  styleUrls: ['./modal-emergencia.component.scss'],
  standalone: true,
  imports: [
    CommonModule, IonNote,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
    IonButton, IonIcon, IonList, IonListHeader, IonItem,
    IonLabel, IonInput, IonSelect, IonSelectOption,
    IonTextarea
  ]
})
export class ModalEmergenciaComponent  implements OnInit {
  
  @Input() coordsIniciales?: { coordEste: number, coordNorte: number };
  faltanCamposObligatorios = false;
  vista: 'formulario' | 'resumen' = 'formulario';
  cargando = false;
  resultados?:ResultadosEmergencia | null = null;
  ngOnInit() {
    if (this.coordsIniciales) {
      this.emergenciaService.emergencia.coordEste = this.coordsIniciales.coordEste;
      this.emergenciaService.emergencia.coordNorte = this.coordsIniciales.coordNorte;
    }
  }
  seccionesAbiertas: { [key: string]: boolean } = {
    geo: true,
    params: true,
    archivo: true
  };

  constructor(
    public emergenciaService: EmergenciaService,
    private modalCtrl: ModalController
  ) {
    addIcons({
      'map-outline': mapOutline,
      'location-outline': locationOutline,
      'document-text-outline': documentTextOutline,
      'save-outline': saveOutline,
      'chevron-up-outline': chevronUpOutline,
      'chevron-down-outline': chevronDownOutline,
      'close-outline': closeOutline,
      'alert-circle-outline': alertCircleOutline,
      'navigate-outline': navigateOutline,
      'document-outline': documentOutline,
    'arrow-back-outline': arrowBackOutline,
    'business-outline': businessOutline,
    'flame-outline': flameOutline,
    'people-outline': peopleOutline,
    'water-outline': waterOutline,

    });
  }

  toggleSeccion(key: string) {
    this.seccionesAbiertas[key] = !this.seccionesAbiertas[key];
  }

  async usarUbicacion() {
    await this.emergenciaService.usarUbicacionActual();
  }

  cerrar() {
    this.modalCtrl.dismiss({ accion: this.resultados ? 'mostrar_en_mapa' : null,
      emergencia: this.emergenciaService.emergencia,
      resultados: this.emergenciaService.resultados});
  }
  
  async seleccionarEnMapa() {
    // Cierra el modal pasando una señal de que quiere seleccionar
    await this.modalCtrl.dismiss({ accion: 'seleccionar_mapa'/*
      */
    });
  }


  async generarResumen() {
    if (!this.emergenciaService.esValida()) {
      this.faltanCamposObligatorios=true;
      // puedes mostrar un toast aquí
      return;
    }
    this.cargando = true;
    try {
      this.resultados = await this.emergenciaService.buscarRecursos();      
      this.vista = 'resumen';
    } catch (e) {
      console.error(e);
    } finally {
      this.cargando = false;
    }
  }

  volver() {
    this.vista = 'formulario';
  }
}
