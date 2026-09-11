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

// [key, label, icon, who] — who: 'all' | 'admin'
export const NAV = [
  ['dashboard', 'Home', 'grid', 'all'], ['tasks', 'Tasks', 'check', 'all'], ['projects', 'Projects', 'brief', 'all'], ['attendance', 'Attendance', 'cal', 'all'],
  ['staff', 'Staff', 'users', 'all'], ['departments', 'Departments', 'build', 'all'], ['payroll', 'Payroll', 'tasks', 'admin'], ['payments', 'Payments', 'file', 'admin'],
  ['reports', 'Reports', 'chart', 'admin'], ['notifications', 'Notifications', 'bell', 'all'], ['files', 'Files', 'folder', 'all'], ['settings', 'Settings', 'dots', 'all']
];
const ADMIN_ONLY = new Set(NAV.filter(n => n[3] === 'admin').map(n => n[0]));

export function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { me, logout, isAdmin } = useAuth();
  const { activity, error, canAssign, canCreateProject } = useData();
  const { toast } = useUi();
  const clock = useClock();
  const modals = useModals();
  const [menu, setMenu] = useState(''); // 'qa' | 'user' | ''
  const [sheet, setSheet] = useState(false);
  const current = (pathname || '').split('/')[1] || 'dashboard';

  useEffect(() => { setMenu(''); setSheet(false); }, [pathname]);
  useEffect(() => { if (!isAdmin && ADMIN_ONLY.has(current)) router.replace('/dashboard'); }, [current, isAdmin, router]);
  useEffect(() => {
    const close = e => { if (!e.target.closest('.menu') && !e.target.closest('[data-menu-btn]')) setMenu(''); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const nav = NAV.filter(([, , , who]) => who === 'all' || isAdmin);
  const quick = [
    canAssign && ['task', 'check', 'Assign task'],
    canCreateProject && ['project', 'brief', 'Add project'],
    isAdmin && ['employee', 'users', 'Add staff'],
    isAdmin && ['dept', 'build', 'Add department'],
    ['leave', 'leaf', 'Apply leave'],
    isAdmin && ['payment', 'file', 'Add payment'],
    ['file', 'file', 'Upload file']
  ].filter(Boolean);

  return (
    <div className="app" style={{ display: 'grid' }}>
      <aside className="side">
        <div className="side-logo">
          <Link href="/dashboard" className="brand" style={{ textDecoration: 'none' }}><img src="/logo.png" alt="limelight" width="3096" height="774" /></Link>
        </div>
        <nav className="nav">
          {nav.map(([key, label, icon]) => (
            <Link key={key} href={'/' + key} className={current === key ? 'active' : ''} style={{ textDecoration: 'none' }}><Icon name={icon} /><span>{label}</span>{key === 'notifications' && activity.unread > 0 && <span className="badge" style={{ position: 'static', marginLeft: 'auto' }}>{activity.unread}</span>}</Link>
          ))}
        </nav>
        <div className="side-mascot" aria-hidden="true"><svg><use href="#i-mascot" /></svg></div>
      </aside>

      <div className="main">
        <header className="topbar">
          <svg className="mark"><use href="#i-mark" /></svg>
          <span className={'sync ' + (error ? 'err' : 'on')}><i></i><span>{error ? 'Connection problem' : 'Live · Limelight API'}</span></span>
          <button className="tb-btn" onClick={clock.act} disabled={clock.busy}><Icon name="clock" /><span className="tb-text">{clock.label}</span></button>
          <div className="rel">
            <button className="tb-btn solid" data-menu-btn onClick={() => setMenu(m => (m === 'qa' ? '' : 'qa'))} aria-haspopup="true" aria-expanded={menu === 'qa'} aria-label="Quick actions"><span className="tb-text">Quick Actions</span><span className="tb-plus">+</span><Icon name="chev" /></button>
            <div className={'menu' + (menu === 'qa' ? ' open' : '')}>
              {quick.map(([kind, icon, label]) => <button key={kind} onClick={() => { setMenu(''); modals.open(kind); }}><Icon name={icon} />{label}</button>)}
            </div>
          </div>
          <Link href="/notifications" className="tb-btn tb-icon rel" aria-label="Notifications"><Icon name="bell" /><span className="badge" hidden={!activity.unread}>{activity.unread}</span></Link>
          <div className="rel">
            <button className="tb-btn tb-avatar" data-menu-btn onClick={() => setMenu(m => (m === 'user' ? '' : 'user'))} aria-haspopup="true"><Avatar e={me} cls="" /><Icon name="chev" /></button>
            <div className={'menu' + (menu === 'user' ? ' open' : '')}>
              <div style={{ padding: '8px 12px 6px', fontSize: 12, color: 'var(--muted)' }}>{me && me.name}<br />{me && me.email}<br /><span className="chip pu" style={{ marginTop: 6 }}>{isAdmin ? 'Admin' : me && me.access === 'manager' ? 'Team leader' : 'Staff'}</span></div>
              <hr />
              <button onClick={() => router.push('/settings')}><Icon name="dots" />Settings</button>
              <button onClick={() => { logout(); toast('Logged out.'); router.replace('/login'); }}><Icon name="logout" />Logout</button>
            </div>
          </div>
        </header>

        <section className="screen active">{children}</section>

        <nav className="bnav" aria-label="Main">
          <Link href="/dashboard" className={current === 'dashboard' ? 'active' : ''}><Icon name="grid" /><span>Home</span></Link>
          <Link href="/tasks" className={current === 'tasks' ? 'active' : ''}><Icon name="check" /><span>Tasks</span></Link>
          <button className={'bnav-clock ' + (clock.state === 'in' ? 'out' : clock.state === 'done' ? 'done' : '') + (clock.busy ? ' busy' : '')} onClick={clock.act}><span className="ring"><Icon name="clock" /></span><span>{clock.label}</span></button>
          <Link href="/notifications" className={current === 'notifications' ? 'active' : ''}><Icon name="bell" /><span>Alerts</span></Link>
          <button className={sheet ? 'active' : ''} onClick={() => setSheet(s => !s)}><Icon name="dots" /><span>More</span></button>
        </nav>
        <div className="bsheet" hidden={!sheet} onClick={e => { if (e.target === e.currentTarget) setSheet(false); }}>
          <div className="bsheet-in">
            <div className="bsheet-h">Menu <button className="mini-btn" onClick={() => setSheet(false)} aria-label="Close">✕</button></div>
            <div className="bsheet-grid">
              {nav.filter(([k]) => !['dashboard', 'notifications', 'tasks'].includes(k)).map(([key, label, icon]) => (
                <Link key={key} href={'/' + key} className={current === key ? 'active' : ''} style={{ textDecoration: 'none' }}><Icon name={icon} />{label}</Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
