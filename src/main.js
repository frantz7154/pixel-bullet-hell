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
  
  // Initialize selected ship and stage on the game object with safe literal defaults for dynamic hangar rendering
  game.selectedMenuShip = 'vanguard';
  game.selectedMenuStage = 1;
  
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
  
  const SHIPS = ['vanguard', 'aegis', 'sentinel'];
  let shipIndex = 0;
  let activeMenuScreen = 'main'; // 'main', 'shipselect', 'options'

  // Sub-states Binds
  const mainMenuSub = document.getElementById('mainMenuSub');
  const shipSelectSub = document.getElementById('shipSelectSub');
  const optionsSub = document.getElementById('optionsSub');
  const startScreen = document.getElementById('startScreen');

  // Starship profiles statistics
  const SHIP_DETAILS = {
    vanguard: {
      name: 'VANGUARD',
      class: 'STRIKER CLASS',
      desc: 'High velocity, front-firing tactical plasma beam.',
      stats: { spd: 80, atk: 90, def: 40 },
      color: '#00ffff'
    },
    aegis: {
      name: 'AEGIS',
      class: 'BULWARK CLASS',
      desc: 'Heavy armor. Generates an orbital energy shield that defuses bullets.',
      stats: { spd: 40, atk: 50, def: 100 },
      color: '#bd00ff'
    },
    sentinel: {
      name: 'SENTINEL',
      class: 'QUANTUM CLASS',
      desc: 'Agile fighter. Commands autonomous auto-targeting lightning sub-drones.',
      stats: { spd: 90, atk: 60, def: 60 },
      color: '#ff2d55'
    }
  };

  // UI state manager
  function setMenuScreen(screen) {
    activeMenuScreen = screen;
    mainMenuSub.classList.add('hidden');
    shipSelectSub.classList.add('hidden');
    optionsSub.classList.add('hidden');

    if (screen === 'main') {
      mainMenuSub.classList.remove('hidden');
      menuRow = 0; // Focus LAUNCH MISSION
    } else if (screen === 'shipselect') {
      shipSelectSub.classList.remove('hidden');
      updateShipSelectUI();
      menuRow = 0; // Focus LAUNCH STARSHIP
    } else if (screen === 'options') {
      optionsSub.classList.remove('hidden');
      menuRow = 0; // Focus Master volume slider
    }
    updateMenuFocus();
  }

  // Dynamic details progress bars
  function updateShipSelectUI() {
    const details = SHIP_DETAILS[selectedShip];
    if (!details) return;

    const detailsName = document.getElementById('detailsName');
    detailsName.innerText = details.name;
    detailsName.style.color = details.color;
    detailsName.style.textShadow = `0 0 10px ${details.color}`;
    
    document.getElementById('detailsClass').innerText = details.class;
    document.getElementById('detailsDesc').innerText = details.desc;
    
    const barSPD = document.getElementById('barSPD');
    barSPD.style.width = `${details.stats.spd}%`;
    barSPD.style.background = details.color;
    barSPD.style.boxShadow = `0 0 8px ${details.color}`;

    const barATK = document.getElementById('barATK');
    barATK.style.width = `${details.stats.atk}%`;
    barATK.style.background = details.color;
    barATK.style.boxShadow = `0 0 8px ${details.color}`;

    const barDEF = document.getElementById('barDEF');
    barDEF.style.width = `${details.stats.def}%`;
    barDEF.style.background = details.color;
    barDEF.style.boxShadow = `0 0 8px ${details.color}`;
  }

  // starship rotator
  function rotateShip(dir) {
    if (dir === 'left') {
      shipIndex = (shipIndex - 1 + SHIPS.length) % SHIPS.length;
    } else {
      shipIndex = (shipIndex + 1) % SHIPS.length;
    }
    selectedShip = SHIPS[shipIndex];
    game.selectedMenuShip = selectedShip;
    updateShipSelectUI();
    audioSystem.init();
    audioSystem.playLaser();
  }

  // --- Keyboard-Driven Menu Navigation State ---
  let menuRow = 0;

  const btnGoToShipSelect = document.getElementById('btnGoToShipSelect');
  const btnGoToOptions = document.getElementById('btnGoToOptions');
  const btnPrevShip = document.getElementById('btnPrevShip');
  const btnNextShip = document.getElementById('btnNextShip');
  const btnBackToMenu = document.getElementById('btnBackToMenu');
  const btnLaunchShip = document.getElementById('btnLaunchShip');
  const btnOptionsBack = document.getElementById('btnOptionsBack');

  function updateMenuFocus() {
    // Clear all outlines
    [btnGoToShipSelect, btnGoToOptions, btnPrevShip, btnNextShip, btnBackToMenu, btnLaunchShip, btnOptionsBack].forEach(b => {
      if (b) b.classList.remove('focused');
    });
    
    // Sliders focus clear
    const sliders = [sliderMaster, sliderMusic, sliderSFX];
    sliders.forEach(s => {
      if (s) s.parentElement.classList.remove('focused-group');
    });

    if (activeMenuScreen === 'main') {
      if (menuRow === 0) btnGoToShipSelect.classList.add('focused');
      else if (menuRow === 1) btnGoToOptions.classList.add('focused');
    } else if (activeMenuScreen === 'shipselect') {
      if (menuRow === 0) btnLaunchShip.classList.add('focused');
      else if (menuRow === 1) btnBackToMenu.classList.add('focused');
    } else if (activeMenuScreen === 'options') {
      if (menuRow === 0) sliderMaster.parentElement.classList.add('focused-group');
      else if (menuRow === 1) sliderMusic.parentElement.classList.add('focused-group');
      else if (menuRow === 2) sliderSFX.parentElement.classList.add('focused-group');
      else if (menuRow === 3) btnOptionsBack.classList.add('focused');
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
 
      if (activeMenuScreen === 'main') {
        if (k === 'w' || k === 'arrowup') {
          if (menuRow > 0) { menuRow--; changed = true; }
        } else if (k === 's' || k === 'arrowdown') {
          if (menuRow < 1) { menuRow++; changed = true; }
        } else if (k === ' ' || k === 'enter') {
          audioSystem.init();
          audioSystem.playShieldHit();
          if (menuRow === 0) {
            setMenuScreen('shipselect');
          } else if (menuRow === 1) {
            setMenuScreen('options');
          }
        }
      } else if (activeMenuScreen === 'shipselect') {
        if (k === 'a' || k === 'arrowleft') {
          rotateShip('left');
        } else if (k === 'd' || k === 'arrowright') {
          rotateShip('right');
        } else if (k === 'w' || k === 'arrowup') {
          if (menuRow > 0) { menuRow--; changed = true; }
        } else if (k === 's' || k === 'arrowdown') {
          if (menuRow < 1) { menuRow++; changed = true; }
        } else if (k === ' ' || k === 'enter') {
          audioSystem.init();
          audioSystem.playShieldHit();
          if (menuRow === 0) {
            startScreen.classList.add('hidden');
            game.start(selectedShip, 1); // Start Stage 1 immediately
          } else if (menuRow === 1) {
            setMenuScreen('main');
          }
        }
      } else if (activeMenuScreen === 'options') {
        if (k === 'w' || k === 'arrowup') {
          if (menuRow > 0) { menuRow--; changed = true; }
        } else if (k === 's' || k === 'arrowdown') {
          if (menuRow < 3) { menuRow++; changed = true; }
        } else if (k === 'a' || k === 'arrowleft') {
          if (menuRow === 0) { sliderMaster.value = Math.max(0, parseInt(sliderMaster.value) - 5); sliderMaster.dispatchEvent(new Event('input')); }
          else if (menuRow === 1) { sliderMusic.value = Math.max(0, parseInt(sliderMusic.value) - 5); sliderMusic.dispatchEvent(new Event('input')); }
          else if (menuRow === 2) { sliderSFX.value = Math.max(0, parseInt(sliderSFX.value) - 5); sliderSFX.dispatchEvent(new Event('input')); }
        } else if (k === 'd' || k === 'arrowright') {
          if (menuRow === 0) { sliderMaster.value = Math.min(100, parseInt(sliderMaster.value) + 5); sliderMaster.dispatchEvent(new Event('input')); }
          else if (menuRow === 1) { sliderMusic.value = Math.min(100, parseInt(sliderMusic.value) + 5); sliderMusic.dispatchEvent(new Event('input')); }
          else if (menuRow === 2) { sliderSFX.value = Math.min(100, parseInt(sliderSFX.value) + 5); sliderSFX.dispatchEvent(new Event('input')); }
        } else if (k === ' ' || k === 'enter') {
          if (menuRow === 3) {
            audioSystem.init();
            audioSystem.playShieldHit();
            setMenuScreen('main');
          }
        }
      }
 
      if (changed) {
        updateMenuFocus();
        audioSystem.init();
        audioSystem.playShieldHit();
      }
      return;
    }

    // 3. Normal Gameplay Keys
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

  // Mouse Click Event Bindings
  if (btnGoToShipSelect) btnGoToShipSelect.addEventListener('click', () => setMenuScreen('shipselect'));
  if (btnGoToOptions) btnGoToOptions.addEventListener('click', () => setMenuScreen('options'));
  if (btnOptionsBack) btnOptionsBack.addEventListener('click', () => setMenuScreen('main'));
  if (btnBackToMenu) btnBackToMenu.addEventListener('click', () => setMenuScreen('main'));
  
  if (btnPrevShip) btnPrevShip.addEventListener('click', () => rotateShip('left'));
  if (btnNextShip) btnNextShip.addEventListener('click', () => rotateShip('right'));
  
  if (btnLaunchShip) btnLaunchShip.addEventListener('click', () => {
    audioSystem.init();
    startScreen.classList.add('hidden');
    game.start(selectedShip, 1); // Start Stage 1 directly
  });

  const btnRetry = document.getElementById('btnRetry');
  const gameOverScreen = document.getElementById('gameOverScreen');
  
  btnRetry.addEventListener('click', () => {
    audioSystem.init();
    gameOverScreen.classList.add('hidden');
    game.start(selectedShip, 1); // Start Stage 1 on retry
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
