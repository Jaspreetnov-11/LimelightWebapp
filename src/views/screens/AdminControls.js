'use client';
// Settings -> Admin controls: everyone's access / shift / salary / password, work rules
// (shift timings, grace, overtime, hours per day, week off, default password, extra admins),
// attendance corrections for any person and day, and the danger zone.
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/controllers/AuthController';
import { useData } from '@/controllers/DataController';
import { useUi } from '@/controllers/UiController';
import { useModals } from '@/controllers/useModals';
import { ActivityModel, AttendanceModel, EmployeeModel, SettingsModel } from '@/models';
import { Avatar, Chip, Empty, Pills, Sq } from '@/views/ui';
import { ACCESS_LABEL, ATT, fmtD, inr, todayISO } from '@/lib/format';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const inp = { height: 36, fontSize: 12.5, borderRadius: 10, padding: '0 10px', width: '100%' };

function StaffAccess() {
  const d = useData();
  const { me } = useAuth();
  const { toast, confirm } = useUi();
  const modals = useModals();
  const [busy, setBusy] = useState('');
  const shifts = d.settings && d.settings.shifts ? Object.entries(d.settings.shifts) : [['day', { display: 'Day' }], ['evening', { display: 'Evening' }]];

  const save = async (e, patch, label) => {
    if (patch.access && e.id === me.id && patch.access !== 'admin') { toast('You cannot remove your own admin access.'); return; }
    setBusy(e.id);
    try { await EmployeeModel.update(e.id, patch); toast((label || 'Saved') + ' · ' + e.name); await d.reload('employees'); } catch (err) { toast(err.message); }
    finally { setBusy(''); }
  };
  const resetPw = async e => {
    const pw = window.prompt('New password for ' + e.name + ' (min 6 characters):', '');
    if (pw === null) return;
    if (pw.trim().length < 6) { toast('At least 6 characters.'); return; }
    await save(e, { password: pw.trim() }, 'Password reset');
  };
  const toggleActive = async e => {
    const on = Number(e.active === undefined || e.active === null ? 1 : e.active) === 1;
    if (e.id === me.id) { toast('You cannot deactivate yourself.'); return; }
    if (on && !confirm('Deactivate ' + e.name + '? They will not be able to log in until reactivated.')) return;
    await save(e, { active: !on }, on ? 'Deactivated' : 'Activated');
  };

  return (
    <div className="panel" style={{ overflowX: 'auto' }}>
      <div className="panel-h">Access &amp; staff <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>changes save instantly</span></div>
      <table>
        <thead><tr><th>Person</th><th>Access</th><th>Shift</th><th>Salary (₹/month)</th><th>Login</th><th></th></tr></thead>
        <tbody>
          {d.employees.map(e => { const active = Number(e.active === undefined || e.active === null ? 1 : e.active) === 1; return (
            <tr key={e.id} style={{ opacity: busy === e.id ? 0.6 : active ? 1 : 0.55 }}>
              <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar e={e} /><div><b>{e.name}</b>{e.id === me.id && <Chip tone="pu" style={{ marginLeft: 6 }}>you</Chip>}<small style={{ display: 'block', color: 'var(--muted)' }}>{e.email} · {e.role || '—'} · {e.dept || '—'}</small></div></div></td>
              <td><select value={e.access || 'staff'} style={{ ...inp, width: 200 }} disabled={e.id === me.id} onChange={ev => save(e, { access: ev.target.value }, 'Access updated')}>{Object.entries(ACCESS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></td>
              <td><select value={e.shift || 'day'} style={{ ...inp, width: 190 }} onChange={ev => save(e, { shift: ev.target.value }, 'Shift updated')}>{shifts.map(([v, s]) => <option key={v} value={v}>{s.display || s.label || v}</option>)}</select></td>
              <td><input type="number" min={0} step={500} defaultValue={Number(e.salary) || 0} style={{ ...inp, width: 130 }} onBlur={ev => { const v = Math.max(0, Number(ev.target.value) || 0); if (v !== (Number(e.salary) || 0)) save(e, { salary: v }, 'Salary updated'); }} onKeyDown={ev => { if (ev.key === 'Enter') ev.currentTarget.blur(); }} /></td>
              <td><label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}><input type="checkbox" checked={active} onChange={() => toggleActive(e)} disabled={e.id === me.id} />{active ? 'Active' : 'Deactivated'}</label></td>
              <td style={{ whiteSpace: 'nowrap' }}><span style={{ display: 'inline-flex', gap: 6 }}><button className="date-btn" style={{ height: 32 }} onClick={() => resetPw(e)}>Reset password</button><Sq icon="file" label="Edit profile" onClick={() => modals.open('employee', e.id)} /></span></td>
            </tr>); })}
        </tbody>
      </table>
      {!d.employees.length && <Empty>No staff yet</Empty>}
    </div>
  );
}

function WorkRules() {
  const d = useData();
  const { toast } = useUi();
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (d.settings && !f) setF({ ...d.settings, shifts: Object.fromEntries(Object.entries(d.settings.shifts || {}).map(([k, s]) => [k, { ...s }])), extraAdminEmails: (d.settings.extraAdminEmails || []).join(', ') }); }, [d.settings, f]);
  if (!f) return <div className="panel panel-b">Loading…</div>;
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const setShift = (k, field, v) => setF(x => ({ ...x, shifts: { ...x.shifts, [k]: { ...x.shifts[k], [field]: v } } }));
  const save = async () => {
    setBusy(true);
    try {
      await SettingsModel.update({ companyName: f.companyName, shifts: f.shifts, graceMins: Number(f.graceMins), hoursPerDay: Number(f.hoursPerDay), otRate: Number(f.otRate), weekOff: f.weekOff, defaultPassword: f.defaultPassword, extraAdminEmails: f.extraAdminEmails, staffCanApplyLeave: f.staffCanApplyLeave, autoOvertime: f.autoOvertime });
      toast('Work rules saved. New clock-ins use them from now on.'); await d.reload('settings'); setF(null);
    } catch (err) { toast(err.message); } finally { setBusy(false); }
  };
  const Field = ({ label, children, help }) => <div className="field"><label>{label}</label><div className="control">{children}</div>{help && <div className="help">{help}</div>}</div>;
  return (
    <div className="panel">
      <div className="panel-h">Work rules</div>
      <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div className="grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
          <Field label="Company name"><input value={f.companyName || ''} onChange={e => set('companyName', e.target.value)} /></Field>
          <Field label="Hours per working day" help="Used for expected hours, hourly cost and payroll"><input type="number" min={1} max={16} value={f.hoursPerDay} onChange={e => set('hoursPerDay', e.target.value)} /></Field>
          <Field label="Grace time (minutes)" help="Clock-in after shift start + grace is marked Late"><input type="number" min={0} max={180} value={f.graceMins} onChange={e => set('graceMins', e.target.value)} /></Field>
          <Field label="Overtime rate (× hourly)" help="1 = same as normal hourly pay, 1.5 = time and a half"><input type="number" min={0} max={5} step={0.25} value={f.otRate} onChange={e => set('otRate', e.target.value)} /></Field>
        </div>
        <div>
          <b style={{ fontSize: 13.5 }}>Shifts</b>
          <div style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 10px' }}>Overtime starts after the “OT after” time. Times are 24-hour.</div>
          <div style={{ overflowX: 'auto' }}><table>
            <thead><tr><th>Key</th><th>Label</th><th>Start</th><th>End</th><th>OT after</th></tr></thead>
            <tbody>{Object.entries(f.shifts).map(([k, s]) => <tr key={k}><td><code>{k}</code></td><td><input value={s.label} style={{ ...inp, width: 150 }} onChange={e => setShift(k, 'label', e.target.value)} /></td><td><input type="time" value={s.start} style={{ ...inp, width: 120 }} onChange={e => setShift(k, 'start', e.target.value)} /></td><td><input type="time" value={s.end} style={{ ...inp, width: 120 }} onChange={e => setShift(k, 'end', e.target.value)} /></td><td><input type="time" value={s.otAfter} style={{ ...inp, width: 120 }} onChange={e => setShift(k, 'otAfter', e.target.value)} /></td></tr>)}</tbody>
          </table></div>
        </div>
        <div>
          <b style={{ fontSize: 13.5 }}>Weekly off</b>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>{DAYS.map((dName, i) => <label key={i} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={(f.weekOff || []).includes(i)} onChange={e => set('weekOff', e.target.checked ? [...(f.weekOff || []), i] : (f.weekOff || []).filter(x => x !== i))} />{dName}</label>)}</div>
        </div>
        <div className="grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
          <Field label="Default password for new staff" help="Used when Add staff is submitted without a password"><input value={f.defaultPassword || ''} onChange={e => set('defaultPassword', e.target.value)} /></Field>
          <Field label="Extra admin emails" help="Comma separated. These emails always get admin access."><input value={f.extraAdminEmails} onChange={e => set('extraAdminEmails', e.target.value)} placeholder="name@limelight.in, other@limelight.in" /></Field>
        </div>
        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={!!f.staffCanApplyLeave} onChange={e => set('staffCanApplyLeave', e.target.checked)} />Staff can apply for leave themselves</label>
          <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 13 }}><input type="checkbox" checked={!!f.autoOvertime} onChange={e => set('autoOvertime', e.target.checked)} />Count overtime automatically on clock-out</label>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="tb-btn" onClick={() => setF(null)} disabled={busy}>Discard</button><button className="tb-btn solid" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save work rules'}</button></div>
      </div>
    </div>
  );
}

