'use client';
// Notifications (with alerts), Files and Settings.
import { useEffect, useState } from 'react';
import { useAuth } from '@/controllers/AuthController';
import { useData } from '@/controllers/DataController';
import { useUi } from '@/controllers/UiController';
import { useModals } from '@/controllers/useModals';
import { ActivityModel, AuthModel, FileModel } from '@/models';
import { Chip, Empty, Icon, LinkBtn, SectionTitle, Seg } from '@/views/ui';
import { THEMES, useTheme } from '@/controllers/useTheme';
import { Pager, usePager } from '@/views/ui/Pager';
import { fmtD, inr, pct, SHIFTS } from '@/lib/format';

/** One screen for everything that needs attention plus the activity feed. */
export function NotificationsScreen() {
  const d = useData();
  const { toast } = useUi();
  const a = d.alerts || { overdueTasks: [], overshotProjects: [] };
  const alerts = [
    ...a.overshotProjects.map(p => ({ c: 'var(--danger)', t: p.name + ' is at ' + pct(Number(p.consumed_mins), Number(p.alloc)) + '% of its allocated hours', m: 'Project overrun', go: '/projects' })),
    ...a.overdueTasks.map(t => ({ c: 'var(--warn)', t: '"' + t.title + '" (' + d.taskAssigneeNames(t) + ') was due ' + fmtD(t.deadline), m: 'Overdue task', go: '/tasks' }))
  ];
  const markAll = async () => { try { await ActivityModel.markAllRead(); await d.reload('activity'); } catch (err) { toast(err.message); } };
  const pager = usePager(d.activity.items, 20);
  const when = at => (at ? new Date(at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
  return (
    <div className="content">
      {alerts.length > 0 && (<>
        <SectionTitle>Needs attention <Chip tone="pk">{alerts.length}</Chip></SectionTitle>
        <div className="panel panel-b list simple-list notif-alert" style={{ paddingTop: 4 }}>
          {alerts.map((i, k) => <div className="row" key={k}><i className="dot" style={{ background: i.c }}></i><div>{i.t}<small>{i.m}</small></div><LinkBtn href={i.go} style={{ marginLeft: 'auto' }}>Open</LinkBtn></div>)}
        </div>
      </>)}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><SectionTitle>Notifications {d.activity.unread > 0 && <Chip tone="pu">{d.activity.unread} new</Chip>}</SectionTitle>{d.activity.unread > 0 && <LinkBtn onClick={markAll}>Mark all read</LinkBtn>}</div>
      <div className="panel panel-b list simple-list" style={{ paddingTop: 4 }}>
        {pager.items.map(x => <div className="row" key={x.id} style={x.read ? undefined : { background: 'rgba(255,255,255,.04)', margin: '0 -16px', paddingLeft: 16, paddingRight: 16 }}><i className="dot" style={{ background: x.read ? 'var(--dim)' : x.kind === 'task' ? 'var(--accent)' : x.kind === 'project' ? 'var(--violet)' : 'var(--info)' }}></i><div>{x.text}<small>{when(x.at)}</small></div>{x.link && <LinkBtn href={x.link} style={{ marginLeft: 'auto' }}>Open</LinkBtn>}</div>)}
        {!d.activity.items.length && !alerts.length && <Empty ring title="All clear">Nothing needs your attention</Empty>}
        {!d.activity.items.length && alerts.length > 0 && <Empty>No notifications yet</Empty>}
        <Pager pager={pager} compact />
      </div>
    </div>
  );
}

export function FilesScreen() {
  const d = useData();
  const { isAdmin, me } = useAuth();
  const { toast, confirm } = useUi();
  const modals = useModals();
  const del = async id => { if (!confirm('Remove this file?')) return; try { await FileModel.remove(id); await d.reload('files'); toast('File removed.'); } catch (err) { toast(err.message); } };
  const pager = usePager(d.files, 20);
  return (
    <div className="content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><SectionTitle>Files</SectionTitle><button className="tb-btn solid" style={{ height: 34 }} onClick={() => modals.open('file')}>+ Upload file</button></div>
      <div className="panel" style={{ overflowX: 'auto' }}><table><thead><tr><th>Name</th><th>Project</th><th>Uploaded by</th><th>Size</th><th>Modified</th><th></th></tr></thead><tbody>
        {pager.items.map(f => <tr key={f.id}><td><a href={FileModel.downloadUrl(f.id)} style={{ color: 'inherit' }}>{f.name}</a></td><td>{f.project_name || '—'}</td><td>{f.uploader_name || '—'}</td><td>{f.size}</td><td>{fmtD(f.date)}</td><td>{(isAdmin || f.assigned_by === me.id) && <button className="mini-btn" onClick={() => del(f.id)} aria-label="Delete">✕</button>}</td></tr>)}
      </tbody></table>{!d.files.length && <Empty>No files yet</Empty>}<Pager pager={pager} /></div>
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
  const role = isAdmin ? 'Admin' : me.access === 'manager' ? 'Team leader' : 'Staff';
  const [theme, setTheme] = useTheme();
  return (
    <div className="content">
      <SectionTitle>Settings</SectionTitle>
      <div className="panel" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div><b style={{ fontSize: 15 }}>Appearance</b><div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>Dark keeps the yellow accent; Light is white with a graphite accent. Saved on this device.</div></div>
        <Seg items={THEMES} value={theme} onChange={setTheme} />
      </div>
      <div className="grid" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
        <div className="panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><b style={{ fontSize: 15 }}>Your account</b><Chip tone={isAdmin ? 'pu' : 'gy'}>{role}</Chip></div>
          <div className="kv"><div><span>Name</span><b>{me.name}</b></div><div><span>Email</span><b>{me.email}</b></div><div><span>Designation</span><b>{me.role || '—'}</b></div><div><span>Department</span><b>{me.dept || '—'}</b></div><div><span>Employee ID</span><b>{me.empId || '—'}</b></div><div><span>Shift</span><b>{SHIFTS[(meRow && meRow.shift) || me.shift] || SHIFTS.day}</b></div>{(isAdmin || meRow) && meRow && meRow.salary !== undefined && <div><span>Monthly salary</span><b className="money">{inr(meRow.salary)}</b></div>}{meRow && meRow.pendingBal !== undefined && <div><span>Pending this month</span><b className="money">{inr(meRow.pendingBal)}</b></div>}</div>
          {meRow && <div><button className="date-btn" onClick={() => modals.open('employee', meRow.id)}><Icon name="file" />{isAdmin ? 'Edit profile / password' : 'Change name, phone or password'}</button></div>}
        </div>
        <div className="panel" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <b style={{ fontSize: 15 }}>How it works</b>
          <div className="steps"><div>Clock in from Home. Shift 11 am–7 pm (or 2–10 pm) with 20 min grace; overtime after 8 pm (11 pm) is paid at 1× hourly.</div><div>Tasks: your team leader assigns, you accept (timer starts), submit for approval, they approve or request changes.</div><div>Admins add staff, run payroll, record payments and download reports.</div></div>
          <div className="kv"><div><span>API</span><b>{health ? (health.status === 'ok' ? 'Online · v' + health.version : 'Unreachable') : 'Checking…'}</b></div><div><span>Signed in as</span><b>{user ? user.email : ''}</b></div></div>
        </div>
      </div>
    </div>
  );
}
