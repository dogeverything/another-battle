/**
 * Procedural WebAudio Synthesizer & Sample Player for Tactical Naval Warfare SFX
 */
export const COMMANDER_VOICE_SLUGS = {
  SPLITTER: 'kael_vance',
  PHANTOM: 'vespera_noctis',
  EVACUATOR: 'akira_sato',
  SONAR: 'lyra_chen',
  FOG: 'viktor_krane'
};

class SoundSynthesizer {
  constructor() {
    this.ctx = null;
    this.phaserSound = null;
    this.muted = false;
    this.cannonBuffer = null;
    this.victoryBuffer = null;
    this.voiceCache = new Map();
    this.samplesLoading = false;
    this.activeVictorySrc = null;
    this.activePhaserVictory = null;
    this.bgmSound = null;
    this.bgmVolume = 0.8;
    this.activeVoiceSrc = null;
    this.activePhaserVoice = null;
    this.activeVoiceAudio = null;
    this._voiceReqId = 0;

    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.init();
        if (this.ctx && this.ctx.state === 'running') {
          window.removeEventListener('pointerdown', unlock);
          window.removeEventListener('keydown', unlock);
        }
      };
      window.addEventListener('pointerdown', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
    }
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this.ctx && (!this.cannonBuffer || !this.victoryBuffer) && !this.samplesLoading) {
      this.preloadSamples();
    }
  }

  async _loadBuffer(url) {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    return await this.ctx.decodeAudioData(arr);
  }

  async preloadSamples() {
    if (this.samplesLoading || typeof fetch === 'undefined') return;
    if (!this.ctx) this.init();
    if (!this.ctx) return;

    this.samplesLoading = true;
    try {
      const tasks = [];
      if (!this.cannonBuffer) {
        tasks.push(
          this._loadBuffer('/assets/sound/cannon_shot.mp3').then((buf) => {
            if (buf) this.cannonBuffer = buf;
          })
        );
      }
      if (!this.victoryBuffer) {
        tasks.push(
          this._loadBuffer('/assets/sound/victory.mp3').then((buf) => {
            if (buf) this.victoryBuffer = buf;
          })
        );
      }
      await Promise.all(tasks);
    } catch {
      // Fallback to procedural synth if samples fail to load
    } finally {
      this.samplesLoading = false;
    }
  }

  preloadCannonSample() {
    return this.preloadSamples();
  }

  /**
   * Plays a cloned instance of cannon_shot.mp3 with optional delay, pitch, and volume
   */
  _playCannonClone({ delay = 0, playbackRate = 1.0, volume = 0.72, durationCap = null } = {}) {
    if (!this.ctx || !this.cannonBuffer) return false;
    const startAt = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.cannonBuffer;
    src.playbackRate.setValueAtTime(playbackRate, startAt);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, startAt);
    if (durationCap) {
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + durationCap);
    }

    src.connect(gain);
    gain.connect(this.ctx.destination);
    src.start(startAt);
    if (durationCap) {
      src.stop(startAt + durationCap + 0.02);
    }
    return true;
  }

  setSoundManager(soundManager) {
    this.phaserSound = soundManager;
  }

  playBGM() {
    if (!this.phaserSound || !this.phaserSound.game?.cache?.audio?.exists('bgm_main')) {
      return;
    }
    if (this.bgmSound) {
      if (!this.bgmSound.isPlaying && !this.muted) {
        this.bgmSound.play();
      }
      return;
    }

    try {
      this.bgmSound = this.phaserSound.add('bgm_main', {
        loop: true,
        volume: this.bgmVolume
      });
      if (this.phaserSound.locked) {
        this.phaserSound.once('unlocked', () => {
          if (!this.muted && this.bgmSound && !this.bgmSound.isPlaying) {
            this.bgmSound.play();
          }
        });
      } else if (!this.muted) {
        this.bgmSound.play();
      }
    } catch (err) {
      console.warn('[SoundFX] BGM error:', err);
    }
  }

  _playPhaserSfx(key, volume = 0.8, rate = 1.0) {
    if (!this.phaserSound || !this.phaserSound.game?.cache?.audio?.exists(key)) {
      return false;
    }
    try {
      const snd = this.phaserSound.add(key, { volume, rate });
      snd.once('complete', () => snd.destroy());
      snd.play();
      return true;
    } catch (err) {
      console.warn(`[SoundFX] Phaser SFX error (${key}):`, err);
      return false;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.phaserSound) {
      this.phaserSound.mute = this.muted;
    }
    return this.muted;
  }

  playClick(freq = 680) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.35, now + 0.06);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  playSonarPing() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1320, now);
    osc.frequency.exponentialRampToValueAtTime(1180, now + 0.55);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.62);
  }

  playCannonFire(ammoType = 'STANDARD') {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    if (this.cannonBuffer) {
      if (ammoType === 'CLUSTER') {
        // Clone cannon_shot.mp3 into a rapid 3-round cluster barrage with varied pitch
        this._playCannonClone({ delay: 0, playbackRate: 1.06, volume: 0.56, durationCap: 0.65 });
        this._playCannonClone({ delay: 0.085, playbackRate: 0.94, volume: 0.62, durationCap: 0.7 });
        this._playCannonClone({ delay: 0.175, playbackRate: 1.14, volume: 0.52, durationCap: 0.75 });
        return;
      }
      if (ammoType === 'RICOCHET') {
        // Initial high-velocity shot; subsequent bounces trigger cloned ricochet hits
        this._playCannonClone({ delay: 0, playbackRate: 1.12, volume: 0.66, durationCap: 0.55 });
        return;
      }
      this._playCannonClone({ delay: 0, playbackRate: 1.0, volume: 0.72 });
      return;
    }

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.22);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  playExplosion(big = false) {
    if (this.muted) return;
    this.init();

    if (big && this._playPhaserSfx('sfx_ship_sunk', 0.85)) {
      return;
    }

    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const duration = big ? 0.55 : 0.32;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 1.5);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(big ? 420 : 620, now);
    filter.frequency.exponentialRampToValueAtTime(90, now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(big ? 0.36 : 0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
  }

  playSplash() {
    if (this.muted) return;
    this.init();

    if (this._playPhaserSfx('sfx_water_splash', 0.72)) {
      return;
    }

    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const duration = 0.24;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, now);
    filter.frequency.exponentialRampToValueAtTime(380, now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
  }

  playRicochetBounce(step = 1) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    // Layer a pitched-up clone of cannon_shot.mp3 for each ricochet bounce impact
    if (this.cannonBuffer) {
      this._playCannonClone({
        delay: 0,
        playbackRate: 1.35 + step * 0.22,
        volume: Math.max(0.28, 0.5 - step * 0.08),
        durationCap: 0.35
      });
    }

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    const baseFreq = step === 1 ? 880 : 1140;
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.12);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  playSkillActivate() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const now = this.ctx.currentTime + idx * 0.055;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.19);
    });
  }

  playSmokeBomb() {
    if (this.muted) return;
    this.init();
    if (this._playPhaserSfx('sfx_smoke_bomb', 0.82)) {
      return;
    }
    this.playSkillActivate();
  }

  playVictory() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    this.stopVictory();

    if (this.phaserSound && this.phaserSound.game?.cache?.audio?.exists('sfx_victory')) {
      try {
        if (this.bgmSound) this.bgmSound.setVolume(0.25);
        this.activePhaserVictory = this.phaserSound.add('sfx_victory', { volume: 0.45 });
        this.activePhaserVictory.once('complete', () => {
          if (this.bgmSound) this.bgmSound.setVolume(this.bgmVolume);
        });
        this.activePhaserVictory.play();
        return;
      } catch (err) {
        console.warn('[SoundFX] Phaser victory play error:', err);
      }
    }

    if (this.victoryBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.victoryBuffer;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.45, this.ctx.currentTime);
      src.connect(gain);
      gain.connect(this.ctx.destination);
      src.start(this.ctx.currentTime);
      this.activeVictorySrc = src;
      src.onended = () => {
        if (this.activeVictorySrc === src) this.activeVictorySrc = null;
      };
      return;
    }

    // Fallback victory fanfare if victory.mp3 hasn't finished decoding
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, idx) => {
      const now = this.ctx.currentTime + idx * 0.1;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);
    });
  }

  stopVictory() {
    if (this.bgmSound) {
      this.bgmSound.setVolume(this.bgmVolume);
    }
    if (this.activePhaserVictory) {
      try {
        this.activePhaserVictory.stop();
        this.activePhaserVictory.destroy();
      } catch {
        // Ignore cleanup errors
      }
      this.activePhaserVictory = null;
    }
    if (this.activeVictorySrc) {
      try {
        this.activeVictorySrc.stop();
      } catch {
        // Ignore already-stopped source
      }
      this.activeVictorySrc = null;
    }
  }

  async playCommanderVoice(commanderId, outcome = true) {
    if (this.muted || !commanderId) return;
    this.init();

    const reqId = ++this._voiceReqId;
    this.stopCommanderVoice();
    const suffix = outcome === 'select' ? 'select' : outcome ? 'win' : 'lose';
    const slug = COMMANDER_VOICE_SLUGS[commanderId] || commanderId;
    const phaserKey = `voice_${commanderId}_${suffix}`;

    const rateMap = {
      SPLITTER: 1.03,
      PHANTOM: 0.94,
      EVACUATOR: 1.08,
      SONAR: 1.04,
      FOG: 0.88,
      kael_vance: 1.03,
      vespera_noctis: 0.94,
      akira_sato: 1.08,
      lyra_chen: 1.04,
      viktor_krane: 0.88
    };

    // Primary path: synchronous playback via Phaser's preloaded SoundManager
    if (this.phaserSound && this.phaserSound.game?.cache?.audio?.exists(phaserKey)) {
      try {
        const snd = this.phaserSound.add(phaserKey, {
          volume: 0.95,
          rate: rateMap[commanderId] || 1.0
        });
        this.activePhaserVoice = snd;
        snd.once('complete', () => {
          if (this.activePhaserVoice === snd) this.activePhaserVoice = null;
          snd.destroy();
        });
        snd.play();
        return;
      } catch (err) {
        console.warn('[SoundFX] Phaser voice play error:', err);
      }
    }

    const url = `/assets/sound/voices/${slug}_${suffix}.wav?v=3`;
    const key = `${slug}_${suffix}`;

    try {
      if (this.ctx && this.ctx.state === 'suspended') {
        await this.ctx.resume().catch(() => {});
      }

      if (this.ctx && this.ctx.state === 'running' && typeof fetch !== 'undefined') {
        let buffer = this.voiceCache.get(key);
        if (!buffer) {
          try {
            buffer = await this._loadBuffer(url);
            if (buffer) this.voiceCache.set(key, buffer);
          } catch (decodeErr) {
            console.warn('[SoundFX] WebAudio decode fallback:', decodeErr);
          }
        }
        if (reqId !== this._voiceReqId || this.muted) return;

        if (buffer) {
          const rateMap = {
            kael_vance: 1.03,
            vespera_noctis: 0.94,
            akira_sato: 1.08,
            lyra_chen: 1.04,
            viktor_krane: 0.88
          };

          const src = this.ctx.createBufferSource();
          src.buffer = buffer;
          src.playbackRate.setValueAtTime(rateMap[commanderId] || 1.0, this.ctx.currentTime);

          // Light tactical radio warmth without cutting voice volume
          const highpass = this.ctx.createBiquadFilter();
          highpass.type = 'highpass';
          highpass.frequency.setValueAtTime(140, this.ctx.currentTime);

          const gain = this.ctx.createGain();
          gain.gain.setValueAtTime(1.25, this.ctx.currentTime);

          src.connect(highpass);
          highpass.connect(gain);
          gain.connect(this.ctx.destination);

          src.start(this.ctx.currentTime);
          this.activeVoiceSrc = src;
          src.onended = () => {
            if (this.activeVoiceSrc === src) this.activeVoiceSrc = null;
          };
          return;
        }
      }

      // Fallback to HTML5 Audio element if AudioContext isn't running
      if (typeof Audio !== 'undefined' && reqId === this._voiceReqId && !this.muted) {
        const audio = new Audio(url);
        audio.volume = 0.95;
        this.activeVoiceAudio = audio;
        await audio.play();
      }
    } catch (err) {
      console.warn('[SoundFX] playCommanderVoice error:', err);
    }
  }

  stopCommanderVoice() {
    if (this.activePhaserVoice) {
      try {
        this.activePhaserVoice.stop();
        this.activePhaserVoice.destroy();
      } catch {
        // Ignore cleanup errors
      }
      this.activePhaserVoice = null;
    }
    if (this.activeVoiceSrc) {
      try {
        this.activeVoiceSrc.stop();
      } catch {
        // Ignore already-stopped source
      }
      this.activeVoiceSrc = null;
    }
    if (this.activeVoiceAudio) {
      try {
        this.activeVoiceAudio.pause();
        this.activeVoiceAudio.currentTime = 0;
      } catch {
        // Ignore cleanup errors
      }
      this.activeVoiceAudio = null;
    }
  }
}

export const SoundFX = new SoundSynthesizer();

