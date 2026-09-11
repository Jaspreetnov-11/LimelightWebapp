'use strict';

/**
 * Workspace settings (Settings -> Admin controls). Stored in lh_settings under the key
 * "workspace"; merged over DEFAULTS; applied to the calculations module so attendance,
 * overtime and payroll pick the new rules up immediately.
 */

const settingsModel = require('../models/settings.model');
const calc = require('../utils/calculations');
const env = require('../config/env');
const AppError = require('../utils/appError');

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const DEFAULTS = {
  companyName: 'Limelight',
  shifts: {
    day: { label: 'Day', start: '11:00', end: '19:00', otAfter: '20:00' },
    evening: { label: 'Evening', start: '14:00', end: '22:00', otAfter: '23:00' }
  },
  graceMins: 20,
  hoursPerDay: 8,
  otRate: 1,
  weekOff: [0],
  defaultPassword: env.DEFAULT_STAFF_PASSWORD || 'Limelight@123',
  extraAdminEmails: [],
  staffCanSeeTeamTasks: true,
  staffCanApplyLeave: true,
  autoOvertime: true,
  selfieOnClockIn: true,
  selfieOnClockOut: false,
  selfieRetentionDays: 30
};

let current = { ...DEFAULTS };
let loaded = false;

const to12 = hhmm => { const [h, m] = hhmm.split(':').map(Number); const ap = h >= 12 ? 'pm' : 'am'; const hh = h % 12 || 12; return m ? `${hh}:${String(m).padStart(2, '0')} ${ap}` : `${hh} ${ap}`; };
const shiftLabel = s => `${s.label} (${to12(s.start)} – ${to12(s.end)})`;

function validate(patch) {
  const out = {};
  if (patch.companyName !== undefined) out.companyName = String(patch.companyName || '').trim().slice(0, 60) || DEFAULTS.companyName;
  if (patch.shifts) {
    out.shifts = {};
    for (const [k, s] of Object.entries(patch.shifts)) {
      if (!/^[a-z]{2,20}$/.test(k)) throw new AppError('Shift key must be lowercase letters', 400);
      for (const f of ['start', 'end', 'otAfter']) if (!HHMM.test(String(s[f] || ''))) throw new AppError(`Shift "${k}": ${f} must be HH:MM (24h)`, 400);
      out.shifts[k] = { label: String(s.label || k).trim().slice(0, 30) || k, start: s.start, end: s.end, otAfter: s.otAfter };
    }
    if (!Object.keys(out.shifts).length) throw new AppError('Keep at least one shift', 400);
  }
  if (patch.graceMins !== undefined) out.graceMins = Math.min(180, Math.max(0, Number(patch.graceMins) || 0));
  if (patch.hoursPerDay !== undefined) out.hoursPerDay = Math.min(16, Math.max(1, Number(patch.hoursPerDay) || 8));
  if (patch.otRate !== undefined) out.otRate = Math.min(5, Math.max(0, Number(patch.otRate) || 0));
  if (patch.weekOff !== undefined) out.weekOff = (Array.isArray(patch.weekOff) ? patch.weekOff : []).map(Number).filter(n => n >= 0 && n <= 6);
  if (patch.defaultPassword !== undefined) { const p = String(patch.defaultPassword || '').trim(); if (p.length < 6) throw new AppError('Default password must be at least 6 characters', 400); out.defaultPassword = p; }
  if (patch.extraAdminEmails !== undefined) out.extraAdminEmails = (Array.isArray(patch.extraAdminEmails) ? patch.extraAdminEmails : String(patch.extraAdminEmails).split(',')).map(s => String(s).trim().toLowerCase()).filter(s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
  for (const b of ['staffCanSeeTeamTasks', 'staffCanApplyLeave', 'autoOvertime', 'selfieOnClockIn', 'selfieOnClockOut']) if (patch[b] !== undefined) out[b] = Boolean(patch[b]);
  if (patch.selfieRetentionDays !== undefined) out.selfieRetentionDays = Math.min(365, Math.max(1, Number(patch.selfieRetentionDays) || 30));
  return out;
}

function apply() {
  const shifts = {};
  for (const [k, s] of Object.entries(current.shifts)) shifts[k] = { ...s, label: shiftLabel(s) };
  calc.configure({ shifts, graceMins: current.graceMins, hoursPerDay: current.hoursPerDay, otRate: current.otRate, weekOff: current.weekOff });
}

const service = {
  DEFAULTS,
  async load() {
    try {
      const all = await settingsModel.getAll();
      current = { ...DEFAULTS, ...(all.workspace || {}) };
      if (all.workspace && all.workspace.shifts) current.shifts = all.workspace.shifts;
    } catch (e) { current = { ...DEFAULTS }; }
    loaded = true;
    apply();
    return current;
  },
  get() { return current; },
  isLoaded() { return loaded; },
  /** Everything a logged-in user may see (no passwords). */
  publicView() {
    const shifts = {};
    for (const [k, s] of Object.entries(current.shifts)) shifts[k] = { ...s, display: shiftLabel(s) };
    return { companyName: current.companyName, shifts, graceMins: current.graceMins, hoursPerDay: current.hoursPerDay, otRate: current.otRate, weekOff: current.weekOff, staffCanSeeTeamTasks: current.staffCanSeeTeamTasks, staffCanApplyLeave: current.staffCanApplyLeave, autoOvertime: current.autoOvertime, selfieOnClockIn: current.selfieOnClockIn, selfieOnClockOut: current.selfieOnClockOut, selfieRetentionDays: current.selfieRetentionDays };
  },
  adminView() { return { ...this.publicView(), defaultPassword: current.defaultPassword, extraAdminEmails: current.extraAdminEmails, adminEmails: env.ADMIN_EMAILS }; },
  isAdminEmail(email) { const e = String(email || '').toLowerCase(); return env.ADMIN_EMAILS.includes(e) || (current.extraAdminEmails || []).includes(e); },
  async update(patch) {
    const clean = validate(patch || {});
    current = { ...current, ...clean };
    await settingsModel.set('workspace', current);
    apply();
    return this.adminView();
  }
};

module.exports = service;
