'use client';
// Stacked avatars + names for a task's assignees (a task can be assigned to several people).
import { useData } from '@/controllers/DataController';
import { Avatar } from './index';

export function Assignees({ task, names = true, max = 4 }) {
  const { taskAssignees } = useData();
  const list = taskAssignees(task);
  if (!list.length) return <span className="who"><span className="avatar sm gy">?</span>Unassigned</span>;
  return (
    <span className="who">
      <span className="stack">{list.slice(0, max).map(e => <Avatar key={e.id} e={e} />)}{list.length > max && <span className="avatar sm gy">+{list.length - max}</span>}</span>
      {names && <span className="names">{list.length === 1 ? list[0].name : list.map(e => e.name.split(' ')[0]).join(', ')}</span>}
    </span>
  );
}
