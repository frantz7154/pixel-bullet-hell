/**
 * UpgradeSystem.js - Roguelike Card Upgrades
 * Manages stats buffs, special weapons, homing missiles, and orbital shield installations.
 */

export const UPGRADE_POOL = [
  {
    id: 'rapid_fire',
    name: 'NANO-CAPACITORS',
    desc: 'Increases weapon firing rate by 20%.',
    type: 'weapon',
    rarity: 'common',
    iconColor: '#00ffff'
  },
  {
    id: 'damage_boost',
    name: 'AMPLIFIER MATRIX',
    desc: 'Amplifies all bullet damage by 25%.',
    type: 'weapon',
    rarity: 'common',
    iconColor: '#00ffff'
  },
  {
    id: 'speed_boost',
    name: 'THRUSTER INERTIALS',
    desc: 'Increases starship movement velocity by 15%.',
    type: 'stat',
    rarity: 'common',
    iconColor: '#ff2d55'
  },
  {
    id: 'shield_max',
    name: 'REINFORCED AEGIS',
    desc: 'Increases maximum shield cap by +25 and replenishes it.',
    type: 'def',
    rarity: 'common',
    iconColor: '#bd00ff'
  },
  {
    id: 'shield_regen',
    name: 'CELL RECONSTRUCTOR',
    desc: 'Accelerates shield auto-charge rates by 35%.',
    type: 'def',
    rarity: 'common',
    iconColor: '#bd00ff'
  },
  {
    id: 'hp_max',
    name: 'PLATED NANO-CORE',
    desc: 'Increases maximum hull points by +25 and heals +30 HP.',
    type: 'def',
    rarity: 'common',
    iconColor: '#bd00ff'
  },
  {
    id: 'magnet_up',
    name: 'GRAVITY HARVESTER',
    desc: 'Expands experience gem collection magnetic field by 50%.',
    type: 'stat',
    rarity: 'rare',
    iconColor: '#fff01f'
  },
  {
    id: 'bullet_pierce',
    name: 'KINETIC THREADING',
    desc: 'Adds +1 enemy piercing to all fired weapons.',
    type: 'weapon',
    rarity: 'rare',
    iconColor: '#00ffff'
  },
  {
    id: 'double_shot',
    name: 'TWIN COMPRESSORS',
    desc: 'Fires secondary parallel front-shot bullets.',
    type: 'weapon',
    rarity: 'rare',
    iconColor: '#00ffff'
  },
  {
    id: 'rear_shot',
    name: 'RETRO THRUST BLASTER',
    desc: 'Launches defensive projectile backwards when shooting.',
    type: 'weapon',
    rarity: 'common',
    iconColor: '#00ffff'
  },
  {
    id: 'homing_missile',
    name: 'QUANTUM TRACKERS',
    desc: 'Fires automated tracking sub-missiles that seek out targets.',
    type: 'special',
    rarity: 'epic',
    iconColor: '#fff01f'
  },
  {
    id: 'orbit_shield',
    name: 'ORBITAL RESONATOR',
    desc: 'Spawns an orbiting energy plasma sphere damaging passing targets.',
    type: 'special',
    rarity: 'epic',
    iconColor: '#fff01f'
  },
  {
    id: 'bomb_up',
    name: 'VOID DEPLOYER',
    desc: 'Increases maximum Void Bombs capacity by +1 and refills 1 bomb.',
    type: 'special',
    rarity: 'rare',
    iconColor: '#fff01f'
  },
  {
    id: 'auto_aim',
    name: 'NEURAL TARGETING LINK',
    desc: 'All main weapons automatically seek out target threats.',
    type: 'special',
    rarity: 'legendary',
    iconColor: '#fff01f'
  },
  {
    id: 'chrono_field',
    name: 'NANO-CHRONO FIELD',
    desc: 'Emits a local time field slowing down incoming projectiles by 55%.',
    type: 'special',
    rarity: 'epic',
    iconColor: '#00ffff'
  },
  {
    id: 'shadow_clone',
    name: 'QUANTUM DUPLICATOR',
    desc: 'Spawns a trailing holographic duplicate that copies your weapons at 50% power.',
    type: 'special',
    rarity: 'epic',
    iconColor: '#ff2d55'
  },
  {
    id: 'heavy_missile',
    name: 'HEAVY NUCLEAR ROCKTRY',
    desc: 'Periodically launches a heavy tactical rocket dealing massive radial splash damage.',
    type: 'weapon',
    rarity: 'epic',
    iconColor: '#ffaa00'
  }
];

