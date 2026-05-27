/**
 * Bullet.js - Ammo and Weapon Trajectory Engine
 * Manages player weapons and mathematically driven enemy bullet-hell patterns.
 */
import { camera } from './Particle.js';

export class Bullet {
  constructor(x, y, angle, speed, damage, isPlayer, options = {}) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = speed;
    this.damage = damage;
    this.isPlayer = isPlayer;
    this.radius = options.radius || 4;
    this.color = options.color || (isPlayer ? '#00ffff' : '#ff2d55');
    this.pierce = options.pierce || 1;
    this.enemiesHit = []; // Avoid hitting same enemy multiple times with piercing
    
    // Wave movement parameters (e.g. sinusoidal)
    this.isWave = options.isWave || false;
    this.waveAmplitude = options.waveAmplitude || 6;
    this.waveFrequency = options.waveFrequency || 0.08;
    this.spawnTime = Date.now();
    this.initialAngle = angle;
    this.distanceTraveled = 0;
    
    // Homing parameters
    this.isHoming = options.isHoming || false;
    this.homingTurnSpeed = options.homingTurnSpeed || 0.06;
    
    // Orbiting parameters
    this.isOrbiting = options.isOrbiting || false;
    this.orbitRadius = options.orbitRadius || 80;
    this.orbitSpeed = options.orbitSpeed || 0.05;
    this.orbitCenter = options.orbitCenter || null; // reference to player
    this.orbitAngle = options.orbitAngle || 0;
    
    // Laser Beam properties
    this.isLaser = options.isLaser || false;
    this.laserLength = options.laserLength || 800;
    
    // Premium Upgrade fields
    this.isHeavyMissile = options.isHeavyMissile || false;
    this.isSlowed = false;
    
