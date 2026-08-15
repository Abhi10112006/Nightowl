import { format } from 'date-fns';

export interface HistoryRecord {
  completedTasks: string[];
  score: number; // percentage 0-100
}

export type TrackerHistory = Record<string, HistoryRecord>;

// 4:00 AM rollover logic
export function getAdjustedDate(): string {
  const now = new Date();
  now.setHours(now.getHours() - 4);
  return format(now, 'yyyy-MM-dd');
}

export function getHistory(): TrackerHistory {
  let data = localStorage.getItem('trackerHistory');
  if (!data) {
    const mockHistory = generateMockHistory();
    saveHistory(mockHistory);
    return mockHistory;
  }
  return JSON.parse(data);
}

function generateMockHistory(): TrackerHistory {
  const history: TrackerHistory = {};
  let dateObj = new Date();
  dateObj.setHours(dateObj.getHours() - 4);

  // Generate for past 180 days
  for (let i = 0; i <= 180; i++) {
    const d = new Date(dateObj);
    d.setDate(d.getDate() - i);
    const dateStr = format(d, 'yyyy-MM-dd');
    
    // Randomize score between 40 and 100, occasionally 0
    const random = Math.random();
    let score = 0;
    let completedTasks: string[] = [];
    if (random > 0.15) { // 85% chance to have studied
      score = Math.floor(Math.random() * 61) + 40; // 40-100
      // Mock completed tasks based on score (assuming 10 tasks)
      const numTasks = Math.round(score / 10);
      for(let t=1; t<=numTasks; t++) completedTasks.push(`t${t}`);
    }

    history[dateStr] = {
      completedTasks,
      score
    };
  }
  return history;
}

export function saveHistory(history: TrackerHistory) {
  localStorage.setItem('trackerHistory', JSON.stringify(history));
}

export function updateTodayProgress(completedTasks: string[], total: number) {
  const today = getAdjustedDate();
  const history = getHistory();
  const score = total > 0 ? Math.round((completedTasks.length / total) * 100) : 0;
  
  history[today] = {
    completedTasks,
    score
  };
  
  saveHistory(history);
}

export function getStreak(): number {
  const history = getHistory();
  const today = getAdjustedDate();
  let streak = 0;
  let dateObj = new Date();
  dateObj.setHours(dateObj.getHours() - 4); // adjusted current date

  // Check today first
  const todayRecord = history[today];
  if (todayRecord && todayRecord.score >= 80) {
     streak++;
  } else if (!todayRecord) {
     // If today is completely empty (no data logged yet), we don't break the streak,
     // start checking from yesterday.
  } else {
     // Today is logged but < 80%, streak is 0
     return 0; 
  }

  // Check previous days (up to a year back)
  for (let i = 1; i < 365; i++) {
    const prevDateObj = new Date(dateObj);
    prevDateObj.setDate(prevDateObj.getDate() - i);
    const dateStr = format(prevDateObj, 'yyyy-MM-dd');
    const record = history[dateStr];
    
    if (record && record.score >= 80) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
