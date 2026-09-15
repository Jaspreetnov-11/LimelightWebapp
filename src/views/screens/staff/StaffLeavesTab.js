'use client';

import { useMemo } from 'react';
import { useAuth } from '@/controllers/AuthController';
import { useData } from '@/controllers/DataController';
import { useModals } from '@/controllers/useModals';
import { Chip, Empty } from '@/views/ui';
import { fmtD } from '@/lib/format';

export function StaffLeavesTab({ employee }) {
  const { isAdmin } = useAuth();
  const d = useData();
  const modals = useModals();

  const myLeaves = useMemo(() => {
    return (d.leaves || []).filter(l => l.emp === employee?.id).sort((a, b) => (b.from_date || '').localeCompare(a.from_date || ''));
  }, [d.leaves, employee?.id]);

  const approvedCount = myLeaves.filter(l => l.status === 'approved').length;
  const pendingCount = myLeaves.filter(l => l.status === 'pending').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary Ribbons */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12
      }}>
        <div className="panel" style={{ padding: '16px 20px', textAlign: 'center' }}>
          <span style={{ fontSize: 11.5, color: 'var(--muted)', textTransform: 'uppercase' }}>Total Requests</span>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{myLeaves.length}</div>
        </div>

        <div className="panel" style={{ padding: '16px 20px', textAlign: 'center' }}>
          <span style={{ fontSize: 11.5, color: 'var(--muted)', textTransform: 'uppercase' }}>Approved Leaves</span>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ok, #4ADE95)', marginTop: 4 }}>{approvedCount}</div>
        </div>

        <div className="panel" style={{ padding: '16px 20px', textAlign: 'center' }}>
          <span style={{ fontSize: 11.5, color: 'var(--muted)', textTransform: 'uppercase' }}>Pending Approval</span>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--warn, #FFB84D)', marginTop: 4 }}>{pendingCount}</div>
        </div>
      </div>

      {/* Leaves Table */}
      <div className="panel" style={{ overflow: 'hidden' }}>
        <div className="panel-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Leave Requests ({myLeaves.length})</span>
          <button
            type="button"
            className="tb-btn solid"
            onClick={() => modals.open('leave', null, { emp: employee?.id })}
            style={{ height: 32, padding: '0 14px', fontSize: 12.5 }}
          >
            + Apply Leave
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {myLeaves.length === 0 ? (
            <Empty icon="cal" title="No Leave Requests">
              No leave records found for {employee?.name}.
            </Empty>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Type</th>
                  <th>Reason</th>
                  <th>Status</th>
                  {isAdmin && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {myLeaves.map((l) => {
                  const tone = l.status === 'approved' ? 'gr' : l.status === 'rejected' ? 'pk' : 'or';
                  return (
                    <tr key={l.id}>
                      <td><b>{fmtD(l.from_date)}</b></td>
                      <td><b>{fmtD(l.to_date)}</b></td>
                      <td>
                        <span style={{ textTransform: 'capitalize' }}>
                          {l.kind === 'wfh' ? 'Work From Home' : 'Paid / General Leave'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--muted)' }}>{l.reason || '—'}</td>
                      <td>
                        <Chip tone={tone}>
                          {(l.status || 'Pending').toUpperCase()}
                        </Chip>
                      </td>
                      {isAdmin && (
                        <td>
                          <button
                            type="button"
                            className="tb-btn"
                            onClick={() => modals.open('leave', l.id)}
                            style={{ height: 28, padding: '0 10px', fontSize: 12 }}
                          >
                            Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
