'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/controllers/AuthController';
import { useData } from '@/controllers/DataController';
import { useUi } from '@/controllers/UiController';
import { useClock } from '@/controllers/useClock';
import { useModals } from '@/controllers/useModals';
import { TaskModel, TodoModel } from '@/models';
import { Chip, Empty, GeoLink, Icon, LinkBtn, Panel, Pills, SectionTitle } from '@/views/ui';
import { assigneeIds, fmtD, greeting, hhmm, hm, hrs1, inr, minsBetween, overdue, pct, thisMonth, workedToday } from '@/lib/format';

function TaskMini({ t, onOpen, onAccept }) {
  const { taskAssigneeNames } = useData();
  return (
    <div className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
      <Chip tone={overdue(t) ? 'pk' : 'gy'} style={{ flex: '0 0 auto' }}>{fmtD(t.deadline)}</Chip>
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 500 }}>{t.title}</div><small style={{ color: 'var(--muted)' }}>{t.project_name || 'Project'} · {taskAssigneeNames(t)}</small></div>
      {t.status === 'pipeline' && onAccept ? <button className="pill on" style={{ height: 28, fontSize: 11.5 }} onClick={() => onAccept(t.id)}>Accept</button> : <LinkBtn onClick={() => onOpen(t.id)}>Open</LinkBtn>}
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
        <div style={{ minWidth: 0 }}><b>{head}{r && Number(r.late) ? <Chip tone="or" style={{ marginLeft: 8 }}>Late</Chip> : null}</b>
          <small>
            {st === 'in' && <>Since {r.clock_in} <GeoLink lat={r.in_lat} lng={r.in_lng} addr={r.in_addr} acc={r.in_acc} /> · tap Clock Out when you leave</>}
            {st === 'done' && <>In {r.clock_in} <GeoLink lat={r.in_lat} lng={r.in_lng} addr={r.in_addr} acc={r.in_acc} /> · Out {r.clock_out} <GeoLink lat={r.out_lat} lng={r.out_lng} addr={r.out_addr} acc={r.out_acc} />{Number(r.ot_hours) ? ' · OT ' + r.ot_hours + 'h' : ''}</>}
            {st === 'off' && <>{me.name.split(' ')[0]}, your shift is {me.shift === 'evening' ? '2 pm – 10 pm' : '11 am – 7 pm'} · 20 min grace · location is saved with each punch</>}
          </small>
        </div>
      </div>
      <button className="big" onClick={clock.act} disabled={clock.busy || st === 'done'}><Icon name={st === 'in' ? 'logout' : 'login'} />{clock.busy ? 'Getting location…' : st === 'in' ? 'Clock Out' : st === 'done' ? 'Clocked out' : 'Clock In'}</button>
    </div>
  );
}

function Kpi({ label, value, sub, tone, bar }) {
  return <div className={'kpi ' + (tone || '')}><span>{label}</span><b>{value}</b>{sub && <small>{sub}</small>}{bar !== undefined && <div className="bar"><i style={{ width: Math.min(100, bar) + '%' }}></i></div>}</div>;
}

