import React, { useMemo } from 'react';
import { formatDuration } from '../services/utils';
import './Modal.css';

function TaskOccurrencesModal({ task, occurrences, loading, range, onClose }) {
  const title = task?.name ? `Details: ${task.name}` : 'Task Details';

  const total = occurrences?.length || 0;

  // Calculate grand total time across all occurrences
  const grandTotalTime = useMemo(() => {
    return (occurrences || []).reduce((sum, o) => sum + (o.totalTime || 0), 0);
  }, [occurrences]);

  const statusLabel = (s) => {
    if (!s) return '—';
    if (s === 'done') return 'Done';
    if (s === 'skipped') return 'Skipped';
    return s;
  };

  return (
    <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="close-btn" onClick={onClose} type="button">×</button>
        </div>

        <div className="modal-body">
          <div style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
            Showing occurrences from <b>{range?.start || '—'}</b> to <b>{range?.end || '—'}</b>. ({total} found)
            {grandTotalTime > 0 && (
              <div style={{ marginTop: 6, fontWeight: 500, color: '#333' }}>
                Total time tracked: <b>{formatDuration(grandTotalTime)}</b>
              </div>
            )}
          </div>

          {loading ? (
            <div style={{ padding: '16px 0', color: '#666' }}>Loading…</div>
          ) : total === 0 ? (
            <div style={{ padding: '16px 0', color: '#666' }}>No occurrences found in this range.</div>
          ) : (
            <div style={{ borderTop: '1px solid var(--border-color)' }}>
              {occurrences.map((o) => (
                <div
                  key={o.id || `${o.task_id}-${o.date}`}
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '10px 0',
                    borderBottom: '1px solid var(--border-color)',
                    alignItems: 'flex-start'
                  }}
                >
                  <div style={{ minWidth: 110, fontVariantNumeric: 'tabular-nums' }}>
                    <b>{o.date}</b>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, wordBreak: 'break-word' }}>
                      {o.title || '(no title)'}
                    </div>
                    {o.notes ? (
                      <div style={{ marginTop: 4, fontSize: 13, color: '#666', whiteSpace: 'pre-wrap' }}>
                        {o.notes}
                      </div>
                    ) : null}
                    {o.totalTime > 0 && (
                      <div style={{ marginTop: 4, fontSize: 12, color: '#007AFF', fontWeight: 500 }}>
                        ⏱️ {formatDuration(o.totalTime)}
                      </div>
                    )}
                  </div>
                  <div style={{ minWidth: 90, textAlign: 'right', color: '#666' }}>
                    {statusLabel(o.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default TaskOccurrencesModal;
