import { createWorkletFromSrc } from "./audio-recorder";

type WorkletGraph = {
  node?: AudioWorkletNode;
  handlers: Array<(this: MessagePort, ev: MessageEvent) => unknown>;
};

export class AudioStreamer {
  public audioQueue: Float32Array[] = [];
  private isPlaying: boolean = false;
  private sampleRate: number = 24000;
  public gainNode: GainNode;
  public source: AudioBufferSourceNode;
  private lastPlaybackTime: number = 0;
  private playbackTimeout: ReturnType<typeof setTimeout> | null = null;
  private onComplete: () => void;
  private registeredWorklets: Map<AudioContext, Record<string, WorkletGraph>> =
    new Map();

  constructor(
    public context: AudioContext,
    options?: { onComplete: () => void }
  ) {
    this.gainNode = this.context.createGain();
    this.source = this.context.createBufferSource();
    this.gainNode.connect(this.context.destination);
    this.addPCM16 = this.addPCM16.bind(this);
    this.onComplete = options?.onComplete || (() => {});
  }

  async addWorklet<T extends (d: unknown) => void>(
    workletName: string,
    workletSrc: string,
    handler: T
  ): Promise<this> {
    let workletsRecord = this.registeredWorklets.get(this.context);
    if (workletsRecord && workletsRecord[workletName]) {
      // the worklet already exists on this context
      // add the new handler to it
      workletsRecord[workletName].handlers.push(handler);
      return Promise.resolve(this);
      //throw new Error(`Worklet ${workletName} already exists on context`);
    }

    if (!workletsRecord) {
      this.registeredWorklets.set(this.context, {});
      workletsRecord = this.registeredWorklets.get(this.context)!;
    }

    // create new record to fill in as becomes available
    workletsRecord[workletName] = { handlers: [handler] };

    const src = createWorkletFromSrc(workletName, workletSrc);
    await this.context.audioWorklet.addModule(src);
    const worklet = new AudioWorkletNode(this.context, workletName);

    //add the node into the map
    workletsRecord[workletName].node = worklet;

    return this;
  }

  addPCM16(chunk: Uint8Array) {
    const float32Array = new Float32Array(chunk.length / 2);
    const dataView = new DataView(chunk.buffer);

    for (let i = 0; i < chunk.length / 2; i++) {
      try {
        const int16 = dataView.getInt16(i * 2, true);
        float32Array[i] = int16 / 32768;
      } catch (e) {
        console.error(e);
      }
    }

    // Create and fill audio buffer
    const audioBuffer = this.context.createBuffer(
      1,
      float32Array.length,
      this.sampleRate
    );
    audioBuffer.getChannelData(0).set(float32Array);

    // Add to queue and start playing if needed
    this.audioQueue.push(audioBuffer as unknown as Float32Array);

    if (!this.isPlaying) {
      this.isPlaying = true;
      this.lastPlaybackTime = this.context.currentTime;
      this.scheduleNextBuffer();
    }

    // Ensure playback continues if it was interrupted
    this.checkPlaybackStatus();
  }

  checkPlaybackStatus() {
    // Clear any existing timeout
    if (this.playbackTimeout) {
      clearTimeout(this.playbackTimeout);
    }

    // Set a new timeout to check playback status
    this.playbackTimeout = setTimeout(() => {
      const now = this.context.currentTime;
      const timeSinceLastPlayback = now - this.lastPlaybackTime;

      // If more than 1 second has passed since last playback and we have buffers to play
      if (
        timeSinceLastPlayback > 1 &&
        this.audioQueue.length > 0 &&
        this.isPlaying
      ) {
        console.log("Playback appears to have stalled, restarting...");
        this.scheduleNextBuffer();
      }

      // Continue checking if we're still playing
      if (this.isPlaying) {
        this.checkPlaybackStatus();
      }
    }, 1000);
  }

  scheduleNextBuffer() {
    if (this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }

    // Update last playback time
    this.lastPlaybackTime = this.context.currentTime;

    try {
      const audioBuffer = this.audioQueue.shift();
      const source = this.context.createBufferSource();
      source.buffer = audioBuffer as unknown as AudioBuffer;
      source.connect(this.gainNode);

      const worklets = this.registeredWorklets.get(this.context);

      if (worklets) {
        Object.entries(worklets).forEach(([, graph]) => {
          const { node, handlers } = graph;
          if (node) {
            source.connect(node);
            node.port.onmessage = function (ev: MessageEvent) {
              handlers.forEach((handler) => {
                handler.call(node.port, ev);
              });
            };
            node.connect(this.context.destination);
          }
        });
      }

      // Store current source for potential stopping
      if (this.source) {
        try {
          this.source.disconnect();
        } catch {
          // Ignore disconnection errors
        }
      }
      this.source = source;

      // When this buffer ends, play the next one
      source.onended = () => {
        this.lastPlaybackTime = this.context.currentTime;
        if (this.audioQueue.length > 0) {
          // Small delay to ensure smooth transition
          setTimeout(() => this.scheduleNextBuffer(), 0);
        } else {
          this.isPlaying = false;
          this.onComplete();
        }
      };

      // Start playing immediately
      source.start(0);
    } catch (error) {
      console.error("Error during playback:", error);
      // Try to recover by playing next buffer
      if (this.audioQueue.length > 0) {
        setTimeout(() => this.scheduleNextBuffer(), 100);
      } else {
        this.isPlaying = false;
      }
    }
  }

  stop() {
    this.isPlaying = false;
    if (this.playbackTimeout) {
      clearTimeout(this.playbackTimeout);
      this.playbackTimeout = null;
    }
    if (this.source) {
      try {
        this.source.stop();
        this.source.disconnect();
      } catch {
        // Ignore if already stopped
      }
    }
    this.audioQueue = [];
    this.gainNode.gain.linearRampToValueAtTime(
      0,
      this.context.currentTime + 0.1
    );

    setTimeout(() => {
      this.gainNode.disconnect();
      this.gainNode = this.context.createGain();
      this.gainNode.connect(this.context.destination);
    }, 200);
  }

  async resume() {
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
    this.lastPlaybackTime = this.context.currentTime;
    this.gainNode.gain.setValueAtTime(1, this.context.currentTime);
    if (this.audioQueue.length > 0 && !this.isPlaying) {
      this.isPlaying = true;
      this.scheduleNextBuffer();
    }
  }

  complete() {
    if (this.audioQueue.length > 0) {
      // Let the remaining buffers play out
      return;
    }
    if (this.playbackTimeout) {
      clearTimeout(this.playbackTimeout);
      this.playbackTimeout = null;
    }
    this.onComplete();
  }
}
