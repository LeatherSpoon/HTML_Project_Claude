/**
 * TouchInput — virtual joystick + action button for mobile play.
 *
 * The joystick zone (#joystick-zone) tracks any touch starting within it.
 * Moving the finger translates to a normalized dx/dz vector (clamped to radius).
 * Screen X  → world X   (left–right)
 * Screen Y↓ → world Z+  (matches ArrowDown / S key)
 *
 * #btn-mobile-action sets actionPressed while a finger is on it.
 */
export class TouchInput {
  constructor() {
    this.dx = 0;
    this.dz = 0;
    this.actionPressed = false;

    this._active = false;
    this._touchId = null;
    this._originX = 0;
    this._originY = 0;
    this._maxRadius = 52; // pixels

    this._stick = document.getElementById('joystick-stick');
    this._zone  = document.getElementById('joystick-zone');
    this._actionBtn = document.getElementById('btn-mobile-action');

    if (this._zone)      this._initJoystick();
    if (this._actionBtn) this._initAction();
  }

  // ── Joystick ───────────────────────────────────────────────────────────────

  _initJoystick() {
    const z = this._zone;

    z.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this._active) return;
      const t = e.changedTouches[0];
      this._active  = true;
      this._touchId = t.identifier;
      const r = z.getBoundingClientRect();
      this._originX = r.left + r.width  / 2;
      this._originY = r.top  + r.height / 2;
      this._move(t.clientX, t.clientY);
    }, { passive: false });

    z.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === this._touchId) this._move(t.clientX, t.clientY);
      }
    }, { passive: false });

    const release = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._touchId) {
          this._active  = false;
          this._touchId = null;
          this.dx = 0;
          this.dz = 0;
          this._setStick(0, 0);
        }
      }
    };
    z.addEventListener('touchend',    release, { passive: false });
    z.addEventListener('touchcancel', release, { passive: false });
  }

  _move(cx, cy) {
    const rawX = cx - this._originX;
    const rawY = cy - this._originY;
    const dist  = Math.sqrt(rawX * rawX + rawY * rawY);
    const clamp = Math.min(dist, this._maxRadius);
    const angle = Math.atan2(rawY, rawX);
    const nx = Math.cos(angle);
    const ny = Math.sin(angle);

    this.dx = nx * (clamp / this._maxRadius);
    this.dz = ny * (clamp / this._maxRadius); // screen-down → world +Z
    this._setStick(nx * clamp, ny * clamp);
  }

  _setStick(ox, oy) {
    if (this._stick) {
      this._stick.style.transform =
        `translate(calc(-50% + ${ox}px), calc(-50% + ${oy}px))`;
    }
  }

  // ── Action button ──────────────────────────────────────────────────────────

  _initAction() {
    const btn = this._actionBtn;
    btn.addEventListener('touchstart',  (e) => { e.preventDefault(); this.actionPressed = true;  }, { passive: false });
    btn.addEventListener('touchend',    ()  => { this.actionPressed = false; });
    btn.addEventListener('touchcancel', ()  => { this.actionPressed = false; });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** True when joystick is pushed past the dead-zone. */
  get isMoving() {
    return Math.abs(this.dx) > 0.08 || Math.abs(this.dz) > 0.08;
  }

  /** Whether a touch / coarse pointer device is in use. */
  static get isMobile() {
    return window.matchMedia('(pointer: coarse)').matches;
  }
}
