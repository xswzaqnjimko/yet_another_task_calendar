import React, { useState, useEffect, useMemo } from 'react';
import { translations } from '../services/utils';
import { 
  getTasks, 
  updateTask, 
  deleteTask,
  getOccurrences,
  getTimeEntries,
  createTask,
  createOccurrence,
  createTimeEntry,
  getSetting,
  setSetting 
} from '../services/database';
import { exportTaskBundle, importTaskBundle } from '../services/export';
import TaskModal from './TaskModal';
import TaskOccurrencesModal from './TaskOccurrencesModal';
import GroupManagementModal from './GroupManagementModal';
import './TaskDetailsPage.css';

/**
 * Separate ordering:
 * - Grid ordering is stored separately (handled in Grid.jsx via `grid_task_order`)
 * - Management ordering (this page) is stored per-group in settings, without touching task.sort_order
 *
 * Setting key: `mgmt_group_task_order`
 * Value: JSON object mapping groupKey -> array of taskIds (order within that group)
 *   groupKey = groupId string, or "__UNGROUPED__" for null/undefined
 */
const MGMT_ORDER_KEY = 'mgmt_group_task_order';
const UNGROUPED_KEY = '__UNGROUPED__';

function TaskDetailsPage({ 
  language, 
  onClose, 
  onUpdate,
  deletedItem,
  onSetDeletedItem,
  onUndoDelete,
  onClearDeletedItem
}) {
  const t = translations[language];
  const [tasks, setTasks] = useState([]);
  const [groups, setGroups] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [detailsTaskId, setDetailsTaskId] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsOccurrences, setDetailsOccurrences] = useState([]);
  const [detailsRange, setDetailsRange] = useState({ start: null, end: null });


  // Management-only ordering map: groupKey -> [taskIds...]
  const [mgmtOrderMap, setMgmtOrderMap] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const tasksData = await getTasks();
      setTasks(tasksData);

      // Load management ordering map from settings
      let orderMap = {};
      try {
        const saved = await getSetting(MGMT_ORDER_KEY);
        if (saved) orderMap = JSON.parse(saved);
      } catch (e) {
        console.warn('Failed to parse management order map:', e);
        orderMap = {};
      }

      // Ensure all tasks exist in their group's order list (append new ones)
      const nextOrderMap = { ...orderMap };
      const byGroup = {};
      tasksData.forEach((task) => {
        const gk = task.group_id ?? UNGROUPED_KEY;
        if (!byGroup[gk]) byGroup[gk] = [];
        byGroup[gk].push(task.id);
      });

      Object.entries(byGroup).forEach(([gk, ids]) => {
        const arr = Array.isArray(nextOrderMap[gk]) ? [...nextOrderMap[gk]] : [];
        const setArr = new Set(arr);
        ids.forEach((id) => {
          if (!setArr.has(id)) arr.push(id);
        });
        // Also remove ids no longer present
        const idSet = new Set(ids);
        nextOrderMap[gk] = arr.filter((id) => idSet.has(id));
      });

      // Save back if we had to initialize/patch it
      if (JSON.stringify(nextOrderMap) != JSON.stringify(orderMap)) {
        try {
          await setSetting(MGMT_ORDER_KEY, JSON.stringify(nextOrderMap));
        } catch (e) {
          console.warn('Failed to persist management order map:', e);
        }
      }
      setMgmtOrderMap(nextOrderMap);

      // Extract unique groups from tasks with their first appearance order
      const groupMap = {};
      const groupOrder = [];

      tasksData.forEach((task) => {
        const groupId = task.group_id || null;
        const groupName = task.group_id || 'Ungrouped';

        if (!groupMap[groupId]) {
          groupMap[groupId] = {
            id: groupId,
            name: groupName,
            color: groupId ? '#007AFF' : '#999',
            sort_order: groupOrder.length,
            taskCount: 0,
          };
          groupOrder.push(groupId);
        }
        groupMap[groupId].taskCount++;
      });

      // Try to load saved group order
      const savedOrderJson = await getSetting('group_order');
      let orderedGroupIds = groupOrder;

      if (savedOrderJson) {
        try {
          const savedOrder = JSON.parse(savedOrderJson);
          // Merge saved order with current groups (in case new groups were added)
          const allGroupIds = new Set([...savedOrder, ...groupOrder]);
          orderedGroupIds = Array.from(allGroupIds).filter((id) => groupMap[id]);
        } catch (e) {
          console.warn('Failed to parse group order:', e);
        }
      }

      const groupsArray = orderedGroupIds.map((id, idx) => ({
        ...groupMap[id],
        sort_order: idx,
      }));

      setGroups(groupsArray);

      // Expand all groups by default
      setExpandedGroups(new Set(orderedGroupIds));
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const toggleGroup = (groupId) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) newExpanded.delete(groupId);
    else newExpanded.add(groupId);
    setExpandedGroups(newExpanded);
  };

  const handleArchiveTask = async (taskId) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    try {
      await updateTask({ ...task, archived: !task.archived });
      await loadData();
      await onUpdate();
    } catch (error) {
      console.error('Error archiving task:', error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    console.log('[Delete] Attempting to delete task:', taskId);
    const taskToDelete = tasks.find(t => t.id === taskId);
    console.log('[Delete] Task found:', taskToDelete);
    
    if (!taskToDelete) {
      console.error('[Delete] Task not found in local state');
      alert('Task not found');
      return;
    }

    try {
      // First, gather all related data for undo
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 365 * 2);
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 365);
      
      const isoDate = (d) => d.toISOString().split('T')[0];
      const allOccurrences = await getOccurrences(isoDate(startDate), isoDate(endDate));
      const taskOccurrences = allOccurrences.filter(o => o.task_id === taskId);
      
      // Get time entries for each occurrence
      const allTimeEntries = [];
      for (const occ of taskOccurrences) {
        try {
          const entries = await getTimeEntries(occ.id);
          if (entries && entries.length > 0) {
            allTimeEntries.push(...entries);
          }
        } catch (e) {
          console.warn('[Delete] Could not get time entries for occurrence:', occ.id);
        }
      }

      // Save for undo before deleting
      if (onSetDeletedItem) {
        onSetDeletedItem({
          type: 'task',
          data: { ...taskToDelete },
          relatedOccurrences: taskOccurrences,
          relatedTimeEntries: allTimeEntries,
        });
      }

      // Now delete the task (backend will cascade delete occurrences and time entries)
      await deleteTask(taskId);
      console.log('[Delete] deleteTask completed successfully');

      // Also remove from mgmt order map so the setting stays clean
      const gk = taskToDelete.group_id ?? UNGROUPED_KEY;
      const next = { ...mgmtOrderMap };
      if (Array.isArray(next[gk])) next[gk] = next[gk].filter(id => id !== taskId);
      setMgmtOrderMap(next);
      await setSetting(MGMT_ORDER_KEY, JSON.stringify(next));

      await loadData();
      await onUpdate();
      console.log('[Delete] UI refresh completed');
    } catch (error) {
      console.error('[Delete] Error deleting task:', error);
      alert('Failed to delete task: ' + (error?.message || String(error)));
    }
  };

  const handleReorderTaskInGroup = async (taskId, groupKey, direction) => {
    const currentOrder = Array.isArray(mgmtOrderMap[groupKey]) ? [...mgmtOrderMap[groupKey]] : [];
    const idx = currentOrder.indexOf(taskId);
    if (idx === -1) return;

    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= currentOrder.length) return;

    const nextOrder = [...currentOrder];
    const [moved] = nextOrder.splice(idx, 1);
    nextOrder.splice(newIdx, 0, moved);

    const nextMap = { ...mgmtOrderMap, [groupKey]: nextOrder };
    setMgmtOrderMap(nextMap);
    try {
      await setSetting(MGMT_ORDER_KEY, JSON.stringify(nextMap));
    } catch (e) {
      console.warn('Failed to persist management order:', e);
    }
  };

  const handleReorderGroup = async (groupId, direction) => {
    const groupIndex = groups.findIndex((g) => g.id === groupId);
    if (groupIndex === -1) return;

    const newIndex = direction === 'up' ? groupIndex - 1 : groupIndex + 1;
    if (newIndex < 0 || newIndex >= groups.length) return;

    try {
      // Swap the groups in the array
      const newGroups = [...groups];
      const temp = newGroups[groupIndex];
      newGroups[groupIndex] = newGroups[newIndex];
      newGroups[newIndex] = temp;

      // Update sort_order
      newGroups.forEach((g, idx) => {
        g.sort_order = idx;
      });

      setGroups(newGroups);

      // Store group order in settings
      const groupOrder = newGroups.map((g) => g.id);
      await setSetting('group_order', JSON.stringify(groupOrder));
    } catch (error) {
      console.error('Error reordering group:', error);
    }
  };

  const orderedTasksForGroup = (groupId, includeArchived = false) => {
    const groupKey = groupId ?? UNGROUPED_KEY;
    const groupTasks = tasks.filter((t) => {
      const sameGroup = (t.group_id ?? UNGROUPED_KEY) === groupKey;
      if (!sameGroup) return false;
      if (includeArchived) return true;
      return !t.archived;
    });

    const orderArr = Array.isArray(mgmtOrderMap[groupKey]) ? mgmtOrderMap[groupKey] : [];
    const index = new Map(orderArr.map((id, i) => [id, i]));

    // Stable ordering: first by saved order, then fallback by sort_order, then name
    return [...groupTasks].sort((a, b) => {
      const ai = index.has(a.id) ? index.get(a.id) : 1e9;
      const bi = index.has(b.id) ? index.get(b.id) : 1e9;
      if (ai !== bi) return ai - bi;
      const ao = a.sort_order ?? 0;
      const bo = b.sort_order ?? 0;
      if (ao !== bo) return ao - bo;
      return String(a.name ?? '').localeCompare(String(b.name ?? ''));
    });
  };

  const getArchivedTasks = () => tasks.filter((t) => t.archived);

  const handleExportBundle = async () => {
    try {
      const groupList = groups.map((g) => `- ${g.name} (${g.taskCount} tasks)`).join('\n');
      const message =
        groups.length > 0
          ? `Export tasks:\n\n${groupList}\n\nEnter group name to export only that group, or leave empty to export ALL tasks:`
          : 'Export all tasks?';

      const choice = prompt(message);
      if (choice === null) return; // Cancelled

      const groupId = choice.trim() || null;
      await exportTaskBundle(true, groupId);

      const filename = groupId ? `task_bundle_${groupId}.json` : 'task_bundle.json';
      alert(`Exported ${filename} successfully!`);
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed: ' + error.message);
    }
  };


  const isoDate = (d) => d.toISOString().split('T')[0];

  const openTaskDetails = async (taskId) => {
    setDetailsTaskId(taskId);
    setDetailsOpen(true);
    setDetailsLoading(true);
    setDetailsOccurrences([]);

    // For now: load a wide but bounded date range (same scale as Grid; can adjust later)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(today);
    start.setDate(today.getDate() - 365 * 2); // 2 years back

    const end = new Date(today);
    end.setDate(today.getDate() + 365); // 1 year ahead

    const startStr = isoDate(start);
    const endStr = isoDate(end);

    setDetailsRange({ start: startStr, end: endStr });

    try {
      const all = await getOccurrences(startStr, endStr);
      const filtered = (all || [])
        .filter(o => o.task_id === taskId)
        .slice()
        .sort((a, b) => String(b.date).localeCompare(String(a.date)));

      // Load time entries for each occurrence and calculate total time
      const occurrencesWithTime = await Promise.all(
        filtered.map(async (occ) => {
          try {
            const timeEntries = await getTimeEntries(occ.id);
            const totalTime = (timeEntries || []).reduce(
              (sum, entry) => sum + (entry.duration || 0),
              0
            );
            return { ...occ, totalTime, timeEntries };
          } catch (e) {
            console.warn('Failed to load time entries for occurrence:', occ.id, e);
            return { ...occ, totalTime: 0, timeEntries: [] };
          }
        })
      );

      setDetailsOccurrences(occurrencesWithTime);
    } catch (e) {
      console.error('Failed to load occurrences for task details:', e);
      alert('Failed to load task details: ' + (e?.message || String(e)));
      setDetailsOccurrences([]);
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeTaskDetails = () => {
    setDetailsOpen(false);
    setDetailsTaskId(null);
    setDetailsOccurrences([]);
  };

  const handleImportBundle = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const result = await importTaskBundle(text, createTask, createOccurrence, createTimeEntry);
        alert(
          `Successfully imported:\n- ${result.tasks} tasks\n- ${result.occurrences} occurrences\n- ${result.timeEntries} time entries`
        );
        await loadData();
        await onUpdate();
      } catch (error) {
        console.error('Import error:', error);
        alert('Import failed: ' + error.message);
      }
    };
    input.click();
  };

  return (
    <div className="task-details-page">
      <div className="page-header">
        <h1>📋 Task Management</h1>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {deletedItem && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginRight: '8px' }}>
              <button
                className="undo-btn"
                onClick={async () => {
                  const success = await onUndoDelete();
                  if (success) {
                    await loadData(); // Reload TaskDetailsPage's own data
                  }
                }}
                title={`Undo delete: ${deletedItem.data?.name || deletedItem.data?.title || 'item'}`}
                style={{
                  background: '#fff3cd',
                  border: '1px solid #ffc107',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                ↩️ Undo Delete
              </button>
              <button
                onClick={onClearDeletedItem}
                title="Dismiss undo option"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '16px',
                  padding: '4px',
                }}
              >
                ×
              </button>
            </div>
          )}
          <button
            className="secondary"
            onClick={() => { setEditingTaskId(null); setTaskModalOpen(true); }}
          >
            Add Task
          </button>
          <button className="secondary" onClick={() => setGroupModalOpen(true)}>
            Edit Groups
          </button>
          <button className="secondary" onClick={handleExportBundle}>
            Export Tasks
          </button>
          <button className="secondary" onClick={handleImportBundle}>
            Import Tasks
          </button>
          <button className="secondary" onClick={onClose}>
            Back to Grid
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* Active Tasks by Group */}
        <div className="groups-section">
          <h2>Active Tasks</h2>

          {groups.map((group, groupIndex) => {
            const groupTasks = orderedTasksForGroup(group.id, false);
            const isExpanded = expandedGroups.has(group.id);
            const groupKey = group.id ?? UNGROUPED_KEY;

            return (
              <div key={group.id || 'ungrouped'} className="task-group">
                <div className="group-header">
                  <div className="group-header-left" onClick={() => toggleGroup(group.id)}>
                    <span className="group-toggle">{isExpanded ? '▼' : '▶'}</span>
                    <span className="group-color-indicator" style={{ background: group.color }} />
                    <span className="group-name">{group.name}</span>
                    <span className="group-count">({groupTasks.length})</span>
                  </div>
                  <div className="group-header-actions">
                    <button
                      className="icon-btn reorder-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReorderGroup(group.id, 'up');
                      }}
                      disabled={groupIndex === 0}
                      title="Move group up"
                    >
                      ⬆️
                    </button>
                    <button
                      className="icon-btn reorder-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleReorderGroup(group.id, 'down');
                      }}
                      disabled={groupIndex === groups.length - 1}
                      title="Move group down"
                    >
                      ⬇️
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="group-tasks">
                    {groupTasks.length === 0 ? (
                      <div className="empty-group">No tasks in this group</div>
                    ) : (
                      groupTasks.map((task, index) => (
                        <div key={task.id} className="task-item">
                          <div className="task-color-bar" style={{ background: task.color }} />
                          <div className="task-info">
                            <div className="task-name-row">
                              <span
                                className="task-name"
                                onClick={() => {
                                  setEditingTaskId(task.id);
                                  setTaskModalOpen(true);
                                }}
                                style={{ cursor: 'pointer' }}
                                title="Click to edit task details"
                              >
                                {task.name}
                              </span>
                              <button
                                className="details-link"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openTaskDetails(task.id);
                                }}
                                title="Show this task's occurrences"
                              >
                                Show details
                              </button>
                            </div>
                            {task.description && (
                              <div style={{ fontSize: '13px', color: '#666', marginTop: '4px' }}>
                                {task.description}
                              </div>
                            )}
                          </div>
                          <div className="task-actions">
                            <button
                              className="icon-btn reorder-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReorderTaskInGroup(task.id, groupKey, 'up');
                              }}
                              disabled={index === 0}
                              title="Move task up in this group (Management order)"
                            >
                              ⬆️
                            </button>
                            <button
                              className="icon-btn reorder-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReorderTaskInGroup(task.id, groupKey, 'down');
                              }}
                              disabled={index === groupTasks.length - 1}
                              title="Move task down in this group (Management order)"
                            >
                              ⬇️
                            </button>
                            <button
                              className="icon-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArchiveTask(task.id);
                              }}
                              title="Archive this task (hide from grid)"
                            >
                              📦
                            </button>
                            <button
                              className="icon-btn danger"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTask(task.id);
                              }}
                              title="Delete task permanently"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Archived Tasks */}
        {getArchivedTasks().length > 0 && (
          <div className="archived-section">
            <h2>Archived Tasks ({getArchivedTasks().length})</h2>
            <div className="archived-tasks">
              {getArchivedTasks()
                .slice()
                .sort((a, b) => {
                  // Keep archived ordering stable using mgmt order within group
                  const ak = a.group_id ?? UNGROUPED_KEY;
                  const bk = b.group_id ?? UNGROUPED_KEY;
                  if (ak !== bk) return String(ak).localeCompare(String(bk));
                  const arr = Array.isArray(mgmtOrderMap[ak]) ? mgmtOrderMap[ak] : [];
                  const idx = new Map(arr.map((id, i) => [id, i]));
                  const ai = idx.has(a.id) ? idx.get(a.id) : 1e9;
                  const bi = idx.has(b.id) ? idx.get(b.id) : 1e9;
                  if (ai !== bi) return ai - bi;
                  return String(a.name ?? '').localeCompare(String(b.name ?? ''));
                })
                .map((task) => (
                  <div key={task.id} className="task-item archived">
                    <div className="task-color-bar" style={{ background: task.color }} />
                    <div className="task-info">
                      <div className="task-name-row">
                        <span
                          className="task-name"
                          onClick={() => {
                            setEditingTaskId(task.id);
                            setTaskModalOpen(true);
                          }}
                          style={{ cursor: 'pointer' }}
                          title="Click to edit task details"
                        >
                          {task.name}
                        </span>
                        <button
                          className="details-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            openTaskDetails(task.id);
                          }}
                          title="Show this task's occurrences"
                        >
                          Show details
                        </button>
                      </div>
                    </div>
                    <div className="task-actions">
                      <button
                        className="icon-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleArchiveTask(task.id);
                        }}
                        title="Restore task to active list"
                      >
                        ↩️
                      </button>
                      <button
                        className="icon-btn danger"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTask(task.id);
                        }}
                        title="Delete task permanently"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

            {detailsOpen && (
        <TaskOccurrencesModal
          task={tasks.find(t => t.id === detailsTaskId)}
          occurrences={detailsOccurrences}
          loading={detailsLoading}
          range={detailsRange}
          onClose={closeTaskDetails}
        />
      )}

      {taskModalOpen && (
          <TaskModal
          taskId={editingTaskId}
          tasks={tasks}
          language={language}
          onClose={() => {
            setTaskModalOpen(false);
            setEditingTaskId(null);
          }}
          onUpdate={async () => {
            await loadData();
            await onUpdate();
          }}
        />
      )}

      {groupModalOpen && (
        <GroupManagementModal
          language={language}
          onClose={() => setGroupModalOpen(false)}
          onUpdate={async () => {
            await loadData();
            await onUpdate();
          }}
        />
      )}
    </div>
  );
}

export default TaskDetailsPage;
