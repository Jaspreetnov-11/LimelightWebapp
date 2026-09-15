'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/controllers/AuthController';
import { useUi } from '@/controllers/UiController';
import { useData } from '@/controllers/DataController';
import { SalarySlipModel, PaymentModel } from '@/models';
import { Chip } from '@/views/ui';
import { Icon } from '@/views/ui/Icons';
import { inr, fmtD } from '@/lib/format';

function formatMonthLabel(monthStr) {
  if (!monthStr) return '';
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function getMonthDateRange(monthStr) {
  if (!monthStr) return '';
  const [y, m] = monthStr.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const fDay = String(first.getDate()).padStart(2, '0');
  const lDay = String(last.getDate()).padStart(2, '0');
  const mName = first.toLocaleDateString('en-GB', { month: 'long' });
  return `${fDay} ${mName} ${y} - ${lDay} ${mName} ${y}`;
}

export function inrToWords(amount) {
  const num = Math.round(Number(amount) || 0);
  if (num === 0) return 'Zero Rupees Only';

  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n) {
    if (n < 20) return a[n];
    return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
  }

  function convertThreeDigits(n) {
    if (n === 0) return '';
    if (n < 100) return convertTwoDigits(n);
    return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convertTwoDigits(n % 100) : '');
  }

  let words = '';
  const crore = Math.floor(num / 10000000);
  let remainder = num % 10000000;
  const lakh = Math.floor(remainder / 100000);
  remainder = remainder % 100000;
  const thousand = Math.floor(remainder / 1000);
  const hundredPart = remainder % 1000;

  if (crore > 0) words += convertTwoDigits(crore) + ' Crore ';
  if (lakh > 0) words += convertTwoDigits(lakh) + ' Lakh ';
  if (thousand > 0) words += convertTwoDigits(thousand) + ' Thousand ';
  if (hundredPart > 0) words += convertThreeDigits(hundredPart);

  return words.trim() + ' Rupees Only';
}

