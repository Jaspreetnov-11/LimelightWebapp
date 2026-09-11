'use client';
import { useMemo, useState } from 'react';
import { useAuth } from '@/controllers/AuthController';
import { useData } from '@/controllers/DataController';
import { useUi } from '@/controllers/UiController';
import { useModals } from '@/controllers/useModals';
import { TaskModel } from '@/models';
import { saveCsv } from '@/lib/download';
import { Avatar, Empty, Icon, LinkBtn, Seg, Sq, TaskChip } from '@/views/ui';
import { Assignees } from '@/views/ui/Assignees';
import { assigneeIds, fmtD, hm, overdue, STATUSES, STATUS_LABEL } from '@/lib/format';

const COL_CLS = { pipeline: '', progress: 'ip', approval: 'pa', completed: 'cp', hold: 'oh' };

export function TasksScreen() {
  const { me } = useAuth();
  const d = useData();
  const { toast, confirm } = useUi();
  const modals = useModals();
  const [tab, setTab] = useState('org');
  const [member, setMember] = useState('');
  const [dept, setDept] = useState('');
  const [view, setView] = useState('board');
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState('');

  const tasks = useMemo(() => {
    let list = d.tasks.slice();
    if (tab === 'me') list = list.filter(t => assigneeIds(t).includes(me.id));
    else if (tab === 'byme') list = list.filter(t => t.assigned_by === me.id);
    else if (tab === 'proj') { const mine = new Set(d.projects.filter(p => p.manager === me.id).map(p => p.id)); list = list.filter(t => mine.has(t.project)); }
    else if (tab === 'team') list = list.filter(t => { const e = d.empById[assigneeIds(t)[0]]; return e && e.dept === me.dept; });
    if (member) list = list.filter(t => assigneeIds(t).includes(member));
    if (dept) list = list.filter(t => { const e = d.empById[assigneeIds(t)[0]]; return e && e.dept === dept; });
    return list;
  }, [d.tasks, d.projects, d.empById, tab, member, dept, me]);
  const emps = d.employees.filter(e => !dept || e.dept === dept);

  const move = async (id, to) => { const t = d.tasks.find(x => x.id === id); if (!t || t.status === to) return; try { await TaskModel.setStatus(id, to); toast('Moved to ' + STATUS_LABEL[to]); await d.reload('tasks', 'projects', 'activity', 'alerts'); } catch (err) { toast(err.message); } };
  const del = async t => { if (!confirm('Delete "' + t.title + '"?')) return; try { await TaskModel.remove(t.id); toast('Task deleted.'); await d.reload('tasks', 'projects'); } catch (err) { toast(err.message); } };
  const exportCsv = () => saveCsv('tasks.csv', [['Title', 'Project', 'Assignee', 'Assigned', 'Deadline', 'Minutes', 'Status']].concat(tasks.map(t => [t.title, t.project_name || d.projName(t.project), d.taskAssigneeNames(t), t.assigned, t.deadline, t.mins, STATUS_LABEL[t.status]])));

  const card = t => { const od = overdue(t); return (
    <div className={'tcard' + (dragId === t.id ? ' dragging' : '')} key={t.id} draggable onDragStart={ev => { setDragId(t.id); ev.dataTransfer.effectAllowed = 'move'; try { ev.dataTransfer.setData('text/plain', t.id); } catch (x) { /* ignore */ } }} onDragEnd={() => { setDragId(null); setOverCol(''); }}>
      <div className="p"><span>{t.project_name || d.projName(t.project)}</span><span style={{ display: 'flex', gap: 2, alignItems: 'center' }}><i className={od ? 'r' : ''} title={od ? 'Overdue' : ''}><Icon name="flag" size={14} /></i><button onClick={() => modals.open('task', t.id)} aria-label="Edit"><Icon name="file" /></button><button onClick={() => del(t)} aria-label="Delete">✕</button></span></div>
      <small>{t.type || 'Other'}{Number(t.mins) ? ' · ' + hm(t.mins) : ''}</small>
      <div>{t.title}</div>
      <div className="dates"><div><small>Assigned</small>{fmtD(t.assigned)}</div><div className={t.status === 'completed' ? 'ok' : ''} style={od ? { borderColor: 'rgba(255,92,122,.5)' } : undefined}><small>{t.status === 'completed' ? 'Completed' : 'Deadline'}</small>{fmtD(t.status === 'completed' ? (t.completed || t.deadline) : t.deadline)}</div></div>
      <Assignees task={t} />
      <div className="move">{STATUSES.filter(k => k !== t.status).map(k => <button key={k} onClick={() => move(t.id, k)}>→ {STATUS_LABEL[k]}</button>)}</div>
    </div>); };

  return (
    <>
      <div className="task-top">
        <div className="tabs">{[['me', 'file', 'Assigned to me'], ['byme', 'check', 'Assigned by me'], ['proj', 'brief', 'My Projects'], ['team', 'folder', 'My Team'], ['org', 'circle-check', 'Org Tasks']].map(([k, ic, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><Icon name={ic} size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{l}</button>)}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Seg items={[['board', '▦ Board'], ['list', '☰ List']]} value={view} onChange={setView} /><Sq icon="down" label="Export CSV" onClick={exportCsv} style={{ border: 0 }} /><button className="tb-btn solid" style={{ height: 34 }} onClick={() => modals.open('task')}>+ Add task</button></div>
      </div>
      <div className="board-wrap">
        <div className="members">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600, fontSize: 13, marginBottom: 8 }}>All Employees</div>
          <select value={dept} onChange={e => { setDept(e.target.value); setMember(''); }} style={{ height: 36, fontSize: 12.5, marginBottom: 8 }}><option value="">All Departments</option>{d.departments.map(x => <option key={x.id} value={x.name}>{x.name}</option>)}</select>
          <div className={'mem' + (!member ? ' on' : '')} onClick={() => setMember('')}><span className="avatar sm" style={{ background: '#FFD21F' }}><Icon name="users" size={12} style={{ color: '#0A0A0B' }} /></span>All Members</div>
          {emps.map(e => <div className={'mem' + (member === e.id ? ' on' : '')} key={e.id} onClick={() => setMember(e.id)}><Avatar e={e} /><div>{e.name}<small>{e.role || ''} · {e.dept || ''}</small></div></div>)}
        </div>
        {view === 'board' ? (
          <div className="board">
            {STATUSES.map(k => { const ts = tasks.filter(t => t.status === k); return (
              <div className={'col ' + COL_CLS[k] + (overCol === k ? ' over' : '')} key={k} onDragOver={ev => { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; setOverCol(k); }} onDragLeave={() => setOverCol('')} onDrop={ev => { ev.preventDefault(); const id = dragId || ev.dataTransfer.getData('text/plain'); setOverCol(''); setDragId(null); if (id) move(id, k); }}>
                <div className="col-h">{STATUS_LABEL[k]}<span>{ts.length}</span></div>
                {ts.map(card)}
                {!ts.length && <div className="empty" style={{ padding: '30px 0' }}>Drop tasks here</div>}
              </div>); })}
          </div>
        ) : (
          <div className="content"><div className="panel">
            <div className="task-row head"><span>Task</span><span>Project</span><span>Assignee</span><span>Assigned</span><span>Deadline</span><span>Time</span><span>Status</span></div>
            {tasks.map(t => <div className="task-row" key={t.id}><LinkBtn onClick={() => modals.open('task', t.id)} style={{ textAlign: 'left' }}>{t.title}</LinkBtn><span>{t.project_name || d.projName(t.project)}</span><span>{d.taskAssigneeNames(t)}</span><span>{fmtD(t.assigned)}</span><span style={{ color: overdue(t) ? 'var(--danger)' : undefined }}>{fmtD(t.deadline)}</span><span>{hm(t.mins)}</span><TaskChip status={t.status} /></div>)}
            {!tasks.length && <Empty>No tasks</Empty>}
          </div></div>
        )}
      </div>
    </>
  );
}
