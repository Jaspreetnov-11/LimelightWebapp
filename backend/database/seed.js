'use strict';

const bcrypt = require('bcryptjs');

function getSeedData() {
  const y = new Date().getFullYear();
  const m = new Date().toISOString().slice(0, 7);

  // Hash for 'Lighthouse@123'
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('Lighthouse@123', salt);

  const employees = [
    { id: 'e1', name: 'Girish Sahu', role: 'Campaign Strategist', dept: 'Operations', email: 'girish@lighthouse.io', emp_id: 'LH0047', joined: '2026-03-23', dob: '1994-09-12', managers: JSON.stringify(['Nikita Jain']), salary: 42000, phone: '98260 10001', access: 'staff', av: 'g', ini: 'GS' },
    { id: 'e2', name: 'Gurpreet Sethi', role: 'Co-Founder', dept: 'Operations', email: 'gurpreet@lighthouse.io', emp_id: 'LH0001', joined: '2021-01-10', dob: '1988-09-12', managers: JSON.stringify([]), salary: 90000, phone: '98260 10002', access: 'admin', av: 'p', ini: 'GS' },
    { id: 'e3', name: 'Jaspreet Singh', role: 'Co-Founder', dept: 'Operations', email: 'jaspreet@lighthouse.io', emp_id: 'LH0002', joined: '2021-01-10', dob: '1989-11-02', managers: JSON.stringify([]), salary: 90000, phone: '98260 10003', access: 'admin', av: 'r', ini: 'JS' },
    { id: 'e4', name: 'Admin User', role: 'Operations Coordinator', dept: 'Operations', email: 'admin@lighthouse.io', emp_id: 'LH0052', joined: '2025-06-01', dob: '1996-04-18', managers: JSON.stringify(['Gurpreet Sethi']), salary: 36000, phone: '98260 10004', access: 'admin', av: 'o', ini: 'AU' },
    { id: 'e5', name: 'Sulabh Saurabh', role: 'Operation Executive', dept: 'Operations', email: 'sulabh@lighthouse.io', emp_id: 'LH0031', joined: '2024-02-14', dob: '1997-09-17', managers: JSON.stringify(['Jaspreet Singh']), salary: 28000, phone: '98260 10005', access: 'staff', av: 'b', ini: 'SS' },
    { id: 'e6', name: 'Vikram Shah', role: 'Video Editor', dept: 'Editing', email: 'vikram@lighthouse.io', emp_id: 'LH0019', joined: '2023-08-01', dob: '1995-01-30', managers: JSON.stringify(['Girish Sahu']), salary: 32000, phone: '98260 10006', access: 'staff', av: 'br', ini: 'VS' },
    { id: 'e7', name: 'Jitesh Sahu', role: 'Content Writer', dept: 'Content', email: 'jitesh@lighthouse.io', emp_id: 'LH0023', joined: '2023-10-09', dob: '1998-06-21', managers: JSON.stringify(['Girish Sahu']), salary: 26000, phone: '98260 10007', access: 'staff', av: 't', ini: 'JS' },
    { id: 'e8', name: 'Arjun Khanna', role: 'Designer', dept: 'Designing', email: 'arjun@lighthouse.io', emp_id: 'LH0061', joined: '2026-09-07', dob: '2000-12-05', managers: JSON.stringify(['Girish Sahu']), salary: 30000, phone: '98260 10008', access: 'staff', av: 'p', ini: 'AK' }
  ];

  const users = [
    { id: 'u1', email: 'admin@lighthouse.io', password_hash: passwordHash, role: 'admin', employee_id: 'e4' },
    { id: 'u2', email: 'gurpreet@lighthouse.io', password_hash: passwordHash, role: 'admin', employee_id: 'e2' },
    { id: 'u3', email: 'jaspreet@lighthouse.io', password_hash: passwordHash, role: 'admin', employee_id: 'e3' },
    { id: 'u4', email: 'girish@lighthouse.io', password_hash: passwordHash, role: 'staff', employee_id: 'e1' }
  ];

  const departments = [
    { id: 'd1', name: 'Accounts', billable: 0, daily: 8, manager: '' },
    { id: 'd2', name: 'Admin', billable: 0, daily: 8, manager: '' },
    { id: 'd3', name: 'Content', billable: 1, daily: 8, manager: '' },
    { id: 'd4', name: 'Designing', billable: 1, daily: 8, manager: '' },
    { id: 'd5', name: 'Editing', billable: 1, daily: 8, manager: '' },
    { id: 'd6', name: 'Field-Shoot', billable: 1, daily: 9, manager: '' },
    { id: 'd7', name: 'HR', billable: 0, daily: 8, manager: '' },
    { id: 'd8', name: 'Operations', billable: 0, daily: 8, manager: '' },
    { id: 'd9', name: 'Sales', billable: 1, daily: 8, manager: '' },
    { id: 'd10', name: 'Strategy', billable: 1, daily: 8, manager: '' }
  ];

  const projects = [
    { id: 'p1', name: 'Bihar Project', client: 'Bihar', billable: 0, manager: 'e5', start: '2026-08-21', alloc: 60, status: 'Approved' },
    { id: 'p2', name: 'Bill Video', client: 'CG SAMVAD', billable: 1, manager: 'e1', start: '2026-07-02', alloc: 900, status: 'Approved' },
    { id: 'p3', name: 'CBC', client: 'Jaspreet', billable: 1, manager: 'e3', start: '2026-08-30', alloc: 0, status: 'Draft' },
    { id: 'p4', name: 'CG SAMVAD – 8 Min', client: 'CG SAMVAD', billable: 1, manager: 'e1', start: '2026-08-12', alloc: 600, status: 'Approved' },
    { id: 'p5', name: 'CMO Project', client: 'CG SAMVAD', billable: 1, manager: 'e2', start: '2026-08-01', alloc: 600, status: 'Approved' },
    { id: 'p6', name: 'CMO Video Folder', client: 'CG SAMVAD', billable: 1, manager: 'e2', start: '2026-08-05', alloc: 1200, status: 'Approved' }
  ];

  const tasks = [
    { id: 't1', title: 'Nasha Mukt Yuva for Viksit Bharat reel 06', project: 'p2', assignee: 'e6', assigned_by: 'e4', assigned: '2026-08-31', deadline: '2026-08-31', completed: null, status: 'pipeline', mins: 0, type: 'Other', flag: 0 },
    { id: 't2', title: 'Grain ATM @Durg — contact Shashi Singh', project: 'p5', assignee: 'e7', assigned_by: 'e1', assigned: '2026-08-31', deadline: '2026-09-01', completed: null, status: 'pipeline', mins: 0, type: 'Shoot', flag: 0 },
    { id: 't3', title: 'Abhishek Upamanyu Event Highlight', project: '', assignee: 'e8', assigned_by: 'e4', assigned: '2026-08-31', deadline: '2026-08-31', completed: null, status: 'pipeline', mins: 0, type: 'Personal', flag: 0 },
    { id: 't4', title: 'सुशासन रिफॉर्म वीडियो कंटेंट – 3', project: 'p6', assignee: 'e7', assigned_by: 'e2', assigned: '2026-08-29', deadline: '2026-08-29', completed: null, status: 'progress', mins: 420, type: 'Other', flag: 1 },
    { id: 't5', title: 'खनिज विभाग वीडियो – 3.30 मिनट', project: 'p5', assignee: 'e7', assigned_by: 'e2', assigned: '2026-08-27', deadline: '2026-08-28', completed: null, status: 'progress', mins: 1500, type: 'Other', flag: 1 },
    { id: 't6', title: 'बिहार वीडियो – जांच एवं उपचार, चिकित्सा आपके द्वार अभियान', project: 'p1', assignee: 'e7', assigned_by: 'e5', assigned: '2026-08-26', deadline: '2026-08-27', completed: null, status: 'progress', mins: 900, type: 'Other', flag: 1 },
    { id: 't7', title: 'बिहार स्वास्थ्य वृहद जांच अभियान – 1 मिनट वीडियो', project: 'p1', assignee: 'e6', assigned_by: 'e5', assigned: '2026-08-22', deadline: '2026-08-22', completed: null, status: 'progress', mins: 900, type: 'Other', flag: 1 },
    { id: 't8', title: 'आजीविका से आत्मनिर्भर हो रहे ग्रामीण वीडियो – 2 मिनट', project: 'p2', assignee: 'e6', assigned_by: 'e1', assigned: '2026-09-04', deadline: '2026-08-31', completed: '2026-08-31', status: 'completed', mins: 2400, type: 'Other', flag: 0 },
    { id: 't9', title: 'Nasha mukt Yuva reel dated 31 Aug', project: 'p2', assignee: 'e6', assigned_by: 'e1', assigned: '2026-09-01', deadline: '2026-08-31', completed: '2026-08-31', status: 'completed', mins: 180, type: 'Other', flag: 0 },
    { id: 't10', title: 'Track creatives', project: 'p4', assignee: 'e8', assigned_by: 'e4', assigned: '2026-09-01', deadline: '2026-08-31', completed: '2026-08-31', status: 'completed', mins: 60, type: 'Other', flag: 0 }
  ];

  const attendance = [
    { id: 'a1', emp: 'e4', date: m + '-08', clock_in: '11:04', clock_out: '19:10', mode: 'office', status: 'present', ot_hours: 0, fine_hours: 0, note: '' },
    { id: 'a2', emp: 'e4', date: m + '-09', clock_in: '11:32', clock_out: '19:05', mode: 'office', status: 'present', ot_hours: 0, fine_hours: 0.5, note: 'Late' },
    { id: 'a3', emp: 'e4', date: m + '-10', clock_in: '10:58', clock_out: '18:40', mode: 'wfh', status: 'present', ot_hours: 0, fine_hours: 0, note: '' },
    { id: 'a4', emp: 'e6', date: m + '-10', clock_in: '11:10', clock_out: '19:30', mode: 'office', status: 'present', ot_hours: 0.5, fine_hours: 0, note: '' },
    { id: 'a5', emp: 'e7', date: m + '-10', clock_in: '11:40', clock_out: '19:00', mode: 'office', status: 'present', ot_hours: 0, fine_hours: 0, note: '' },
    { id: 'a6', emp: 'e5', date: m + '-10', clock_in: '', clock_out: '', mode: 'office', status: 'half', ot_hours: 0, fine_hours: 0, note: '' },
    { id: 'a7', emp: 'e1', date: m + '-10', clock_in: '', clock_out: '', mode: 'office', status: 'absent', ot_hours: 0, fine_hours: 0, note: '' }
  ];

  const leaves = [
    { id: 'l1', emp: 'e8', from_date: '2026-09-15', to_date: '2026-09-16', reason: 'Personal', status: 'approved' }
  ];

  const payments = [
    { id: 'py1', emp: 'e6', date: m + '-05', amount: 10000, type: 'Advance', note: 'Camera rental advance', assigned_by: 'e4' },
    { id: 'py2', emp: 'e7', date: m + '-03', amount: 5000, type: 'Salary', note: 'Part salary', assigned_by: 'e4' },
    { id: 'py3', emp: 'e1', date: m + '-07', amount: 1500, type: 'Reimbursement', note: 'Travel Durg', assigned_by: 'e4' }
  ];

  const holidays = [
    { id: 'h1', name: 'Dussehra', date: y + '-10-20' },
    { id: 'h2', name: 'Chhattisgarh Rajyotsav', date: y + '-11-01' },
    { id: 'h3', name: 'Diwali Day 1', date: y + '-11-08' },
    { id: 'h4', name: 'Christmas', date: y + '-12-25' }
  ];

  const activity = [
    { id: 'n1', text: 'Arjun Khanna joined Designing', at: '2026-09-07T10:00:00', read: 1 }
  ];

  return { users, employees, departments, projects, tasks, attendance, leaves, payments, holidays, activity };
}

module.exports = { getSeedData };
