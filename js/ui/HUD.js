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
    this.offloadBtn = document.getElementById('offload-btn');
    this.gatherBar = document.getElementById('gather-bar');
    this.gatherFill = document.getElementById('gather-fill');
    this.gatherText = document.getElementById('gather-text');
    this.interactHint = document.getElementById('interact-hint');
    this.zoneLabel = document.getElementById('zone-label');

    this._lastUpdate = 0;
    this._throttleMs = 100;

    this._buildStatList();
    this._wireOffload();
    this._wirePanelToggles();
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

  _wireOffload() {
    this.offloadBtn.addEventListener('click', () => {
      this.pp.offloadMode = !this.pp.offloadMode;
      this.offloadBtn.textContent = this.pp.offloadMode ? 'ON' : 'OFF';
      this.offloadBtn.classList.toggle('offload-on', this.pp.offloadMode);
    });
  }

  _wirePanelToggles() {
    // Toggle panels via buttons in HUD
    const panels = ['inventory-panel', 'crafting-panel', 'drone-panel', 'equipment-panel'];
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
    }
  }

  // ── Inventory Panel ────────────────────────────────────────────────────────
  _refreshInventory() {
    const el = document.getElementById('inventory-contents');
    if (!el) return;
    el.innerHTML = '';

    const mats = this.inventory.getMaterialList();
    const cons = this.inventory.getConsumableList();

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

    if (cons.length > 0) {
      const title = document.createElement('div');
      title.className = 'panel-subtitle';
      title.textContent = 'Consumables';
      el.appendChild(title);
      for (const c of cons) {
        const row = document.createElement('div');
        row.className = 'inv-row';
        row.textContent = `${c.label}: x${c.count}`;
        el.appendChild(row);
      }
    }

    if (mats.length === 0 && cons.length === 0) {
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
      const matList = Object.entries(recipe.materials).map(([m, q]) => `${m}x${q}`).join(', ');
      info.innerHTML = `<span class="craft-name">${recipe.label}</span><span class="craft-mats">${matList}</span>`;

      const btn = document.createElement('button');
      btn.className = 'stat-up-btn';
      btn.textContent = `Craft (${recipe.craftTime.toFixed(1)}s)`;
      btn.disabled = !recipe.canCraft || this.crafting.isCrafting;
      btn.onclick = () => {
        this.crafting.startCraft(recipe.id);
        this._refreshCrafting();
      };

      row.appendChild(info);
      row.appendChild(btn);
      el.appendChild(row);
    }

    if (this.crafting.isCrafting) {
      const prog = document.createElement('div');
      prog.className = 'craft-progress-text';
      prog.textContent = `Crafting ${this.crafting.craftingRecipeName}...`;
      el.appendChild(prog);
    }
  }

  // ── Drone Panel ────────────────────────────────────────────────────────────
  _refreshDrones() {
    const el = document.getElementById('drone-contents');
    if (!el) return;
    el.innerHTML = '';

    const drones = this.drones.getDroneStatus();
    const materials = ['copper', 'timber', 'stone', 'iron', 'fiber', 'quartz', 'silica', 'carbon'];

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
    if (dronePanel && !dronePanel.hidden) this._refreshDrones();
  }
}
