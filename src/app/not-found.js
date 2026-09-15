import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: 24 }}>
      <h1 style={{ fontSize: 48, fontWeight: 800, margin: '0 0 12px', color: 'var(--accent)' }}>404</h1>
      <h2 style={{ fontSize: 20, margin: '0 0 8px' }}>Page Not Found</h2>
      <p style={{ color: 'var(--muted)', margin: '0 0 24px', maxWidth: 400 }}>
        The page you are looking for does not exist or has been moved.
      </p>
      <Link href="/dashboard" className="date-btn active" style={{ textDecoration: 'none' }}>
        Back to Dashboard
      </Link>
    </div>
  );
}
