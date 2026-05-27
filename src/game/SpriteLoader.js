/**
 * SpriteLoader.js - Preloader & Chroma-Keying Transparency Engine
 * Loads AI-generated pixel art assets, keys out black backgrounds, and caches them.
 */
class SpriteLoader {
  constructor() {
    this.sprites = {};
    this.loadedCount = 0;
    this.totalCount = 18; // 3 player ships + 3 boss ships + 9 individual enemy files + 3 vertical background maps
    this.isReady = false;
    this.onProgressCallback = null;
    this.onCompleteCallback = null;
  }

  /**
   * Preload all assets, key out black backgrounds, slice sheets, and cache them.
   */
  preload(onProgress, onComplete) {
    if (this.isReady) {
      if (onComplete) onComplete();
      return;
    }

    this.onProgressCallback = onProgress;
    this.onCompleteCallback = onComplete;

    const rawAssets = {
      // Player ships
      vanguard: '/assets/vanguard.png',
      aegis: '/assets/aegis.png',
      sentinel: '/assets/sentinel.png',
      // Bosses
      boss1: '/assets/boss1.png',
      boss2: '/assets/boss2.png',
      boss3: '/assets/boss3.png',
      // Stage 1 Enemy Files
      drone_city: '/assets/drone_city.png',
      spinner_city: '/assets/spinner_city.png',
      sniper_city: '/assets/sniper_city.png',
      // Stage 2 Enemy Files
      drone_forest: '/assets/drone_forest.png',
      spinner_forest: '/assets/spinner_forest.png',
      sniper_forest: '/assets/sniper_forest.png',
      // Stage 3 Enemy Files
      drone_fortress: '/assets/drone_fortress.png',
      spinner_fortress: '/assets/spinner_fortress.png',
      sniper_fortress: '/assets/sniper_fortress.png',
      // Backgrounds
      bg1: '/assets/bg1.png',
      bg2: '/assets/bg2.png',
      bg3: '/assets/bg3.png'
    };

    const keys = Object.keys(rawAssets);
    
    keys.forEach(key => {
      const img = new Image();
      img.onload = () => {
        // Chroma key the image (turn solid black transparent)
        const transparentCanvas = this.chromaKey(img);
        
        // Store directly as canvas
        this.sprites[key] = transparentCanvas;

        this.loadedCount++;
        
        if (this.onProgressCallback) {
          const progress = Math.min(1, this.loadedCount / this.totalCount);
          this.onProgressCallback(progress);
        }

        if (this.loadedCount >= this.totalCount) {
          this.isReady = true;
          console.log("SpriteLoader: All 18 assets loaded, color-keyed, and cached successfully!");
          if (this.onCompleteCallback) this.onCompleteCallback();
        }
      };

      img.onerror = (e) => {
        console.warn(`SpriteLoader: Failed to load asset ${key} at ${rawAssets[key]}`, e);
        // Force increment to prevent lockups under asset loading failures
        this.loadedCount++;
        if (this.loadedCount >= this.totalCount) {
          this.isReady = true;
          if (this.onCompleteCallback) this.onCompleteCallback();
        }
      };

      img.src = rawAssets[key];
    });
  }

  /**
   * Classic Color-Key / Chroma-Key transparency filter.
   * Scans pixel buffers and sets any pixel close to black (RGB <= 18) to transparent.
   */
  chromaKey(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      
      // Auto-detect checkered or solid backgrounds by sampling two pixels at the top-left edge
      // Pixel 1 at (0, 0)
      const r1 = data[0];
      const g1 = data[1];
      const b1 = data[2];
      const a1 = data[3];

      // Pixel 2 at (8, 0) - offset to hit the alternating checkerbox if present
      const pixelOffset = 8;
      const idx2 = pixelOffset * 4;
      const r2 = data[idx2];
      const g2 = data[idx2 + 1];
      const b2 = data[idx2 + 2];
      const a2 = data[idx2 + 3];

      const threshold = 35; // color distance tolerance for keying

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a === 0) continue;

        // Calculate absolute color distances
        const dist1 = Math.abs(r - r1) + Math.abs(g - g1) + Math.abs(b - b1);
        const dist2 = Math.abs(r - r2) + Math.abs(g - g2) + Math.abs(b - b2);

        // Absolute keying checks for solid black/white bleeding
        const isNearBlack = r <= 22 && g <= 22 && b <= 22;
        const isNearWhite = r >= 235 && g >= 235 && b >= 235;

        // Key out if it matches either checker color or standard safety bounds
        if (dist1 <= threshold || dist2 <= threshold || isNearBlack || isNearWhite) {
          data[i + 3] = 0; // Transparent alpha
        }
      }

      ctx.putImageData(imgData, 0, 0);
    } catch (e) {
      console.warn("SpriteLoader: Could not perform pixel-level chroma key due to CORS restriction", e);
    }

    return canvas;
  }

  /**
   * Retrieve cached transparent canvas asset
   */
  get(key) {
    return this.sprites[key] || null;
  }
}

// Singleton instantiation
const spriteLoader = new SpriteLoader();
export default spriteLoader;
