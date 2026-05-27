/**
 * Enemy.js - Alien Invader Behaviors & Bullet Hell Spawn Orchestrators
 * Supports Swarmers, horizontal Spinners, targeting Snipers, and the
 * colossal multi-phased Hyperion Boss with procedural pixel graphics.
 */
import { Bullet } from './Bullet.js';
import { ParticleFactory, camera } from './Particle.js';
import audioSystem from './AudioSystem.js';
import spriteLoader from './SpriteLoader.js';

// Procedural 8x8 pixel sprites for standard enemies
const ENEMY_SPRITES = {
  drone: [
    [0, 1, 0, 0, 0, 0, 1, 0],
    [0, 1, 1, 2, 2, 1, 1, 0],
    [1, 1, 2, 2, 2, 2, 1, 1],
    [1, 2, 2, 3, 3, 2, 2, 1],
    [1, 2, 3, 3, 3, 3, 2, 1],
    [1, 1, 2, 2, 2, 2, 1, 1],
    [0, 1, 1, 0, 0, 1, 1, 0],
    [0, 0, 1, 0, 0, 1, 0, 0]
  ],
  spinner: [
    [0, 0, 1, 1, 1, 1, 0, 0],
    [0, 1, 2, 2, 2, 2, 1, 0],
    [1, 2, 2, 3, 3, 2, 2, 1],
    [1, 2, 3, 2, 2, 3, 2, 1],
    [1, 2, 3, 2, 2, 3, 2, 1],
    [1, 2, 2, 3, 3, 2, 2, 1],
    [0, 1, 2, 2, 2, 2, 1, 0],
    [0, 0, 1, 1, 1, 1, 0, 0]
  ],
  sniper: [
    [0, 0, 0, 1, 1, 0, 0, 0],
    [0, 0, 1, 3, 3, 1, 0, 0],
    [0, 1, 2, 3, 3, 2, 1, 0],
    [1, 1, 2, 2, 2, 2, 1, 1],
    [1, 2, 2, 2, 2, 2, 2, 1],
    [0, 1, 1, 0, 0, 1, 1, 0],
    [0, 1, 0, 0, 0, 0, 1, 0],
    [1, 0, 0, 0, 0, 0, 0, 1]
  ]
};

// 16x16 Colossal Boss pixel grid
const BOSS_SPRITE = [
  [0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 1, 1, 2, 2, 2, 2, 2, 2, 1, 1, 0, 0, 0],
  [0, 0, 1, 1, 2, 2, 2, 3, 3, 2, 2, 2, 1, 1, 0, 0],
  [0, 1, 1, 2, 2, 3, 3, 3, 3, 3, 3, 2, 2, 1, 1, 0],
  [1, 1, 2, 2, 3, 3, 2, 2, 2, 2, 3, 3, 2, 2, 1, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 2, 2, 2, 2, 2, 2, 3, 3, 2, 2, 2, 2, 2, 2, 1],
  [1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 2, 2, 2, 2, 1, 1],
  [0, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 0],
  [0, 0, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 0, 0],
  [0, 0, 0, 1, 1, 2, 2, 1, 1, 2, 2, 1, 1, 0, 0, 0],
  [0, 0, 1, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 1, 0, 0],
  [0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0],
  [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]
];

export class Enemy {
  constructor(x, y, type = 'drone', scaleFactor = 1.0, stage = 1) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.stage = stage;
    
    // Scale enemy HP based on game wave difficulty
    this.scaleFactor = scaleFactor;
    this.isDead = false;
    this.lastShootTime = 0;
    this.shootDelay = 1200 + Math.random() * 800;
    
    // Movement phase/timers
    this.spawnTime = Date.now();
    this.spinnerDir = Math.random() > 0.5 ? 1 : -1;
    
    // Sniper lock state
    this.isChargingLaser = false;
    this.laserChargeTime = 0;
    this.chargeDuration = 900; // ms
    
    // Boss specific states
    this.bossPhase = 1;
    this.bossPhaseTime = Date.now();
    this.bossAngle = 0;
    
