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

    // Super ability status variables
    this.firepowerLevel = 1;
    this.superPower = 0;
    this.superActive = false;
    this.superType = '';
    this.superEndTime = 0;
  }

  initShipStats() {
    this.upgrades = {};
    this.hasDoubleShot = false;
    this.hasRearShot = false;
    this.hasHomingMissile = false;
    this.homingLevel = 0;
    this.hasAutoAim = false;
    this.bulletPierce = 1;
    this.orbitShieldCount = 0;
    this.hasChronoField = false;
    this.hasShadowClone = false;
    this.posHistory = [];
    this.hasHeavyMissile = false;
    this.lastHeavyMissileTime = 0;
    this.firepowerLevel = 1;
    this.superPower = 0;
    this.superActive = false;
    this.superType = '';
    this.superEndTime = 0;
    
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
    // Check if Super activation key is pressed
    if ((keys['v'] || keys['V']) && this.superPower >= 100 && !this.superActive) {
      this.superPower = 0;
      this.superActive = true;
      this.superType = this.shipType;
      
      let duration = 4000; // Vanguard: 4s
      if (this.shipType === 'aegis') duration = 6000; // Aegis: 6s
      else if (this.shipType === 'sentinel') duration = 5000; // Sentinel: 5s
      
      this.superEndTime = Date.now() + duration;
      audioSystem.playUpgrade(); // Play activation audio feedback
    }

    // Super decay / ending check
    if (this.superActive) {
      if (Date.now() > this.superEndTime) {
        this.superActive = false;
        this.superType = '';
        if (this.shipType === 'sentinel') {
          this.spawnDrones(); // Reset to 2 drones
        }
      }
    }

    // Vanguard ultimate column beam tick & bullet clear
    if (this.superActive && this.superType === 'vanguard') {
      enemies.forEach(e => {
        if (!e.isDead && e.x >= this.x - 40 && e.x <= this.x + 40 && e.y <= this.y) {
          e.takeDamage(1.5);
          if (Math.random() < 0.2) {
            ParticleFactory.spawnSpark(e.x, e.y, 0, 0, '#00ffff');
          }
        }
      });
      bullets.forEach(b => {
        if (!b.isPlayer && b.x >= this.x - 40 && b.x <= this.x + 40 && b.y <= this.y) {
          b.isDead = true;
        }
      });
    }

    // Aegis ultimate barrier push & bullet clear
    if (this.superActive && this.superType === 'aegis') {
      enemies.forEach(e => {
        if (!e.isDead) {
          const dx = e.x - this.x;
          const dy = e.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            const angle = Math.atan2(dy, dx);
            e.x = this.x + Math.cos(angle) * 120;
            e.y = this.y + Math.sin(angle) * 120;
            e.vx = Math.cos(angle) * 4;
            e.vy = Math.sin(angle) * 4;
          }
        }
      });
      bullets.forEach(b => {
        if (!b.isPlayer) {
          const dx = b.x - this.x;
          const dy = b.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            b.isDead = true;
          }
        }
      });
    }

    // Sentinel ultimate helper drones expand & rapid zap
    if (this.superActive && this.superType === 'sentinel') {
      if (this.drones.length !== 8) {
        this.drones = [];
        for (let i = 0; i < 8; i++) {
          this.drones.push({ angle: (i / 8) * Math.PI * 2, distance: 60, x: 0, y: 0 });
        }
      }
      
      const time = Date.now();
      this.drones.forEach((drone, idx) => {
        drone.angle += 0.08;
        drone.x = this.x + Math.cos(drone.angle) * drone.distance;
        drone.y = this.y + Math.sin(drone.angle) * drone.distance;
        
        if (Math.random() < 0.3) {
          ParticleFactory.spawnThruster(drone.x, drone.y, drone.angle, '#ff2d55');
        }
        
        if (!drone.lastSuperFire || time - drone.lastSuperFire > 120) {
          drone.lastSuperFire = time;
          const nearest = this.findNearestEnemy(enemies);
          if (nearest) {
            const droneAngle = Math.atan2(nearest.y - drone.y, nearest.x - drone.x);
            bullets.push(new Bullet(drone.x, drone.y, droneAngle, 16, this.bulletDamage * 0.5, true, {
              color: '#ff2d55',
              radius: 3,
              isLaser: true,
              laserLength: 120,
              isSentinelBullet: true
            }));
          }
        }
      });
    }

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
    const prevX = this.x, prevY = this.y;
    this.x = Math.max(this.radius, Math.min(canvasWidth - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(canvasHeight - this.radius, this.y));
    if (this.x !== prevX) this.vx = 0;
    if (this.y !== prevY) this.vy = 0;
    
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
    if (this.shipType === 'sentinel' && !(this.superActive && this.superType === 'sentinel')) {
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
    
    // Setup ship-specific bullet options based on ship type
    let bOptions = { pierce: this.bulletPierce };
    if (this.shipType === 'vanguard') {
      bOptions.color = '#00ffff';
      bOptions.radius = 4;
      bOptions.isVanguardBullet = true;
    } else if (this.shipType === 'aegis') {
      bOptions.color = '#bd00ff';
      bOptions.radius = 6;
      bOptions.isAegisBullet = true;
    } else if (this.shipType === 'sentinel') {
      bOptions.color = '#ff2d55';
      bOptions.radius = 3;
      bOptions.isSentinelBullet = true;
    }

    const lvl = this.firepowerLevel || 1;
    if (lvl === 1) {
      bullets.push(new Bullet(this.x, this.y, this.angle, bulletSpeed, this.bulletDamage, true, bOptions));
    } else if (lvl === 2) {
      const bx1 = this.x + Math.cos(this.angle + Math.PI / 2) * 10;
      const by1 = this.y + Math.sin(this.angle + Math.PI / 2) * 10;
      const bx2 = this.x + Math.cos(this.angle - Math.PI / 2) * 10;
      const by2 = this.y + Math.sin(this.angle - Math.PI / 2) * 10;
      bullets.push(new Bullet(bx1, by1, this.angle, bulletSpeed, this.bulletDamage, true, bOptions));
      bullets.push(new Bullet(bx2, by2, this.angle, bulletSpeed, this.bulletDamage, true, bOptions));
    } else if (lvl === 3) {
      bullets.push(new Bullet(this.x, this.y, this.angle, bulletSpeed, this.bulletDamage, true, bOptions));
      bullets.push(new Bullet(this.x, this.y, this.angle - 0.15, bulletSpeed, this.bulletDamage, true, bOptions));
      bullets.push(new Bullet(this.x, this.y, this.angle + 0.15, bulletSpeed, this.bulletDamage, true, bOptions));
    } else if (lvl === 4) {
      const bx1 = this.x + Math.cos(this.angle + Math.PI / 2) * 10;
      const by1 = this.y + Math.sin(this.angle + Math.PI / 2) * 10;
      const bx2 = this.x + Math.cos(this.angle - Math.PI / 2) * 10;
      const by2 = this.y + Math.sin(this.angle - Math.PI / 2) * 10;
      bullets.push(new Bullet(bx1, by1, this.angle, bulletSpeed, this.bulletDamage, true, bOptions));
      bullets.push(new Bullet(bx2, by2, this.angle, bulletSpeed, this.bulletDamage, true, bOptions));
      
      const bdx1 = this.x + Math.cos(this.angle + Math.PI / 2) * 15;
      const bdy1 = this.y + Math.sin(this.angle + Math.PI / 2) * 15;
      const bdx2 = this.x + Math.cos(this.angle - Math.PI / 2) * 15;
      const bdy2 = this.y + Math.sin(this.angle - Math.PI / 2) * 15;
      bullets.push(new Bullet(bdx1, bdy1, this.angle - 0.2, bulletSpeed, this.bulletDamage, true, bOptions));
      bullets.push(new Bullet(bdx2, bdy2, this.angle + 0.2, bulletSpeed, this.bulletDamage, true, bOptions));
    } else if (lvl >= 5) {
      bullets.push(new Bullet(this.x, this.y, this.angle, bulletSpeed, this.bulletDamage, true, bOptions));
      
      const bx1 = this.x + Math.cos(this.angle + Math.PI / 2) * 10;
      const by1 = this.y + Math.sin(this.angle + Math.PI / 2) * 10;
      const bx2 = this.x + Math.cos(this.angle - Math.PI / 2) * 10;
      const by2 = this.y + Math.sin(this.angle - Math.PI / 2) * 10;
      bullets.push(new Bullet(bx1, by1, this.angle, bulletSpeed, this.bulletDamage, true, bOptions));
      bullets.push(new Bullet(bx2, by2, this.angle, bulletSpeed, this.bulletDamage, true, bOptions));
      
      const bdx1 = this.x + Math.cos(this.angle + Math.PI / 2) * 18;
      const bdy1 = this.y + Math.sin(this.angle + Math.PI / 2) * 18;
      const bdx2 = this.x + Math.cos(this.angle - Math.PI / 2) * 18;
      const bdy2 = this.y + Math.sin(this.angle - Math.PI / 2) * 18;
      bullets.push(new Bullet(bdx1, bdy1, this.angle - 0.25, bulletSpeed, this.bulletDamage, true, bOptions));
      bullets.push(new Bullet(bdx2, bdy2, this.angle + 0.25, bulletSpeed, this.bulletDamage, true, bOptions));
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
    if (this.superActive && this.superType === 'aegis') return false;
    
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
   * Helper to draw the procedural spaceship matrix
   */
  drawProceduralShip(ctx, colorTheme = this.colorTheme, colorAccent = this.colorAccent, forceSingleColor = false) {
    const matrix = SHIP_SPRITES[this.shipType] || SHIP_SPRITES.vanguard;
    const pixelSize = 4;
    const halfSize = 16; // (8 * 4) / 2
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const val = matrix[r][c];
        if (val === 0) continue;
        ctx.fillStyle = forceSingleColor ? colorTheme : (val === 1 ? colorTheme : (val === 2 ? colorAccent : '#ffffff'));
        ctx.fillRect(c * pixelSize - halfSize, r * pixelSize - halfSize, pixelSize, pixelSize);
      }
    }
  }

  /**
   * Draws detailed animated flickering 16-bit retro thruster exhaust flames
   */
  drawThrusterFlames(ctx) {
    const time = Date.now();
    const flicker = 0.85 + Math.sin(time * 0.08) * 0.15 + Math.random() * 0.08;
    
    // Choose nozzle positions and colors depending on ship class
    let nozzles = [];
    let colors = { outer: '#ff2d55', middle: '#ff9500', inner: '#ffffff' }; // default
    
    if (this.shipType === 'vanguard') {
      nozzles = [{ x: -10, y: 30, w: 6, h: 20 }, { x: 10, y: 30, w: 6, h: 20 }];
      colors = { outer: '#00ffff', middle: '#0088ff', inner: '#ffffff' }; // Cyan plasma
    } else if (this.shipType === 'aegis') {
      nozzles = [{ x: -16, y: 26, w: 8, h: 18 }, { x: 0, y: 28, w: 10, h: 24 }, { x: 16, y: 26, w: 8, h: 18 }];
      colors = { outer: '#bd00ff', middle: '#00ffff', inner: '#ffffff' }; // Violet / Cyan crystal shields
    } else if (this.shipType === 'sentinel') {
      nozzles = [{ x: -12, y: 32, w: 5, h: 22 }, { x: 12, y: 32, w: 5, h: 22 }];
      colors = { outer: '#ff2d55', middle: '#fff01f', inner: '#ffffff' }; // Crimson / Yellow kinetic flame
    } else {
      nozzles = [{ x: 0, y: 30, w: 8, h: 20 }];
    }
    
    nozzles.forEach(nozzle => {
      ctx.save();
      ctx.translate(nozzle.x, nozzle.y);
      
      const nw = nozzle.w * flicker;
      const nh = nozzle.h * flicker;
      
      // Outer flame (largest)
      ctx.fillStyle = colors.outer;
      ctx.beginPath();
      ctx.moveTo(-nw, 0);
      ctx.lineTo(nw, 0);
      ctx.lineTo(0, nh);
      ctx.closePath();
      ctx.fill();
      
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
  }

  /**
   * Draws the beautiful 8x8 procedural pixel spacecraft
   */
  draw(ctx) {
    if (this.isDead) return;
    
    // Draw Vanguard Hyperion Beam Visual Overlay
    if (this.superActive && this.superType === 'vanguard') {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.05) * 0.2;
      ctx.fillStyle = '#00ffff';
      ctx.shadowBlur = 30;
      ctx.shadowColor = '#00ffff';
      ctx.fillRect(this.x - 40 + camera.x, camera.y, 80, this.y);
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(this.x - 15 + camera.x, camera.y, 30, this.y);
      ctx.restore();
    }
    
    // Draw Aegis ultimate barrier glowing bubble
    if (this.superActive && this.superType === 'aegis') {
      ctx.save();
      ctx.translate(this.x + camera.x, this.y + camera.y);
      ctx.globalAlpha = 0.3 + Math.sin(Date.now() * 0.03) * 0.1;
      ctx.fillStyle = 'rgba(189, 0, 255, 0.15)';
      ctx.strokeStyle = '#bd00ff';
      ctx.lineWidth = 4;
      ctx.shadowBlur = 25;
      ctx.shadowColor = '#bd00ff';
      
      ctx.beginPath();
      ctx.arc(0, 0, 120, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      
      ctx.strokeStyle = 'rgba(189, 0, 255, 0.3)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + (Date.now() * 0.001);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * 120, Math.sin(angle) * 120);
        ctx.stroke();
      }
      ctx.restore();
    }
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
      
      // Draw shadow clone thruster flames
      this.drawThrusterFlames(ctx);
      
      if (shipSprite) {
        // Symmetrical top-down shadow clone naturally points UP (no Math.PI / 2 rotation offset needed)
        ctx.drawImage(shipSprite, -34, -34, 68, 68);
      } else {
        this.drawProceduralShip(ctx, '#ff2d55', '#ff2d55', true);
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
    
    // Draw animated main thruster flames!
    this.drawThrusterFlames(ctx);
    
    if (shipSprite) {
      // Symmetrical top-down ship naturally points UP (no Math.PI / 2 rotation offset needed)
      ctx.drawImage(shipSprite, -34, -34, 68, 68);
    } else {
      this.drawProceduralShip(ctx);
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
      
      // Draw spectacular ultimate zapping electric arcs between drones & player
      if (this.superActive && this.superType === 'sentinel') {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 45, 85, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ff2d55';
        
        ctx.beginPath();
        for (let i = 0; i < this.drones.length; i++) {
          const d1 = this.drones[i];
          const d2 = this.drones[(i + 1) % this.drones.length];
          if (i === 0) {
            ctx.moveTo(d1.x + camera.x, d1.y + camera.y);
          } else {
            ctx.lineTo(d1.x + camera.x, d1.y + camera.y);
          }
          ctx.lineTo(d2.x + camera.x, d2.y + camera.y);
        }
        ctx.closePath();
        ctx.stroke();
        
        if (Math.random() < 0.4) {
          ctx.beginPath();
          const randDrone = this.drones[Math.floor(Math.random() * this.drones.length)];
          ctx.moveTo(this.x + camera.x, this.y + camera.y);
          ctx.lineTo(randDrone.x + camera.x, randDrone.y + camera.y);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }
}
