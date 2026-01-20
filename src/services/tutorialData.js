/**
 * Tutorial Data Template
 * 
 * This file contains the template for tutorial tasks that are shown on first run.
 * Dates are specified as offsets from "today" (e.g., 0 = today, 1 = tomorrow, -1 = yesterday).
 * 
 * Colors used:
 * - Light green: #34C759
 * - Orange: #FF9500
 * - Pale purple: #AF52DE
 * - Gold: #FFD700
 * - Dark red: #C41E3A
 * - Bright blue: #007AFF
 */

export const tutorialTemplate = {
  // Group definitions
  groups: [
    { id: '小卡爱工作', name: '小卡爱工作' },
    { id: '小卡爱生活', name: '小卡爱生活' },
  ],

  // Task definitions with temporary IDs (will be replaced with real IDs on import)
  tasks: [
    // Group 1: 小卡爱生活
    {
      refId: 'task-1-1',
      name: '小卡冥想',
      color: '#34C759', // light green
      group_id: '小卡爱生活',
      description: '',
      sort_order: 0,
    },
    {
      refId: 'task-1-2',
      name: '小卡吃饭',
      color: '#FF9500', // orange
      group_id: '小卡爱生活',
      description: '',
      sort_order: 1,
    },
    {
      refId: 'task-1-3',
      name: '小卡喝茶',
      color: '#CCCCFF', // pale purple/lavender
      group_id: '小卡爱生活',
      description: '',
      sort_order: 2,
    },
    // Group 2: 小卡爱工作
    {
      refId: 'task-2-1',
      name: '小卡修路',
      color: '#FFD700', // gold
      group_id: '小卡爱工作',
      description: '',
      sort_order: 0,
    },
    {
      refId: 'task-2-2',
      name: '小卡开会',
      color: '#C41E3A', // dark red
      group_id: '小卡爱工作',
      description: '',
      sort_order: 1,
    },
    {
      refId: 'task-2-3',
      name: '小卡调药',
      color: '#007AFF', // bright blue
      group_id: '小卡爱工作',
      description: '',
      sort_order: 2,
    },
  ],

  // Occurrence definitions with day offsets from today
  occurrences: [
    // Task 1-1: 小卡冥想 - Daily for 10 days (day 0-9)
    { taskRef: 'task-1-1', dayOffset: 0, title: '意念跳篝火！', notes: '早上好～' },
    { taskRef: 'task-1-1', dayOffset: 1, title: '意念跳篝火！', notes: '早上好～' },
    { taskRef: 'task-1-1', dayOffset: 2, title: '意念跳篝火！', notes: '早上好～' },
    { taskRef: 'task-1-1', dayOffset: 3, title: '意念跳篝火！', notes: '早上好～' },
    { taskRef: 'task-1-1', dayOffset: 4, title: '意念跳篝火！', notes: '早上好～' },
    { taskRef: 'task-1-1', dayOffset: 5, title: '意念跳篝火！', notes: '早上好～' },
    { taskRef: 'task-1-1', dayOffset: 6, title: '意念跳篝火！', notes: '早上好～' },
    { taskRef: 'task-1-1', dayOffset: 7, title: '意念跳篝火！', notes: '早上好～' },
    { taskRef: 'task-1-1', dayOffset: 8, title: '意念跳篝火！', notes: '早上好～' },
    { taskRef: 'task-1-1', dayOffset: 9, title: '意念跳篝火！', notes: '早上好～' },

    // Task 1-2: 小卡吃饭 - Daily for 10 days (day 0-9)
    { taskRef: 'task-1-2', dayOffset: 0, title: '', notes: '再来一份小面包！' },
    { taskRef: 'task-1-2', dayOffset: 1, title: '', notes: '再来一份小面包！' },
    { taskRef: 'task-1-2', dayOffset: 2, title: '', notes: '再来一份小面包！' },
    { taskRef: 'task-1-2', dayOffset: 3, title: '', notes: '再来一份小面包！' },
    { taskRef: 'task-1-2', dayOffset: 4, title: '', notes: '再来一份小面包！' },
    { taskRef: 'task-1-2', dayOffset: 5, title: '', notes: '再来一份小面包！' },
    { taskRef: 'task-1-2', dayOffset: 6, title: '', notes: '再来一份小面包！' },
    { taskRef: 'task-1-2', dayOffset: 7, title: '', notes: '再来一份小面包！' },
    { taskRef: 'task-1-2', dayOffset: 8, title: '', notes: '再来一份小面包！' },
    { taskRef: 'task-1-2', dayOffset: 9, title: '', notes: '再来一份小面包！' },

    // Task 1-3: 小卡喝茶 - today, +3 days, +7 days (3 entries)
    { taskRef: 'task-1-3', dayOffset: 0, title: '兄弟干杯', notes: '' },
    { taskRef: 'task-1-3', dayOffset: 3, title: '兄弟干杯', notes: '' },
    { taskRef: 'task-1-3', dayOffset: 7, title: '兄弟干杯', notes: '' },

    // Task 2-1: 小卡修路 - today, +2 days, +5 days (3 entries)
    { taskRef: 'task-2-1', dayOffset: 0, title: '仰望星空！', notes: '脚踏实地……' },
    { taskRef: 'task-2-1', dayOffset: 2, title: '仰望星空！', notes: '脚踏实地……' },
    { taskRef: 'task-2-1', dayOffset: 5, title: '仰望星空！', notes: '脚踏实地……' },

    // Task 2-2: 小卡开会 - Every other day for 10 days (day 0, 2, 4, 6, 8 = 5 entries)
    { taskRef: 'task-2-2', dayOffset: 0, title: '中会', notes: '要记笔记' },
    { taskRef: 'task-2-2', dayOffset: 2, title: '中会', notes: '要记笔记' },
    { taskRef: 'task-2-2', dayOffset: 4, title: '中会', notes: '要记笔记' },
    { taskRef: 'task-2-2', dayOffset: 6, title: '中会', notes: '要记笔记' },
    { taskRef: 'task-2-2', dayOffset: 8, title: '中会', notes: '要记笔记' },

    // Task 2-3: 小卡调药 - tomorrow only (1 entry)
    { taskRef: 'task-2-3', dayOffset: 1, title: '轻微拉肚子即可', notes: '找桌游部试配方' },
  ],

  // Management page ordering
  // Group order: 小卡爱工作 first, then 小卡爱生活
  groupOrder: ['小卡爱工作', '小卡爱生活'],

  // Task order within each group for Management page
  // 小卡爱工作: 小卡开会 - 小卡修路 - 小卡调药
  // 小卡爱生活: 小卡吃饭 - 小卡喝茶 - 小卡冥想
  managementTaskOrder: {
    '小卡爱工作': ['task-2-2', 'task-2-1', 'task-2-3'], // 开会, 修路, 调药
    '小卡爱生活': ['task-1-2', 'task-1-3', 'task-1-1'], // 吃饭, 喝茶, 冥想
  },

  // Grid column order (left to right)
  // 小卡开会 - 小卡喝茶 - 小卡调药 - 小卡修路 - 小卡吃饭 - 小卡冥想
  gridOrder: ['task-2-2', 'task-1-3', 'task-2-3', 'task-2-1', 'task-1-2', 'task-1-1'],
};
