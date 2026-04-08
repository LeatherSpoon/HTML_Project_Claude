export class HUD {
  constructor(statsSystem, ppSystem, pedometerSystem) {
    this.stats = statsSystem;
    this.pp = ppSystem;
    this.pedometer = pedometerSystem;

    this.ppDisplay = document.getElementById('pp-display');
    this.ppRate = document.getElementById('pp-rate');
    this.hpDisplay = document.getElementById('hp-display');
    this.stepsDisplay = document.getElementById('steps-display');
    this.statList = document.getElementById('stat-list');
    this.offloadBtn = document.getElementById('offload-btn');

    this._lastUpdate = 0;
    this._throttleMs = 100;

    this._buildStatList();
    this._wireOffload();
  }

  _buildStatList() {
    this.statList.innerHTML = '';
    for (const name of this.stats.statNames) {
      const label = this.stats.statLabels[name];
      const cost = this.stats.upgradeCost(name);

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
      btn.textContent = `+${cost}`;
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
    const newCost = this.stats.upgradeCost(name);
    btn.textContent = `+${newCost}`;
  }

  _wireOffload() {
    this.offloadBtn.addEventListener('click', () => {
      this.pp.offloadMode = !this.pp.offloadMode;
      this.offloadBtn.textContent = this.pp.offloadMode ? 'ON' : 'OFF';
      this.offloadBtn.classList.toggle('offload-on', this.pp.offloadMode);
    });
  }

  update(now) {
    if (now - this._lastUpdate < this._throttleMs) return;
    this._lastUpdate = now;

    const pp = this.pp.displayTotal;
    const rate = this.pp.ppRate.toFixed(1);
    this.ppDisplay.childNodes[0].nodeValue = `PP: ${pp.toLocaleString()} `;
    this.ppRate.textContent = `(+${rate}/s)`;

    this.hpDisplay.textContent = `HP: ${Math.ceil(this.stats.currentHP)} / ${this.stats.maxHP}`;
    this.stepsDisplay.textContent = `Steps: ${this.pedometer.totalSteps.toLocaleString()}`;

    // Refresh stat levels (handle offload exp gains)
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
  }
}
