'use client';
// Authenticated application shell: sidebar, topbar (clock, quick actions, user menu), mobile bottom nav + sheet.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/controllers/AuthController';
import { useData } from '@/controllers/DataController';
import { useUi } from '@/controllers/UiController';
import { useClock } from '@/controllers/useClock';
import { useModals } from '@/controllers/useModals';
import { Icon } from '@/views/ui/Icons';
import { Avatar } from '@/views/ui';

export const NAV = [
  ['dashboard', 'Dashboard', 'grid'], ['staff', 'Staff', 'users'], ['projects', 'Projects', 'brief'], ['tasks', 'Tasks', 'check'],
  ['departments', 'Departments', 'build'], ['payments', 'Payments', 'file'], ['payroll', 'Payroll', 'tasks'], ['reports', 'Reports', 'chart'],
  ['alerts', 'Alerts', 'alert'], ['notifications', 'Notifications', 'bell'], ['files', 'Files', 'folder'], ['settings', 'Settings', 'dots']
];

export function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, logout, isAdmin } = useAuth();
  const { activity, error } = useData();
  const { toast } = useUi();
  const clock = useClock();
  const modals = useModals();
  const [menu, setMenu] = useState(''); // 'qa' | 'user' | ''
  const [sheet, setSheet] = useState(false);
  const current = (pathname || '').split('/')[1] || 'dashboard';

  useEffect(() => { setMenu(''); setSheet(false); }, [pathname]);
  useEffect(() => {
    const close = e => { if (!e.target.closest('.menu') && !e.target.closest('[data-menu-btn]')) setMenu(''); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const quick = [
    ['task', 'check', 'Add task'], ['project', 'brief', 'Add project'], ['employee', 'users', 'Add staff'], ['dept', 'build', 'Add department'],
    ['leave', 'leaf', 'Apply leave'], ['payment', 'file', 'Add payment'], ['file', 'file', 'Upload file']
  ];

  return (
    <div className="app" style={{ display: 'grid' }}>
      <aside className="side">
        <div className="side-logo">
          <Link href="/dashboard" className="brand" style={{ textDecoration: 'none' }}><img src="/logo.png" alt="limelight" width="3096" height="774" /></Link>
        </div>
        <nav className="nav">
          {NAV.map(([key, label, icon]) => (
            <Link key={key} href={'/' + key} className={current === key ? 'active' : ''} style={{ textDecoration: 'none' }}><Icon name={icon} /><span>{label}</span></Link>
          ))}
        </nav>
        <div className="side-mascot" aria-hidden="true"><svg><use href="#i-mascot" /></svg></div>
      </aside>

      <div className="main">
        <header className="topbar">
          <svg className="mark"><use href="#i-mark" /></svg>
          <span className={'sync ' + (error ? 'err' : 'on')}><i></i><span>{error ? 'Connection problem' : 'Live · Limelight API'}</span></span>
          <div className="tb-split">
            <button className="tb-btn" onClick={clock.act} disabled={clock.busy}><Icon name="clock" /><span className="tb-text">{clock.label}</span></button>
            <button className="tb-btn" aria-label="Open attendance" onClick={() => router.push('/attendance')}><Icon name="chev" /></button>
          </div>
          <div className="rel">
            <button className="tb-btn solid" data-menu-btn onClick={() => setMenu(m => (m === 'qa' ? '' : 'qa'))} aria-haspopup="true" aria-expanded={menu === 'qa'}><span className="tb-text">Quick Actions</span><Icon name="chev" /></button>
            <div className={'menu' + (menu === 'qa' ? ' open' : '')}>
              {quick.map(([kind, icon, label]) => <button key={kind} onClick={() => { setMenu(''); modals.open(kind); }}><Icon name={icon} />{label}</button>)}
            </div>
          </div>
          <Link href="/notifications" className="tb-btn tb-icon rel" aria-label="Notifications"><Icon name="bell" /><span className="badge" hidden={!activity.unread}>{activity.unread}</span></Link>
          <div className="rel">
            <button className="tb-btn tb-avatar" data-menu-btn onClick={() => setMenu(m => (m === 'user' ? '' : 'user'))} aria-haspopup="true"><Avatar e={me} cls="" /><Icon name="chev" /></button>
            <div className={'menu' + (menu === 'user' ? ' open' : '')}>
              <div style={{ padding: '8px 12px 6px', fontSize: 12, color: 'var(--muted)' }}>{me && me.email}<br /><span className="chip pu" style={{ marginTop: 6 }}>{isAdmin ? 'Admin' : 'Staff'}</span></div>
              <hr />
              <button onClick={() => router.push('/attendance')}><Icon name="clock" />My attendance</button>
              <button onClick={() => router.push('/settings')}><Icon name="dots" />Settings</button>
              <button onClick={() => { logout(); toast('Logged out.'); router.replace('/login'); }}><Icon name="logout" />Logout</button>
            </div>
          </div>
        </header>

        <section className="screen active">{children}</section>

        <nav className="bnav" aria-label="Main">
          <Link href="/dashboard" className={current === 'dashboard' ? 'active' : ''}><Icon name="grid" /><span>Home</span></Link>
          <Link href="/attendance" className={current === 'attendance' ? 'active' : ''}><Icon name="cal" /><span>Attendance</span></Link>
          <button className={'bnav-clock ' + (clock.state === 'in' ? 'out' : clock.state === 'done' ? 'done' : '') + (clock.busy ? ' busy' : '')} onClick={clock.act}><span className="ring"><Icon name="clock" /></span><span>{clock.label}</span></button>
          <Link href="/tasks" className={current === 'tasks' ? 'active' : ''}><Icon name="check" /><span>Tasks</span></Link>
          <button className={sheet ? 'active' : ''} onClick={() => setSheet(s => !s)}><Icon name="dots" /><span>More</span></button>
        </nav>
        <div className="bsheet" hidden={!sheet} onClick={e => { if (e.target === e.currentTarget) setSheet(false); }}>
          <div className="bsheet-in">
            <div className="bsheet-h">Menu <button className="mini-btn" onClick={() => setSheet(false)} aria-label="Close">✕</button></div>
            <div className="bsheet-grid">
              {NAV.filter(([k]) => !['dashboard', 'attendance', 'tasks'].includes(k)).map(([key, label, icon]) => (
                <Link key={key} href={'/' + key} className={current === key ? 'active' : ''} style={{ textDecoration: 'none' }}><Icon name={icon} />{label}</Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
