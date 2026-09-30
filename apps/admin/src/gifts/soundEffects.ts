// Web Audio Context singleton for reliable, zero-latency synthesizer fallbacks
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function playGiftSound(soundUrl?: string, giftId?: string, isMuted: boolean = false): void {
  if (isMuted) return;

  // 1. Try playing audio asset file if provided
  if (soundUrl) {
    try {
      const audio = new Audio(soundUrl);
      audio.volume = 0.75;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay policy prevented playback, attempt synthesized chime
          synthesizeGiftSound(giftId);
        });
      }
      return;
    } catch (e) {
      // Audio element creation failed, fallback to synth
    }
  }

  // 2. Synthesized fallback
  synthesizeGiftSound(giftId);
}

export function synthesizeGiftSound(giftId?: string): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    if (giftId === 'rose') {
      // Gentle romantic chime (layered bell tones C6, E6, G6)
      const freqs = [1046.5, 1318.5, 1567.98];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);

        gain.gain.setValueAtTime(0.12, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.05);
        osc.stop(now + 1.8);
      });
    } else if (giftId === 'dragon') {
      // Deep cinematic sub-bass roar & energy eruption
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 1.2);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

      // Lowpass filter for deep resonant rumble
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(250, now);
      filter.frequency.linearRampToValueAtTime(80, now + 2.0);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 2.5);
    } else if (giftId === 'super-galaxy') {
      // Cosmic whoosh & energy swell
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.8);
      osc.frequency.exponentialRampToValueAtTime(180, now + 2.2);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 0.7);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 2.5);
    } else if (giftId === 'tropical-mosquito') {
      // Fun tropical wing frequency modulated buzz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.linearRampToValueAtTime(480, now + 0.4);
      osc.frequency.linearRampToValueAtTime(360, now + 1.2);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 1.6);
    }
  } catch (e) {
    // Ignore audio synthesis errors gracefully
  }
}
