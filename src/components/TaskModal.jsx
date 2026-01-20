import React, { useEffect, useMemo, useState } from 'react';
import { translations, defaultColors } from '../services/utils';
import { createTask, updateTask, generateId, getSetting, setSetting } from '../services/database';
import './Modal.css';

function TaskModal({ taskId, tasks, language, onClose, onUpdate }) {
  const t = translations[language];
  const task = taskId ? (tasks || []).find((x) => x.id === taskId) : null;
  const isEditing = !!task;

  const existingGroups = useMemo(() => {
    const map = new Map();
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
  const [description, setDescription] = useState('');
  const [groupId, setGroupId] = useState(null);
  const [customGroup, setCustomGroup] = useState('');

  useEffect(() => {
    if (task) {
      setName(task.name || '');
      setColor(task.color || defaultColors[0]);
      setDescription(task.description || '');
      setGroupId(task.group_id || null);
      setCustomGroup('');
    } else {
      setName('');
      setColor(defaultColors[0]);
      setDescription('');
      setGroupId(null);
      setCustomGroup('');
    }

    const handleKeyPress = (e) => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        handleSave(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, task]);

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

  const handleSave = async (force = false) => {
    if (!name.trim()) return;

    try {
      const finalGroupId = resolveFinalGroupId();

      if (isEditing) {
        const updatedTask = {
          ...task,
          name: name.trim(),
          color,
          group_id: finalGroupId,
          description: (description || '').trim(),
        };
        await updateTask(updatedTask);
      } else {
        const maxSort = (tasks || []).reduce((m, tk) => Math.max(m, Number(tk.sort_order || 0)), 0);
        const newId = generateId();

        const newTask = {
          id: newId,
          name: name.trim(),
          color,
          icon: null,
          group_id: finalGroupId,
          description: (description || '').trim(),
          sort_order: maxSort + 1,
          archived: false,
        };

        await createTask(newTask);

        // Keep Grid order stable: if a custom order exists, show the new task immediately.
        try {
          const saved = await getSetting('grid_task_order');
          if (saved) {
            const arr = JSON.parse(saved);
            if (Array.isArray(arr)) {
              const next = [newId, ...arr.filter((x) => x !== newId)];
              await setSetting('grid_task_order', JSON.stringify(next));
            }
          }
        } catch (e) {
          // ignore
        }
      }

      await onUpdate?.();
      onClose();
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Failed to save task: ' + (error?.message || String(error)));
    }
  };

  const typed = (customGroup || '').trim();
  const typedNorm = typed.toLowerCase();
  const typedMatch = typed
    ? existingGroups.find((g) => String(g).trim().toLowerCase() === typedNorm)
    : null;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleSave(false);
      }}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEditing ? (t.editTaskTitle || 'Edit Task') : (t.addTaskTitle || 'Add Task')}</h2>
          <button className="close-btn" onClick={onClose} type="button">
            ×
          </button>
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
              onChange={(e) => {
                setGroupId(e.target.value || null);
                setCustomGroup('');
              }}
            >
              <option value="">Ungrouped</option>
              {existingGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
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
              onChange={(e) => setCustomGroup(e.target.value)}
              placeholder="Enter group name..."
            />
            {typed ? (
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                {typedMatch ? (
                  <>
                    Will use existing group: <b>{typedMatch}</b>
                  </>
                ) : (
                  <>
                    Will assign group: <b>{typed}</b>
                  </>
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
          <button className="secondary" onClick={onClose} type="button">
            {t.cancel || 'Cancel'}
          </button>
          <div
            style={{
              flex: 1,
              fontSize: '13px',
              color: '#666',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            Press{' '}
            <kbd
              style={{
                padding: '2px 6px',
                background: '#f0f0f5',
                border: '1px solid #d1d1d6',
                borderRadius: '3px',
                margin: '0 4px',
              }}
            >
              Enter
            </kbd>{' '}
            to save
          </div>
          <button onClick={() => handleSave(true)} type="button">
            {t.save || 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TaskModal;
