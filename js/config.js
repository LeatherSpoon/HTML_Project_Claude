// All tunable game constants in one place.

export const CONFIG = {
  // Camera
  FRUSTUM_SIZE: 22,
  CAMERA_OFFSET: { x: 12, y: 22, z: 12 },
  CAMERA_LERP: 0.08,

  // Player
  BASE_MOVE_SPEED: 3.5,
  STEP_LENGTH: 0.5,          // world units per step

  // PP System
  INITIAL_PP_RATE: 1.0,      // PP per second
  PP_PER_STEP: 0.05,

  // Stats
  STAT_UPGRADE_BASE_COST: 10,
  STAT_UPGRADE_COST_SCALE: 1.8, // cost = base * scale^(level-1)

  // Derived stat formulas
  MAX_HP_PER_LEVEL: 10,      // maxHP = health.level * 10
  BASE_MAX_FP: 100,
  FP_PER_FOCUS_LEVEL: 50,    // maxFP = 100 + focus.level * 50
  BASE_FP_RATE: 5,           // FP per second
  FP_RATE_PER_LEVEL: 2,      // fpRate = 5 + focusRate.level * 2
  BASE_DAMAGE: 2,            // damage = strength.level * 2

  // Combat
  FP_TICK_MS: 100,           // FP accumulation interval
  ENEMY_ATTACK_MS: 2000,     // Scrapper attacks every 2s
  SCRAPPER_DAMAGE: 4,        // base damage from Scrapper
  SCRAPPER_AGGRO_RADIUS: 4.5,
  SCRAPPER_HP: 40,
  SCRAPPER_PP_REWARD: 15,
  RUN_BASE_CHANCE: 0.5,

  // FP costs and damage multipliers
  SKILLS: {
    jab:            { fp: 20,  mult: 2, label: 'Jab' },
    heavyHit:       { fp: 100, mult: 4, label: 'Heavy Hit' },
    kineticDriver:  { fp: 200, mult: 5, label: 'Kinetic Driver' },
    ballisticLunge: { fp: 300, mult: 6, label: 'Ballistic Lunge' },
    ionBeam:        { fp: 500, mult: 7, label: 'Ion Beam' },
    scan:           { fp: 100, mult: 0, label: 'Scan' },
  },

  // Environment
  GROUND_SIZE: 80,
  LANDING_PAD_RADIUS: 2.5,
  TREE_COUNT: 18,
  FOREST_RADIUS: 14,
  MOUNTAIN_POS: { x: -18, z: -18 },

  // Enemy patrol
  SCRAPPER_PATROL_RADIUS: 6,
  SCRAPPER_PATROL_WAIT: [1000, 3000], // ms range

  // Pedometer shop
  PEDOMETER_PP_BONUS_BASE_COST: 50,   // steps cost
  PEDOMETER_PP_BONUS_AMOUNT: 0.05,    // PP/step increase per purchase
};
