/**
 * AudioSystem.js - Procedural Retro Chiptune & SFX Synthesizer
 * Powered entirely by the Web Audio API. No assets required.
 */
class AudioSystem {
  constructor() {
    this.ctx = null;
    this.masterVolume = null;
    this.musicVolume = null;
    this.customMusicVolume = null;
    this.sfxVolume = null;
    
    // Stored volume levels (0.0 to 1.0)
    this.masterVolSetting = 0.8;
    this.musicVolSetting = 0.65;
    this.sfxVolSetting = 0.75;
    
    // Music Sequencer state
    this.musicInterval = null;
    this.isPlayingMusic = false;
    this.tempo = 132; // BPM
    this.currentStep = 0;
    this.nextNoteTime = 0.0;
    this.scheduleAheadTime = 0.1; // How far ahead to schedule audio (sec)
    this.lookahead = 25.0; // How frequently to call scheduler (ms)
    
    // Active Stage Theme (1, 2, or 3)
    this.stageTheme = 1;
    this.isBossTheme = false;
    this.unlocked = false;

    // Custom MP3 Audio Tracks Registry
    this.customTracks = {
      menu: { src: '/assets/menu.mp3', audio: null, available: false },
      stage1: { src: '/assets/stage1.mp3', audio: null, available: false },
      stage2: { src: '/assets/stage2.mp3', audio: null, available: false },
      stage3: { src: '/assets/stage3.mp3', audio: null, available: false },
      boss: { src: '/assets/boss.mp3', audio: null, available: false }
    };
    this.currentPlayingTrack = null;

    // Musical Progression - Stage 1 (Void Shift: A-minor)
    this.bassNormal1 = [33, 33, 33, 33, 29, 29, 29, 29, 36, 36, 36, 36, 31, 31, 31, 31]; // A1, F1, C2, G1
    this.bassBoss1 = [33, 33, 34, 34, 33, 33, 31, 31, 29, 29, 28, 28, 29, 29, 31, 31];
    this.melodyNormal1 = [
      60, 64, 67, 72, 60, 64, 67, 72, // Am chord arpeggio
      65, 69, 72, 77, 65, 69, 72, 77, // Fmaj chord arpeggio
      67, 71, 74, 79, 67, 71, 74, 79, // Gmaj chord arpeggio
      64, 67, 71, 76, 64, 67, 71, 76  // Em chord arpeggio
    ];
    this.melodyBoss1 = [
      63, 66, 69, 72, 63, 66, 69, 72, // Diminished tense chord
      62, 65, 68, 71, 62, 65, 68, 71, // Diminished tense chord
      64, 68, 71, 76, 64, 68, 71, 76, // E major dominant
      63, 66, 69, 75, 63, 66, 69, 75  // Ultra tense
    ];

    // Musical Progression - Stage 2 (Cyber Pulse: D-minor Cyberpunk)
    this.bassNormal2 = [26, 26, 26, 26, 22, 22, 22, 22, 29, 29, 29, 29, 24, 24, 24, 24]; // D1, A#0, F1, C1
    this.bassBoss2 = [26, 26, 27, 27, 26, 26, 24, 24, 22, 22, 21, 21, 22, 22, 24, 24];
    this.melodyNormal2 = [
      62, 65, 69, 74, 62, 65, 69, 74, // Dm chord arpeggio
      58, 62, 65, 70, 58, 62, 65, 70, // A#maj chord arpeggio
      65, 69, 72, 77, 65, 69, 72, 77, // Fmaj chord arpeggio
      60, 64, 67, 72, 60, 64, 67, 72  // Cmaj chord arpeggio
    ];
    this.melodyBoss2 = [
      61, 64, 67, 70, 61, 64, 67, 70, // Dm diminished
      62, 65, 68, 71, 62, 65, 68, 71, // D# diminished
      64, 67, 70, 73, 64, 67, 70, 73, // E diminished
      62, 65, 69, 74, 62, 65, 69, 74  // Dm standard high power
    ];

    // Musical Progression - Stage 3 (Neon Singularity: E-Phrygian Dark Synth)
    this.bassNormal3 = [28, 28, 28, 28, 29, 29, 29, 29, 31, 31, 31, 31, 29, 29, 29, 29]; // E1, F1, G1, F1
    this.bassBoss3 = [28, 28, 29, 29, 28, 28, 30, 30, 31, 31, 29, 29, 28, 28, 27, 27];
    this.melodyNormal3 = [
      64, 67, 71, 76, 64, 67, 71, 76, // Em chord arpeggio
      65, 69, 72, 77, 65, 69, 72, 77, // Fmaj chord arpeggio
      67, 71, 74, 79, 67, 71, 74, 79, // Gmaj chord arpeggio
      65, 69, 72, 77, 65, 69, 72, 77  // Fmaj chord arpeggio
    ];
    this.melodyBoss3 = [
      63, 64, 67, 68, 63, 64, 67, 68, // Chromatic tense Phrygian
      65, 66, 69, 70, 65, 66, 69, 70,
      67, 68, 71, 72, 67, 68, 71, 72,
      64, 65, 68, 69, 64, 65, 68, 69
    ];
  }

