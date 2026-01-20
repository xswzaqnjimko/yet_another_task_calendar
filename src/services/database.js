import { invoke } from '@tauri-apps/api/tauri';

// Helper to generate unique IDs
export const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Tasks
export const getTasks = async () => {
  return await invoke('get_tasks');
};

export const createTask = async (task) => {
  return await invoke('create_task', { task });
};

export const updateTask = async (task) => {
  return await invoke('update_task', { task });
};

export const deleteTask = async (taskId) => {
  return await invoke('delete_task', { taskId });
};

// Occurrences
export const getOccurrences = async (startDate, endDate) => {
  return await invoke('get_occurrences', { startDate, endDate });
};

export const createOccurrence = async (occurrence) => {
  return await invoke('create_occurrence', { occurrence });
};

export const updateOccurrence = async (occurrence) => {
  return await invoke('update_occurrence', { occurrence });
};

export const deleteOccurrence = async (occurrenceId) => {
  return await invoke('delete_occurrence', { occurrenceId });
};

// Time Entries
export const getTimeEntries = async (occurrenceId) => {
  return await invoke('get_time_entries', { occurrenceId });
};

export const createTimeEntry = async (entry) => {
  return await invoke('create_time_entry', { entry });
};

// Settings
export const getSetting = async (key) => {
  return await invoke('get_setting', { key });
};

export const setSetting = async (key, value) => {
  return await invoke('set_setting', { key, value });
};

// Database Path
export const getDatabasePath = async () => {
  return await invoke('get_database_path');
};
