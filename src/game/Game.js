/**
 * Game.js - Core Game Loop and State Orchestrator
 * Manages wave scheduling, circle-based collisions, HUD DOM synchronisations,
 * roguelike upgrade selections, and CRT interface transitions.
 */
import { Player } from './Player.js';
import { Enemy, XPGem, HealthPack, PowerUp } from './Enemy.js';
import { ParticleFactory, camera } from './Particle.js';
import { UpgradeSystem } from './UpgradeSystem.js';
import audioSystem from './AudioSystem.js';
import spriteLoader from './SpriteLoader.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Entities
    this.player = null;
    this.enemies = [];
    this.bullets = [];
    this.xpGems = [];
    this.healthPacks = [];
    this.powerUps = [];
    
    // State
    this.isGameOver = false;
    this.isPaused = false;
    this.isPlaying = false;
    this.score = 0;
    
    this.wave = 1;
    this.waveInProgress = false;
    this.waveIntermission = false;
    this.intermissionEndTime = 0;
    this.enemiesKilled = 0;
    this.stage = 1;
    this.isTransitioningStage = false;
    
    // High Score tracking
    this.highScore = parseInt(localStorage.getItem('void_shift_high_score')) || 0;
    
    // Cached DOM binds
    this.dom = {
      hud: document.getElementById('hud'),
      score: document.getElementById('scoreVal'),
      wave: document.getElementById('waveVal'),
      highScore: document.getElementById('highScoreVal'),
      hpFill: document.getElementById('hpFill'),
      hpText: document.getElementById('hpText'),
      shieldFill: document.getElementById('shieldFill'),
      shieldText: document.getElementById('shieldText'),
      superFill: document.getElementById('superFill'),
      superText: document.getElementById('superText'),
      bombsRow: document.getElementById('bombsRow'),
      xpFill: document.getElementById('xpFill'),
      xpText: document.getElementById('xpText'),
      superFill: document.getElementById('superFill'),
      superText: document.getElementById('superText'),
      bossAlarm: document.getElementById('bossAlarm'),
      levelUpScreen: document.getElementById('levelUpScreen'),
      upgradeCards: document.getElementById('upgradeCards'),
      gameOverScreen: document.getElementById('gameOverScreen'),
      gameOverTitle: document.getElementById('gameOverTitle'),
      gameOverSubtitle: document.getElementById('gameOverSubtitle'),
      finalScore: document.getElementById('finalScoreVal'),
      finalWave: document.getElementById('finalWaveVal'),
      finalEnemies: document.getElementById('finalEnemiesVal')
    };
  }

  /**
   * Resets all game states and starts a fresh mission
   */
  start(shipType, startingStage = 1) {
    this.isPlaying = true;
    this.isGameOver = false;
    this.isPaused = false;
    
    this.stage = startingStage;
    this.isTransitioningStage = false;
    this.transitionEndTime = 0;

    this.bgScroll = 0;
    this.stageOverlays = [];
    this.lastOverlaySpawnTime = 0;

    this.wave = 1;
    this.waveInProgress = false;
    this.waveIntermission = false;
    this.enemiesKilled = 0;
    this.score = 0;
    
    this.enemies = [];
    this.bullets = [];
    this.xpGems = [];
    this.healthPacks = [];
    this.powerUps = [];
    ParticleFactory.clear();
    
    // Generate background elements once
    this.stars = [];
    for (let i = 0; i < 80; i++) {
      this.stars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        speed: 0.15 + Math.random() * 0.45,
        size: 0.8 + Math.random() * 1.5,
        twinkleSpeed: 0.005 + Math.random() * 0.015,
        color: Math.random() > 0.4 ? '#00ffff' : '#ff2d55'
      });
    }
    
    this.binaryStreams = [];
    const cols = Math.floor(this.canvas.width / 40);
    for (let i = 0; i < cols; i++) {
      this.binaryStreams.push({
        x: i * 40 + 15,
        y: Math.random() * -this.canvas.height,
        speed: 1.2 + Math.random() * 2.2,
        chars: Array.from({length: 12}, () => Math.random() > 0.5 ? '1' : '0')
      });
    }
    
    this.embers = [];
    for (let i = 0; i < 35; i++) {
      this.embers.push({
        angle: Math.random() * Math.PI * 2,
        radius: 65 + Math.random() * 160,
        speed: 0.0006 + Math.random() * 0.0012,
        size: 1.5 + Math.random() * 2.5,
        color: Math.random() > 0.4 ? '#ff5500' : '#fff01f'
      });
    }
    
    // Instantiate player
    this.player = new Player(this.canvas.width, this.canvas.height, shipType);
    
    // Sync HUD displays
    this.dom.hud.classList.remove('hidden');
    this.dom.highScore.innerText = String(this.highScore).padStart(6, '0');
    this.updateHUD();
    
    // Audio triggering
    audioSystem.init();
    audioSystem.setStageTheme(startingStage);
    audioSystem.setBossTheme(false);
    audioSystem.startMusic();
    
    // Introduce first wave
    this.startIntermission(2000);
  }

  /**
   * Triggers intermission breaks between waves
   */
  startIntermission(duration) {
    this.waveIntermission = true;
    this.intermissionEndTime = Date.now() + duration;
    this.waveInProgress = false;
  }

  /**
   * Spawns current wave enemies
   */
  spawnCurrentWave() {
    this.waveIntermission = false;
    this.waveInProgress = true;
    
    const w = this.wave;
    const difficultyScale = 1.0 + (this.stage - 1) * 0.4 + (w - 1) * 0.15;
    
    if (w === 3) {
      // Wave 3 is the BOSS FIGHT!
      this.triggerBossFight(difficultyScale);
      return;
    }
    
    // Standard waves: Math formulas for spawns based on stage & wave
    const droneCount = Math.floor((5 + this.stage * 3 + w * 2) * 1.6);
    const spinnerCount = (this.stage > 1 || w > 1) ? Math.floor((this.stage * 2 + w * 2 - 2) * 1.5) : 0;
    const sniperCount = (this.stage > 2 || (this.stage === 2 && w > 1)) ? Math.floor((this.stage * 2 + w - 3) * 1.5) : 0;
    
    // Queue up staggered spawn positions
    for (let i = 0; i < droneCount; i++) {
      const rx = Math.random() * (this.canvas.width - 60) + 30;
      const ry = -50 - (i * 120);
      this.enemies.push(new Enemy(rx, ry, 'drone', difficultyScale, this.stage));
    }
    
    for (let i = 0; i < spinnerCount; i++) {
      const rx = Math.random() * (this.canvas.width - 80) + 40;
      const ry = -100 - (i * 200);
      this.enemies.push(new Enemy(rx, ry, 'spinner', difficultyScale, this.stage));
    }
    
    for (let i = 0; i < sniperCount; i++) {
      const rx = Math.random() * (this.canvas.width - 80) + 40;
      const ry = -150 - (i * 250);
      this.enemies.push(new Enemy(rx, ry, 'sniper', difficultyScale, this.stage));
    }
  }

  triggerBossFight(scale) {
    // Red alarm HUD triggers
    this.dom.bossAlarm.classList.add('active');
    audioSystem.setBossTheme(true);
    
    // Cinematic warning shake
    camera.shake(12);
    
    // Spawn corresponding Stage Boss at top center
    const bossType = `boss${this.stage}`;
    const boss = new Enemy(this.canvas.width / 2, -120, bossType, scale, this.stage);
    this.enemies.push(boss);
  }

  update(keys, mouseX, mouseY, shooting) {
    if (!this.isPlaying || this.isGameOver || this.isPaused) return;
    
    if (this.isTransitioningStage) {
      camera.update();
      ParticleFactory.update();
      if (Date.now() > this.transitionEndTime) {
        this.isTransitioningStage = false;
        this.stage++;
        this.wave = 1;
        audioSystem.setStageTheme(this.stage);
        audioSystem.setBossTheme(false);
        this.dom.bossAlarm.classList.remove('active');
        audioSystem.startMusic();
        this.startIntermission(2000);
      }
      this.updateHUD();
      return;
    }
    
    // Update camera shaking offsets
    camera.update();
    
    // 1. Handle Keyboard inputs for Player
    let dx = 0, dy = 0;
    if (keys['w'] || keys['arrowup']) dy = -1;
    if (keys['s'] || keys['arrowdown']) dy = 1;
    if (keys['a'] || keys['arrowleft']) dx = -1;
    if (keys['d'] || keys['arrowright']) dx = 1;
    this.player.move(dx, dy);
    
    // Update player positions/cooldowns
    this.player.update(keys, mouseX, mouseY, this.canvas.width, this.canvas.height, this.bullets, this.enemies);
    
    // Fire weapon if shooting held down
    if (shooting) {
      this.player.fire(this.bullets);
    }
    
    // 2. Wave Progression controller
    if (this.waveIntermission) {
      if (Date.now() > this.intermissionEndTime) {
        this.spawnCurrentWave();
      }
    } else if (this.waveInProgress && this.enemies.length === 0) {
      // Wave/Stage Cleared!
      if (this.wave === 3) {
        // Defeated Boss!
        if (this.stage < 3) {
          // Trigger Hyperspace Transition
          this.isTransitioningStage = true;
          this.transitionEndTime = Date.now() + 3500;
          this.bullets = [];
          this.xpGems = [];
          this.healthPacks = [];
          audioSystem.stopMusic();
          audioSystem.playUpgrade(); // Hyperspace shift chime
          camera.shake(15);
        } else {
          // Defeated Stage 3 Boss - ultimate victory!
          this.triggerVictory();
        }
      } else {
        // Standard Wave 1 or 2 cleared
        this.wave++;
        this.dom.bossAlarm.classList.remove('active'); // ensure alarm reset
        this.startIntermission(2500);
      }
    }
    
    // 3. Update active bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      
      // Chrono Field bullet slowdown check
      if (!b.isPlayer && this.player && this.player.hasChronoField) {
        const dx = b.x - this.player.x;
        const dy = b.y - this.player.y;
        const distSq = dx * dx + dy * dy;
        const radius = this.player.chronoFieldRadius || 120;
        if (distSq < radius * radius) {
          if (!b.isSlowed) {
            b.isSlowed = true;
            b.vx *= 0.45;
            b.vy *= 0.45;
            b.speed *= 0.45;
          }
        }
      }
      
      b.update(this.player, this.enemies);
      
      // Boundaries checks
      if (b.isDead || b.isOutOfBounds(this.canvas.width, this.canvas.height)) {
        this.bullets.splice(i, 1);
      }
    }
    
    // 4. Update active enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(this.player, this.bullets, this.enemies);
      
      if (e.isDead) {
        this.enemies.splice(i, 1);
      } else if (e.y > this.canvas.height + 50) {
        // Remove standard enemies when they fly past the screen so they don't count or reset
        this.enemies.splice(i, 1);
      }
    }
    
    // 5. Update XP crystals gems
    for (let i = this.xpGems.length - 1; i >= 0; i--) {
      const gem = this.xpGems[i];
      gem.update(this.player);
      if (gem.isDead) {
        this.xpGems.splice(i, 1);
      } else if (gem.y > this.canvas.height + 50) {
        this.xpGems.splice(i, 1); // delete off-screen gems
      }
    }
    
    // 6. Update health kit drops
    for (let i = this.healthPacks.length - 1; i >= 0; i--) {
      const pack = this.healthPacks[i];
      pack.update();
      if (pack.isDead || pack.y > this.canvas.height + 50) {
        this.healthPacks.splice(i, 1);
      }
    }

    // 6b. Update cyber power-up drops
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const p = this.powerUps[i];
      p.update();
      if (p.isDead || p.y > this.canvas.height + 50) {
        this.powerUps.splice(i, 1);
      }
    }
    
    // 7. Update glowing visual particles
    ParticleFactory.update();
    
    // Run Collision engine
    this.checkCollisions();
    
    // Sync HUD values
    this.updateHUD();
  }

  checkCollisions() {
    // 1. Bullets vs Entities
    for (let i = 0; i < this.bullets.length; i++) {
      const b = this.bullets[i];
      if (b.isDead) continue;
      
      if (b.isPlayer) {
        // Player bullet vs Enemies
        for (let j = 0; j < this.enemies.length; j++) {
          const e = this.enemies[j];
          if (e.isDead || b.enemiesHit.includes(e)) continue;
          
          const dx = e.x - b.x;
          const dy = e.y - b.y;
          const dist = dx * dx + dy * dy;
          const minDist = e.radius + b.radius;
          
          if (dist < minDist * minDist) {
            // Hit!
            b.enemiesHit.push(e);
            
            // Deal damage
            const scoreReward = e.takeDamage(b.damage);
            if (scoreReward > 0) {
              this.score += scoreReward;
              this.enemiesKilled++;
              
              // Drop XP Gems
              const gemCount = e.type.startsWith('boss') ? 20 : (e.type === 'spinner' ? 3 : 1);
              for (let k = 0; k < gemCount; k++) {
                const rx = e.x + (Math.random() * 20 - 10);
                const ry = e.y + (Math.random() * 20 - 10);
                this.xpGems.push(new XPGem(rx, ry, e.type.startsWith('boss') ? 50 : 15));
              }
              
              // Drop rare Health Pack (2% chance for drone, 5% for spinner/sniper)
              const dropChance = e.type === 'drone' ? 0.02 : 0.05;
              if (Math.random() < dropChance) {
                this.healthPacks.push(new HealthPack(e.x, e.y));
              }

              // Drop Cyber Power-Up (8% chance drone, 15% spinner/sniper)
              const pDropChance = e.type === 'drone' ? 0.08 : (e.type === 'spinner' || e.type === 'sniper' ? 0.15 : 0.0);
              if (Math.random() < pDropChance) {
                const types = ['P', 'B', 'H', 'S'];
                const chosenType = types[Math.floor(Math.random() * types.length)];
                this.powerUps.push(new PowerUp(e.x, e.y, chosenType));
              }

              // Increment Super power by 0.8
              this.player.superPower = Math.min(100, (this.player.superPower || 0) + 0.8);
            }
            
            // Heavy nuclear splash damage routine
            if (b.isHeavyMissile) {
              const splashRadius = 120;
              audioSystem.playExplosion();
              camera.shake(10);
              
              // Spawn fire blast and expanding shockwave ring
              ParticleFactory.spawnExplosion(b.x, b.y, '#ff5500', 35);
              ParticleFactory.spawnBombShockwave(b.x, b.y, '#ffaa00');
              
              // Deal splash damage to all other nearby enemies
              for (let k = 0; k < this.enemies.length; k++) {
                const enemy = this.enemies[k];
                if (enemy.isDead || enemy === e) continue; // Skip dead or direct-hit enemy
                
                const sdx = enemy.x - b.x;
                const sdy = enemy.y - b.y;
                const sdistSq = sdx * sdx + sdy * sdy;
                if (sdistSq < splashRadius * splashRadius) {
                  const sReward = enemy.takeDamage(b.damage);
                  if (sReward > 0) {
                    this.score += sReward;
                    this.enemiesKilled++;
                    
                    // Spawn extra gems for splash kills
                    const sGemCount = enemy.type.startsWith('boss') ? 20 : (enemy.type === 'spinner' ? 3 : 1);
                    for (let g = 0; g < sGemCount; g++) {
                      this.xpGems.push(new XPGem(enemy.x + (Math.random() * 20 - 10), enemy.y + (Math.random() * 20 - 10), enemy.type.startsWith('boss') ? 50 : 15));
                    }

                    // Drop Cyber Power-Up for splash kills (8% drone, 15% spinner/sniper)
                    const pDropChance = enemy.type === 'drone' ? 0.08 : (enemy.type === 'spinner' || enemy.type === 'sniper' ? 0.15 : 0.0);
                    if (Math.random() < pDropChance) {
                      const types = ['P', 'B', 'H', 'S'];
                      const chosenType = types[Math.floor(Math.random() * types.length)];
                      this.powerUps.push(new PowerUp(enemy.x, enemy.y, chosenType));
                    }

                    // Increment Super power by 0.8
                    this.player.superPower = Math.min(100, (this.player.superPower || 0) + 0.8);
                  }
                }
              }
            }
            
            // Explode sparks on impact
            ParticleFactory.spawnSpark(b.x, b.y, b.vx, b.vy, b.color);
            
            // Decelerate pierce
            b.pierce--;
            if (b.pierce <= 0) {
              b.isDead = true;
              break;
            }
          }
        }
      } else {
        // Enemy bullet vs Player
        const dx = this.player.x - b.x;
        const dy = this.player.y - b.y;
        const dist = dx * dx + dy * dy;
        const minDist = this.player.radius + b.radius;
        
        if (dist < minDist * minDist) {
          b.isDead = true;
          this.player.takeDamage(b.damage);
          if (this.player.isDead) {
            this.triggerGameOver(false);
          }
        }
      }
    }
    
    // 2. Enemies vs Player direct collisions
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.isDead) continue;
      
      const dx = this.player.x - e.x;
      const dy = this.player.y - e.y;
      const dist = dx * dx + dy * dy;
      const minDist = this.player.radius + e.radius;
      
      if (dist < minDist * minDist) {
        if (e.type.startsWith('boss')) {
          // Continuous collision tick damage
          this.player.takeDamage(2);
        } else {
          // Kamikaze crash: destroys enemy, deals massive damage to player
          e.takeDamage(999);
          this.player.takeDamage(20);
        }
        
        if (this.player.isDead) {
          this.triggerGameOver(false);
        }
      }
    }
    
    // 3. Magnet Pickups: Gems and Health packs vs Player hitbox
    // XP Gems collision
    for (let i = 0; i < this.xpGems.length; i++) {
      const gem = this.xpGems[i];
      if (gem.isDead) continue;
      
      const dx = this.player.x - gem.x;
      const dy = this.player.y - gem.y;
      const dist = dx * dx + dy * dy;
      
      if (dist < (this.player.radius + gem.radius) * (this.player.radius + gem.radius)) {
        gem.isDead = true;
        // Increment Super power on gem pickup by 1.5
        this.player.superPower = Math.min(100, (this.player.superPower || 0) + 1.5);
        const levelUp = this.player.gainXP(gem.amount);
        if (levelUp) {
          this.triggerLevelUp();
        }
      }
    }
    
    // Health Packs collision
    for (let i = 0; i < this.healthPacks.length; i++) {
      const pack = this.healthPacks[i];
      if (pack.isDead) continue;
      
      const dx = this.player.x - pack.x;
      const dy = this.player.y - pack.y;
      const dist = dx * dx + dy * dy;
      
      if (dist < (this.player.radius + pack.radius) * (this.player.radius + pack.radius)) {
        pack.isDead = true;
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + pack.healAmount);
        audioSystem.playUpgrade(); // sweet heal sound
        ParticleFactory.spawnExplosion(pack.x, pack.y, '#ff2d55', 8);
      }
    }

    // Power-Up items collision checking
    for (let i = 0; i < this.powerUps.length; i++) {
      const p = this.powerUps[i];
      if (p.isDead) continue;
      
      const dx = this.player.x - p.x;
      const dy = this.player.y - p.y;
      const dist = dx * dx + dy * dy;
      
      if (dist < (this.player.radius + p.radius) * (this.player.radius + p.radius)) {
        p.isDead = true;
        audioSystem.playUpgrade(); // Play upgrade chime
        ParticleFactory.spawnExplosion(p.x, p.y, p.color, 8);
        
        if (p.type === 'P') {
          this.player.firepowerLevel = Math.min(5, (this.player.firepowerLevel || 1) + 1);
        } else if (p.type === 'B') {
          this.player.bombs = Math.min(this.player.maxBombs, this.player.bombs + 1);
        } else if (p.type === 'H') {
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + 25);
          this.player.shield = Math.min(this.player.maxShield, this.player.shield + 25);
        } else if (p.type === 'S') {
          this.player.superPower = 100;
        }
      }
    }
  }

  updateHUD() {
    this.dom.score.innerText = String(Math.floor(this.score)).padStart(6, '0');
    this.dom.wave.innerText = this.wave === 5 ? 'FINAL' : this.wave;
    
    // HP Gauge
    const hpPct = (this.player.hp / this.player.maxHp) * 100;
    this.dom.hpFill.style.width = `${hpPct}%`;
    this.dom.hpText.innerText = `${Math.floor(this.player.hp)}/${this.player.maxHp}`;
    
    // Shield Gauge
    const shdPct = (this.player.shield / this.player.maxShield) * 100;
    this.dom.shieldFill.style.width = `${shdPct}%`;
    this.dom.shieldText.innerText = `${Math.floor(this.player.shield)}/${this.player.maxShield}`;
    
    // XP Gauge
    const xpPct = (this.player.xp / this.player.xpToNextLevel) * 100;
    this.dom.xpFill.style.width = `${xpPct}%`;
    this.dom.xpText.innerText = `LV. ${this.player.level}`;
    
    // Super Gauge status update (linked to player.superPower)
    const superPct = Math.min(100, this.player.superPower || 0);
    if (this.dom.superFill && this.dom.superText) {
      this.dom.superFill.style.width = `${superPct}%`;
      this.dom.superText.innerText = `${Math.floor(superPct)}% ${superPct >= 100 ? '[READY: V]' : '[CHARGING]'}`;
      if (superPct >= 100) {
        this.dom.superFill.classList.add('sp-charged');
      } else {
        this.dom.superFill.classList.remove('sp-charged');
      }
    }
    
    // Void Bomb slots
    this.dom.bombsRow.innerHTML = '';
    for (let i = 0; i < this.player.maxBombs; i++) {
      const bomb = document.createElement('div');
      bomb.className = 'bomb-icon';
      if (i >= this.player.bombs) {
        bomb.style.opacity = '0.15'; // depleted
        bomb.style.animation = 'none';
      }
      this.dom.bombsRow.appendChild(bomb);
    }
  }

  triggerLevelUp() {
    this.isPaused = true;
    
    // Roll 3 randomized upgrade cards
    const cards = UpgradeSystem.getRandomSelections(3);
    this.dom.upgradeCards.innerHTML = '';
    
    this.activeUpgradeCards = cards;
    this.selectedUpgradeIndex = 0; // Default to first card focused
    
    cards.forEach((upgrade, idx) => {
      const card = document.createElement('div');
      card.className = `upgrade-card type-${upgrade.type}`;
      if (idx === 0) {
        card.classList.add('focused'); // Focus first card by default!
      }
      
      const emoji = UpgradeSystem.getEmoji(upgrade.type);
      
      card.innerHTML = `
        <div class="upgrade-icon font-retro" style="font-size: 24px; text-shadow: 0 0 10px ${upgrade.iconColor}">${emoji}</div>
        <div class="upgrade-name font-retro">${upgrade.name}</div>
        <div class="upgrade-rarity rarity-${upgrade.rarity}">${upgrade.rarity}</div>
        <div class="upgrade-desc font-scifi">${upgrade.desc}</div>
      `;
      
      // Click selection handler
      card.onclick = () => {
        this.selectUpgrade(upgrade);
      };
      
      // Mouse hover syncs keyboard focus index
      card.onmouseenter = () => {
        this.selectedUpgradeIndex = idx;
        const children = this.dom.upgradeCards.children;
        for (let i = 0; i < children.length; i++) {
          if (i === idx) {
            children[i].classList.add('focused');
          } else {
            children[i].classList.remove('focused');
          }
        }
      };
      
      this.dom.upgradeCards.appendChild(card);
    });
    
    this.dom.levelUpScreen.classList.remove('hidden');
  }

  selectUpgrade(upgrade) {
    UpgradeSystem.apply(this.player, upgrade);
    this.dom.levelUpScreen.classList.add('hidden');
    this.isPaused = false;
  }

  handleUpgradeInput(key) {
    if (!this.isPaused || !this.dom.levelUpScreen || this.dom.levelUpScreen.classList.contains('hidden')) return;
    
    const k = key.toLowerCase();
    let changed = false;
    
    if (k === 'a' || k === 'arrowleft') {
      if (this.selectedUpgradeIndex > 0) {
        this.selectedUpgradeIndex--;
        changed = true;
      }
    } else if (k === 'd' || k === 'arrowright') {
      if (this.selectedUpgradeIndex < 2) {
        this.selectedUpgradeIndex++;
        changed = true;
      }
    } else if (k === ' ' || k === 'enter') {
      const upgrade = this.activeUpgradeCards[this.selectedUpgradeIndex];
      if (upgrade) {
        this.selectUpgrade(upgrade);
        audioSystem.playUpgrade();
      }
      return;
    }
    
    if (changed) {
      audioSystem.playShieldHit();
      const children = this.dom.upgradeCards.children;
      for (let i = 0; i < children.length; i++) {
        if (i === this.selectedUpgradeIndex) {
          children[i].classList.add('focused');
        } else {
          children[i].classList.remove('focused');
        }
      }
    }
  }

  triggerGameOver(isVictorious) {
    this.isGameOver = true;
    this.dom.bossAlarm.classList.remove('active');
    audioSystem.stopMusic();
    
    // High Score checks
    if (this.score > this.highScore) {
      this.highScore = Math.floor(this.score);
      localStorage.setItem('void_shift_high_score', this.highScore);
    }
    
    // Populate stats
    this.dom.finalScore.innerText = String(Math.floor(this.score)).padStart(6, '0');
    this.dom.finalWave.innerText = this.wave === 5 && isVictorious ? '5 (CLEARED)' : this.wave;
    this.dom.finalEnemies.innerText = this.enemiesKilled;
    
    if (isVictorious) {
      this.dom.gameOverTitle.innerText = 'MISSION SECURED';
      this.dom.gameOverTitle.className = 'modal-title font-retro text-glow-green';
      this.dom.gameOverSubtitle.innerText = 'COGNITIVE VOID STABILIZED';
    } else {
      this.dom.gameOverTitle.innerText = 'MISSION FAILED';
      this.dom.gameOverTitle.className = 'modal-title font-retro text-glow-red';
      this.dom.gameOverSubtitle.innerText = 'COGNITIVE SIGNALS TERMINATED';
    }
    
    this.dom.gameOverScreen.classList.remove('hidden');
  }

  triggerVictory() {
    this.triggerGameOver(true);
  }

  drawScrollingLayer(ctx, img, speed, scrollVarName) {
    // 1. Calculate proportional height to preserve 1:1 pixel art aspect ratio
    const scale = this.canvas.width / img.width;
    const drawHeight = img.height * scale;
    
    // 2. Safely initialize and increment the scroll variable, wrapping at drawHeight
    if (this[scrollVarName] === undefined) {
      this[scrollVarName] = 0;
    }
    this[scrollVarName] = (this[scrollVarName] + speed) % drawHeight;
    
    // 3. Draw standard tiles with 80px overlap
    const overlap = 80;
    const seamY = this[scrollVarName];
    
    // Render Copy 1: Upper tile (drawn partially offscreen, moving into view)
    ctx.drawImage(img, 0, seamY - drawHeight, this.canvas.width, drawHeight);
    
    // Render Copy 2: Lower tile (drawn below the overlap region to avoid early sharp cuts)
    const overlapScale = overlap * scale;
    if (seamY + overlapScale < this.canvas.height) {
      ctx.drawImage(img, 
        0, overlap, img.width, img.height - overlap, // source
        0, seamY + overlapScale, this.canvas.width, drawHeight - overlapScale // destination
      );
    }
    
    // 4. Render graduated transparency strips in the overlap zone (seamY to seamY + overlap)
    // Slices the overlapping top edge of Copy 2 into 8 horizontal bands with increasing opacity
    const strips = 8;
    const stripHeightImg = overlap / strips;
    const stripHeightCanvas = overlapScale / strips;
    const alphas = [0.12, 0.25, 0.38, 0.5, 0.62, 0.75, 0.88, 1.0];
    
    ctx.save();
    for (let j = 0; j < strips; j++) {
      ctx.globalAlpha = alphas[j];
      
      const sy = j * stripHeightImg;
      const dy = seamY + (j * stripHeightCanvas);
      
      ctx.drawImage(img,
        0, sy, img.width, stripHeightImg, // source slice
        0, dy, this.canvas.width, stripHeightCanvas // destination draw
      );
    }
    ctx.restore();
  }

  /**
   * Updates scrolling positions and renders Evolving Stage Layout Overlays
   */
  updateAndDrawStageOverlays(ctx) {
    if (!this.isPlaying || this.isPaused || this.isTransitioningStage) return;
    
    if (!this.stageOverlays) {
      this.stageOverlays = [];
      this.lastOverlaySpawnTime = 0;
    }
    
    const time = Date.now();
    const bgSpeed = this.stage === 1 ? 1.2 : (this.stage === 2 ? 1.0 : 1.5);
    
    // Periodically spawn new overlays (every 4 to 7 seconds)
    const spawnDelay = this.stage === 1 ? 3000 : (this.stage === 2 ? 4000 : 3500);
    if (time - this.lastOverlaySpawnTime > spawnDelay + Math.random() * 2500) {
      this.lastOverlaySpawnTime = time;
      this.spawnStageOverlay();
    }
    
    // Update and draw overlays
    for (let i = this.stageOverlays.length - 1; i >= 0; i--) {
      const obj = this.stageOverlays[i];
      
      // Update Y (scroll down at background speed)
      obj.y += bgSpeed;
      
      // Draw object
      ctx.save();
      ctx.translate(obj.x, obj.y);
      this.drawProceduralOverlayObject(ctx, obj);
      ctx.restore();
      
      // Delete off-screen
      if (obj.y > this.canvas.height + 250) {
        this.stageOverlays.splice(i, 1);
      }
    }
  }

  /**
   * Spawns a new unique scrolling landscape overlay depending on current active zone
   */
  spawnStageOverlay() {
    const rx = Math.random() * (this.canvas.width - 250) + 120;
    const ry = -200;
    
    if (this.stage === 1) {
      // Stage 1: Holographic billboards, fast-moving high-altitude highways, pipelines
      const types = ['billboard', 'highway', 'pipeline'];
      const type = types[Math.floor(Math.random() * types.length)];
      
      let text = 'VOID SHIFT';
      let color = '#00ffff';
      const r = Math.random();
      if (r < 0.25) { text = 'NEON STRIKER'; color = '#ff2d55'; }
      else if (r < 0.5) { text = 'DRIVE CHARGED'; color = '#fff01f'; }
      else if (r < 0.75) { text = 'CRIT STABLE'; color = '#39ff14'; }
      
      this.stageOverlays.push({
        type: type,
        x: type === 'pipeline' ? 0 : rx,
        y: ry,
        width: type === 'pipeline' ? this.canvas.width : 130 + Math.random() * 70,
        height: type === 'pipeline' ? 12 : 54,
        text: text,
        color: color,
        speed: 1.0 + Math.random() * 0.8,
        cars: Array.from({length: 3}, () => ({
          pos: Math.random() * 200,
          color: Math.random() > 0.5 ? '#00ffff' : '#ff2d55',
          speed: 1.5 + Math.random() * 2.5
        }))
      });
    } else if (this.stage === 2) {
      // Stage 2: Giant mossy branches, bio-spore clusters, glowing wild mushrooms
      const types = ['branch_left', 'branch_right', 'mushroom_cluster'];
      const type = types[Math.floor(Math.random() * types.length)];
      
      this.stageOverlays.push({
        type: type,
        x: type === 'branch_left' ? 0 : (type === 'branch_right' ? this.canvas.width : rx),
        y: ry,
        radius: 30 + Math.random() * 30,
        length: 130 + Math.random() * 110,
        color: Math.random() > 0.5 ? '#bd00ff' : '#39ff14'
      });
    } else if (this.stage === 3) {
      // Stage 3: Hangar panels, caution gates, rotating defense radar plates
      const types = ['catwalk', 'radar', 'caution_strip'];
      const type = types[Math.floor(Math.random() * types.length)];
      
      this.stageOverlays.push({
        type: type,
        x: type === 'catwalk' ? 0 : rx,
        y: ry,
        width: type === 'catwalk' ? this.canvas.width : 60 + Math.random() * 50,
        height: type === 'catwalk' ? 16 : 60,
        angle: Math.random() * Math.PI,
        rotSpeed: 0.01 + Math.random() * 0.02
      });
    }
  }

  /**
   * Renders detailed 16-bit retro procedural overlays onto the scrolling map
   */
  drawProceduralOverlayObject(ctx, obj) {
    ctx.shadowBlur = 0; // Reset default blur
    
    if (obj.type === 'billboard') {
      // Neon billboard frame
      ctx.save();
      ctx.fillStyle = 'rgba(7, 7, 13, 0.85)';
      ctx.strokeStyle = '#39ff14'; // glowing green frame
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#39ff14';
      ctx.fillRect(-obj.width/2, -obj.height/2, obj.width, obj.height);
      ctx.strokeRect(-obj.width/2, -obj.height/2, obj.width, obj.height);
      
      // Frame metal struts
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#1c1c24';
      ctx.fillRect(-6, obj.height/2, 12, 40);
      
      // Neon text inside billboard
      ctx.font = '8px "Press Start 2P"';
      ctx.fillStyle = obj.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = obj.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(obj.text, 0, 0);
      ctx.restore();
      
    } else if (obj.type === 'highway') {
      // High-altitude scrolling highway
      ctx.save();
      ctx.fillStyle = 'rgba(28, 28, 36, 0.4)';
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.fillRect(-100, -25, 200, 50);
      ctx.strokeRect(-100, -25, 200, 50);
      
      // Moving hovercar pixel light streaks
      obj.cars.forEach(car => {
        car.pos = (car.pos + car.speed) % 200;
        ctx.fillStyle = car.color;
        ctx.shadowBlur = 6;
        ctx.shadowColor = car.color;
        ctx.fillRect(-100 + car.pos, -15, 6, 3);
        ctx.fillRect(-100 + ((car.pos + 80) % 200), 10, 6, 3);
      });
      ctx.restore();
      
    } else if (obj.type === 'pipeline') {
      // Power conduits grid line
      ctx.fillStyle = '#111115';
      ctx.fillRect(0, -6, obj.width, 12);
      ctx.fillStyle = '#39ff14'; // glowing green power conduits
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#39ff14';
      ctx.fillRect(0, -2, obj.width, 4);
      
    } else if (obj.type === 'branch_left') {
      // Ancient canopy branch from left
      ctx.fillStyle = '#0f1710';
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(obj.length, -6);
      ctx.lineTo(obj.length, 6);
      ctx.lineTo(0, 20);
      ctx.closePath();
      ctx.fill();
      
      // Glowing emerald leaves
      ctx.fillStyle = obj.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = obj.color;
      for (let j = 40; j < obj.length; j += 35) {
        ctx.beginPath();
        ctx.arc(j, -6, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      
    } else if (obj.type === 'branch_right') {
      // Ancient canopy branch from right
      ctx.fillStyle = '#0f1710';
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(-obj.length, -6);
      ctx.lineTo(-obj.length, 6);
      ctx.lineTo(0, 20);
      ctx.closePath();
      ctx.fill();
      
      // Glowing purple spore leaves
      ctx.fillStyle = obj.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = obj.color;
      for (let j = 40; j < obj.length; j += 35) {
        ctx.beginPath();
        ctx.arc(-j, -6, 8, 0, Math.PI * 2);
        ctx.fill();
      }
      
    } else if (obj.type === 'mushroom_cluster') {
      // Glowing wild mushroom patches
      ctx.save();
      ctx.fillStyle = obj.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = obj.color;
      
      // Caps
      ctx.beginPath();
      ctx.arc(0, -10, obj.radius * 0.4, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      
      ctx.beginPath();
      ctx.arc(-15, 0, obj.radius * 0.3, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      
      // Stems
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2, -10, 4, 12);
      ctx.fillRect(-17, 0, 3, 10);
      ctx.restore();
      
    } else if (obj.type === 'catwalk') {
      // Industrial steel girder bridge
      ctx.fillStyle = '#1c1c24';
      ctx.fillRect(0, -obj.height/2, obj.width, obj.height);
      ctx.strokeStyle = '#ffaa00'; // caution orange outline
      ctx.lineWidth = 2;
      ctx.strokeRect(0, -obj.height/2, obj.width, obj.height);
      
    } else if (obj.type === 'radar') {
      // Rotating hangar radar plates
      if (obj.currentAngle === undefined) obj.currentAngle = obj.angle;
      obj.currentAngle += obj.rotSpeed;
      
      ctx.save();
      ctx.rotate(obj.currentAngle);
      ctx.fillStyle = '#2d2d3c';
      ctx.strokeStyle = '#fff01f';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, obj.width * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Rotating emitter sweeps
      ctx.fillStyle = '#fff01f';
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#fff01f';
      ctx.fillRect(0, -2, obj.width * 0.38, 4);
      ctx.restore();
      
    } else if (obj.type === 'caution_strip') {
      // Caution stripes
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(-obj.width/2, -10, obj.width, 20);
      
      ctx.fillStyle = '#000000';
      for (let j = -obj.width/2; j < obj.width/2; j += 15) {
        ctx.beginPath();
        ctx.moveTo(j, -10);
        ctx.lineTo(j + 8, -10);
        ctx.lineTo(j - 2, 10);
        ctx.lineTo(j - 10, 10);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  /**
   * Draws triple-parallax high-altitude atmospheric clouds and bio-spore overlays
   */
  drawAtmosphericOverlays(ctx) {
    if (!this.isPlaying || this.isPaused) return;
    
    if (!this.atmosphereElements) {
      this.atmosphereElements = [];
      // Initialize atmosphere layers
      for (let i = 0; i < 12; i++) {
        this.atmosphereElements.push({
          x: Math.random() * this.canvas.width,
          y: Math.random() * this.canvas.height,
          speed: 1.6 + Math.random() * 1.4,
          size: 40 + Math.random() * 60,
          opacity: 0.05 + Math.random() * 0.08,
          color: this.stage === 1 ? '#00ffff' : (this.stage === 2 ? '#39ff14' : '#ff5500')
        });
      }
    }
    
    ctx.save();
    this.atmosphereElements.forEach(el => {
      // Scroll down (faster than level base velocity to create triple parallax depth!)
      el.y += el.speed;
      if (el.y > this.canvas.height + el.size) {
        el.y = -el.size;
        el.x = Math.random() * this.canvas.width;
        el.speed = 1.6 + Math.random() * 1.4;
        el.size = 40 + Math.random() * 60;
        el.opacity = 0.05 + Math.random() * 0.08;
        el.color = this.stage === 1 ? '#00ffff' : (this.stage === 2 ? '#39ff14' : '#ff5500');
      }
      
      ctx.fillStyle = el.color;
      ctx.globalAlpha = el.opacity;
      ctx.beginPath();
      
      if (this.stage === 2) {
        // Stage 2: Bio-Spores (Glowing circles with soft shadow blur)
        ctx.shadowBlur = 8;
        ctx.shadowColor = el.color;
        ctx.arc(el.x, el.y, el.size * 0.15, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Stage 1 & 3: Soft cybernetic high-altitude mist clouds
        ctx.arc(el.x, el.y, el.size * 0.4, 0, Math.PI * 2);
        ctx.arc(el.x - el.size * 0.25, el.y + el.size * 0.1, el.size * 0.3, 0, Math.PI * 2);
        ctx.arc(el.x + el.size * 0.25, el.y + el.size * 0.1, el.size * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();
  }

  drawBackground(ctx) {
    if (!this.isPlaying) return;

    // Draw deep space solid backdrop first to prevent raw margins
    ctx.fillStyle = '#07070d';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const bgImg = spriteLoader.get(`bg${this.stage}`);

    if (bgImg) {
      // Draw single, unified vertical background map asset scrolling upright
      const bgSpeed = this.stage === 1 ? 1.2 : (this.stage === 2 ? 1.0 : 1.5);
      this.drawScrollingLayer(ctx, bgImg, bgSpeed, 'bgScroll');
      return;
    }

    if (!this.stars) return;

    if (this.stage === 2) {
      // Stage 2: Cyber Pulse - falling binary matrix rain, purple scanlines, and pink stars
      // 1. Draw background stars
      this.stars.forEach(star => {
        star.y += star.speed * 1.2;
        if (star.y > this.canvas.height) {
          star.y = 0;
          star.x = Math.random() * this.canvas.width;
        }
        ctx.save();
        const alpha = 0.3 + Math.abs(Math.sin(Date.now() * star.twinkleSpeed)) * 0.7;
        ctx.fillStyle = '#ff2d55'; // Pink/purple stars
        ctx.globalAlpha = alpha;
        ctx.fillRect(star.x, star.y, star.size, star.size);
        ctx.restore();
      });

      // 2. Purple scanline columns/blocks
      ctx.fillStyle = 'rgba(189, 0, 255, 0.02)';
      const scanlineHeight = 4;
      const scanlineSpacing = 16;
      for (let y = 0; y < this.canvas.height; y += scanlineSpacing) {
        ctx.fillRect(0, y, this.canvas.width, scanlineHeight);
      }

      // 3. Matrix binary rain
      ctx.save();
      ctx.font = '10px "Press Start 2P"';
      ctx.textAlign = 'center';
      this.binaryStreams.forEach(stream => {
        stream.y += stream.speed;
        if (stream.y > this.canvas.height + 250) {
          stream.y = -250;
          stream.x = Math.random() * this.canvas.width;
          stream.chars = Array.from({length: 12}, () => Math.random() > 0.5 ? '1' : '0');
        }

        const charSpacing = 18;
        for (let j = 0; j < stream.chars.length; j++) {
          const cy = stream.y - (j * charSpacing);
          if (cy < -20 || cy > this.canvas.height + 20) continue;

          const alpha = (1 - (j / stream.chars.length)) * 0.25;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = j === 0 ? '#00ffff' : '#bd00ff'; // leading cyan char, purple tail
          ctx.shadowBlur = j === 0 ? 8 : 2;
          ctx.shadowColor = j === 0 ? '#00ffff' : '#bd00ff';

          if (Math.random() < 0.02) {
            stream.chars[j] = Math.random() > 0.5 ? '1' : '0';
          }

          ctx.fillText(stream.chars[j], stream.x, cy);
          ctx.restore();
        }
      });
      ctx.restore();
    } else if (this.stage === 3) {
      // Stage 3: Neon Singularity - central orange glowing event horizon black hole + solar flares + orbiting cosmic embers + orange stars
      // 1. Draw stars
      this.stars.forEach(star => {
        star.y += star.speed * 0.6;
        if (star.y > this.canvas.height) {
          star.y = 0;
          star.x = Math.random() * this.canvas.width;
        }
        ctx.save();
        const alpha = 0.2 + Math.abs(Math.sin(Date.now() * star.twinkleSpeed)) * 0.6;
        ctx.fillStyle = '#ff5500';
        ctx.globalAlpha = alpha;
        ctx.fillRect(star.x, star.y, star.size * 0.8, star.size * 0.8);
        ctx.restore();
      });

      const cx = this.canvas.width / 2;
      const cy = 150;

      // 2. Ambient orange glow
      ctx.save();
      const bgGlow = ctx.createRadialGradient(cx, cy, 20, cx, cy, 320);
      bgGlow.addColorStop(0, 'rgba(255, 85, 0, 0.08)');
      bgGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = bgGlow;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.restore();

      // 3. Central black hole event horizon
      ctx.save();
      const gradient = ctx.createRadialGradient(cx, cy, 40, cx, cy, 220);
      gradient.addColorStop(0, '#000000'); // black core
      gradient.addColorStop(0.2, '#000000');
      const flarePulse = 180 + Math.sin(Date.now() * 0.002) * 20;
      gradient.addColorStop(0.3, '#ff3c00');
      gradient.addColorStop(0.5, 'rgba(255, 85, 0, 0.2)');
      gradient.addColorStop(1, 'rgba(255, 85, 0, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, 250, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 4. Orbiting cosmic embers
      this.embers.forEach(ember => {
        ember.angle += ember.speed;
        const ex = cx + Math.cos(ember.angle) * ember.radius;
        const ey = cy + Math.sin(ember.angle) * (ember.radius * 0.7); // perspective squashed orbit

        ctx.save();
        ctx.shadowBlur = 6;
        ctx.shadowColor = ember.color;
        ctx.fillStyle = ember.color;
        ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.003 + ember.radius) * 0.3;
        ctx.beginPath();
        ctx.arc(ex, ey, ember.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    } else {
      // Stage 1: Void Shift - vector scrolling grid and two layers of cyan/pink parallax stars
      // 1. Draw parallax stars
      this.stars.forEach(star => {
        star.y += star.speed;
        if (star.y > this.canvas.height) {
          star.y = 0;
          star.x = Math.random() * this.canvas.width;
        }
        ctx.save();
        const alpha = 0.3 + Math.abs(Math.sin(Date.now() * star.twinkleSpeed)) * 0.7;
        ctx.fillStyle = star.color;
        ctx.globalAlpha = alpha;
        ctx.fillRect(star.x, star.y, star.size, star.size);
        ctx.restore();
      });

      // 2. Vector scrolling grid lines
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.07)';
      ctx.lineWidth = 1;

      // Horizontal lines moving downward
      const gridSpacing = 80;
      const yOffset = (Date.now() * 0.04) % gridSpacing;
      for (let y = yOffset; y < this.canvas.height; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(this.canvas.width, y);
        ctx.stroke();
      }

      // Vertical lines
      for (let x = 0; x < this.canvas.width; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.canvas.height);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /**
   * Renders a highly immersive, interactive, procedurally animated spaceship hangar
   * in the background of the start menu screen.
   */
  drawHangarBackground(ctx) {
    const time = Date.now();
    const shipX = this.canvas.width / 2;
    const shipY = this.canvas.height / 2 - 35; // slightly higher to leave room for card previews

    // 1. Core Hangar Metallic Walls
    ctx.fillStyle = '#0a0a0f'; // deep obsidian/graphite base
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Panel plates grids
    ctx.strokeStyle = 'rgba(28, 28, 40, 0.5)';
    ctx.lineWidth = 2;
    const panelSize = 64;
    for (let x = 0; x < this.canvas.width; x += panelSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < this.canvas.height; y += panelSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.canvas.width, y);
      ctx.stroke();
    }
    
    // Plate corner rivets
    ctx.fillStyle = '#1c1c28';
    for (let x = 0; x < this.canvas.width; x += panelSize) {
      for (let y = 0; y < this.canvas.height; y += panelSize) {
        ctx.fillRect(x - 2, y - 2, 4, 4);
      }
    }
    
    // Heavy metal column supports at left and right sides
    ctx.fillStyle = '#131110';
    ctx.strokeStyle = '#2a221d';
    ctx.lineWidth = 3;
    
    // Left column
    ctx.fillRect(0, 0, 50, this.canvas.height);
    ctx.strokeRect(-5, -5, 55, this.canvas.height + 10);
    // Right column
    ctx.fillRect(this.canvas.width - 50, 0, 50, this.canvas.height);
    ctx.strokeRect(this.canvas.width - 45, -5, 55, this.canvas.height + 10);

    // Hazard warning stripes on column bases
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(0, this.canvas.height - 40, 50, 40);
    ctx.fillRect(this.canvas.width - 50, this.canvas.height - 40, 50, 40);
    ctx.fillStyle = '#000000';
    for (let offset = 0; offset < 40; offset += 12) {
      ctx.beginPath();
      ctx.moveTo(offset, this.canvas.height - 40);
      ctx.lineTo(offset + 6, this.canvas.height - 40);
      ctx.lineTo(offset - 6, this.canvas.height);
      ctx.lineTo(offset - 12, this.canvas.height);
      ctx.closePath();
      ctx.fill();
      
      const rx = this.canvas.width - 50 + offset;
      ctx.beginPath();
      ctx.moveTo(rx, this.canvas.height - 40);
      ctx.lineTo(rx + 6, this.canvas.height - 40);
      ctx.lineTo(rx - 6, this.canvas.height);
      ctx.lineTo(rx - 12, this.canvas.height);
      ctx.closePath();
      ctx.fill();
    }

    // 2. Stage-Specific Background Customization
    const stage = this.selectedMenuStage || 1;
    
    if (stage === 1) {
      // Stage 1 (Neon Sky-Line) -> Glowing cyan energy conduits & computer terminal
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)';
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#00ffff';
      ctx.lineWidth = 3;
      
      // Horizontal piping
      ctx.beginPath();
      ctx.moveTo(50, 40); ctx.lineTo(this.canvas.width - 50, 40);
      ctx.moveTo(50, this.canvas.height - 80); ctx.lineTo(this.canvas.width - 50, this.canvas.height - 80);
      ctx.stroke();
      
      // Vertical piping on left/right girders
      ctx.beginPath();
      ctx.moveTo(90, 0); ctx.lineTo(90, this.canvas.height);
      ctx.moveTo(this.canvas.width - 90, 0); ctx.lineTo(this.canvas.width - 90, this.canvas.height);
      ctx.stroke();
      
      // Small cyber diagnostic terminal screen in background
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(7, 7, 15, 0.9)';
      ctx.strokeStyle = '#00ffff40';
      ctx.lineWidth = 2;
      ctx.fillRect(80, 70, 160, 50);
      ctx.strokeRect(80, 70, 160, 50);
      
      // Decorative diagnostic scan grid lines
      ctx.fillStyle = 'rgba(0, 255, 255, 0.05)';
      for (let sy = 75; sy < 120; sy += 6) {
        ctx.fillRect(82, sy, 156, 2);
      }
      
      ctx.font = '5px "Press Start 2P"';
      ctx.fillStyle = '#00ffff';
      ctx.fillText("COGNITIVE CORE: ACTV", 90, 85);
      
      const blink = Math.sin(time * 0.005) > 0 ? "STABLE" : "      ";
      ctx.fillStyle = '#39ff14';
      ctx.fillText(`DRIVE FLUX: ${blink}`, 90, 97);
      
      ctx.fillStyle = '#ff2d55';
      ctx.fillText("SECTOR: NEON SKY-LINE", 90, 109);
      ctx.restore();
      
    } else if (stage === 2) {
      // Stage 2 (Bio-Canopy) -> Overgrown bioluminescent moss, glowing purple spores, vines
      ctx.save();
      
      // Procedural moss patches
      ctx.fillStyle = '#08170c'; // dark organic green
      ctx.beginPath();
      ctx.arc(100, 60, 45, 0, Math.PI * 2);
      ctx.arc(120, 80, 30, 0, Math.PI * 2);
      ctx.arc(this.canvas.width - 120, 100, 50, 0, Math.PI * 2);
      ctx.arc(this.canvas.width - 150, 80, 35, 0, Math.PI * 2);
      ctx.fill();
      
      // Soft hanging vines
      ctx.strokeStyle = '#39ff1440';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 6;
      ctx.shadowColor = '#39ff14';
      
      const vineXPositions = [70, 160, this.canvas.width - 110];
      vineXPositions.forEach((vx, idx) => {
        ctx.beginPath();
        ctx.moveTo(vx, 0);
        ctx.bezierCurveTo(vx - 25, 60, vx + 25, 120, vx, 180);
        ctx.stroke();
        
        // Purple glowing bio-moss spores growing on vines
        ctx.fillStyle = '#bd00ff';
        ctx.shadowColor = '#bd00ff';
        const sporePulse = 0.5 + Math.sin(time * 0.003 + idx) * 0.5;
        ctx.globalAlpha = sporePulse * 0.8;
        
        for (let t = 0.15; t < 0.9; t += 0.2) {
          const ly = 180 * t;
          const lx = vx + Math.sin(ly * 0.04) * 12;
          ctx.beginPath();
          ctx.arc(lx, ly, 4 + Math.sin(t * 5) * 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1.0;
      });
      
      ctx.restore();
      
    } else if (stage === 3) {
      // Stage 3 (Void Colossus) -> Heavy space fortress warning stripes, flashing red siren, gears
      ctx.save();
      
      // Giant rotating background gear wheel
      ctx.save();
      ctx.translate(140, 80);
      ctx.rotate(time * 0.0003);
      ctx.strokeStyle = '#22201d';
      ctx.lineWidth = 6;
      ctx.fillStyle = '#11100e';
      
      ctx.beginPath();
      ctx.arc(0, 0, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      // Gear teeth
      for (let j = 0; j < Math.PI * 2; j += Math.PI / 6) {
        ctx.save();
        ctx.rotate(j);
        ctx.fillRect(-8, -48, 16, 12);
        ctx.strokeRect(-8, -48, 16, 12);
        ctx.restore();
      }
      ctx.restore();
      
      // Red sirens blinking
      const alarmBlink = 0.2 + Math.abs(Math.sin(time * 0.004)) * 0.8;
      ctx.fillStyle = `rgba(255, 45, 85, ${alarmBlink * 0.08})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      
      // Physical siren dome on walls
      ctx.fillStyle = '#ff2d55';
      ctx.strokeStyle = '#8c4a17';
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 12 * alarmBlink;
      ctx.shadowColor = '#ff2d55';
      
      ctx.beginPath();
      ctx.arc(this.canvas.width - 120, 60, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      ctx.restore();
    }

    // 3. Glowing Docking Pad
    ctx.save();
    ctx.shadowBlur = 15;
    let padColor = '#00ffff';
    if (this.selectedMenuShip === 'aegis') padColor = '#bd00ff';
    if (this.selectedMenuShip === 'sentinel') padColor = '#ff2d55';
    
    ctx.shadowColor = padColor;
    ctx.strokeStyle = padColor;
    ctx.lineWidth = 3.5;
    ctx.fillStyle = 'rgba(8, 8, 14, 0.95)';
    
    // Large landing circle base
    ctx.beginPath();
    ctx.arc(shipX, shipY, 95, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Glowing internal grid lines
    ctx.strokeStyle = padColor + '35'; // hex low alpha
    ctx.lineWidth = 1;
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
      ctx.beginPath();
      ctx.moveTo(shipX, shipY);
      ctx.lineTo(shipX + Math.cos(angle) * 95, shipY + Math.sin(angle) * 95);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(shipX, shipY, 45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(shipX, shipY, 70, 0, Math.PI * 2);
    ctx.stroke();
    
    // Draw 4 industrial heavy locking clamps with caution stripes
    ctx.fillStyle = '#221e1a';
    ctx.strokeStyle = '#b87333';
    ctx.lineWidth = 2.5;
    
    const clamps = [
      {x: shipX - 110, y: shipY - 15, w: 25, h: 30}, // left
      {x: shipX + 85,  y: shipY - 15, w: 25, h: 30}, // right
      {x: shipX - 15,  y: shipY - 110, w: 30, h: 25}, // top
      {x: shipX - 15,  y: shipY + 85, w: 30, h: 25}  // bottom
    ];
    
    clamps.forEach((clamp, idx) => {
      ctx.fillRect(clamp.x, clamp.y, clamp.w, clamp.h);
      ctx.strokeRect(clamp.x, clamp.y, clamp.w, clamp.h);
      
      // Draw black and gold hazard diagonals
      ctx.strokeStyle = '#fff01f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (idx < 2) {
        ctx.moveTo(clamp.x + 4, clamp.y + 4);
        ctx.lineTo(clamp.x + clamp.w - 4, clamp.y + clamp.h - 4);
      } else {
        ctx.moveTo(clamp.x + 4, clamp.y + clamp.h - 4);
        ctx.lineTo(clamp.x + clamp.w - 4, clamp.y + 4);
      }
      ctx.stroke();
    });
    ctx.restore();

    // 4. Draw Selected Ship (Upscaled with Bobbing and Exhaust Flames)
    const shipImg = spriteLoader.get(this.selectedMenuShip || 'vanguard');
    if (shipImg) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      
      const drawSize = 110;
      const bobOffset = Math.sin(time * 0.0016) * 5; // Slow bobbing gantry hover
      
      ctx.translate(shipX, shipY + bobOffset);
      
      // Bobbing particles / exhaust glow - upscaled high-fidelity thruster flames matching Player.js
      const flicker = 0.85 + Math.sin(time * 0.08) * 0.15 + Math.random() * 0.08;
      let nozzles = [];
      let colors = { outer: '#ff2d55', middle: '#ff9500', inner: '#ffffff' }; // default

      if (this.selectedMenuShip === 'vanguard') {
        nozzles = [{ x: -16.2, y: 48.5, w: 9.7, h: 32.3 }, { x: 16.2, y: 48.5, w: 9.7, h: 32.3 }];
        colors = { outer: '#00ffff', middle: '#0088ff', inner: '#ffffff' }; // Cyan plasma
      } else if (this.selectedMenuShip === 'aegis') {
        nozzles = [
          { x: -25.9, y: 42.0, w: 12.9, h: 29.1 },
          { x: 0, y: 45.3, w: 16.2, h: 38.8 },
          { x: 25.9, y: 42.0, w: 12.9, h: 29.1 }
        ];
        colors = { outer: '#bd00ff', middle: '#00ffff', inner: '#ffffff' }; // Violet / Cyan crystal shields
      } else if (this.selectedMenuShip === 'sentinel') {
        nozzles = [{ x: -19.4, y: 51.7, w: 8.1, h: 35.6 }, { x: 19.4, y: 51.7, w: 8.1, h: 35.6 }];
        colors = { outer: '#ff2d55', middle: '#fff01f', inner: '#ffffff' }; // Crimson / Yellow kinetic flame
      } else {
        nozzles = [{ x: 0, y: 48.5, w: 12.9, h: 32.3 }];
      }

      nozzles.forEach(nozzle => {
        ctx.save();
        ctx.translate(nozzle.x, nozzle.y);
        
        const nw = nozzle.w * flicker;
        const nh = nozzle.h * flicker;
        
        ctx.shadowBlur = 12;
        ctx.shadowColor = colors.outer;
        
        // Outer flame (largest)
        ctx.fillStyle = colors.outer;
        ctx.beginPath();
        ctx.moveTo(-nw, 0);
        ctx.lineTo(nw, 0);
        ctx.lineTo(0, nh);
        ctx.closePath();
        ctx.fill();
        
        ctx.shadowBlur = 0; // Turn off shadow blur for inner layers
        
        // Middle flame
        ctx.fillStyle = colors.middle;
        ctx.beginPath();
        ctx.moveTo(-nw * 0.6, 0);
        ctx.lineTo(nw * 0.6, 0);
        ctx.lineTo(0, nh * 0.65);
        ctx.closePath();
        ctx.fill();
        
        // Inner core (hottest, white)
        ctx.fillStyle = colors.inner;
        ctx.beginPath();
        ctx.moveTo(-nw * 0.3, 0);
        ctx.lineTo(nw * 0.3, 0);
        ctx.lineTo(0, nh * 0.35);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();
      });
      
      ctx.shadowBlur = 0;
      
      // Draw upscaled starship sprite
      ctx.drawImage(shipImg, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
      
      // Ship-specific overlays:
      // Vanguard: Cyber neon wing tubes pulsing
      if (this.selectedMenuShip === 'vanguard') {
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ffff';
        ctx.fillStyle = '#00ffff';
        ctx.globalAlpha = 0.5 + Math.sin(time * 0.006) * 0.5;
        // left wing neon bar
        ctx.fillRect(-38, -6, 3, 16);
        // right wing neon bar
        ctx.fillRect(35, -6, 3, 16);
        ctx.globalAlpha = 1.0;
      }
      
      // Aegis: Circular rotating shields
      if (this.selectedMenuShip === 'aegis') {
        ctx.strokeStyle = 'rgba(189, 0, 255, 0.4)';
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#bd00ff';
        
        ctx.beginPath();
        ctx.arc(0, 0, 75, 0, Math.PI * 2);
        ctx.stroke();
        
        // Rotating crystals on the shield ring
        const shieldRot = time * 0.0012;
        ctx.fillStyle = '#ffffff';
        const cx1 = Math.cos(shieldRot) * 75;
        const cy1 = Math.sin(shieldRot) * 75;
        ctx.beginPath();
        ctx.arc(cx1, cy1, 4.5, 0, Math.PI * 2);
        ctx.fill();
        
        const cx2 = Math.cos(shieldRot + Math.PI) * 75;
        const cy2 = Math.sin(shieldRot + Math.PI) * 75;
        ctx.beginPath();
        ctx.arc(cx2, cy2, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Sentinel: Bobbing wing drones
      if (this.selectedMenuShip === 'sentinel') {
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ff2d55';
        ctx.fillStyle = '#ff2d55';
        
        const dbob1 = Math.sin(time * 0.0022) * 5;
        const dbob2 = Math.cos(time * 0.0018) * 5;
        
        // Left drone
        ctx.fillRect(-68, -16 + dbob1, 7, 7);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-66, -14 + dbob1, 3, 3);
        
        // Right drone
        ctx.fillStyle = '#ff2d55';
        ctx.fillRect(61, -16 + dbob2, 7, 7);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(63, -14 + dbob2, 3, 3);
      }
      
      ctx.restore();
    }

    // 5. articulated Procedural Robotic Maintenance Arms & Welding Lasers
    const lax = 70;
    const lay = 100;
    const rax = this.canvas.width - 70;
    const ray = 120;
    const armLen = 70;
    
    // Slow bending angles based on sin/cos
    const lAngle1 = Math.PI / 6 + Math.sin(time * 0.0006) * 0.15;
    const lAngle2 = Math.PI / 4 + Math.cos(time * 0.0008) * 0.2;
    
    // Left Arm Joints
    const lj1x = lax + Math.cos(lAngle1) * armLen;
    const lj1y = lay + Math.sin(lAngle1) * armLen;
    const lhandx = lj1x + Math.cos(lAngle1 + lAngle2) * (armLen * 0.8);
    const lhandy = lj1y + Math.sin(lAngle1 + lAngle2) * (armLen * 0.8);
    
    // Draw Left Arm (segmented copper pipeline style)
    ctx.save();
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#8c4a17'; // copper outline
    ctx.fillStyle = '#cd7f32'; // brass fill
    
    // Base gantry plate
    ctx.fillStyle = '#1c1a18';
    ctx.fillRect(lax - 15, lay - 10, 20, 20);
    ctx.strokeRect(lax - 15, lay - 10, 20, 20);
    
    // Draw links
    ctx.beginPath();
    ctx.moveTo(lax, lay);
    ctx.lineTo(lj1x, lj1y);
    ctx.lineTo(lhandx, lhandy);
    ctx.stroke();
    
    // Articulated joint gears
    ctx.fillStyle = '#b87333';
    ctx.beginPath();
    ctx.arc(lax, lay, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(lj1x, lj1y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Tool nozzle
    ctx.fillStyle = '#cd7f32';
    ctx.fillRect(lhandx - 4, lhandy - 4, 8, 8);
    ctx.restore();

    // Right Arm Joints
    const rAngle1 = Math.PI - Math.PI / 6 + Math.sin(time * 0.0005) * 0.15;
    const rAngle2 = -Math.PI / 4 + Math.cos(time * 0.0007) * 0.2;
    
    const rj1x = rax + Math.cos(rAngle1) * armLen;
    const rj1y = ray + Math.sin(rAngle1) * armLen;
    const rhandx = rj1x + Math.cos(rAngle1 + rAngle2) * (armLen * 0.8);
    const rhandy = rj1y + Math.sin(rAngle1 + rAngle2) * (armLen * 0.8);
    
    // Draw Right Arm
    ctx.save();
    ctx.lineWidth = 5.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#8c4a17';
    ctx.fillStyle = '#cd7f32';
    
    // Base plate
    ctx.fillStyle = '#1c1a18';
    ctx.fillRect(rax - 5, ray - 10, 20, 20);
    ctx.strokeRect(rax - 5, ray - 10, 20, 20);
    
    // Links
    ctx.beginPath();
    ctx.moveTo(rax, ray);
    ctx.lineTo(rj1x, rj1y);
    ctx.lineTo(rhandx, rhandy);
    ctx.stroke();
    
    // Gears
    ctx.fillStyle = '#b87333';
    ctx.beginPath();
    ctx.arc(rax, ray, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(rj1x, rj1y, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Tool
    ctx.fillStyle = '#cd7f32';
    ctx.fillRect(rhandx - 4, rhandy - 4, 8, 8);
    ctx.restore();

    // Lazy initialize particles and sparks
    if (!this.hangarParticles) {
      this.hangarParticles = [];
    }

    // Trigger random welding arcs and emit physics sparks
    if (Math.random() < 0.012) {
      // Weld Left Wing!
      const targetX = shipX - 30 + (Math.random() - 0.5) * 10;
      const targetY = shipY + (Math.random() - 0.5) * 15;
      
      ctx.save();
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00ffff';
      
      // Draw high-voltage zig-zag welding laser arc
      ctx.beginPath();
      ctx.moveTo(lhandx, lhandy);
      const mx = (lhandx + targetX) / 2 + (Math.random() - 0.5) * 12;
      const my = (lhandy + targetY) / 2 + (Math.random() - 0.5) * 12;
      ctx.lineTo(mx, my);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();
      ctx.restore();
      
      // Spawn exploding sparks
      for (let j = 0; j < 8; j++) {
        this.hangarParticles.push({
          type: 'spark',
          x: targetX,
          y: targetY,
          vx: (Math.random() - 0.5) * 3,
          vy: -1.2 - Math.random() * 2,
          size: 2.2 + Math.random() * 2,
          alpha: 1.0,
          color: '#fff01f'
        });
      }
    }
    
    if (Math.random() < 0.012) {
      // Weld Right Wing!
      const targetX = shipX + 30 + (Math.random() - 0.5) * 10;
      const targetY = shipY + (Math.random() - 0.5) * 15;
      
      ctx.save();
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00ffff';
      
      ctx.beginPath();
      ctx.moveTo(rhandx, rhandy);
      const mx = (rhandx + targetX) / 2 + (Math.random() - 0.5) * 12;
      const my = (rhandy + targetY) / 2 + (Math.random() - 0.5) * 12;
      ctx.lineTo(mx, my);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();
      ctx.restore();
      
      for (let j = 0; j < 8; j++) {
        this.hangarParticles.push({
          type: 'spark',
          x: targetX,
          y: targetY,
          vx: (Math.random() - 0.5) * 3,
          vy: -1.2 - Math.random() * 2,
          size: 2.2 + Math.random() * 2,
          alpha: 1.0,
          color: '#fff01f'
        });
      }
    }

    // 6. Spawn Steam & Smoke Vents at the floor grates
    if (Math.random() < 0.06) {
      const ventX = Math.random() > 0.5 ? 90 + Math.random() * 60 : this.canvas.width - 150 + Math.random() * 60;
      this.hangarParticles.push({
        type: 'steam',
        x: ventX,
        y: this.canvas.height - 15,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -0.5 - Math.random() * 0.7,
        size: 8 + Math.random() * 8,
        maxSize: 36 + Math.random() * 16,
        alpha: 0.15 + Math.random() * 0.1,
        color: stage === 2 ? 'rgba(57, 255, 20, 0.08)' : 'rgba(255, 255, 255, 0.1)'
      });
    }

    // 7. Update Hangar Particles (Physics + Gravity)
    for (let i = this.hangarParticles.length - 1; i >= 0; i--) {
      const p = this.hangarParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      
      if (p.type === 'steam') {
        p.size += 0.22;
        p.alpha -= 0.0018;
        if (p.alpha <= 0 || p.size >= p.maxSize) {
          this.hangarParticles.splice(i, 1);
          continue;
        }
      } else if (p.type === 'spark') {
        p.vy += 0.07; // Gravity pulls sparks down!
        p.size *= 0.95;
        p.alpha -= 0.018;
        if (p.alpha <= 0 || p.size < 0.5) {
          this.hangarParticles.splice(i, 1);
          continue;
        }
      }
      
      // Draw particles
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      if (p.type === 'steam') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'spark') {
        ctx.shadowBlur = 6;
        ctx.shadowColor = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.restore();
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (!this.isPlaying) {
      this.drawHangarBackground(this.ctx);
      return;
    }

    // Render Stage-specific background
    this.drawBackground(this.ctx);
    
    // Render and update Evolving Stage Layout Overlays (pipes, billboards, branches, catwalks)
    this.updateAndDrawStageOverlays(this.ctx);

    // Intermission text overlay (HUD overlay handles standard screens, but wave intermissions render crisp in center of canvas)
    if (this.waveIntermission) {
      const remainingTime = Math.max(0, this.intermissionEndTime - Date.now());
      this.ctx.save();
      this.ctx.textAlign = 'center';
      
      // Glowing text
      this.ctx.shadowBlur = 10;
      this.ctx.shadowColor = '#00ffff';
      this.ctx.font = '20px "Press Start 2P"';
      this.ctx.fillStyle = '#00ffff';
      
      const waveLabel = this.wave === 5 ? 'BOSS BATTLE' : `WAVE ${this.wave}`;
      this.ctx.fillText(waveLabel, this.canvas.width / 2, this.canvas.height / 2 - 20);
      
      this.ctx.shadowColor = '#fff01f';
      this.ctx.font = '10px "Press Start 2P"';
      this.ctx.fillStyle = '#fff01f';
      this.ctx.fillText(
        `PREPARING DRIVE CONTROLLER: ${Math.ceil(remainingTime / 1000)}s`,
        this.canvas.width / 2,
        this.canvas.height / 2 + 15
      );
      this.ctx.restore();
    }
    
    // Draw active elements
    this.xpGems.forEach(gem => gem.draw(this.ctx));
    this.healthPacks.forEach(pack => pack.draw(this.ctx));
    this.powerUps.forEach(p => p.draw(this.ctx));
    this.enemies.forEach(enemy => enemy.draw(this.ctx, this.player));
    this.bullets.forEach(bullet => bullet.draw(this.ctx));
    
    // Draw particles
    ParticleFactory.draw(this.ctx);
    
    // Draw player ship safely
    if (this.player) {
      this.player.draw(this.ctx);
    }
    
    // Render high-altitude triple-parallax atmospheric overlays (cyber-clouds, bio-spores, exhaust mist)
    this.drawAtmosphericOverlays(this.ctx);

    // Draw stage transition hyperspace overlay text
    if (this.isTransitioningStage) {
      this.ctx.save();
      this.ctx.textAlign = 'center';

      // Semitransparent dark overlay
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // Glowing Cyan text: COGNITIVE ZONE DEVIATION DETECTED
      this.ctx.shadowBlur = 12;
      this.ctx.shadowColor = '#00ffff';
      this.ctx.fillStyle = '#00ffff';
      this.ctx.font = '20px "Press Start 2P"';
      this.ctx.fillText("COGNITIVE ZONE DEVIATION DETECTED", this.canvas.width / 2, this.canvas.height / 2 - 40);

      // Glowing Pink text: DRIVE EMITTERS CHARGING...
      this.ctx.shadowColor = '#ff2d55';
      this.ctx.fillStyle = '#ff2d55';
      this.ctx.font = '14px "Press Start 2P"';
      this.ctx.fillText("DRIVE EMITTERS CHARGING...", this.canvas.width / 2, this.canvas.height / 2 + 10);

      // Glowing Yellow text: SHIFTING TO ZONE X
      this.ctx.shadowColor = '#fff01f';
      this.ctx.fillStyle = '#fff01f';
      this.ctx.font = '12px "Press Start 2P"';
      this.ctx.fillText(`SHIFTING TO ZONE ${this.stage + 1}`, this.canvas.width / 2, this.canvas.height / 2 + 50);

      this.ctx.restore();
    }
  }
}
