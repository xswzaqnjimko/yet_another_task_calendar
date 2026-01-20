import React, { useEffect, useMemo, useState } from 'react';
import { translations, defaultColors } from '../services/utils';
import { updateTask } from '../services/database';
import './Modal.css';

/**
 * TaskEditModal (legacy) — fixed behaviors:
 * - X = cancel (no save)
 * - Save button + click outside = save
 * - Groups derived from existing tasks (no hardcoded list)
 * - If typed group matches existing (case-insensitive), reuse existing name
 */
function TaskEditModal({ task, tasks, language, onClose, onUpdate }) {
  const t = translations[language];

  const existingGroups = useMemo(() => {
    const map = new Map(); // norm -> canonical
    for (const tk of tasks || []) {
      const g = (tk.group_id || '').trim();
      if (!g) continue;
      const norm = g.toLowerCase();
      if (!map.has(norm)) map.set(norm, tk.group_id);
    }
    return Array.from(map.values()).sort((a, b) => String(a).localeCompare(String(b)));
  }, [tasks]);

  const [name, setName] = useState('');
  const [color, setColor] = useState(defaultColors[0]);
  const [groupId, setGroupId] = useState(null);
  const [customGroup, setCustomGroup] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (task) {
      setName(task.name || '');
      setColor(task.color || defaultColors[0]);
      setGroupId(task.group_id || null);
      setCustomGroup('');
      setDescription(task.description || '');
    }
  }, [task]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        handleSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, color, groupId, customGroup, description, task]);

  const resolveFinalGroupId = () => {
    const typed = (customGroup || '').trim();
    if (typed) {
      const norm = typed.toLowerCase();
      const match = existingGroups.find((g) => String(g).trim().toLowerCase() === norm);
      return match || typed;
    }
    const selected = (groupId || '').trim();
    return selected ? selected : null;
  };

  const handleSave = async () => {
    if (!name.trim() || !task) return;

    try {
      const finalGroupId = resolveFinalGroupId();
      const updatedTask = {
        ...task,
        name: name.trim(),
        color,
        group_id: finalGroupId,
        description: (description || '').trim(),
      };
      await updateTask(updatedTask);
      await onUpdate?.();
      onClose();
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Failed to save task: ' + (error?.message || String(error)));
    }
  };

  const typed = (customGroup || '').trim();
  const typedMatch = typed
    ? existingGroups.find((g) => String(g).trim().toLowerCase() === typed.toLowerCase())
    : null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleSave();
      }}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t.editTaskTitle || 'Edit Task'}</h2>
          <button className="close-btn" onClick={onClose} type="button">×</button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>{t.taskName || 'Task Name'}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter task name..."
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Description (Optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description for this task..."
              rows="3"
            />
          </div>

          <div className="form-group">
            <label>Group</label>
            <select
              value={groupId || ''}
              onChange={(e) => { setGroupId(e.target.value || null); setCustomGroup(''); }}
            >
              <option value="">Ungrouped</option>
              {existingGroups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <div style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
              Tip: Same names will be auto recognized (case-insensitive) — typing an existing group name below will reuse it.
            </div>
          </div>

          <div className="form-group">
            <label>Or type a new group name</label>
            <input
              type="text"
              value={customGroup}
              onChange={(e) => { setCustomGroup(e.target.value); }}
              placeholder="Enter group name..."
            />
            {typed ? (
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                {typedMatch ? (
                  <>Will use existing group: <b>{typedMatch}</b></>
                ) : (
                  <>Will assign group: <b>{typed}</b></>
                )}
              </div>
            ) : null}
          </div>

          <div className="form-group">
            <label>{t.color || 'Color'}</label>
            <div className="color-picker">
              {defaultColors.map((c) => (
                <div
                  key={c}
                  className={`color-option ${color === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                  title={c}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="secondary" onClick={onClose} type="button">{t.cancel || 'Cancel'}</button>
          <div style={{ flex: 1 }} />
          <button onClick={handleSave} type="button">{t.save || 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

export default TaskEditModal;
