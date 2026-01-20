import React, { useMemo, useRef, useEffect, useState } from 'react';
import { lightenColor } from '../services/utils';
import './Grid.css';

function Grid({ 
  tasks, 
  occurrences, 
  rowDensity, 
  columnWidth, 
  language,
  dataLoaded,
  onCellClick, 
  onTaskClick,
  onLoadDemo,
  deletedItem,
  onUndoDelete,
  onClearDeletedItem,
  activeTimers,
  privacyMode,
  spotlightTaskId,
  onSpotlightTask,
  clipboard,
  onCopy,
  onCut,
  onPaste,
  onClearClipboard,
  columnOrder,
  onColumnOrderChange
}) {
  // Sort and filter tasks based on columnOrder if available
  const activeTasks = useMemo(() => {
    // Filter out archived tasks
    const nonArchivedTasks = tasks.filter(task => !task.archived);
    
    if (!columnOrder || columnOrder.length === 0) {
      return nonArchivedTasks;
    }
    
    // Create a map of taskId -> order index
    const orderMap = new Map();
    columnOrder.forEach((taskId, index) => {
      orderMap.set(taskId, index);
    });
    
    // Sort tasks: those in columnOrder come first (by their order),
    // then any new tasks not in columnOrder come at the end
    return [...nonArchivedTasks].sort((a, b) => {
      const orderA = orderMap.has(a.id) ? orderMap.get(a.id) : Infinity;
      const orderB = orderMap.has(b.id) ? orderMap.get(b.id) : Infinity;
      return orderA - orderB;
    });
  }, [tasks, columnOrder]);

  // Mouse-based drag state for column reordering
  const [draggingTaskId, setDraggingTaskId] = useState(null);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);
  const dragStateRef = useRef({ 
    taskId: null, 
    startX: 0, 
    isDragging: false,
    overTaskId: null 
  });
  const todayRowRef = useRef(null);
  const gridWrapperRef = useRef(null);
  const initialScrollDone = useRef(false);

  // Hover popup state
  const [hoveredCell, setHoveredCell] = useState(null); // { taskId, date, x, y }
  const hoverTimeoutRef = useRef(null);

  // Generate STABLE date range - does NOT depend on occurrences
  const dates = useMemo(() => {
    const result = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 365);
    
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 100);
    
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      result.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return result;
  }, []);

  const formatDate = (date) => {
    // Use local timezone instead of UTC
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDateDisplay = (date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
  };

  const isTextBlurred = (taskId) => {
    if (!privacyMode || privacyMode === 'normal') return false;
    if (privacyMode === 'blurAll') return true;
    if (privacyMode === 'spotlight') {
      // Blur everything except the spotlight column
      return !(spotlightTaskId && taskId === spotlightTaskId);
    }
    return false;
  };

  const isToday = (date) => {
    const today = new Date();
    return formatDate(date) === formatDate(today);
  };

  const getOccurrence = (taskId, dateStr) => {
    return occurrences.find(occ => occ.task_id === taskId && occ.date === dateStr);
  };

  // Fast lookup for timing indicator
  const timingKeySet = useMemo(() => {
    const set = new Set();
    (activeTimers || []).forEach(t => {
      if (t?.taskId && t?.date) set.add(`${t.taskId}__${t.date}`);
    });
    return set;
  }, [activeTimers]);

  const isCellTiming = (taskId, dateStr) => timingKeySet.has(`${taskId}__${dateStr}`);

  const handleCellClick = (taskId, dateStr) => {
    setHoveredCell(null); // Hide popup on click
    // In privacy modes, block clicks on blurred cells (prevents accidental leakage)
    if (privacyMode && privacyMode !== 'normal') {
      if (privacyMode === 'spotlight' && spotlightTaskId && taskId === spotlightTaskId) {
        onCellClick(taskId, dateStr);
      }
      return;
    }
    onCellClick(taskId, dateStr);
  };

  const handleCellMouseEnter = (e, taskId, dateStr) => {
    if (privacyMode && privacyMode !== 'normal') return;
    // Capture the element immediately so we don't rely on the (possibly pooled)
    // synthetic event inside the timeout.
    const targetEl = e.currentTarget;

    // Clear any pending timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    
    // Delay showing popup slightly to avoid flicker
    hoverTimeoutRef.current = setTimeout(() => {
      const rect = targetEl.getBoundingClientRect();
      const wrapper = gridWrapperRef.current;
      const wrapperRect = wrapper?.getBoundingClientRect() || { left: 0, top: 0 };
      const scrollLeft = wrapper?.scrollLeft || 0;
      const scrollTop = wrapper?.scrollTop || 0;
      
      setHoveredCell({
        taskId,
        date: dateStr,
        // IMPORTANT: account for scroll offsets. Without this, the popup can be
        // positioned far away (often off-screen) once you scroll the grid.
        x: rect.left - wrapperRect.left + scrollLeft + rect.width / 2,
        y: rect.top - wrapperRect.top + scrollTop
      });
    }, 200);
  };

  const handleCellMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    // Delay hiding to allow moving to popup
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredCell(null);
    }, 150);
  };

  const handlePopupMouseEnter = () => {
    // Keep popup visible when mouse enters it
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  };

  const handlePopupMouseLeave = () => {
    setHoveredCell(null);
  };

  // Clipboard actions for hovered cell
  const handleHoverCopy = (e) => {
    e.stopPropagation();
    if (!hoveredCell) return;
    const occ = getOccurrence(hoveredCell.taskId, hoveredCell.date);
    if (occ) {
      onCopy(occ);
    }
    setHoveredCell(null);
  };

  const handleHoverCut = (e) => {
    e.stopPropagation();
    if (!hoveredCell) return;
    const occ = getOccurrence(hoveredCell.taskId, hoveredCell.date);
    if (occ) {
      onCut(occ);
    }
    setHoveredCell(null);
  };

  const handleHoverPaste = (e) => {
    e.stopPropagation();
    if (!hoveredCell || !clipboard?.occurrence) return;
    onPaste(hoveredCell.taskId, hoveredCell.date);
    setHoveredCell(null);
  };

  // Get info for current hovered cell
  const hoveredOccurrence = hoveredCell 
    ? getOccurrence(hoveredCell.taskId, hoveredCell.date) 
    : null;
  
  const canCopyOrCut = !!hoveredOccurrence;
  const canPaste = clipboard?.occurrence && hoveredCell && 
    !(clipboard.occurrence.task_id === hoveredCell.taskId && clipboard.occurrence.date === hoveredCell.date);

  // Scroll to today's row ONLY on initial mount
  useEffect(() => {
    if (todayRowRef.current && !initialScrollDone.current) {
      setTimeout(() => {
        if (todayRowRef.current && gridWrapperRef.current) {
          const wrapper = gridWrapperRef.current;
          const todayRow = todayRowRef.current;
          const rowTop = todayRow.offsetTop;
          const headerHeight = 60;
          wrapper.scrollTop = rowTop - headerHeight;
          initialScrollDone.current = true;
        }
      }, 100);
    }
  }, []);

  
  // Bottom-right navigation buttons
  const scrollToTop = () => {
    const wrapper = gridWrapperRef.current;
    if (!wrapper) return;
    wrapper.scrollTop = 0;
  };

  const scrollToBottom = () => {
    const wrapper = gridWrapperRef.current;
    if (!wrapper) return;
    wrapper.scrollTop = wrapper.scrollHeight;
  };

  const scrollToToday = () => {
    const wrapper = gridWrapperRef.current;
    const todayRow = todayRowRef.current;
    if (!wrapper || !todayRow) return;
    const headerHeight = 60;
    wrapper.scrollTop = todayRow.offsetTop - headerHeight;
  };

  // Mouse-based column reordering handlers
  const handleMouseMove = useRef((e) => {
    const state = dragStateRef.current;
    if (!state.taskId) return;
    
    // Only start "real" drag after moving a few pixels (to distinguish from click)
    if (!state.isDragging && Math.abs(e.clientX - state.startX) > 5) {
      state.isDragging = true;
    }
    
    if (!state.isDragging) return;
    
    // Find which header we're over
    const headers = document.querySelectorAll('.task-header');
    let foundOverId = null;
    for (const header of headers) {
      const rect = header.getBoundingClientRect();
      if (e.clientX >= rect.left && e.clientX <= rect.right) {
        const headerTaskId = header.getAttribute('data-task-id');
        if (headerTaskId && headerTaskId !== state.taskId) {
          foundOverId = headerTaskId;
        }
        break;
      }
    }
    
    if (foundOverId !== state.overTaskId) {
      state.overTaskId = foundOverId;
      setDragOverTaskId(foundOverId);
    }
  }).current;
  
  const handleMouseUp = useRef((e) => {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    
    const state = dragStateRef.current;
    
    if (state.isDragging && state.taskId && state.overTaskId && state.taskId !== state.overTaskId) {
      // Perform the reorder - need to get activeTasks from DOM data attributes
      const headers = document.querySelectorAll('.task-header');
      const currentOrder = Array.from(headers).map(h => h.getAttribute('data-task-id'));
      
      const draggedIndex = currentOrder.indexOf(state.taskId);
      const targetIndex = currentOrder.indexOf(state.overTaskId);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const newOrder = [...currentOrder];
        newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, state.taskId);
        
        // Dispatch custom event with new order since we can't access onColumnOrderChange directly
        window.dispatchEvent(new CustomEvent('columnOrderChange', { detail: newOrder }));
      }
    }
    
    // Reset state
    state.taskId = null;
    state.isDragging = false;
    state.overTaskId = null;
    setDraggingTaskId(null);
    setDragOverTaskId(null);
  }).current;

  // Listen for columnOrderChange custom event
  useEffect(() => {
    const handleOrderChange = (e) => {
      if (onColumnOrderChange) {
        onColumnOrderChange(e.detail);
      }
    };
    window.addEventListener('columnOrderChange', handleOrderChange);
    return () => window.removeEventListener('columnOrderChange', handleOrderChange);
  }, [onColumnOrderChange]);

  const handleHeaderMouseDown = (e, taskId) => {
    if (privacyMode !== 'normal') return;
    if (e.button !== 0) return; // Only left click
    
    dragStateRef.current = {
      taskId: taskId,
      startX: e.clientX,
      isDragging: false,
      overTaskId: null
    };
    setDraggingTaskId(taskId);
    
    // Add mousemove and mouseup listeners to document
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    e.preventDefault(); // Prevent text selection
  };
  
  const handleHeaderClick = (e, taskId) => {
    // If we were dragging, don't trigger click
    if (dragStateRef.current.isDragging) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    
    // Alt-click to spotlight a column (for safe screenshots). Works in any mode.
    if (e && e.altKey) {
      if (onSpotlightTask) onSpotlightTask(taskId);
      return;
    }
    onTaskClick(taskId);
  };

// Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      // Clean up any lingering mouse listeners
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div 
      className="grid-wrapper" 
      ref={gridWrapperRef}
    >
      <div className="grid-container">
        <table className={`grid-table ${columnWidth}`}>
          <thead>
            <tr>
              <th className="corner-cell"></th>
              {activeTasks.map(task => (
                <th 
                  key={task.id}
                  data-task-id={task.id}
                  className={`task-header ${draggingTaskId === task.id ? 'dragging' : ''} ${dragOverTaskId === task.id ? 'drag-over' : ''}`}
                  onMouseDown={(e) => handleHeaderMouseDown(e, task.id)}
                  onClick={(e) => handleHeaderClick(e, task.id)}
                >
                  <div className={`task-name ${isTextBlurred(task.id) ? 'privacy-blur' : ''}`}>{task.name}</div>
                  <div 
                    className="task-color-indicator" 
                    style={{ background: task.color }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dates.map(date => {
              const dateStr = formatDate(date);
              const isTodayRow = isToday(date);
              const todayClass = isTodayRow ? 'today' : '';

              return (
                <tr 
                  key={dateStr}
                  ref={isTodayRow ? todayRowRef : null}
                >
                  <td className={`date-cell ${todayClass}`}>
                    {formatDateDisplay(date)}
                  </td>
                  
                  {activeTasks.map(task => {
                    const occurrence = getOccurrence(task.id, dateStr);
                    const densityClass = rowDensity;
                    const showTiming = isCellTiming(task.id, dateStr);

                    if (occurrence) {
                      const isDone = occurrence.status === 'done';
                      const isSkipped = occurrence.status === 'skipped';
                      
                      let bgStyle;
                      if (isDone) {
                        bgStyle = `linear-gradient(rgba(255, 255, 255, 0.7), rgba(255, 255, 255, 0.7)), ${task.color}`;
                      } else if (isSkipped) {
                        bgStyle = `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), ${task.color}`;
                      } else {
                        bgStyle = task.color;
                      }
                      
                      return (
                        <td
                          key={`${task.id}-${dateStr}`}
                          className={`task-cell ${densityClass} ${occurrence.status}`}
                          style={{ background: bgStyle }}
                          onClick={() => handleCellClick(task.id, dateStr)}
                          onMouseEnter={(e) => handleCellMouseEnter(e, task.id, dateStr)}
                          onMouseLeave={handleCellMouseLeave}
                        >
                          {showTiming && (
                            <div className="timing-indicator" title="Timing">▶️</div>
                          )}
                          <div 
                            className={`cell-content ${densityClass === 'fat' ? 'fat' : ''} ${isTextBlurred(task.id) ? 'privacy-blur' : ''}`}
                            style={{ color: isSkipped ? 'white' : '#1d1d1f' }}
                          >
                            {occurrence.title || ''}
                          </div>
                        </td>
                      );
                    } else {
                      return (
                        <td
                          key={`${task.id}-${dateStr}`}
                          className={`task-cell ${densityClass} empty`}
                          onClick={() => handleCellClick(task.id, dateStr)}
                          onMouseEnter={(e) => handleCellMouseEnter(e, task.id, dateStr)}
                          onMouseLeave={handleCellMouseLeave}
                        >
                          {showTiming && (
                            <div className="timing-indicator" title="Timing">▶️</div>
                          )}
                          <div className="cell-content"></div>
                        </td>
                      );
                    }
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Hover Popup for Copy/Cut/Paste */}
      {privacyMode === 'normal' && hoveredCell && (canCopyOrCut || canPaste) && (
        <div 
          className="cell-hover-popup"
          style={{
            left: hoveredCell.x,
            top: hoveredCell.y - 40
          }}
          onMouseEnter={handlePopupMouseEnter}
          onMouseLeave={handlePopupMouseLeave}
        >
          {canCopyOrCut && (
            <>
              <button 
                className="popup-btn" 
                onClick={handleHoverCopy}
                title="Copy"
              >
                📋
              </button>
              <button 
                className="popup-btn" 
                onClick={handleHoverCut}
                title="Cut"
              >
                ✂️
              </button>
            </>
          )}
          {canPaste && (
            <button 
              className="popup-btn paste" 
              onClick={handleHoverPaste}
              title="Paste"
            >
              📥
            </button>
          )}
        </div>
      )}

            {/* Grid navigation buttons */}
      <div className="grid-nav-buttons">
        <button type="button" className="grid-nav-btn" onClick={scrollToTop} title="Jump to top">▲</button>
        <button type="button" className="grid-nav-btn" onClick={scrollToToday} title="Jump to today">Today</button>
        <button type="button" className="grid-nav-btn" onClick={scrollToBottom} title="Jump to bottom">▼</button>
      </div>

      {/* Clipboard indicator */}
      {privacyMode === 'normal' && clipboard && (
        <div className="clipboard-indicator">
          <span className="clipboard-text" title={clipboard.occurrence?.title || clipboard.occurrence?.notes || '(no title)'}>
            {clipboard.isCut ? '✂️' : '📋'} {clipboard.occurrence?.title || clipboard.occurrence?.notes || '(no title)'}
          </span>
          <button
            className="clipboard-clear-btn"
            type="button"
            onClick={() => onClearClipboard && onClearClipboard()}
            title="Clear clipboard"
          >
            ×
          </button>
        </div>
      )}

      {/* Empty state - show when no active tasks AND data has been loaded */}
      {dataLoaded && activeTasks.length === 0 && (
        <div className="grid-empty-state">
          <div className="empty-state-content">
            <div className="empty-state-icon">📋</div>
            <h2>No tasks yet</h2>
            <p>Get started by adding your first task, or load some demo tasks to explore the app.</p>
            <button 
              className="empty-state-demo-btn"
              onClick={onLoadDemo}
            >
              📦 Load Demo Tasks
            </button>
          </div>
        </div>
      )}

      {/* Undo delete indicator for cell entries */}
      {deletedItem && deletedItem.type === 'occurrence' && (
        <div className="undo-indicator">
          <span>Deleted entry from {deletedItem.data?.date}</span>
          <button
            className="undo-btn"
            onClick={onUndoDelete}
            title="Undo delete"
          >
            ↩️ Undo
          </button>
          <button
            className="undo-dismiss-btn"
            onClick={onClearDeletedItem}
            title="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default Grid;
