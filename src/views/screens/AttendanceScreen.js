'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/controllers/AuthController';
import { useData } from '@/controllers/DataController';
import { useUi } from '@/controllers/UiController';
import { useModals } from '@/controllers/useModals';
import { AttendanceModel, ReportModel } from '@/models';
import { saveBlob, saveCsv } from '@/lib/download';
import { Avatar, Chip, Empty, GeoLink, LinkBtn, Search, Seg, Sq } from '@/views/ui';
import { Pager, usePager } from '@/views/ui/Pager';
import { ATT, attStatus, fmtD, fmtDY, todayISO } from '@/lib/format';

const hrs = n => { const m = Math.round((Number(n) || 0) * 60); return Math.floor(m / 60) + 'h ' + (m % 60) + 'm'; };

export function AttendanceScreen() {
  const { me, isAdmin } = useAuth();
  const d = useData();
  const { toast } = useUi();
  const modals = useModals();
  const [date, setDate] = useState(todayISO());
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [rows, setRows] = useState([]);
  const isToday = date === todayISO();

  const load = useCallback(async () => { try { setRows(await AttendanceModel.list({ date })); } catch (err) { toast(err.message); } }, [date, toast]);
  useEffect(() => { load(); }, [load, d.today]);

  const rec = useMemo(() => Object.fromEntries(rows.map(a => [a.emp, a])), [rows]);
  const emps = (tab === 'me' ? d.employees.filter(e => e.id === me.id) : d.employees).filter(e => { const s = q.toLowerCase(); return e.name.toLowerCase().includes(s) || (e.emp_id || '').toLowerCase().includes(s) || (e.phone || '').includes(s); });
  const lv = e => d.leaves.find(l => l.emp === e.id && l.from_date <= date && l.to_date >= date);
  const cnt = k => rows.filter(a => attStatus(a) === k).length;
  const ot = rows.reduce((x, a) => x + (Number(a.ot_hours) || 0), 0), fine = rows.reduce((x, a) => x + (Number(a.fine_hours) || 0), 0);
  const punchedIn = rows.filter(a => a.clock_in).length, punchedOut = rows.filter(a => a.clock_out).length;
  const leaveCount = d.employees.filter(lv).length + cnt('leave');
  const pager = usePager(emps, 10);
  const groups = {}; pager.items.forEach(e => { (groups[e.dept || 'Other'] = groups[e.dept || 'Other'] || []).push(e); });
  const unmarked = d.employees.length - rows.length;

  const shift = n => { const dd = new Date(date + 'T00:00:00'); dd.setDate(dd.getDate() + n); const iso = dd.toISOString().slice(0, 10); if (iso <= todayISO()) setDate(iso); };

  // Marking goes through POST /attendance/mark (admin/manager): creates or updates the day's record.
  const send = async body => {
    if (!isAdmin) { toast('Only admins can mark attendance. Staff clock in from the dashboard.'); return; }
    try { await AttendanceModel.mark({ date, ...body }); await Promise.all([load(), d.reload('today', 'employees')]); } catch (err) { toast(err.message); }
  };
  const mark = (e, status) => { const a = rec[e.id]; send({ emp: e.id, status: attStatus(a) === status ? '' : status }); };
  const hoursPrompt = (e, kind) => {
    const a = rec[e.id] || {};
    const v = window.prompt((kind === 'ot_hours' ? 'Overtime' : 'Fine') + ' hours for ' + e.name + ' on ' + fmtD(date) + ':', a[kind] || 1);
    if (v === null) return;
    send({ emp: e.id, status: attStatus(a) || 'present', [kind]: Math.max(0, parseFloat(v) || 0) });
  };
  const notePrompt = e => {
    const a = rec[e.id] || {};
    const v = window.prompt('Note for ' + e.name + ':', a.note || ''); if (v === null) return;
    send({ emp: e.id, status: attStatus(a), note: v.trim() });
  };
  const exportDay = () => saveCsv('attendance-' + date + '.csv', [['Employee', 'Emp ID', 'Date', 'Status', 'Clock In', 'Clock Out', 'OT hours', 'Fine hours', 'Note', 'In location', 'Out location']].concat(d.employees.map(e => { const a = rec[e.id] || {}; return [e.name, e.emp_id || '', date, attStatus(a) || 'not marked', a.clock_in || '', a.clock_out || '', a.ot_hours || 0, a.fine_hours || 0, a.note || '', a.in_addr || (a.in_lat ? a.in_lat + ',' + a.in_lng : ''), a.out_addr || (a.out_lat ? a.out_lat + ',' + a.out_lng : '')]; })));
  const exportRegister = async () => { try { saveBlob(await ReportModel.download('attendance-register', { month: date.slice(0, 7) }), 'attendance-register-' + date.slice(0, 7) + '.csv'); } catch (err) { toast(err.message); } };

  const stLabel = (a, l) => {
    const st = attStatus(a);
    if (st) return <span className="st" style={{ color: { present: 'var(--ok)', half: 'var(--warn)', absent: 'var(--danger)', leave: 'var(--info)' }[st] }}>{ATT[st][1]}{a.clock_in ? <> · in {a.clock_in} <GeoLink lat={a.in_lat} lng={a.in_lng} addr={a.in_addr || 'map'} /></> : null}{a.clock_out ? <> · out {a.clock_out} <GeoLink lat={a.out_lat} lng={a.out_lng} addr={a.out_addr || 'map'} /></> : null}{Number(a.ot_hours) ? ' · OT ' + a.ot_hours + 'h' : ''}{Number(a.fine_hours) ? ' · Fine ' + a.fine_hours + 'h' : ''}</span>;
    if (l) return <span className="st" style={{ color: 'var(--info)' }}>On leave ({l.reason || ''})</span>;
    return <span className="st" style={{ color: 'var(--danger)' }}>Not Marked</span>;
  };

  return (
    <>
      <div className="page-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Link href="/dashboard" className="back" aria-label="Back">‹</Link><div><h1>Attendance Summary</h1><p>Mark and review attendance by day</p></div></div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', fontSize: 13 }}><LinkBtn onClick={exportDay}>Daily Report ⤓</LinkBtn><LinkBtn onClick={exportRegister}>Month register ⤓</LinkBtn><LinkBtn href="/payroll">Payroll →</LinkBtn></div>
      </div>
      <div className="content">
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Sq onClick={() => shift(-1)} style={{ height: 34, width: 34 }}>‹</Sq><input type="date" value={date} max={todayISO()} onChange={e => { if (e.target.value && e.target.value <= todayISO()) setDate(e.target.value); }} style={{ height: 34, width: 160, fontSize: 12.5, borderRadius: 100 }} /><Sq onClick={() => shift(1)} style={{ height: 34, width: 34, opacity: isToday ? 0.4 : 1 }}>›</Sq>{!isToday && <LinkBtn onClick={() => setDate(todayISO())}>Today</LinkBtn>}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Seg items={[['all', 'All staff'], ['me', 'Me']]} value={tab} onChange={setTab} /><Chip tone={unmarked <= 0 ? 'gr' : 'or'}>{unmarked <= 0 ? '✓ All marked' : unmarked + ' unmarked'}</Chip></div>
          </div>
          <div className="sum" style={{ borderTop: '1px solid var(--line)' }}><div><span>Total Staff</span><b>{d.employees.length}</b></div><div><span>Present</span><b style={{ color: 'var(--ok)' }}>{cnt('present')}</b></div><div><span>Absent</span><b style={{ color: 'var(--danger)' }}>{cnt('absent')}</b></div><div><span>Half Day</span><b>{cnt('half')}</b></div><div><span>Overtime</span><b>{hrs(ot)}</b></div><div><span>Fine hours</span><b>{hrs(fine)}</b></div><div><span>Leave</span><b>{leaveCount}</b></div><div><span>Punched In</span><b>{punchedIn}</b></div><div><span>Punched Out</span><b>{punchedOut}</b></div></div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}><button className="date-btn" onClick={() => modals.open('leave')}>☂ Leaves</button><button className="date-btn" onClick={() => modals.open('payment', null, { type: 'Fine' })}>₹ Fine</button><Search value={q} onChange={setQ} placeholder="Search staff by name, phone or ID" style={{ flex: 1, minWidth: 220, maxWidth: 380 }} /></div>
        {Object.keys(groups).sort().map(g => (
          <div key={g}>
            <div className="group-h">{g} <span className="n">{groups[g].length}</span></div>
            <div className="panel">
              {groups[g].map(e => { const a = rec[e.id], l = lv(e), st = attStatus(a); return (
                <div className="att-line" key={e.id}>
                  <div className="who"><Avatar e={e} cls="" /><div><b>{e.name}</b> <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 6 }}>{e.emp_id || ''}</span><small>{stLabel(a, l)}</small><div className="links"><LinkBtn onClick={() => notePrompt(e)}>{a && a.note ? 'Note: ' + a.note : 'Add Note'}</LinkBtn><span style={{ color: 'var(--muted)' }}>–</span><LinkBtn onClick={() => modals.open('attendance', null, { row: a, after: load })}>{a ? 'Edit' : 'Logs'}</LinkBtn></div></div></div>
                  <div className="att-mark">
                    {Object.entries(ATT).map(([k, [c, l2, cls]]) => <button key={k} className={st === k ? 'on ' + cls : ''} onClick={() => mark(e, k)}><b>{c}</b>{l2}</button>)}
                    <button className={a && Number(a.fine_hours) ? 'on pk' : ''} onClick={() => hoursPrompt(e, 'fine_hours')}><b>F</b>Fine{a && Number(a.fine_hours) ? ' ' + a.fine_hours + 'h' : ''}</button>
                    <button className={a && Number(a.ot_hours) ? 'on gr' : ''} onClick={() => hoursPrompt(e, 'ot_hours')}><b>OT</b>Overtime{a && Number(a.ot_hours) ? ' ' + a.ot_hours + 'h' : ''}</button>
                  </div>
                </div>
              ); })}
            </div>
          </div>
        ))}
        {!emps.length && <div className="panel"><Empty>No staff match</Empty></div>}
        <div className="panel"><Pager pager={pager} /></div>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>Showing {fmtDY(date)}. Staff clock in themselves with GPS; admins can adjust status, overtime, fines and notes here.</p>
      </div>
    </>
  );
}
