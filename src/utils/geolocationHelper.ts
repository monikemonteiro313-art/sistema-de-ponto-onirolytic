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

/**
 * Captura a posição atual do dispositivo usando Capacitor Geolocation no APK/Native
 * ou fallback transparente para navigator.geolocation na Web.
 */
export async function getBestCurrentPosition(
  options: PositionOptions = { enableHighAccuracy: true, timeout: 12000, maximumAge: 3000 }
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
        enableHighAccuracy: options.enableHighAccuracy ?? true,
        timeout: options.timeout ?? 12000,
        maximumAge: options.maximumAge ?? 3000,
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

  // Fallback padrão navigator.geolocation
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new Error('Geolocalização não suportada neste dispositivo/navegador.');
  }

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
      options
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
