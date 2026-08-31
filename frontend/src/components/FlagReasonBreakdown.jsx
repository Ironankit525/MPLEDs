import React from 'react';
import { sanitizeFlagsForSubmitter } from '../lib/sanitizedFlags.js';

/**
 * FlagReasonBreakdown aggregates flags across the submitter's submissions
 * and displays a count per user‑friendly reason.
 */
export default function FlagReasonBreakdown({ submissions }) {
  if (!submissions) return null;
  const allFlags = submissions
    .flatMap(s => s.flags || [])
    .map(f => sanitizeFlagsForSubmitter([f])[0]);

  const counts = allFlags.reduce((acc, flag) => {
    const reason = flag.message || flag.code || 'Other';
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {});

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) {
    return <p style={{ color: 'var(--color-muted)' }}>No flagged submissions.</p>;
  }

  return (
    <div className="card" style={{ padding: 12, marginTop: 16 }}>
      <h4>Flag Reasons Breakdown</h4>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 14 }}>
        {entries.map(([reason, count]) => (
          <li key={reason} style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>{reason}</span>
            <span>{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

