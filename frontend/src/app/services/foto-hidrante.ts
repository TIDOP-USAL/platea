import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { environment } from '../environments/environment';

export const PREFIJO_FOTOS = 'PLATEA-GIS/foto_hidrantes/';
const RUTA_LOCAL = 'PLATEA-GIS/foto_hidrantes';   // dentro de Directory.Data

// ── Estado de las fotos descargadas en el dispositivo (solo nativo) ─────────
let fotosLocales = new Set<string>();
let baseFotosLocales = '';

/** Nombre de archivo si `pathPhoto` apunta a la carpeta de fotos de hidrantes. */
export function nombreFotoHidrante(pathPhoto: unknown): string | null {
  if (typeof pathPhoto !== 'string' || !pathPhoto.startsWith(PREFIJO_FOTOS)) return null;
  const nombre = pathPhoto.slice(PREFIJO_FOTOS.length);
  return nombre && !nombre.includes('/') && !nombre.includes('..') ? nombre : null;
}

export function fotoLocalExiste(nombre: string): boolean {
  return fotosLocales.has(nombre);
}

/** Lee qué fotos hay ya en el dispositivo. Llamar al iniciar y tras descargar. */
export async function cargarFotosLocales(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { uri } = await Filesystem.getUri({ path: RUTA_LOCAL, directory: Directory.Data });
    baseFotosLocales = Capacitor.convertFileSrc(uri);
    const { files } = await Filesystem.readdir({ path: RUTA_LOCAL, directory: Directory.Data });
    fotosLocales = new Set(files.map((f: any) => (typeof f === 'string' ? f : f.name)));
  } catch {
    fotosLocales = new Set();   // la carpeta aún no existe
  }
}

/** Guarda una foto en el dispositivo (base64 sin cabecera). */
export async function guardarFotoLocal(nombre: string, base64: string): Promise<void> {
  await Filesystem.writeFile({
    path: `${RUTA_LOCAL}/${nombre}`,
    data: base64,
    directory: Directory.Data,
    recursive: true,
  });
}

/**
 * URL de la foto de un hidrante a partir de su propiedad `path_photo`
 * (p. ej. "PLATEA-GIS/foto_hidrantes/010_001.jpeg").
 *
 * - Web: se sirve desde el backend, en /uploads/capas/<path_photo>.
 * - App nativa: si la foto se descargó en la actualización, se usa la copia
 *   local (offline); si no, la ruta de assets (por si aún está empaquetada).
 * - Si ya es una URL absoluta, se devuelve tal cual.
 */
export function urlFotoHidrante(pathPhoto: string): string {
  if (/^(https?:)?\/\//.test(pathPhoto)) return pathPhoto;

  if (Capacitor.isNativePlatform()) {
    const nombre = nombreFotoHidrante(pathPhoto);
    if (nombre && baseFotosLocales && fotosLocales.has(nombre)) {
      return `${baseFotosLocales}/${nombre}`;
    }
    return pathPhoto.replace(PREFIJO_FOTOS, '/assets/foto_hidrantes/');
  }

  // Origen del backend a partir de apiUrl (p. ej. https://platea.tidop.es/api -> https://platea.tidop.es)
  const origen = new URL(environment.apiUrl, window.location.origin).origin;
  return `${origen}/uploads/capas/${pathPhoto}`;
}