'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/controllers/AuthController';
import { useData } from '@/controllers/DataController';
import { useUi } from '@/controllers/UiController';
import { useClock } from '@/controllers/useClock';
import { useModals } from '@/controllers/useModals';
import { TodoModel } from '@/models';
import { Avatar, Chip, Donut, Empty, GeoLink, Icon, Legend, LinkBtn, Panel, Pills, SectionTitle, Stat, StatusBars } from '@/views/ui';
import { assigneeIds, daysUntil, fmtD, greeting, hhmm, hm, inr, minsBetween, nextOccurrence, overdue, pct, todayISO, whenLabel } from '@/lib/format';

function TaskMini({ t, onOpen }) {
  return (
    <div className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
      <Chip tone={overdue(t) ? 'pk' : 'gy'} style={{ flex: '0 0 auto' }}>{fmtD(t.deadline)}</Chip>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 500 }}>{t.title}</div><small style={{ color: 'var(--muted)' }}>{t.project_name || 'Personal / Operational'} · {t.assignee_name || '—'}</small></div>
      <LinkBtn onClick={() => onOpen(t.id)}>Open</LinkBtn>
    </div>
  );
}

function ClockCard() {
  const { me } = useAuth();
  const clock = useClock();
  const r = clock.punch;
  const st = clock.state;
  const head = st === 'in' ? 'Clocked in at ' + r.clock_in : st === 'done' ? 'Done for today · ' + hm(minsBetween(r.clock_in, r.clock_out)) + ' worked' : 'Not clocked in yet';
  return (
    <div className={'clock-card ' + st}>
      <div className="st"><span className="dot"></span>
        <div style={{ minWidth: 0 }}><b>{head}</b>
          <small>
            {st === 'in' && <>Since {r.clock_in} <GeoLink lat={r.in_lat} lng={r.in_lng} addr={r.in_addr} acc={r.in_acc} /> · tap Clock Out when you leave</>}
            {st === 'done' && <>In {r.clock_in} <GeoLink lat={r.in_lat} lng={r.in_lng} addr={r.in_addr} acc={r.in_acc} /> · Out {r.clock_out} <GeoLink lat={r.out_lat} lng={r.out_lng} addr={r.out_addr} acc={r.out_acc} /></>}
            {st === 'off' && <>{me.name.split(' ')[0]}, your location is saved with each punch</>}
          </small>
        </div>
      </div>
      <button className="big" onClick={clock.act} disabled={clock.busy || st === 'done'}><Icon name={st === 'in' ? 'logout' : 'login'} />{clock.busy ? 'Getting location…' : st === 'in' ? 'Clock Out' : st === 'done' ? 'Clocked out' : 'Clock In'}</button>
    </div>
  );
}

