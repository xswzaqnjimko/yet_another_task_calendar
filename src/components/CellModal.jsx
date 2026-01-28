import React, { useEffect, useState } from 'react';
import { translations, formatDuration } from '../services/utils';
import {
  createOccurrence,
  updateOccurrence,
  deleteOccurrence,
  getTimeEntries,
  createTimeEntry,
  generateId,
  updateFutureRepeatEntries,
  deleteFutureRepeatEntries,
  checkOccurrenceExists,
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

  // Repeat state - use string for inputs to allow empty during typing
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [repeatEveryInput, setRepeatEveryInput] = useState('7');
  const [repeatForInput, setRepeatForInput] = useState('70');
  const [repeatingNotes, setRepeatingNotes] = useState('');
  const [originalRepeatGroupId, setOriginalRepeatGroupId] = useState(null);
  const [originalTitle, setOriginalTitle] = useState('');
  const [originalRepeatingNotes, setOriginalRepeatingNotes] = useState('');

  // Parse repeat inputs to numbers (with defaults)
  const getRepeatEvery = () => {
    const val = parseInt(repeatEveryInput, 10);
    return Number.isFinite(val) && val >= 1 ? Math.min(val, 366) : 7;
  };
  const getRepeatFor = () => {
    const val = parseInt(repeatForInput, 10);
    return Number.isFinite(val) && val >= 1 ? Math.min(val, 366) : 70;
  };

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
    
    // Load repeat state
    const hasRepeat = !!occurrenceProp?.repeat_group_id;
    setRepeatEnabled(hasRepeat);
    setRepeatingNotes(occurrenceProp?.repeating_notes || '');
    setOriginalRepeatGroupId(occurrenceProp?.repeat_group_id || null);
    setOriginalTitle(occurrenceProp?.title || '');
    setOriginalRepeatingNotes(occurrenceProp?.repeating_notes || '');
    // Reset repeat settings to defaults when opening new entry
    if (!hasRepeat) {
      setRepeatEveryInput('7');
      setRepeatForInput('70');
    }

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
    const hasText = (title || '').trim() || (notes || '').trim() || (repeatingNotes || '').trim();
    const nonDefaultStatus = (status || 'planned') !== 'planned';
    const hasTime = (timeEntries || []).length > 0;
    return !!(hasText || nonDefaultStatus || hasTime || isTimingThisCell || repeatEnabled);
  };

  const createOccurrenceIfNeeded = async (forceCreate) => {
    if (localOccurrence?.id) return localOccurrence;

    if (!forceCreate && !hasMeaningfulContent()) {
      // Outside-click save should not create a blank entry.
      return null;
    }

    const repeatGroupId = repeatEnabled ? generateId() : null;

    const newOccurrence = {
      id: generateId(),
      task_id: taskId,
      date,
      status: status || 'planned',
      title: title || '',
      notes: notes || '',
      repeat_group_id: repeatGroupId,
      repeating_notes: repeatEnabled ? (repeatingNotes || '') : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('[Repeat Debug] Creating occurrence with repeat:', {
      repeatEnabled,
      repeatGroupId,
      repeatingNotes,
      repeatEvery: getRepeatEvery(),
      repeatFor: getRepeatFor(),
      newOccurrence
    });

    await createOccurrence(newOccurrence);
    setLocalOccurrence(newOccurrence);
    
    // Create repeat entries if enabled
    if (repeatEnabled && repeatGroupId) {
      console.log('[Repeat Debug] Creating repeat entries...');
      await createRepeatEntries(newOccurrence, repeatGroupId);
      console.log('[Repeat Debug] Repeat entries created');
    }
    
    await onUpdate();
    return newOccurrence;
  };

  // Helper to get today's date string
  const getTodayStr = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to add days to a date string
  const addDaysToDate = (dateStr, days) => {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + days);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Create repeat entries based on settings
  const createRepeatEntries = async (baseOccurrence, repeatGroupId) => {
    const interval = getRepeatEvery();
    const duration = getRepeatFor();
    
    let currentDate = baseOccurrence.date;
    let daysCreated = 0;
    let entriesCreated = 0;
    
    console.log('[Repeat Debug] createRepeatEntries starting:', { interval, duration, baseDate: baseOccurrence.date });
    
    while (daysCreated < duration) {
      currentDate = addDaysToDate(currentDate, interval);
      daysCreated += interval;
      
      if (daysCreated > duration) break;
      
      // Check if occurrence already exists for this date
      try {
        const exists = await checkOccurrenceExists(taskId, currentDate);
        if (exists) {
          console.log('[Repeat Debug] Skipping existing date:', currentDate);
          continue;
        }
      } catch (e) {
        console.warn('Error checking occurrence exists:', e);
        continue;
      }
      
      const newOcc = {
        id: generateId(),
        task_id: taskId,
        date: currentDate,
        status: 'planned',
        title: baseOccurrence.title || '',
        notes: '',
        repeat_group_id: repeatGroupId,
        repeating_notes: baseOccurrence.repeating_notes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      try {
        await createOccurrence(newOcc);
        entriesCreated++;
        console.log('[Repeat Debug] Created repeat entry for date:', currentDate);
      } catch (e) {
        console.warn('Error creating repeat occurrence:', e);
      }
    }
    
    console.log('[Repeat Debug] createRepeatEntries finished. Created', entriesCreated, 'entries');
  };

  const handleSave = async (forceCreate = false) => {
    console.log('[Repeat Debug] handleSave called with:', {
      forceCreate,
      localOccurrence: localOccurrence?.id,
      repeatEnabled,
      repeatEveryInput,
      repeatForInput,
      repeatingNotes
    });
    
    try {
      if (!localOccurrence) {
        console.log('[Repeat Debug] No localOccurrence, calling createOccurrenceIfNeeded');
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

      // Existing occurrence - check for repeat changes
      const todayStr = getTodayStr();
      const hadRepeat = !!originalRepeatGroupId;
      const repeatChanged = hadRepeat !== repeatEnabled;
      const titleChanged = title !== originalTitle;
      const repeatingNotesChanged = repeatingNotes !== originalRepeatingNotes;

      // Handle repeat rule changes
      if (repeatChanged) {
        if (hadRepeat && originalRepeatGroupId) {
          // Delete all future repeat entries
          await deleteFutureRepeatEntries(originalRepeatGroupId, todayStr);
        }
        
        if (repeatEnabled) {
          // Create new repeat group and entries
          const newRepeatGroupId = generateId();
          const updatedOccurrence = {
            ...localOccurrence,
            title,
            notes,
            status,
            repeat_group_id: newRepeatGroupId,
            repeating_notes: repeatingNotes || '',
            updated_at: new Date().toISOString(),
          };
          await updateOccurrence(updatedOccurrence);
          await createRepeatEntries(updatedOccurrence, newRepeatGroupId);
        } else {
          // Just remove repeat from this occurrence
          const updatedOccurrence = {
            ...localOccurrence,
            title,
            notes,
            status,
            repeat_group_id: null,
            repeating_notes: null,
            updated_at: new Date().toISOString(),
          };
          await updateOccurrence(updatedOccurrence);
        }
      } else if (hadRepeat && originalRepeatGroupId && (titleChanged || repeatingNotesChanged)) {
        // Title or repeating notes changed - update future entries
        await updateFutureRepeatEntries(
          originalRepeatGroupId,
          todayStr,
          title || '',
          repeatingNotes || ''
        );
        
        // Update current occurrence
        const updatedOccurrence = {
          ...localOccurrence,
          title,
          notes,
          status,
          repeating_notes: repeatingNotes || '',
          updated_at: new Date().toISOString(),
        };
        await updateOccurrence(updatedOccurrence);
      } else {
        // Normal update (no repeat changes)
        const updatedOccurrence = {
          ...localOccurrence,
          title,
          notes,
          status,
          repeating_notes: repeatEnabled ? (repeatingNotes || '') : localOccurrence.repeating_notes,
          updated_at: new Date().toISOString(),
        };
        await updateOccurrence(updatedOccurrence);
      }

      await onUpdate();
      onClose();
    } catch (error) {
      console.error('Error saving occurrence:', error);
      alert('Failed to save entry: ' + (error?.message || String(error)));
    }
  };

  const handleDelete = async () => {
    if (!localOccurrence) return;
    
    // Different confirmation message based on whether it's a repeat entry
    const hasRepeatGroup = !!localOccurrence.repeat_group_id;
    const confirmMsg = hasRepeatGroup 
      ? 'Delete this entry and all future repeat entries?' 
      : 'Delete this entry?';
    
    if (!confirm(confirmMsg)) return;

    try {
      // Save for undo before deleting
      if (onSetDeletedItem) {
        onSetDeletedItem({
          type: 'occurrence',
          data: { ...localOccurrence },
          relatedTimeEntries: [...timeEntries],
        });
      }

      // If this is a repeat entry, delete all future entries (including today)
      if (hasRepeatGroup) {
        const todayStr = getTodayStr();
        await deleteFutureRepeatEntries(localOccurrence.repeat_group_id, todayStr);
      }
      
      // Also delete this specific occurrence (in case it's before today)
      // deleteFutureRepeatEntries only deletes >= today, so we need this for past entries
      try {
        await deleteOccurrence(localOccurrence.id);
      } catch (e) {
        // Ignore if already deleted by deleteFutureRepeatEntries
        console.log('Note: occurrence may have been deleted with future entries');
      }
      
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

          {/* Repeat Section */}
          <div className="form-group repeat-section">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={repeatEnabled}
                onChange={(e) => {
                  console.log('[Repeat Debug] Checkbox changed to:', e.target.checked);
                  setRepeatEnabled(e.target.checked);
                }}
              />
              <span>Repeat</span>
            </label>
            
            {repeatEnabled && (
              <div className="repeat-options">
                <div className="repeat-row">
                  <span>Repeat every</span>
                  <input
                    type="number"
                    value={repeatEveryInput}
                    onChange={(e) => setRepeatEveryInput(e.target.value)}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!Number.isFinite(val) || val < 1) {
                        setRepeatEveryInput('7');
                      } else if (val > 366) {
                        setRepeatEveryInput('366');
                      }
                    }}
                    min="1"
                    max="366"
                    className="repeat-number"
                  />
                  <span>day(s)</span>
                </div>
                <div className="repeat-row">
                  <span>for next</span>
                  <input
                    type="number"
                    value={repeatForInput}
                    onChange={(e) => setRepeatForInput(e.target.value)}
                    onBlur={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!Number.isFinite(val) || val < 1) {
                        setRepeatForInput('70');
                      } else if (val > 366) {
                        setRepeatForInput('366');
                      }
                    }}
                    min="1"
                    max="366"
                    className="repeat-number"
                  />
                  <span>day(s)</span>
                </div>
                
                {/* Repeating Notes - only shown when repeat is enabled */}
                <div className="form-group" style={{ marginTop: '12px' }}>
                  <label>{t.repeatingNotes || 'Repeating Notes'}</label>
                  <textarea
                    value={repeatingNotes}
                    onChange={(e) => setRepeatingNotes(e.target.value)}
                    placeholder="Notes that copy to all repeat entries..."
                    rows="2"
                  />
                </div>
                
                {originalRepeatGroupId && (
                  <div className="repeat-info">
                    ℹ️ Editing Title or Repeating Notes will update all future entries.
                    Changing or disabling repeat will delete all future entries.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="form-group">
            <label>{t.notes || 'Notes'} {repeatEnabled && <span style={{ fontWeight: 'normal', color: '#666' }}>(this entry only)</span>}</label>
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
