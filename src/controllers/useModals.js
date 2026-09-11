'use client';
// Form controllers for every "Add / Edit" dialog. Builds the field config, validates, calls the model, reloads data.
import { useCallback } from 'react';
import { useAuth } from './AuthController';
import { useData } from './DataController';
import { useUi } from './UiController';
import { AttendanceModel, DepartmentModel, EmployeeModel, FileModel, LeaveModel, PaymentModel, ProjectModel, TaskModel } from '@/models';
import { avFor, ini, PAY_TYPES, STATUSES, STATUS_LABEL, TASK_TYPES, todayISO } from '@/lib/format';

export function useModals() {
  const { me } = useAuth();
  const { employees, departments, projects, tasks, reload } = useData();
  const { openModal, toast } = useUi();

  const open = useCallback((kind, id, preset = {}) => {
    const empOpts = [{ v: '', l: 'Unassigned' }].concat(employees.map(e => ({ v: e.id, l: e.name })));
    const empOnly = employees.map(e => ({ v: e.id, l: e.name }));
    const projOpts = [{ v: '', l: 'Personal / Operational' }].concat(projects.map(p => ({ v: p.id, l: p.name })));
    const deptOpts = departments.map(d => ({ v: d.name, l: d.name }));
    const meId = me ? me.id : '';

    if (kind === 'task') {
      const t = id ? tasks.find(x => x.id === id) : null;
      openModal({
        title: t ? 'Edit task' : 'Add task', sub: 'Tasks show on the board, the dashboard and the assignee\'s profile.', ok: t ? 'Save changes' : 'Add task',
        fields: [
          { name: 'title', label: 'Task title', required: true, span: true, value: t ? t.title : '', placeholder: 'What needs to be done?' },
          { name: 'project', label: 'Project', type: 'select', options: projOpts, value: t ? t.project : (preset.project || '') },
          { name: 'assignees', label: 'Assign to (one or more)', type: 'multiselect', span: true, options: employees.map(e => ({ v: e.id, l: e.name, sub: e.role || '', av: e.av || avFor(e.name), ini: e.ini || ini(e.name) })), value: t ? String(t.assignee || '').split(',').map(s => s.trim()).filter(Boolean) : (preset.assignee ? [preset.assignee] : (meId ? [meId] : [])) },
          { name: 'assigned', label: 'Assigned on', type: 'date', required: true, value: t ? (t.assigned || '') : todayISO() },
          { name: 'deadline', label: 'Deadline', type: 'date', required: true, value: t ? (t.deadline || '') : todayISO() },
          { name: 'status', label: 'Status', type: 'select', options: STATUSES.map(k => ({ v: k, l: STATUS_LABEL[k] })), value: t ? t.status : 'pipeline' },
          { name: 'mins', label: 'Time spent (minutes)', type: 'number', value: t ? t.mins : 0, min: 0, step: 15 },
          { name: 'type', label: 'Task type', type: 'select', options: TASK_TYPES.map(x => ({ v: x, l: x })), value: t ? t.type : 'Other' }
        ],
        onSubmit: async d => {
          const body = { title: d.title, project: d.project, assignee: (Array.isArray(d.assignees) ? d.assignees : []).join(','), assigned: d.assigned, deadline: d.deadline, status: d.status, mins: Number(d.mins) || 0, type: d.type };
          if (t) { await TaskModel.update(t.id, body); toast('Task updated.'); } else { await TaskModel.create(body); toast('Task added.'); }
          await reload('tasks', 'projects', 'activity', 'alerts');
        }
      });
    } else if (kind === 'project') {
      const p = id ? projects.find(x => x.id === id) : null;
      openModal({
        title: p ? 'Edit project' : 'Add project', sub: 'Allocated hours drive the project health and overrun alerts.', ok: p ? 'Save changes' : 'Add project',
        fields: [
          { name: 'name', label: 'Project name', required: true, value: p ? p.name : '', placeholder: 'e.g. Bihar Project' },
          { name: 'client', label: 'Client', required: true, value: p ? p.client : '', placeholder: 'Client name' },
          { name: 'manager', label: 'Manager', type: 'select', options: empOpts, value: p ? p.manager : meId },
          { name: 'billable', label: 'Billing', type: 'select', options: [{ v: '1', l: 'Billable' }, { v: '0', l: 'Non-billable' }], value: p ? (p.billable ? '1' : '0') : '1' },
          { name: 'start', label: 'Start date', type: 'date', required: true, value: p ? (p.start || '') : todayISO() },
          { name: 'alloc', label: 'Allocated hours', type: 'number', required: true, value: p ? Math.round((Number(p.alloc) || 0) / 60) : 40, min: 0, step: 1 },
          { name: 'status', label: 'Status', type: 'select', options: ['Draft', 'Approved', 'On Hold', 'Closed'].map(x => ({ v: x, l: x })), value: p ? p.status : 'Approved' }
        ],
        onSubmit: async d => {
          const body = { name: d.name, client: d.client, manager: d.manager, billable: d.billable === '1', start: d.start, alloc: Math.round(Number(d.alloc) * 60), status: d.status };
          if (p) { await ProjectModel.update(p.id, body); toast('Project updated.'); } else { await ProjectModel.create(body); toast('Project added.'); }
          await reload('projects', 'activity');
        }
      });
    } else if (kind === 'employee') {
      const e = id ? employees.find(x => x.id === id) : null;
      openModal({
        title: e ? 'Edit staff' : 'Add staff', sub: 'Salary is used for payroll and the pending balance. Email + password create the login.', ok: e ? 'Save changes' : 'Add staff',
        fields: [
          { name: 'name', label: 'Full name', required: true, value: e ? e.name : '' },
          { name: 'email', label: 'Email (login)', type: 'email', required: true, value: e ? e.email : '' },
          { name: 'password', label: e ? 'New password' : 'Password', type: 'password', value: '', placeholder: e ? 'Leave blank to keep' : 'Min 6 characters', validate: v => !v || v.length >= 6 || 'At least 6 characters.' },
          { name: 'phone', label: 'Phone', type: 'tel', value: e ? e.phone : '', placeholder: '98xxxxxxxx' },
          { name: 'role', label: 'Designation', required: true, value: e ? e.role : '', placeholder: 'e.g. Video Editor' },
          { name: 'dept', label: 'Department', type: 'select', options: deptOpts, value: e ? e.dept : (deptOpts[0] || {}).v },
          { name: 'salary', label: 'Monthly salary (₹)', type: 'number', required: true, value: e ? (e.salary || 0) : 25000, min: 0, step: 500 },
          { name: 'emp_id', label: 'Employee ID', value: e ? e.emp_id : '' },
          { name: 'joined', label: 'Joining date', type: 'date', required: true, value: e ? (e.joined || '') : todayISO() },
          { name: 'dob', label: 'Date of birth', type: 'date', value: e ? (e.dob || '') : '' },
          { name: 'access', label: 'App access', type: 'select', options: [{ v: 'admin', l: 'Admin (full access)' }, { v: 'staff', l: 'Staff (own data)' }], value: e ? (e.access || 'staff') : 'staff' },
          { name: 'managers', label: 'Reporting managers', span: true, value: e ? (Array.isArray(e.managers) ? e.managers.join(', ') : '') : '', placeholder: 'Comma separated names' }
        ],
        onSubmit: async d => {
          const body = { name: d.name, email: d.email, phone: d.phone, role: d.role, dept: d.dept, salary: Number(d.salary) || 0, emp_id: d.emp_id, joined: d.joined, dob: d.dob || null, access: d.access, managers: d.managers ? d.managers.split(',').map(x => x.trim()).filter(Boolean) : [] };
          if (d.password) body.password = d.password;
          if (e) { await EmployeeModel.update(e.id, body); toast('Staff updated.'); } else { await EmployeeModel.create(body); toast('Staff added.'); }
          await reload('employees', 'departments', 'activity');
        }
      });
    } else if (kind === 'dept') {
      const x = id ? departments.find(d => d.id === id) : null;
      openModal({
        title: x ? 'Edit department' : 'Add department', ok: x ? 'Save changes' : 'Add department',
        fields: [
          { name: 'name', label: 'Department name', required: true, value: x ? x.name : '' },
          { name: 'billable', label: 'Type', type: 'select', options: [{ v: '1', l: 'Billable' }, { v: '0', l: 'Non-billable' }], value: x ? (x.billable ? '1' : '0') : '1' },
          { name: 'daily', label: 'Daily hours', type: 'number', value: x ? x.daily : 8, min: 1, step: 1 },
          { name: 'manager', label: 'Manager', type: 'select', options: empOpts, value: x ? (x.manager || '') : '' }
        ],
        onSubmit: async d => {
          const body = { name: d.name, billable: d.billable === '1', daily: Number(d.daily) || 8, manager: d.manager };
          if (x) { await DepartmentModel.update(x.id, body); toast('Department updated.'); } else { await DepartmentModel.create(body); toast('Department added.'); }
          await reload('departments', 'employees');
        }
      });
    } else if (kind === 'leave') {
      openModal({
        title: 'Apply leave', sub: 'Leave days count as paid days in payroll and are excluded from unaccounted days.', ok: 'Apply',
        fields: [
          { name: 'emp', label: 'Employee', type: 'select', options: empOnly, value: preset.emp || meId },
          { name: 'reason', label: 'Reason', type: 'select', options: ['Casual', 'Sick', 'Personal', 'Vacation'].map(x => ({ v: x, l: x })) },
          { name: 'from_date', label: 'From', type: 'date', required: true, value: todayISO() },
          { name: 'to_date', label: 'To', type: 'date', required: true, value: todayISO(), validate: (v, all) => v >= all.from_date || 'End date must be after start date.' }
        ],
        onSubmit: async d => { await LeaveModel.apply({ emp: d.emp, from_date: d.from_date, to_date: d.to_date, reason: d.reason }); toast('Leave applied.'); await reload('leaves', 'employees', 'activity'); }
      });
    } else if (kind === 'payment') {
      openModal({
        title: id ? 'Edit payment' : 'Add payment', sub: 'Salary, advance and bonus reduce the pending balance. Fine increases it.', ok: id ? 'Save changes' : 'Add payment',
        fields: [
          { name: 'emp', label: 'Staff', type: 'select', options: empOnly, value: preset.emp || (id ? preset.row?.emp : meId) },
          { name: 'type', label: 'Type', type: 'select', options: PAY_TYPES.map(x => ({ v: x, l: x })), value: preset.type || (preset.row ? preset.row.type : 'Salary') },
          { name: 'amount', label: 'Amount (₹)', type: 'number', required: true, value: preset.amount || (preset.row ? preset.row.amount : ''), min: 1, step: 1 },
          { name: 'date', label: 'Date', type: 'date', required: true, value: preset.row ? preset.row.date : todayISO() },
          { name: 'note', label: 'Note', span: true, value: preset.row ? preset.row.note : '', placeholder: 'e.g. September salary' }
        ],
        onSubmit: async d => {
          const body = { emp: d.emp, type: d.type, amount: Number(d.amount), date: d.date, note: d.note };
          if (id) { await PaymentModel.update(id, body); toast('Payment updated.'); } else { await PaymentModel.create(body); toast('Payment recorded.'); }
          await reload('employees', 'activity');
          if (preset.after) preset.after();
        }
      });
    } else if (kind === 'attendance') {
      const a = preset.row || null;
      openModal({
        title: a ? 'Edit attendance' : 'Mark attendance', ok: 'Save',
        fields: [
          { name: 'status', label: 'Status', type: 'select', options: [{ v: 'present', l: 'Present' }, { v: 'half', l: 'Half day' }, { v: 'absent', l: 'Absent' }, { v: 'leave', l: 'Leave' }], value: a ? (a.status || 'present') : 'present' },
          { name: 'mode', label: 'Mode', type: 'select', options: [{ v: 'office', l: 'Office' }, { v: 'wfh', l: 'Work from home' }, { v: 'field', l: 'On field' }], value: a ? a.mode : 'office' },
          { name: 'clock_in', label: 'Clock in', type: 'time', value: a ? a.clock_in : '' },
          { name: 'clock_out', label: 'Clock out', type: 'time', value: a ? (a.clock_out || '') : '' },
          { name: 'ot_hours', label: 'Overtime hours', type: 'number', value: a ? a.ot_hours : 0, min: 0, step: 0.5 },
          { name: 'fine_hours', label: 'Fine hours', type: 'number', value: a ? a.fine_hours : 0, min: 0, step: 0.5 },
          { name: 'note', label: 'Note', span: true, value: a ? a.note : '' }
        ],
        onSubmit: async d => {
          if (!a) throw new Error('Use the P / HD / A / L buttons to create a record first.');
          await AttendanceModel.update(a.id, { status: d.status, mode: d.mode, clock_in: d.clock_in, clock_out: d.clock_out, ot_hours: Number(d.ot_hours) || 0, fine_hours: Number(d.fine_hours) || 0, note: d.note });
          toast('Attendance saved.');
          await reload('today', 'employees');
          if (preset.after) preset.after();
        }
      });
    } else if (kind === 'file') {
      openModal({
        title: 'Upload file', sub: 'Files are stored on the server and listed under the project.', ok: 'Upload',
        fields: [
          { name: 'file', label: 'File', type: 'file', required: true, span: true, error: 'Choose a file first.' },
          { name: 'project', label: 'Project', type: 'select', options: projOpts, value: preset.project || '' }
        ],
        onSubmit: async d => {
          await FileModel.upload(d.file, d.project);
          toast('File uploaded.');
          await reload('files', 'activity');
        }
      });
    }
  }, [employees, departments, projects, tasks, me, openModal, toast, reload]);

  return { open };
}
