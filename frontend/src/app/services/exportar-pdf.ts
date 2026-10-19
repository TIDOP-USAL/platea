import { Injectable } from '@angular/core';
import * as maplibregl from 'maplibre-gl';
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

export interface ElementoLeyenda {
  texto: string;
  imagen?: string;
}

const LOGO = './assets/img/logo_platea.png';
const MARGEN = 10;          // mm
const ANCHO_LEYENDA = 65;   // mm

/**
 * Genera un PDF (A4 apaisado) con lo que se ve en el mapa: cabecera con logo,
 * título y fecha, la imagen del mapa y la leyenda de las capas activas.
 */
@Injectable({ providedIn: 'root' })
export class ExportarPdfService {

  /**
   * Crea el PDF y lo descarga (web) o lo guarda en Documentos (móvil)
   * @param map El mapa
   * @param leyenda Capas visibles que se listan junto al mapa
   * @returns La ruta o nombre del archivo generado
   */
  async exportar(map: maplibregl.Map, leyenda: ElementoLeyenda[]): Promise<string> {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const anchoPag = doc.internal.pageSize.getWidth();
    const altoPag = doc.internal.pageSize.getHeight();
    const fecha = new Date();

    // Cabecera
    const logo = await cargarImagen(LOGO);
    if (logo) doc.addImage(logo.dataUrl, 'PNG', MARGEN, MARGEN, 45, 45 * logo.alto / logo.ancho);
    doc.setTextColor(10, 108, 194);
    doc.setFontSize(16);
    doc.text('Mapa PLATEA', anchoPag - MARGEN, MARGEN + 6, { align: 'right' });
    doc.setTextColor(63, 63, 63);
    doc.setFontSize(10);
    doc.text(fecha.toLocaleString('es-ES'), anchoPag - MARGEN, MARGEN + 12, { align: 'right' });
    const yMapa = MARGEN + 20;
    doc.setDrawColor(217, 217, 217);
    doc.line(MARGEN, yMapa - 3, anchoPag - MARGEN, yMapa - 3);

    // Mapa, ajustado al hueco disponible manteniendo la proporción de la pantalla
    const imgMapa = await capturarMapa(map);
    const anchoHueco = anchoPag - 2 * MARGEN - (leyenda.length ? ANCHO_LEYENDA + 5 : 0);
    const altoHueco = altoPag - yMapa - MARGEN;
    const escala = Math.min(anchoHueco / imgMapa.ancho, altoHueco / imgMapa.alto);
    const anchoMapa = imgMapa.ancho * escala;
    const altoMapa = imgMapa.alto * escala;
    doc.addImage(imgMapa.dataUrl, 'JPEG', MARGEN, yMapa, anchoMapa, altoMapa);
    doc.rect(MARGEN, yMapa, anchoMapa, altoMapa);

    // Leyenda a la derecha del mapa; si no cabe, sigue en otra página
    if (leyenda.length) {
      const xLeyenda = MARGEN + anchoMapa + 5;
      let y = yMapa + 5;
      doc.setFontSize(12);
      doc.setTextColor(10, 108, 194);
      doc.text('Capas visibles', xLeyenda, y);
      y += 7;
      doc.setFontSize(9);
      doc.setTextColor(43, 43, 43);
      for (const elem of leyenda) {
        const lineas = doc.splitTextToSize(elem.texto, ANCHO_LEYENDA - 8) as string[];
        const altoElem = Math.max(6, lineas.length * 4 + 2);
        if (y + altoElem > altoPag - MARGEN) {
          doc.addPage();
          y = MARGEN + 5;
        }
        const icono = elem.imagen ? await cargarImagen(elem.imagen) : null;
        if (icono) doc.addImage(icono.dataUrl, 'PNG', xLeyenda, y - 3.5, 5, 5);
        doc.text(lineas, xLeyenda + 7, y);
        y += altoElem;
      }
    }

    const nombre = `mapa-platea-${fecha.toISOString().slice(0, 16).replace(/[:T]/g, '-')}.pdf`;
    if (Capacitor.isNativePlatform()) {
      const base64 = doc.output('datauristring').split(',')[1];
      const res = await Filesystem.writeFile({ path: nombre, data: base64, directory: Directory.Documents });
      return res.uri;
    }
    doc.save(nombre);
    return nombre;
  }
}

/** Captura el canvas del mapa justo después de un repintado */
function capturarMapa(map: maplibregl.Map): Promise<{ dataUrl: string; ancho: number; alto: number }> {
  return new Promise(resolve => {
    map.once('render', () => {
      const canvas = map.getCanvas();
      resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.9), ancho: canvas.width, alto: canvas.height });
    });
    map.triggerRepaint();
  });
}

/** Carga una imagen y la devuelve como PNG en base64 (null si falla) */
async function cargarImagen(url: string): Promise<{ dataUrl: string; ancho: number; alto: number } | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d')!.drawImage(img, 0, 0);
    return { dataUrl: canvas.toDataURL('image/png'), ancho: canvas.width, alto: canvas.height };
  } catch {
    return null;
  }
}
