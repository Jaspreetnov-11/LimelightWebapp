'use client';
// Data controller: in-memory store of every collection the screens need, loaded from the backend.
// Screens read from here and call `reload(...)` after a write so all views stay consistent.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityModel, AttendanceModel, DepartmentModel, EmployeeModel, FileModel, HolidayModel, LeaveModel, ProjectModel, TaskModel, TodoModel } from '@/models';
import { useAuth } from './AuthController';

const DataContext = createContext(null);

const LOADERS = {
  employees: () => EmployeeModel.list(),
  departments: () => DepartmentModel.list(),
  projects: () => ProjectModel.list(),
  tasks: () => TaskModel.list().then(r => r.data || []),
  today: () => AttendanceModel.today(),
  leaves: () => LeaveModel.list(),
  holidays: () => HolidayModel.list(),
  todos: () => TodoModel.list(),
  files: () => FileModel.list(),
  activity: () => ActivityModel.list(60).then(r => ({ items: r.data || [], unread: (r.meta && r.meta.unreadCount) || 0 })),
  alerts: () => ActivityModel.alerts()
};
const EMPTY = { employees: [], departments: [], projects: [], tasks: [], today: null, leaves: [], holidays: [], todos: [], files: [], activity: { items: [], unread: 0 }, alerts: null };

export function DataProvider({ children }) {
  const { isAuthed } = useAuth();
  const [state, setState] = useState(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const inflight = useRef({});

  const reload = useCallback(async (...keys) => {
    const list = keys.length ? keys : Object.keys(LOADERS);
    const results = await Promise.allSettled(list.map(k => {
      if (!inflight.current[k]) inflight.current[k] = LOADERS[k]().finally(() => { delete inflight.current[k]; });
      return inflight.current[k];
    }));
    const patch = {};
    let firstErr = '';
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') patch[list[i]] = r.value;
      else if (!firstErr) firstErr = (r.reason && r.reason.message) || 'Could not load ' + list[i];
    });
    setState(s => ({ ...s, ...patch }));
    if (firstErr) setError(firstErr); else setError('');
    return patch;
  }, []);

  useEffect(() => {
    if (!isAuthed) { setState(EMPTY); setLoaded(false); return; }
    let alive = true;
    reload().finally(() => { if (alive) setLoaded(true); });
    const t = setInterval(() => reload('today', 'activity', 'tasks'), 60000); // light polling keeps other devices in sync
    return () => { alive = false; clearInterval(t); };
  }, [isAuthed, reload]);

  // Convenience lookups used everywhere.
  const helpers = useMemo(() => {
    const empById = Object.fromEntries(state.employees.map(e => [e.id, e]));
    const projById = Object.fromEntries(state.projects.map(p => [p.id, p]));
    const taskAssignees = t => String((t && t.assignee) || '').split(',').map(s => s.trim()).filter(Boolean).map(id => empById[id]).filter(Boolean);
    return {
      empById, projById, taskAssignees,
      taskAssigneeNames: t => { const a = taskAssignees(t); return a.length ? a.map(e => e.name).join(', ') : 'Unassigned'; },
      empName: id => (empById[id] ? empById[id].name : '—'),
      projName: id => (projById[id] ? projById[id].name : 'Personal / Operational')
    };
  }, [state.employees, state.projects]);

  const value = useMemo(() => ({ ...state, ...helpers, loaded, error, reload }), [state, helpers, loaded, error, reload]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
