'use client';
// Client-side pagination: `usePager(list, pageSize)` slices any array; `<Pager>` renders the controls.
import { useEffect, useMemo, useState } from 'react';

export function usePager(list, initialSize = 10) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(initialSize);
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / size));
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);
  const items = useMemo(() => list.slice((page - 1) * size, page * size), [list, page, size]);
  return { items, page, pages, size, total, setPage, setSize: s => { setSize(s); setPage(1); }, reset: () => setPage(1) };
}

export function Pager({ pager, sizes = [10, 20, 50], compact }) {
  const { page, pages, size, total, setPage, setSize } = pager;
  if (total === 0) return null;
  const from = (page - 1) * size + 1, to = Math.min(total, page * size);
  return (
    <div className={'pager' + (compact ? ' compact' : '')}>
      <span className="pager-info">{from}–{to} of {total}</span>
      <div className="pager-ctl">
        {!compact && <select value={size} onChange={e => setSize(Number(e.target.value))} aria-label="Rows per page">{sizes.map(s => <option key={s} value={s}>{s} / page</option>)}</select>}
        <button type="button" onClick={() => setPage(1)} disabled={page <= 1} aria-label="First page">«</button>
        <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1} aria-label="Previous page">‹</button>
        <span className="pager-page">{page} / {pages}</span>
        <button type="button" onClick={() => setPage(page + 1)} disabled={page >= pages} aria-label="Next page">›</button>
        <button type="button" onClick={() => setPage(pages)} disabled={page >= pages} aria-label="Last page">»</button>
      </div>
    </div>
  );
}
