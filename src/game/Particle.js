/**
 * Particle.js - Visual Juiciness System
 * Handles thruster smoke, spark trails, explosions, and camera screen-shake.
 */

// Camera screen shake manager
export const camera = {
  x: 0,
  y: 0,
  shakeIntensity: 0,
  shakeDecay: 0.9,
  
  shake(amount) {
    this.shakeIntensity += amount;
  },
  
  update() {
    if (this.shakeIntensity > 0.1) {
      this.x = (Math.random() * 2 - 1) * this.shakeIntensity;
      this.y = (Math.random() * 2 - 1) * this.shakeIntensity;
      this.shakeIntensity *= this.shakeDecay;
    } else {
      this.x = 0;
      this.y = 0;
      this.shakeIntensity = 0;
    }
  }
};

export class Particle {
  constructor(x, y, vx, vy, color, size, life, shape = 'square', glow = false, drag = 1.0) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.size = size;
    this.maxLife = life;
    this.life = life;
    this.shape = shape;
    this.glow = glow;
    this.drag = drag; // Deceleration factor (e.g. 0.95 to slow down)
    this.alpha = 1.0;
  }

  update() {
    this.life--;
    this.x += this.vx;
    this.y += this.vy;
    
    // Apply drag/friction
    this.vx *= this.drag;
    this.vy *= this.drag;
    
    this.alpha = Math.max(0, this.life / this.maxLife);
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    
    // Glow effect for energetic elements (plasma/bombs)
    if (this.glow) {
      ctx.shadowBlur = this.size * 2;
      ctx.shadowColor = this.color;
    }
    
    ctx.fillStyle = this.color;
    
    // Draw with screen-shake translation applied
    const drawX = this.x + camera.x;
    const drawY = this.y + camera.y;
    
    if (this.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(drawX, drawY, this.size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Crisp pixelated squares
      ctx.fillRect(drawX - this.size / 2, drawY - this.size / 2, this.size, this.size);
    }
    
    ctx.restore();
  }
}

/**
 * Static Factory for spawning different particle types
 */
export const ParticleFactory = {
  particles: [],

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.update();
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  },

  draw(ctx) {
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].draw(ctx);
    }
  },

  clear() {
    this.particles = [];
  },

  // 1. Spawns standard thruster tail exhaust
  spawnThruster(x, y, angle, color = '#00ffff') {
    const spread = 0.4;
    const speed = Math.random() * 2 + 1;
    // Shoot particles in opposite direction of movement
    const forceAngle = angle + Math.PI + (Math.random() * spread - spread / 2);
    const vx = Math.cos(forceAngle) * speed;
    const vy = Math.sin(forceAngle) * speed;
    
    const size = Math.random() * 4 + 2;
    const life = Math.random() * 15 + 10;
    
    this.particles.push(new Particle(x, y, vx, vy, color, size, life, 'square', true, 0.98));
  },

  // 2. High velocity impact sparks
  spawnSpark(x, y, vx, vy, color = '#ff2d55') {
    const count = Math.floor(Math.random() * 3) + 2;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      const svx = vx * -0.2 + Math.cos(angle) * speed;
      const svy = vy * -0.2 + Math.sin(angle) * speed;
      
      const size = Math.random() * 3 + 1.5;
      const life = Math.random() * 15 + 10;
      
      this.particles.push(new Particle(x, y, svx, svy, color, size, life, 'square', false, 0.94));
    }
  },

  // 3. Exploding circle/starbursts when an enemy is destroyed
  spawnExplosion(x, y, color = '#ff2d55', baseCount = 15) {
    const count = baseCount + Math.floor(Math.random() * 10);
    camera.shake(baseCount * 0.15); // Shake proportional to explosion size
    
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 5 + 1.5;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      
      const size = Math.random() * 6 + 3;
      const life = Math.random() * 30 + 15;
      
      this.particles.push(new Particle(x, y, vx, vy, color, size, life, 'square', true, 0.96));
    }
  },

  // 4. Void Bomb shockwaves
  spawnBombShockwave(x, y, color = '#fff01f') {
    camera.shake(8);
    const count = 100;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 3;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      
      const size = Math.random() * 8 + 4;
      const life = Math.random() * 45 + 30;
      
      this.particles.push(new Particle(x, y, vx, vy, color, size, life, 'circle', true, 0.95));
    }
  },

  // 5. XP Pickups trails
  spawnXPTrail(x, y, color = '#39ff14') {
    if (Math.random() > 0.4) return; // Don't over-saturate
    const vx = (Math.random() - 0.5) * 0.5;
    const vy = (Math.random() - 0.5) * 0.5;
    const size = Math.random() * 3 + 1;
    const life = Math.random() * 10 + 5;
    
    this.particles.push(new Particle(x, y, vx, vy, color, size, life, 'square', false, 0.95));
  }
};