export function DashboardScreen() {
  const { me } = useAuth();
  const d = useData();
  const { toast } = useUi();
  const modals = useModals();
  const [pill, setPill] = useState('all');
  const [orgPill, setOrgPill] = useState('all');
  const [todoText, setTodoText] = useState('');
  const now = new Date();

  const my = useMemo(() => d.tasks.filter(t => assigneeIds(t).includes(me.id)), [d.tasks, me.id]);
  const myOpen = my.filter(t => t.status !== 'completed');
  const orgOpen = d.tasks.filter(t => t.status !== 'completed');
  const filt = (arr, k) => (k === 'all' ? arr : arr.filter(t => t.status === k));
  const counts = arr => ({ all: arr.length, pipeline: filt(arr, 'pipeline').length, progress: filt(arr, 'progress').length, approval: filt(arr, 'approval').length });
  const pillItems = [['all', 'All'], ['pipeline', 'Pipeline'], ['progress', 'In progress'], ['approval', 'Pending approval']];

  const summary = (d.today && d.today.summary) || { totalStaff: d.employees.length, present: 0, absent: 0, notMarked: d.employees.length, wfh: 0 };
  const staffToday = (d.today && d.today.staffAttendance) || [];
  const totalPending = d.employees.reduce((a, e) => a + (Number(e.pendingBal) || 0), 0);
  const meRow = d.employees.find(e => e.id === me.id);
  const bdays = d.employees.filter(e => e.dob).map(e => ({ e, d: nextOccurrence(String(e.dob).slice(5, 10)) })).filter(x => daysUntil(x.d) <= 30).sort((a, b) => a.d - b.d).slice(0, 4);
  const anniv = d.employees.filter(e => e.joined && String(e.joined).slice(0, 4) !== String(now.getFullYear())).map(e => ({ e, d: nextOccurrence(String(e.joined).slice(5, 10)) })).filter(x => daysUntil(x.d) <= 30).sort((a, b) => a.d - b.d).slice(0, 3);
  const joiners = d.employees.filter(e => e.joined && daysUntil(new Date(String(e.joined).slice(0, 10) + 'T00:00:00')) >= -30).slice(-3);
  const today = todayISO();
  const leave = d.leaves.filter(l => l.from_date <= today && l.to_date >= today);
  const wfh = staffToday.filter(a => a.mode === 'wfh');
  const hol = d.holidays.filter(h => h.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const alerts = d.alerts ? d.alerts.totalAlerts : 0;
  const healthOn = d.projects.filter(p => Number(p.alloc) > 0 && Number(p.consumed_mins) <= Number(p.alloc)).length;
  const healthOver = d.projects.filter(p => Number(p.alloc) > 0 && Number(p.consumed_mins) > Number(p.alloc)).length;
  const totalPct = pct(d.projects.reduce((x, p) => x + (Number(p.consumed_mins) || 0), 0), d.projects.reduce((x, p) => x + (Number(p.alloc) || 0), 0));
  const due = d.tasks.filter(t => t.deadline === today && t.status !== 'completed');
  const topProj = Object.entries(my.filter(t => t.project).reduce((m, t) => { m[t.project_name || t.project] = (m[t.project_name || t.project] || 0) + (Number(t.mins) || 0); return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const orgTop = d.projects.map(p => [p.name, Number(p.consumed_mins) || 0]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const todos = d.todos;

  const addTodo = async e => { e.preventDefault(); const v = todoText.trim(); if (!v) return; try { await TodoModel.create(v); setTodoText(''); await d.reload('todos'); } catch (err) { toast(err.message); } };
  const toggleTodo = async id => { try { await TodoModel.toggle(id); await d.reload('todos'); } catch (err) { toast(err.message); } };
  const delTodo = async id => { try { await TodoModel.remove(id); await d.reload('todos'); } catch (err) { toast(err.message); } };
  const openTask = id => modals.open('task', id);
  const listOr = arr => (arr.length ? <div className="list" style={{ marginTop: 10 }}>{arr.slice(0, 6).map(t => <TaskMini key={t.id} t={t} onOpen={openTask} />)}</div> : <div className="empty" style={{ padding: '36px 10px' }}><Icon name="circle-check" size={30} style={{ color: '#55555E' }} />No tasks in this category</div>);

  return (
    <div className="content">
      <div className="welcome">
        <div><div className="eyebrow">{greeting()}</div><h1>Welcome back, {me.name.split(' ')[0]}.</h1></div>
        <div className="meta">
          <div><span className="ic"><Icon name="cal" /></span><div><small>{now.toLocaleDateString('en-GB', { weekday: 'long' })}</small><span>{now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div></div>
          <div><span className="ic"><Icon name="clock" /></span><div><small>Local time</small><span>{hhmm(now)}</span></div></div>
        </div>
      </div>

      <ClockCard />

      <SectionTitle>At a glance</SectionTitle>
      <div className="glance">
        <div className="mini meetings">
          <div className="mh" style={{ borderLeft: 0 }}><span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="ic pu" style={{ width: 30, height: 30, borderRadius: 8, display: 'grid', placeItems: 'center' }}><Icon name="cal" size={14} /></span>Today</span><LinkBtn href="/attendance">Attendance</LinkBtn></div>
          <div className="mb" style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }}>
            <div className="sum" style={{ padding: '0 0 12px', gridTemplateColumns: 'repeat(4,1fr)' }}>
              <div><span>Staff</span><b>{summary.totalStaff}</b></div>
              <div><span>Present</span><b style={{ color: 'var(--ok)' }}>{summary.present + (summary.half || 0)}</b></div>
              <div><span>Absent</span><b style={{ color: 'var(--danger)' }}>{summary.absent}</b></div>
              <div><span>Pending pay</span><b className={'money' + (totalPending > 0 ? ' neg' : '')} style={{ fontSize: 16 }}>{inr(totalPending)}</b></div>
            </div>
            <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 12 }}><b style={{ color: 'var(--text)', fontWeight: 600 }}>Due today</b>{due.length ? <div className="list">{due.map(t => <TaskMini key={t.id} t={t} onOpen={openTask} />)}</div> : <div style={{ marginTop: 6 }}>Nothing due today.</div>}</div>
          </div>
        </div>
        <div className="mini pk"><div className="mh">Birthdays <LinkBtn href="/staff">View all</LinkBtn></div><div className="mb list">{bdays.length ? bdays.map(x => <div className="row" key={x.e.id}><Avatar e={x.e} />{x.e.name}<span className="r chip pk">{whenLabel(x.d)}</span></div>) : 'None in the next 30 days'}</div></div>
        <div className="mini pu"><div className="mh">Work anniversaries <LinkBtn href="/staff">View all</LinkBtn></div><div className="mb list">{anniv.length ? anniv.map(x => <div className="row" key={x.e.id}><Avatar e={x.e} />{x.e.name}<span className="r chip pu">{whenLabel(x.d)}</span></div>) : 'None soon'}</div></div>
        <div className="mini vi"><div className="mh">New joiners</div><div className="mb list">{joiners.length ? joiners.map(e => <div className="row" key={e.id}><Avatar e={e} />{e.name}<span className="r chip pu">{fmtD(e.joined)}</span></div>) : 'None recently'}</div></div>
        <div className="mini gr"><div className="mh">On leave <LinkBtn onClick={() => modals.open('leave')}>Apply</LinkBtn></div><div className="mb list">{leave.length ? leave.map(l => <div className="row" key={l.id}><Avatar e={d.empById[l.emp]} />{d.empName(l.emp)}<span className="r" style={{ fontSize: 11, color: 'var(--muted)' }}>till {fmtD(l.to_date)}</span></div>) : 'No one on leave'}</div></div>
        <div className="mini rs"><div className="mh">Working from home</div><div className="mb list">{wfh.length ? wfh.map(a => <div className="row" key={a.id}><Avatar name={a.emp_name} av={a.av} ini={a.ini} />{a.emp_name}</div>) : 'None today'}</div></div>
        <div className="mini or"><div className="mh">Holidays <span style={{ fontSize: 11, color: 'var(--muted)' }}>Upcoming</span></div><div className="mb list">{hol.length ? hol.map(h => <div className="row" key={h.id}><span className="ic or" style={{ width: 22, height: 22 }}><Icon name="cal" size={11} /></span>{h.name}<span className="r" style={{ fontSize: 11.5 }}>{fmtD(h.date)}</span></div>) : 'No upcoming holidays'}</div></div>
      </div>

      <SectionTitle>Your status</SectionTitle>
      <div className="status-row">
        <Stat icon="clock" tone="bl" value={meRow && meRow.earned !== undefined ? hm((d.today && d.today.myPunch && d.today.myPunch.clock_out) ? minsBetween(d.today.myPunch.clock_in, d.today.myPunch.clock_out) : 0) : '00h 00m'} label="Worked today" onClick={() => {}} />
        <Stat icon="cal" tone="pu" value={my.filter(overdue).length} label="Overdue tasks" />
        <Stat icon="file" tone="gr" value={inr(meRow ? meRow.pendingBal : 0)} valueClass="money" label="Your pending pay" />
        <Stat icon="flag" tone="pk" value={alerts} label="Alerts" />
        <div className="panel open"><div className="panel-h">Open tasks <LinkBtn onClick={() => modals.open('task')}>+ Add</LinkBtn></div><div className="panel-b"><Pills items={pillItems} value={pill} onChange={setPill} counts={counts(myOpen)} />{listOr(filt(myOpen, pill))}</div></div>
        <Panel title="Attendance today" style={{ gridColumn: 'span 2' }} bodyStyle={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <Donut parts={[['#4ADE95', summary.present + (summary.half || 0)], ['#FF5C7A', summary.absent], ['#2A2A30', summary.notMarked]]} center={(summary.present + (summary.half || 0)) + '|Present'} />
          <Legend style={{ width: '100%', justifyContent: 'space-between' }} items={[['#4ADE95', 'Present ', summary.present + (summary.half || 0)], ['#FF5C7A', 'Absent ', summary.absent], ['#2A2A30', 'Not marked ', summary.notMarked]]} />
        </Panel>
        <Panel title="Task Status" right={<Chip tone="gr">{my.length} total</Chip>}><StatusBars tasks={my} /></Panel>
        <Panel title="Your Top Worked Projects">{topProj.length ? <div className="list">{topProj.map(([p, m]) => <div className="row" key={p}><span style={{ flex: 1 }}>{p}</span><b>{hm(m)}</b></div>)}</div> : <Empty icon="folder">No projects logged yet</Empty>}</Panel>
      </div>

      <SectionTitle>My To-Do List</SectionTitle>
      <div className="panel">
        <div className="panel-h" style={{ borderBottom: '1px solid var(--line)' }}><span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="ic pu" style={{ width: 30, height: 30 }}><Icon name="tasks" size={14} /></span>My To-Do List</span><span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>{todos.filter(t => t.done).length}/{todos.length} done</span></div>
        <form className="todo-input" onSubmit={addTodo}><button type="submit" className="plus" aria-label="Add to-do">+</button><input value={todoText} onChange={e => setTodoText(e.target.value)} placeholder="Add a to-do" maxLength={120} autoComplete="off" /></form>
        <div className="todo-list">{todos.map(t => <label className={'todo-item' + (t.done ? ' done' : '')} key={t.id}><input type="checkbox" checked={!!t.done} onChange={() => toggleTodo(t.id)} /><span>{t.text}</span><button type="button" className="x" onClick={() => delTodo(t.id)} aria-label="Remove">✕</button></label>)}</div>
        {!todos.length && <Empty ring icon="tasks" title="Nothing on your list">Add a to-do to get started</Empty>}
      </div>

      <SectionTitle>Project overview</SectionTitle>
      <div className="proj-over">
        <div className="panel" style={{ padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}><b style={{ fontSize: 13.5 }}>Project Health</b><Donut parts={[['#4ADE95', healthOn], ['#FF5C7A', healthOver]]} center={totalPct + '%|' + (totalPct > 100 ? 'Bad' : totalPct > 0 ? 'Good' : '—')} size={100} /><div className="legend" style={{ width: '100%', flexDirection: 'column', gap: 6 }}><span style={{ display: 'flex', justifyContent: 'space-between' }}><span><i style={{ background: '#4ADE95' }}></i>On Track</span><b>{healthOn}</b></span><span style={{ display: 'flex', justifyContent: 'space-between' }}><span><i style={{ background: '#FF5C7A' }}></i>Overshoot</span><b>{healthOver}</b></span></div></div>
        <Panel title="Task Status" right={<Chip tone="gr">{d.tasks.length} total</Chip>}><StatusBars tasks={d.tasks} /></Panel>
        <Panel title="Top Worked Projects">{orgTop.length ? <div className="list">{orgTop.map(([n, m]) => <div className="row" key={n}><span style={{ flex: 1 }}>{n}</span><b>{hm(m)}</b></div>)}</div> : <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>No data yet.</div>}</Panel>
        <Panel title="Open tasks (org)"><Pills items={pillItems} value={orgPill} onChange={setOrgPill} counts={counts(orgOpen)} />{listOr(filt(orgOpen, orgPill))}</Panel>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>Signed in as {me.email}. <Link href="/settings" className="link">Settings</Link></p>
    </div>
  );
}
