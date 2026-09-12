'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/controllers/AuthController';
import { useData } from '@/controllers/DataController';
import { useUi } from '@/controllers/UiController';
import { useModals } from '@/controllers/useModals';
import { TaskModel } from '@/models';
import { saveCsv } from '@/lib/download';
import { Avatar, Empty, Icon, LinkBtn, ReassignTaskModal, Seg, Sq, TaskChip } from '@/views/ui';
import { Assignees } from '@/views/ui/Assignees';
import { Pager, usePager } from '@/views/ui/Pager';
import { assigneeIds, fmtD, hm, isRunning, overdue, STATUSES, STATUS_LABEL, takenMins } from '@/lib/format';

const COL_CLS = { pipeline: '', progress: 'ip', approval: 'pa', completed: 'cp', changes: 'oh' };

/** Workflow buttons for a task, depending on who is looking at it. */
function useTaskActions() {
  const { me } = useAuth();
  const { isLeaderOf } = useData();
  return t => {
    const mine = assigneeIds(t).includes(me.id);
    const lead = isLeaderOf(t.project);
    const acts = [];
    if (t.status === 'pipeline' && mine) acts.push(['progress', '▶ Accept & start', 'go']);
    if (t.status === 'progress' && mine) acts.push(['approval', 'Submit for approval', 'ok']);
    if (t.status === 'changes' && mine) acts.push(['progress', '▶ Resume', 'go']);
    if (t.status === 'approval' && lead) { acts.push(['completed', '✓ Approve', 'ok']); acts.push(['changes', 'Request changes', 'warn']); }
    if (lead) STATUSES.filter(k => k !== t.status && !acts.some(a => a[0] === k)).forEach(k => acts.push([k, '→ ' + STATUS_LABEL[k], '']));
    return { acts, mine, lead };
  };
}

function Timer({ t, now }) {
  const est = Number(t.mins) || 0;
  const taken = takenMins(t, now);
  const live = isRunning(t);
  const over = est > 0 && taken > est;
  if (!t.started_at) return <div className="timer"><span>Est. <b>{hm(est)}</b></span><span style={{ color: 'var(--muted)' }}>Timer starts on accept</span></div>;
  return <div className={'timer' + (live ? ' live' : '') + (over ? ' over' : '')}><span>{live && <i className="dot"></i>}{t.status === 'completed' ? 'Took' : 'Running'} <b>{hm(taken)}</b></span><span>of est. <b>{hm(est)}</b>{over ? ' · over' : ''}</span></div>;
}