  /**
   * Initializes the AudioContext. Must be called within a user interaction handler.
   */
  init() {
    if (this.unlocked) return;
    
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      
      // Master volume node
      this.masterVolume = this.ctx.createGain();
      this.masterVolume.gain.setValueAtTime(this.masterVolSetting, this.ctx.currentTime);
      this.masterVolume.connect(this.ctx.destination);
      
      // Separate music and SFX volume nodes
      this.musicVolume = this.ctx.createGain();
      this.musicVolume.gain.setValueAtTime(this.musicVolSetting, this.ctx.currentTime);
      this.musicVolume.connect(this.masterVolume);
      
      this.customMusicVolume = this.ctx.createGain();
      this.customMusicVolume.gain.setValueAtTime(this.musicVolSetting, this.ctx.currentTime);
      this.customMusicVolume.connect(this.masterVolume);
      
      this.sfxVolume = this.ctx.createGain();
      this.sfxVolume.gain.setValueAtTime(this.sfxVolSetting, this.ctx.currentTime);
      this.sfxVolume.connect(this.masterVolume);
      
      // --- Premium Retro Chiptune Delay Node ---
      // Creates a dotted 8th note delay/echo effect (0.18s repeat interval)
      this.musicDelay = this.ctx.createDelay(1.0);
      this.musicDelay.delayTime.setValueAtTime(0.18, this.ctx.currentTime);
      
      // Feedback loop volume node (35% echo volume repeats)
      this.musicDelayFeedback = this.ctx.createGain();
      this.musicDelayFeedback.gain.setValueAtTime(0.35, this.ctx.currentTime);
      
      // Connect delay loop: delay -> feedback -> delay
      this.musicDelay.connect(this.musicDelayFeedback);
      this.musicDelayFeedback.connect(this.musicDelay);
      
      // Route the main music volume node into the echo delay
      this.musicVolume.connect(this.musicDelay);
      
      // Output the echo delay directly to the master volume
      this.musicDelay.connect(this.masterVolume);
      // ------------------------------------------
      
      // --- Premium Custom BGM Streamer Integration ---
      // Dynamically load and register custom MP3 tracks with zero-race-condition preloading
      Object.keys(this.customTracks).forEach(key => {
        const track = this.customTracks[key];
        track.audio = new Audio();
        track.audio.loop = true;
        track.audio.crossOrigin = 'anonymous'; // Prevent CORS issues in Web Audio

        // 1. Register event listeners BEFORE setting the src attribute to catch early loads
        const onCanPlay = () => {
          if (!track.available) {
            track.available = true;
            console.log(`AudioSystem: Custom MP3 successfully loaded for ${key}! Ready to play.`);
            
            // If this loaded track is the active theme, transition to it immediately!
            if (this.unlocked && this.getActiveCustomTrack() === track) {
              this.startMusic();
            }
          }
        };

        track.audio.addEventListener('canplay', onCanPlay);
        track.audio.addEventListener('canplaythrough', onCanPlay);
        track.audio.addEventListener('loadedmetadata', onCanPlay);

        track.audio.addEventListener('error', () => {
          // Silent fallback to chiptune if file is missing
          track.available = false;
        });

        // 2. Now set the source to start loading in the browser
        track.audio.src = track.src;

        // 3. Connect to Web Audio customMusicVolume node (bypasses the chiptune delay node!)
        try {
          const mediaSource = this.ctx.createMediaElementSource(track.audio);
          mediaSource.connect(this.customMusicVolume);
        } catch (e) {
          console.warn(`AudioSystem: Web Audio API connection failed for custom track ${key}:`, e);
        }
      });
      // ------------------------------------------------
      
      this.unlocked = true;
      console.log("AudioSystem initialized successfully with Retro Stereo Delay! Volume levels: Master:", this.masterVolSetting, "Music:", this.musicVolSetting, "SFX:", this.sfxVolSetting);
      this.resume();
    } catch (e) {
      console.warn("Web Audio API is not supported in this browser:", e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      return this.ctx.resume().then(() => {
        console.log("AudioSystem resumed successfully!");
      }).catch(err => {
        console.warn("AudioContext resume failed:", err);
      });
    }
    return Promise.resolve();
  }

