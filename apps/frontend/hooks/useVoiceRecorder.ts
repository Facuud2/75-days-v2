'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type VoiceRecorderStatus =
  | 'idle'
  | 'recording'
  | 'paused'
  | 'transcribing'
  | 'processing'
  | 'permission-denied'
  | 'unsupported'
  | 'error';

export interface VoiceAudioMetrics {
  level: number; // 0..1 normalized vocal RMS/energy
  isSpeaking: boolean;
  bands: readonly number[]; // 16 normalized frequency bands (0..1)
}

type MetricsListener = (metrics: VoiceAudioMetrics) => void;

const BAR_COUNT = 16;
const SPEECH_ACTIVATE_THRESHOLD = 14; // 0..255 byte frequency average over vocal bins
const SPEECH_HOLD_MS = 280; // hysteresis hold so natural inter-syllable gaps don't flicker

const SILENT_BANDS: readonly number[] = Array.from({ length: BAR_COUNT }, () => 0);

function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

export function useVoiceRecorder() {
  const [status, setStatus] = useState<VoiceRecorderStatus>('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mimeTypeRef = useRef<string>('audio/webm');
  const cancelledRef = useRef<boolean>(false);

  const lastSpeechAtRef = useRef<number>(0);
  const speakingStateRef = useRef<boolean>(false);
  const statusRef = useRef<VoiceRecorderStatus>('idle');
  const listenersRef = useRef<Set<MetricsListener>>(new Set());
  const bandsBufferRef = useRef<number[]>(Array.from({ length: BAR_COUNT }, () => 0));
  const latestLevelRef = useRef<number>(0);

  const updateStatus = useCallback((next: VoiceRecorderStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const notifyListeners = useCallback((metrics: VoiceAudioMetrics) => {
    listenersRef.current.forEach((listener) => {
      try {
        listener(metrics);
      } catch {
        // ignore listener errors
      }
    });
  }, []);

  const subscribeAudioMetrics = useCallback((listener: MetricsListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    timerRef.current = setInterval(() => {
      if (statusRef.current === 'recording') {
        setElapsedSeconds((prev) => prev + 1);
      }
    }, 1000);
  }, [stopTimer]);

  const cleanupAudioGraph = useCallback(() => {
    stopTimer();
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {
        // ignore
      }
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch {
        // ignore
      }
      analyserRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    speakingStateRef.current = false;
    latestLevelRef.current = 0;
    setIsSpeaking(false);
    notifyListeners({ level: 0, isSpeaking: false, bands: SILENT_BANDS });
  }, [notifyListeners, stopTimer]);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      cleanupAudioGraph();
    };
  }, [cleanupAudioGraph]);

  const startRecording = useCallback(async () => {
    setErrorMessage(null);
    cancelledRef.current = false;

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      updateStatus('unsupported');
      setErrorMessage('Tu navegador no soporta grabación de audio.');
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const mimeType = pickSupportedMimeType();
      mimeTypeRef.current = mimeType || 'audio/webm';
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (!cancelledRef.current && event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Low-overhead Web Audio AnalyserNode loop (fftSize = 64 -> 32 bins, zero per-tick allocations)
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (AudioCtx) {
        const ctx = new AudioCtx();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.78;
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);

        audioContextRef.current = ctx;
        analyserRef.current = analyser;
        sourceRef.current = source;

        const binCount = analyser.frequencyBinCount; // 32
        const dataArray = new Uint8Array(binCount);
        const bands = bandsBufferRef.current;

        const tick = () => {
          if (!analyserRef.current) return;

          if (statusRef.current === 'paused') {
            if (speakingStateRef.current) {
              speakingStateRef.current = false;
              setIsSpeaking(false);
            }
            latestLevelRef.current = 0;
            notifyListeners({ level: 0, isSpeaking: false, bands: SILENT_BANDS });
            rafRef.current = requestAnimationFrame(tick);
            return;
          }

          analyserRef.current.getByteFrequencyData(dataArray);

          // Focus VAD on core human speech bins (bins 1..18)
          const vocalEnd = Math.min(binCount, 19);
          let vocalSum = 0;
          for (let i = 1; i < vocalEnd; i++) {
            vocalSum += dataArray[i];
          }
          const vocalAvg = vocalSum / Math.max(1, vocalEnd - 1); // 0..255
          const normalized = Math.min(1, Math.max(0, (vocalAvg - 8) / 96));
          latestLevelRef.current = normalized;

          const now = performance.now();
          if (vocalAvg >= SPEECH_ACTIVATE_THRESHOLD) {
            lastSpeechAtRef.current = now;
          }
          const activeSpeech = now - lastSpeechAtRef.current <= SPEECH_HOLD_MS && vocalAvg >= 6;

          if (activeSpeech !== speakingStateRef.current) {
            speakingStateRef.current = activeSpeech;
            setIsSpeaking(activeSpeech);
          }

          // Compute 16 symmetric-ready frequency bands without allocations
          for (let b = 0; b < BAR_COUNT; b++) {
            const binIdx = 1 + Math.floor((b / BAR_COUNT) * Math.min(20, binCount - 1));
            const raw = dataArray[binIdx] ?? 0;
            bands[b] = activeSpeech ? Math.min(1, Math.max(0.08, (raw - 6) / 145)) : Math.min(0.14, raw / 400);
          }

          notifyListeners({
            level: normalized,
            isSpeaking: activeSpeech,
            bands,
          });

          rafRef.current = requestAnimationFrame(tick);
        };

        lastSpeechAtRef.current = 0;
        rafRef.current = requestAnimationFrame(tick);
      }

      mediaRecorderRef.current = recorder;
      setElapsedSeconds(0);
      recorder.start(150);
      updateStatus('recording');
      startTimer();
      return true;
    } catch (err: any) {
      cleanupAudioGraph();
      const name = err?.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        updateStatus('permission-denied');
        setErrorMessage('Permiso de micrófono denegado.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        updateStatus('unsupported');
        setErrorMessage('No encontramos un micrófono conectado.');
      } else {
        updateStatus('error');
        setErrorMessage('No pudimos iniciar el micrófono.');
      }
      return false;
    }
  }, [cleanupAudioGraph, notifyListeners, startTimer, updateStatus]);

  const pauseRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    try {
      recorder.pause();
      speakingStateRef.current = false;
      setIsSpeaking(false);
      updateStatus('paused');
    } catch {
      // ignore if unsupported by browser
    }
  }, [updateStatus]);

  const resumeRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'paused') return;
    try {
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume().catch(() => {});
      }
      recorder.resume();
      updateStatus('recording');
    } catch {
      // ignore
    }
  }, [updateStatus]);

  const stopRecording = useCallback((): Promise<{ blob: Blob; mimeType: string } | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        cleanupAudioGraph();
        resolve(null);
        return;
      }

      cancelledRef.current = false;
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || mimeTypeRef.current || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        mediaRecorderRef.current = null;
        cleanupAudioGraph();
        resolve({ blob, mimeType });
      };

      try {
        recorder.stop();
      } catch {
        cleanupAudioGraph();
        resolve(null);
      }
    });
  }, [cleanupAudioGraph]);

  const cancelRecording = useCallback(() => {
    cancelledRef.current = true;
    const recorder = mediaRecorderRef.current;
    chunksRef.current = [];
    mediaRecorderRef.current = null;

    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        // ignore
      }
    }

    cleanupAudioGraph();
    setElapsedSeconds(0);
    updateStatus('idle');
  }, [cleanupAudioGraph, updateStatus]);

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
    setErrorMessage(null);
    setElapsedSeconds(0);
    setIsSpeaking(false);
    updateStatus('idle');
  }, [updateStatus]);

  return {
    status,
    isSpeaking,
    elapsedSeconds,
    audioLevel: latestLevelRef.current,
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
