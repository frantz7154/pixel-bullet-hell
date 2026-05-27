/**
 * main.js - Application Bootstrapper & Interaction Bindings
 * Sets up full-viewport Canvas layers, input tracking, procedural
 * selection previews, and high-frequency animation loop scheduling.
 */
import { Game } from './game/Game.js';
import audioSystem from './game/AudioSystem.js';
import spriteLoader from './game/SpriteLoader.js';

// Procedural ship renderers for card selections (drawn on miniature canvases)
const PREVIEW_SPRITES = {
  vanguard: [
    [0, 0, 0, 3, 3, 0, 0, 0],
    [0, 0, 1, 3, 3, 1, 0, 0],
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 2, 2, 1, 1, 0],
    [0, 1, 2, 2, 2, 2, 1, 0],
    [1, 1, 2, 2, 2, 2, 1, 1],
    [1, 2, 0, 1, 1, 0, 2, 1],
    [1, 0, 0, 0, 0, 0, 0, 1]
  ],
  aegis: [
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 1, 3, 3, 1, 1, 0],
    [1, 1, 2, 2, 2, 2, 1, 1],
    [1, 2, 2, 2, 2, 2, 2, 1],
    [1, 2, 2, 2, 2, 2, 2, 1],
    [1, 1, 2, 2, 2, 2, 1, 1],
    [0, 1, 1, 1, 1, 1, 1, 0],
    [0, 0, 1, 0, 0, 1, 0, 0]
  ],
  sentinel: [
    [0, 0, 1, 0, 0, 1, 0, 0],
    [0, 1, 1, 0, 0, 1, 1, 0],
    [1, 1, 3, 0, 0, 3, 1, 1],
    [1, 2, 1, 1, 1, 1, 2, 1],
    [1, 2, 2, 2, 2, 2, 2, 1],
    [0, 1, 2, 2, 2, 2, 1, 0],
    [0, 0, 1, 2, 2, 1, 0, 0],
    [0, 1, 0, 0, 0, 0, 1, 0]
  ]
};

