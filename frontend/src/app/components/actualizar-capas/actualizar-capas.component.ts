import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
  IonList, IonListHeader, IonItem, IonLabel, IonCheckbox, IonBadge, IonNote,
  IonProgressBar, IonSpinner, ModalController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, cloudDownloadOutline, checkmarkCircleOutline, alertCircleOutline, refreshOutline } from 'ionicons/icons';
import {
  CapasSqliteService, ItemActualizacion, PlanActualizacion,
  ProgresoActualizacion, ResultadoActualizacion,
} from '../../services/capas-sqlite.service';

type Vista = 'buscando' | 'lista' | 'progreso' | 'resultado' | 'error';

interface GrupoLista {
  titulo: string;
  items: ItemActualizacion[];
}

@Component({
  selector: 'app-actualizar-capas',
  templateUrl: './actualizar-capas.component.html',
  styleUrls: ['./actualizar-capas.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonButton, IonIcon,
    IonList, IonListHeader, IonItem, IonLabel, IonCheckbox, IonBadge, IonNote,
    IonProgressBar, IonSpinner,
  ],
})
export class ActualizarCapasComponent implements OnInit {
  vista: Vista = 'buscando';
  mensajeError = '';

  plan: PlanActualizacion | null = null;
  obligatorias: ItemActualizacion[] = [];   // se descargan solas
  gruposOpcionales: GrupoLista[] = [];      // las elige el usuario
  seleccionadas = new Set<number>();        // ids de capas opcionales marcadas
  numAlDia = 0;

  progreso: ProgresoActualizacion | null = null;
  resultado: ResultadoActualizacion | null = null;

  constructor(
    private capasSqlite: CapasSqliteService,
    private modalCtrl: ModalController,
  ) {
    addIcons({
      'close-outline': closeOutline,
      'cloud-download-outline': cloudDownloadOutline,
      'checkmark-circle-outline': checkmarkCircleOutline,
      'alert-circle-outline': alertCircleOutline,
      'refresh-outline': refreshOutline,
    });
  }

  ngOnInit() {
    this.buscarCambios();
  }

  // ── Paso 1: comparar catálogo del servidor con lo que hay en el móvil ───

  async buscarCambios() {
    this.vista = 'buscando';
    this.mensajeError = '';
    try {
      this.plan = await this.capasSqlite.prepararActualizacion();

      this.obligatorias = this.capasSqlite.itemsObligatoriosPendientes(this.plan);
      this.numAlDia = this.plan.items.filter(i => i.estado === 'actualizada').length;

      // Opcionales: no obligatorias y con algo que descargar (nueva o con cambios)
      const opcionales = this.plan.items.filter(i => !i.obligatoria && i.estado !== 'actualizada');
      const porGrupo = new Map<string, ItemActualizacion[]>();
      for (const item of opcionales) {
        const clave = `${item.seccion.nombre} · ${item.grupo.nombre}`;
        if (!porGrupo.has(clave)) porGrupo.set(clave, []);
        porGrupo.get(clave)!.push(item);
      }
      this.gruposOpcionales = [...porGrupo.entries()].map(([titulo, items]) => ({ titulo, items }));

      // Las capas ya descargadas que tienen cambios vienen marcadas por defecto
      this.seleccionadas = new Set(
        opcionales.filter(i => i.estado === 'con_cambios').map(i => i.capa.id)
      );
      this.vista = 'lista';
    } catch (err: any) {
      console.error('[Actualizar] Error buscando cambios', err);
      this.mensajeError = 'No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.';
      this.vista = 'error';
    }
  }

  // ── Selección ───────────────────────────────────────────────────────────

  alternar(item: ItemActualizacion, marcada: boolean) {
    if (marcada) this.seleccionadas.add(item.capa.id);
    else this.seleccionadas.delete(item.capa.id);
  }

  get totalOpcionales(): number {
    return this.gruposOpcionales.reduce((n, g) => n + g.items.length, 0);
  }

  get todasMarcadas(): boolean {
    return this.totalOpcionales > 0 && this.seleccionadas.size === this.totalOpcionales;
  }

  alternarTodas(marcar: boolean) {
    this.seleccionadas.clear();
    if (marcar) {
      for (const g of this.gruposOpcionales) for (const i of g.items) this.seleccionadas.add(i.capa.id);
    }
  }

  get itemsADescargar(): ItemActualizacion[] {
    const elegidas: ItemActualizacion[] = [];
    for (const g of this.gruposOpcionales) {
      for (const i of g.items) {
        if (this.seleccionadas.has(i.capa.id)) elegidas.push(i);
      }
    }
    return [...this.obligatorias, ...elegidas];
  }

  /** Tamaño aproximado: solo cuenta las capas nuevas (de las que tienen cambios se baja solo el delta). */
  get tamanoEstimado(): number {
    return this.itemsADescargar
      .filter(i => i.estado === 'nueva')
      .reduce((n, i) => n + (i.capa.tamano_bytes || 0), 0);
  }

  get hayCapasConCambios(): boolean {
    return this.itemsADescargar.some(i => i.estado === 'con_cambios' && !i.sinContenido);
  }

  get hayQueEliminar(): boolean {
    return (this.plan?.eliminadasEnServidor.length ?? 0) > 0;
  }

  get nadaQueHacer(): boolean {
    return this.itemsADescargar.length === 0 && !this.hayQueEliminar;
  }

  // ── Paso 2: descargar ───────────────────────────────────────────────────

  async descargar() {
    if (!this.plan) return;
    this.vista = 'progreso';
    this.progreso = null;
    this.resultado = await this.capasSqlite.ejecutarActualizacion(
      this.itemsADescargar,
      this.plan.eliminadasEnServidor,
      p => { this.progreso = p; },
    );
    this.vista = 'resultado';
  }

  // ── Utilidades de la vista ─────────────────────────────────────────────

  get porcentaje(): number {
    if (!this.progreso || !this.progreso.total) return 0;
    // La capa en curso cuenta como "mitad hecha" para que la barra avance
    const hechas = this.progreso.fase === 'fin' ? this.progreso.indice : this.progreso.indice - 0.5;
    return Math.max(0, Math.min(1, hechas / this.progreso.total));
  }

  textoFase(): string {
    switch (this.progreso?.fase) {
      case 'imagen': return 'Descargando imagen…';
      case 'metadatos': return 'Guardando datos de la capa…';
      case 'contenido':
        return this.progreso?.filasDescargadas
          ? `Descargando datos… ${this.progreso.filasDescargadas.toLocaleString('es-ES')} elementos`
          : 'Descargando datos…';
      default: return '';
    }
  }

  formatoTamano(bytes: number): string {
    if (!bytes) return '—';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  nombreCapa(id: number): string {
    return this.plan?.items.find(i => i.capa.id === id)?.capa.texto ?? `Capa ${id}`;
  }

  // ── Cerrar ──────────────────────────────────────────────────────────────

  cerrar() {
    if (this.vista === 'progreso') return; // no se puede cerrar a medias
    const r = this.resultado;
    this.modalCtrl.dismiss({
      actualizado: !!r && (r.correctas.length > 0 || r.eliminadas.length > 0),
      correctas: r?.correctas ?? [],
      eliminadas: r?.eliminadas ?? [],
    });
  }
}