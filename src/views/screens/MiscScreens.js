'use client';
// Alerts, Notifications, Files and Settings.
import { useEffect, useState } from 'react';
import { useAuth } from '@/controllers/AuthController';
import { useData } from '@/controllers/DataController';
import { useUi } from '@/controllers/UiController';
import { useModals } from '@/controllers/useModals';
import { ActivityModel, AuthModel, FileModel } from '@/models';
import { Chip, Empty, Icon, LinkBtn, SectionTitle } from '@/views/ui';
import { fmtD, inr, pct } from '@/lib/format';

export function AlertsScreen() {
  const d = useData();
  const a = d.alerts || { overdueTasks: [], overshotProjects: [] };
  const unmarked = d.today ? d.today.summary.notMarked : 0;
  const pend = d.employees.filter(e => Number(e.pendingBal) > 0).length;
  const items = [
    ...a.overshotProjects.map(p => ({ c: 'var(--danger)', t: p.name + ' is ' + pct(Number(p.consumed_mins), Number(p.alloc)) + '% of its allocated hours', m: 'Projects', go: '/projects' })),
    ...a.overdueTasks.map(t => ({ c: 'var(--warn)', t: 'Overdue: "' + t.title + '" (' + d.taskAssigneeNames(t) + ') was due ' + fmtD(t.deadline), m: 'Tasks', go: '/tasks' })),
    ...(unmarked ? [{ c: 'var(--warn)', t: unmarked + " staff not marked for today's attendance", m: 'Attendance', go: '/attendance' }] : []),
    ...(pend ? [{ c: 'var(--info)', t: pend + ' staff have pending salary this month', m: 'Payroll', go: '/payroll' }] : [])
  ];
  return (
    <div className="content">
      <SectionTitle>Alerts</SectionTitle>
      <div className="panel panel-b list simple-list" style={{ paddingTop: 4 }}>
        {items.map((i, k) => <div className="row" key={k}><i className="dot" style={{ background: i.c }}></i><div>{i.t}<small>{i.m}</small></div><LinkBtn href={i.go} style={{ marginLeft: 'auto' }}>Open</LinkBtn></div>)}
        {!items.length && <Empty ring title="All clear">No alerts right now</Empty>}
      </div>
    </div>
  );
}

export function NotificationsScreen() {
  const d = useData();
  const { toast } = useUi();
  const markAll = async () => { try { await ActivityModel.markAllRead(); await d.reload('activity'); } catch (err) { toast(err.message); } };
  return (
    <div className="content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><SectionTitle>Notifications</SectionTitle><LinkBtn onClick={markAll}>Mark all read</LinkBtn></div>
      <div className="panel panel-b list simple-list" style={{ paddingTop: 4 }}>
        {d.activity.items.map(a => <div className="row" key={a.id} style={a.read ? undefined : { background: 'rgba(255,255,255,.04)', margin: '0 -16px', paddingLeft: 16, paddingRight: 16 }}><i className="dot" style={{ background: a.read ? '#55555E' : 'var(--accent)' }}></i><div>{a.text}<small>{a.at ? new Date(a.at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</small></div></div>)}
        {!d.activity.items.length && <Empty>No activity yet</Empty>}
      </div>
    </div>
  );
}

export function FilesScreen() {
  const d = useData();
  const { toast, confirm } = useUi();
  const modals = useModals();
  const del = async id => { if (!confirm('Remove this file?')) return; try { await FileModel.remove(id); await d.reload('files'); toast('File removed.'); } catch (err) { toast(err.message); } };
  return (
    <div className="content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><SectionTitle>Files</SectionTitle><button className="tb-btn solid" style={{ height: 34 }} onClick={() => modals.open('file')}>+ Upload file</button></div>
      <div className="panel" style={{ overflowX: 'auto' }}><table><thead><tr><th>Name</th><th>Project</th><th>Uploaded by</th><th>Size</th><th>Modified</th><th></th></tr></thead><tbody>
        {d.files.map(f => <tr key={f.id}><td><a href={FileModel.downloadUrl(f.id)} style={{ color: 'inherit' }}>{f.name}</a></td><td>{f.project_name || '—'}</td><td>{f.uploader_name || '—'}</td><td>{f.size}</td><td>{fmtD(f.date)}</td><td><button className="mini-btn" onClick={() => del(f.id)} aria-label="Delete">✕</button></td></tr>)}
      </tbody></table>{!d.files.length && <Empty>No files yet</Empty>}</div>
    </div>
  );
}

export function SettingsScreen() {
  const { me, user, isAdmin } = useAuth();
  const d = useData();
  const modals = useModals();
  const [health, setHealth] = useState(null);
  useEffect(() => { AuthModel.health().then(setHealth).catch(() => setHealth({ status: 'unreachable' })); }, []);
  const meRow = d.employees.find(e => e.id === me.id);
  return (
    <div className="content">
      <SectionTitle>Settings</SectionTitle>
      <div className="grid" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
        <div className="panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><b style={{ fontSize: 15 }}>Your account</b><Chip tone={isAdmin ? 'pu' : 'gy'}>{isAdmin ? 'Admin' : 'Staff'}</Chip></div>
          <div className="kv"><div><span>Name</span><b>{me.name}</b></div><div><span>Email</span><b>{me.email}</b></div><div><span>Designation</span><b>{me.role || '—'}</b></div><div><span>Department</span><b>{me.dept || '—'}</b></div><div><span>Employee ID</span><b>{me.empId || '—'}</b></div><div><span>Monthly salary</span><b className="money">{inr(meRow ? meRow.salary : me.salary)}</b></div><div><span>Pending this month</span><b className="money">{inr(meRow ? meRow.pendingBal : 0)}</b></div></div>
          {meRow && <div><button className="date-btn" onClick={() => modals.open('employee', meRow.id)}><Icon name="file" />Edit profile{isAdmin ? ' / password' : ''}</button></div>}
        </div>
        <div className="panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <b style={{ fontSize: 15 }}>Backend</b>
          <div className="kv"><div><span>API</span><b>{health ? (health.status === 'ok' ? 'Online · v' + health.version : 'Unreachable') : 'Checking…'}</b></div><div><span>Frontend</span><b>Next.js (View)</b></div><div><span>Backend</span><b>Express / Node.js (Model + Controller)</b></div><div><span>Signed in as</span><b>{user ? user.email : ''}</b></div></div>
          <div className="steps"><div>Staff log in with the email + password created by an admin under Staff → Add Staff.</div><div>Clock In on the dashboard saves GPS location with each punch.</div><div>Admins mark attendance, record payments and run payroll; reports export as CSV.</div></div>
        </div>
      </div>
    </div>
  );
}
