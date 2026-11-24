import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reactHarness = vi.hoisted(() => {
  type DependencyList = readonly unknown[] | undefined;
  type Effect = () => void | (() => void);
  type HookSlot =
    | { type: 'state'; value: unknown }
    | { type: 'ref'; value: { current: unknown } }
    | { type: 'callback'; value: unknown; dependencies: DependencyList }
    | {
        type: 'effect';
        dependencies: DependencyList;
        cleanup?: () => void;
      };
  type PendingEffect = {
    index: number;
    effect: Effect;
    dependencies: DependencyList;
  };
  type HookInstance = {
    slots: HookSlot[];
    pendingEffects: PendingEffect[];
  };

  let activeInstance: HookInstance | null = null;
  let hookIndex = 0;

  const dependenciesMatch = (left: DependencyList, right: DependencyList) =>
    left !== undefined &&
    right !== undefined &&
    left.length === right.length &&
    left.every((value, index) => Object.is(value, right[index]));

  const getActiveInstance = () => {
    if (!activeInstance) throw new Error('Hook called outside the test harness');
    return activeInstance;
  };

  return {
    createInstance(): HookInstance {
      return { slots: [], pendingEffects: [] };
    },
    begin(instance: HookInstance) {
      activeInstance = instance;
      hookIndex = 0;
      instance.pendingEffects = [];
    },
    finish(instance: HookInstance) {
      activeInstance = null;
      for (const pending of instance.pendingEffects) {
        const previous = instance.slots[pending.index];
        if (previous?.type === 'effect') previous.cleanup?.();
        const cleanup = pending.effect();
        instance.slots[pending.index] = {
          type: 'effect',
          dependencies: pending.dependencies,
          cleanup: typeof cleanup === 'function' ? cleanup : undefined,
        };
      }
      instance.pendingEffects = [];
    },
    unmount(instance: HookInstance) {
      for (const slot of instance.slots) {
        if (slot?.type === 'effect') slot.cleanup?.();
      }
      instance.slots = [];
      instance.pendingEffects = [];
    },
    useState<T>(initialValue: T | (() => T)) {
      const instance = getActiveInstance();
      const index = hookIndex++;
      let slot = instance.slots[index];
      if (!slot) {
        slot = {
          type: 'state',
          value:
            typeof initialValue === 'function'
              ? (initialValue as () => T)()
              : initialValue,
        };
        instance.slots[index] = slot;
      }
      if (slot.type !== 'state') throw new Error('Hook order changed');
      const setValue = (nextValue: T | ((previous: T) => T)) => {
        const currentSlot = instance.slots[index];
        if (!currentSlot || currentSlot.type !== 'state') return;
        currentSlot.value =
          typeof nextValue === 'function'
            ? (nextValue as (previous: T) => T)(currentSlot.value as T)
            : nextValue;
      };
      return [slot.value as T, setValue] as const;
    },
    useRef<T>(initialValue: T) {
      const instance = getActiveInstance();
      const index = hookIndex++;
      let slot = instance.slots[index];
      if (!slot) {
        slot = { type: 'ref', value: { current: initialValue } };
        instance.slots[index] = slot;
      }
      if (slot.type !== 'ref') throw new Error('Hook order changed');
      return slot.value as { current: T };
    },
    useCallback<T extends (...args: never[]) => unknown>(
      callback: T,
      dependencies: DependencyList
    ) {
      const instance = getActiveInstance();
      const index = hookIndex++;
      const slot = instance.slots[index];
      if (
        slot?.type === 'callback' &&
        dependenciesMatch(slot.dependencies, dependencies)
      ) {
        return slot.value as T;
      }
      instance.slots[index] = {
        type: 'callback',
        value: callback,
        dependencies,
      };
      return callback;
    },
    useEffect(effect: Effect, dependencies?: DependencyList) {
      const instance = getActiveInstance();
      const index = hookIndex++;
      const slot = instance.slots[index];
      if (
        slot?.type !== 'effect' ||
        !dependenciesMatch(slot.dependencies, dependencies)
      ) {
        instance.pendingEffects.push({ index, effect, dependencies });
      }
    },
  };
});

