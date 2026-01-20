import { getTasks, getOccurrences, getSetting, getTimeEntries } from './database';
import { save } from '@tauri-apps/api/dialog';
import { writeTextFile } from '@tauri-apps/api/fs';

// Helper to download a file using Tauri's save dialog
const downloadFile = async (filename, content, type = 'text/csv') => {
  try {
    // Try Tauri's save dialog first (works in Tauri app)
    const filePath = await save({
      defaultPath: filename,
      filters: [{
        name: type === 'application/json' ? 'JSON' : 'CSV',
        extensions: [type === 'application/json' ? 'json' : 'csv']
      }]
    });

    if (filePath) {
      await writeTextFile(filePath, content);
      return true;
    }
    return false;
  } catch (e) {
    // Fallback to browser download (for web version)
    console.log('Tauri save failed, using browser download:', e);
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  }
};

// Export all data as CSV files
export const exportAllData = async () => {
  try {
    const tasks = await getTasks();
    
    // Get date range for occurrences (last 90 days + next 90 days)
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 90);
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 90);
    
    const occurrences = await getOccurrences(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    // Export tasks
    let tasksCSV = 'ID,Name,Color,Group,Description,Sort Order,Archived\n';
    tasks.forEach(task => {
      tasksCSV += `${task.id},"${task.name}",${task.color},"${task.group_id || ''}","${task.description || ''}",${task.sort_order},${task.archived}\n`;
    });
    await downloadFile('tasks.csv', tasksCSV);

    // Export occurrences
    let occurrencesCSV = 'ID,Task ID,Date,Status,Title,Notes,Created At\n';
    occurrences.forEach(occ => {
      occurrencesCSV += `${occ.id},${occ.task_id},${occ.date},${occ.status},"${occ.title || ''}","${occ.notes || ''}",${occ.created_at}\n`;
    });
    await downloadFile('occurrences.csv', occurrencesCSV);

    return { tasks, occurrences };
  } catch (error) {
    console.error('Error exporting data:', error);
    throw error;
  }
};

// Export tasks and groups as JSON bundle for import/export
export const exportTaskBundle = async (includeGroups = true, filterGroupId = null) => {
  try {
    const allTasks = await getTasks();
    
    // Filter tasks by group if specified
    const tasks = filterGroupId !== null 
      ? allTasks.filter(t => t.group_id === filterGroupId)
      : allTasks;
    
    const taskIds = tasks.map(t => t.id);
    
    // Get occurrences for these tasks (last 365 days + next 365 days)
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 365);
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 365);
    
    const allOccurrences = await getOccurrences(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );
    
    // Filter occurrences for our tasks
    const occurrences = allOccurrences.filter(o => taskIds.includes(o.task_id));
    
    // Get time entries for these occurrences
    const allTimeEntries = [];
    for (const occ of occurrences) {
      try {
        const entries = await getTimeEntries(occ.id);
        allTimeEntries.push(...entries);
      } catch (e) {
        console.warn('Could not load time entries for occurrence:', occ.id);
      }
    }
    
    // Extract unique groups from tasks
    const groups = {};
    tasks.forEach(task => {
      if (task.group_id && !groups[task.group_id]) {
        groups[task.group_id] = {
          id: task.group_id,
          name: task.group_id,
        };
      }
    });

    const bundle = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      filter_group: filterGroupId,
      tasks: tasks.map(t => ({
        id: t.id, // Include ID for occurrences reference
        name: t.name,
        color: t.color,
        group_id: t.group_id,
        description: t.description,
        sort_order: t.sort_order,
      })),
      occurrences: occurrences.map(o => ({
        id: o.id, // Include the occurrence ID
        task_id: o.task_id,
        date: o.date,
        status: o.status,
        title: o.title,
        notes: o.notes,
      })),
      time_entries: allTimeEntries.map(e => ({
        occurrence_id: e.occurrence_id,
        start_time: e.start_time,
        end_time: e.end_time,
        duration: e.duration,
      })),
      groups: includeGroups ? Object.values(groups) : [],
    };

    const filename = filterGroupId 
      ? `task_bundle_${filterGroupId}.json`
      : 'task_bundle.json';
    
    const json = JSON.stringify(bundle, null, 2);
    await downloadFile(filename, json, 'application/json');
    
    return bundle;
  } catch (error) {
    console.error('Error exporting task bundle:', error);
    throw error;
  }
};

// Import task bundle
export const importTaskBundle = async (jsonContent, createTaskFn, createOccurrenceFn, createTimeEntryFn) => {
  try {
    const bundle = JSON.parse(jsonContent);
    
    if (!bundle.version || !bundle.tasks) {
      throw new Error('Invalid task bundle format');
    }

    // Map old task IDs to new task IDs
    const taskIdMap = {};
    const occurrenceIdMap = {};
    
    // Import tasks
    let importedTasks = 0;
    for (const taskData of bundle.tasks) {
      const oldTaskId = taskData.id;
      const newTaskId = Date.now().toString(36) + Math.random().toString(36).substr(2);
      
      const newTask = {
        id: newTaskId,
        name: taskData.name,
        color: taskData.color,
        group_id: taskData.group_id || null,
        description: taskData.description || null,
        sort_order: taskData.sort_order || 0,
        archived: false,
        icon: null,
      };
      
      await createTaskFn(newTask);
      taskIdMap[oldTaskId] = newTaskId;
      importedTasks++;
    }

    // Import occurrences
    let importedOccurrences = 0;
    if (bundle.occurrences && createOccurrenceFn) {
      for (const occData of bundle.occurrences) {
        const newTaskId = taskIdMap[occData.task_id];
        if (!newTaskId) continue; // Skip if task wasn't imported
        
        const oldOccId = occData.id; // Use the actual occurrence ID from export
        const newOccId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        
        const newOccurrence = {
          id: newOccId,
          task_id: newTaskId,
          date: occData.date,
          status: occData.status || 'planned',
          title: occData.title || '',
          notes: occData.notes || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        await createOccurrenceFn(newOccurrence);
        occurrenceIdMap[oldOccId] = newOccId;
        importedOccurrences++;
        
        // Small delay to ensure unique IDs
        await new Promise(resolve => setTimeout(resolve, 2));
      }
    }

    // Import time entries
    let importedTimeEntries = 0;
    if (bundle.time_entries && createTimeEntryFn) {
      for (const entryData of bundle.time_entries) {
        const newOccId = occurrenceIdMap[entryData.occurrence_id];
        if (!newOccId) continue; // Skip if occurrence wasn't imported
        
        const newEntry = {
          id: Date.now().toString(36) + Math.random().toString(36).substr(2),
          occurrence_id: newOccId,
          start_time: entryData.start_time,
          end_time: entryData.end_time,
          duration: entryData.duration,
        };
        
        await createTimeEntryFn(newEntry);
        importedTimeEntries++;
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 2));
      }
    }

    return { 
      tasks: importedTasks, 
      occurrences: importedOccurrences,
      timeEntries: importedTimeEntries,
      total: bundle.tasks.length 
    };
  } catch (error) {
    console.error('Error importing task bundle:', error);
    throw error;
  }
};
