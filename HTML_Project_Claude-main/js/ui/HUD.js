export class HUD {
  constructor(statsSystem, ppSystem, pedometerSystem, inventorySystem, craftingSystem, droneSystem, equipmentSystem) {
    this.stats = statsSystem;
    this.pp = ppSystem;
    this.pedometer = pedometerSystem;
    this.inventory = inventorySystem;
    this.crafting = craftingSystem;
    this.drones = droneSystem;
    this.equipment = equipmentSystem;

    this.ppDisplay = document.getElementById('pp-display');
    this.ppRate = document.getElementById('pp-rate');
    this.hpDisplay = document.getElementById('hp-display');
    this.stepsDisplay = document.getElementById('steps-display');
    this.statList = document.getElementById('stat-list');
    this.gatherBar = document.getElementById('gather-bar');
    this.gatherFill = document.getElementById('gather-fill');
    this.gatherText = document.getElementById('gather-text');
    this.interactHint = document.getElementById('interact-hint');
    this.zoneLabel = document.getElementById('zone-label');

    this._lastUpdate = 0;
    this._throttleMs = 100;

    this._buildStatList();
    this._wirePanelToggles();
    this._wireStatsSidebar();

    // Wire crafting progress to live-update the progress bar
    this.crafting.onCraftProgress = (prog, dur) => {
      this._updateCraftProgressBar(prog, dur);
    };
  }

  _buildStatList() {
    this.statList.innerHTML = '';
    for (const name of this.stats.statNames) {
      const label = this.stats.statLabels[name];

      const row = document.createElement('div');
      row.className = 'stat-row';
      row.dataset.stat = name;

      const info = document.createElement('div');
      info.className = 'stat-info';

      const labelEl = document.createElement('span');
      labelEl.className = 'stat-label';
      labelEl.textContent = label;

      const lvlEl = document.createElement('span');
      lvlEl.className = 'stat-level';
      lvlEl.textContent = `Lv ${this.stats.stats[name].level}`;

      info.appendChild(labelEl);
      info.appendChild(lvlEl);

      const btn = document.createElement('button');
      btn.className = 'stat-up-btn';
      btn.textContent = `+${this.stats.upgradeCost(name)}`;
      btn.dataset.stat = name;
      btn.onclick = () => this._onUpgrade(name, btn, lvlEl);

      row.appendChild(info);
      row.appendChild(btn);
      this.statList.appendChild(row);
    }
  }

  _onUpgrade(name, btn, lvlEl) {
    const ok = this.stats.levelUp(name, this.pp);
    if (!ok) {
      btn.classList.add('flash-fail');
      setTimeout(() => btn.classList.remove('flash-fail'), 400);
      return;
    }
    lvlEl.textContent = `Lv ${this.stats.stats[name].level}`;
    btn.textContent = `+${this.stats.upgradeCost(name)}`;
  }

  _wireStatsSidebar() {
    const btn = document.getElementById('btn-toggle-stat-sidebar');
    const sidebar = document.getElementById('stat-sidebar');
    if (btn && sidebar) {
      btn.addEventListener('click', () => { sidebar.hidden = !sidebar.hidden; });
    }
  }

  _wirePanelToggles() {
    // Toggle panels via buttons in HUD (crafting removed — only at Fabricator)
    const panels = ['inventory-panel', 'drone-panel', 'equipment-panel', 'pedometer-panel'];
    for (const panelId of panels) {
      const btn = document.getElementById(`btn-toggle-${panelId}`);
      const panel = document.getElementById(panelId);
      if (btn && panel) {
        btn.addEventListener('click', () => {
          // Close other panels first
          for (const otherId of panels) {
            if (otherId !== panelId) {
              const other = document.getElementById(otherId);
              if (other) other.hidden = true;
            }
          }
          panel.hidden = !panel.hidden;
          if (!panel.hidden) this._refreshPanel(panelId);
        });
      }
    }
  }

  _refreshPanel(panelId) {
    switch (panelId) {
      case 'inventory-panel': this._refreshInventory(); break;
      case 'crafting-panel': this._refreshCrafting(); break;
      case 'drone-panel': this._refreshDrones(); break;
      case 'equipment-panel': this._refreshEquipment(); break;
      case 'pedometer-panel': this._refreshPedometer(); break;
    }
  }

  // ── Inventory Panel ────────────────────────────────────────────────────────
  _refreshInventory() {
    const el = document.getElementById('inventory-contents');
    if (!el) return;
    el.innerHTML = '';

    const mats = this.inventory.getMaterialList();
    const cons = this.inventory.getConsumableList();
    const tools = this.inventory.getToolList();

    if (mats.length > 0) {
      const title = document.createElement('div');
      title.className = 'panel-subtitle';
      title.textContent = 'Materials';
      el.appendChild(title);
      for (const m of mats) {
        const row = document.createElement('div');
        row.className = 'inv-row';
        row.textContent = `${m.name}: ${m.count}`;
        el.appendChild(row);
      }
    }

    if (tools.length > 0) {
      const title = document.createElement('div');
      title.className = 'panel-subtitle';
      title.textContent = 'Tools';
      el.appendChild(title);
      for (const key of tools) {
        const row = document.createElement('div');
        row.className = 'inv-row';
        row.textContent = key === 'terrainCutter' ? 'Terrain Cutter' : key;
        el.appendChild(row);
      }
    }

    if (cons.length > 0) {
      const title = document.createElement('div');
      title.className = 'panel-subtitle';
      title.textContent = 'Consumables';
      el.appendChild(title);
      for (const c of cons) {
        const row = document.createElement('div');
        row.className = 'inv-row';
        const nameSpan = document.createElement('span');
        nameSpan.textContent = `${c.label}: x${c.count}`;
        const useBtn = document.createElement('button');
        useBtn.className = 'stat-up-btn';
        useBtn.textContent = 'Use';
        const atFullHP = c.heal > 0 && this.stats.currentHP >= this.stats.maxHP;
        useBtn.disabled = c.count <= 0 || atFullHP;
        useBtn.title = atFullHP ? 'HP is already full' : '';
        useBtn.addEventListener('mousedown', () => {
          if (c.heal > 0 && this.stats.currentHP >= this.stats.maxHP) return;
          this.inventory.useConsumable(c.key, this.stats, this.pp);
          this.hpDisplay.textContent = `HP: ${Math.ceil(this.stats.currentHP)} / ${this.stats.maxHP}`;
          this._refreshInventory();
        });
        row.appendChild(nameSpan);
        row.appendChild(useBtn);
        el.appendChild(row);
      }
    }

    if (mats.length === 0 && cons.length === 0 && tools.length === 0) {
      el.innerHTML = '<div class="inv-row" style="opacity:0.5">Empty</div>';
    }
  }

  // ── Crafting Panel ─────────────────────────────────────────────────────────
  _refreshCrafting() {
    const el = document.getElementById('crafting-contents');
    if (!el) return;
    el.innerHTML = '';

    const recipes = this.crafting.getAvailableRecipes();
    if (recipes.length === 0) {
      el.innerHTML = '<div class="inv-row" style="opacity:0.5">No recipes available</div>';
      return;
    }

    for (const recipe of recipes) {
      const row = document.createElement('div');
      row.className = 'craft-row';

      const info = document.createElement('div');
      info.className = 'craft-info';
      const btn = document.createElement('button');
      btn.className = 'stat-up-btn';

      if (recipe.isLocked) {
        // Show locked recipes greyed out with level requirement
        info.style.opacity = '0.4';
        const matList = Object.entries(recipe.materials).map(([m, q]) => `${m}×${q}`).join(', ');
        const typeLabel = recipe.type === 'tool' ? ' [Tool]' : recipe.type === 'equipment' ? ' [Equip]' : '';
        info.innerHTML = `<span class="craft-name">${recipe.label}${typeLabel}</span><span class="craft-mats">Crafting Lv ${recipe.minCraftingLevel} needed</span>`;
        btn.textContent = 'Locked';
        btn.disabled = true;
        btn.style.opacity = '0.4';
      } else {
        const matList = Object.entries(recipe.materials).map(([m, q]) => `${m}×${q}`).join(', ');
        const typeLabel = recipe.type === 'tool' ? ' [Tool]' : recipe.type === 'equipment' ? ' [Equip]' : '';
        info.innerHTML = `<span class="craft-name">${recipe.label}${typeLabel}</span><span class="craft-mats">${matList}</span>`;
        if (recipe.alreadyOwned) {
          btn.textContent = 'Owned';
          btn.disabled = true;
        } else {
          btn.textContent = `Craft (${recipe.craftTime.toFixed(1)}s)`;
          btn.disabled = !recipe.canCraft || this.crafting.isCrafting;
          btn.addEventListener('click', () => {
            this.crafting.startCraft(recipe.id);
            this._refreshCrafting();
          });
        }
      }

      row.appendChild(info);
      row.appendChild(btn);
      el.appendChild(row);
    }

    // Progress bar
    if (this.crafting.isCrafting) {
      const wrap = document.createElement('div');
      wrap.id = 'craft-progress-wrap';
      wrap.style.cssText = 'margin-top:8px;padding:6px 0;';

      const label = document.createElement('div');
      label.id = 'craft-progress-label';
      label.style.cssText = 'font-size:0.7rem;color:#00ffcc;text-align:center;margin-bottom:4px;';
      const remaining = Math.max(0, this.crafting.craftDuration - this.crafting.craftProgress).toFixed(1);
      label.textContent = `Crafting ${this.crafting.craftingRecipeName}... ${remaining}s`;
      wrap.appendChild(label);

      const track = document.createElement('div');
      track.style.cssText = 'background:#0a1a12;border:1px solid #00ffcc44;border-radius:3px;height:8px;overflow:hidden;';
      const fill = document.createElement('div');
      fill.id = 'craft-progress-fill';
      const pct = this.crafting.craftDuration > 0
        ? Math.min(100, (this.crafting.craftProgress / this.crafting.craftDuration) * 100)
        : 0;
      fill.style.cssText = `background:#00ffcc;height:100%;width:${pct}%;transition:width 0.1s linear;`;
      track.appendChild(fill);
      wrap.appendChild(track);
      el.appendChild(wrap);
    }
  }

  // Live-update the craft progress bar without full re-render
  _updateCraftProgressBar(prog, dur) {
    const fill = document.getElementById('craft-progress-fill');
    const label = document.getElementById('craft-progress-label');
    if (!fill || !label) return;
    const pct = dur > 0 ? Math.min(100, (prog / dur) * 100) : 0;
    fill.style.width = pct + '%';
    const remaining = Math.max(0, dur - prog).toFixed(1);
    label.textContent = `Crafting ${this.crafting.craftingRecipeName}... ${remaining}s`;
  }

  // Called by main.js when crafting completes
  onCraftingComplete() {
    const panel = document.getElementById('crafting-panel');
    if (panel && !panel.hidden) {
      this._refreshCrafting();
    }
  }

  // ── Drone Panel ────────────────────────────────────────────────────────────
  _refreshDrones() {
    const el = document.getElementById('drone-contents');
    if (!el) return;
    el.innerHTML = '';

    const drones = this.drones.getDroneStatus();
    const materials = ['copper', 'timber', 'stone', 'iron', 'fiber', 'quartz', 'silica', 'carbon', 'gold'];

    for (const drone of drones) {
      const card = document.createElement('div');
      card.className = 'drone-card';

      const header = document.createElement('div');
      header.className = 'drone-header';
      header.textContent = `${drone.name} (Eff: ${drone.efficiency})`;
      card.appendChild(header);

      // Material assignment selector
      const select = document.createElement('select');
      select.className = 'drone-select';
      const emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = '-- Idle --';
      select.appendChild(emptyOpt);
      for (const mat of materials) {
        const opt = document.createElement('option');
        opt.value = mat;
        opt.textContent = mat;
        if (drone.assignedMaterial === mat) opt.selected = true;
        select.appendChild(opt);
      }
      select.onchange = () => {
        if (select.value) {
          this.drones.assignDrone(drone.id, select.value);
        } else {
          this.drones.unassignDrone(drone.id);
        }
      };
      card.appendChild(select);

      // Upgrade button
      const upBtn = document.createElement('button');
      upBtn.className = 'stat-up-btn';
      upBtn.textContent = `Upgrade (${drone.efficiencyUpgradeCost} PP)`;
      upBtn.onclick = () => {
        this.drones.upgradeDroneEfficiency(drone.id);
        this._refreshDrones();
      };
      card.appendChild(upBtn);

      el.appendChild(card);
    }

    // Buy new drone button
    if (this.drones.canBuyDrone) {
      const buyBtn = document.createElement('button');
      buyBtn.className = 'stat-up-btn drone-buy-btn';
      buyBtn.textContent = `Buy Drone (${this.drones.nextDroneCost} PP)`;
      buyBtn.onclick = () => {
        this.drones.buyNewDrone();
        this._refreshDrones();
      };
      el.appendChild(buyBtn);
    }
  }

  // ── Pedometer / Steps Shop Panel ───────────────────────────────────────────
  _refreshPedometer() {
    const el = document.getElementById('pedometer-contents');
    if (!el) return;
    el.innerHTML = '';
    const ped = this.pedometer;
    const steps = ped.totalSteps;

    const stepInfo = document.createElement('div');
    stepInfo.className = 'panel-subtitle';
    stepInfo.textContent = `Available Steps: ${steps.toLocaleString()}`;
    el.appendChild(stepInfo);

    // Show current speed so track boost is observable
    const speedBonus = this.stats._trackBonus;
    const baseSpeed = this.stats.moveSpeed - speedBonus;
    const speedInfo = document.createElement('div');
    speedInfo.style.cssText = 'font-size:0.7rem;color:#aaccbb;margin-bottom:6px;text-align:center';
    speedInfo.textContent = speedBonus > 0
      ? `Speed: ${baseSpeed.toFixed(1)} + ${speedBonus.toFixed(1)} track boost = ${this.stats.moveSpeed.toFixed(1)}`
      : `Speed: ${this.stats.moveSpeed.toFixed(1)}`;
    el.appendChild(speedInfo);

    // ── PP Bonus per Step ──
    this._pedometerSection(el, 'PP Bonus / Step');
    const ppRow = this._pedometerShopRow(
      `+${ped.ppBonusPerStep.toFixed(2)} PP/step → +${(ped.ppBonusPerStep + 0.10).toFixed(2)}`,
      `${ped.nextBonusCost} steps`,
      steps >= ped.nextBonusCost,
      () => { ped.buyPPBonus(); this._refreshPedometer(); }
    );
    el.appendChild(ppRow);

    // ── Speed Tracks ──
    const tracksFree = ped.trackCount < 10;
    const trackCostLabel = tracksFree ? `FREE (${10 - ped.trackCount} remaining)` : `${ped.nextTrackCost} steps`;
    this._pedometerSection(el, `Speed Tracks (owned: ${ped.trackCount}${ped.pendingTracks > 0 ? `, ${ped.pendingTracks} unplaced — press T` : ''})`);
    const trackRow = this._pedometerShopRow(
      `Track #${ped.trackCount + 1} (+0.3 speed, place with T)`,
      trackCostLabel,
      ped.canBuyTrack(),
      () => { ped.buyTrack(); this._refreshPedometer(); }
    );
    el.appendChild(trackRow);

    // ── Stat Levels ──
    this._pedometerSection(el, `Stat Level (cost: ${ped.nextStatCost} steps)`);
    const statNames = this.stats.statNames;
    const statLabels = this.stats.statLabels;
    const canAfford = steps >= ped.nextStatCost;
    for (const name of statNames) {
      const row = this._pedometerShopRow(
        `${statLabels[name]} (Lv ${this.stats.stats[name].level} → ${this.stats.stats[name].level + 1})`,
        `${ped.nextStatCost} steps`,
        canAfford,
        () => { ped.buyStatLevel(name, this.stats); this._refreshPedometer(); }
      );
      el.appendChild(row);
    }

    // ── Environment Unlocks ──
    this._pedometerSection(el, 'Environment Unlocks');
    const envOptions = ped.getEnvUnlockOptions();
    const envLabels = { verdantMaw: 'Verdant Maw', lagoonCoast: 'Lagoon Coast', frozenTundra: 'Frozen Tundra' };
    for (const { zone, cost, unlocked } of envOptions) {
      const row = this._pedometerShopRow(
        `${envLabels[zone] || zone}`,
        unlocked ? 'UNLOCKED' : `${cost.toLocaleString()} steps`,
        !unlocked && steps >= cost,
        () => { ped.unlockZone(zone); this._refreshPedometer(); }
      );
      if (unlocked) row.querySelector('button').textContent = 'Owned';
      el.appendChild(row);
    }
  }

  _pedometerSection(el, title) {
    const h = document.createElement('div');
    h.className = 'panel-subtitle';
    h.style.marginTop = '8px';
    h.textContent = title;
    el.appendChild(h);
  }

  _pedometerShopRow(label, costLabel, canAfford, onBuy) {
    const row = document.createElement('div');
    row.className = 'craft-row';
    const info = document.createElement('div');
    info.className = 'craft-info';
    info.innerHTML = `<span class="craft-name">${label}</span><span class="craft-mats">${costLabel}</span>`;
    const btn = document.createElement('button');
    btn.className = 'stat-up-btn';
    btn.textContent = 'Buy';
    btn.disabled = !canAfford;
    btn.style.touchAction = 'manipulation';
    btn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault(); // cancels the subsequent click on any rebuilt DOM node
      if (btn.disabled) return;
      onBuy();
    });
    row.appendChild(info);
    row.appendChild(btn);
    return row;
  }

  // ── Equipment Panel ────────────────────────────────────────────────────────
  _refreshEquipment() {
    const el = document.getElementById('equipment-contents');
    if (!el) return;
    el.innerHTML = '';

    const slots = this.equipment.getEquippedList();
    for (const { slot, item } of slots) {
      const row = document.createElement('div');
      row.className = 'equip-row';
      const slotLabel = slot.charAt(0).toUpperCase() + slot.slice(1);
      if (item) {
        row.innerHTML = `<span class="equip-slot">${slotLabel}:</span> <span class="equip-item tier-${item.tier?.toLowerCase()}">${item.label}</span>`;
      } else {
        row.innerHTML = `<span class="equip-slot">${slotLabel}:</span> <span class="equip-empty">Empty</span>`;
      }
      el.appendChild(row);
    }
  }

  // ── Gather progress ────────────────────────────────────────────────────────
  showGatherProgress(progress, total) {
    if (this.gatherBar) {
      this.gatherBar.hidden = false;
      const pct = Math.min(100, (progress / total) * 100);
      this.gatherFill.style.width = pct + '%';
      this.gatherText.textContent = `Gathering... ${pct.toFixed(0)}%`;
    }
  }

  hideGatherProgress() {
    if (this.gatherBar) this.gatherBar.hidden = true;
  }

  showInteractHint(text) {
    if (this.interactHint) {
      this.interactHint.hidden = false;
      this.interactHint.textContent = text;
    }
  }

  hideInteractHint() {
    if (this.interactHint) this.interactHint.hidden = true;
  }

  setZoneLabel(name) {
    if (this.zoneLabel) this.zoneLabel.textContent = name;
  }

  // ── Frame update ───────────────────────────────────────────────────────────
  update(now) {
    if (now - this._lastUpdate < this._throttleMs) return;
    this._lastUpdate = now;

    const pp = this.pp.displayTotal;
    const rate = this.pp.ppRate.toFixed(1);
    this.ppDisplay.childNodes[0].nodeValue = `PP: ${pp.toLocaleString()} `;
    this.ppRate.textContent = `(+${rate}/s)`;

    // Update prestige bonus display if visible
    const prestigeEl = document.getElementById('prestige-display');
    if (prestigeEl) prestigeEl.textContent = `+${this.pp.prestigeBonus.toFixed(3)} PP/s`;

    this.hpDisplay.textContent = `HP: ${Math.ceil(this.stats.currentHP)} / ${this.stats.maxHP}`;
    this.stepsDisplay.textContent = `Steps: ${this.pedometer.totalSteps.toLocaleString()}`;

    // Refresh stat levels
    const rows = this.statList.querySelectorAll('.stat-row');
    rows.forEach(row => {
      const name = row.dataset.stat;
      const lvlEl = row.querySelector('.stat-level');
      const btn = row.querySelector('.stat-up-btn');
      lvlEl.textContent = `Lv ${this.stats.stats[name].level}`;
      const cost = this.stats.upgradeCost(name);
      btn.textContent = `+${cost}`;
      btn.disabled = this.pp.ppTotal < cost;
    });

    // Refresh open panels periodically
    const invPanel = document.getElementById('inventory-panel');
    if (invPanel && !invPanel.hidden) this._refreshInventory();

    const dronePanel = document.getElementById('drone-panel');
    if (dronePanel && !dronePanel.hidden) {
      const droneContents = document.getElementById('drone-contents');
      if (!droneContents || !droneContents.contains(document.activeElement)) {
        this._refreshDrones();
      }
    }

    const pedPanel = document.getElementById('pedometer-panel');
    if (pedPanel && !pedPanel.hidden) this._refreshPedometer();
  }
}