function AttendanceFix() {
  const d = useData();
  const { toast } = useUi();
  const [emp, setEmp] = useState('');
  const [date, setDate] = useState(todayISO());
  const [rec, setRec] = useState(null);
  const [f, setF] = useState({ status: 'present', mode: 'office', clock_in: '', clock_out: '', ot_hours: 0, fine_hours: 0, note: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!emp || !date) { setRec(null); return; }
    try { const rows = await AttendanceModel.list({ date }); const r = rows.find(x => x.emp === emp) || null; setRec(r); setF({ status: r ? (r.status || (r.clock_in ? 'present' : '')) : 'present', mode: r ? r.mode || 'office' : 'office', clock_in: r ? r.clock_in || '' : '', clock_out: r ? r.clock_out || '' : '', ot_hours: r ? Number(r.ot_hours) || 0 : 0, fine_hours: r ? Number(r.fine_hours) || 0 : 0, note: r ? r.note || '' : '' }); }
    catch (err) { toast(err.message); }
  }, [emp, date, toast]);
  useEffect(() => { load(); }, [load]);

  const save = async clear => {
    if (!emp) { toast('Pick a person first.'); return; }
    setBusy(true);
    try {
      await AttendanceModel.mark(clear ? { emp, date, status: '', clock_in: '', clock_out: '', ot_hours: 0, fine_hours: 0, note: '' } : { emp, date, status: f.status, mode: f.mode, clock_in: f.clock_in, clock_out: f.clock_out, ot_hours: Number(f.ot_hours) || 0, fine_hours: Number(f.fine_hours) || 0, note: f.note });
      toast(clear ? 'Day cleared.' : 'Attendance saved for ' + fmtD(date) + '.'); await load(); await d.reload('today', 'employees', 'myStats', 'teamSummary');
    } catch (err) { toast(err.message); } finally { setBusy(false); }
  };
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  return (
    <div className="panel">
      <div className="panel-h">Attendance correction <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>edit any person's clock-in / out, status, OT or fine for any day</span></div>
      <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
          <div className="field"><label>Person</label><div className="control"><select value={emp} onChange={e => setEmp(e.target.value)}><option value="">Select staff</option>{d.employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div></div>
          <div className="field"><label>Date</label><div className="control"><input type="date" value={date} max={todayISO()} onChange={e => setDate(e.target.value)} /></div></div>
        </div>
        {emp && (
          <>
            <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>{rec ? <>Current: <b style={{ color: 'var(--text)' }}>{ATT[rec.status] ? ATT[rec.status][1] : rec.clock_in ? 'Present' : 'Not marked'}</b>{rec.clock_in ? ' · in ' + rec.clock_in : ''}{rec.clock_out ? ' · out ' + rec.clock_out : ''}{Number(rec.late) ? ' · late' : ''}{Number(rec.ot_hours) ? ' · OT ' + rec.ot_hours + 'h' : ''}</> : 'No record for this day yet.'}</div>
            <div className="grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
              <div className="field"><label>Status</label><div className="control"><select value={f.status} onChange={e => set('status', e.target.value)}>{Object.entries(ATT).map(([k, [, l]]) => <option key={k} value={k}>{l}</option>)}</select></div></div>
              <div className="field"><label>Mode</label><div className="control"><select value={f.mode} onChange={e => set('mode', e.target.value)}><option value="office">Office</option><option value="wfh">Work from home</option><option value="field">On field</option></select></div></div>
              <div className="field"><label>Clock in</label><div className="control"><input type="time" value={f.clock_in} onChange={e => set('clock_in', e.target.value)} /></div></div>
              <div className="field"><label>Clock out</label><div className="control"><input type="time" value={f.clock_out} onChange={e => set('clock_out', e.target.value)} /></div></div>
              <div className="field"><label>Overtime hours</label><div className="control"><input type="number" min={0} step={0.5} value={f.ot_hours} onChange={e => set('ot_hours', e.target.value)} /></div></div>
              <div className="field"><label>Fine hours</label><div className="control"><input type="number" min={0} step={0.5} value={f.fine_hours} onChange={e => set('fine_hours', e.target.value)} /></div></div>
              <div className="field span"><label>Note</label><div className="control"><input value={f.note} onChange={e => set('note', e.target.value)} placeholder="e.g. forgot to clock out" /></div></div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>{rec && <button className="tb-btn" onClick={() => save(true)} disabled={busy} style={{ color: 'var(--danger)' }}>Clear this day</button>}<button className="tb-btn solid" onClick={() => save(false)} disabled={busy}>{busy ? 'Saving…' : 'Save attendance'}</button></div>
          </>
        )}
      </div>
    </div>
  );
}

