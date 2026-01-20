export const translations = {
  en: {
    appTitle: 'Task Grid',
    addTask: '+ Add Task',
    exportCSV: 'Export CSV',
    normalRows: 'Normal Rows',
    thinRows: 'Thin Rows',
    fatRows: 'Fat Rows',
    taskDetail: 'Task Detail',
    startTimer: 'Start Timer',
    stopTimer: 'Stop Timer',
    status: 'Status',
    planned: 'Planned',
    done: 'Done',
    skipped: 'Skipped',
    title: 'Title',
    notes: 'Notes',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    addTaskTitle: 'Add Task',
    editTaskTitle: 'Edit Task',
    taskName: 'Task Name',
    color: 'Color',
    noTimeEntries: 'No time entries yet',
    timeEntries: 'Time Entries',
    total: 'Total',
  },
  zh: {
    appTitle: '任务网格',
    addTask: '+ 添加任务',
    exportCSV: '导出CSV',
    normalRows: '普通行',
    thinRows: '紧凑行',
    fatRows: '宽松行',
    taskDetail: '任务详情',
    startTimer: '开始计时',
    stopTimer: '停止计时',
    status: '状态',
    planned: '计划',
    done: '完成',
    skipped: '跳过',
    title: '标题',
    notes: '备注',
    delete: '删除',
    save: '保存',
    cancel: '取消',
    addTaskTitle: '添加任务',
    editTaskTitle: '编辑任务',
    taskName: '任务名称',
    color: '颜色',
    noTimeEntries: '暂无计时记录',
    timeEntries: '计时记录',
    total: '总计',
  }
};

export const defaultColors = [
  '#FF3B30',
  '#FF6B6B',
  '#EF476F',
  '#E53935',
  '#FF9500',
  '#FFB74D',
  '#F4A261',
  '#FFCC00',
  '#FFD166',
  '#F9E900',
  '#34C759',
  '#2ECC71',
  '#06FFA5',
  '#00C7BE',
  '#4ECDC4',
  '#2EC4B6',
  '#007AFF',
  '#118AB2',
  '#3A86FF',
  '#4361EE',
  '#5856D6',
  '#5E60CE',
  '#AF52DE',
  '#9B5DE5',
  '#8338EC',
  '#6A00F4'
];

export const lightenColor = (color, percent) => {
  const num = parseInt(color.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = (num >> 8 & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
    (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
    (B < 255 ? B < 1 ? 0 : B : 255))
    .toString(16).slice(1);
};

export const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
};
