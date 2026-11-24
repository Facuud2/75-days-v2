'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  INITIAL_VOICE_NOISE_FLOOR,
  VOICE_VISUAL_BAND_COUNT,
  analyseVoiceFrame,
  getVoiceVadThresholds,
  updateVoiceNoiseFloor,
  type VoiceActivity,
} from '@/lib/audio/voiceAnalysis';

export type VoiceRecorderStatus =
  | 'idle'
  | 'requesting-permission'
  | 'recording'
  | 'paused'
  | 'stopping'
  | 'transcribing'
  | 'processing'
  | 'permission-denied'
  | 'unsupported'
  | 'error';

export interface VoiceAudioMetrics {
  /** Raw root mean square of the time-domain waveform, normalized to 0..1. */
  rms: number;
  /** Noise-gated display level, normalized to 0..1. */
  level: number;
  low: number;
  mid: number;
  high: number;
  voiceActivity: VoiceActivity;
  /** Compatibility alias for existing consumers. */
  isSpeaking: boolean;
  /** 16 normalized, log-spaced frequency bands. */
  bands: readonly number[];
}

export type VoiceRecordingResult =
  | { kind: 'success'; blob: Blob; mimeType: string }
  | { kind: 'cancelled' | 'empty' | 'error' };

type MetricsListener = (metrics: VoiceAudioMetrics) => void;

type PendingStopOperation = {
  operationId: number;
  recorder: MediaRecorder;
  stream: MediaStream | null;
  promise: Promise<VoiceRecordingResult>;
  resolve: (result: VoiceRecordingResult) => void;
  timeoutId: ReturnType<typeof setTimeout> | null;
  settled: boolean;
  recorderErrored: boolean;
};

const ANALYSER_FFT_SIZE = 128;
const SPEECH_HOLD_MS = 280;
const RECORDER_STOP_TIMEOUT_MS = 2_000;
const SILENT_BANDS: readonly number[] = Array.from(
  { length: VOICE_VISUAL_BAND_COUNT },
  () => 0
);
const SILENT_METRICS: VoiceAudioMetrics = {
  rms: 0,
  level: 0,
  low: 0,
  mid: 0,
  high: 0,
  voiceActivity: 'silence',
  isSpeaking: false,
  bands: SILENT_BANDS,
};

function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder.isTypeSupported !== 'function' || MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return '';
}

function recorderErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'No pudimos acceder al micrófono. Habilitá el permiso del navegador o escribí tu mensaje.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'No encontramos un micrófono disponible en este dispositivo.';
  }
  return 'No pudimos iniciar la grabación. Podés seguir escribiendo tu mensaje.';
}

