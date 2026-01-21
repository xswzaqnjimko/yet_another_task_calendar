/**
 * Tutorial/Demo Data Loader
 * 
 * This module handles loading demo/sample tasks on user request.
 * Called when user clicks "Load Demo Tasks" button.
 */

import { tutorialTemplate } from './tutorialData';
import {
  createTask,
  createOccurrence,
  createTimeEntry,
  setSetting,
  generateId,
} from './database';

const MGMT_ORDER_KEY = 'mgmt_group_task_order';
const GRID_ORDER_KEY = 'column_order';  // Must match App.jsx
const GROUP_ORDER_KEY = 'group_order';

/**
 * Format a Date object to YYYY-MM-DD string (local timezone)
 */
const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get a date offset from today
 */
const getOffsetDate = (dayOffset) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + dayOffset);
  return formatDate(date);
};

/**
 * Generate a random integer between min and max (inclusive)
 */
const randomInt = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Load demo/tutorial tasks
 * Creates sample tasks, occurrences, time entries, and sets up ordering
 * 
 * @returns {Promise<{success: boolean, tasks: number, occurrences: number, timeEntries: number, error?: any}>}
 */
export const loadDemoTasks = async () => {
  try {
    console.log('[Demo] Starting demo data import...');

    const { groups, tasks, occurrences, groupOrder, managementTaskOrder, gridOrder } = tutorialTemplate;

    // Map from refId to actual task ID
    const refIdToTaskId = {};
    let timeEntriesCount = 0;

    // Step 1: Create tasks
    console.log(`[Demo] Creating ${tasks.length} tasks...`);
    for (const taskTemplate of tasks) {
      const taskId = generateId();
      refIdToTaskId[taskTemplate.refId] = taskId;

      const newTask = {
        id: taskId,
        name: taskTemplate.name,
        color: taskTemplate.color,
        group_id: taskTemplate.group_id || null,
        description: taskTemplate.description || null,
        sort_order: taskTemplate.sort_order || 0,
        archived: false,
        icon: null,
      };

      await createTask(newTask);
      
      // Small delay to ensure unique timestamps
      await new Promise(resolve => setTimeout(resolve, 5));
    }

    // Step 2: Create occurrences with actual dates, status, and time records
    console.log(`[Demo] Creating ${occurrences.length} occurrences...`);
    for (const occTemplate of occurrences) {
      const taskId = refIdToTaskId[occTemplate.taskRef];
      if (!taskId) {
        console.warn(`[Demo] Unknown task ref: ${occTemplate.taskRef}`);
        continue;
      }

      const occDate = getOffsetDate(occTemplate.dayOffset);
      const occId = generateId();

      const newOccurrence = {
        id: occId,
        task_id: taskId,
        date: occDate,
        status: occTemplate.status || 'planned',
        title: occTemplate.title || '',
        notes: occTemplate.notes || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await createOccurrence(newOccurrence);
      
      // Create time entry if specified
      if (occTemplate.timeRecord) {
        const { minMinutes, maxMinutes } = occTemplate.timeRecord;
        const durationMinutes = randomInt(minMinutes, maxMinutes);
        const durationSeconds = durationMinutes * 60;
        
        // Create a plausible start time (morning hours on that day)
        const startHour = randomInt(7, 10);
        const startMinute = randomInt(0, 59);
        
        const startDate = new Date();
        startDate.setDate(startDate.getDate() + occTemplate.dayOffset);
        startDate.setHours(startHour, startMinute, 0, 0);
        
        const endDate = new Date(startDate.getTime() + durationSeconds * 1000);
        
        const timeEntry = {
          id: generateId(),
          occurrence_id: occId,
          task_id: taskId,
          date: occDate,
          start_time: startDate.toISOString(),
          end_time: endDate.toISOString(),
          duration: durationSeconds,
        };
        
        await createTimeEntry(timeEntry);
        timeEntriesCount++;
      }
      
      // Small delay
      await new Promise(resolve => setTimeout(resolve, 2));
    }

    // Step 3: Set up group order for Management page
    console.log('[Demo] Setting up group order...');
    await setSetting(GROUP_ORDER_KEY, JSON.stringify(groupOrder));

    // Step 4: Set up task order within groups for Management page
    console.log('[Demo] Setting up management task order...');
    const mgmtOrderMap = {};
    for (const [groupId, refIds] of Object.entries(managementTaskOrder)) {
      const groupKey = groupId || '__UNGROUPED__';
      mgmtOrderMap[groupKey] = refIds.map(refId => refIdToTaskId[refId]).filter(Boolean);
    }
    await setSetting(MGMT_ORDER_KEY, JSON.stringify(mgmtOrderMap));

    // Step 5: Set up Grid column order
    console.log('[Demo] Setting up grid column order...');
    const gridTaskOrder = gridOrder.map(refId => refIdToTaskId[refId]).filter(Boolean);
    await setSetting(GRID_ORDER_KEY, JSON.stringify(gridTaskOrder));

    console.log('[Demo] Demo data import complete!');
    return {
      success: true,
      tasks: tasks.length,
      occurrences: occurrences.length,
      timeEntries: timeEntriesCount,
    };
  } catch (error) {
    console.error('[Demo] Error loading demo data:', error);
    return { 
      success: false, 
      tasks: 0, 
      occurrences: 0, 
      timeEntries: 0,
      error 
    };
  }
};
