import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';

export interface SelfieResult {
  base64: string;        // data:image/jpeg;base64,...
  width: number;
  height: number;
  fonte: 'capacitor-camera' | 'web-getusermedia';
}

/**
 * Helper universal: funciona no navegador (PWA) e no APK nativo (Capacitor)
 * SEMPRE abre a câmera frontal (selfie)
 */
export async function tirarSelfie(): Promise<SelfieResult | null> {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    return await tirarSelfieNativo();
  } else {
    return await tirarSelfieWeb();
  }
}

/* ============================================================
   1. N A T I V O  (APK / iOS via Capacitor)
   ============================================================ */
async function tirarSelfieNativo(): Promise<SelfieResult | null> {
  try {
    // 1. Checa permissão
    const perm = await Camera.checkPermissions();
    if (perm.camera !== 'granted') {
      const req = await Camera.requestPermissions();
      if (req.camera !== 'granted') {
        alert(
          '📱 Permissão de câmera negada.\n\n' +
          'Como liberar:\n' +
          'Android: Configurações > Apps > SeuApp > Permissões > Câmera > Permitir\n' +
          'iPhone: Configurações > Privacidade > Câmera > SeuApp'
        );
        return null;
      }
    }

    // 2. Abre câmera FRONTAL nativa
    const photo = await Camera.getPhoto({
      quality: 85,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,   // ← FORÇA câmera real, não galeria
      direction: CameraDirection.Front, // ← FRONTAL (selfie)
      width: 1024,
      height: 1024,
    });

    if (!photo?.base64String) {
      console.log('[Selfie] Usuário cancelou');
      return null;
    }

    return {
      base64: `data:image/${photo.format};base64,${photo.base64String}`,
      width: 1024,
      height: 1024,
      fonte: 'capacitor-camera',
    };

  } catch (err: any) {
    console.error('[Selfie Nativo] Erro:', err);
    if (err.message?.includes('cancel')) return null;
    alert('Erro ao abrir câmera: ' + (err.message || err));
    return null;
  }
}

/* ============================================================
   2. W E B  (PWA / Navegador)
   ============================================================ */
async function tirarSelfieWeb(): Promise<SelfieResult | null> {
  // Verifica se o navegador suporta
  if (!navigator.mediaDevices?.getUserMedia) {
    alert('Seu navegador não suporta câmera. Use Chrome ou atualize o app.');
    return null;
  }

  let stream: MediaStream | null = null;
  let videoElement: HTMLVideoElement | null = null;
  let container: HTMLDivElement | null = null;

  return new Promise((resolve) => {
    // Cria interface de preview
    container = document.createElement('div');
    container.style.cssText = `
      position: fixed; inset: 0; z-index: 99999;
      background: #000; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
    `;

    videoElement = document.createElement('video');
    videoElement.style.cssText = `
      width: 100%; max-width: 500px; aspect-ratio: 1;
      object-fit: cover; border-radius: 12px;
      transform: scaleX(-1); /* espelha pra parecer selfie */
    `;
    videoElement.autoplay = true;
    videoElement.playsInline = true; // iOS precisa disso

    // Botão capturar
    const btnCapturar = document.createElement('button');
    btnCapturar.innerText = '📸 Capturar';
    btnCapturar.style.cssText = `
      margin-top: 16px; padding: 14px 32px; font-size: 18px;
      background: #10b981; color: #fff; border: none;
      border-radius: 50px; cursor: pointer; font-weight: 600;
    `;

    // Botão cancelar
    const btnCancelar = document.createElement('button');
    btnCancelar.innerText = '✕ Cancelar';
    btnCancelar.style.cssText = `
      margin-top: 8px; padding: 10px 24px; font-size: 14px;
      background: transparent; color: #fff; border: 1px solid #fff;
      border-radius: 50px; cursor: pointer;
    `;

    container.appendChild(videoElement);
    container.appendChild(btnCapturar);
    container.appendChild(btnCancelar);
    document.body.appendChild(container);

    // Função de limpeza
    const cleanup = () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
      }
      if (container) {
        container.remove();
        container = null;
      }
    };

    // Cancelar
    btnCancelar.onclick = () => {
      cleanup();
      resolve(null);
    };

    // Capturar
    btnCapturar.onclick = () => {
      if (!videoElement) return;
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Mantém espelhado na foto final conforme a prévia
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      cleanup();

      const base64 = canvas.toDataURL('image/jpeg', 0.85);
      resolve({
        base64,
        width: canvas.width,
        height: canvas.height,
        fonte: 'web-getusermedia',
      });
    };

    // Solicita câmera frontal
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1024 }, height: { ideal: 1024 } },
        audio: false,
      })
      .then((s) => {
        stream = s;
        if (videoElement) videoElement.srcObject = stream;
      })
      .catch((err: any) => {
        cleanup();
        console.error('[Selfie Web] Erro:', err);
        if (err.name === 'NotAllowedError') {
          alert(
            '📷 Câmera bloqueada!\n\n' +
            'Como liberar:\n' +
            '1. Toque no ícone 🔒 ou ℹ️ na barra de endereço\n' +
            '2. Permissões > Câmera > Permitir\n' +
            '3. Recarregue o app'
          );
        } else if (err.name === 'NotFoundError') {
          alert('Nenhuma câmera encontrada neste dispositivo.');
        } else {
          alert('Erro na câmera: ' + (err.message || err));
        }
        resolve(null);
      });
  });
}