export function useVoiceRecorder() {
  const [status, setStatus] = useState<VoiceRecorderStatus>('idle');
  const [voiceActivity, setVoiceActivity] = useState<VoiceActivity>('silence');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastSpeechAtRef = useRef(0);
  const voiceActivityRef = useRef<VoiceActivity>('silence');
  const noiseFloorRef = useRef(INITIAL_VOICE_NOISE_FLOOR);
  const operationIdRef = useRef(0);
  const pendingStopRef = useRef<PendingStopOperation | null>(null);
  const statusRef = useRef<VoiceRecorderStatus>('idle');
  const mountedRef = useRef(true);
  const listenersRef = useRef(new Set<MetricsListener>());
  const lastMetricsRef = useRef<VoiceAudioMetrics>(SILENT_METRICS);

  const updateStatus = useCallback((next: VoiceRecorderStatus) => {
    statusRef.current = next;
    if (mountedRef.current) setStatus(next);
  }, []);

  const updateVoiceActivity = useCallback((next: VoiceActivity) => {
    if (voiceActivityRef.current === next) return;
    voiceActivityRef.current = next;
    if (mountedRef.current) setVoiceActivity(next);
  }, []);

  const notifyListeners = useCallback((metrics: VoiceAudioMetrics) => {
    lastMetricsRef.current = metrics;
    listenersRef.current.forEach((listener) => {
      try {
        listener(metrics);
      } catch {
        // A visual subscriber must never break recorder cleanup or other subscribers.
      }
    });
  }, []);

  const subscribeAudioMetrics = useCallback((listener: MetricsListener) => {
    listenersRef.current.add(listener);
    try {
      listener(lastMetricsRef.current);
    } catch {
      // Match notification isolation for the immediate snapshot.
    }
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopAnalysis = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    try {
      sourceRef.current?.disconnect();
    } catch {
      // Already disconnected.
    }
    try {
      analyserRef.current?.disconnect();
    } catch {
      // Already disconnected.
    }
    sourceRef.current = null;
    analyserRef.current = null;

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== 'closed') {
      void audioContext.close().catch(() => undefined);
    }

    noiseFloorRef.current = INITIAL_VOICE_NOISE_FLOOR;
    updateVoiceActivity('silence');
    notifyListeners(SILENT_METRICS);
  }, [notifyListeners, updateVoiceActivity]);

  const stopStream = useCallback((stream = streamRef.current) => {
    stream?.getTracks().forEach((track) => track.stop());
    if (streamRef.current === stream) streamRef.current = null;
  }, []);

  const cleanupMedia = useCallback(
    (stream = streamRef.current) => {
      clearTimer();
      stopAnalysis();
      stopStream(stream);
    },
    [clearTimer, stopAnalysis, stopStream]
  );

  const finalizePendingStop = useCallback(
    (
      operation: PendingStopOperation,
      result: VoiceRecordingResult,
      options?: { preserveStatus?: boolean }
    ) => {
      if (operation.settled) return;
      operation.settled = true;
      if (operation.timeoutId !== null) {
        clearTimeout(operation.timeoutId);
        operation.timeoutId = null;
      }
      operation.recorder.ondataavailable = null;
      operation.recorder.onstop = null;
      operation.recorder.onerror = null;
      if (pendingStopRef.current === operation) pendingStopRef.current = null;
      if (recorderRef.current === operation.recorder) recorderRef.current = null;
      cleanupMedia(operation.stream);
      operation.resolve(result);
      if (!options?.preserveStatus && statusRef.current === 'stopping') {
        updateStatus('idle');
      }
    },
    [cleanupMedia, updateStatus]
  );

  const cancelRecording = useCallback(() => {
    operationIdRef.current += 1;
    chunksRef.current = [];

    const pendingStop = pendingStopRef.current;
    const activeRecorder = recorderRef.current;
    const recorder = activeRecorder ?? pendingStop?.recorder ?? null;
    const ownedStream = pendingStop?.stream ?? streamRef.current;
    recorderRef.current = null;

    if (activeRecorder) {
      activeRecorder.ondataavailable = null;
      activeRecorder.onstop = null;
      activeRecorder.onerror = null;
    }

    if (pendingStop) {
      finalizePendingStop(pendingStop, { kind: 'cancelled' }, { preserveStatus: true });
    } else {
      cleanupMedia(ownedStream);
    }

    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop();
      } catch {
        // Recorder may already be stopping or the device may have disappeared.
      }
    }

    if (mountedRef.current) {
      setElapsedSeconds(0);
      setErrorMessage(null);
    }
    updateStatus('idle');
  }, [cleanupMedia, finalizePendingStop, updateStatus]);

  useEffect(() => {
    mountedRef.current = true;
    const listeners = listenersRef.current;
    return () => {
      mountedRef.current = false;
      cancelRecording();
      listeners.clear();
    };
  }, [cancelRecording]);

  const startRecording = useCallback(async () => {
    if (
      statusRef.current === 'requesting-permission' ||
      statusRef.current === 'recording' ||
      statusRef.current === 'paused' ||
      statusRef.current === 'stopping' ||
      statusRef.current === 'transcribing' ||
      statusRef.current === 'processing'
    ) {
      return;
    }

    if (pendingStopRef.current) return;

    const operationId = ++operationIdRef.current;
    setErrorMessage(null);

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      setErrorMessage('Este navegador no permite grabar audio. Podés escribir tu mensaje.');
      updateStatus('unsupported');
      return;
    }

    updateStatus('requesting-permission');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (operationId !== operationIdRef.current || !mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      chunksRef.current = [];
      setElapsedSeconds(0);
      noiseFloorRef.current = INITIAL_VOICE_NOISE_FLOOR;
      lastSpeechAtRef.current = 0;
      updateVoiceActivity('silence');

      const mimeType = pickSupportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (operationId === operationIdRef.current && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      const AudioContextCtor = window.AudioContext;
      if (AudioContextCtor) {
        const audioContext = new AudioContextCtor();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = ANALYSER_FFT_SIZE;
        analyser.smoothingTimeConstant = 0.76;
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        sourceRef.current = source;

        const timeDomainData = new Uint8Array(analyser.fftSize);
        const frequencyData = new Uint8Array(analyser.frequencyBinCount);

        const analyse = () => {
          if (operationId !== operationIdRef.current) return;
          if (statusRef.current === 'paused') {
            updateVoiceActivity('silence');
            notifyListeners(SILENT_METRICS);
            animationFrameRef.current = requestAnimationFrame(analyse);
            return;
          }

          if (statusRef.current !== 'recording') return;

          analyser.getByteTimeDomainData(timeDomainData);
          analyser.getByteFrequencyData(frequencyData);

          const frame = analyseVoiceFrame(
            timeDomainData,
            frequencyData,
            audioContext.sampleRate,
            analyser.fftSize,
            noiseFloorRef.current
          );
          const now = performance.now();
          const thresholds = getVoiceVadThresholds(noiseFloorRef.current);
          const wasSpeaking = voiceActivityRef.current === 'speaking';
          const hasVoiceSpectrum = frame.mid >= 0.018 || frame.low >= 0.035;
          const shouldActivate = frame.rms >= thresholds.activate && hasVoiceSpectrum;

          let nextActivity: VoiceActivity = 'silence';
          if (shouldActivate) {
            lastSpeechAtRef.current = now;
            nextActivity = 'speaking';
          } else if (
            wasSpeaking &&
            frame.rms >= thresholds.release &&
            now - lastSpeechAtRef.current < SPEECH_HOLD_MS
          ) {
            nextActivity = 'speaking';
          }

          if (nextActivity === 'silence') {
            noiseFloorRef.current = updateVoiceNoiseFloor(noiseFloorRef.current, frame.rms);
          }

          updateVoiceActivity(nextActivity);
          notifyListeners({
            ...frame,
            voiceActivity: nextActivity,
            isSpeaking: nextActivity === 'speaking',
          });
          animationFrameRef.current = requestAnimationFrame(analyse);
        };

        animationFrameRef.current = requestAnimationFrame(analyse);
      }

      recorder.start(150);
      updateStatus('recording');
      timerRef.current = setInterval(() => {
        if (operationId === operationIdRef.current && statusRef.current === 'recording') {
          setElapsedSeconds((seconds) => seconds + 1);
        }
      }, 1000);
    } catch (error) {
      if (operationId !== operationIdRef.current || !mountedRef.current) return;
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        recorder.onerror = null;
        if (recorder.state !== 'inactive') {
          try {
            recorder.stop();
          } catch {
            // Setup already failed; media cleanup below is authoritative.
          }
        }
      }
      cleanupMedia();
      const name = error instanceof DOMException ? error.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        updateStatus('permission-denied');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        updateStatus('unsupported');
      } else {
        updateStatus('error');
      }
      setErrorMessage(recorderErrorMessage(error));
    }
  }, [cleanupMedia, notifyListeners, updateStatus, updateVoiceActivity]);

  const pauseRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    try {
      recorder.pause();
      updateStatus('paused');
      updateVoiceActivity('silence');
      notifyListeners(SILENT_METRICS);
    } catch {
      setErrorMessage('No pudimos pausar la grabación. Podés detenerla o cancelarla.');
    }
  }, [notifyListeners, updateStatus, updateVoiceActivity]);

  const resumeRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    const operationId = operationIdRef.current;
    const audioContext = audioContextRef.current;
    if (!recorder || recorder.state !== 'paused') return;
    try {
      if (audioContext?.state === 'suspended') {
        await audioContext.resume();
      }
      if (
        operationId !== operationIdRef.current ||
        recorderRef.current !== recorder ||
        recorder.state !== 'paused'
      ) {
        return;
      }
      recorder.resume();
      updateStatus('recording');
    } catch {
      if (operationId === operationIdRef.current && recorderRef.current === recorder) {
        setErrorMessage('No pudimos reanudar la grabación. Podés detenerla o cancelarla.');
      }
    }
  }, [updateStatus]);

  const stopRecording = useCallback((): Promise<VoiceRecordingResult> => {
    if (pendingStopRef.current) {
      return Promise.resolve({ kind: 'cancelled' });
    }

    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      recorderRef.current = null;
      chunksRef.current = [];
      cleanupMedia();
      updateStatus('idle');
      return Promise.resolve({ kind: 'empty' });
    }

    const operationId = operationIdRef.current;
    const ownedStream = streamRef.current;
    const mimeType = recorder.mimeType || 'audio/webm';
    let resolveStop!: (result: VoiceRecordingResult) => void;
    const promise = new Promise<VoiceRecordingResult>((resolve) => {
      resolveStop = resolve;
    });
    const operation: PendingStopOperation = {
      operationId,
      recorder,
      stream: ownedStream,
      promise,
      resolve: resolveStop,
      timeoutId: null,
      settled: false,
      recorderErrored: false,
    };

    // Store the complete operation before recorder.stop(): test doubles and some
    // platform implementations may dispatch data/stop synchronously.
    pendingStopRef.current = operation;
    updateStatus('stopping');
    clearTimer();
    updateVoiceActivity('silence');
    notifyListeners(SILENT_METRICS);

    recorder.ondataavailable = (event) => {
      if (
        !operation.settled &&
        operation.operationId === operationIdRef.current &&
        event.data.size > 0
      ) {
        chunksRef.current.push(event.data);
      }
    };
    recorder.onerror = () => {
      if (operation.settled) return;
      if (operation.operationId !== operationIdRef.current) {
        chunksRef.current = [];
        finalizePendingStop(operation, { kind: 'cancelled' });
        return;
      }
      operation.recorderErrored = true;
      setErrorMessage('No pudimos cerrar la grabación correctamente. Intentá de nuevo.');
      // Wait for the final stop event so the browser can finish its event ordering.
      // The bounded timeout below handles implementations that never emit it.
    };
    recorder.onstop = () => {
      if (operation.settled) return;
      if (operation.operationId !== operationIdRef.current) {
        chunksRef.current = [];
        finalizePendingStop(operation, { kind: 'cancelled' });
        return;
      }
      if (operation.recorderErrored) {
        chunksRef.current = [];
        updateStatus('error');
        finalizePendingStop(operation, { kind: 'error' }, { preserveStatus: true });
        return;
      }
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = [];
      finalizePendingStop(
        operation,
        blob.size > 0 ? { kind: 'success', blob, mimeType } : { kind: 'empty' }
      );
    };
    operation.timeoutId = setTimeout(() => {
      if (operation.settled) return;
      if (operation.operationId === operationIdRef.current) {
        operationIdRef.current += 1;
      }
      chunksRef.current = [];
      setErrorMessage('La grabación tardó demasiado en cerrarse. Intentá de nuevo.');
      updateStatus('error');
      finalizePendingStop(operation, { kind: 'error' }, { preserveStatus: true });
      if (recorder.state !== 'inactive') {
        try {
          recorder.stop();
        } catch {
          // Handlers are detached and media ownership was already released.
        }
      }
    }, RECORDER_STOP_TIMEOUT_MS);

    try {
      recorder.stop();
    } catch {
      setErrorMessage('No pudimos detener la grabación. Intentá de nuevo.');
      updateStatus('error');
      finalizePendingStop(operation, { kind: 'error' }, { preserveStatus: true });
    }

    return promise;
  }, [
    clearTimer,
    cleanupMedia,
    finalizePendingStop,
    notifyListeners,
    updateStatus,
    updateVoiceActivity,
  ]);

  const setTranscribing = useCallback(
    (active: boolean) => {
      if (active) {
        updateStatus('transcribing');
      } else if (statusRef.current === 'transcribing') {
        updateStatus('idle');
      }
    },
    [updateStatus]
  );

  const setProcessing = useCallback(
    (active: boolean) => {
      if (active) {
        updateStatus('processing');
      } else if (statusRef.current === 'processing') {
        updateStatus('idle');
      }
    },
    [updateStatus]
  );

  const resetStatus = useCallback(() => {
    if (
      statusRef.current === 'requesting-permission' ||
      statusRef.current === 'recording' ||
      statusRef.current === 'paused' ||
      statusRef.current === 'stopping'
    ) {
      cancelRecording();
      return;
    }
    setErrorMessage(null);
    setElapsedSeconds(0);
    updateVoiceActivity('silence');
    notifyListeners(SILENT_METRICS);
    updateStatus('idle');
  }, [cancelRecording, notifyListeners, updateStatus, updateVoiceActivity]);

  return {
    status,
    voiceActivity,
    isSpeaking: voiceActivity === 'speaking',
    elapsedSeconds,
    errorMessage,
    subscribeAudioMetrics,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    cancelRecording,
    setTranscribing,
    setProcessing,
    resetStatus,
  };
}