export function StaffSalarySlip({ employee, onNavigateToOverview, onNavigateToStructure, initialMonth }) {
  const { isAdmin } = useAuth();
  const { toast, confirm } = useUi();
  const d = useData();

  const currentYear = new Date().getFullYear();
  const fyList = [
    `FY ${currentYear}-${currentYear + 1}`,
    `FY ${currentYear - 1}-${currentYear}`,
    `FY ${currentYear - 2}-${currentYear - 1}`
  ];

  const [selectedFY, setSelectedFY] = useState(fyList[0]);
  const [slips, setSlips] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth || '');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const fetchSlips = useCallback(async () => {
    if (!employee?.id) return;
    setLoading(true);
    try {
      const fyRaw = selectedFY.replace('FY ', '');
      const res = await SalarySlipModel.list(employee.id, fyRaw);
      const list = (res && res.slips) || [];
      setSlips(list);
      if (list.length > 0) {
        if (!selectedMonth || !list.some(s => s.month === selectedMonth)) {
          setSelectedMonth(list[0].month);
        }
      }
    } catch (err) {
      toast(err.message || 'Failed to fetch salary slips');
    } finally {
      setLoading(false);
    }
  }, [employee?.id, selectedFY, selectedMonth, toast]);

  useEffect(() => {
    fetchSlips();
  }, [fetchSlips]);

  useEffect(() => {
    if (initialMonth) setSelectedMonth(initialMonth);
  }, [initialMonth]);

  const currentSlip = useMemo(() => {
    return slips.find(s => s.month === selectedMonth) || slips[0] || null;
  }, [slips, selectedMonth]);

  const isPaid = currentSlip && (currentSlip.status === 'paid' || Number(currentSlip.due_amount) === 0);
  const isPartiallyPaid = currentSlip && !isPaid && Number(currentSlip.paid_amount) > 0;
  const statusTone = isPaid ? 'gr' : isPartiallyPaid ? 'or' : 'pk';
  const statusText = isPaid ? 'Paid' : isPartiallyPaid ? 'Partially Paid' : 'Pending';

  const handleGenerate = async () => {
    if (!isAdmin) {
      toast('Only administrators can generate or recalculate salary slips.');
      return;
    }
    if (!selectedMonth) {
      toast('Please select a month to generate.');
      return;
    }
    setGenerating(true);
    try {
      await SalarySlipModel.generate({
        emp: employee.id,
        month: selectedMonth
      });
      toast(`Salary slip for ${formatMonthLabel(selectedMonth)} finalized & saved.`);
      await fetchSlips();
    } catch (err) {
      toast(err.message || 'Failed to generate salary slip');
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!isAdmin || !currentSlip) return;
    const ok = await confirm({
      title: 'Settle Salary Slip',
      message: `Record full salary payment for ${formatMonthLabel(currentSlip.month)}?`,
      sub: `Due amount of ${inr(currentSlip.due_amount)} will be recorded in the payments ledger.`,
      okText: 'Confirm & Settle',
      cancelText: 'Cancel'
    });
    if (!ok) return;

    try {
      await PaymentModel.create({
        emp: employee.id,
        date: new Date().toISOString().slice(0, 10),
        amount: currentSlip.due_amount,
        type: 'Salary',
        note: `Salary settlement for ${formatMonthLabel(currentSlip.month)}`
      });
      await SalarySlipModel.update(currentSlip.id, {
        status: 'paid',
        paid_amount: currentSlip.net_payable,
        due_amount: 0
      });
      toast(`Salary for ${formatMonthLabel(currentSlip.month)} marked as Paid.`);
      await d.reload('payments');
      await fetchSlips();
    } catch (err) {
      toast(err.message || 'Failed to settle salary');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const slipNumber = currentSlip
    ? `LL-SLIP-${currentSlip.month.replace('-', '')}-${(employee.emp_id || employee.id.slice(0, 5)).toUpperCase()}`
    : '—';

  return (
    <div className="salary-slip-screen" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Print Stylesheet */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @media print {
          body * {
            visibility: hidden !important;
          }
          #salary-slip-printable, #salary-slip-printable * {
            visibility: visible !important;
          }
          #salary-slip-printable {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 800px !important;
            margin: 0 auto !important;
            padding: 30px !important;
            background: #FFFFFF !important;
            color: #111111 !important;
            border: 1px solid #333333 !important;
            border-radius: 0 !important;
            box-shadow: none !important;
          }
          #salary-slip-printable .slip-gold {
            color: #B45309 !important;
          }
          #salary-slip-printable .slip-muted {
            color: #4B5563 !important;
          }
          #salary-slip-printable .slip-panel {
            background: #F9FAFB !important;
            border: 1px solid #E5E7EB !important;
            color: #111111 !important;
          }
          #salary-slip-printable .slip-row-border {
            border-color: #E5E7EB !important;
          }
          #salary-slip-printable th {
            background: #F3F4F6 !important;
            color: #111111 !important;
            border-bottom: 2px solid #D1D5DB !important;
          }
          #salary-slip-printable td {
            border-bottom: 1px solid #E5E7EB !important;
            color: #111111 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}} />

      {/* Top Controls Bar */}
      <div className="no-print" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
        padding: '14px 18px',
        background: 'var(--panel)',
        borderRadius: 'var(--radius-field, 14px)',
        border: '1px solid var(--line-soft)'
      }}>
        {/* Month Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>Period:</span>
            <select
              value={selectedFY}
              onChange={(e) => setSelectedFY(e.target.value)}
              style={{
                background: 'var(--bg-2)',
                border: '1px solid var(--line)',
                color: 'var(--text)',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 13,
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {fyList.map(fy => (
                <option key={fy} value={fy}>{fy}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>Salary Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                background: 'var(--bg-2)',
                border: '1px solid var(--line)',
                color: 'var(--accent)',
                borderRadius: 8,
                padding: '6px 14px',
                fontSize: 13.5,
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {slips.map(s => (
                <option key={s.month} value={s.month}>
                  {formatMonthLabel(s.month)} {s.is_generated ? '✓' : '(Preview)'}
                </option>
              ))}
            </select>
          </div>

          {currentSlip && (
            <Chip tone={statusTone}>
              {statusText}
            </Chip>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {onNavigateToOverview && (
            <button
              type="button"
              className="tb-btn"
              onClick={onNavigateToOverview}
              style={{ height: 36, padding: '0 14px', fontSize: 13 }}
            >
              ‹ Salary Overview
            </button>
          )}

          {onNavigateToStructure && (
            <button
              type="button"
              className="tb-btn"
              onClick={onNavigateToStructure}
              style={{ height: 36, padding: '0 14px', fontSize: 13 }}
            >
              Edit Structure
            </button>
          )}

          {isAdmin && (
            <button
              type="button"
              className="tb-btn"
              disabled={generating || !selectedMonth}
              onClick={handleGenerate}
              style={{ height: 36, padding: '0 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Icon name="spark" size={14} />
              {generating ? 'Finalizing...' : currentSlip?.is_generated ? 'Recalculate Slip' : 'Finalize & Save Slip'}
            </button>
          )}

          {isAdmin && currentSlip && currentSlip.due_amount > 0 && (
            <button
              type="button"
              className="tb-btn solid"
              onClick={handleMarkAsPaid}
              style={{ height: 36, padding: '0 14px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Icon name="check" size={14} />
              Mark as Paid
            </button>
          )}

          <button
            type="button"
            className="tb-btn solid"
            disabled={!currentSlip}
            onClick={handlePrint}
            style={{ height: 36, padding: '0 16px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="file" size={14} />
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Main Payslip Container */}
      {loading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--muted)' }}>
          Loading salary slip...
        </div>
      ) : !currentSlip ? (
        <div className="panel" style={{ padding: 40, textAlign: 'center' }}>
          <Icon name="cal" size={36} style={{ color: 'var(--dim)', marginBottom: 12 }} />
          <h4 style={{ margin: '0 0 6px', fontSize: 16 }}>No Salary Slip Available</h4>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
            No salary records exist for this period. Click &quot;Salary Overview&quot; to backfill or generate months.
          </p>
        </div>
      ) : (
        <div
          id="salary-slip-printable"
          style={{
            background: 'var(--card-2, #121214)',
            border: '1px solid var(--line-strong, rgba(255,255,255,0.14))',
            borderRadius: 'var(--radius-card, 22px)',
            boxShadow: 'var(--shadow-card)',
            padding: '36px 40px',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Subtle Watermark Branding in Background */}
          <div style={{
            position: 'absolute',
            right: 20,
            bottom: 20,
            pointerEvents: 'none',
            opacity: 0.03,
            fontSize: 120,
            fontWeight: 900,
            userSelect: 'none',
            letterSpacing: -4
          }}>
            LIMELIGHT
          </div>

          {/* Studio Header & Payslip Title */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '2px solid var(--line-soft)',
            paddingBottom: 22,
            marginBottom: 24,
            flexWrap: 'wrap',
            gap: 16
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'var(--accent)',
                  color: '#0A0A0B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: 17
                }}>
                  L
                </div>
                <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>
                  LIMELIGHT STUDIO
                </h1>
              </div>
              <div className="slip-muted" style={{ fontSize: 12.5, color: 'var(--muted)' }}>
                Professional Creative Studio & Production House
              </div>
              <div className="slip-muted" style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>
                Private & Confidential Monthly Salary Slip
              </div>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div style={{
                display: 'inline-block',
                background: isPaid ? 'rgba(74,222,149,0.12)' : 'rgba(255,184,77,0.12)',
                color: isPaid ? 'var(--ok, #4ADE95)' : 'var(--warn, #FFB84D)',
                border: `1px solid ${isPaid ? 'rgba(74,222,149,0.3)' : 'rgba(255,184,77,0.3)'}`,
                padding: '4px 12px',
                borderRadius: 100,
                fontSize: 12,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 6
              }}>
                • {currentSlip.status.toUpperCase()}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                {formatMonthLabel(currentSlip.month)}
              </div>
              <div className="slip-muted" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                Pay Period: {getMonthDateRange(currentSlip.month)}
              </div>
              <div className="slip-muted" style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2 }}>
                Ref: <span style={{ fontFamily: 'monospace' }}>{slipNumber}</span>
              </div>
            </div>
          </div>

          {/* Employee Information Card */}
          <div className="slip-panel" style={{
            background: 'var(--field, rgba(255,255,255,0.03))',
            border: '1px solid var(--line-soft)',
            borderRadius: 14,
            padding: '16px 20px',
            marginBottom: 24
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '14px 20px',
              fontSize: 13
            }}>
              <div>
                <span className="slip-muted" style={{ color: 'var(--muted)', display: 'block', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Employee Name
                </span>
                <b style={{ color: 'var(--text)', fontSize: 14.5 }}>{employee.name}</b>
              </div>

              <div>
                <span className="slip-muted" style={{ color: 'var(--muted)', display: 'block', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Employee ID / Code
                </span>
                <b style={{ color: 'var(--accent)', fontSize: 14, fontFamily: 'monospace' }}>
                  {employee.emp_id || 'LH0000'}
                </b>
              </div>

              <div>
                <span className="slip-muted" style={{ color: 'var(--muted)', display: 'block', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Designation / Role
                </span>
                <b style={{ color: 'var(--text)' }}>{employee.role || '—'}</b>
              </div>

              <div>
                <span className="slip-muted" style={{ color: 'var(--muted)', display: 'block', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Department
                </span>
                <b style={{ color: 'var(--text)' }}>{employee.dept || '—'}</b>
              </div>

              <div>
                <span className="slip-muted" style={{ color: 'var(--muted)', display: 'block', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Date of Joining
                </span>
                <span style={{ color: 'var(--text)' }}>{fmtD(employee.joined)}</span>
              </div>

              <div>
                <span className="slip-muted" style={{ color: 'var(--muted)', display: 'block', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Working Shift
                </span>
                <span style={{ color: 'var(--text)' }}>
                  {employee.shift === 'evening' ? '2:00 PM – 10:00 PM' : '11:00 AM – 7:00 PM'}
                </span>
              </div>

              <div>
                <span className="slip-muted" style={{ color: 'var(--muted)', display: 'block', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Payable Days
                </span>
                <b style={{ color: 'var(--ok, #4ADE95)' }}>
                  {currentSlip.payable_days} Days
                </b>
              </div>

              <div>
                <span className="slip-muted" style={{ color: 'var(--muted)', display: 'block', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Payment Method
                </span>
                <span style={{ color: 'var(--text)' }}>Bank Transfer / Cash</span>
              </div>
            </div>
          </div>

          {/* Earnings & Deductions Tables (Side by Side) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 24,
            marginBottom: 24
          }}>
            {/* Left: Earnings Table */}
            <div style={{
              border: '1px solid var(--line-soft)',
              borderRadius: 14,
              overflow: 'hidden',
              background: 'var(--field, rgba(255,255,255,0.02))'
            }}>
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                padding: '12px 16px',
                borderBottom: '1px solid var(--line-soft)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <b style={{ fontSize: 13.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text)' }}>
                  Earnings
                </b>
                <span className="slip-muted" style={{ fontSize: 12, color: 'var(--muted)' }}>Amount (INR)</span>
              </div>

              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(currentSlip.earnings_breakdown || []).map((e, idx) => (
                  <div key={idx} className="slip-row-border" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13.5,
                    paddingBottom: 8,
                    borderBottom: '1px dashed var(--line-soft)'
                  }}>
                    <span style={{ color: 'var(--text)' }}>{e.name}</span>
                    <span style={{ fontWeight: 600, color: 'var(--t1)' }}>{inr(e.amount)}</span>
                  </div>
                ))}
              </div>

              <div style={{
                background: 'rgba(74,222,149,0.08)',
                padding: '12px 16px',
                borderTop: '1px solid var(--line-soft)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontWeight: 700,
                fontSize: 14,
                color: 'var(--ok, #4ADE95)'
              }}>
                <span>Gross Earnings</span>
                <span>{inr(currentSlip.gross_earnings)}</span>
              </div>
            </div>

            {/* Right: Deductions Table */}
            <div style={{
              border: '1px solid var(--line-soft)',
              borderRadius: 14,
              overflow: 'hidden',
              background: 'var(--field, rgba(255,255,255,0.02))'
            }}>
              <div style={{
                background: 'rgba(255,255,255,0.05)',
                padding: '12px 16px',
                borderBottom: '1px solid var(--line-soft)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <b style={{ fontSize: 13.5, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text)' }}>
                  Deductions
                </b>
                <span className="slip-muted" style={{ fontSize: 12, color: 'var(--muted)' }}>Amount (INR)</span>
              </div>

              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(currentSlip.deductions_breakdown || []).map((dItem, idx) => (
                  <div key={idx} className="slip-row-border" style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 13.5,
                    paddingBottom: 8,
                    borderBottom: '1px dashed var(--line-soft)'
                  }}>
                    <span style={{ color: 'var(--text)' }}>{dItem.name}</span>
                    <span style={{ fontWeight: 600, color: 'var(--t1)' }}>{inr(dItem.amount)}</span>
                  </div>
                ))}
              </div>

              <div style={{
                background: 'rgba(255,92,122,0.08)',
                padding: '12px 16px',
                borderTop: '1px solid var(--line-soft)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontWeight: 700,
                fontSize: 14,
                color: 'var(--danger, #FF5C7A)'
              }}>
                <span>Total Deductions</span>
                <span>{inr(currentSlip.total_deductions)}</span>
              </div>
            </div>
          </div>

          {/* Net Payable Highlight Banner */}
          <div className="slip-panel" style={{
            background: 'linear-gradient(135deg, rgba(255,210,31,0.08) 0%, rgba(20,20,23,0.8) 100%)',
            border: '1.5px solid var(--accent-line, rgba(255,210,31,0.35))',
            borderRadius: 16,
            padding: '20px 24px',
            marginBottom: 24
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
              marginBottom: 12
            }}>
              <div>
                <span className="slip-muted" style={{ fontSize: 12.5, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Net Salary Payable (Gross Earnings - Total Deductions)
                </span>
                <div className="slip-gold" style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent, #FFD21F)', marginTop: 4 }}>
                  {inr(currentSlip.net_payable)}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                  <span className="slip-muted" style={{ fontSize: 11.5, color: 'var(--muted)', display: 'block' }}>Advance Deducted</span>
                  <b style={{ fontSize: 14, color: 'var(--warn, #FFB84D)' }}>{inr(currentSlip.advance_payments || 0)}</b>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span className="slip-muted" style={{ fontSize: 11.5, color: 'var(--muted)', display: 'block' }}>Net Balance Due</span>
                  <b style={{
                    fontSize: 17,
                    fontWeight: 700,
                    color: currentSlip.due_amount > 0 ? 'var(--danger, #FF5C7A)' : 'var(--ok, #4ADE95)'
                  }}>
                    {inr(currentSlip.due_amount)}
                  </b>
                </div>
              </div>
            </div>

            <div className="slip-row-border" style={{
              borderTop: '1px solid var(--line-soft)',
              paddingTop: 10,
              display: 'flex',
              alignItems: 'baseline',
              gap: 8,
              fontSize: 13
            }}>
              <span className="slip-muted" style={{ color: 'var(--muted)', fontWeight: 500 }}>Amount in Words:</span>
              <b style={{ color: 'var(--text)', fontStyle: 'italic' }}>
                {inrToWords(currentSlip.net_payable)}
              </b>
            </div>
          </div>

          {/* Authorization & Signatures Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 30,
            marginTop: 36,
            paddingTop: 24,
            borderTop: '1px dashed var(--line-strong)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ height: 44 }} />
              <div style={{ borderTop: '1px solid var(--line-strong)', paddingTop: 8 }}>
                <b style={{ fontSize: 13, color: 'var(--text)', display: 'block' }}>{employee.name}</b>
                <span className="slip-muted" style={{ fontSize: 12, color: 'var(--muted)' }}>Employee Signature</span>
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{
                  fontSize: 11,
                  padding: '2px 10px',
                  borderRadius: 100,
                  border: '1px solid rgba(255,210,31,0.4)',
                  color: 'var(--accent)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em'
                }}>
                  Digitally Authenticated
                </span>
              </div>
              <div style={{ borderTop: '1px solid var(--line-strong)', paddingTop: 8 }}>
                <b style={{ fontSize: 13, color: 'var(--text)', display: 'block' }}>Limelight Studio Payroll Authority</b>
                <span className="slip-muted" style={{ fontSize: 12, color: 'var(--muted)' }}>Authorized Signatory</span>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="slip-muted" style={{
            marginTop: 28,
            textAlign: 'center',
            fontSize: 11.5,
            color: 'var(--dim)',
            lineHeight: 1.5
          }}>
            This is a confidential, computer-generated document issued by Limelight Studio. No physical signature is required.
          </div>
        </div>
      )}
    </div>
  );
}
