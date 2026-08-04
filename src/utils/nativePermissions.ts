import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { Camera } from '@capacitor/camera';

export interface NativePermissionStatus {
  isNative: boolean;
  location: boolean;
  camera: boolean;
  storage: boolean;
  network: boolean;
}

/**
 * Solicita ativamente todas as permissões necessárias do APK Android / iOS:
 * - Localização (GPS)
 * - Câmera (Fotos/Reconhecimento Facial)
 * - Armazenamento
 * - Rede / Conectividade
 */
export async function requestAllNativePermissions(): Promise<NativePermissionStatus> {
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

  const status: NativePermissionStatus = {
    isNative,
    location: false,
    camera: false,
    storage: true, // Padrão liberado em Web, checado no APK
    network: typeof navigator !== 'undefined' ? navigator.onLine : true,
  };

  if (!isNative) {
    // Web fallback checks
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      status.location = true;
    }
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      status.camera = true;
    }
    return status;
  }

  // 1. Solicita Permissão de Localização
  try {
    const geoStatus = await Geolocation.requestPermissions();
    status.location = geoStatus.location === 'granted';
  } catch (err) {
    console.warn('[NativePermissions] Erro ao solicitar permissão de localização:', err);
  }

  // 2. Solicita Permissão de Câmera
  try {
    const camStatus = await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
    status.camera = camStatus.camera === 'granted';
    status.storage = camStatus.photos === 'granted' || camStatus.photos === 'limited';
  } catch (err) {
    console.warn('[NativePermissions] Erro ao solicitar permissão de câmera/armazenamento:', err);
  }

  return status;
}
