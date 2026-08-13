import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}

export interface LocationPosition {
  coords: LocationCoordinates;
  timestamp: number;
}

// Detecta iOS
export const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

export async function getLocationWithIOSFallback(): Promise<GeolocationPosition | LocationPosition | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    // No iOS, getCurrentPosition é mais confiável que watchPosition
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos as GeolocationPosition),
      (err) => {
        console.warn("iOS GPS falhou:", err.code, err.message);
        
        if (err.code === 1) {
          alert("🍎 iPhone bloqueou a localização.\n\nComo liberar:\n1. Configurações > Safari > Localização > PERMITIR\n2. Ou: Configurações > Privacidade > Localização > Safari > PERMITIR SEMPRE\n3. Verifique se 'Precisão Exata' está ligada");
        } else if (err.code === 2) {
          alert("🍎 GPS indisponível no iPhone.\nDesative o Modo Economia de Bateria (ícone amarelo) e tente novamente.");
        }
        
        resolve(null);
      },
      {
        enableHighAccuracy: !isIOS, // iOS trava com highAccuracy=true em alguns casos
        timeout: isIOS ? 20000 : 10000, // iOS precisa de mais tempo
        maximumAge: isIOS ? 60000 : 0   // iOS aceita cache de 1min melhor que GPS frio
      }
    );
  });
}

/**
 * Captura a posição atual do dispositivo usando Capacitor Geolocation no APK/Native
 * ou fallback transparente para navigator.geolocation na Web.
 */
export async function getBestCurrentPosition(
  options: PositionOptions = { enableHighAccuracy: !isIOS, timeout: isIOS ? 20000 : 12000, maximumAge: isIOS ? 60000 : 3000 }
): Promise<LocationPosition> {
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

  if (isNative) {
    try {
      // Solicita permissão explicitamente se necessário
      const permResult = await Geolocation.requestPermissions();
      if (permResult.location === 'denied') {
        throw new Error('Permissão de geolocalização negada no dispositivo.');
      }

      const capPos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: options.enableHighAccuracy ?? !isIOS,
        timeout: options.timeout ?? (isIOS ? 20000 : 12000),
        maximumAge: options.maximumAge ?? (isIOS ? 60000 : 3000),
      });

      return {
        coords: {
          latitude: capPos.coords.latitude,
          longitude: capPos.coords.longitude,
          accuracy: capPos.coords.accuracy,
          altitude: capPos.coords.altitude,
          altitudeAccuracy: capPos.coords.altitudeAccuracy,
          heading: capPos.coords.heading,
          speed: capPos.coords.speed,
        },
        timestamp: capPos.timestamp,
      };
    } catch (err) {
      console.warn('[Geolocation] Capacitor Geolocation falhou/fallback para navigator:', err);
    }
  }

  if (isIOS) {
    const iosPos = await getLocationWithIOSFallback();
    if (iosPos) {
      return {
        coords: {
          latitude: iosPos.coords.latitude,
          longitude: iosPos.coords.longitude,
          accuracy: iosPos.coords.accuracy,
          altitude: iosPos.coords.altitude,
          altitudeAccuracy: iosPos.coords.altitudeAccuracy,
          heading: iosPos.coords.heading,
          speed: iosPos.coords.speed,
        },
        timestamp: iosPos.timestamp,
      };
    }
  }

  // Fallback padrão navigator.geolocation
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('Geolocalização não suportada neste dispositivo/navegador.');
  }

  const defaultOptions: PositionOptions = {
    enableHighAccuracy: options.enableHighAccuracy ?? !isIOS,
    timeout: options.timeout ?? (isIOS ? 20000 : 10000),
    maximumAge: options.maximumAge ?? (isIOS ? 60000 : 0)
  };

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          coords: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude,
            altitudeAccuracy: pos.coords.altitudeAccuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
          },
          timestamp: pos.timestamp,
        });
      },
      (err) => reject(err),
      defaultOptions
    );
  });
}

/**
 * Inicia a observação da posição em tempo real com suporte nativo Capacitor e Web fallback.
 * Retorna uma função de cancelamento (stopWatch).
 */
export async function watchBestPosition(
  onSuccess: (pos: LocationPosition) => void,
  onError: (err: any) => void,
  options: PositionOptions = { enableHighAccuracy: true, timeout: 12000, maximumAge: 3000 }
): Promise<() => void> {
  const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

  if (isNative) {
    try {
      await Geolocation.requestPermissions();
      const callbackId = await Geolocation.watchPosition(
        {
          enableHighAccuracy: options.enableHighAccuracy ?? true,
          timeout: options.timeout ?? 12000,
          maximumAge: options.maximumAge ?? 3000,
        },
        (position, err) => {
          if (err) {
            onError(err);
            return;
          }
          if (position) {
            onSuccess({
              coords: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                altitude: position.coords.altitude,
                altitudeAccuracy: position.coords.altitudeAccuracy,
                heading: position.coords.heading,
                speed: position.coords.speed,
              },
              timestamp: position.timestamp,
            });
          }
        }
      );

      return () => {
        Geolocation.clearWatch({ id: callbackId }).catch(() => {});
      };
    } catch (err) {
      console.warn('[Geolocation] Watch native error, fallback web:', err);
    }
  }

  // Fallback Web
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onError(new Error('Geolocalização não suportada.'));
    return () => {};
  }

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      onSuccess({
        coords: {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          altitudeAccuracy: pos.coords.altitudeAccuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        },
        timestamp: pos.timestamp,
      });
    },
    onError,
    options
  );

  return () => {
    navigator.geolocation.clearWatch(watchId);
  };
}