function DangerZone() {
  const d = useData();
  const { toast } = useUi();
  const [word, setWord] = useState('');
  const [logins, setLogins] = useState(false);
  const [busy, setBusy] = useState(false);
  const clearNotifs = async () => { try { await ActivityModel.clear(); await d.reload('activity'); toast('Notifications cleared.'); } catch (err) { toast(err.message); } };
  const reset = async () => {
    if (word !== 'RESET') { toast('Type RESET to confirm.'); return; }
    if (!window.confirm('This deletes every staff member except admins, all departments, clients, projects, tasks, attendance, leaves, payments, todos, files, holidays and notifications. Continue?')) return;
    setBusy(true);
    try { const r = await SettingsModel.resetData('RESET', logins); toast('Workspace cleared: ' + Object.entries(r).map(([k, v]) => k + ' ' + v).join(', ')); setWord(''); await d.reload(); } catch (err) { toast(err.message); } finally { setBusy(false); }
  };
  return (
    <div className="panel" style={{ borderColor: 'rgba(214,51,90,.4)' }}>
      <div className="panel-h" style={{ color: 'var(--danger)' }}>Danger zone</div>
      <div className="panel-b" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}><div><b>Clear all notifications</b><div style={{ fontSize: 12.5, color: 'var(--muted)' }}>Removes every notification and activity line.</div></div><button className="tb-btn" onClick={clearNotifs}>Clear notifications</button></div>
        <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: 0 }} />
        <div><b>Reset workspace data</b><div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>Deletes all staff except admins, and all departments, clients, projects, tasks, attendance, leaves, payments, todos, files, holidays and notifications. Cannot be undone.</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
            <input value={word} onChange={e => setWord(e.target.value)} placeholder="Type RESET" style={{ ...inp, width: 160 }} />
            <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 12.5 }}><input type="checkbox" checked={logins} onChange={e => setLogins(e.target.checked)} />Also delete their logins (Supabase)</label>
            <button className="tb-btn" style={{ background: 'var(--danger)', color: '#fff', borderColor: 'var(--danger)' }} onClick={reset} disabled={busy || word !== 'RESET'}>{busy ? 'Resetting…' : 'Reset everything'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminControls() {
  const [tab, setTab] = useState('staff');
  const d = useData();
  const totalSalary = d.employees.reduce((a, e) => a + (Number(e.salary) || 0), 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h2 className="sec-title">Admin controls <Chip tone="pu">admin only</Chip></h2>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{d.employees.length} staff · payroll {inr(totalSalary)} / month</span>
      </div>
      <Pills items={[['staff', 'Access & staff'], ['rules', 'Work rules'], ['attendance', 'Attendance fix'], ['danger', 'Danger zone']]} value={tab} onChange={setTab} />
      {tab === 'staff' && <StaffAccess />}
      {tab === 'rules' && <WorkRules />}
      {tab === 'attendance' && <AttendanceFix />}
      {tab === 'danger' && <DangerZone />}
    </div>
  );
}