vi.mock('react', () => ({
  useState: reactHarness.useState,
  useRef: reactHarness.useRef,
  useCallback: reactHarness.useCallback,
  useEffect: reactHarness.useEffect,
}));

import {
  useVoiceRecorder,
  type VoiceRecordingResult,
} from '@/hooks/useVoiceRecorder';

type VoiceRecorderHook = ReturnType<typeof useVoiceRecorder>;
type StopMode = 'manual' | 'synchronous' | 'silent';

let stopMode: StopMode;
let synchronousStopBlob: Blob;

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];
  static isTypeSupported = vi.fn(() => true);

  state: RecordingState = 'inactive';
  mimeType: string;
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  stopCalls = 0;
  pauseCalls = 0;
  resumeCalls = 0;

  constructor(
    public readonly stream: MediaStream,
    options?: MediaRecorderOptions
  ) {
    this.mimeType = options?.mimeType ?? '';
    FakeMediaRecorder.instances.push(this);
  }

  start() {
    this.state = 'recording';
  }

  pause() {
    this.pauseCalls += 1;
    this.state = 'paused';
  }

  resume() {
    this.resumeCalls += 1;
    this.state = 'recording';
  }

  stop() {
    this.stopCalls += 1;
    this.state = 'inactive';
    if (stopMode === 'synchronous') {
      this.ondataavailable?.({ data: synchronousStopBlob } as BlobEvent);
      this.onstop?.();
    }
  }

  emitStop(blob = new Blob(['voice'])) {
    this.state = 'inactive';
    this.ondataavailable?.({ data: blob } as BlobEvent);
    this.onstop?.();
  }
}

