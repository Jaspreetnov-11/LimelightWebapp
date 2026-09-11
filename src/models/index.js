// Entity models (Model layer of the frontend). One object per backend resource.
// Each method maps to a backend route and returns the unwrapped `data`.
import { api } from './api.client';

const data = p => p.then(r => r.data);
const full = p => p; // keeps meta / pagination

export const AuthModel = {
  login: (email, password) => data(api.post('/auth/login', { email, password })),
  register: payload => data(api.post('/auth/register', payload)),
  forgotPassword: email => api.post('/auth/forgot-password', { email }),
  me: () => data(api.get('/auth/me')),
  health: () => api.get('/health')
};

export const EmployeeModel = {
  list: params => data(api.get('/employees', { limit: 500, ...(params || {}) })),
  get: id => data(api.get('/employees/' + id)),
  create: body => data(api.post('/employees', body)),
  update: (id, body) => data(api.put('/employees/' + id, body)),
  remove: id => api.del('/employees/' + id)
};

export const DepartmentModel = {
  list: () => data(api.get('/departments')),
  create: body => data(api.post('/departments', body)),
  update: (id, body) => data(api.put('/departments/' + id, body)),
  remove: id => api.del('/departments/' + id)
};

export const ProjectModel = {
  list: () => data(api.get('/projects')),
  get: id => data(api.get('/projects/' + id)),
  create: body => data(api.post('/projects', body)),
  update: (id, body) => data(api.put('/projects/' + id, body)),
  remove: id => api.del('/projects/' + id)
};

export const TaskModel = {
  list: params => full(api.get('/tasks', { limit: 500, ...(params || {}) })),
  get: id => data(api.get('/tasks/' + id)),
  create: body => data(api.post('/tasks', body)),
  update: (id, body) => data(api.put('/tasks/' + id, body)),
  setStatus: (id, status) => data(api.patch('/tasks/' + id + '/status', { status })),
  remove: id => api.del('/tasks/' + id)
};

export const AttendanceModel = {
  today: () => data(api.get('/attendance/today')),
  list: params => data(api.get('/attendance', params)),
  stats: (empId, month) => data(api.get('/attendance/stats/' + empId, { month })),
  teamSummary: month => data(api.get('/attendance/team-summary', { month })),
  clockIn: body => data(api.post('/attendance/clock-in', body)),
  clockOut: body => data(api.post('/attendance/clock-out', body)),
  mark: body => data(api.post('/attendance/mark', body)),
  update: (id, body) => data(api.put('/attendance/' + id, body))
};

export const LeaveModel = {
  list: params => data(api.get('/leaves', params)),
  today: () => data(api.get('/leaves/today')),
  apply: body => data(api.post('/leaves', body)),
  remove: id => api.del('/leaves/' + id)
};

export const PaymentModel = {
  list: params => full(api.get('/payments', { limit: 500, ...(params || {}) })),
  create: body => data(api.post('/payments', body)),
  update: (id, body) => data(api.put('/payments/' + id, body)),
  remove: id => api.del('/payments/' + id)
};

export const PayrollModel = {
  get: month => data(api.get('/payroll', { month })),
  payAll: month => data(api.post('/payroll/pay-all', { month }))
};

export const HolidayModel = {
  list: upcoming => data(api.get('/holidays', upcoming ? { upcoming: 'true' } : undefined)),
  create: body => data(api.post('/holidays', body)),
  remove: id => api.del('/holidays/' + id)
};

export const TodoModel = {
  list: () => data(api.get('/todos')),
  create: text => data(api.post('/todos', { text })),
  toggle: id => data(api.patch('/todos/' + id + '/toggle')),
  remove: id => api.del('/todos/' + id)
};

export const FileModel = {
  list: () => data(api.get('/files')),
  upload: (file, project) => { const fd = new FormData(); fd.append('file', file); if (project) fd.append('project', project); return data(api.post('/files/upload', fd)); },
  downloadUrl: id => '/api/files/' + id + '/download',
  remove: id => api.del('/files/' + id)
};

export const ActivityModel = {
  list: limit => full(api.get('/activity', { limit: limit || 60 })),
  markAllRead: () => api.post('/activity/read-all'),
  remove: id => api.del('/activity/' + id),
  clear: () => api.del('/activity'),
  alerts: () => data(api.get('/activity/alerts'))
};

export const ReportModel = {
  // Returns a Blob for the CSV; the caller triggers the download.
  download: async (name, params) => {
    const res = await api.download('/reports/' + name, params);
    return res.blob();
  }
};