  getState() {
    if (!this.unlocked || !this.ctx) return 'uninitialized';
    return this.ctx.state;
  }

  setMasterVolume(volume) {
    const val = Math.max(0, Math.min(1, volume));
    this.masterVolSetting = val;
    if (this.unlocked && this.masterVolume && this.ctx) {
      try {
        this.masterVolume.gain.setValueAtTime(val, this.ctx.currentTime);
      } catch (e) {
        this.masterVolume.gain.value = val;
      }
    }
  }

  setMusicVolume(volume) {
    const val = Math.max(0, Math.min(1, volume));
    this.musicVolSetting = val;
    if (this.unlocked && this.ctx) {
      if (this.musicVolume) {
        try {
          this.musicVolume.gain.setValueAtTime(val, this.ctx.currentTime);
        } catch (e) {
          this.musicVolume.gain.value = val;
        }
      }
      if (this.customMusicVolume) {
        try {
          this.customMusicVolume.gain.setValueAtTime(val, this.ctx.currentTime);
        } catch (e) {
          this.customMusicVolume.gain.value = val;
        }
      }
    }
  }

  setSFXVolume(volume) {
    const val = Math.max(0, Math.min(1, volume));
    this.sfxVolSetting = val;
    if (this.unlocked && this.sfxVolume && this.ctx) {
      try {
        this.sfxVolume.gain.setValueAtTime(val, this.ctx.currentTime);
      } catch (e) {
        this.sfxVolume.gain.value = val;
      }
    }
  }

  /**
   * Translates MIDI note to frequency
   */
  midiToFreq(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  /* ==========================================================================
     SOUND EFFECTS (SFX) SYNTHESIZERS
     ========================================================================== */
  
  createSimpleSfx(type, freqStart, freqEnd, duration, gainStart, decayType = 'exponential') {
    if (!this.unlocked) return;
    this.resume();
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== freqStart) {
      if (decayType === 'exponential') {
        osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration);
      } else {
        osc.frequency.linearRampToValueAtTime(freqEnd, now + duration);
      }
    }
    
    gainNode.gain.setValueAtTime(gainStart, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    osc.connect(gainNode);
    gainNode.connect(this.sfxVolume);
    
    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  playLaser() {
    this.createSimpleSfx('triangle', 900, 120, 0.12, 0.4);
  }

  playLaserHeavy() {
    this.createSimpleSfx('sawtooth', 450, 80, 0.22, 0.5);
  }

  playLaserEnemy() {
    this.createSimpleSfx('sawtooth', 300, 60, 0.18, 0.2);
  }

  playExplosion() {
    if (!this.unlocked) return;
    this.resume();
    
    const now = this.ctx.currentTime;
    const duration = 0.35;
    
    // Synthesize low-mid white noise explosion
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    // Lowpass filter to make it thuddy and retro
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(30, now + duration);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxVolume);
    
    noise.start(now);
    noise.stop(now + duration);
  }

  playHit() {
    this.createSimpleSfx('sawtooth', 180, 40, 0.15, 0.4, 'linear');
  }

  playShieldHit() {
    this.createSimpleSfx('sine', 1200, 600, 0.1, 0.3);
  }

  playBomb() {
    if (!this.unlocked) return;
    this.resume();
    
    const now = this.ctx.currentTime;
    const duration = 1.6;
    
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.exponentialRampToValueAtTime(10, now + duration);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(1.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxVolume);
    
    // Add sub-bass rumble
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(90, now);
    subOsc.frequency.exponentialRampToValueAtTime(20, now + duration);
    
    subGain.gain.setValueAtTime(0.8, now);
    subGain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    subOsc.connect(subGain);
    subGain.connect(this.sfxVolume);
    
    noise.start(now);
    noise.stop(now + duration);
    
    subOsc.start(now);
    subOsc.stop(now + duration);
  }