export function DashboardScreen() {
  const { me, isAdmin } = useAuth();
  const d = useData();
  const { toast } = useUi();
  const modals = useModals();
  const [pill, setPill] = useState('all');
  const [todoText, setTodoText] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 60000); return () => clearInterval(t); }, []); // live "worked today"
  const now = new Date();
  const month = thisMonth();
  const myPunch = d.today ? d.today.myPunch : null;
  const todayMins = workedToday(myPunch, now);
  void tick;

  const my = useMemo(() => d.tasks.filter(t => assigneeIds(t).includes(me.id)), [d.tasks, me.id]);
  const myOpen = my.filter(t => t.status !== 'completed');
  const filt = (arr, k) => (k === 'all' ? arr : arr.filter(t => t.status === k));
  const counts = arr => ({ all: arr.length, pipeline: filt(arr, 'pipeline').length, progress: filt(arr, 'progress').length, approval: filt(arr, 'approval').length, changes: filt(arr, 'changes').length });
  const pillItems = [['all', 'All'], ['pipeline', 'New'], ['progress', 'In progress'], ['approval', 'Awaiting approval'], ['changes', 'Changes']];

  const meRow = d.employees.find(e => e.id === me.id);
  const st = d.myStats || { present: 0, half: 0, late: 0, otHours: 0, avgWorkingMinutes: 0, totalWorkedMinutes: 0, expectedMinutesSoFar: 0, workdaysSoFar: 0 };
  const deliveredMine = my.filter(t => t.status === 'completed' && String(t.completed || '').slice(0, 7) === month);
  const onTimeMine = deliveredMine.filter(t => !t.deadline || t.completed <= t.deadline).length;
  const team = d.teamSummary;
  const deliveredAll = d.tasks.filter(t => t.status === 'completed' && String(t.completed || '').slice(0, 7) === month);
  const totalPending = d.employees.reduce((a, e) => a + (Number(e.pendingBal) || 0), 0);
  const overdueAll = d.tasks.filter(overdue);

  const projects = d.projects.filter(p => isAdmin || p.manager === me.id).slice().sort((a, b) => Number(b.consumed_mins) - Number(a.consumed_mins)).slice(0, 6);
  const todos = d.todos;

  const addTodo = async e => { e.preventDefault(); const v = todoText.trim(); if (!v) return; try { await TodoModel.create(v); setTodoText(''); await d.reload('todos'); } catch (err) { toast(err.message); } };
  const toggleTodo = async id => { try { await TodoModel.toggle(id); await d.reload('todos'); } catch (err) { toast(err.message); } };
  const delTodo = async id => { try { await TodoModel.remove(id); await d.reload('todos'); } catch (err) { toast(err.message); } };
  const openTask = () => { window.location.assign('/tasks'); };
  const accept = async id => { try { await TaskModel.setStatus(id, 'progress'); toast('Accepted. Timer started.'); await d.reload('tasks', 'activity'); } catch (err) { toast(err.message); } };
  const listOr = arr => (arr.length ? <div className="list" style={{ marginTop: 10 }}>{arr.slice(0, 6).map(t => <TaskMini key={t.id} t={t} onOpen={openTask} onAccept={accept} />)}</div> : <div className="empty" style={{ padding: '30px 10px' }}><Icon name="circle-check" size={30} style={{ color: 'var(--dim)' }} />Nothing here</div>);

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

      <SectionTitle>Your month</SectionTitle>
      <div className="kpis">
        <Kpi label="Worked today" value={hrs1(todayMins)} sub={myPunch && myPunch.clock_in ? (myPunch.clock_out ? 'in ' + myPunch.clock_in + ' · out ' + myPunch.clock_out : 'since ' + myPunch.clock_in + ' · running') : 'not clocked in yet'} tone={todayMins >= 8 * 60 ? 'ok' : ''} />
        <Kpi label="Avg working hours / day" value={hrs1(st.avgWorkingMinutes)} sub={'this month · target 8h 00m'} tone={st.avgWorkingMinutes >= 8 * 60 ? 'ok' : st.avgWorkingMinutes > 0 ? 'warn' : ''} />
        <Kpi label="Hours this month" value={hrs1(st.totalWorkedMinutes)} sub={'of ' + hrs1(st.expectedMinutesSoFar) + ' expected so far'} bar={pct(st.totalWorkedMinutes, st.expectedMinutesSoFar)} />
        <Kpi label="Days present" value={(st.present + st.half) + ' / ' + st.workdaysSoFar} sub={st.late ? st.late + ' late arrival' + (st.late > 1 ? 's' : '') : 'no late arrivals'} tone={st.late ? 'warn' : ''} />
        <Kpi label="Overtime" value={(Number(st.otHours) || 0) + 'h'} sub="paid at 1× hourly" />
        <Kpi label="Tasks delivered" value={deliveredMine.length} sub={deliveredMine.length ? onTimeMine + ' on time' : 'this month'} tone={deliveredMine.length && onTimeMine === deliveredMine.length ? 'ok' : ''} />
        <Kpi label="Your pending pay" value={inr(meRow ? meRow.pendingBal : 0)} sub={meRow && meRow.earned !== undefined ? 'earned ' + inr(meRow.earned) + ' · paid ' + inr(meRow.paid) : 'this month'} />
      </div>

      {team && (<>
        <SectionTitle>Team this month</SectionTitle>
        <div className="kpis">
          <Kpi label="Staff" value={team.staffCount} sub={team.lateCount + ' late arrivals'} tone={team.lateCount ? 'warn' : ''} />
          <Kpi label="Team avg hours / day" value={hrs1(team.avgWorkingMinutes)} sub="target 8h 00m" tone={team.avgWorkingMinutes >= 8 * 60 ? 'ok' : team.avgWorkingMinutes > 0 ? 'warn' : ''} />
          <Kpi label="Team hours" value={hrs1(team.totalWorkedMinutes)} sub={'of ' + hrs1(team.expectedMinutesSoFar) + ' expected'} bar={pct(team.totalWorkedMinutes, team.expectedMinutesSoFar)} />
          <Kpi label="Overtime hours" value={Math.round(team.otHours * 10) / 10 + 'h'} sub="across the team" />
          <Kpi label="Tasks delivered" value={deliveredAll.length} sub={overdueAll.length + ' overdue'} tone={overdueAll.length ? 'bad' : ''} />
          {isAdmin && <Kpi label="Payroll pending" value={inr(totalPending)} sub={<Link href="/payroll" className="link">Run payroll</Link>} tone={totalPending > 0 ? 'warn' : 'ok'} />}
        </div>
      </>)}

      <div className="dash-2">
        <div className="panel"><div className="panel-h">My open tasks {d.canAssign && <LinkBtn onClick={() => modals.open('task')}>+ Assign</LinkBtn>}</div><div className="panel-b"><Pills items={pillItems} value={pill} onChange={setPill} counts={counts(myOpen)} />{listOr(filt(myOpen, pill))}</div></div>
        <div className="panel">
          <div className="panel-h">My to-do list<span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>{todos.filter(t => t.done).length}/{todos.length} done</span></div>
          <form className="todo-input" onSubmit={addTodo}><button type="submit" className="plus" aria-label="Add to-do">+</button><input value={todoText} onChange={e => setTodoText(e.target.value)} placeholder="Add a to-do" maxLength={120} autoComplete="off" /></form>
          <div className="todo-list">{todos.map(t => <label className={'todo-item' + (t.done ? ' done' : '')} key={t.id}><input type="checkbox" checked={!!t.done} onChange={() => toggleTodo(t.id)} /><span>{t.text}</span><button type="button" className="x" onClick={() => delTodo(t.id)} aria-label="Remove">✕</button></label>)}</div>
          {!todos.length && <Empty ring icon="tasks" title="Nothing on your list">Add a to-do to get started</Empty>}
        </div>
      </div>

      {projects.length > 0 && (
        <Panel title={isAdmin ? 'Projects' : 'Projects you lead'} right={<LinkBtn href="/projects">All projects</LinkBtn>}>
          <div className="list">
            {projects.map(p => { const used = Number(p.consumed_mins) || 0, alloc = Number(p.alloc) || 0, c = pct(used, alloc), over = alloc > 0 && used > alloc; return (
              <div className="row" key={p.id} style={{ alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontWeight: 500 }}>{p.name} <small style={{ color: 'var(--muted)' }}>· {p.completed_task_count || 0}/{p.task_count || 0} tasks done</small></div><div className="t" style={{ height: 6, marginTop: 6 }}><div className="f" style={{ width: Math.min(100, c) + '%', background: over ? '#FF5C7A' : '#4ADE95' }}></div></div></div>
                <span style={{ fontSize: 12, color: over ? 'var(--danger)' : 'var(--muted)', whiteSpace: 'nowrap' }}>{hrs1(used)} / {hrs1(alloc)}</span>
              </div>); })}
          </div>
        </Panel>
      )}
      <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>Signed in as {me.email}. <Link href="/settings" className="link">Settings</Link></p>
    </div>
  );
}