    // Velocities
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    
    this.isDead = false;
  }

  update(player, enemies) {
    if (this.isOrbiting && this.orbitCenter) {
      // Rotate around owner
      this.orbitAngle += this.orbitSpeed;
      this.x = this.orbitCenter.x + Math.cos(this.orbitAngle) * this.orbitRadius;
      this.y = this.orbitCenter.y + Math.sin(this.orbitAngle) * this.orbitRadius;
      return;
    }
    
    if (this.isHoming) {
      if (this.isPlayer) {
        // Homing on nearest enemy
        const target = this.findNearestEnemy(enemies);
        if (target) {
          const targetAngle = Math.atan2(target.y - this.y, target.x - this.x);
          // Smooth rotation towards target
          let angleDiff = targetAngle - this.angle;
          // Normalize to -PI to PI
          angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
          this.angle += Math.sign(angleDiff) * Math.min(this.homingTurnSpeed, Math.abs(angleDiff));
          
          this.vx = Math.cos(this.angle) * this.speed;
          this.vy = Math.sin(this.angle) * this.speed;
        }
      } else {
        // Homing on player
        const targetAngle = Math.atan2(player.y - this.y, player.x - this.x);
        let angleDiff = targetAngle - this.angle;
        angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
        this.angle += Math.sign(angleDiff) * Math.min(this.homingTurnSpeed * 0.5, Math.abs(angleDiff));
        
        this.vx = Math.cos(this.angle) * this.speed;
        this.vy = Math.sin(this.angle) * this.speed;
      }
    }
    
    if (this.isWave) {
      // Wave trajectory (orthogonal oscillation)
      const elapsed = (Date.now() - this.spawnTime) * this.waveFrequency * 0.1;
      const waveOffset = Math.sin(elapsed) * this.waveAmplitude;
      
      // Calculate normal vector to original path
      const nx = -Math.sin(this.initialAngle);
      const ny = Math.cos(this.initialAngle);
      
      // Base linear advance
      this.distanceTraveled += this.speed;
      const lx = this.orbitCenter ? this.orbitCenter.x : (this.x - this.vx); // simple approximation
      
      // Update coordinates: base trajectory + wave offset
      this.x += this.vx;
      this.y += this.vy;
      this.x += nx * Math.cos(elapsed) * this.waveAmplitude * 0.2; // apply wave distortion
      this.y += ny * Math.cos(elapsed) * this.waveAmplitude * 0.2;
    } else {
      // Normal linear motion
      this.x += this.vx;
      this.y += this.vy;
    }
  }

  findNearestEnemy(enemies) {
    let nearest = null;
    let minDist = Infinity;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (e.isDead || e.y < 0) continue; // Skip dead or off-screen enemies
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      const dist = dx * dx + dy * dy;
      if (dist < minDist) {
        minDist = dist;
        nearest = e;
      }
    }
    return nearest;
  }

  draw(ctx) {
    ctx.save();
    
    // Draw coordinates with screen shake
    const drawX = this.x + camera.x;
    const drawY = this.y + camera.y;
    
    let color = this.color;
    if (this.isSlowed) {
      color = '#00ffff'; // time-slowed bullets glow neon blue
    }
    
    // Glow effect
    ctx.shadowBlur = this.radius * 2.5;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    
    if (this.isHeavyMissile) {
      // Draw a detailed, blocky 16-bit retro rocket matrix
      ctx.translate(drawX, drawY);
      ctx.rotate(this.angle);
      
      const pixelSize = 2.5;
      const rocketMatrix = [
        [0, 0, 2, 1, 1, 1, 3, 0],
        [0, 2, 2, 1, 1, 1, 3, 3],
        [2, 2, 2, 1, 1, 1, 3, 3],
        [0, 2, 2, 1, 1, 1, 3, 3],
        [0, 0, 2, 1, 1, 1, 3, 0]
      ];
      // 1: Gray fuselage body, 2: Red tail fins, 3: Orange nose cone
      const halfW = (8 * pixelSize) / 2;
      const halfH = (5 * pixelSize) / 2;
      
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 8; col++) {
          const val = rocketMatrix[row][col];
          if (val === 0) continue;
          
          if (val === 1) ctx.fillStyle = '#999999'; // Steel gray
          else if (val === 2) ctx.fillStyle = '#ff2d55'; // Neon red
          else if (val === 3) ctx.fillStyle = '#fff01f'; // Yellow
          
          ctx.fillRect(col * pixelSize - halfW, row * pixelSize - halfH, pixelSize, pixelSize);
        }
      }
      
      // Draw blocky pixelated flame exhaust
      ctx.fillStyle = '#ff5500';
      const flameH = 3 * pixelSize;
      const flameW = (2 + Math.floor(Math.random() * 3)) * pixelSize;
      ctx.fillRect(-halfW - flameW, -flameH / 2, flameW, flameH);
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(-halfW - flameW * 0.6, -pixelSize / 2, flameW * 0.6, pixelSize);
      
      ctx.restore();
      return;
    }
    
    if (this.isLaser) {
      // Render as stretching plasma laser bolt
      ctx.strokeStyle = color;
      ctx.lineWidth = this.radius * 2;
      ctx.lineCap = 'square'; // blocky ends
      ctx.beginPath();
      ctx.moveTo(drawX - Math.cos(this.angle) * this.laserLength * 0.05, drawY - Math.sin(this.angle) * this.laserLength * 0.05);
      ctx.lineTo(drawX + Math.cos(this.angle) * this.radius * 2, drawY + Math.sin(this.angle) * this.radius * 2);
      ctx.stroke();
    } else if (this.isOrbiting) {
      // Draw a spinning 16-bit pixelated star matrix
      ctx.translate(drawX, drawY);
      ctx.rotate(Date.now() * 0.015);
      
      const starMatrix = [
        [0, 0, 1, 0, 0],
        [0, 1, 2, 1, 0],
        [1, 2, 2, 2, 1],
        [0, 1, 2, 1, 0],
        [0, 0, 1, 0, 0]
      ];
      const pSize = 3;
      const halfS = (5 * pSize) / 2;
      
      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          const val = starMatrix[r][c];
          if (val === 0) continue;
          
          ctx.fillStyle = (val === 1) ? '#bd00ff' : '#00ffff';
          ctx.fillRect(c * pSize - halfS, r * pSize - halfS, pSize, pSize);
        }
      }
    } else {
      // Sharp 16-bit retro glowing diamond cross
      const r = Math.max(3.5, this.radius);
      
      ctx.fillRect(drawX - r, drawY - r / 3, r * 2, r * 2 / 3);
      ctx.fillRect(drawX - r / 3, drawY - r, r * 2 / 3, r * 2);
      
      // Core bright center for high-energy look
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(drawX - r / 2, drawY - r / 2, r, r);
    }
    
    ctx.restore();
  }

  isOutOfBounds(width, height) {
    // Standard buffer bounds
    const buffer = 150;
    return (
      this.x < -buffer ||
      this.x > width + buffer ||
      this.y < -buffer ||
      this.y > height + buffer
    );
  }
}
