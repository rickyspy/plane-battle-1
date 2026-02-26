/**
 * 天穹 · 飞机大战 — 主循环、输入、状态与碰撞
 */

(function () {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  const CW = canvas.width;
  const CH = canvas.height;
  const bounds = { w: CW, h: CH };

  var planeImages = {};
  function loadPlaneImages() {
    var names = ['player', 'boss'];
    for (var i = 0; i <= 5; i++) names.push('enemy' + i);
    names.forEach(function (name) {
      var img = new Image();
      img.src = 'assets/' + name + '.png';
      planeImages[name] = img;
    });
  }
  loadPlaneImages();

  const cfg = {
    canvasWidth: CW,
    canvasHeight: CH,
    playerWidth: 44,
    playerHeight: 36,
    playerSpeed: 10,
    fireInterval: 100,
    lives: 3,
    spawnInterval: 850,
    spawnIntervalMin: 280,
    levelKills: 6,
  };

  let state = 'start';
  let player;
  let bullets = [];
  let enemies = [];
  let powerUps = [];
  let boss = null;
  let score = 0;
  let level = 1;
  let killsThisLevel = 0;
  let nextSpawn = 0;
  let keys = {};
  let lastTime = 0;
  let particles = [];
  let pendingBomb = false;
  let pendingShield = false;
  let pendingRapid = false;
  let pendingMissile = false;
  let pendingNuke = false;
  let autoFire = false;
  let comboCount = 0;
  let comboTimeout = 0;
  let bossWarningUntil = 0;
  let shakeAmount = 0;
  let flashAlpha = 0;
  let flashColor = 'rgba(255,255,255,';
  let hitStopFrames = 0;
  let floatingTexts = [];
  let highScore = 0;
  let difficulty = 1;
  let shipType = 'A';
  let continuesLeft = 1;
  let lastMilestone = 0;
  let closeCallCountThisRun = 0;
  let hasBeenHitThisRun = false;
  let hasKilledEnemyThisRun = false;
  let hasKilledBossThisRun = false;
  var touchMoveTarget = null;
  var touchMoveSmoothed = null;
  var stageTitleUntil = 0;
  var stageTitleLevel = 1;
  var lowQuality = false;
  var SETTINGS_KEYS = { difficulty: 'plane_battle_diff', shipType: 'plane_battle_ship', mute: 'plane_battle_mute', lowQuality: 'plane_battle_lowq' };
  var HIGH_SCORE_KEY = 'plane_battle_high_score';
  var ACH_KEYS = { first_blood: 'plane_battle_ach_first_blood', boss: 'plane_battle_ach_boss', score50k: 'plane_battle_ach_50k', close10: 'plane_battle_ach_close10', nodamage1: 'plane_battle_ach_nodamage1' };
  var SHIP_B_KEY = 'plane_battle_ship_b_unlocked';
  var PLAYED_KEY = 'plane_battle_played';
  var DIFFICULTY_SPAWN_MULT = [1.25, 1, 0.75];
  var DIFFICULTY_SPEED_MULT = [0.85, 1, 1.2];
  var MILESTONE_SCORE = 50000;
  function getHighScore() { return parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10); }
  function setHighScore(v) { localStorage.setItem(HIGH_SCORE_KEY, String(v)); }
  function addShake(amt) { shakeAmount = Math.min(shakeAmount + amt, 20); }
  function addFloatingText(x, y, text, duration) { floatingTexts.push({ x: x, y: y, text: text, life: duration, maxLife: duration }); }
  function clientToCanvas(clientX, clientY) {
    var r = canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left) * (CW / r.width),
      y: (clientY - r.top) * (CH / r.height)
    };
  }
  const AUDIO = window.GAME_AUDIO;

  const $score = document.getElementById('score');
  const $level = document.getElementById('level');
  const $lives = document.getElementById('lives');
  const $powerBars = document.getElementById('power-bars');
  const $screenStart = document.getElementById('screen-start');
  const $screenPause = document.getElementById('screen-pause');
  const $screenGameover = document.getElementById('screen-gameover');
  const $finalScore = document.getElementById('final-score');
  const $btnStart = document.getElementById('btn-start');
  const $btnRestart = document.getElementById('btn-restart');

  function resetGame() {
    cfg.lives = [5, 3, 2][difficulty];
    cfg.shipType = shipType;
    player = new ENTITIES.Player(cfg);
    bullets = [];
    enemies = [];
    powerUps = [];
    boss = null;
    score = 0;
    level = 1;
    killsThisLevel = 0;
    nextSpawn = 0;
    particles = [];
    comboCount = 0;
    comboTimeout = 0;
    bossWarningUntil = 0;
    shakeAmount = 0;
    flashAlpha = 0;
    hitStopFrames = 0;
    floatingTexts = [];
    autoFire = false;
    lastMilestone = 0;
    continuesLeft = 1;
    closeCallCountThisRun = 0;
    hasBeenHitThisRun = false;
    hasKilledEnemyThisRun = false;
    hasKilledBossThisRun = false;
    highScore = getHighScore();
    AUDIO.stopBGM();
    updateHUD();
  }

  function updateHUD(now) {
    now = now || 0;
    $score.textContent = String(score).padStart(7, '0');
    $level.textContent = level;
    var bestEl = document.getElementById('best-score');
    if (bestEl) bestEl.textContent = String(highScore).padStart(7, '0');
    var comboEl = document.getElementById('combo-display');
    if (comboEl) {
      var mult = comboCount >= 5 ? (1 + Math.min(Math.floor(comboCount / 5), 4)) : 0;
      comboEl.textContent = mult > 0 ? 'COMBO x' + mult : '';
      comboEl.classList.toggle('active', mult > 0);
    }
    var misEl = document.getElementById('missile-count');
    var nukeEl = document.getElementById('nuke-count');
    if (misEl) misEl.textContent = player.missileCount;
    if (nukeEl) nukeEl.textContent = player.nukeCount;
    if ($powerBars) {
      $powerBars.querySelectorAll('.power-cell').forEach(function (cell) {
        cell.classList.toggle('on', parseInt(cell.dataset.lv, 10) <= player.weaponLevel);
      });
    }
    $lives.innerHTML = Array.from({ length: player.lives }, function () {
      return '<span class="heart"></span>';
    }).join('');
    $lives.querySelectorAll('.heart').forEach(function (el, i) {
      el.classList.toggle('lost', i >= player.lives);
    });
    var q = document.getElementById('skill-q');
    var e = document.getElementById('skill-e');
    var r = document.getElementById('skill-r');
    if (q) { var l = player.lastBomb || 0; var left = l ? Math.max(0, 15 - (now - l) / 1000) : 0; q.textContent = left > 0 ? Math.ceil(left).toString() : 'Q'; q.classList.toggle('ready', left <= 0); }
    if (e) { l = player.lastShield || 0; left = l ? Math.max(0, 10 - (now - l) / 1000) : 0; e.textContent = left > 0 ? Math.ceil(left).toString() : 'E'; e.classList.toggle('ready', left <= 0); }
    if (r) { l = player.lastRapid || 0; left = l ? Math.max(0, 8 - (now - l) / 1000) : 0; r.textContent = left > 0 ? Math.ceil(left).toString() : 'R'; r.classList.toggle('ready', left <= 0); }
    var tq = document.getElementById('touch-q');
    var te = document.getElementById('touch-e');
    var tr = document.getElementById('touch-r');
    if (tq) { l = player.lastBomb || 0; left = l ? Math.max(0, 15 - (now - l) / 1000) : 0; tq.classList.toggle('ready', left <= 0); }
    if (te) { l = player.lastShield || 0; left = l ? Math.max(0, 10 - (now - l) / 1000) : 0; te.classList.toggle('ready', left <= 0); }
    if (tr) { l = player.lastRapid || 0; left = l ? Math.max(0, 8 - (now - l) / 1000) : 0; tr.classList.toggle('ready', left <= 0); }
  }

  function showGameOver(now) {
    touchMoveTarget = null;
    touchMoveSmoothed = null;
    if (closeCallCountThisRun >= 10 && !localStorage.getItem(ACH_KEYS.close10)) localStorage.setItem(ACH_KEYS.close10, '1');
    if (score >= MILESTONE_SCORE && !localStorage.getItem(ACH_KEYS.score50k)) localStorage.setItem(ACH_KEYS.score50k, '1');
    state = 'gameover';
    if (score > highScore) { highScore = score; setHighScore(score); }
    AUDIO.playGameOver();
    AUDIO.stopBGM();
    $screenGameover.classList.remove('hidden');
    $finalScore.textContent = 'SCORE ' + String(score).padStart(7, '0');
    var nr = document.getElementById('new-record-msg');
    if (nr) nr.classList.toggle('hidden', highScore !== score || score === 0);
    var btnCont = document.getElementById('btn-continue');
    if (btnCont) {
      if (continuesLeft > 0) {
        btnCont.classList.remove('hidden');
        btnCont.textContent = '续关 (' + continuesLeft + ')';
      } else {
        btnCont.classList.add('hidden');
      }
    }
    var ap = document.getElementById('achievements-panel');
    if (ap) {
      var list = [
        { key: ACH_KEYS.first_blood, name: '首次击毁敌机' },
        { key: ACH_KEYS.boss, name: '首次击破 Boss' },
        { key: ACH_KEYS.score50k, name: '单局 50,000 分' },
        { key: ACH_KEYS.close10, name: '单局 10 次 CLOSE!' },
        { key: ACH_KEYS.nodamage1, name: '无伤通过第 1 关' },
      ];
      var unlocked = list.filter(function (a) { return localStorage.getItem(a.key); }).length;
      ap.innerHTML = '<div class="ach-title">Achievements: ' + unlocked + '/5</div>' + list.map(function (a) {
        var ok = !!localStorage.getItem(a.key);
        return '<div class="ach-item' + (ok ? ' unlocked' : '') + '">' + (ok ? '✓ ' : '○ ') + a.name + '</div>';
      }).join('');
    }
    $screenStart.classList.add('hidden');
    $screenPause.classList.add('hidden');
  }

  function addParticle(x, y, color) {
    var n = lowQuality ? 3 : 8;
    for (let i = 0; i < n; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 0.4 + Math.random() * 0.3,
        color: color || '#e8b86d',
      });
    }
  }

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function runPlaying(now, dt) {
    const invuln = player.isInvuln(now);

    if (pendingBomb && player.skillBomb(now)) {
      pendingBomb = false;
      bullets = bullets.filter((b) => b.fromPlayer);
      const dmg = 8;
      enemies.forEach((e) => { e.hp -= dmg; addParticle(e.x + e.w / 2, e.y + e.h / 2, e.color); });
      var anyDead = false;
      enemies = enemies.filter((e) => { if (e.hp <= 0) { score += e.score; killsThisLevel++; anyDead = true; return false; } return true; });
      if (anyDead) AUDIO.playExplosion();
      if (boss) { boss.hp -= dmg * 2; addParticle(boss.x + boss.w / 2, boss.y + boss.h / 2, '#e85d5d'); if (boss.hp <= 0) { hasKilledBossThisRun = true; if (!localStorage.getItem(ACH_KEYS.boss)) localStorage.setItem(ACH_KEYS.boss, '1'); if (!localStorage.getItem(SHIP_B_KEY)) localStorage.setItem(SHIP_B_KEY, '1'); if (level === 1 && !hasBeenHitThisRun && !localStorage.getItem(ACH_KEYS.nodamage1)) localStorage.setItem(ACH_KEYS.nodamage1, '1'); score += boss.score; level++; killsThisLevel = 0; boss = null; AUDIO.playExplosion(); } }
    }
    if (pendingShield && player.skillShield(now)) pendingShield = false;
    if (pendingRapid && player.skillRapid(now)) pendingRapid = false;
    if (pendingMissile && player.useMissile()) {
      pendingMissile = false;
      var mx = player.x + player.w / 2;
      bullets.push({ x: mx - 8, y: player.y, w: 16, h: 32, vy: -14, fromPlayer: true, ammo: 'missile', shape: 'missile', damage: 5, isMissile: true });
      bullets.push({ x: mx - 20, y: player.y + 4, w: 14, h: 28, vy: -13, vx: -0.8, fromPlayer: true, ammo: 'missile', shape: 'missile', damage: 5, isMissile: true });
      bullets.push({ x: mx + 6, y: player.y + 4, w: 14, h: 28, vy: -13, vx: 0.8, fromPlayer: true, ammo: 'missile', shape: 'missile', damage: 5, isMissile: true });
      AUDIO.playShoot();
    }
    if (pendingNuke && player.useNuke()) {
      pendingNuke = false;
      addShake(12);
      flashAlpha = 0.55;
      flashColor = 'rgba(255,255,255,';
      bullets = bullets.filter(function (b) { return b.fromPlayer; });
      var dmg = 15;
      enemies.forEach(function (e) { e.hp -= dmg; addParticle(e.x + e.w / 2, e.y + e.h / 2, e.color); });
      enemies = enemies.filter(function (e) { if (e.hp <= 0) { score += e.score; killsThisLevel++; return false; } return true; });
      if (boss) { boss.hp -= dmg * 3; for (var pi = 0; pi < 40; pi++) addParticle(boss.x + boss.w / 2, boss.y + boss.h / 2, '#ff6b35'); if (boss.hp <= 0) { hasKilledBossThisRun = true; if (!localStorage.getItem(ACH_KEYS.boss)) localStorage.setItem(ACH_KEYS.boss, '1'); if (!localStorage.getItem(SHIP_B_KEY)) localStorage.setItem(SHIP_B_KEY, '1'); if (level === 1 && !hasBeenHitThisRun && !localStorage.getItem(ACH_KEYS.nodamage1)) localStorage.setItem(ACH_KEYS.nodamage1, '1'); addShake(15); hitStopFrames = 5; score += boss.score; level++; killsThisLevel = 0; boss = null; } }
      for (var pi = 0; pi < 60; pi++) addParticle(CW / 2, CH / 2, '#ffaa00');
      AUDIO.playExplosion();
    }

    if (touchMoveTarget !== null) {
      var deadzone = 18;
      var dx = touchMoveTarget.x - (player.x + player.w / 2);
      var dy = touchMoveTarget.y - (player.y + player.h / 2);
      if (Math.abs(dx) < deadzone && Math.abs(dy) < deadzone) { /* 死区 */ } else {
        if (touchMoveSmoothed === null) touchMoveSmoothed = { x: player.x + player.w / 2, y: player.y + player.h / 2 };
        touchMoveSmoothed.x += (touchMoveTarget.x - touchMoveSmoothed.x) * 0.18;
        touchMoveSmoothed.y += (touchMoveTarget.y - touchMoveSmoothed.y) * 0.18;
        var tx = touchMoveSmoothed.x - player.w / 2;
        var ty = touchMoveSmoothed.y - player.h / 2;
        player.x = Math.max(0, Math.min(bounds.w - player.w, tx));
        player.y = Math.max(0, Math.min(bounds.h - player.h, ty));
      }
    } else {
      touchMoveSmoothed = null;
      player.vx = (keys['ArrowRight'] || keys['KeyD'] ? 1 : 0) - (keys['ArrowLeft'] || keys['KeyA'] ? 1 : 0);
      player.vy = (keys['ArrowDown'] || keys['KeyS'] ? 1 : 0) - (keys['ArrowUp'] || keys['KeyW'] ? 1 : 0);
      player.update(now, bounds);
    }

    if (autoFire) {
      const list = player.fire(now);
      if (list.length) {
        bullets.push(...list);
        AUDIO.playShoot();
      }
    }

    // 导弹自动跟踪：朝向最近敌机或 Boss 调整速度
    bullets.forEach(function (b) {
      if (!b.fromPlayer || !b.isMissile) return;
      var bx = b.x + b.w / 2;
      var by = b.y + b.h / 2;
      var tx = null;
      var ty = null;
      var bestDist = Infinity;
      enemies.forEach(function (e) {
        var ex = e.x + e.w / 2;
        var ey = e.y + e.h / 2;
        var d = (ex - bx) * (ex - bx) + (ey - by) * (ey - by);
        if (d < bestDist && ey > by - 50) {
          bestDist = d;
          tx = ex;
          ty = ey;
        }
      });
      if (boss) {
        var ex = boss.x + boss.w / 2;
        var ey = boss.y + boss.h / 2;
        var d = (ex - bx) * (ex - bx) + (ey - by) * (ey - by);
        if (d < bestDist) {
          bestDist = d;
          tx = ex;
          ty = ey;
        }
      }
      if (tx != null && ty != null) {
        var dx = tx - bx;
        var dy = ty - by;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var wantSpeed = 13;
        var wantVx = (dx / len) * wantSpeed;
        var wantVy = (dy / len) * wantSpeed;
        var turn = 0.12;
        b.vx = (b.vx || 0) + (wantVx - (b.vx || 0)) * turn;
        b.vy = (b.vy || -12) + (wantVy - (b.vy || -12)) * turn;
        var vlen = Math.sqrt(b.vx * b.vx + b.vy * b.vy) || 1;
        b.vx = (b.vx / vlen) * wantSpeed;
        b.vy = (b.vy / vlen) * wantSpeed;
      }
    });

    bullets = bullets.filter((b) => ENTITIES.updateBullet(b, bounds));
    powerUps = powerUps.filter((p) => ENTITIES.updatePowerUp(p, bounds));

    if (now > comboTimeout) comboCount = 0;
    if (boss) {
      ENTITIES.updateBoss(boss, bounds, now, player.x + player.w / 2);
      bullets.push(...ENTITIES.bossShoot(boss, bounds, now, player.x + player.w / 2, player.y + player.h / 2));
    } else if (killsThisLevel >= cfg.levelKills) {
      if (!bossWarningUntil) bossWarningUntil = now + 1800;
      if (now >= bossWarningUntil) {
        boss = ENTITIES.createBoss(bounds, level);
        bossWarningUntil = 0;
      }
    }

    if (!boss && now >= nextSpawn) {
      const interval = Math.max(
        cfg.spawnIntervalMin,
        cfg.spawnInterval - (level - 1) * 65
      ) * DIFFICULTY_SPAWN_MULT[difficulty];
      nextSpawn = now + interval;
      var e = ENTITIES.createEnemy(bounds, level);
      e.vy *= DIFFICULTY_SPEED_MULT[difficulty];
      enemies.push(e);
    }
    enemies = enemies.filter((e) => ENTITIES.updateEnemy(e, bounds));

    var playerCx = player.x + player.w / 2;
    var playerCy = player.y + player.h / 2;
    const playerBox = player.hitbox;
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (b.fromPlayer) continue;
      var bcx = b.x + b.w / 2;
      var bcy = b.y + b.h / 2;
      var dist = Math.sqrt((playerCx - bcx) * (playerCx - bcx) + (playerCy - bcy) * (playerCy - bcy));
      if (!b.closeCounted && dist > 0 && dist < 30 && !aabb(playerBox, { x: b.x, y: b.y, w: b.w, h: b.h })) {
        b.closeCounted = true;
        closeCallCountThisRun++;
        score += 80;
        addFloatingText(playerCx, playerCy - 25, 'CLOSE!', 900);
      }
        if (!invuln && aabb(playerBox, { x: b.x, y: b.y, w: b.w, h: b.h })) {
        bullets.splice(i, 1);
        comboCount = 0;
        hasBeenHitThisRun = true;
        addShake(8);
        flashAlpha = 0.5;
        flashColor = 'rgba(220,60,60,';
        player.hit(now);
        addParticle(playerCx, playerCy, '#e85d5d');
        AUDIO.playPlayerHit();
        if (player.lives <= 0) {
          showGameOver(now);
          return;
        }
        updateHUD(now);
      }
    }

    if (boss && !invuln && aabb(playerBox, { x: boss.x, y: boss.y, w: boss.w, h: boss.h })) {
      hasBeenHitThisRun = true;
      addShake(8);
      flashAlpha = 0.5;
      flashColor = 'rgba(220,60,60,';
      player.hit(now);
      addParticle(playerCx, playerCy, '#e85d5d');
      AUDIO.playPlayerHit();
      if (player.lives <= 0) {
        showGameOver(now);
        return;
      }
      updateHUD(now);
    }

    for (const e of enemies) {
      if (!invuln && aabb(playerBox, { x: e.x, y: e.y, w: e.w, h: e.h })) {
        comboCount = 0;
        hasBeenHitThisRun = true;
        addShake(8);
        flashAlpha = 0.5;
        flashColor = 'rgba(220,60,60,';
        player.hit(now);
        addParticle(playerCx, playerCy, '#e85d5d');
        AUDIO.playPlayerHit();
        if (player.lives <= 0) {
          showGameOver(now);
          return;
        }
        updateHUD();
      }
    }

    for (var i = powerUps.length - 1; i >= 0; i--) {
      var p = powerUps[i];
      if (!aabb(playerBox, { x: p.x, y: p.y, w: p.w, h: p.h })) continue;
      var cx = p.x + p.w / 2;
      var cy = p.y + p.h / 2;
      if (p.type === 'P') { player.addWeaponLevel(); addFloatingText(cx, cy - 20, '+POWER', 1200); }
      else if (p.type === 'M') { player.missileCount += 3; addFloatingText(cx, cy - 20, '+MISSILE', 1200); }
      else if (p.type === 'N') { player.nukeCount += 1; addFloatingText(cx, cy - 20, '+NUKE', 1200); }
      AUDIO.playPowerUp();
      powerUps.splice(i, 1);
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      if (!b.fromPlayer) continue;
      const br = { x: b.x, y: b.y, w: b.w, h: b.h };
      const damage = b.damage ?? 1;
      if (boss && aabb(br, { x: boss.x, y: boss.y, w: boss.w, h: boss.h })) {
        boss.hp -= damage;
        bullets.splice(i, 1);
        if (boss.hp <= boss.maxHp * 0.5 && !boss.phase2) {
          boss.phase2 = true;
          addShake(4);
          flashAlpha = 0.25;
          flashColor = 'rgba(255,180,80,';
        }
        if (boss.hp <= 0) {
          hasKilledBossThisRun = true;
          if (!localStorage.getItem(ACH_KEYS.boss)) localStorage.setItem(ACH_KEYS.boss, '1');
          if (!localStorage.getItem(SHIP_B_KEY)) localStorage.setItem(SHIP_B_KEY, '1');
          if (level === 1 && !hasBeenHitThisRun && !localStorage.getItem(ACH_KEYS.nodamage1)) localStorage.setItem(ACH_KEYS.nodamage1, '1');
          comboCount++;
          comboTimeout = now + 2500;
          var mult = 1 + Math.min(Math.floor(comboCount / 5), 4);
          score += boss.score * mult;
          addShake(15);
          flashAlpha = 0.4;
          flashColor = 'rgba(255,255,255,';
          hitStopFrames = 5;
          addParticle(boss.x + boss.w / 2, boss.y + boss.h / 2, boss.color);
          for (var k = 0; k < (lowQuality ? 10 : 25); k++) addParticle(boss.x + boss.w / 2, boss.y + boss.h / 2, '#e85d5d');
          if (Math.random() < 0.4) powerUps.push(ENTITIES.createPowerUp(boss.x + boss.w / 2 - 12, boss.y + boss.h / 2 - 12, 'N'));
          AUDIO.playBossKill();
          boss = null;
          level++;
          killsThisLevel = 0;
          stageTitleLevel = level;
          stageTitleUntil = now + 2000;
        }
        continue;
      }
      for (let j = enemies.length - 1; j >= 0; j--) {
        const e = enemies[j];
        if (!aabb(br, { x: e.x, y: e.y, w: e.w, h: e.h })) continue;
        e.hp -= damage;
        bullets.splice(i, 1);
        if (e.hp <= 0) {
          if (!hasKilledEnemyThisRun) { hasKilledEnemyThisRun = true; if (!localStorage.getItem(ACH_KEYS.first_blood)) localStorage.setItem(ACH_KEYS.first_blood, '1'); }
          comboCount++;
          comboTimeout = now + 2500;
          if (comboCount >= 5) AUDIO.playCombo();
          var mult = 1 + Math.min(Math.floor(comboCount / 5), 4);
          score += e.score * mult;
          killsThisLevel++;
          addParticle(e.x + e.w / 2, e.y + e.h / 2, e.color);
          var rx = e.x + e.w / 2 - 12;
          var ry = e.y + e.h / 2 - 12;
          var r = Math.random();
          if (r < 0.2) powerUps.push(ENTITIES.createPowerUp(rx, ry, 'P'));
          else if (r < 0.32) powerUps.push(ENTITIES.createPowerUp(rx, ry, 'M'));
          else if (r < 0.38) powerUps.push(ENTITIES.createPowerUp(rx, ry, 'N'));
          AUDIO.playExplosion();
          enemies.splice(j, 1);
        }
        break;
      }
    }

    particles = particles.filter((p) => {
      p.x += p.vx * (dt / 16);
      p.y += p.vy * (dt / 16);
      p.life -= dt / 1000;
      return p.life > 0;
    });
    floatingTexts = floatingTexts.filter(function (ft) {
      ft.y -= 0.08 * (dt / 16);
      ft.life -= dt;
      return ft.life > 0;
    });
    shakeAmount *= 0.82;
    if (flashAlpha > 0) flashAlpha *= 0.88;
    if (score >= lastMilestone + MILESTONE_SCORE) {
      lastMilestone += MILESTONE_SCORE;
      player.lives++;
      addFloatingText(CW / 2, CH / 2, '+1 LIFE', 1500);
    }
    if (score >= MILESTONE_SCORE && !localStorage.getItem(ACH_KEYS.score50k)) localStorage.setItem(ACH_KEYS.score50k, '1');
    updateHUD(now);
  }

  // ----- 背景层次：星空（远/近）、云层、远山 -----
  const starsFar = Array.from({ length: 60 }, () => ({
    x: Math.random() * CW,
    y: Math.random() * (CH + 100),
    r: 0.4 + Math.random() * 0.8,
    a: 0.15 + Math.random() * 0.3,
    speed: 0.015,
  }));
  const starsNear = Array.from({ length: 100 }, () => ({
    x: Math.random() * CW,
    y: Math.random() * (CH + 100),
    r: 1 + Math.random() * 1.5,
    a: 0.25 + Math.random() * 0.5,
    speed: 0.045,
  }));
  const clouds = Array.from({ length: 12 }, () => ({
    x: Math.random() * CW * 1.5,
    y: Math.random() * CH * 0.7,
    w: 80 + Math.random() * 120,
    h: 24 + Math.random() * 32,
    speed: 0.08 + Math.random() * 0.12,
    a: 0.08 + Math.random() * 0.1,
  }));
  const hills = [
    { x: 0, w: CW + 200, h: 90, offset: 0, speed: 0.03 },
    { x: 0, w: CW + 200, h: 70, offset: 40, speed: 0.06 },
  ];

  function drawBackground(now) {
    var theme = Math.floor((level - 1) / 3) % 3;
    var g = ctx.createLinearGradient(0, 0, 0, CH);
    if (theme === 0) {
      g.addColorStop(0, '#050810');
      g.addColorStop(0.4, '#0a0e1a');
      g.addColorStop(0.75, '#0f1525');
      g.addColorStop(1, '#141c2e');
    } else if (theme === 1) {
      g.addColorStop(0, '#1a0a12');
      g.addColorStop(0.4, '#2a1520');
      g.addColorStop(0.75, '#351a28');
      g.addColorStop(1, '#25182a');
    } else {
      g.addColorStop(0, '#0a0618');
      g.addColorStop(0.4, '#0f0a22');
      g.addColorStop(0.75, '#15102e');
      g.addColorStop(1, '#1a1535');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CW, CH);

    var starColorFar = theme === 0 ? '99, 179, 237' : theme === 1 ? '255, 150, 120' : '180, 160, 255';
    var starColorNear = theme === 0 ? '180, 210, 255' : theme === 1 ? '255, 200, 180' : '220, 200, 255';
    starsFar.forEach((s) => {
      const y = ((s.y + now * s.speed) % (CH + 120)) - 20;
      ctx.fillStyle = 'rgba(' + starColorFar + ', ' + (s.a * (0.5 + 0.15 * Math.sin(now * 0.001 + s.x))) + ')';
      ctx.beginPath();
      ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    starsNear.forEach((s) => {
      const y = ((s.y + now * s.speed) % (CH + 120)) - 20;
      ctx.fillStyle = 'rgba(' + starColorNear + ', ' + (s.a * (0.6 + 0.2 * Math.sin(now * 0.002 + s.x * 0.5))) + ')';
      ctx.beginPath();
      ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    var cloudColor = theme === 0 ? '99, 179, 237' : theme === 1 ? '255, 180, 140' : '140, 120, 200';
    clouds.forEach((c) => {
      const x = (c.x - now * c.speed) % (CW + c.w) - c.w;
      ctx.fillStyle = 'rgba(' + cloudColor + ', ' + c.a + ')';
      ctx.beginPath();
      ctx.ellipse(x + c.w / 2, c.y, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + c.w / 2 + c.w * 0.25, c.y - c.h * 0.3, c.w * 0.35, c.h * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + c.w / 2 - c.w * 0.2, c.y - c.h * 0.2, c.w * 0.3, c.h * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    var hillColor = theme === 0 ? '10, 18, 32' : theme === 1 ? '30, 15, 25' : '15, 12, 28';
    hills.forEach((h) => {
      const shift = (now * h.speed) % 200;
      ctx.fillStyle = 'rgba(' + hillColor + ', 0.85)';
      ctx.beginPath();
      ctx.moveTo(-100, CH + 20);
      for (let i = 0; i <= CW + 300; i += 80) {
        const x = i - shift + h.offset;
        const y = CH - h.h + 15 * Math.sin(i * 0.02 + now * 0.001);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(CW + 200, CH + 20);
      ctx.closePath();
      ctx.fill();
    });
  }

  /** 己方：优先使用 assets/player.png，否则矢量绘制 */
  function drawPlayerPlane(cx, cy, w, h, invuln, now) {
    const blink = invuln && Math.floor(now / 80) % 2 === 0;
    if (blink) return;
    const hw = w / 2;
    const hh = h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    var img = planeImages.player;
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, -hw, -hh, w, h);
      ctx.restore();
      return;
    }

    // 机身下侧阴影
    var bodyGrad = ctx.createLinearGradient(-hw, -hh, hw, hh);
    bodyGrad.addColorStop(0, '#152535');
    bodyGrad.addColorStop(0.4, '#1e3a5f');
    bodyGrad.addColorStop(0.7, '#2a4a6a');
    bodyGrad.addColorStop(1, '#1a3048');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(0, -hh + 1);
    ctx.lineTo(-hw * 0.3, hh * 0.12);
    ctx.lineTo(-hw * 0.22, hh - 2);
    ctx.lineTo(0, hh * 0.52);
    ctx.lineTo(hw * 0.22, hh - 2);
    ctx.lineTo(hw * 0.3, hh * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(99, 179, 237, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 机翼主翼（后掠 + 前缘襟翼轮廓）
    ctx.fillStyle = 'rgba(30, 55, 85, 0.98)';
    ctx.beginPath();
    ctx.moveTo(-hw * 0.52, hh * 0.08);
    ctx.lineTo(-hw * 0.24, hh - 1);
    ctx.lineTo(0, hh * 0.48);
    ctx.lineTo(hw * 0.24, hh - 1);
    ctx.lineTo(hw * 0.52, hh * 0.08);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(99, 179, 237, 0.55)';
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120, 190, 255, 0.4)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.48, hh * 0.15);
    ctx.lineTo(hw * 0.48, hh * 0.15);
    ctx.stroke();
    ctx.lineWidth = 1;

    // 发动机舱（两鼓包）
    ctx.fillStyle = 'rgba(25, 45, 70, 0.95)';
    ctx.beginPath();
    ctx.ellipse(-hw * 0.18, hh * 0.35, hw * 0.08, hh * 0.22, 0, 0, Math.PI * 2);
    ctx.ellipse(hw * 0.18, hh * 0.35, hw * 0.08, hh * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(99, 179, 237, 0.4)';
    ctx.stroke();

    // 机头 / 座舱盖
    bodyGrad = ctx.createLinearGradient(-hw * 0.2, -hh, hw * 0.2, hh * 0.3);
    bodyGrad.addColorStop(0, '#8ec8f0');
    bodyGrad.addColorStop(0.35, '#63b3ed');
    bodyGrad.addColorStop(0.7, '#3d8bc9');
    bodyGrad.addColorStop(1, '#2a6a9a');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.2, -hh * 0.58);
    ctx.lineTo(0, hh * 0.22);
    ctx.lineTo(hw * 0.2, -hh * 0.58);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(180, 220, 255, 0.75)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(220, 240, 255, 0.5)';
    ctx.beginPath();
    ctx.ellipse(0, -hh * 0.22, hw * 0.09, hh * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.lineWidth = 1;

    // 机头天线
    ctx.strokeStyle = 'rgba(99, 179, 237, 0.7)';
    ctx.beginPath();
    ctx.moveTo(0, -hh + 1);
    ctx.lineTo(0, -hh - 2);
    ctx.stroke();

    // 垂尾（双尾翼 + 内缘线）
    ctx.fillStyle = '#1e3a5f';
    ctx.beginPath();
    ctx.moveTo(-hw * 0.2, hh * 0.38);
    ctx.lineTo(-hw * 0.28, hh - 1);
    ctx.lineTo(-hw * 0.1, hh * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hw * 0.1, hh * 0.5);
    ctx.lineTo(hw * 0.28, hh - 1);
    ctx.lineTo(hw * 0.2, hh * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(99, 179, 237, 0.5)';
    ctx.stroke();

    // 尾喷（双喷口 + 内焰）
    ctx.fillStyle = 'rgba(40, 35, 30, 0.9)';
    ctx.beginPath();
    ctx.ellipse(-hw * 0.1, hh - 1, hw * 0.06, hh * 0.12, 0, 0, Math.PI * 2);
    ctx.ellipse(hw * 0.1, hh - 1, hw * 0.06, hh * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(232, 184, 109, 0.85)';
    ctx.beginPath();
    ctx.moveTo(-hw * 0.12, hh - 2);
    ctx.lineTo(-hw * 0.04, hh + 4);
    ctx.lineTo(0, hh + 2);
    ctx.lineTo(hw * 0.04, hh + 4);
    ctx.lineTo(hw * 0.12, hh - 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 200, 120, 0.6)';
    ctx.stroke();
    ctx.restore();
  }

  /** 敌机：优先使用 assets/enemy0~4.png，否则矢量绘制 */
  function drawEnemyPlane(cx, cy, w, h, color, typeIndex) {
    const hw = w / 2;
    const hh = h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    var img = planeImages['enemy' + typeIndex];
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, -hw, -hh, w, h);
      ctx.restore();
      return;
    }
    var darkMap = ['#1e2630', '#3a3025', '#252d38', '#302a20', '#221a32', '#2a2218'];
    var dark = darkMap[typeIndex] || '#252d38';
    var wingSpan = typeIndex === 1 ? 0.55 : typeIndex === 2 ? 0.48 : typeIndex === 4 ? 0.58 : typeIndex === 5 ? 0.52 : 0.5;

    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(0, hh - 1);
    ctx.lineTo(-hw * 0.28, -hh * 0.18);
    ctx.lineTo(-hw * 0.2, -hh + 2);
    ctx.lineTo(0, -hh * 0.48);
    ctx.lineTo(hw * 0.2, -hh + 2);
    ctx.lineTo(hw * 0.28, -hh * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-hw * wingSpan, -hh * 0.02);
    ctx.lineTo(-hw * 0.22, -hh + 1);
    ctx.lineTo(0, -hh * 0.42);
    ctx.lineTo(hw * 0.22, -hh + 1);
    ctx.lineTo(hw * wingSpan, -hh * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(-hw * (wingSpan - 0.08), hh * 0.1);
    ctx.lineTo(hw * (wingSpan - 0.08), hh * 0.1);
    ctx.stroke();

    var canopyGrad = ctx.createLinearGradient(-hw * 0.14, hh * 0.2, hw * 0.14, -hh);
    canopyGrad.addColorStop(0, 'rgba(255,255,255,0.4)');
    canopyGrad.addColorStop(0.6, 'rgba(255,255,255,0.15)');
    canopyGrad.addColorStop(1, 'rgba(255,255,255,0.05)');
    ctx.fillStyle = canopyGrad;
    ctx.beginPath();
    ctx.ellipse(0, -hh * 0.32, hw * 0.13, hh * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.stroke();

    if (typeIndex === 1 || typeIndex === 3 || typeIndex === 4) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.moveTo(-hw * 0.16, hh * 0.18);
      ctx.lineTo(0, -hh * 0.08);
      ctx.lineTo(hw * 0.16, hh * 0.18);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(-hw * 0.08, hh * 0.25, hw * 0.05, hh * 0.12, 0, 0, Math.PI * 2);
    ctx.ellipse(hw * 0.08, hh * 0.25, hw * 0.05, hh * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Boss：优先使用 assets/boss.png，否则矢量绘制 + 血条 */
  function drawBoss(boss, now) {
    const cx = boss.x + boss.w / 2;
    const cy = boss.y + boss.h / 2;
    const hw = boss.w / 2;
    const hh = boss.h / 2;
    ctx.save();
    ctx.translate(cx, cy);
    var img = planeImages.boss;
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, -hw, -hh, boss.w, boss.h);
      ctx.restore();
    } else {
    ctx.fillStyle = '#2a1520';
    ctx.beginPath();
    ctx.moveTo(0, hh - 4);
    ctx.lineTo(-hw * 0.7, -hh * 0.3);
    ctx.lineTo(-hw * 0.5, -hh + 4);
    ctx.lineTo(0, -hh * 0.4);
    ctx.lineTo(hw * 0.5, -hh + 4);
    ctx.lineTo(hw * 0.7, -hh * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(232, 93, 93, 0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = boss.phase2 ? '#ff6b35' : boss.color;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.5, hh * 0.2);
    ctx.lineTo(-hw * 0.35, -hh * 0.2);
    ctx.lineTo(0, -hh * 0.35);
    ctx.lineTo(hw * 0.35, -hh * 0.2);
    ctx.lineTo(hw * 0.5, hh * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = boss.phase2 ? 'rgba(255,180,100,0.7)' : 'rgba(255,200,200,0.5)';
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.ellipse(0, -hh * 0.2, hw * 0.2, hh * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    }
    const barW = 200;
    const barX = (CW - barW) / 2;
    const barY = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barX - 2, barY - 2, barW + 4, 14);
    ctx.fillStyle = boss.phase2 ? '#ff6b35' : '#e85d5d';
    ctx.fillRect(barX, barY, (boss.hp / boss.maxHp) * barW, 10);
    ctx.strokeStyle = boss.phase2 ? 'rgba(255,107,53,0.9)' : 'rgba(232, 93, 93, 0.8)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, 10);
    ctx.fillStyle = '#fff';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(boss.phase2 ? 'BOSS PHASE 2' : 'BOSS', CW / 2, barY + 8);
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(Math.max(0, Math.ceil(boss.hp)) + ' / ' + boss.maxHp, CW / 2, barY + 22);
  }

  /** 按 shape 绘制多种子弹形态 */
  function drawBullet(b, now) {
    const x = b.x + b.w / 2;
    const y = b.y + b.h / 2;
    const shape = b.shape || (b.fromPlayer ? 'rect' : 'rect');
    ctx.save();

    if (!b.fromPlayer) {
      const hue = b.pattern === 'aimed' ? 0 : b.pattern === 'wave' ? 30 : b.pattern === 'burst' ? 330 : 0;
      ctx.fillStyle = 'hsl(' + hue + ', 70%, 55%)';
      ctx.shadowColor = 'hsl(' + hue + ', 80%, 60%)';
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.ellipse(x, y, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
      return;
    }

    switch (shape) {
      case 'rect':
        ctx.fillStyle = '#63b3ed';
        ctx.shadowColor = '#63b3ed';
        ctx.shadowBlur = 6;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        break;
      case 'rounded':
        ctx.fillStyle = '#7dd3fc';
        ctx.shadowColor = '#7dd3fc';
        ctx.shadowBlur = 8;
        (function () {
          var r = 3, tx = b.x, ty = b.y;
          ctx.beginPath();
          ctx.moveTo(tx + r, ty);
          ctx.lineTo(tx + b.w - r, ty);
          ctx.arcTo(tx + b.w, ty, tx + b.w, ty + r, r);
          ctx.lineTo(tx + b.w, ty + b.h - r);
          ctx.arcTo(tx + b.w, ty + b.h, tx + b.w - r, ty + b.h, r);
          ctx.lineTo(tx + r, ty + b.h);
          ctx.arcTo(tx, ty + b.h, tx, ty + b.h - r, r);
          ctx.lineTo(tx, ty + r);
          ctx.arcTo(tx, ty, tx + r, ty, r);
          ctx.closePath();
          ctx.fill();
        })();
        break;
      case 'beam':
        ctx.fillStyle = '#38bdf8';
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 10;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#7dd3fc';
        ctx.fillRect(b.x - 1, b.y + b.h, b.w + 2, 12);
        ctx.globalAlpha = 1;
        break;
      case 'missile':
        ctx.fillStyle = '#a78bfa';
        ctx.shadowColor = '#a78bfa';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.ellipse(x, y, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(196, 181, 253, 0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#c4b5fd';
        ctx.fillRect(b.x - 2, b.y + b.h, b.w + 4, 14);
        ctx.globalAlpha = 1;
        break;
      case 'needle':
        ctx.fillStyle = '#c084fc';
        ctx.shadowColor = '#c084fc';
        ctx.shadowBlur = 4;
        ctx.fillRect(b.x, b.y, b.w, b.h);
        break;
      case 'ring':
        ctx.strokeStyle = '#fbbf24';
        ctx.fillStyle = 'rgba(251, 191, 36, 0.4)';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(x, y, b.w / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      case 'ellipse':
        ctx.fillStyle = '#fbbf24';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.ellipse(x, y, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();
        break;
      default:
        ctx.fillStyle = '#63b3ed';
        ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function render(now) {
    var shakeX = shakeAmount > 0 ? (Math.random() - 0.5) * 2 * shakeAmount : 0;
    var shakeY = shakeAmount > 0 ? (Math.random() - 0.5) * 2 * shakeAmount : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    drawBackground(now);

    if (bossWarningUntil && now < bossWarningUntil) {
      ctx.save();
      var alpha = 0.5 + 0.5 * Math.sin(now * 0.008);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#e85d5d';
      ctx.font = 'bold 48px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('WARNING', CW / 2, CH / 2 - 20);
      ctx.font = '16px "JetBrains Mono", monospace';
      ctx.fillText('BOSS INCOMING', CW / 2, CH / 2 + 25);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    if (state === 'playing' && stageTitleUntil > 0 && now < stageTitleUntil) {
      ctx.save();
      var a = 1 - (stageTitleUntil - now) / 1000;
      if (a > 0.8) a = (stageTitleUntil - now) / 200;
      ctx.globalAlpha = Math.min(1, a);
      ctx.fillStyle = '#5de88a';
      ctx.font = 'bold 42px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(93, 232, 138, 0.8)';
      ctx.shadowBlur = 20;
      ctx.fillText('STAGE ' + stageTitleLevel, CW / 2, CH / 2);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    if (state !== 'playing' && state !== 'gameover') return;

    const invuln = player.isInvuln(now);
    const cx = player.x + player.w / 2;
    const cy = player.y + player.h / 2;
    drawPlayerPlane(cx, cy, player.w, player.h, invuln, now);

    bullets.forEach((b) => drawBullet(b, now));

    if (boss) drawBoss(boss, now);
    enemies.forEach((e) => {
      drawEnemyPlane(e.x + e.w / 2, e.y + e.h / 2, e.w, e.h, e.color, e.typeIndex);
    });

    powerUps.forEach(function (p) {
      ctx.save();
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      var isM = p.type === 'M';
      var isN = p.type === 'N';
      ctx.strokeStyle = isN ? '#e85d5d' : isM ? '#f59e0b' : '#e8b86d';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(-p.w / 2 + 2, -p.h / 2 + 2, p.w - 4, p.h - 4);
      ctx.setLineDash([]);
      ctx.fillStyle = isN ? 'rgba(232, 93, 93, 0.95)' : isM ? 'rgba(245, 158, 11, 0.95)' : 'rgba(232, 184, 109, 0.9)';
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.type, 0, 0);
      ctx.restore();
    });

    particles.forEach((p) => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });
    floatingTexts.forEach(function (ft) {
      var a = ft.life / ft.maxLife;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 18px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });
    ctx.restore();
    if (flashAlpha > 0.01) {
      ctx.fillStyle = flashColor + flashAlpha + ')';
      ctx.fillRect(0, 0, CW, CH);
    }
  }

  function gameLoop(now) {
    now = now || performance.now();
    var dt = Math.min(now - lastTime, 50);
    lastTime = now;
    if (hitStopFrames > 0) {
      hitStopFrames--;
      render(now);
      requestAnimationFrame(gameLoop);
      return;
    }
    if (state === 'playing') {
      runPlaying(now, dt);
    }
    render(now);
    requestAnimationFrame(gameLoop);
  }

  document.addEventListener('keydown', (e) => {
    if (e.code === 'KeyP' && state === 'playing') {
      state = 'pause';
      var ps = document.getElementById('pause-score');
      var pb = document.getElementById('pause-best');
      if (ps) ps.textContent = String(score).padStart(7, '0');
      if (pb) pb.textContent = String(highScore).padStart(7, '0');
      $screenPause.classList.remove('hidden');
      return;
    }
    if (e.code === 'KeyP' && state === 'pause') {
      state = 'playing';
      $screenPause.classList.add('hidden');
      return;
    }
    if (state === 'playing') {
      if (e.code === 'KeyQ') { e.preventDefault(); pendingBomb = true; }
      if (e.code === 'KeyE') { e.preventDefault(); pendingShield = true; }
      if (e.code === 'KeyR') { e.preventDefault(); pendingRapid = true; }
      if (e.code === 'KeyX') { e.preventDefault(); pendingMissile = true; }
      if (e.code === 'KeyN') { e.preventDefault(); pendingNuke = true; }
    }
    if (e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) autoFire = !autoFire;
    }
    keys[e.code] = true;
  });
  document.addEventListener('keyup', (e) => { keys[e.code] = false; });

  var $btnContinue = document.getElementById('btn-continue');
  var $diffBtns = document.getElementById('difficulty-btns');
  var $shipBtns = document.getElementById('ship-btns');
  var $firstHint = document.getElementById('first-time-hint');
  var $btnGotIt = document.getElementById('btn-got-it');
  var $shipSelectRow = document.getElementById('ship-select-row');

  function applySettings() {
    if (AUDIO.setMuted) AUDIO.setMuted(!!localStorage.getItem(SETTINGS_KEYS.mute));
    var diff = localStorage.getItem(SETTINGS_KEYS.difficulty);
    if (diff != null) difficulty = parseInt(diff, 10);
    var ship = localStorage.getItem(SETTINGS_KEYS.shipType);
    if (ship) shipType = ship;
    lowQuality = !!localStorage.getItem(SETTINGS_KEYS.lowQuality);
    var diffEl = $diffBtns && $diffBtns.querySelector('[data-diff="' + difficulty + '"]');
    if (diffEl) { $diffBtns.querySelectorAll('.opt-btn').forEach(function (b) { b.classList.remove('active'); }); diffEl.classList.add('active'); }
    var shipEl = $shipBtns && $shipBtns.querySelector('[data-ship="' + shipType + '"]');
    if (shipEl && !shipEl.disabled) { $shipBtns.querySelectorAll('.opt-btn').forEach(function (b) { b.classList.remove('active'); }); shipEl.classList.add('active'); }
    var soundCheck = document.getElementById('sound-checkbox');
    if (soundCheck) soundCheck.checked = !localStorage.getItem(SETTINGS_KEYS.mute);
    var lowqCheck = document.getElementById('lowq-checkbox');
    if (lowqCheck) lowqCheck.checked = lowQuality;
  }

  $btnStart.addEventListener('click', () => {
    touchMoveTarget = null;
    touchMoveSmoothed = null;
    var diffEl = $diffBtns && $diffBtns.querySelector('.opt-btn.active');
    if (diffEl) { difficulty = parseInt(diffEl.dataset.diff || '1', 10); localStorage.setItem(SETTINGS_KEYS.difficulty, String(difficulty)); }
    var shipEl = $shipBtns && $shipBtns.querySelector('.opt-btn.active');
    if (shipEl && shipEl.dataset.ship) { shipType = shipEl.dataset.ship; localStorage.setItem(SETTINGS_KEYS.shipType, shipType); }
    AUDIO.resume();
    resetGame();
    state = 'playing';
    stageTitleLevel = 1;
    stageTitleUntil = performance.now() + 1800;
    $screenStart.classList.add('hidden');
    $screenPause.classList.add('hidden');
    $screenGameover.classList.add('hidden');
    AUDIO.startBGM();
  });

  if ($btnContinue) {
    $btnContinue.addEventListener('click', () => {
      if (continuesLeft <= 0) return;
      continuesLeft--;
      state = 'playing';
      player.lives = 1;
      player.invulnUntil = performance.now() + 3500;
      bullets = bullets.filter(function (b) { return b.fromPlayer; });
      $screenGameover.classList.add('hidden');
      $btnContinue.classList.add('hidden');
    });
  }

  $btnRestart.addEventListener('click', () => {
    touchMoveTarget = null;
    touchMoveSmoothed = null;
    resetGame();
    state = 'playing';
    stageTitleLevel = 1;
    stageTitleUntil = performance.now() + 1800;
    $screenStart.classList.add('hidden');
    $screenPause.classList.add('hidden');
    $screenGameover.classList.add('hidden');
    AUDIO.startBGM();
  });

  if ($diffBtns) {
    $diffBtns.querySelectorAll('.opt-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $diffBtns.querySelectorAll('.opt-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
      });
    });
  }
  if ($shipBtns) {
    var shipBUnlocked = !!localStorage.getItem(SHIP_B_KEY);
    $shipBtns.querySelectorAll('.opt-btn').forEach(function (btn) {
      if (btn.dataset.ship === 'B') {
        btn.disabled = !shipBUnlocked;
        if (!shipBUnlocked) btn.title = '击破一次 Boss 解锁';
      }
      btn.addEventListener('click', function () {
        if (this.disabled) return;
        $shipBtns.querySelectorAll('.opt-btn').forEach(function (b) { b.classList.remove('active'); });
        this.classList.add('active');
      });
    });
  }
  if ($firstHint && !localStorage.getItem(PLAYED_KEY)) {
    $firstHint.classList.remove('hidden');
  }
  if ($btnGotIt) {
    $btnGotIt.addEventListener('click', function () {
      localStorage.setItem(PLAYED_KEY, '1');
      if ($firstHint) $firstHint.classList.add('hidden');
    });
  }

  var isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouchDevice) {
    var firstTimeText = document.getElementById('first-time-text');
    if (firstTimeText) firstTimeText.innerHTML = '首次游玩：<strong>左侧滑动</strong>移动，<strong>右侧按钮</strong>射击';
  }

  var $touchMove = document.getElementById('touch-move');
  var $touchFire = document.getElementById('touch-fire');
  var $touchPause = document.getElementById('touch-pause');

  function preventTouch(e) {
    if (state === 'playing') e.preventDefault();
  }
  canvas.addEventListener('touchstart', preventTouch, { passive: false });
  canvas.addEventListener('touchmove', preventTouch, { passive: false });

  if ($touchMove) {
    $touchMove.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      touchMoveTarget = clientToCanvas(e.clientX, e.clientY);
      $touchMove.setPointerCapture(e.pointerId);
    });
    $touchMove.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch' || e.buttons !== 0) touchMoveTarget = clientToCanvas(e.clientX, e.clientY);
    });
    $touchMove.addEventListener('pointerup', function (e) {
      $touchMove.releasePointerCapture(e.pointerId);
      touchMoveTarget = null;
    });
    $touchMove.addEventListener('pointercancel', function () { touchMoveTarget = null; });
  }

  if ($touchPause) {
    $touchPause.addEventListener('click', function () {
      if (state === 'playing') {
        state = 'pause';
        var ps = document.getElementById('pause-score');
        var pb = document.getElementById('pause-best');
        if (ps) ps.textContent = String(score).padStart(7, '0');
        if (pb) pb.textContent = String(highScore).padStart(7, '0');
        $screenPause.classList.remove('hidden');
      } else if (state === 'pause') {
        state = 'playing';
        $screenPause.classList.add('hidden');
      }
    });
  }

  $screenPause.addEventListener('click', function (e) {
    if (state === 'pause' && e.target === $screenPause) {
      state = 'playing';
      $screenPause.classList.add('hidden');
    }
  });

  var $btnPauseResume = document.getElementById('btn-pause-resume');
  var $btnPauseTitle = document.getElementById('btn-pause-title');
  if ($btnPauseResume) {
    $btnPauseResume.addEventListener('click', function (e) {
      e.stopPropagation();
      state = 'playing';
      $screenPause.classList.add('hidden');
    });
  }
  if ($btnPauseTitle) {
    $btnPauseTitle.addEventListener('click', function (e) {
      e.stopPropagation();
      state = 'start';
      $screenPause.classList.add('hidden');
      $screenGameover.classList.add('hidden');
      $screenStart.classList.remove('hidden');
      AUDIO.stopBGM();
    });
  }

  var soundCheck = document.getElementById('sound-checkbox');
  if (soundCheck) {
    soundCheck.addEventListener('change', function () {
      if (this.checked) localStorage.removeItem(SETTINGS_KEYS.mute);
      else localStorage.setItem(SETTINGS_KEYS.mute, '1');
      if (AUDIO.setMuted) AUDIO.setMuted(!this.checked);
    });
  }
  var lowqCheck = document.getElementById('lowq-checkbox');
  if (lowqCheck) {
    lowqCheck.addEventListener('change', function () {
      lowQuality = this.checked;
      if (this.checked) localStorage.setItem(SETTINGS_KEYS.lowQuality, '1');
      else localStorage.removeItem(SETTINGS_KEYS.lowQuality);
    });
  }

  applySettings();

  ['touch-q', 'touch-e', 'touch-r', 'touch-x', 'touch-n'].forEach(function (id, idx) {
    var btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (state !== 'playing') return;
      if (id === 'touch-q') pendingBomb = true;
      else if (id === 'touch-e') pendingShield = true;
      else if (id === 'touch-r') pendingRapid = true;
      else if (id === 'touch-x') pendingMissile = true;
      else if (id === 'touch-n') pendingNuke = true;
      if (navigator.vibrate) navigator.vibrate(10);
    });
  });

  var firePointerId = null;
  var fireDelayTimer = null;
  if ($touchFire) {
    $touchFire.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (firePointerId != null) return;
      firePointerId = e.pointerId;
      $touchFire.setPointerCapture(e.pointerId);
      fireDelayTimer = setTimeout(function () { autoFire = true; }, 80);
    });
    $touchFire.addEventListener('pointerup', function (e) {
      e.preventDefault();
      if (e.pointerId === firePointerId) {
        firePointerId = null;
        if (fireDelayTimer) { clearTimeout(fireDelayTimer); fireDelayTimer = null; }
        autoFire = false;
      }
    });
    $touchFire.addEventListener('pointercancel', function (e) {
      if (e.pointerId === firePointerId) {
        firePointerId = null;
        if (fireDelayTimer) { clearTimeout(fireDelayTimer); fireDelayTimer = null; }
        autoFire = false;
      }
    });
    $touchFire.addEventListener('pointerleave', function () { autoFire = false; });
  }

  resetGame();
  requestAnimationFrame(gameLoop);
})();
