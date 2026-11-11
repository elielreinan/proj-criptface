class VoiceDistorter extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(Math.ceil(sampleRate * 0.3));
    this.position = 0;
    this.phase = 0;
    this.window = Math.floor(sampleRate * 0.08);
    this.minimumDelay = Math.floor(sampleRate * 0.02);
  }

  process(inputs, outputs) {
    const input = inputs[0][0];
    const output = outputs[0][0];
    if (!input || !output) return true;
    for (let i = 0; i < output.length; i++) {
      this.buffer[this.position] = input[i];
      let value = 0;
      for (let head = 0; head < 2; head++) {
        const phase = (this.phase + head * 0.5) % 1;
        const delay = this.minimumDelay + phase * this.window;
        const index = (this.position - delay + this.buffer.length) % this.buffer.length;
        const lower = Math.floor(index);
        const fraction = index - lower;
        const sample = this.buffer[lower] * (1 - fraction) + this.buffer[(lower + 1) % this.buffer.length] * fraction;
        value += sample * Math.sin(Math.PI * phase) ** 2;
      }
      output[i] = value;
      this.position = (this.position + 1) % this.buffer.length;
      this.phase = (this.phase + 0.35 / this.window) % 1;
    }
    return true;
  }
}

registerProcessor("voice-distorter", VoiceDistorter);
