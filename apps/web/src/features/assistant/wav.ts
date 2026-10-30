// La transcripción de Meta solo acepta WAV PCM de 16 bits, mono, a 16 o 24 kHz
// (dev.meta.ai/docs/speech-to-text). El navegador graba WebM u Ogg: aquí se
// decodifica, se pasa a 16 kHz mono y se escribe la cabecera WAV.

export const WAV_SAMPLE_RATE = 16_000;

/** Float samples in [-1, 1] -> 16-bit PCM mono WAV bytes (44-byte RIFF header). */
export function encodeWav16(samples: Float32Array, sampleRate: number): Uint8Array<ArrayBuffer> {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buffer);
}

/** Browser glue: recorded clip (any container the browser decodes) -> 16 kHz mono WAV. */
export async function recordingToWav(recording: Blob): Promise<Blob> {
  const decoder = new AudioContext();
  try {
    const decoded = await decoder.decodeAudioData(await recording.arrayBuffer());
    const frames = Math.ceil(decoded.duration * WAV_SAMPLE_RATE);
    const offline = new OfflineAudioContext(1, Math.max(1, frames), WAV_SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const mono = await offline.startRendering();
    return new Blob([encodeWav16(mono.getChannelData(0), WAV_SAMPLE_RATE)], { type: "audio/wav" });
  } finally {
    void decoder.close();
  }
}