const THEMES = {
  vanguard: { primary: '#00ffff', secondary: '#ff2d55' },
  aegis: { primary: '#bd00ff', secondary: '#00ffff' },
  sentinel: { primary: '#ff2d55', secondary: '#fff01f' }
};

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  
  // Preload all 15 sprite art & background assets on startup
  spriteLoader.preload(
    (progress) => {
      console.log(`SpriteLoader: Loading assets... ${Math.round(progress * 100)}%`);
    },
    () => {
      console.log("SpriteLoader: All assets preloaded and chroma-keyed successfully.");
      // Redraw ship selection previews using premium pixel-art sprites
      drawShipPreviews();
    }
  );

  const game = new Game(canvas);
  
  // Set fixed virtual 16:9 widescreen retro resolution (upscaled via CSS for big, chunky pixel detail!)
  function resizeCanvas() {
    canvas.width = 854;
    canvas.height = 480;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Draw procedural miniatures on ship-selection panels
  drawShipPreviews();

  // --- Retro Audio Controls Binding & Synchronization ---
  const audioStatusText = document.getElementById('audioStatusText');
  const btnForceAudio = document.getElementById('btnForceAudio');
  
  const sliderMaster = document.getElementById('sliderMaster');
  const sliderMusic = document.getElementById('sliderMusic');
  const sliderSFX = document.getElementById('sliderSFX');
  
  const valMaster = document.getElementById('valMaster');
  const valMusic = document.getElementById('valMusic');
  const valSFX = document.getElementById('valSFX');
  
  const sliderMasterPause = document.getElementById('sliderMasterPause');
  const sliderMusicPause = document.getElementById('sliderMusicPause');
  const sliderSFXPause = document.getElementById('sliderSFXPause');
  
  const valMasterPause = document.getElementById('valMasterPause');
  const valMusicPause = document.getElementById('valMusicPause');
  const valSFXPause = document.getElementById('valSFXPause');

  function updateAudioUI() {
    if (!audioStatusText || !btnForceAudio) return;
    
    const state = audioSystem.getState();
    if (state === 'uninitialized') {
      audioStatusText.innerText = '[ OFFLINE 🔇 ]';
      audioStatusText.className = 'font-retro text-glow-red';
      btnForceAudio.innerText = 'ENGAGE SYNTHS 🔊';
      btnForceAudio.classList.remove('active');
    } else if (state === 'suspended') {
      audioStatusText.innerText = '[ SUSPENDED ⚠️ ]';
      audioStatusText.className = 'font-retro text-glow-yellow';
      btnForceAudio.innerText = 'RESUME AUDIO 🔊';
      btnForceAudio.classList.add('active');
    } else if (state === 'running') {
      audioStatusText.innerText = '[ ACTIVE 🔊 ]';
      audioStatusText.className = 'font-retro text-glow-green';
      btnForceAudio.innerText = 'AUDIO ONLINE ✅';
      btnForceAudio.classList.add('active');
    }
  }

  // Bind Start Screen Sliders
  if (sliderMaster) {
    sliderMaster.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) / 100;
      audioSystem.setMasterVolume(val);
      if (valMaster) valMaster.innerText = `${e.target.value}%`;
      if (sliderMasterPause) sliderMasterPause.value = e.target.value;
      if (valMasterPause) valMasterPause.innerText = `${e.target.value}%`;
    });
  }
  if (sliderMusic) {
    sliderMusic.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) / 100;
      audioSystem.setMusicVolume(val);
      if (valMusic) valMusic.innerText = `${e.target.value}%`;
      if (sliderMusicPause) sliderMusicPause.value = e.target.value;
      if (valMusicPause) valMusicPause.innerText = `${e.target.value}%`;
    });
  }
  if (sliderSFX) {
    sliderSFX.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) / 100;
      audioSystem.setSFXVolume(val);
      if (valSFX) valSFX.innerText = `${e.target.value}%`;
      if (sliderSFXPause) sliderSFXPause.value = e.target.value;
      if (valSFXPause) valSFXPause.innerText = `${e.target.value}%`;
    });
  }

  // Bind Pause Screen Sliders
  if (sliderMasterPause) {
    sliderMasterPause.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) / 100;
      audioSystem.setMasterVolume(val);
      if (valMasterPause) valMasterPause.innerText = `${e.target.value}%`;
      if (sliderMaster) sliderMaster.value = e.target.value;
      if (valMaster) valMaster.innerText = `${e.target.value}%`;
    });
  }
  if (sliderMusicPause) {
    sliderMusicPause.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) / 100;
      audioSystem.setMusicVolume(val);
      if (valMusicPause) valMusicPause.innerText = `${e.target.value}%`;
      if (sliderMusic) sliderMusic.value = e.target.value;
      if (valMusic) valMusic.innerText = `${e.target.value}%`;
    });
  }
  if (sliderSFXPause) {
    sliderSFXPause.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) / 100;
      audioSystem.setSFXVolume(val);
      if (valSFXPause) valSFXPause.innerText = `${e.target.value}%`;
      if (sliderSFX) sliderSFX.value = e.target.value;
      if (valSFX) valSFX.innerText = `${e.target.value}%`;
    });
  }

  // Force Resume Button click handler
  if (btnForceAudio) {
    btnForceAudio.addEventListener('click', () => {
      audioSystem.init();
      audioSystem.resume().then(() => {
        updateAudioUI();
        // Synthesize a quick shield hit as audible confirmation
        audioSystem.playShieldHit();
      });
    });
  }

  // Periodically check and update Audio State to reflect browser status
  setInterval(updateAudioUI, 1000);
  updateAudioUI();

  // Global auto-unlock handlers for bulletproof browser audio activation
  const autoUnlockAudio = () => {
    if (audioSystem.getState() !== 'running') {
      audioSystem.init();
      audioSystem.resume().then(() => {
        updateAudioUI();
        // If start screen is visible and game not started, play menu chiptune!
        if (startScreen && !startScreen.classList.contains('hidden') && !game.isPlaying) {
          audioSystem.setStageTheme(0);
          audioSystem.startMusic();
        }
      });
    }
  };
  window.addEventListener('click', autoUnlockAudio, { once: true });
  window.addEventListener('keydown', autoUnlockAudio, { once: true });
  window.addEventListener('mousedown', autoUnlockAudio, { once: true });
  window.addEventListener('touchstart', autoUnlockAudio, { once: true });

  // Inputs Tracking State
  const keys = {};
  let selectedShip = 'vanguard';
  let selectedStage = 1;

  // --- Keyboard-Driven Menu Navigation State ---
  let menuRow = 0;
  let menuCol = 0;

  const shipNodes = Array.from(document.querySelectorAll('.ship-card'));
  const stageNodes = Array.from(document.querySelectorAll('.stage-card'));
  const launchBtn = document.getElementById('btnStart');

  function updateMenuFocus() {
    shipNodes.forEach(n => n.classList.remove('focused'));
    stageNodes.forEach(n => n.classList.remove('focused'));
    if (launchBtn) launchBtn.classList.remove('focused');

    if (menuRow === 0) {
      if (shipNodes[menuCol]) shipNodes[menuCol].classList.add('focused');
    } else if (menuRow === 1) {
      if (stageNodes[menuCol]) stageNodes[menuCol].classList.add('focused');
    } else if (menuRow === 2) {
      if (launchBtn) launchBtn.classList.add('focused');
    }
  }

  // Set initial focus
  updateMenuFocus();

  // Event Listeners for Keyboard
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    keys[k] = true;
    
    // 1. Level-Up Keyboard Navigation (Move via A/D or Arrow keys, select via Space/Enter)
    if (game.isPaused && game.dom.levelUpScreen && !game.dom.levelUpScreen.classList.contains('hidden')) {
      if (['arrowleft', 'arrowright', ' ', 'enter', 'a', 'd'].includes(k)) {
        e.preventDefault();
        game.handleUpgradeInput(e.key);
      }
      return;
    }
    
    // 2. Menu Keyboard Navigation (Only if start screen menu is active!)
    if (startScreen && !startScreen.classList.contains('hidden')) {
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'enter', 'w', 'a', 's', 'd'].includes(k)) {
        e.preventDefault();
      }

      let changed = false;

      if (k === 'w' || k === 'arrowup') {
        if (menuRow > 0) {
          menuRow--;
          changed = true;
        }
      } else if (k === 's' || k === 'arrowdown') {
        if (menuRow < 2) {
          menuRow++;
          changed = true;
        }
      } else if (k === 'a' || k === 'arrowleft') {
        if (menuRow < 2 && menuCol > 0) {
          menuCol--;
          changed = true;
        }
      } else if (k === 'd' || k === 'arrowright') {
        if (menuRow < 2 && menuCol < 2) {
          menuCol++;
          changed = true;
        }
      } else if (k === ' ' || k === 'enter') {
        if (menuRow === 0) {
          shipNodes.forEach(c => c.classList.remove('active'));
          const activeCard = shipNodes[menuCol];
          if (activeCard) {
            activeCard.classList.add('active');
            selectedShip = activeCard.dataset.ship;
            audioSystem.init();
            audioSystem.playLaser();
          }
        } else if (menuRow === 1) {
          stageNodes.forEach(c => c.classList.remove('active'));
          const activeCard = stageNodes[menuCol];
          if (activeCard) {
            activeCard.classList.add('active');
            selectedStage = parseInt(activeCard.dataset.stage);
            audioSystem.init();
            audioSystem.playShieldHit();
          }
        } else if (menuRow === 2) {
          audioSystem.init();
          startScreen.classList.add('hidden');
          game.start(selectedShip, selectedStage);
        }
      }

      if (changed) {
        updateMenuFocus();
        audioSystem.init();
        audioSystem.playShieldHit();
      }
      return;
    }

    // 2. Normal Gameplay Keys
    if (e.key === ' ') {
      e.preventDefault();
    }
    
    // Shift or B fires bomb
    if (k === 'shift' || k === 'b') {
      e.preventDefault();
      if (game.isPlaying && !game.isPaused && !game.isGameOver) {
        game.player.deployVoidBomb(game.bullets);
      }
    }
    
    // Escape key toggles pause
    if (e.key === 'Escape') {
      togglePause();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });



  // Disable context menu on canvas for smooth right clicks
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // UI Selection Handles - Ships
  const shipCards = document.querySelectorAll('.ship-card');
  shipCards.forEach((card, idx) => {
    card.addEventListener('click', () => {
      shipCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      selectedShip = card.dataset.ship;
      // Sync keyboard focus index
      menuRow = 0;
      menuCol = idx;
      updateMenuFocus();
      audioSystem.init();
      audioSystem.playLaser();
    });
  });

  // UI Selection Handles - Stages
  const stageCards = document.querySelectorAll('.stage-card');
  stageCards.forEach((card, idx) => {
    card.addEventListener('click', () => {
      stageCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      selectedStage = parseInt(card.dataset.stage);
      // Sync keyboard focus index
      menuRow = 1;
      menuCol = idx;
      updateMenuFocus();
      audioSystem.init();
      audioSystem.playShieldHit();
    });
  });

  // Button Hooks
  const btnStart = document.getElementById('btnStart');
  const startScreen = document.getElementById('startScreen');
  
  btnStart.addEventListener('click', () => {
    audioSystem.init();
    startScreen.classList.add('hidden');
    game.start(selectedShip, selectedStage);
  });

  const btnRetry = document.getElementById('btnRetry');
  const gameOverScreen = document.getElementById('gameOverScreen');
  
  btnRetry.addEventListener('click', () => {
    audioSystem.init();
    gameOverScreen.classList.add('hidden');
    game.start(selectedShip, selectedStage);
  });

  const btnResume = document.getElementById('btnResume');
  const pauseScreen = document.getElementById('pauseScreen');
  
  btnResume.addEventListener('click', () => {
    togglePause();
  });

  function togglePause() {
    if (!game.isPlaying || game.isGameOver) return;
    
    game.isPaused = !game.isPaused;
    if (game.isPaused) {
      pauseScreen.classList.remove('hidden');
      audioSystem.stopMusic();
    } else {
      pauseScreen.classList.add('hidden');
      audioSystem.resume();
      audioSystem.startMusic();
    }
  }

  /**
   * High performance continuous loop
   */
  function loop() {
    game.update(keys, 0, 0, keys[' ']);
    game.draw();
    requestAnimationFrame(loop);
  }
  
  // Kick off frame loop
  requestAnimationFrame(loop);

  /**
   * Draws procedural pixel representations directly into card elements
   */
  function drawShipPreviews() {
    ['vanguard', 'aegis', 'sentinel'].forEach(ship => {
      const container = document.getElementById(`${ship}Preview`);
      if (!container) return;
      
      let prevCanvas = container.querySelector('canvas');
      if (!prevCanvas) {
        prevCanvas = document.createElement('canvas');
        prevCanvas.width = 48;
        prevCanvas.height = 48;
        prevCanvas.style.display = 'block';
        container.appendChild(prevCanvas);
      }
      
      const pctx = prevCanvas.getContext('2d');
      pctx.clearRect(0, 0, 48, 48);
      
      const img = spriteLoader.get(ship);
      if (img) {
        // Draw the preloaded transparent pixel-art ship centered and scaled (40x40 inside 48x48)
        pctx.drawImage(img, 4, 4, 40, 40);
      } else {
        // Fallback to procedural grid
        const matrix = PREVIEW_SPRITES[ship];
        const theme = THEMES[ship];
        const pixelSize = 6; // 8x8 sprite at 48x48
        
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const val = matrix[r][c];
            if (val === 0) continue;
            
            if (val === 1) pctx.fillStyle = theme.primary;
            else if (val === 2) pctx.fillStyle = theme.secondary;
            else if (val === 3) pctx.fillStyle = '#ffffff';
            
            pctx.fillRect(c * pixelSize, r * pixelSize, pixelSize, pixelSize);
          }
        }
      }
    });
  }
});
