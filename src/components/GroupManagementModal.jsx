import React, { useState, useEffect } from 'react';
import { translations, defaultColors } from '../services/utils';
import { getTasks, updateTask } from '../services/database';
import './Modal.css';

function GroupManagementModal({ language, onClose, onUpdate }) {
  const t = translations[language];
  const [tasks, setTasks] = useState([]);
  const [groups, setGroups] = useState([]);
  const [editingGroup, setEditingGroup] = useState(null);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const allTasks = await getTasks();
      setTasks(allTasks);

      // Extract unique groups
      const groupMap = {};
      allTasks.forEach(task => {
        if (task.group_id) {
          if (!groupMap[task.group_id]) {
            groupMap[task.group_id] = {
              id: task.group_id,
              name: task.group_id,
              taskCount: 0,
            };
          }
          groupMap[task.group_id].taskCount++;
        }
      });

      setGroups(Object.values(groupMap));
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const handleRenameGroup = async (oldGroupId) => {
    if (!newName.trim() || newName === oldGroupId) {
      setEditingGroup(null);
      setNewName('');
      return;
    }

    try {
      // Update all tasks in this group
      const tasksInGroup = tasks.filter(t => t.group_id === oldGroupId);
      for (const task of tasksInGroup) {
        await updateTask({ ...task, group_id: newName.trim() });
      }

      await loadGroups();
      await onUpdate();
      setEditingGroup(null);
      setNewName('');
    } catch (error) {
      console.error('Error renaming group:', error);
    }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!confirm(`Remove group "${groupId}"? Tasks will become ungrouped.`)) {
      return;
    }

    try {
      // Remove group from all tasks
      const tasksInGroup = tasks.filter(t => t.group_id === groupId);
      for (const task of tasksInGroup) {
        await updateTask({ ...task, group_id: null });
      }

      await loadGroups();
      await onUpdate();
    } catch (error) {
      console.error('Error deleting group:', error);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Manage Groups</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <p style={{ marginBottom: '16px', color: '#666', fontSize: '14px' }}>
            Groups are created automatically when you assign them to tasks. You can rename or delete groups here.
          </p>

          {groups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px', color: '#999' }}>
              No groups yet. Create groups by editing tasks!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {groups.map(group => (
                <div
                  key={group.id}
                  style={{
                    padding: '12px',
                    background: '#f9f9fb',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                >
                  {editingGroup === group.id ? (
                    <>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameGroup(group.id);
                          if (e.key === 'Escape') { setEditingGroup(null); setNewName(''); }
                        }}
                        autoFocus
                        style={{ flex: 1 }}
                      />
                      <button onClick={() => handleRenameGroup(group.id)}>Save</button>
                      <button
                        className="secondary"
                        onClick={() => { setEditingGroup(null); setNewName(''); }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '15px' }}>{group.name}</div>
                        <div style={{ fontSize: '13px', color: '#666' }}>
                          {group.taskCount} task{group.taskCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <button
                        className="secondary"
                        onClick={() => { setEditingGroup(group.id); setNewName(group.name); }}
                      >
                        Rename
                      </button>
                      <button
                        className="danger"
                        onClick={() => handleDeleteGroup(group.id)}
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default GroupManagementModal;