  playUpgrade() {
    if (!this.unlocked) return;
    this.resume();
    
    const now = this.ctx.currentTime;
    const scale = [60, 64, 67, 72, 76, 79, 84]; // Ascending C Major chord
    
    scale.forEach((note, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(this.midiToFreq(note), now + idx * 0.06);
      
      gain.gain.setValueAtTime(0.2, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.06 + 0.15);
      
      osc.connect(gain);
      gain.connect(this.sfxVolume);
      
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.16);
    });
  }

  /* ==========================================================================
     PROCEDURAL BACKGROUND MUSIC (BGM) SEQUENCER
     ========================================================================== */
  
  stopAllCustomTracks() {
    this.currentPlayingTrack = null;
    Object.keys(this.customTracks).forEach(key => {
      const track = this.customTracks[key];
      if (track.audio) {
        try {
          track.audio.pause();
          track.audio.currentTime = 0; // Rewind notes
        } catch (e) {}
      }
    });
  }

  getActiveCustomTrack() {
    const key = this.isBossTheme ? 'boss' : (this.stageTheme === 0 ? 'menu' : `stage${this.stageTheme}`);
    return this.customTracks[key] || this.customTracks.stage1;
  }

  startMusic() {
    if (!this.unlocked) return;
    
    this.resume().then(() => {
      const track = this.getActiveCustomTrack();
      const isAvailable = track && (track.available || (track.audio && track.audio.readyState >= 2));
      
      if (track && isAvailable && track.audio) {
        // If this track is already active and playing, prevent redundant restarts (fixes choppiness!)
        if (this.currentPlayingTrack === track && !track.audio.paused) {
          return;
        }
        
        // Stop chiptune sequencer to prevent overlapping tracks
        this.isPlayingMusic = false;
        if (this.musicInterval) {
          clearTimeout(this.musicInterval);
          this.musicInterval = null;
        }
        
        // Stop and rewind all OTHER playing custom tracks
        Object.keys(this.customTracks).forEach(key => {
          const t = this.customTracks[key];
          if (t !== track && t.audio) {
            try {
              t.audio.pause();
              t.audio.currentTime = 0;
            } catch (e) {}
          }
        });
        
        this.currentPlayingTrack = track;
        
        // Play the matched custom MP3 fader
        track.audio.play().then(() => {
          track.available = true; // Mark as successfully verified
        }).catch(e => {
          console.warn(`AudioSystem: Failed to play custom music for ${track.src}, falling back:`, e);
          this.currentPlayingTrack = null;
          this.isPlayingMusic = true;
          this.currentStep = 0;
          this.nextNoteTime = this.ctx.currentTime;
          this.schedulerLoop();
        });
      } else {
        // Stop any custom tracks and fall back to procedural chiptunes
        this.stopAllCustomTracks();
        
        if (this.isPlayingMusic) return;
        this.isPlayingMusic = true;
        this.currentStep = 0;
        this.nextNoteTime = this.ctx.currentTime;
        this.schedulerLoop();
      }
    }).catch(err => {
      console.warn("Failed to resume AudioContext during music start:", err);
      const track = this.getActiveCustomTrack();
      const isAvailable = track && (track.available || (track.audio && track.audio.readyState >= 2));
      if (!track || !isAvailable) {
        this.isPlayingMusic = true;
        this.currentStep = 0;
        this.nextNoteTime = this.ctx.currentTime;
        this.schedulerLoop();
      }
    });
  }

  stopMusic() {
    this.isPlayingMusic = false;
    if (this.musicInterval) {
      clearTimeout(this.musicInterval);
      this.musicInterval = null;
    }
    this.stopAllCustomTracks();
  }

  updateTempo() {
    if (this.isBossTheme) {
      this.tempo = 160;
    } else {
      if (this.stageTheme === 0) this.tempo = 110;
      else if (this.stageTheme === 1) this.tempo = 120;
      else if (this.stageTheme === 2) this.tempo = 140;
      else if (this.stageTheme === 3) this.tempo = 110;
      else this.tempo = 120;
    }
  }

  setBossTheme(active) {
    if (this.isBossTheme === active) return;
    this.isBossTheme = active;
    this.updateTempo();
    if (this.unlocked) {
      this.startMusic();
    }
  }

  setStageTheme(stage) {
    if (this.stageTheme === stage) return;
    this.stageTheme = stage;
    this.updateTempo();
    if (this.unlocked) {
      this.startMusic();
    }
  }

  schedulerLoop() {
    if (!this.isPlayingMusic) return;
    
    // Safety guard: if nextNoteTime has fallen behind currentTime, sync up with a tiny future padding
    if (this.nextNoteTime < this.ctx.currentTime) {
      this.nextNoteTime = this.ctx.currentTime + 0.03;
    }
    
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
      this.scheduleNote(this.currentStep, this.nextNoteTime);
      this.advanceStep();
    }
    
    this.musicInterval = setTimeout(() => this.schedulerLoop(), this.lookahead);
  }

  advanceStep() {
    const secondsPerBeat = 60.0 / this.tempo;
    const stepDuration = secondsPerBeat / 4; // 16th notes
    
    this.nextNoteTime += stepDuration;
    this.currentStep = (this.currentStep + 1) % 16;
  }

  /**
   * Routinely directs the step to the appropriate stage/boss procedural synthesizer theme
   */
  scheduleNote(step, time) {
    const now = Math.max(time, this.ctx.currentTime + 0.015);
    const secondsPerBeat = 60.0 / this.tempo;
    const stepDuration = secondsPerBeat / 4;
    
    if (this.isBossTheme) {
      this.scheduleBossTheme(step, now, stepDuration);
    } else if (this.stageTheme === 0) {
      this.scheduleMainMenuTheme(step, now, stepDuration);
    } else if (this.stageTheme === 2) {
      this.scheduleStage2Theme(step, now, stepDuration);
    } else if (this.stageTheme === 3) {
      this.scheduleStage3Theme(step, now, stepDuration);
    } else {
      this.scheduleStage1Theme(step, now, stepDuration);
    }
  }

  /**
   * Main Menu Theme: "Void Horizon" (110 BPM)
   * Laid-back, ethereal synthwave in A-minor.
   */
  scheduleMainMenuTheme(step, now, stepDuration) {
    // 1. Soft slow chiptune kick on step 0 and 8
    if (step === 0 || step === 8) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.12);
      
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      
      osc.connect(gain);
      gain.connect(this.musicVolume);
      osc.start(now);
      osc.stop(now + 0.13);
    }
    
    // Very soft hi-hat on step 4 and 12
    if (step === 4 || step === 12) {
      const duration = 0.02;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(9500, now);
      
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.015, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicVolume);
      noise.start(now);
      noise.stop(now + duration);
    }

    // 2. Slow deep pulsing triangle bass
    if (step % 4 === 0) {
      const bassNotes = [33, 29, 24, 31]; // A1, F1, C1, G1
      const note = bassNotes[Math.floor(step / 4) % 4];
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(this.midiToFreq(note), now);
      
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + stepDuration * 3.5);
      
      osc.connect(gain);
      gain.connect(this.musicVolume);
      osc.start(now);
      osc.stop(now + stepDuration * 3.6);
    }

    // 3. Ambient arpeggiated retro square chord arpeggio
    if (step % 2 === 0) {
      const chords = [
        [60, 64, 67, 72], // Am
        [65, 69, 72, 77], // Fmaj
        [60, 64, 67, 72], // Cmaj
        [59, 62, 67, 74]  // Gmaj
      ];
      const chordIndex = Math.floor(step / 4) % 4;
      const notes = chords[chordIndex];
      const note = notes[Math.floor(step / 2) % 4];
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle'; // pleasant soft chiptune lead
      osc.frequency.setValueAtTime(this.midiToFreq(note), now);
      
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + stepDuration * 2.0);
      
      const panVal = Math.sin(now * 0.8) * 0.4;
      if (this.ctx.createStereoPanner) {
        const panner = this.ctx.createStereoPanner();
        panner.pan.setValueAtTime(panVal, now);
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.musicVolume);
      } else {
        osc.connect(gain);
        gain.connect(this.musicVolume);
      }
      
      osc.start(now);
      osc.stop(now + stepDuration * 2.1);
    }
  }

  /**
   * Stage 1 Theme: "Neon Sky-Line" (120 BPM)
   * Upbeat, futuristic neon city synth-pop in A-minor.
   */
  scheduleStage1Theme(step, now, stepDuration) {
    // 1. Synth-pop 4/4 drums
    // Kick Drum on steps 0, 4, 8, 12
    if (step % 4 === 0) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.1);
      
      gain.gain.setValueAtTime(0.45, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      
      osc.connect(gain);
      gain.connect(this.musicVolume);
      osc.start(now);
      osc.stop(now + 0.11);
    }
    
    // Snare Drum (Slightly noisy clap) on steps 4, 12
    if (step === 4 || step === 12) {
      const duration = 0.08;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1000, now);
      
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicVolume);
      
      noise.start(now);
      noise.stop(now + duration);
    }

    // Steady 8th-note Hi-hats with stereo auto-panning
    if (step % 2 === 0) {
      const duration = 0.025;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(9000, now);
      
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      
      // Auto-pan hi-hats back and forth
      const panVal = step % 4 === 0 ? -0.4 : 0.4;
      
      if (this.ctx.createStereoPanner) {
        const panner = this.ctx.createStereoPanner();
        panner.pan.setValueAtTime(panVal, now);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(panner);
        panner.connect(this.musicVolume);
      } else {
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicVolume);
      }
      
      noise.start(now);
      noise.stop(now + duration);
    }
    
    // 2. Upbeat Synth Bassline
    if (step % 2 === 0) {
      const bassIndex = Math.floor(step / 2) % 8;
      const note = this.bassNormal1[bassIndex];
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(this.midiToFreq(note), now);
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, now);
      
      gain.gain.setValueAtTime(0.26, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + stepDuration * 1.5);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicVolume);
      
      osc.start(now);
      osc.stop(now + stepDuration * 1.6);
    }
    
    // 3. Catchy Panned Synth-Pop Arpeggiator Lead
    const leadSteps = [0, 3, 6, 8, 11, 14];
    if (leadSteps.includes(step)) {
      const mIdx = (step + Math.floor(now * 1.5)) % this.melodyNormal1.length;
      const note = this.melodyNormal1[mIdx];
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(this.midiToFreq(note), now);
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1100, now);
      
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.002, now + stepDuration * 2.2);
      
      // Auto-pan lead sweeping back and forth
      const panVal = Math.sin(step * 0.5) * 0.5;
      
      if (this.ctx.createStereoPanner) {
        const panner = this.ctx.createStereoPanner();
        panner.pan.setValueAtTime(panVal, now);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(panner);
        panner.connect(this.musicVolume);
      } else {
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicVolume);
      }
      
      osc.start(now);
      osc.stop(now + stepDuration * 2.5);
    }
  }

  /**
   * Stage 2 Theme: "Bio-Canopy" (110 BPM)
   * Mystical, atmospheric forest chiptune in D-minor/F-major.
   */
  scheduleStage2Theme(step, now, stepDuration) {
    // 1. Sparse Organic Forest Drums
    // Soft sub-kick on steps 0, 10
    if (step === 0 || step === 10) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.15);
      
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      
      osc.connect(gain);
      gain.connect(this.musicVolume);
      osc.start(now);
      osc.stop(now + 0.16);
    }
    
    // Mossy woodblock snare on step 8 ONLY
    if (step === 8) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(700, now);
      osc.frequency.linearRampToValueAtTime(300, now + 0.06);
      
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
      
      osc.connect(gain);
      gain.connect(this.musicVolume);
      osc.start(now);
      osc.stop(now + 0.07);
    }

    // Sparse hi-hat zaps
    const hatSteps = [2, 4, 6, 10, 12, 14];
    if (hatSteps.includes(step)) {
      const duration = 0.035;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(8000, now);
      
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      
      // Pan forest hats left and right
      const panVal = step % 4 === 2 ? -0.5 : 0.5;
      if (this.ctx.createStereoPanner) {
        const panner = this.ctx.createStereoPanner();
        panner.pan.setValueAtTime(panVal, now);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(panner);
        panner.connect(this.musicVolume);
      } else {
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicVolume);
      }
      
      noise.start(now);
      noise.stop(now + duration);
    }
    
    // 2. Deep warm organic bassline
    if (step % 2 === 0) {
      const bassIndex = Math.floor(step / 2) % 8;
      const note = this.bassNormal2[bassIndex];
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle'; // Ethereal warm bass
      osc.frequency.setValueAtTime(this.midiToFreq(note), now);
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(140, now);
      
      gain.gain.setValueAtTime(0.36, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + stepDuration * 1.8);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicVolume);
      
      osc.start(now);
      osc.stop(now + stepDuration * 1.9);
    }
    
    // 3. Hollow square-wave woodwind lead arpeggiator with mystical LFO
    const leadSteps = [0, 3, 6, 8, 11, 14];
    if (leadSteps.includes(step)) {
      const mIdx = (step + Math.floor(now * 1.8)) % this.melodyNormal2.length;
      const note = this.melodyNormal2[mIdx];
      const freq = this.midiToFreq(note);
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, now);
      
      // 5Hz bio-spore pitch vibrato LFO
      const vibrato = this.ctx.createOscillator();
      vibrato.frequency.setValueAtTime(5, now);
      const vibratoGain = this.ctx.createGain();
      vibratoGain.gain.setValueAtTime(7, now);
      
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);
      
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.002, now + stepDuration * 2.4);
      
      // Auto-pan bio-flute drifting in space
      const panVal = Math.cos(step * 0.4) * 0.6;
      
      if (this.ctx.createStereoPanner) {
        const panner = this.ctx.createStereoPanner();
        panner.pan.setValueAtTime(panVal, now);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(panner);
        panner.connect(this.musicVolume);
      } else {
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicVolume);
      }
      
      vibrato.start(now);
      osc.start(now);
      vibrato.stop(now + stepDuration * 2.7);
      osc.stop(now + stepDuration * 2.7);
    }
  }

  /**
   * Stage 3 Theme: "Void Colossus Fortress" (140 BPM)
   * High-energy, industrial metal FM-synthesis chiptune in E-Phrygian.
   */
  scheduleStage3Theme(step, now, stepDuration) {
    // 1. Heavy military industrial metal drums
    // Double kick syncopation
    if (step === 0 || step === 2 || step === 8 || step === 10) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.1);
      
      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      
      osc.connect(gain);
      gain.connect(this.musicVolume);
      osc.start(now);
      osc.stop(now + 0.11);
    }
    
    // Heavy gated noise snare on steps 4, 12
    if (step === 4 || step === 12) {
      const duration = 0.14;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1100, now);
      
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.setValueAtTime(0.24, now + 0.05); // Gate hold
      gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicVolume);
      
      noise.start(now);
      noise.stop(now + duration);
    }

    // Double-time 16th hats
    if (step % 1 === 0) {
      const duration = 0.03;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(9200, now);
      
      const gain = this.ctx.createGain();
      const vol = (step % 4 === 0) ? 0.065 : ((step % 2 === 0) ? 0.035 : 0.015);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicVolume);
      
      noise.start(now);
      noise.stop(now + duration);
    }
    
    // 2. Gritty, pumping FM-style sawtooth bassline
    if (step % 2 === 0) {
      const bassIndex = Math.floor(step / 2) % 8;
      const note = this.bassNormal3[bassIndex];
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(this.midiToFreq(note), now);
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350, now);
      filter.frequency.exponentialRampToValueAtTime(80, now + stepDuration * 1.5);
      
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + stepDuration * 1.8);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicVolume);
      
      osc.start(now);
      osc.stop(now + stepDuration * 1.9);
    }
    
    // 3. Screaming Detuned FM Metal Lead (Wide Stereo Chorus!)
    const leadSteps = [0, 2, 4, 6, 8, 10, 12, 14];
    if (leadSteps.includes(step)) {
      const mIdx = (step + Math.floor(now * 3)) % this.melodyNormal3.length;
      const note = this.melodyNormal3[mIdx];
      const freq = this.midiToFreq(note);
      
      // Detuned double FM starship voice
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      
      const gain1 = this.ctx.createGain();
      const gain2 = this.ctx.createGain();
      
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freq, now);
      osc1.detune.setValueAtTime(-14, now); // Detune left
      
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(freq, now);
      osc2.detune.setValueAtTime(14, now); // Detune right
      
      const filter1 = this.ctx.createBiquadFilter();
      filter1.type = 'lowpass';
      filter1.Q.setValueAtTime(9.0, now);
      filter1.frequency.setValueAtTime(2400, now);
      filter1.frequency.exponentialRampToValueAtTime(550, now + stepDuration * 2.2);
      
      const filter2 = this.ctx.createBiquadFilter();
      filter2.type = 'lowpass';
      filter2.Q.setValueAtTime(9.0, now);
      filter2.frequency.setValueAtTime(2400, now);
      filter2.frequency.exponentialRampToValueAtTime(550, now + stepDuration * 2.2);
      
      gain1.gain.setValueAtTime(0.05, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + stepDuration * 2.3);
      
      gain2.gain.setValueAtTime(0.05, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + stepDuration * 2.3);
      
      // Pan osc1 left and osc2 right for epic wide stereo chorusing!
      if (this.ctx.createStereoPanner) {
        const panner1 = this.ctx.createStereoPanner();
        const panner2 = this.ctx.createStereoPanner();
        panner1.pan.setValueAtTime(-0.6, now);
        panner2.pan.setValueAtTime(0.6, now);
        
        osc1.connect(filter1);
        filter1.connect(gain1);
        gain1.connect(panner1);
        panner1.connect(this.musicVolume);
        
        osc2.connect(filter2);
        filter2.connect(gain2);
        gain2.connect(panner2);
        panner2.connect(this.musicVolume);
      } else {
        osc1.connect(filter1);
        filter1.connect(gain1);
        gain1.connect(this.musicVolume);
        
        osc2.connect(filter2);
        filter2.connect(gain2);
        gain2.connect(this.musicVolume);
      }
      
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + stepDuration * 2.4);
      osc2.stop(now + stepDuration * 2.4);
    }
  }

  /**
   * Boss Theme: "Void Colossus Core" (160 BPM)
   * Adrenaline-fueled hyper-speed battle theme with alternating panning leads.
   */
  scheduleBossTheme(step, now, stepDuration) {
    // 1. Frantic double-kick retro drum shuffle
    const kickSteps = [0, 2, 4, 6, 8, 10, 12, 14];
    if (kickSteps.includes(step)) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(155, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.08);
      
      gain.gain.setValueAtTime(0.48, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      
      osc.connect(gain);
      gain.connect(this.musicVolume);
      osc.start(now);
      osc.stop(now + 0.09);
    }
    
    // Snare Drum (Backbeat + ghost rolls)
    const snareSteps = [4, 6, 12, 14];
    if (snareSteps.includes(step)) {
      const isGhost = (step === 6 || step === 14);
      const duration = isGhost ? 0.04 : 0.09;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1300, now);
      
      const gain = this.ctx.createGain();
      const vol = isGhost ? 0.065 : 0.22;
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicVolume);
      
      noise.start(now);
      noise.stop(now + duration);
    }

    // High sizzle hats
    if (step % 2 === 1) {
      const duration = 0.035;
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(9500, now);
      
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.045, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicVolume);
      
      noise.start(now);
      noise.stop(now + duration);
    }
    
    // 2. Rapid double-time pumping square-wave bass
    const bassSteps = [0, 2, 4, 6, 8, 10, 12, 14, 15];
    if (bassSteps.includes(step)) {
      const bassIndex = Math.floor(step / 2) % 8;
      let midiNotes = this.bassBoss1;
      if (this.stageTheme === 2) {
        midiNotes = this.bassBoss2;
      } else if (this.stageTheme === 3) {
        midiNotes = this.bassBoss3;
      }
      const note = midiNotes[bassIndex];
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(this.midiToFreq(note), now);
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(250, now);
      
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + stepDuration * 1.4);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicVolume);
      
      osc.start(now);
      osc.stop(now + stepDuration * 1.5);
    }
    
    // 3. Overlapping rapid arpeggiator with detuned double square chorus (Simulated PWM)
    const melody = this.stageTheme === 2 ? this.melodyBoss2 : (this.stageTheme === 3 ? this.melodyBoss3 : this.melodyBoss1);
    const mIdx = (step + Math.floor(now * 4)) % melody.length;
    const note = melody[mIdx];
    const freq = this.midiToFreq(note);
    
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(freq, now);
    osc1.detune.setValueAtTime(-12, now); // Detune left
    
    osc2.type = 'square';
    osc2.frequency.setValueAtTime(freq, now);
    osc2.detune.setValueAtTime(12, now); // Detune right
    
    // Sweeping highpass filter for intense battle dynamic
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(1500, now + stepDuration * 1.8);
    
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + stepDuration * 1.8);
    
    // Hard alternating panning left/right per step for hyper-urgent effect!
    const panVal = step % 2 === 0 ? -0.8 : 0.8;
    
    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(panVal, now);
      
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(panner);
      panner.connect(this.musicVolume);
    } else {
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicVolume);
    }
    
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + stepDuration * 1.9);
    osc2.stop(now + stepDuration * 1.9);
  }
}

// Singleton instantiation
const audioSystem = new AudioSystem();
export default audioSystem;
