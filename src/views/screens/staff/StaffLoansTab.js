'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/controllers/AuthController';
import { useUi } from '@/controllers/UiController';
import { useData } from '@/controllers/DataController';
import { PaymentModel, SalarySlipModel } from '@/models';
import { Chip, Empty } from '@/views/ui';
import { Icon } from '@/views/ui/Icons';
import { inr, fmtD } from '@/lib/format';

export function StaffLoansTab({ employee }) {
  const { isAdmin } = useAuth();
  const { toast } = useUi();
  const d = useData();

  const [payments, setPayments] = useState([]);
  const [slips, setSlips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    if (!employee?.id) return;
    setLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([
        PaymentModel.list({ empId: employee.id }),
        SalarySlipModel.list(employee.id)
      ]);
      setPayments(pRes?.data || []);
      setSlips(sRes?.slips || []);
    } catch (err) {
      toast(err.message || 'Failed to load loans/advances');
    } finally {
      setLoading(false);
    }
  }, [employee?.id, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter only Advance payments
  const advancePayments = useMemo(() => {
    return payments.filter(p => (p.type || '').toLowerCase() === 'advance');
  }, [payments]);

  const totalAdvanceTaken = useMemo(() => {
    return advancePayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  }, [advancePayments]);

  const totalRecovered = useMemo(() => {
    return slips.reduce((sum, s) => sum + (Number(s.advance_payments) || 0), 0);
  }, [slips]);

  const pendingBalance = Math.max(0, totalAdvanceTaken - totalRecovered);

  const handleAddAdvance = async (e) => {
    e.preventDefault();
    const val = Number(amount);
    if (!val || val <= 0) {
      toast('Please enter a valid amount');
      return;
    }
    setBusy(true);
    try {
      await PaymentModel.create({
        emp: employee.id,
        amount: val,
        date: date || new Date().toISOString().slice(0, 10),
        type: 'Advance',
        note: note.trim() || 'Advance loan issued'
      });
      toast(`Advance of ${inr(val)} recorded for ${employee.name}.`);
      setShowAddModal(false);
      setAmount('');
      setNote('');
      await d.reload('payments');
      await loadData();
    } catch (err) {
      toast(err.message || 'Failed to record advance');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Overview Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12
      }}>
        <div className="panel" style={{ padding: '16px 20px' }}>
          <span style={{ fontSize: 11.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Advances Taken
          </span>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--warn, #FFB84D)', marginTop: 4 }}>
            {inr(totalAdvanceTaken)}
          </div>
        </div>

        <div className="panel" style={{ padding: '16px 20px' }}>
          <span style={{ fontSize: 11.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Total Recovered / Deducted
          </span>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ok, #4ADE95)', marginTop: 4 }}>
            {inr(totalRecovered)}
          </div>
        </div>

        <div className="panel" style={{ padding: '16px 20px' }}>
          <span style={{ fontSize: 11.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Outstanding Balance
          </span>
          <div style={{ fontSize: 22, fontWeight: 700, color: pendingBalance > 0 ? 'var(--danger, #FF5C7A)' : 'var(--accent, #FFD21F)', marginTop: 4 }}>
            {inr(pendingBalance)}
          </div>
        </div>
      </div>

      {/* Advance Payments History */}
      <div className="panel" style={{ overflow: 'hidden' }}>
        <div className="panel-h" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Advance & Loan Records ({advancePayments.length})</span>
          {isAdmin && (
            <button
              type="button"
              className="tb-btn solid"
              onClick={() => setShowAddModal(true)}
              style={{ height: 32, padding: '0 14px', fontSize: 12.5 }}
            >
              + Issue Advance
            </button>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)' }}>
              Loading advance records...
            </div>
          ) : advancePayments.length === 0 ? (
            <Empty icon="file" title="No Advances Recorded">
              No salary advances or loans recorded for {employee.name}.
            </Empty>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Purpose / Note</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {advancePayments.map((p) => (
                  <tr key={p.id}>
                    <td><b>{fmtD(p.date)}</b></td>
                    <td><Chip tone="or">Advance</Chip></td>
                    <td><b className="money">{inr(p.amount)}</b></td>
                    <td style={{ color: 'var(--muted)' }}>{p.note || 'Advance payment'}</td>
                    <td>
                      <Chip tone={pendingBalance === 0 ? 'gr' : 'or'}>
                        {pendingBalance === 0 ? 'Settled' : 'Active'}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Advance Modal */}
      {showAddModal && (
        <div className="scrim open" onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }} role="presentation">
          <div className="dialog" role="dialog" aria-modal="true" style={{ maxWidth: 440 }}>
            <h2 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 600 }}>Issue Advance / Loan</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 16px' }}>
              Record an advance payment given to {employee.name}. This will be tracked against future monthly salary slips.
            </p>

            <form onSubmit={handleAddAdvance} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', marginBottom: 6, display: 'block' }}>
                  Amount (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 5000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--field)',
                    border: '1px solid var(--line)',
                    color: 'var(--text)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 14,
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', marginBottom: 6, display: 'block' }}>
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--field)',
                    border: '1px solid var(--line)',
                    color: 'var(--text)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 14,
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', marginBottom: 6, display: 'block' }}>
                  Note / Reason
                </label>
                <input
                  type="text"
                  placeholder="e.g. Emergency advance, Festival advance"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'var(--field)',
                    border: '1px solid var(--line)',
                    color: 'var(--text)',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 14,
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  className="tb-btn"
                  onClick={() => setShowAddModal(false)}
                  style={{ height: 36, padding: '0 16px', fontSize: 13 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="tb-btn solid"
                  disabled={busy}
                  style={{ height: 36, padding: '0 18px', fontSize: 13 }}
                >
                  {busy ? 'Saving...' : 'Save Advance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
