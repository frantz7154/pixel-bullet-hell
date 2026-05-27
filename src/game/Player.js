/**
 * Player.js - Player Spaceship Entity & Upgrade Integration
 * Implements movement, ship attributes, procedural 8x8 pixel drawings,
 * and firing systems (Double Shot, Rear Blast, Homing Rockets, Orbit Shield, Sub-drones).
 */
import { Bullet } from './Bullet.js';
import { ParticleFactory, camera } from './Particle.js';
import audioSystem from './AudioSystem.js';
import spriteLoader from './SpriteLoader.js';

// Procedural 8x8 pixel matrices for ships
// 0: empty, 1: primary theme, 2: secondary accent, 3: glowing cockpit (white)
const SHIP_SPRITES = {
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

export class Player {
  constructor(canvasWidth, canvasHeight, shipType = 'vanguard') {
    this.x = canvasWidth / 2;
    this.y = canvasHeight * 0.8;
    this.vx = 0;
    this.vy = 0;
    
    // Choose ship blueprint properties
    this.shipType = shipType;
    this.initShipStats();
    
    // Position/Aiming
    this.radius = 16; // Hitbox radius
    this.angle = -Math.PI / 2; // Face upwards
    
    // Progress
    this.level = 1;
    this.xp = 0;
    this.xpToNextLevel = 100;
    this.score = 0;
    
    // Keyboard controller values
    this.moveSpeed = this.baseMoveSpeed;
    this.inertia = 0.85; // Inertial dampening
    
    // Cooldowns
    this.lastFireTime = 0;
    this.lastHomingTime = 0;
    this.lastDamageTime = 0;
    this.invincibilityDuration = 800; // ms after damage
    
    // Upgrades dictionary
    this.upgrades = {};
    
    // Weapon configurations
    this.hasDoubleShot = false;
    this.hasRearShot = false;
    this.hasHomingMissile = false;
    this.hasAutoAim = false;
    this.bulletPierce = 1;
    this.bulletDamage = this.baseBulletDamage;
    
    // Aegis shield orbit bullets
    this.orbitShieldCount = 0;
    this.orbitBullets = [];
    
    // Sentinel sub-drones
    this.drones = [];
    this.lastDroneFire = 0;

    // Premium Upgrades
    this.hasChronoField = false;
    this.chronoFieldRadius = 120;
    this.hasShadowClone = false;
    this.posHistory = [];
    this.hasHeavyMissile = false;
    this.lastHeavyMissileTime = 0;
  }

  initShipStats() {
    this.upgrades = {};
    this.hasDoubleShot = false;
    this.hasRearShot = false;
    this.hasHomingMissile = false;
    this.hasAutoAim = false;
    this.bulletPierce = 1;
    this.orbitShieldCount = 0;
    this.hasChronoField = false;
    this.hasShadowClone = false;
    this.posHistory = [];
    this.hasHeavyMissile = false;
    this.lastHeavyMissileTime = 0;
    
    switch (this.shipType) {
      case 'aegis':
        this.maxHp = 125;
        this.maxShield = 75;
        this.baseMoveSpeed = 4.2;
        this.fireDelay = 220; // slow but tanky
        this.baseBulletDamage = 16;
        this.colorTheme = '#bd00ff';
        this.colorAccent = '#00ffff';
        this.hasAegisShield = true; // special shield
        break;
      case 'sentinel':
        this.maxHp = 90;
        this.maxShield = 40;
        this.baseMoveSpeed = 6.2;
        this.fireDelay = 180;
        this.baseBulletDamage = 10;
        this.colorTheme = '#ff2d55';
        this.colorAccent = '#fff01f';
        this.hasAegisShield = false;
        // Spawns 2 satellite helper drones
        this.spawnDrones();
        break;
      case 'vanguard':
      default:
        this.maxHp = 100;
        this.maxShield = 50;
        this.baseMoveSpeed = 5.2;
        this.fireDelay = 140; // rapid fire
        this.baseBulletDamage = 12;
        this.colorTheme = '#00ffff';
        this.colorAccent = '#ff2d55';
        this.hasAegisShield = false;
        break;
    }
    
    this.hp = this.maxHp;
    this.shield = this.maxShield;
    this.shieldRegenRate = 0.05; // points per frame
    this.bombs = 2;
    this.maxBombs = 3;
    this.magnetRange = 75; // Gem pick up distance
  }

  spawnDrones() {
    this.drones = [
      { angle: 0, distance: 40, x: 0, y: 0 },
      { angle: Math.PI, distance: 40, x: 0, y: 0 }
    ];
  }

  move(dx, dy) {
    // Standard keyboard movement (applies force/acceleration)
    this.vx += dx * this.moveSpeed * 0.15;
    this.vy += dy * this.moveSpeed * 0.15;
  }

  update(keys, mouseX, mouseY, canvasWidth, canvasHeight, bullets, enemies) {
    // Maintain trailing coordinate history for the Shadow Clone
    this.posHistory.push({ x: this.x, y: this.y, angle: this.angle });
    if (this.posHistory.length > 15) {
      this.posHistory.shift();
    }

    // 1. Apply inertia & update position
    this.vx *= this.inertia;
    this.vy *= this.inertia;
    
    this.x += this.vx;
    this.y += this.vy;
    
    // Bound clamps
    if (this.x < this.radius) { this.x = this.radius; this.vx = 0; }
    if (this.x > canvasWidth - this.radius) { this.x = canvasWidth - this.radius; this.vx = 0; }
    if (this.y < this.radius) { this.y = this.radius; this.vy = 0; }
    if (this.y > canvasHeight - this.radius) { this.y = canvasHeight - this.radius; this.vy = 0; }
    
    // 2. Point ship upwards (vertical shooter style) with visual banking on movement keys
    if (this.hasAutoAim) {
      const nearest = this.findNearestEnemy(enemies);
      if (nearest) {
        this.angle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
      } else {
        this.angle = -Math.PI / 2;
      }
    } else {
      this.angle = -Math.PI / 2;
      if (keys['a'] || keys['arrowleft']) {
        this.angle -= 0.15; // bank left
      }
      if (keys['d'] || keys['arrowright']) {
        this.angle += 0.15; // bank right
      }
    }
    
    // 3. Shield auto regeneration
    if (this.shield < this.maxShield) {
      this.shield = Math.min(this.maxShield, this.shield + this.shieldRegenRate);
    }
    
    // 4. Emit engine thrust particles
    ParticleFactory.spawnThruster(
      this.x - Math.cos(this.angle) * 12,
      this.y - Math.sin(this.angle) * 12,
      this.angle,
      this.colorTheme
    );
    
    // 5. Update sub-drones (Sentinel class)
    if (this.shipType === 'sentinel') {
      const time = Date.now();
      this.drones.forEach((drone, idx) => {
        // Drone rotates around player
        drone.angle += 0.04;
        drone.x = this.x + Math.cos(drone.angle) * drone.distance;
        drone.y = this.y + Math.sin(drone.angle) * drone.distance;
        
        // Emit tiny sub-thruster
        ParticleFactory.spawnThruster(drone.x, drone.y, drone.angle, '#ff2d55');
        
        // Drone auto-firing
        if (time - this.lastDroneFire > 400) {
          const nearest = this.findNearestEnemy(enemies);
          if (nearest) {
            const droneAngle = Math.atan2(nearest.y - drone.y, nearest.x - drone.x);
            // Spawn drone spark zap bullet
            bullets.push(new Bullet(drone.x, drone.y, droneAngle, 10, this.bulletDamage * 0.4, true, {
              color: '#ff2d55',
              radius: 2.5
            }));
          }
        }
      });
      if (time - this.lastDroneFire > 400) {
        this.lastDroneFire = time;
      }
    }
    
    // 6. Update Orbiting Shield Orbs (Upgrade)
    this.updateOrbitShields(bullets);
  }

  updateOrbitShields(bullets) {
    if (this.orbitShieldCount <= 0) return;
    
    // Remove dead orbiters
    this.orbitBullets = this.orbitBullets.filter(b => !b.isDead);
    
    // Spawn missing shield orbs
    while (this.orbitBullets.length < this.orbitShieldCount) {
      const angle = (this.orbitBullets.length / this.orbitShieldCount) * Math.PI * 2;
      const orb = new Bullet(this.x, this.y, angle, 0, this.bulletDamage * 0.75, true, {
        isOrbiting: true,
        orbitRadius: 70 + this.orbitBullets.length * 10,
        orbitSpeed: 0.04 + this.orbitBullets.length * 0.005,
        orbitCenter: this,
        orbitAngle: angle,
        color: '#bd00ff',
        radius: 6,
        pierce: 9999 // semi-permanent
      });
      this.orbitBullets.push(orb);
      bullets.push(orb);
    }
  }

  fire(bullets) {
    const time = Date.now();
    if (time - this.lastFireTime < this.fireDelay) return false;
    
    this.lastFireTime = time;
    audioSystem.playLaser();
    
    const bulletSpeed = 13 + (this.upgrades['rapid_fire'] || 0) * 1.5;
    
    // Periodic Heavy Missile launches
    if (this.hasHeavyMissile && time - this.lastHeavyMissileTime > 3000) {
      this.lastHeavyMissileTime = time;
      bullets.push(new Bullet(this.x, this.y, this.angle, 5, this.bulletDamage * 3.5, true, {
        isHeavyMissile: true,
        color: '#ffaa00',
        radius: 8,
        pierce: 1
      }));
    }

    // Shadow Clone duplicates shots at 50% power
    if (this.hasShadowClone && this.posHistory.length >= 12) {
      const clonePos = this.posHistory[0];
      bullets.push(new Bullet(clonePos.x, clonePos.y, clonePos.angle, bulletSpeed * 0.9, this.bulletDamage * 0.5, true, {
        pierce: this.bulletPierce,
        color: '#ff2d55',
        radius: 3
      }));
    }
    
    // Front Shot
    if (this.hasDoubleShot) {
      // Secondary twin parallel wing barrels
      const barrelOffset = 14;
      const bx1 = this.x + Math.cos(this.angle + Math.PI / 2) * barrelOffset;
      const by1 = this.y + Math.sin(this.angle + Math.PI / 2) * barrelOffset;
      const bx2 = this.x + Math.cos(this.angle - Math.PI / 2) * barrelOffset;
      const by2 = this.y + Math.sin(this.angle - Math.PI / 2) * barrelOffset;
      
      bullets.push(new Bullet(bx1, by1, this.angle, bulletSpeed, this.bulletDamage, true, {
        pierce: this.bulletPierce,
        color: this.colorTheme
      }));
      bullets.push(new Bullet(bx2, by2, this.angle, bulletSpeed, this.bulletDamage, true, {
        pierce: this.bulletPierce,
        color: this.colorTheme
      }));
    } else {
      // Standard single center barrel
      bullets.push(new Bullet(this.x, this.y, this.angle, bulletSpeed, this.bulletDamage, true, {
        pierce: this.bulletPierce,
        color: this.colorTheme
      }));
    }
    
    // Rear Blaster Upgrade
    if (this.hasRearShot) {
      bullets.push(new Bullet(this.x, this.y, this.angle + Math.PI, bulletSpeed * 0.8, this.bulletDamage * 0.8, true, {
        pierce: this.bulletPierce,
        color: '#ff2d55'
      }));
    }
    
    // 7. Fire Homing Missiles Upgrade
    if (this.hasHomingMissile && time - this.lastHomingTime > 600 - (this.homingLevel * 80)) {
      this.lastHomingTime = time;
      const missileCount = 1 + Math.floor(this.homingLevel / 2);
      
      for (let i = 0; i < missileCount; i++) {
        // Fire homing bullet pointing outwards at random spreads
        const missileAngle = this.angle + Math.PI + (Math.random() * 1.5 - 0.75);
        bullets.push(new Bullet(this.x, this.y, missileAngle, 5, this.bulletDamage * 0.9, true, {
          isHoming: true,
          homingTurnSpeed: 0.08,
          color: '#fff01f',
          radius: 5
        }));
      }
    }
    
    return true;
  }

  deployVoidBomb(bullets) {
    if (this.bombs <= 0) return false;
    
    this.bombs--;
    audioSystem.playBomb();
    
    // Spawn massive shockwave expanding ring
    ParticleFactory.spawnBombShockwave(this.x, this.y, '#fff01f');
    
    // Kill off visible enemy bullets
    bullets.forEach(b => {
      if (!b.isPlayer) {
        b.isDead = true;
        // spawn spark rings on explosion
        ParticleFactory.spawnSpark(b.x, b.y, 0, 0, '#fff01f');
      }
    });
    
    return true;
  }

  takeDamage(amount) {
    const time = Date.now();
    if (time - this.lastDamageTime < this.invincibilityDuration) return false;
    
    this.lastDamageTime = time;
    camera.shake(6);
    
    // Absorb with shield first
    if (this.shield > 0) {
      audioSystem.playShieldHit();
      if (this.shield >= amount) {
        this.shield -= amount;
      } else {
        const remaining = amount - this.shield;
        this.shield = 0;
        this.hp -= remaining;
        audioSystem.playHit();
      }
    } else {
      this.hp -= amount;
      audioSystem.playHit();
    }
    
    // Spawn damage embers
    ParticleFactory.spawnExplosion(this.x, this.y, '#ff2d55', 8);
    
    if (this.hp <= 0) {
      this.hp = 0;
      this.isDead = true;
      audioSystem.playExplosion();
      ParticleFactory.spawnExplosion(this.x, this.y, '#ffffff', 40);
    }
    
    return true;
  }

  gainXP(amount) {
    this.xp += amount;
    if (this.xp >= this.xpToNextLevel) {
      this.xp -= this.xpToNextLevel;
      this.level++;
      this.xpToNextLevel = Math.floor(this.xpToNextLevel * 1.35 + 50);
      audioSystem.playUpgrade();
      return true; // Leveled up!
    }
    return false;
  }

  findNearestEnemy(enemies) {
    let nearest = null;
    let minDist = Infinity;
    enemies.forEach(e => {
      if (e.isDead || e.y < -50) return;
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      const d = dx * dx + dy * dy;
      if (d < minDist) {
        minDist = d;
        nearest = e;
      }
    });
    return nearest;
  }

  /**
   * Draws the beautiful 8x8 procedural pixel spacecraft
   */
  draw(ctx) {
    if (this.isDead) return;
    
    // Draw Chrono Field
    if (this.hasChronoField) {
      ctx.save();
      ctx.translate(this.x + camera.x, this.y + camera.y);
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 8]);
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#00ffff';
      
      // Draw rotating circle outline
      ctx.rotate((Date.now() / 1500) % (Math.PI * 2));
      ctx.beginPath();
      ctx.arc(0, 0, this.chronoFieldRadius || 120, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw light translucent blue center glow
      ctx.fillStyle = 'rgba(0, 255, 255, 0.03)';
      ctx.beginPath();
      ctx.arc(0, 0, this.chronoFieldRadius || 120, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();
    }

    const shipSprite = spriteLoader.get(this.shipType);

    // Draw Shadow Clone
    if (this.hasShadowClone && this.posHistory.length >= 12) {
      const clonePos = this.posHistory[0];
      ctx.save();
      ctx.translate(clonePos.x + camera.x, clonePos.y + camera.y);
      ctx.rotate(clonePos.angle + Math.PI / 2);
      ctx.globalAlpha = 0.45;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ff2d55';
      
      if (shipSprite) {
        // Draw 16-bit shadow clone sprite (rotate 90 deg clockwise to face UP)
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(shipSprite, -26, -26, 52, 52);
      } else {
        const matrix = SHIP_SPRITES[this.shipType] || SHIP_SPRITES.vanguard;
        const pixelSize = 4;
        const halfSize = (8 * pixelSize) / 2;
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const pixelValue = matrix[r][c];
            if (pixelValue === 0) continue;
            ctx.fillStyle = '#ff2d55';
            ctx.fillRect(c * pixelSize - halfSize, r * pixelSize - halfSize, pixelSize, pixelSize);
          }
        }
      }
      ctx.restore();
    }
    
    ctx.save();
    
    // Apply camera shaking and ship translation
    ctx.translate(this.x + camera.x, this.y + camera.y);
    // Rotate to face shooting direction
    ctx.rotate(this.angle + Math.PI / 2); // default matrices face up, Math.PI/2 compensates
    
    // Optional glow background
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.colorTheme;
    
    if (shipSprite) {
      // Draw premium 16-bit pixel art spaceship!
      // Rotate 90 degrees clockwise because original PNG points to the left
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(shipSprite, -26, -26, 52, 52);
    } else {
      // Fallback to procedural
      const matrix = SHIP_SPRITES[this.shipType] || SHIP_SPRITES.vanguard;
      const pixelSize = 4; // 8x8 sprite rendered at 32x32 size
      const halfSize = (8 * pixelSize) / 2;
      
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const pixelValue = matrix[r][c];
          if (pixelValue === 0) continue;
          
          if (pixelValue === 1) {
            ctx.fillStyle = this.colorTheme;
          } else if (pixelValue === 2) {
            ctx.fillStyle = this.colorAccent;
          } else if (pixelValue === 3) {
            ctx.fillStyle = '#ffffff'; // White windshield
          }
          
          ctx.fillRect(
            c * pixelSize - halfSize,
            r * pixelSize - halfSize,
            pixelSize,
            pixelSize
          );
        }
      }
    }
    
    ctx.restore();
    
    // Draw Sentinel Satellite Helper Drones
    if (this.shipType === 'sentinel' && this.drones) {
      this.drones.forEach(drone => {
        ctx.save();
        ctx.translate(drone.x + camera.x, drone.y + camera.y);
        ctx.rotate(drone.angle * 2);
        ctx.fillStyle = '#ff2d55';
        ctx.fillRect(-4, -4, 8, 8);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-2, -2, 4, 4);
        ctx.restore();
      });
    }
  }
}