    this.initTypeStats();
  }

  initTypeStats() {
    switch (this.type) {
      case 'spinner':
        this.maxHp = Math.floor(35 * this.scaleFactor);
        this.radius = 16;
        this.colorTheme = '#bd00ff';
        this.colorAccent = '#00ffff';
        this.points = 150;
        this.speed = 1.8;
        break;
      case 'sniper':
        this.maxHp = Math.floor(45 * this.scaleFactor);
        this.radius = 16;
        this.colorTheme = '#ff2d55';
        this.colorAccent = '#fff01f';
        this.points = 250;
        this.speed = 1.2;
        break;
      case 'boss':
      case 'boss1':
        this.maxHp = Math.floor(1400 * this.scaleFactor);
        this.radius = 48; // massive hitbox
        this.colorTheme = '#00ffff'; // Cyan
        this.colorAccent = '#ff2d55'; // Pink
        this.points = 4000;
        this.speed = 1.0;
        this.shootDelay = 220; // aggressive bursts
        break;
      case 'boss2':
        this.maxHp = Math.floor(1900 * this.scaleFactor);
        this.radius = 48; // massive hitbox
        this.colorTheme = '#bd00ff'; // Purple
        this.colorAccent = '#00ffff'; // Cyan
        this.points = 6000;
        this.speed = 0.9;
        this.shootDelay = 180;
        break;
      case 'boss3':
        this.maxHp = Math.floor(2500 * this.scaleFactor);
        this.radius = 48; // massive hitbox
        this.colorTheme = '#ffaa00'; // Orange
        this.colorAccent = '#fff01f'; // Yellow
        this.points = 8000;
        this.speed = 0.8;
        this.shootDelay = 140;
        break;
      case 'drone':
      default:
        this.maxHp = Math.floor(12 * this.scaleFactor);
        this.radius = 12;
        this.colorTheme = '#39ff14';
        this.colorAccent = '#bd00ff';
        this.points = 50;
        this.speed = 2.4;
        break;
    }
    
    this.hp = this.maxHp;
  }

  update(player, bullets, enemies) {
    const elapsed = Date.now() - this.spawnTime;
    const time = Date.now();
    
    if (this.type === 'drone') {
      // 1. Drone AI: Fly straight down with a stable linear path (no swaying or player-chasing!)
      this.y += this.speed;
      
      // Drone shoot direct single shots
      if (time - this.lastShootTime > this.shootDelay && this.y > 0) {
        this.lastShootTime = time;
        audioSystem.playLaserEnemy();
        
        const angle = Math.atan2(player.y - this.y, player.x - this.x);
        bullets.push(new Bullet(this.x, this.y, angle, 4.5, 8, false, {
          color: this.colorTheme,
          radius: 3.5
        }));
      }
      
    } else if (this.type === 'spinner') {
      // 2. Spinner AI: Sweep left/right with a constant linear vertical drift (no swaying)
      this.x += this.spinnerDir * this.speed;
      this.y += 0.45; // stable linear downward drift
      
      // Bounce boundaries horizontally (based on 854 virtual width)
      if (this.x < 30) { this.x = 30; this.spinnerDir = 1; }
      if (this.x > 854 - 30) { this.x = 854 - 30; this.spinnerDir = -1; }
      
      // Spinner shoot spiral arms
      if (time - this.lastShootTime > this.shootDelay && this.y > 0) {
        this.lastShootTime = time;
        audioSystem.playLaserEnemy();
        
        const shotAngle = (elapsed * 0.002) % (Math.PI * 2);
        const bulletCount = 4; // Quad spiral shoots
        for (let i = 0; i < bulletCount; i++) {
          const angle = shotAngle + (i * Math.PI / 2);
          bullets.push(new Bullet(this.x, this.y, angle, 4, 8, false, {
            color: this.colorTheme,
            radius: 3.5
          }));
        }
      }
      
    } else if (this.type === 'sniper') {
      // 3. Sniper AI: Position itself on a straight vertical trajectory, lock, and fire rail bullet
      if (!this.isChargingLaser) {
        // Drift slowly downward on a stable vector until reaching 30% screen height (144px)
        if (this.y < 480 * 0.3) {
          this.y += this.speed;
        }
        
        // Start charging laser lock
        if (time - this.lastShootTime > this.shootDelay && this.y > 0) {
          this.isChargingLaser = true;
          this.laserChargeTime = time;
        }
      } else {
        // Charging lock: player cannot move too close or they get aimed
        // If charge complete, fire!
        if (time - this.laserChargeTime > this.chargeDuration) {
          this.isChargingLaser = false;
          this.lastShootTime = time;
          audioSystem.playLaserHeavy();
          
          const angle = Math.atan2(player.y - this.y, player.x - this.x);
          bullets.push(new Bullet(this.x, this.y, angle, 16, 25, false, {
            color: '#ff2d55',
            radius: 5,
            isLaser: true,
            laserLength: 600
          }));
        }
      }
      
    } else if (this.type.startsWith('boss')) {
      // 4. Boss AI: Slow hover horizontal oscillation
      this.x += Math.sin(elapsed * 0.0008) * 2;
      if (this.y < 480 * 0.22) {
        this.y += 0.5; // slow dramatic introduction entry
      }
      
      // Phase Transitions based on remaining HP percentages
      const hpPct = this.hp / this.maxHp;
      if (hpPct > 0.7) {
        this.bossPhase = 1;
      } else if (hpPct > 0.3) {
        if (this.bossPhase === 1) {
          this.bossPhase = 2;
          audioSystem.playUpgrade(); // phase warning chime
          camera.shake(8);
        }
      } else {
        if (this.bossPhase === 2) {
          this.bossPhase = 3;
          audioSystem.playUpgrade();
          camera.shake(12);
        }
      }
      
      // Boss Firing Patterns depending on Phases
      this.updateBossWeapons(player, bullets, time, enemies);
    }
  }

  updateBossWeapons(player, bullets, time, enemies) {
    if (this.y < 50) return; // Wait until entered on screen to fire
    
    if (this.type === 'boss2') {
      // BOSS 2: CYBER COGNITION
      if (this.bossPhase === 1) {
        // Spacious double-helix streams (slower frequency, larger gaps)
        if (time - this.lastShootTime > this.shootDelay * 2.2) {
          this.lastShootTime = time;
          audioSystem.playLaserEnemy();
          bullets.push(new Bullet(this.x - 30, this.y + 20, Math.PI / 2, 4.5, 8, false, {
            isWave: true,
            waveAmplitude: 25,
            waveFrequency: 0.08,
            color: '#bd00ff',
            radius: 4
          }));
          bullets.push(new Bullet(this.x + 30, this.y + 20, Math.PI / 2, 4.5, 8, false, {
            isWave: true,
            waveAmplitude: -25,
            waveFrequency: 0.08,
            color: '#00ffff',
            radius: 4
          }));
        }
      } else if (this.bossPhase === 2) {
        // Cross Fire Grid: Slower rotation and a wider delay (450ms) to allow comfortable quadrant changes
        if (time - this.lastShootTime > this.shootDelay * 2.2) {
          this.lastShootTime = time;
          audioSystem.playLaserEnemy();
          this.bossAngle += 0.06;
          for (let i = 0; i < 4; i++) {
            const angle = this.bossAngle + (i * Math.PI / 2);
            bullets.push(new Bullet(this.x, this.y + 20, angle, 4.0, 8, false, {
              color: '#bd00ff',
              radius: 4
            }));
          }
          if (Math.random() < 0.15) {
            bullets.push(new Bullet(this.x, this.y + 20, Math.PI / 2, 5.0, 12, false, {
              isWave: true,
              waveAmplitude: 35,
              waveFrequency: 0.1,
              color: '#00ffff',
              radius: 4.5
            }));
          }
        }
      } else if (this.bossPhase === 3) {
        // Laser Maze: Spaced-out 6-direction geometric starburst spirals & slow railguns
        if (time - this.lastShootTime > this.shootDelay * 2.8) {
          this.lastShootTime = time;
          audioSystem.playLaserEnemy();
          this.bossAngle += 0.15;
          const ringCount = 6; // reduced from 8 for bigger dodge lanes
          for (let i = 0; i < ringCount; i++) {
            const angle = this.bossAngle + (i * Math.PI * 2 / ringCount);
            bullets.push(new Bullet(this.x, this.y + 20, angle, 4.5, 8, false, {
              color: '#bd00ff',
              radius: 4
            }));
          }
          if (Math.random() < 0.18) {
            audioSystem.playLaserHeavy();
            const targetAngle = Math.atan2(player.y - this.y, player.x - this.x);
            bullets.push(new Bullet(this.x, this.y + 20, targetAngle, 14, 25, false, {
              color: '#00ffff',
              radius: 5,
              isLaser: true,
              laserLength: 750
            }));
          }
        }
      }
    } else if (this.type === 'boss3') {
      // BOSS 3: VOID SINGULARITY CORRUPTOR
      if (this.bossPhase === 1) {
        // Gravity Spits: Spaced concentric 8-bullet rings (reduced from 16) with large gaps
        if (time - this.lastShootTime > this.shootDelay * 6.5) {
          this.lastShootTime = time;
          audioSystem.playLaserEnemy();
          const ringCount = 8;
          for (let i = 0; i < ringCount; i++) {
            const angle = (i * Math.PI * 2 / ringCount) + (Math.sin(time * 0.001) * 0.1);
            bullets.push(new Bullet(this.x, this.y + 20, angle, 3.5, 8, false, {
              color: '#ffaa00',
              radius: 4
            }));
          }
        }
      } else if (this.bossPhase === 2) {
        // Event Horizon: Slow drifting 6-bullet curtain (reduced from 10) & slow homing zaps
        if (time - this.lastShootTime > this.shootDelay * 5.5) {
          this.lastShootTime = time;
          audioSystem.playLaserEnemy();
          const curtainCount = 6;
          this.bossAngle += 0.05;
          for (let i = 0; i < curtainCount; i++) {
            const angle = this.bossAngle + (i * Math.PI * 2 / curtainCount);
            bullets.push(new Bullet(this.x, this.y + 20, angle, 2.2, 8, false, {
              color: '#bd00ff',
              radius: 4
            }));
          }
          if (Math.random() < 0.15) {
            audioSystem.playLaserHeavy();
            const targetAngle = Math.atan2(player.y - this.y, player.x - this.x);
            bullets.push(new Bullet(this.x, this.y + 20, targetAngle, 3.2, 15, false, {
              isHoming: true,
              homingTurnSpeed: 0.03, // much slower turn speed to allow outmaneuvering
              color: '#fff01f',
              radius: 6
            }));
          }
        }
      } else if (this.bossPhase === 3) {
        // Singularity Storm: 10-stream spirals & slow diagonal railgun warning lasers
        if (time - this.lastShootTime > this.shootDelay * 6.0) {
          this.lastShootTime = time;
          audioSystem.playLaserEnemy();
          this.bossAngle += 0.20;
          const ringCount = 10;
          for (let i = 0; i < ringCount; i++) {
            const angle = this.bossAngle + (i * Math.PI * 2 / ringCount);
            bullets.push(new Bullet(this.x, this.y + 20, angle, 5.0, 8, false, {
              color: '#ffaa00',
              radius: 4
            }));
          }
          if (Math.random() < 0.18) {
            audioSystem.playLaserHeavy();
            // Fire diagonal warning railguns that leave a completely safe central dodge corridor!
            const leftAngle = Math.PI / 3;
            const rightAngle = 2 * Math.PI / 3;
            bullets.push(new Bullet(this.x - 45, this.y + 20, leftAngle, 15, 30, false, {
              color: '#ff2d55',
              radius: 6,
              isLaser: true,
              laserLength: 800
            }));
            bullets.push(new Bullet(this.x + 45, this.y + 20, rightAngle, 15, 30, false, {
              color: '#ff2d55',
              radius: 6,
              isLaser: true,
              laserLength: 800
            }));
          }
        }
      }
    } else {
      // BOSS 1 (Void Ravager) or Default
      if (this.bossPhase === 1) {
        // Dual sweeping vertical plasma streams - wider spacing, slower shoot delay (350ms)
        if (time - this.lastShootTime > this.shootDelay * 1.6) {
          this.lastShootTime = time;
          audioSystem.playLaserEnemy();
          const sweep = Math.sin(time * 0.002) * 55;
          bullets.push(new Bullet(this.x - 30 + sweep, this.y + 20, Math.PI / 2, 5.0, 8, false, {
            color: '#00ffff',
            radius: 4
          }));
          bullets.push(new Bullet(this.x + 30 + sweep, this.y + 20, Math.PI / 2, 5.0, 8, false, {
            color: '#00ffff',
            radius: 4
          }));
        }
      } else if (this.bossPhase === 2) {
        // 3-directional (instead of 5) targeted spreads with wide dodge lanes
        if (time - this.lastShootTime > this.shootDelay * 4.0) {
          this.lastShootTime = time;
          audioSystem.playLaserEnemy();
          const targetAngle = Math.atan2(player.y - this.y, player.x - this.x);
          for (let i = -1; i <= 1; i++) {
            bullets.push(new Bullet(this.x, this.y + 20, targetAngle + i * 0.22, 5.2, 8, false, {
              color: '#00ffff',
              radius: 4
            }));
          }
        }
      } else if (this.bossPhase === 3) {
        // Curtain Storm: Alternating 8-bullet rotating arrays (reduced from 10) with 900ms delay
        if (time - this.lastShootTime > this.shootDelay * 4.2) {
          this.lastShootTime = time;
          audioSystem.playLaserEnemy();
          this.bossAngle += 0.15;
          const dir = Math.floor(time / 2000) % 2 === 0 ? 1 : -1;
          const ringCount = 8;
          for (let i = 0; i < ringCount; i++) {
            const angle = (dir * this.bossAngle) + (i * Math.PI * 2 / ringCount);
            bullets.push(new Bullet(this.x, this.y + 20, angle, 4.0, 8, false, {
              color: '#00ffff',
              radius: 4
            }));
          }
        }
      }
    }
  }

  takeDamage(amount) {
    if (this.isDead || this.y < -30) return 0;
    
    this.hp -= amount;
    ParticleFactory.spawnSpark(this.x, this.y, 0, 0, this.colorTheme);
    
    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      audioSystem.playExplosion();
      
      // Giant dramatic boss explosion
      const explosionSize = this.type.startsWith('boss') ? 45 : 12;
      ParticleFactory.spawnExplosion(this.x, this.y, this.colorTheme, explosionSize);
      
      if (this.type.startsWith('boss')) {
        // Extra mini explosions
        for (let i = 0; i < 6; i++) {
          setTimeout(() => {
            ParticleFactory.spawnExplosion(
              this.x + (Math.random() * 80 - 40),
              this.y + (Math.random() * 80 - 40),
              this.colorAccent,
              15
            );
            audioSystem.playExplosion();
          }, i * 200);
        }
      }
      
      return this.points;
    }
    
    return 0;
  }

  /**
   * Helper to draw standard or boss procedural pixel matrices
   */
  drawProcedural(ctx, matrix, size, pixelSize) {
    const halfSize = (size * pixelSize) / 2;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const val = matrix[r][c];
        if (val === 0) continue;
        ctx.fillStyle = val === 1 ? this.colorTheme : (val === 2 ? this.colorAccent : '#ffffff');
        ctx.fillRect(c * pixelSize - halfSize, r * pixelSize - halfSize, pixelSize, pixelSize);
      }
    }
  }

  draw(ctx, player) {
    if (this.isDead) return;
    
    const drawX = this.x + camera.x;
    const drawY = this.y + camera.y;
    
    // Draw Sniper targeting warning line
    if (this.type === 'sniper' && this.isChargingLaser) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 45, 85, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      
      // Laser targeting line to player
      ctx.beginPath();
      ctx.moveTo(drawX, drawY);
      ctx.lineTo(player.x + camera.x, player.y + camera.y);
      ctx.stroke();
      ctx.restore();
    }
    
    ctx.save();
    
    // Calculate organic floating hovering and flight stabilization banking wobble
    const isBoss = this.type.startsWith('boss');
    const hoverSpeed = isBoss ? 0.003 : 0.005;
    const hoverAmount = isBoss ? 6 : 0; // standard enemies are stationary vertically!
    const wobbleSpeed = isBoss ? 0.004 : 0.007;
    const wobbleAmount = isBoss ? 0.04 : 0.08;
    
    const hoverY = Math.sin(Date.now() * hoverSpeed + this.spawnTime) * hoverAmount;
    const wobbleAngle = Math.sin(Date.now() * wobbleSpeed + this.spawnTime) * wobbleAmount;
    
    ctx.translate(drawX, drawY + hoverY);
    ctx.rotate(wobbleAngle);
    
    // Pulsing glowing cores
    const pulseAlpha = 0.88 + Math.sin(Date.now() * 0.006 + this.spawnTime) * 0.12;
    ctx.globalAlpha = pulseAlpha;
    ctx.shadowBlur = this.radius * (0.8 + Math.sin(Date.now() * 0.006) * 0.4);
    ctx.shadowColor = this.colorTheme;
    
    if (this.type.startsWith('boss')) {
      const bossSprite = spriteLoader.get(this.type);
      
      if (bossSprite) {
        // Draw colossal 16-bit boss image centered
        ctx.drawImage(bossSprite, -68, -68, 136, 136);
      } else {
        // Fallback to 16x16 massive boss matrix
        this.drawProcedural(ctx, BOSS_SPRITE, 16, 6); // renders boss as massive 96x96 sprite
      }
      
      // Draw dynamic glowing boss shield ring (visual fluff)
      if (this.type === 'boss2') {
        // Boss 2: Rotating double concentric circles
        ctx.save();
        ctx.lineWidth = 1.5;
        
        ctx.strokeStyle = this.colorTheme;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 8 + Math.sin(Date.now() * 0.003) * 3, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.strokeStyle = this.colorAccent;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius - 4 + Math.cos(Date.now() * 0.003) * 3, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.restore();
      } else if (this.type === 'boss3') {
        // Boss 3: Glowing hazard hexagon
        ctx.save();
        ctx.rotate(Date.now() * 0.0008);
        ctx.strokeStyle = this.colorTheme;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        const hexRadius = this.radius + 12 + Math.sin(Date.now() * 0.004) * 4;
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          const hx = Math.cos(angle) * hexRadius;
          const hy = Math.sin(angle) * hexRadius;
          if (i === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      } else {
        // Boss 1 / Default: Rotating square
        ctx.save();
        ctx.rotate(Date.now() * 0.001);
        ctx.strokeStyle = this.colorTheme;
        ctx.lineWidth = 2;
        const size = (this.radius + Math.sin(Date.now() * 0.005) * 4) * 1.2;
        ctx.strokeRect(-size / 2, -size / 2, size, size);
        ctx.restore();
      }
      
    } else {
      // Draw standard enemy
      let suffix = 'city';
      if (this.stage === 2) suffix = 'forest';
      else if (this.stage === 3) suffix = 'fortress';
      
      const spriteKey = `${this.type}_${suffix}`;
      const enemySprite = spriteLoader.get(spriteKey);
      
      if (enemySprite) {
        // Draw custom animated glowing alien thruster exhaust plumes before drawing the ship
        // standard enemies point DOWN, so the rear is at Y = -22 (pointing UPwards)
        const flicker = 0.85 + Math.sin(Date.now() * 0.12) * 0.15 + Math.random() * 0.08;
        
        ctx.save();
        ctx.translate(0, -22); // at the rear of standard enemies
        
        if (this.type === 'drone') {
          // Drone: 1 sleek green plasma flame
          ctx.fillStyle = '#39ff14';
          ctx.beginPath();
          ctx.moveTo(-5 * flicker, 0);
          ctx.lineTo(5 * flicker, 0);
          ctx.lineTo(0, -14 * flicker); // pointing upwards
          ctx.closePath();
          ctx.fill();
        } else if (this.type === 'spinner') {
          // Spinner: 2 purple flickering plasma fire ports
          ctx.fillStyle = '#bd00ff';
          ctx.shadowBlur = 6;
          ctx.shadowColor = '#bd00ff';
          ctx.beginPath();
          ctx.arc(-8, -4 * flicker, 3 * flicker, 0, Math.PI * 2);
          ctx.arc(8, -4 * flicker, 3 * flicker, 0, Math.PI * 2);
          ctx.fill();
        } else if (this.type === 'sniper') {
          // Sniper: dual thin hot-pink plasma trails
          ctx.fillStyle = '#ff2d55';
          ctx.beginPath();
          ctx.moveTo(-7, 0);
          ctx.lineTo(-4, 0);
          ctx.lineTo(-5.5, -16 * flicker);
          ctx.closePath();
          ctx.fill();
          
          ctx.beginPath();
          ctx.moveTo(4, 0);
          ctx.lineTo(7, 0);
          ctx.lineTo(5.5, -16 * flicker);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        
        // Symmetrical top-down standard enemy naturally points DOWN (no -Math.PI / 2 rotation offset needed)
        ctx.drawImage(enemySprite, -28, -28, 56, 56);
      } else {
        // Fallback to 8x8 standard enemy matrix
        // The procedural matrix faces UP, so we rotate 180 degrees (Math.PI) to face DOWNWARD
        ctx.rotate(Math.PI);
        const matrix = ENEMY_SPRITES[this.type] || ENEMY_SPRITES.drone;
        this.drawProcedural(ctx, matrix, 8, 4);
      }
    }
    
    ctx.restore();
  }
}