export function TasksScreen() {
  const { me } = useAuth();
  const d = useData();
  const { toast, confirm } = useUi();
  const modals = useModals();
  const actionsFor = useTaskActions();
  const [tab, setTab] = useState('me');
  const [member, setMember] = useState('');
  const [dept, setDept] = useState('');
  const [view, setView] = useState('board');
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [mStatus, setMStatus] = useState('open');
  const [now, setNow] = useState(Date.now());
  const [hl, setHl] = useState('');
  const [reassignTaskTarget, setReassignTaskTarget] = useState(null);
  // Opened from a notification (/tasks?task=ID): show everyone's tasks and highlight that card
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('task');
    if (id) { setHl(id); setTab('org'); setTimeout(() => { const el = document.querySelector('[data-task="' + id + '"]'); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 600); }
  }, []);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const apply = () => setIsMobile(mq.matches);
    apply(); mq.addEventListener('change', apply);
    const tick = setInterval(() => setNow(Date.now()), 30000); // live timers
    return () => { mq.removeEventListener('change', apply); clearInterval(tick); };
  }, []);

  const tasks = useMemo(() => {
    let list = d.tasks.slice();
    if (tab === 'me') list = list.filter(t => assigneeIds(t).includes(me.id));
    else if (tab === 'byme') list = list.filter(t => t.assigned_by === me.id);
    else if (tab === 'lead') list = list.filter(t => d.isLeaderOf(t.project) && t.project);
    else if (tab === 'team') list = list.filter(t => (t.dept || '') === me.dept);
    if (member) list = list.filter(t => assigneeIds(t).includes(member));
    if (dept) list = list.filter(t => (t.dept || '') === dept || assigneeIds(t).some(id => (d.empById[id] || {}).dept === dept));
    return list;
  }, [d, tab, member, dept, me]);
  const emps = d.employees.filter(e => !dept || e.dept === dept);
  const listPager = usePager(tasks, 20);

  const move = async (id, to) => { const t = d.tasks.find(x => x.id === id); if (!t || t.status === to) return; try { await TaskModel.setStatus(id, to); toast(to === 'progress' && t.status === 'pipeline' ? 'Accepted. Timer started.' : 'Moved to ' + STATUS_LABEL[to]); await d.reload('tasks', 'projects', 'activity', 'alerts'); } catch (err) { toast(err.message); } };
  const del = async t => { if (!confirm('Delete "' + t.title + '"?')) return; try { await TaskModel.remove(t.id); toast('Task deleted.'); await d.reload('tasks', 'projects'); } catch (err) { toast(err.message); } };
  const exportCsv = () => saveCsv('tasks.csv', [['Title', 'Project', 'Department', 'Assignee', 'Assigned', 'Deadline', 'Est. hours', 'Taken hours', 'Status']].concat(tasks.map(t => [t.title, t.project_name || d.projName(t.project), t.dept || '', d.taskAssigneeNames(t), t.assigned, t.deadline, Math.round((Number(t.mins) || 0) / 6) / 10, Math.round(takenMins(t, now) / 6) / 10, STATUS_LABEL[t.status]])));

  const tabs = [['me', 'file', 'My tasks'], ['byme', 'check', 'Assigned by me'], ...(d.canAssign ? [['lead', 'brief', 'My projects']] : []), ['team', 'users', 'My department'], ['org', 'circle-check', 'Everyone']];

  const card = t => {
    const od = overdue(t);
    const { acts, lead, mine } = actionsFor(t);
    const canReassign = (mine || lead) && t.status !== 'completed';
    return (
      <div className={'tcard' + (dragId === t.id ? ' dragging' : '') + (hl === t.id ? ' hl' : '')} data-task={t.id} key={t.id} draggable={lead} onDragStart={ev => { if (!lead) { ev.preventDefault(); return; } setDragId(t.id); ev.dataTransfer.effectAllowed = 'move'; try { ev.dataTransfer.setData('text/plain', t.id); } catch (x) { /* ignore */ } }} onDragEnd={() => { setDragId(null); setOverCol(''); }}>
        <div className="p"><span>{t.project_name || d.projName(t.project)}</span><span style={{ display: 'flex', gap: 4, alignItems: 'center' }}><i className={od ? 'r' : ''} title={od ? 'Overdue' : ''}><Icon name="flag" size={14} /></i>{canReassign && <button type="button" onClick={() => setReassignTaskTarget(t)} title="Reassign task" style={{ background: 'none', border: 0, color: 'var(--muted)', cursor: 'pointer', fontSize: 13, padding: '2px 4px' }}>⇄</button>}{lead && <><button onClick={() => modals.open('task', t.id)} aria-label="Edit"><Icon name="file" /></button><button onClick={() => del(t)} aria-label="Delete">✕</button></>}</span></div>
        <small>{t.type || 'Other'}{t.dept ? ' · ' + t.dept : ''}</small>
        <div>{t.title}</div>
        <div className="dates"><div><small>Assigned</small>{fmtD(t.assigned)}</div><div className={t.status === 'completed' ? 'ok' : ''} style={od ? { borderColor: 'rgba(255,92,122,.5)' } : undefined}><small>{t.status === 'completed' ? 'Completed' : 'Deadline'}</small>{fmtD(t.status === 'completed' ? (t.completed || t.deadline) : t.deadline)}</div></div>
        <Timer t={t} now={now} />
        <Assignees task={t} />
        {(acts.length > 0 || canReassign) && (
          <div className="move">
            {acts.map(([k, l, cls]) => <button key={k} className={cls} onClick={() => move(t.id, k)}>{l}</button>)}
            {canReassign && <button type="button" className="pill" onClick={() => setReassignTaskTarget(t)} style={{ fontSize: 11, padding: '3px 8px' }}>⇄ Reassign</button>}
          </div>
        )}
      </div>
    );
  };

  // ---- Mobile: a simple list with workflow buttons (the kanban board is desktop-only) ----
  if (isMobile) {
    const mList = tasks.filter(t => mStatus === 'all' ? true : mStatus === 'open' ? t.status !== 'completed' : t.status === mStatus);
    const mCounts = { open: tasks.filter(t => t.status !== 'completed').length, all: tasks.length };
    STATUSES.forEach(k => { mCounts[k] = tasks.filter(t => t.status === k).length; });
    return (
      <div className="content mtasks">
        <div className="mtasks-head">
          <div className="tabs" style={{ overflowX: 'auto', border: 0, padding: 0 }}>{[['me', 'Mine'], ['byme', 'By me'], ['team', 'Dept'], ['org', 'All']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <Link href="/self-task" className="tb-btn" style={{ height: 36, padding: '0 10px', fontSize: 12 }}>+ Self Task</Link>
            {d.canAssign && <button className="tb-btn solid" style={{ height: 36 }} onClick={() => modals.open('task')}>+ Task</button>}
          </div>
        </div>
        <div className="pill-tabs" style={{ overflowX: 'auto', flexWrap: 'nowrap' }}>
          {[['open', 'Open'], ...STATUSES.map(k => [k, STATUS_LABEL[k]]), ['all', 'All']].map(([k, l]) => <button key={k} className={'pill' + (mStatus === k ? ' on' : '')} style={{ flex: '0 0 auto' }} onClick={() => setMStatus(k)}>{l} <span className="n">{mCounts[k]}</span></button>)}
        </div>
        <div className="mtask-list">
          {mList.map(t => { const od = overdue(t); const { acts, lead } = actionsFor(t); return (
            <div className={'mtask' + (t.status === 'completed' ? ' done' : od ? ' late' : '') + (hl === t.id ? ' hl' : '')} data-task={t.id} key={t.id}>
              <div className="mtask-top"><span className="mtask-proj">{t.project_name || d.projName(t.project)}</span><span className={'chip ' + (od ? 'pk' : t.status === 'completed' ? 'gr' : 'gy')}>{t.status === 'completed' ? 'Done ' + fmtD(t.completed || t.deadline) : 'Due ' + fmtD(t.deadline)}</span></div>
              <div className="mtask-title">{t.title}</div>
              <div className="mtask-row"><Assignees task={t} /><TaskChip status={t.status} /></div>
              <div className="tcard" style={{ padding: 0, border: 0, background: 'none' }}><Timer t={t} now={now} /></div>
              <div className="mtask-actions" style={{ flexWrap: 'wrap', gap: 6 }}>
                {acts.slice(0, 2).map(([k, l, cls]) => <button key={k} className={cls === 'go' || cls === 'ok' ? 'mtask-done' : 'pill'} onClick={() => move(t.id, k)}>{l}</button>)}
                {(actionsFor(t).mine || actionsFor(t).lead) && t.status !== 'completed' && <button className="pill" onClick={() => setReassignTaskTarget(t)}>⇄ Reassign</button>}
                {lead && <button className="mini-btn" onClick={() => modals.open('task', t.id)} aria-label="Edit"><Icon name="file" /></button>}
                {lead && <button className="mini-btn" onClick={() => del(t)} aria-label="Delete">✕</button>}
              </div>
            </div>); })}
          {!mList.length && <Empty>No tasks here</Empty>}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="task-top">
        <div className="tabs">{tabs.map(([k, ic, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><Icon name={ic} size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{l}</button>)}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <Seg items={[['board', '▦ Board'], ['list', '☰ List']]} value={view} onChange={setView} />
          <Sq icon="down" label="Export CSV" onClick={exportCsv} style={{ border: 0 }} />
          <Link href="/self-task" className="tb-btn" style={{ height: 34, padding: '0 12px', fontSize: 12.5 }} title="Create a self-assigned task">+ Self Task</Link>
          {d.canAssign && <button className="tb-btn solid" style={{ height: 34 }} onClick={() => modals.open('task')}>+ Assign task</button>}
        </div>
      </div>
      <div className="board-wrap">
        <div className="members">
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>People</div>
          <select value={dept} onChange={e => { setDept(e.target.value); setMember(''); }} style={{ height: 36, fontSize: 12.5, marginBottom: 8 }}><option value="">All departments</option>{d.departments.map(x => <option key={x.id} value={x.name}>{x.name}</option>)}</select>
          <div className={'mem' + (!member ? ' on' : '')} onClick={() => setMember('')}><span className="avatar sm" style={{ background: '#FFD21F' }}><Icon name="users" size={12} style={{ color: '#0A0A0B' }} /></span>Everyone</div>
          {emps.map(e => <div className={'mem' + (member === e.id ? ' on' : '')} key={e.id} onClick={() => setMember(e.id)}><Avatar e={e} /><div>{e.name}<small>{e.role || ''}</small></div></div>)}
        </div>
        {view === 'board' ? (
          <div className="board">
            {STATUSES.map(k => { const ts = tasks.filter(t => t.status === k); return (
              <div className={'col ' + COL_CLS[k] + (overCol === k ? ' over' : '')} key={k} onDragOver={ev => { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; setOverCol(k); }} onDragLeave={() => setOverCol('')} onDrop={ev => { ev.preventDefault(); const id = dragId || ev.dataTransfer.getData('text/plain'); setOverCol(''); setDragId(null); if (id) move(id, k); }}>
                <div className="col-h">{STATUS_LABEL[k]}<span>{ts.length}</span></div>
                {ts.map(card)}
                {!ts.length && <div className="empty" style={{ padding: '24px 0', fontSize: 12 }}>{k === 'pipeline' ? 'No new tasks' : k === 'changes' ? 'No changes requested' : 'Nothing here'}</div>}
              </div>); })}
          </div>
        ) : (
          <div className="content"><div className="panel">
            <div className="task-row head"><span>Task</span><span>Project</span><span>Assignee</span><span>Assigned</span><span>Deadline</span><span>Est / Taken</span><span>Status</span><span>Action</span></div>
            {listPager.items.map(t => {
              const { lead, mine } = actionsFor(t);
              const canReassign = (mine || lead) && t.status !== 'completed';
              return (
                <div className="task-row" key={t.id}>
                  <LinkBtn onClick={() => (d.isLeaderOf(t.project) ? modals.open('task', t.id) : null)} style={{ textAlign: 'left' }}>{t.title}</LinkBtn>
                  <span>{t.project_name || d.projName(t.project)}</span>
                  <span>{d.taskAssigneeNames(t)}</span>
                  <span>{fmtD(t.assigned)}</span>
                  <span style={{ color: overdue(t) ? 'var(--danger)' : undefined }}>{fmtD(t.deadline)}</span>
                  <span>{hm(t.mins)} / {hm(takenMins(t, now))}</span>
                  <TaskChip status={t.status} />
                  <span>
                    {canReassign && <button type="button" className="pill" onClick={() => setReassignTaskTarget(t)} style={{ fontSize: 11, padding: '2px 8px' }}>⇄ Reassign</button>}
                  </span>
                </div>
              );
            })}
            {!tasks.length && <Empty>No tasks</Empty>}
            <Pager pager={listPager} />
          </div></div>
        )}
      </div>
      <ReassignTaskModal
        isOpen={!!reassignTaskTarget}
        task={reassignTaskTarget}
        employees={d.employees}
        currentUserId={me.id}
        onClose={() => setReassignTaskTarget(null)}
        onReassign={async (assignees, note) => {
          if (reassignTaskTarget) {
            await TaskModel.reassign(reassignTaskTarget.id, assignees.join(','), note);
            toast('Task reassigned successfully.');
            await d.reload('tasks', 'projects', 'activity', 'alerts');
          }
        }}
      />
    </>
  );
}
