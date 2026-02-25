/**
 * 天穹 · 飞机大战 — 实体层
 * Player / Bullet / Enemy 及生成逻辑
 */

const ENTITIES = (function () {
  const PI = Math.PI;

  const MAX_WEAPON_LEVEL = 4;

  // ----- 玩家 -----
  class Player {
    constructor(cfg) {
      this.w = cfg.playerWidth ?? 44;
      this.h = cfg.playerHeight ?? 36;
      this.speed = cfg.playerSpeed ?? 10;
      this.fireInterval = cfg.fireInterval ?? 100;
      this.x = cfg.canvasWidth / 2 - this.w / 2;
      this.y = cfg.canvasHeight - this.h - 40;
      this.vx = 0;
      this.vy = 0;
      this.lastFire = 0;
      this.lives = cfg.lives ?? 3;
      this.weaponLevel = 1;
      this.missileCount = 0;
      this.nukeCount = 0;
      this.invulnUntil = 0;
      this.invulnDuration = 1500;
      this.shipType = cfg.shipType || 'A';
    }

    useMissile() {
      if (this.missileCount <= 0) return false;
      this.missileCount--;
      return true;
    }
    useNuke() {
      if (this.nukeCount <= 0) return false;
      this.nukeCount--;
      return true;
    }

    update(now, bounds) {
      this.x += this.vx * this.speed;
      this.y += this.vy * this.speed;
      this.x = Math.max(0, Math.min(bounds.w - this.w, this.x));
      this.y = Math.max(0, Math.min(bounds.h - this.h, this.y));
    }

    /** 多种弹药形态：普通/双联/散射/重炮 + 激光/导弹/针弹/环弹，返回子弹数组；B 型机为固定三向、射速略慢 */
    fire(now) {
      if (now - this.lastFire < this.getFireInterval(now)) return [];
      this.lastFire = now;
      const cx = this.x + this.w / 2;
      const cy = this.y;
      const list = [];

      if (this.shipType === 'B') {
        const iv = this.getFireInterval(now);
        list.push({ w: 5, h: 16, vy: -13, fromPlayer: true, tier: 1, ammo: 'normal', shape: 'rounded', damage: 1, x: cx - 2.5, y: cy });
        list.push({ w: 4, h: 14, vy: -12, vx: -0.8, fromPlayer: true, tier: 1, ammo: 'spread', shape: 'needle', damage: 1, x: cx - 14, y: cy });
        list.push({ w: 4, h: 14, vy: -12, vx: 0.8, fromPlayer: true, tier: 1, ammo: 'spread', shape: 'needle', damage: 1, x: cx + 10, y: cy });
        return list;
      }

      // L1 普通弹：小口径矩形
      if (this.weaponLevel >= 1) {
        list.push({ w: 4, h: 14, vy: -14, fromPlayer: true, tier: 1, ammo: 'normal', shape: 'rect', damage: 1, x: cx - 2, y: cy });
      }
      // L2 双联 + 激光束（细长条）
      if (this.weaponLevel >= 2) {
        list.push({ w: 5, h: 16, vy: -13, vx: -0.5, fromPlayer: true, tier: 2, ammo: 'twin', shape: 'rounded', damage: 1, x: cx - 16, y: cy });
        list.push({ w: 5, h: 16, vy: -13, vx: 0.5, fromPlayer: true, tier: 2, ammo: 'twin', shape: 'rounded', damage: 1, x: cx + 10, y: cy });
        list.push({ w: 2, h: 28, vy: -15, fromPlayer: true, tier: 2, ammo: 'laser', shape: 'beam', damage: 1, x: cx - 1, y: cy });
      }
      // L3 散射 + 导弹（椭圆+尾迹）
      if (this.weaponLevel >= 3) {
        list.push({ w: 3, h: 18, vy: -12, vx: -0.9, fromPlayer: true, tier: 3, ammo: 'spread', shape: 'needle', damage: 1, x: cx - 10, y: cy + 4 });
        list.push({ w: 3, h: 18, vy: -12, vx: 0.9, fromPlayer: true, tier: 3, ammo: 'spread', shape: 'needle', damage: 1, x: cx + 4, y: cy + 4 });
        list.push({ w: 6, h: 20, vy: -12.5, fromPlayer: true, tier: 3, ammo: 'missile', shape: 'missile', damage: 1, x: cx - 3, y: cy });
      }
      // L4 重炮 + 环弹（小圆）
      if (this.weaponLevel >= 4) {
        list.push({ w: 8, h: 20, vy: -10.5, vx: -1.2, fromPlayer: true, tier: 4, ammo: 'heavy', shape: 'ellipse', damage: 2, x: cx - 22, y: cy + 2 });
        list.push({ w: 8, h: 20, vy: -10.5, vx: 1.2, fromPlayer: true, tier: 4, ammo: 'heavy', shape: 'ellipse', damage: 2, x: cx + 14, y: cy + 2 });
        list.push({ w: 6, h: 6, vy: -11, vx: -0.6, fromPlayer: true, tier: 4, ammo: 'ring', shape: 'ring', damage: 1, x: cx - 18, y: cy });
        list.push({ w: 6, h: 6, vy: -11, vx: 0.6, fromPlayer: true, tier: 4, ammo: 'ring', shape: 'ring', damage: 1, x: cx + 12, y: cy });
      }
      return list;
    }

    addWeaponLevel() {
      if (this.weaponLevel < MAX_WEAPON_LEVEL) this.weaponLevel++;
    }

    hit(now) {
      this.lives--;
      this.invulnUntil = now + this.invulnDuration;
    }

    isInvuln(now) {
      return now < this.invulnUntil;
    }

    get hitbox() {
      return { x: this.x + 6, y: this.y + 6, w: this.w - 12, h: this.h - 12 };
    }

    // ----- 技能：Q 炸弹 / E 护盾 / R 连射 -----
    skillBomb(now) {
      const cd = 15000;
      if (now - (this.lastBomb || 0) < cd) return false;
      this.lastBomb = now;
      return true;
    }
    skillShield(now) {
      const cd = 10000;
      if (now - (this.lastShield || 0) < cd) return false;
      this.lastShield = now;
      this.invulnUntil = Math.max(this.invulnUntil, now + 2500);
      return true;
    }
    skillRapid(now) {
      const cd = 8000;
      if (now - (this.lastRapid || 0) < cd) return false;
      this.lastRapid = now;
      this.rapidUntil = now + 4000;
      return true;
    }
    getFireInterval(now) {
      const base = this.shipType === 'B' ? 120 : this.fireInterval;
      return (now < (this.rapidUntil || 0)) ? base * 0.4 : base;
    }
  }

  // ----- 子弹 -----
  function updateBullet(b, bounds) {
    b.x += b.vx || 0;
    b.y += b.vy;
    if (b.fromPlayer) {
      if (b.y + b.h < 0 || b.y > bounds.h + 80 || b.x + b.w < -30 || b.x > bounds.w + 30) return false;
      return true;
    }
    return b.y - b.h <= bounds.h;
  }

  // ----- 敌机：小 / 中 / 大 / 精英（随关卡增多大怪） -----
  const ENEMY_TYPES = [
    { name: 'scout', w: 22, h: 18, hp: 1, score: 80, vy: 2.8, color: '#94a3b8' },
    { name: 'light', w: 30, h: 24, hp: 1, score: 120, vy: 2.2, color: '#63b3ed' },
    { name: 'medium', w: 38, h: 30, hp: 2, score: 200, vy: 1.6, color: '#7dd3fc' },
    { name: 'heavy', w: 48, h: 36, hp: 3, score: 350, vy: 1.2, color: '#e8b86d' },
    { name: 'elite', w: 56, h: 42, hp: 5, score: 600, vy: 1.0, color: '#a78bfa' },
    { name: 'ace', w: 20, h: 16, hp: 1, score: 1200, vy: 4.2, color: '#fbbf24' },
  ];

  function createEnemy(bounds, level) {
    const roll = Math.random();
    let typeIndex;
    if (level >= 5 && roll < 0.12) {
      typeIndex = 5;
    } else if (level <= 1) {
      typeIndex = roll < 0.5 ? 0 : roll < 0.9 ? 1 : 2;
    } else if (level <= 3) {
      typeIndex = roll < 0.35 ? 0 : roll < 0.7 ? 1 : roll < 0.9 ? 2 : 3;
    } else {
      typeIndex = roll < 0.25 ? 0 : roll < 0.5 ? 1 : roll < 0.75 ? 2 : roll < 0.9 ? 3 : 4;
    }
    const t = ENEMY_TYPES[typeIndex];
    const speedScale = 1 + (level - 1) * 0.12;
    return {
      x: Math.random() * (bounds.w - t.w),
      y: -t.h,
      w: t.w,
      h: t.h,
      hp: t.hp,
      maxHp: t.hp,
      score: t.score,
      vy: t.vy * speedScale,
      vx: (Math.random() - 0.5) * 1,
      typeIndex,
      color: t.color,
      isBoss: false,
    };
  }

  function updateEnemy(e, bounds) {
    e.x += e.vx;
    e.y += e.vy;
    return e.y - e.h <= bounds.h;
  }

  // ----- 关卡 Boss：高血量、会放弹幕；双形态（A 左右移动 / B 居中小幅摆动） -----
  function createBoss(bounds, level) {
    const baseHp = 25 + level * 12;
    const w = 120;
    const h = 80;
    const bossType = level % 2;
    return {
      x: bounds.w / 2 - w / 2,
      y: -h - 20,
      w,
      h,
      hp: baseHp,
      maxHp: baseHp,
      score: 1500 + level * 500,
      vy: 0.6,
      vx: 0,
      typeIndex: 5,
      color: bossType === 0 ? '#e85d5d' : '#a78bfa',
      isBoss: true,
      bossType,
      phase: 0,
      lastShot: 0,
      shotPhase: 0,
      moveDir: 1,
    };
  }

  function updateBoss(boss, bounds, now, playerX) {
    boss.y += boss.vy;
    if (boss.y < 80) return true;
    boss.vy = 0;
    if (boss.bossType === 1) {
      const centerX = bounds.w / 2 - boss.w / 2;
      boss.x = centerX + Math.sin(now * 0.002) * 70;
      boss.x = Math.max(0, Math.min(bounds.w - boss.w, boss.x));
    } else {
      const speed = boss.phase2 ? 1.85 : 1.2;
      boss.x += boss.moveDir * speed;
      if (boss.x <= 0 || boss.x >= bounds.w - boss.w) boss.moveDir *= -1;
    }
    return true;
  }

  /** Boss 弹幕：二阶段缩短间隔、多形态轮换；B 型 Boss 使用不同弹幕 */
  function bossShoot(boss, bounds, now, playerX, playerY) {
    const list = [];
    const baseInterval = boss.phase2 ? 950 : 1400;
    if (now - boss.lastShot < baseInterval) return list;
    boss.lastShot = now;
    boss.shotPhase = (boss.shotPhase || 0) + 1;
    const cx = boss.x + boss.w / 2;
    const cy = boss.y + boss.h;

    function add(x, y, w, h, vx, vy, pattern) {
      list.push({ x: x - w / 2, y, w, h, vx, vy, fromPlayer: false, pattern: pattern || 'normal' });
    }

    if (boss.bossType === 1) {
      const phase = boss.shotPhase % 3;
      if (phase === 0) {
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + now * 0.001;
          add(cx, cy, 5, 12, Math.cos(a) * 2, Math.sin(a) * 2, 'burst');
        }
      } else if (phase === 1) {
        const dx = (playerX - cx) * 0.02;
        const dy = 2.5;
        for (let i = -2; i <= 2; i++) add(cx + i * 18, cy, 4, 10, dx + i * 0.2, dy, 'aimed');
      } else {
        for (let i = -2; i <= 2; i++) {
          const t = now * 0.003 + i * 0.5;
          add(cx + i * 22, cy, 4, 10, Math.sin(t) * 1.5, 2, 'wave');
        }
      }
      return list;
    }

    const phase = boss.shotPhase % 4;
    if (phase === 0) {
      for (let i = -1; i <= 1; i++) {
        const angle = (i * 0.25) + Math.PI * 0.5;
        add(cx, cy, 5, 12, Math.cos(angle) * 1.8, Math.sin(angle) * 2.2, 'spread');
      }
    } else if (phase === 1) {
      const dx = (playerX - cx) * 0.015;
      const dy = 2.2;
      add(cx, cy, 6, 14, dx, dy, 'aimed');
      add(cx - 12, cy, 5, 12, dx - 0.3, dy, 'aimed');
      add(cx + 12, cy, 5, 12, dx + 0.3, dy, 'aimed');
    } else if (phase === 2) {
      for (let i = -1; i <= 1; i++) {
        add(cx + i * 25, cy, 4, 10, i * 1.2, 1.8, 'wave');
      }
    } else {
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + 0.2;
        add(cx, cy, 5, 12, Math.cos(a) * 1.5, Math.sin(a) * 1.5, 'burst');
      }
    }
    return list;
  }

  // ----- 道具（弹药升级 P） -----
  function createPowerUp(x, y, type) {
    return { x, y, w: 24, h: 24, type: type || 'P', vy: 1.2 };
  }

  function updatePowerUp(p, bounds) {
    p.y += p.vy;
    return p.y - p.h <= bounds.h;
  }

  return {
    Player,
    updateBullet,
    createEnemy,
    updateEnemy,
    createBoss,
    updateBoss,
    bossShoot,
    createPowerUp,
    updatePowerUp,
    ENEMY_TYPES,
    MAX_WEAPON_LEVEL,
  };
})();
