import React, { useEffect, useState } from 'react';
import { translations, formatDuration } from '../services/utils';
import {
  createOccurrence,
  updateOccurrence,
  deleteOccurrence,
  getTimeEntries,
  createTimeEntry,
  generateId,
} from '../services/database';
import './Modal.css';

function CellModal({
  taskId,
  date,
  tasks,
  occurrences,
  language,
  onClose,
  onUpdate,
  onSetDeletedItem,
  // multi timers
  activeTimers,
  timerNow,
  onStartTimer,
  onStopTimer,
}) {
  const t = translations[language];
  const task = tasks.find((t) => t.id === taskId);

  const occurrenceProp =
    occurrences.find((o) => o.task_id === taskId && o.date === date) || null;

  const [localOccurrence, setLocalOccurrence] = useState(occurrenceProp);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('planned');

  const [timeEntries, setTimeEntries] = useState([]);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualMinutes, setManualMinutes] = useState('');

  // multi timers state for this cell
  const thisTimer = (activeTimers || []).find(
    (x) => x.taskId === taskId && x.date === date
  );
  const isTimingThisCell = !!thisTimer;
  const timerStartTs = thisTimer ? Number(thisTimer.startTs) : null;
  const elapsedSeconds =
    isTimingThisCell && timerStartTs
      ? Math.max(0, Math.floor((Number(timerNow) - timerStartTs) / 1000))
      : 0;

  useEffect(() => {
    setLocalOccurrence(occurrenceProp);
    setTitle(occurrenceProp?.title || '');
    setNotes(occurrenceProp?.notes || '');
    setStatus(occurrenceProp?.status || 'planned');

    if (occurrenceProp?.id) {
      loadTimeEntries(occurrenceProp.id);
    } else {
      setTimeEntries([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, date, occurrenceProp?.id]);

  const loadTimeEntries = async (occurrenceId) => {
    try {
      const entries = await getTimeEntries(occurrenceId);
      setTimeEntries(entries || []);
    } catch (error) {
      console.error('Error loading time entries:', error);
      setTimeEntries([]);
    }
  };

  const hasMeaningfulContent = () => {
    const hasText = (title || '').trim() || (notes || '').trim();
    const nonDefaultStatus = (status || 'planned') !== 'planned';
    const hasTime = (timeEntries || []).length > 0;
    return !!(hasText || nonDefaultStatus || hasTime || isTimingThisCell);
  };

  const createOccurrenceIfNeeded = async (forceCreate) => {
    if (localOccurrence?.id) return localOccurrence;

    if (!forceCreate && !hasMeaningfulContent()) {
      // Outside-click save should not create a blank entry.
      return null;
    }

    const newOccurrence = {
      id: generateId(),
      task_id: taskId,
      date,
      status: status || 'planned',
      title: title || '',
      notes: notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await createOccurrence(newOccurrence);
    setLocalOccurrence(newOccurrence);
    await onUpdate();
    return newOccurrence;
  };

  const handleSave = async (forceCreate = false) => {
    try {
      if (!localOccurrence) {
        const created = await createOccurrenceIfNeeded(forceCreate);
        // If it was an outside-click save and nothing meaningful was entered, treat as cancel.
        if (!created) {
          onClose();
          return;
        }
        // Created already contains current fields; nothing else required.
        onClose();
        return;
      }

      // Update existing occurrence
      const updatedOccurrence = {
        ...localOccurrence,
        title,
        notes,
        status,
        updated_at: new Date().toISOString(),
      };

      await updateOccurrence(updatedOccurrence);
      await onUpdate();
      onClose();
    } catch (error) {
      console.error('Error saving occurrence:', error);
      alert('Failed to save entry: ' + (error?.message || String(error)));
    }
  };

  const handleDelete = async () => {
    if (!localOccurrence) return;
    if (!confirm('Delete this entry?')) return;

    try {
      // Save for undo before deleting
      if (onSetDeletedItem) {
        onSetDeletedItem({
          type: 'occurrence',
          data: { ...localOccurrence },
          relatedTimeEntries: [...timeEntries],
        });
      }

      await deleteOccurrence(localOccurrence.id);
      await onUpdate();
      onClose();
    } catch (error) {
      console.error('Error deleting occurrence:', error);
      alert('Failed to delete: ' + (error?.message || String(error)));
    }
  };

  const formatTimerDisplay = () => {
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const startTimer = async () => {
    try {
      await createOccurrenceIfNeeded(true);
      onStartTimer?.(taskId, date);
    } catch (e) {
      console.error('Failed to start timer:', e);
      alert('Failed to start timer: ' + (e?.message || String(e)));
    }
  };

  const stopTimer = async () => {
    try {
      await onStopTimer?.(taskId, date);
      if (localOccurrence?.id) await loadTimeEntries(localOccurrence.id);
      else await onUpdate();
    } catch (e) {
      console.error('Failed to stop timer:', e);
      alert('Failed to stop timer: ' + (e?.message || String(e)));
    }
  };

  const handleManualTimeEntry = async () => {
    const minutes = parseInt(String(manualMinutes ?? '').trim(), 10);
    if (!Number.isFinite(minutes) || minutes <= 0) {
      alert('Please enter a valid number of minutes');
      return;
    }

    try {
      const occ = await createOccurrenceIfNeeded(true);
      if (!occ?.id) return;

      const now = new Date();
      const startTime = new Date(now.getTime() - minutes * 60 * 1000);

      // Time entries should reflect the day the work was actually logged ("today"),
      // even when logging time into a past occurrence cell.
      const formatDate = (d) => d.toISOString().split('T')[0];

      const newEntry = {
        id: generateId(),
        occurrence_id: occ.id,
        task_id: taskId,
        date: formatDate(now),
        start_time: startTime.toISOString(),
        end_time: now.toISOString(),
        duration: minutes * 60,
      };

      await createTimeEntry(newEntry);
      await loadTimeEntries(occ.id);
      setManualMinutes('');
      setShowManualEntry(false);
    } catch (error) {
      console.error('Error creating manual time entry:', error);
      alert('Failed to add time: ' + (error?.message || String(error)));
    }
  };

  const totalTime = (timeEntries || []).reduce(
    (sum, entry) => sum + (entry.duration || 0),
    0
  );

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleSave(false);
      }}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {task?.name} - {date}
          </h2>
          <button className="close-btn" onClick={onClose} type="button">
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* Timer */}
          <div className="timer-section">
            <div className="timer-display">
              {isTimingThisCell ? formatTimerDisplay() : '00:00:00'}
            </div>
            <div className="timer-controls">
              {!isTimingThisCell ? (
                <>
                  <button type="button" onClick={startTimer}>
                    {t.startTimer || 'Start Timer'}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setShowManualEntry(!showManualEntry)}
                  >
                    ➕ Add Time
                  </button>
                </>
              ) : (
                <button type="button" className="secondary" onClick={stopTimer}>
                  {t.stopTimer || 'Stop Timer'}
                </button>
              )}
            </div>

            {showManualEntry && !isTimingThisCell && (
              <div className="manual-time-entry">
                <input
                  type="number"
                  value={manualMinutes}
                  onChange={(e) => setManualMinutes(e.target.value)}
                  placeholder="Minutes..."
                  min="1"
                />
                <button type="button" onClick={handleManualTimeEntry}>
                  Add
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setShowManualEntry(false);
                    setManualMinutes('');
                  }}
                >
                  Cancel
                </button>
              </div>
            )}

            <div className="time-summary">Total: {formatDuration(totalTime)}</div>
          </div>

          {/* Status */}
          <div className="form-group">
            <label>{t.status || 'Status'}</label>
            <div className="status-badges">
              {['planned', 'done', 'skipped'].map((s) => (
                <div
                  key={s}
                  className={'status-badge ' + (status === s ? 'active' : '')}
                  onClick={() => setStatus(s)}
                >
                  {t?.[s] || (s === 'planned' ? 'Planned' : s === 'done' ? 'Done' : 'Skipped')}
                </div>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="form-group">
            <label>{t.title || 'Title'}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
            />
          </div>

          {/* Notes */}
          <div className="form-group">
            <label>{t.notes || 'Notes'}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes..."
              rows="4"
            />
          </div>

          {/* Time Entries */}
          {localOccurrence && (
            <div className="time-entries">
              <div className="time-entries-title">{t.timeEntries || 'Time Entries'}:</div>
              {timeEntries.length === 0 ? (
                <p className="no-entries">{t.noTimeEntries || 'No time entries'}</p>
              ) : (
                <>
                  {timeEntries.map((entry) => (
                    <div key={entry.id} className="time-entry">
                      <span>
                        {entry.date}{' '}
                        {new Date(entry.end_time).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })}
                      </span>
                      <span>{formatDuration(entry.duration || 0)}</span>
                    </div>
                  ))}
                  <div className="time-entry total">
                    <span>{t.total || 'Total'}</span>
                    <span>{formatDuration(totalTime)}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="modal-actions">
          {localOccurrence ? (
            <button type="button" className="danger" onClick={handleDelete}>
              {t.delete || 'Delete'}
            </button>
          ) : (
            <div />
          )}
          <div style={{ flex: 1 }} />
          <button type="button" className="secondary" onClick={onClose}>
            {t.cancel || 'Cancel'}
          </button>
          <button type="button" onClick={() => handleSave(true)}>
            {t.save || 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CellModal;