export class UpgradeSystem {
  /**
   * Selects random card selections based on weights
   */
  static getRandomSelections(count = 3) {
    const list = [...UPGRADE_POOL];
    const selections = [];
    
    // Rarity weights
    const rollRarity = () => {
      const roll = Math.random() * 100;
      if (roll < 2) return 'legendary';
      if (roll < 10) return 'epic';
      if (roll < 30) return 'rare';
      return 'common';
    };

    while (selections.length < count && list.length > 0) {
      const desiredRarity = rollRarity();
      // Filter list matching desired rarity first
      let candidates = list.filter(u => u.rarity === desiredRarity);
      
      // Fallback if no matching rarity remains
      if (candidates.length === 0) {
        candidates = list;
      }
      
      const idx = Math.floor(Math.random() * candidates.length);
      const chosen = candidates[idx];
      
      selections.push(chosen);
      // Remove chosen to avoid duplicates in the same screen
      const originalIdx = list.findIndex(u => u.id === chosen.id);
      list.splice(originalIdx, 1);
    }

    return selections;
  }

  /**
   * Applies card benefits to player stats
   */
  static apply(player, upgrade) {
    player.upgrades[upgrade.id] = (player.upgrades[upgrade.id] || 0) + 1;

    switch (upgrade.id) {
      case 'rapid_fire':
        // Reduce fire rate delay (20% faster)
        player.fireDelay = Math.max(80, player.fireDelay * 0.82);
        break;
      case 'damage_boost':
        player.bulletDamage *= 1.25;
        break;
      case 'speed_boost':
        player.moveSpeed *= 1.15;
        break;
      case 'shield_max':
        player.maxShield += 25;
        player.shield = player.maxShield;
        break;
      case 'shield_regen':
        player.shieldRegenRate *= 1.35;
        break;
      case 'hp_max':
        player.maxHp += 25;
        player.hp = Math.min(player.maxHp, player.hp + 30);
        break;
      case 'magnet_up':
        player.magnetRange *= 1.5;
        break;
      case 'bullet_pierce':
        player.bulletPierce += 1;
        break;
      case 'double_shot':
        player.hasDoubleShot = true;
        break;
      case 'rear_shot':
        player.hasRearShot = true;
        break;
      case 'homing_missile':
        player.hasHomingMissile = true;
        player.homingLevel = (player.homingLevel || 0) + 1;
        break;
      case 'orbit_shield':
        player.orbitShieldCount = (player.orbitShieldCount || 0) + 1;
        break;
      case 'bomb_up':
        player.maxBombs += 1;
        player.bombs = Math.min(player.maxBombs, player.bombs + 1);
        break;
      case 'auto_aim':
        player.hasAutoAim = true;
        break;
      case 'chrono_field':
        player.hasChronoField = true;
        break;
      case 'shadow_clone':
        player.hasShadowClone = true;
        break;
      case 'heavy_missile':
        player.hasHeavyMissile = true;
        break;
    }
  }

  /**
   * Dynamic procedural icons for upgrade cards (rendered inside canvas or via CSS emoji/symbols)
   */
  static getEmoji(type) {
    switch (type) {
      case 'weapon': return '⚔️';
      case 'def': return '🛡️';
      case 'stat': return '⚡';
      case 'special': return '💫';
      default: return '⚙️';
    }
  }
}