function createStream() {
  const stop = vi.fn();
  const stream = {
    getTracks: () => [{ stop }],
  } as unknown as MediaStream;
  return { stream, stop };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function useVoiceRecorderHarness() {
  const instance = reactHarness.createInstance();
  let current: VoiceRecorderHook;

  const useRenderHook = () => {
    reactHarness.begin(instance);
    try {
      current = useVoiceRecorder();
    } finally {
      reactHarness.finish(instance);
    }
  };

  useRenderHook();
  const hook = {
    get current() {
      return current!;
    },
    rerender: useRenderHook,
    unmount: () => reactHarness.unmount(instance),
  };
  mountedHooks.add(hook);
  return hook;
}

const mountedHooks = new Set<{ unmount: () => void }>();
let getUserMedia: ReturnType<typeof vi.fn>;

beforeEach(() => {
  stopMode = 'manual';
  synchronousStopBlob = new Blob(['synchronous voice']);
  FakeMediaRecorder.instances = [];
  FakeMediaRecorder.isTypeSupported.mockClear();
  getUserMedia = vi.fn();

  vi.stubGlobal('MediaRecorder', FakeMediaRecorder as unknown as typeof MediaRecorder);
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  vi.stubGlobal('window', { AudioContext: undefined });
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  for (const hook of mountedHooks) hook.unmount();
  mountedHooks.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useVoiceRecorder concurrency and cancellation', () => {
  it('does not start a recording while transcribing or processing', async () => {
    const hook = useVoiceRecorderHarness();

    hook.current.setTranscribing(true);
    await hook.current.startRecording();
    hook.current.setTranscribing(false);
    hook.current.setProcessing(true);
    await hook.current.startRecording();

    expect(getUserMedia).not.toHaveBeenCalled();
    hook.rerender();
    expect(hook.current.status).toBe('processing');
  });

  it('returns cancelled to a second consumer of a pending stop', async () => {
    const { stream } = createStream();
    getUserMedia.mockResolvedValue(stream);
    const hook = useVoiceRecorderHarness();
    await hook.current.startRecording();
    const recorder = FakeMediaRecorder.instances[0];

    const firstStop = hook.current.stopRecording();
    const duplicateStop = hook.current.stopRecording();

    await expect(duplicateStop).resolves.toEqual({ kind: 'cancelled' });
    expect(recorder.stopCalls).toBe(1);

    const finalBlob = new Blob(['the only successful result']);
    recorder.emitStop(finalBlob);
    const result = await firstStop;

    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.blob.size).toBe(finalBlob.size);
    }
  });

  it('handles a recorder that emits data and stop synchronously', async () => {
    vi.useFakeTimers();
    stopMode = 'synchronous';
    const { stream, stop } = createStream();
    getUserMedia.mockResolvedValue(stream);
    const hook = useVoiceRecorderHarness();
    await hook.current.startRecording();

    const result = await hook.current.stopRecording();

    expect(result).toMatchObject({
      kind: 'success',
      mimeType: 'audio/webm;codecs=opus',
    });
    expect(stop).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    hook.rerender();
    expect(hook.current.status).toBe('idle');
  });

  it('uses the two-second fallback when stop never arrives', async () => {
    vi.useFakeTimers();
    stopMode = 'silent';
    const { stream, stop } = createStream();
    getUserMedia.mockResolvedValue(stream);
    const hook = useVoiceRecorderHarness();
    await hook.current.startRecording();

    let result: VoiceRecordingResult | undefined;
    const pendingStop = hook.current.stopRecording().then((value) => {
      result = value;
      return value;
    });

    await vi.advanceTimersByTimeAsync(1_999);
    expect(result).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    await expect(pendingStop).resolves.toEqual({ kind: 'error' });
    expect(stop).toHaveBeenCalledOnce();

    hook.rerender();
    expect(hook.current.status).toBe('error');
    expect(hook.current.errorMessage).toContain('tardó demasiado');
  });

  it('cancels a pending permission request and releases a late stream', async () => {
    const permission = deferred<MediaStream>();
    const { stream, stop } = createStream();
    getUserMedia.mockReturnValue(permission.promise);
    const hook = useVoiceRecorderHarness();

    const start = hook.current.startRecording();
    hook.current.cancelRecording();
    permission.resolve(stream);
    await start;

    expect(stop).toHaveBeenCalledOnce();
    expect(FakeMediaRecorder.instances).toHaveLength(0);
    hook.rerender();
    expect(hook.current.status).toBe('idle');
  });

  it('does not resume a paused recorder after cancellation wins the race', async () => {
    const resume = deferred<void>();
    class FakeAudioContext {
      state: AudioContextState = 'suspended';
      sampleRate = 48_000;
      resume = vi.fn(() => resume.promise);
      close = vi.fn(async () => {
        this.state = 'closed';
      });
      createAnalyser() {
        return {
          fftSize: 128,
          smoothingTimeConstant: 0,
          frequencyBinCount: 64,
          getByteTimeDomainData: vi.fn(),
          getByteFrequencyData: vi.fn(),
          disconnect: vi.fn(),
        } as unknown as AnalyserNode;
      }
      createMediaStreamSource() {
        return {
          connect: vi.fn(),
          disconnect: vi.fn(),
        } as unknown as MediaStreamAudioSourceNode;
      }
    }

    vi.stubGlobal('window', {
      AudioContext: FakeAudioContext as unknown as typeof AudioContext,
    });
    const { stream } = createStream();
    getUserMedia.mockResolvedValue(stream);
    const hook = useVoiceRecorderHarness();
    await hook.current.startRecording();
    const recorder = FakeMediaRecorder.instances[0];
    hook.current.pauseRecording();

    const pendingResume = hook.current.resumeRecording();
    hook.current.cancelRecording();
    resume.resolve();
    await pendingResume;

    expect(recorder.resumeCalls).toBe(0);
    hook.rerender();
    expect(hook.current.status).toBe('idle');
  });

  it('does not overwrite a newer processing status when a pending stop completes', async () => {
    const { stream } = createStream();
    getUserMedia.mockResolvedValue(stream);
    const hook = useVoiceRecorderHarness();
    await hook.current.startRecording();
    const recorder = FakeMediaRecorder.instances[0];

    const pendingStop = hook.current.stopRecording();
    hook.current.setProcessing(true);
    recorder.emitStop();
    await pendingStop;

    hook.rerender();
    expect(hook.current.status).toBe('processing');
  });
});