/**
 * XP Crystal Gem dropped by defeated enemies
 */
export class XPGem {
  constructor(x, y, amount = 15) {
    this.x = x;
    this.y = y;
    this.amount = amount;
    
    this.vx = 0;
    this.vy = 0;
    this.radius = 4;
    this.color = '#39ff14'; // emerald green
    this.isDead = false;
  }

  update(player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const distSq = dx * dx + dy * dy;
    const magnetRange = player.magnetRange;
    const magnetSq = magnetRange * magnetRange;
    
    // Magnetic pull if player close
    if (distSq < magnetSq) {
      const dist = Math.sqrt(distSq);
      if (dist > 0.1) {
        const pullForce = (magnetRange - dist) / magnetRange * 3.0; // accelerates closer (5.0 * 0.6 = 3.0)
        this.vx += (dx / dist) * pullForce;
        this.vy += (dy / dist) * pullForce;
      }
      
      // Inertia clamping
      this.x += this.vx;
      this.y += this.vy;
      this.vx *= 0.85;
      this.vy *= 0.85;
    } else {
      // float gently downwards
      this.y += 0.5;
    }
    
    // XP gem spawn trail
    ParticleFactory.spawnXPTrail(this.x, this.y, this.color);
  }

  draw(ctx) {
    const drawX = this.x + camera.x;
    const drawY = this.y + camera.y;
    
    ctx.save();
    // Glowing emerald crystal diamonds
    ctx.shadowBlur = 6;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    
    ctx.beginPath();
    ctx.moveTo(drawX, drawY - 6);
    ctx.lineTo(drawX + 4, drawY);
    ctx.lineTo(drawX, drawY + 6);
    ctx.lineTo(drawX - 4, drawY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Health Pack dropped rarely by enemies
 */
export class HealthPack {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 8;
    this.color = '#ff2d55';
    this.healAmount = 25;
    this.isDead = false;
  }

  update() {
    this.y += 0.4; // float down
  }

  draw(ctx) {
    const drawX = this.x + camera.x;
    const drawY = this.y + camera.y;
    
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.color;
    
    // Draw cross pill kit
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(drawX - 8, drawY - 8, 16, 16);
    
    ctx.fillStyle = this.color;
    ctx.fillRect(drawX - 2, drawY - 6, 4, 12);
    ctx.fillRect(drawX - 6, drawY - 2, 12, 4);
    
    ctx.restore();
  }
}

/**
 * PowerUp dropped by defeated enemies
 * 'P': Firepower Shot upgrade
 * 'B': Void Bomb restore
 * 'H': Health/Shield restore
 */
export class PowerUp {
  constructor(x, y, type = 'P') {
    this.x = x;
    this.y = y;
    this.type = type; // 'P' (Firepower), 'B' (Bomb), 'H' (Heal), 'S' (Super Charge)
    this.radius = 10;
    this.isDead = false;
    
    // Cyber colors
    this.color = type === 'P' ? '#ff2d55' : (type === 'B' ? '#fff01f' : (type === 'S' ? '#bd00ff' : '#00ffff'));
  }

  update() {
    this.y += 0.55; // float down
  }

  draw(ctx) {
    const drawX = this.x + camera.x;
    const drawY = this.y + camera.y;
    
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    
    // Draw neon cybernetic powerup octagon
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2.0;
    ctx.fillStyle = 'rgba(7, 7, 13, 0.85)';
    
    ctx.beginPath();
    const size = 9;
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const px = drawX + Math.cos(angle) * size;
      const py = drawY + Math.sin(angle) * size;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Letter inside
    ctx.font = 'bold 8px "Press Start 2P"';
    ctx.fillStyle = this.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.type, drawX, drawY);
    
    ctx.restore();
  }
}
