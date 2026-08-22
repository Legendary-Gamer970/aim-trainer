import { settingsManager } from '../config/settings';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume: number = 0.7;

  constructor() {
    this.volume = settingsManager.get('masterVolume') / 100;
    settingsManager.subscribe((settings) => {
      this.volume = settings.masterVolume / 100;
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      }
    });
  }

  private initContext(): void {
    if (typeof window === 'undefined') return;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Gunshot sound effect: punchy tactical crack + low-end body
   */
  public playGunshot(): void {
    try {
      this.initContext();
      if (!this.ctx || !this.masterGain || this.volume <= 0) return;

      const now = this.ctx.currentTime;

      // 1. Initial high crack
      const oscCrack = this.ctx.createOscillator();
      const gainCrack = this.ctx.createGain();
      oscCrack.type = 'sawtooth';
      oscCrack.frequency.setValueAtTime(900, now);
      oscCrack.frequency.exponentialRampToValueAtTime(150, now + 0.08);

      gainCrack.gain.setValueAtTime(0.4, now);
      gainCrack.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      oscCrack.connect(gainCrack);
      gainCrack.connect(this.masterGain);

      oscCrack.start(now);
      oscCrack.stop(now + 0.09);

      // 2. Low punch thump
      const oscThump = this.ctx.createOscillator();
      const gainThump = this.ctx.createGain();
      oscThump.type = 'sine';
      oscThump.frequency.setValueAtTime(220, now);
      oscThump.frequency.exponentialRampToValueAtTime(45, now + 0.12);

      gainThump.gain.setValueAtTime(0.5, now);
      gainThump.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      oscThump.connect(gainThump);
      gainThump.connect(this.masterGain);

      oscThump.start(now);
      oscThump.stop(now + 0.13);
    } catch (e) {
      console.warn('Gunshot audio error', e);
    }
  }

  /**
   * Headshot sound: High-pitch, crisp, rewarding metallic chime
   */
  public playHeadshot(): void {
    try {
      this.initContext();
      if (!this.ctx || !this.masterGain || this.volume <= 0) return;

      const now = this.ctx.currentTime;

      // High bell ping
      const osc1 = this.ctx.createOscillator();
      const gain1 = this.ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(2400, now);
      osc1.frequency.exponentialRampToValueAtTime(1600, now + 0.18);

      gain1.gain.setValueAtTime(0.7, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc1.connect(gain1);
      gain1.connect(this.masterGain);

      // Overtone chime
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(4200, now);
      osc2.frequency.exponentialRampToValueAtTime(2800, now + 0.12);

      gain2.gain.setValueAtTime(0.5, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc2.connect(gain2);
      gain2.connect(this.masterGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.19);
      osc2.stop(now + 0.13);
    } catch (e) {
      console.warn('Headshot audio error', e);
    }
  }

  /**
   * Body hit sound: Solid kinetic impact
   */
  public playBodyHit(): void {
    try {
      this.initContext();
      if (!this.ctx || !this.masterGain || this.volume <= 0) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(750, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.09);

      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch (e) {
      console.warn('Body hit audio error', e);
    }
  }

  public playHit(): void {
    this.playBodyHit();
  }

  public playMiss(): void {
    try {
      this.initContext();
      if (!this.ctx || !this.masterGain || this.volume <= 0) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.06);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.07);
    } catch (e) {
      console.warn('Audio miss error', e);
    }
  }

  /**
   * Dry fire click when attempting to shoot with empty mag
   */
  public playDryFire(): void {
    try {
      this.initContext();
      if (!this.ctx || !this.masterGain || this.volume <= 0) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.03);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {
      console.warn('Dry fire audio error', e);
    }
  }

  /**
   * Reload sequence audio: 3-stage mechanical cues (mag out, mag in, slide rack)
   */
  public playReload(): void {
    try {
      this.initContext();
      if (!this.ctx || !this.masterGain || this.volume <= 0) return;

      const now = this.ctx.currentTime;

      // Step 1: Mag release click (~0.15s)
      this.scheduleClick(now + 0.15, 800, 300, 0.04);

      // Step 2: Mag insertion clack (~0.85s)
      this.scheduleClick(now + 0.85, 450, 200, 0.06);
      this.scheduleClick(now + 0.90, 950, 400, 0.04);

      // Step 3: Bolt / Charging handle rack (~1.3s)
      this.scheduleClick(now + 1.25, 1200, 600, 0.05);
      this.scheduleClick(now + 1.35, 1600, 800, 0.04);
    } catch (e) {
      console.warn('Reload audio error', e);
    }
  }

  private scheduleClick(time: number, startFreq: number, endFreq: number, duration: number): void {
    if (!this.ctx || !this.masterGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + duration);

    gain.gain.setValueAtTime(0.25, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(time);
    osc.stop(time + duration + 0.01);
  }

  public playCountdown(highTone: boolean = false): void {
    try {
      this.initContext();
      if (!this.ctx || !this.masterGain || this.volume <= 0) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(highTone ? 880 : 440, now);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {
      console.warn('Countdown audio error', e);
    }
  }

  public playVictory(): void {
    try {
      this.initContext();
      if (!this.ctx || !this.masterGain || this.volume <= 0) return;

      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      const start = this.ctx.currentTime;

      notes.forEach((freq, index) => {
        if (!this.ctx || !this.masterGain) return;
        const now = start + index * 0.09;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 0.26);
      });
    } catch (e) {
      console.warn('Victory audio error', e);
    }
  }
}

export const audioManager = new AudioManager();
