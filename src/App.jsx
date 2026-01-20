import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Grid from './components/Grid';
import CellModal from './components/CellModal';
import TaskModal from './components/TaskModal';
import TaskDetailsPage from './components/TaskDetailsPage';
import { 
  getTasks, 
  getOccurrences, 
  getSetting, 
  setSetting,
  createTask,
  createOccurrence,
  updateOccurrence,
  deleteOccurrence,
  createTimeEntry,
  generateId
} from './services/database';
import { loadDemoTasks } from './services/initTutorial';
import './App.css';

function App() {
  const [tasks, setTasks] = useState([]);
  const [occurrences, setOccurrences] = useState([]);
  const [language, setLanguage] = useState('en');
  const [rowDensity, setRowDensity] = useState('normal');
  const [columnWidth, setColumnWidth] = useState('fixed');
  const [columnOrder, setColumnOrder] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false); // Track if we've ever loaded data
  const [currentPage, setCurrentPage] = useState('grid');

  // Privacy / screenshot mode
  // - normal: everything visible
  // - blurAll: blur all task text
  // - spotlight: blur all except a selected task column
  const [privacyMode, setPrivacyMode] = useState('normal');
  const [spotlightTaskId, setSpotlightTaskId] = useState(null);
  
  const [cellModalOpen, setCellModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);

  // Clipboard state for copy/cut/paste
  const [clipboard, setClipboard] = useState(null); // { occurrence, isCut }

  // Undo delete state - stores the last deleted item for potential restore
  // Structure: { type: 'task'|'occurrence', data: {...}, relatedData: [...] }
  const [deletedItem, setDeletedItem] = useState(null);

  // Multi timers (kept in-memory; persisted as time entries on stop)
  const [activeTimers, setActiveTimers] = useState([]); // [{ taskId, date, startTs }]
  const [timerNow, setTimerNow] = useState(Date.now());

  // Keep a ticking "now" only while at least one timer is running
  useEffect(() => {
    if (!activeTimers || activeTimers.length === 0) return;
    const id = setInterval(() => setTimerNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [activeTimers]);

  // Load initial data
  useEffect(() => {
    // Only show the full-screen loading state on initial mount.
    // Subsequent refreshes (e.g., after editing a cell) should NOT unmount/remount the Grid,
    // otherwise the grid's "scroll to today on initial mount" behavior will run again.
    loadData({ showLoading: true });
  }, []);

  const loadData = async ({ showLoading = false } = {}) => {
    try {
      if (showLoading) setLoading(true);
      
      // Load settings
      const savedLanguage = await getSetting('language');
      const savedDensity = await getSetting('row_density');
      const savedColumnWidth = await getSetting('column_width');
      const savedColumnOrder = await getSetting('column_order');
      
      if (savedLanguage) setLanguage(savedLanguage);
      if (savedDensity) setRowDensity(savedDensity);
      if (savedColumnWidth) setColumnWidth(savedColumnWidth);
      else setColumnWidth('fixed');
      if (savedColumnOrder) {
        try {
          const parsedOrder = JSON.parse(savedColumnOrder);
          if (Array.isArray(parsedOrder)) {
            setColumnOrder(parsedOrder);
          }
        } catch (e) {
          console.error('Error parsing column order:', e);
        }
      }
      
      // Load tasks
      const tasksData = await getTasks();
      setTasks(tasksData);
      
      // Load occurrences for date range
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - 365);
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 100);
      
      const occurrencesData = await getOccurrences(
        formatDate(startDate),
        formatDate(endDate)
      );
      setOccurrences(occurrencesData);
      setDataLoaded(true);
      
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const formatDate = (date) => {
    // Use local timezone instead of UTC
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleLanguageChange = async (newLanguage) => {
    setLanguage(newLanguage);
    await setSetting('language', newLanguage);
  };

  const handleDensityChange = async (newDensity) => {
    setRowDensity(newDensity);
    await setSetting('row_density', newDensity);
  };

  const handleColumnWidthChange = async (newWidth) => {
    setColumnWidth(newWidth);
    await setSetting('column_width', newWidth);
  };

  const handleColumnOrderChange = async (newOrder) => {
    setColumnOrder(newOrder);
    await setSetting('column_order', JSON.stringify(newOrder));
  };

  const togglePrivacyMode = () => {
    setPrivacyMode((prev) => {
      if (prev === 'normal') return 'blurAll';
      // Any privacy mode -> back to normal
      return 'normal';
    });
    setSpotlightTaskId(null);
  };

  const spotlightTask = (taskId) => {
    if (!taskId) return;
    setSpotlightTaskId(taskId);
    setPrivacyMode('spotlight');
  };

  const clearSpotlight = () => {
    setSpotlightTaskId(null);
    setPrivacyMode('blurAll');
  };

  const handleCellClick = (taskId, date) => {
    // In privacy mode, avoid opening details (prevents accidental leakage on screenshots/screenshares)
    if (privacyMode !== 'normal') return;
    setSelectedCell({ taskId, date });
    setCellModalOpen(true);
  };

  const handleTaskClick = (taskId) => {
    // In privacy mode, avoid opening task details
    if (privacyMode !== 'normal') return;
    setSelectedTask(taskId);
    setTaskModalOpen(true);
  };

  const handleAddTask = () => {
    setSelectedTask(null);
    setTaskModalOpen(true);
  };

  const handleLoadDemo = async () => {
    try {
      const result = await loadDemoTasks();
      if (result.success) {
        alert(`Demo loaded! Created ${result.tasks} tasks with ${result.occurrences} entries.`);
        await loadData({ showLoading: true });
      } else {
        alert('Failed to load demo tasks: ' + (result.error?.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error loading demo:', error);
      alert('Failed to load demo tasks: ' + error.message);
    }
  };

  // Undo delete handlers
  const setDeletedItemForUndo = (item) => {
    setDeletedItem(item);
  };

  const handleUndoDelete = async () => {
    if (!deletedItem) return false;

    try {
      if (deletedItem.type === 'task') {
        // Restore the task
        await createTask(deletedItem.data);
        
        // Restore related occurrences
        if (deletedItem.relatedOccurrences) {
          for (const occ of deletedItem.relatedOccurrences) {
            await createOccurrence(occ);
          }
        }
        
        // Restore related time entries
        if (deletedItem.relatedTimeEntries) {
          for (const entry of deletedItem.relatedTimeEntries) {
            await createTimeEntry(entry);
          }
        }
      } else if (deletedItem.type === 'occurrence') {
        // Restore the occurrence
        await createOccurrence(deletedItem.data);
        
        // Restore related time entries
        if (deletedItem.relatedTimeEntries) {
          for (const entry of deletedItem.relatedTimeEntries) {
            await createTimeEntry(entry);
          }
        }
      }

      setDeletedItem(null);
      await loadData();
      return true; // Signal success so caller can reload their own data
    } catch (error) {
      console.error('Error undoing delete:', error);
      alert('Failed to undo delete: ' + (error?.message || String(error)));
      return false;
    }
  };

  const clearDeletedItem = () => {
    setDeletedItem(null);
  };

  // Clipboard handlers
  const handleCopy = (occurrence) => {
    setClipboard({ occurrence: { ...occurrence }, isCut: false });
  };

  const handleCut = (occurrence) => {
    setClipboard({ occurrence: { ...occurrence }, isCut: true });
  };

  const handleClearClipboard = () => {
    setClipboard(null);
  };

  const handlePaste = async (targetTaskId, targetDate) => {
    if (!clipboard?.occurrence) return;

    const sourceOcc = clipboard.occurrence;
    
    try {
      // Check if target cell already has an occurrence
      const existingOcc = occurrences.find(
        o => o.task_id === targetTaskId && o.date === targetDate
      );

      if (existingOcc) {
        // Update existing occurrence with pasted content
        const updatedOccurrence = {
          ...existingOcc,
          title: sourceOcc.title || '',
          notes: sourceOcc.notes || '',
          status: sourceOcc.status || 'planned',
          updated_at: new Date().toISOString(),
        };
        await updateOccurrence(updatedOccurrence);
      } else {
        // Create new occurrence with pasted content
        const newOccurrence = {
          id: generateId(),
          task_id: targetTaskId,
          date: targetDate,
          status: sourceOcc.status || 'planned',
          title: sourceOcc.title || '',
          notes: sourceOcc.notes || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await createOccurrence(newOccurrence);
      }

      // If it was a cut operation, delete the source occurrence
      if (clipboard.isCut) {
        await deleteOccurrence(sourceOcc.id);
        setClipboard(null);
      }

      // Refresh data
      await loadData();
    } catch (error) {
      console.error('Error pasting occurrence:', error);
    }
  };

  const clearClipboard = () => {
    setClipboard(null);
  };

  // Timer handlers
  const ensureOccurrenceId = async (taskId, occurrenceDate) => {
    // 1) Try current in-memory occurrences first
    const local = occurrences.find(o => o.task_id === taskId && o.date === occurrenceDate);
    if (local?.id) return local.id;

    // 2) Ask backend for that specific day (in case it was created in a modal without a full refresh)
    try {
      const occs = await getOccurrences(occurrenceDate, occurrenceDate);
      const found = (occs || []).find(o => o.task_id === taskId && o.date === occurrenceDate);
      if (found?.id) return found.id;
    } catch (e) {
      // ignore and fall through to create
    }

    // 3) Create it (UNIQUE(task_id, date) will prevent duplicates)
    const newOcc = {
      id: generateId(),
      task_id: taskId,
      date: occurrenceDate,
      status: 'planned',
      title: '',
      notes: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const created = await createOccurrence(newOcc);
    return created.id;
  };

  const handleStartTimer = (taskId, occurrenceDate) => {
    if (!taskId || !occurrenceDate) return;
    setActiveTimers((prev) => {
      if (prev.some(t => t.taskId === taskId && t.date === occurrenceDate)) return prev;
      return [...prev, { taskId, date: occurrenceDate, startTs: Date.now() }];
    });
  };

  const handleStopTimer = async (taskId, occurrenceDate) => {
    const tm = activeTimers.find(t => t.taskId === taskId && t.date === occurrenceDate);
    if (!tm) return;

    const end = Date.now();
    const start = Number(tm.startTs);
    const durationSec = Math.max(1, Math.floor((end - start) / 1000));
    const startIso = new Date(start).toISOString();
    const endIso = new Date(end).toISOString();

    // Date on time entries represents the day work actually happened (today),
    // even if timing was started from a past occurrence cell.
    const todayIsoDate = formatDate(new Date());

    const occurrenceId = await ensureOccurrenceId(taskId, occurrenceDate);
    await createTimeEntry({
      id: generateId(),
      occurrence_id: occurrenceId,
      task_id: taskId,
      date: todayIsoDate,
      start_time: startIso,
      end_time: endIso,
      duration: durationSec,
    });

    setActiveTimers((prev) => prev.filter(t => !(t.taskId === taskId && t.date === occurrenceDate)));
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading Task Grid...</p>
      </div>
    );
  }

  return (
    <div className="app">
      {currentPage === 'grid' ? (
        <>
          <Header
            language={language}
            rowDensity={rowDensity}
            columnWidth={columnWidth}
            onLanguageChange={handleLanguageChange}
            onDensityChange={handleDensityChange}
            onColumnWidthChange={handleColumnWidthChange}
            onAddTask={handleAddTask}
            onViewTasks={() => setCurrentPage('tasks')}
            onLoadDemo={handleLoadDemo}
            clipboard={clipboard}
            activeTimers={activeTimers}
            tasks={tasks}
            privacyMode={privacyMode}
            spotlightTaskId={spotlightTaskId}
            onTogglePrivacy={togglePrivacyMode}
            onClearSpotlight={clearSpotlight}
          />
          
          <Grid
            tasks={tasks}
            occurrences={occurrences}
            rowDensity={rowDensity}
            columnWidth={columnWidth}
            language={language}
            dataLoaded={dataLoaded}
            onCellClick={handleCellClick}
            onTaskClick={handleTaskClick}
            onLoadDemo={handleLoadDemo}
            deletedItem={deletedItem}
            onUndoDelete={handleUndoDelete}
            onClearDeletedItem={clearDeletedItem}
            activeTimers={activeTimers}
            privacyMode={privacyMode}
            spotlightTaskId={spotlightTaskId}
            onSpotlightTask={spotlightTask}
            clipboard={clipboard}
            onCopy={handleCopy}
            onCut={handleCut}
            onPaste={handlePaste}
            onClearClipboard={handleClearClipboard}
            columnOrder={columnOrder}
            onColumnOrderChange={handleColumnOrderChange}
          />
        </>
      ) : (
        <TaskDetailsPage
          language={language}
          onClose={() => setCurrentPage('grid')}
          onUpdate={() => loadData({ showLoading: false })}
          deletedItem={deletedItem}
          onSetDeletedItem={setDeletedItemForUndo}
          onUndoDelete={handleUndoDelete}
          onClearDeletedItem={clearDeletedItem}
        />
      )}
      
      {cellModalOpen && (
        <CellModal
          taskId={selectedCell?.taskId}
          date={selectedCell?.date}
          tasks={tasks}
          occurrences={occurrences}
          language={language}
          activeTimers={activeTimers}
          timerNow={timerNow}
          onStartTimer={handleStartTimer}
          onStopTimer={handleStopTimer}
          onClose={() => setCellModalOpen(false)}
          onUpdate={loadData}
          onSetDeletedItem={setDeletedItemForUndo}
        />
      )}

      {taskModalOpen && (
        <TaskModal
          taskId={selectedTask}
          tasks={tasks}
          language={language}
          onClose={() => setTaskModalOpen(false)}
          onUpdate={loadData}
        />
      )}
    </div>
  );
}

export default App;
