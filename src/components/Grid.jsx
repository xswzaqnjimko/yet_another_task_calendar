import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { lightenColor } from '../services/utils';
import './Grid.css';

// --- Module-level pure helpers (no component state needed) ---

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateDisplay = (date, density) => {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const year = date.getFullYear();
  const isFirstOfMonth = date.getDate() === 1;
  const showYear = density === 'fat' || isFirstOfMonth;
  if (showYear) {
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}, ${year}`;
  }
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
};

// --- Fix 2: Memoized table body with event delegation ---
// Only re-renders when its data props change, NOT when hoveredCell changes in Grid.
const GridTableBody = React.memo(function GridTableBody({
  dates,
  activeTasks,
  occurrenceMap,
  rowDensity,
  timingKeySet,
  privacyMode,
  spotlightTaskIds,
  todayRowRef,
  onExtendFuture,
  onBodyClick,
  onBodyMouseOver,
  onBodyMouseOut,
}) {
  const todayStr = formatDate(new Date());

  const isTextBlurred = (taskId) => {
    if (!privacyMode || privacyMode === 'normal') return false;
    if (privacyMode === 'blurAll') return true;
    if (privacyMode === 'spotlight') {
      return !(spotlightTaskIds && spotlightTaskIds.includes(taskId));
    }
    return false;
  };

  return (
    <tbody
      onClick={onBodyClick}
      onMouseOver={onBodyMouseOver}
      onMouseOut={onBodyMouseOut}
    >
      {dates.map((date) => {
        const dateStr = formatDate(date);
        const isTodayRow = dateStr === todayStr;
        const todayClass = isTodayRow ? 'today' : '';
        const isMonday = date.getDay() === 1;
        const isFirstOfMonth = date.getDate() === 1;
        const borderClass = isFirstOfMonth ? 'month-border' : (isMonday ? 'week-border' : '');
        const rowClasses = [borderClass, isTodayRow ? 'today-row' : ''].filter(Boolean).join(' ');

        return (
          <tr
            key={dateStr}
            ref={isTodayRow ? todayRowRef : null}
            className={rowClasses}
          >
            <td className={`date-cell ${todayClass}`}>
              {formatDateDisplay(date, rowDensity)}
            </td>

            {activeTasks.map(task => {
              const occurrence = occurrenceMap.get(`${task.id}__${dateStr}`);
              const densityClass = rowDensity;
              const showTiming = timingKeySet.has(`${task.id}__${dateStr}`);

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
                    data-task-id={task.id}
                    data-date={dateStr}
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
                    data-task-id={task.id}
                    data-date={dateStr}
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
      {onExtendFuture && (
        <tr>
          <td colSpan={activeTasks.length + 1} className="load-more-row">
            <button className="load-more-btn" onClick={onExtendFuture}>
              Load 6 more months...
            </button>
          </td>
        </tr>
      )}
    </tbody>
  );
});

// --- Main Grid component ---

function Grid({
  tasks,
  occurrences,
  rowDensity,
  columnWidth,
  language,
  dataLoaded,
  gridStartDate,
  gridEndDate,
  onCellClick,
  onTaskClick,
  onLoadDemo,
  onExtendFuture,
  deletedItem,
  onUndoDelete,
  onClearDeletedItem,
  activeTimers,
  privacyMode,
  spotlightTaskIds,
  onSpotlightTask,
  onUnspotlightTask,
  onClearSpotlight,
  clipboard,
  onCopy,
  onCut,
  onPaste,
  onClearClipboard,
  columnOrder,
  onColumnOrderChange,
  onAddTaskAt
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

  // Hover popup state — kept in parent so GridTableBody doesn't re-render on hover
  const [hoveredCell, setHoveredCell] = useState(null); // { taskId, date, x, y }
  const hoverTimeoutRef = useRef(null);
  const hoveredTdRef = useRef(null); // Track currently hovered <td> for event delegation

  // Hovered task header for screenshot mode eye/blur buttons
  const [hoveredHeaderTaskId, setHoveredHeaderTaskId] = useState(null);
  const [hoveredHeaderPos, setHoveredHeaderPos] = useState(null); // { x, y }
  const headerHoverTimeoutRef = useRef(null);

  // --- Fix 1: O(1) occurrence lookup map ---
  const occurrenceMap = useMemo(() => {
    const map = new Map();
    for (const occ of occurrences) {
      map.set(`${occ.task_id}__${occ.date}`, occ);
    }
    return map;
  }, [occurrences]);

  // Generate date range based on props from App (dynamic based on earliest occurrence)
  const dates = useMemo(() => {
    const result = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Use provided dates or fall back to defaults
    let startDate;
    if (gridStartDate) {
      startDate = new Date(gridStartDate);
    } else {
      // Default: yesterday
      startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 1);
    }
    startDate.setHours(0, 0, 0, 0);

    let endDate;
    if (gridEndDate) {
      endDate = new Date(gridEndDate);
    } else {
      // Default: 3 months from today (reduced from 1yr+1mo)
      endDate = new Date(today);
      endDate.setMonth(endDate.getMonth() + 3);
    }
    endDate.setHours(0, 0, 0, 0);

    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      result.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return result;
  }, [gridStartDate, gridEndDate]);

  const isTextBlurred = (taskId) => {
    if (!privacyMode || privacyMode === 'normal') return false;
    if (privacyMode === 'blurAll') return true;
    if (privacyMode === 'spotlight') {
      // Blur everything except the spotlight columns
      return !(spotlightTaskIds && spotlightTaskIds.includes(taskId));
    }
    return false;
  };

  // Fast lookup for timing indicator
  const timingKeySet = useMemo(() => {
    const set = new Set();
    (activeTimers || []).forEach(t => {
      if (t?.taskId && t?.date) set.add(`${t.taskId}__${t.date}`);
    });
    return set;
  }, [activeTimers]);

  // --- Fix 2: Event delegation handlers (useCallback for stable refs) ---
  // Single click handler on <tbody> replaces per-cell onClick closures
  const handleBodyClick = useCallback((e) => {
    const td = e.target.closest('td.task-cell');
    if (!td) return;
    const taskId = td.dataset.taskId;
    const dateStr = td.dataset.date;
    if (!taskId || !dateStr) return;

    setHoveredCell(null);
    // In privacy modes, block clicks on blurred cells (prevents accidental leakage)
    if (privacyMode && privacyMode !== 'normal') {
      if (privacyMode === 'spotlight' && spotlightTaskIds && spotlightTaskIds.includes(taskId)) {
        onCellClick(taskId, dateStr);
      }
      return;
    }
    onCellClick(taskId, dateStr);
  }, [privacyMode, spotlightTaskIds, onCellClick]);

  // Single mouseover handler on <tbody> replaces per-cell onMouseEnter closures
  const handleBodyMouseOver = useCallback((e) => {
    if (privacyMode && privacyMode !== 'normal') return;
    const td = e.target.closest('td.task-cell');
    if (!td) {
      // Mouse moved to a non-task-cell element (date cell, etc.) — dismiss hover
      if (hoveredTdRef.current) {
        hoveredTdRef.current = null;
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => setHoveredCell(null), 150);
      }
      return;
    }
    if (td === hoveredTdRef.current) return; // Same cell, skip
    hoveredTdRef.current = td;

    const taskId = td.dataset.taskId;
    const dateStr = td.dataset.date;
    if (!taskId || !dateStr) return;

    // Clear any pending timeout
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);

    // Delay showing popup slightly to avoid flicker
    hoverTimeoutRef.current = setTimeout(() => {
      const rect = td.getBoundingClientRect();
      const wrapper = gridWrapperRef.current;
      const wrapperRect = wrapper?.getBoundingClientRect() || { left: 0, top: 0 };
      const scrollLeft = wrapper?.scrollLeft || 0;
      const scrollTop = wrapper?.scrollTop || 0;

      setHoveredCell({
        taskId,
        date: dateStr,
        x: rect.left - wrapperRect.left + scrollLeft + rect.width / 2,
        y: rect.top - wrapperRect.top + scrollTop
      });
    }, 200);
  }, [privacyMode]);

  // Single mouseout handler on <tbody> replaces per-cell onMouseLeave closures
  const handleBodyMouseOut = useCallback((e) => {
    const tbody = e.currentTarget;
    // Only act when actually leaving the tbody (not moving between cells within it)
    if (e.relatedTarget && tbody.contains(e.relatedTarget)) return;

    hoveredTdRef.current = null;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    // Delay hiding to allow moving to popup
    hoverTimeoutRef.current = setTimeout(() => setHoveredCell(null), 150);
  }, []);

  const handlePopupMouseEnter = () => {
    // Keep popup visible when mouse enters it
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  };

  const handlePopupMouseLeave = () => {
    setHoveredCell(null);
  };

  // Screenshot mode header hover handlers
  const handleHeaderMouseEnter = (e, taskId) => {
    const targetEl = e.currentTarget;

    if (headerHoverTimeoutRef.current) {
      clearTimeout(headerHoverTimeoutRef.current);
    }

    headerHoverTimeoutRef.current = setTimeout(() => {
      const rect = targetEl.getBoundingClientRect();
      const wrapper = gridWrapperRef.current;
      const wrapperRect = wrapper ? wrapper.getBoundingClientRect() : { left: 0, top: 0 };
      const scrollLeft = wrapper ? wrapper.scrollLeft : 0;
      const scrollTop = wrapper ? wrapper.scrollTop : 0;
      setHoveredHeaderTaskId(taskId);
      setHoveredHeaderPos({
        x: rect.left - wrapperRect.left + scrollLeft + rect.width / 2,
        y: rect.bottom - wrapperRect.top + scrollTop
      });
    }, 150);
  };

  const handleHeaderMouseLeave = () => {
    if (headerHoverTimeoutRef.current) {
      clearTimeout(headerHoverTimeoutRef.current);
    }
    headerHoverTimeoutRef.current = setTimeout(() => {
      setHoveredHeaderTaskId(null);
      setHoveredHeaderPos(null);
    }, 150);
  };

  const handleScreenshotPopupMouseEnter = () => {
    if (headerHoverTimeoutRef.current) {
      clearTimeout(headerHoverTimeoutRef.current);
    }
  };

  const handleScreenshotPopupMouseLeave = () => {
    setHoveredHeaderTaskId(null);
    setHoveredHeaderPos(null);
  };

  // Clipboard actions for hovered cell — using occurrenceMap for O(1) lookup
  const handleHoverCopy = (e) => {
    e.stopPropagation();
    if (!hoveredCell) return;
    const occ = occurrenceMap.get(`${hoveredCell.taskId}__${hoveredCell.date}`) || null;
    if (occ) {
      onCopy(occ);
    }
    setHoveredCell(null);
  };

  const handleHoverCut = (e) => {
    e.stopPropagation();
    if (!hoveredCell) return;
    const occ = occurrenceMap.get(`${hoveredCell.taskId}__${hoveredCell.date}`) || null;
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

  // Get info for current hovered cell — O(1) lookup
  const hoveredOccurrence = hoveredCell
    ? (occurrenceMap.get(`${hoveredCell.taskId}__${hoveredCell.date}`) || null)
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
                  onMouseEnter={(e) => handleHeaderMouseEnter(e, task.id)}
                  onMouseLeave={handleHeaderMouseLeave}
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
          <GridTableBody
            dates={dates}
            activeTasks={activeTasks}
            occurrenceMap={occurrenceMap}
            rowDensity={rowDensity}
            timingKeySet={timingKeySet}
            privacyMode={privacyMode}
            spotlightTaskIds={spotlightTaskIds}
            todayRowRef={todayRowRef}
            onExtendFuture={onExtendFuture}
            onBodyClick={handleBodyClick}
            onBodyMouseOver={handleBodyMouseOver}
            onBodyMouseOut={handleBodyMouseOut}
          />
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

      {/* Screenshot mode: Eye/Blur toggle on task headers */}
      {privacyMode && privacyMode !== 'normal' && hoveredHeaderTaskId && hoveredHeaderPos && (
        <div
          className="screenshot-toggle-popup"
          style={{
            left: hoveredHeaderPos.x,
            top: hoveredHeaderPos.y
          }}
          onMouseEnter={handleScreenshotPopupMouseEnter}
          onMouseLeave={handleScreenshotPopupMouseLeave}
        >
          {isTextBlurred(hoveredHeaderTaskId) ? (
            <button
              className="popup-btn screenshot-btn"
              onClick={() => onSpotlightTask && onSpotlightTask(hoveredHeaderTaskId)}
              title="Show this column"
            >
              👁️
            </button>
          ) : (
            <button
              className="popup-btn screenshot-btn"
              onClick={() => onUnspotlightTask && onUnspotlightTask(hoveredHeaderTaskId)}
              title="Blur this column"
            >
              🌫️
            </button>
          )}
        </div>
      )}

      {/* Normal mode: "+" button on task headers to insert new task to the left */}
      {(!privacyMode || privacyMode === 'normal') && hoveredHeaderTaskId && hoveredHeaderPos && onAddTaskAt && (
        <div
          className="header-add-popup"
          style={{
            left: hoveredHeaderPos.x,
            top: hoveredHeaderPos.y,
            transform: 'translateX(-50%)'
          }}
          onMouseEnter={handleScreenshotPopupMouseEnter}
          onMouseLeave={handleScreenshotPopupMouseLeave}
        >
          <button
            className="popup-btn"
            onClick={() => {
              onAddTaskAt(hoveredHeaderTaskId);
              setHoveredHeaderTaskId(null);
              setHoveredHeaderPos(null);
            }}
            title="Insert new task to the left"
          >
            +
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
