import React, { useMemo, useState } from 'react';
import { TrackerHistory } from '../lib/history';
import { StudyTask } from '../types';
import { format, subDays, eachDayOfInterval, startOfWeek } from 'date-fns';

interface AnalyticsProps {
  history: TrackerHistory;
  schedule: StudyTask[];
}

export function AnalyticsDashboard({ history, schedule }: AnalyticsProps) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() - 4);
    return d;
  }, []);

  return (
    <div className="space-y-6 w-full max-w-full overflow-hidden text-white font-sans animate-in fade-in zoom-in duration-300">
      
      {/* 1. Consistency & Milestone Matrix */}
      <RadialGauges history={history} schedule={schedule} today={today} />

      {/* 2. Interactive Multi-Month Wave Graph */}
      <WaveGraph history={history} schedule={schedule} today={today} />

      {/* 3. Time-of-Day Focus Distribution */}
      <HourHeatStrip history={history} schedule={schedule} />

      {/* 4. Yearly/Multi-Month Activity Heatmap */}
      <ActivityHeatmap history={history} today={today} />

    </div>
  );
}

function RadialGauges({ history, schedule, today }: { history: TrackerHistory, schedule: StudyTask[], today: Date }) {
  // Compute some metrics
  const last30Days = Array.from({length: 30}, (_, i) => format(subDays(today, i), 'yyyy-MM-dd'));
  
  const monthlyGoalVelocity = useMemo(() => {
    let hits = 0;
    last30Days.forEach(d => {
      if (history[d] && history[d].score >= 80) hits++;
    });
    return Math.round((hits / 30) * 100);
  }, [history, last30Days]);

  const studyVsWorkout = useMemo(() => {
    let study = 0, workout = 0;
    last30Days.forEach(d => {
      if (!history[d]) return;
      history[d].completedTasks.forEach(tId => {
        const task = schedule.find(s => s.id === tId);
        if (task && task.priority === 'High' && task.title.toLowerCase().includes('training')) workout++;
        else if (task && task.studyHours) study += task.studyHours;
      });
    });
    // Arbitrary metric: workout sessions vs study sessions
    return Math.min(100, Math.round(((study / 3) + workout) / 30 * 100)); // Just a mock representation
  }, [history, schedule, last30Days]);

  const lateNightFocus = useMemo(() => {
    let lateNightTasks = 0;
    let totalTasks = 0;
    last30Days.forEach(d => {
      if (!history[d]) return;
      history[d].completedTasks.forEach(tId => {
        const task = schedule.find(s => s.id === tId);
        if (task) {
           totalTasks++;
           const startHour = parseInt(task.startTime.split(':')[0], 10);
           if (startHour >= 21 || startHour < 4) lateNightTasks++;
        }
      });
    });
    return totalTasks ? Math.round((lateNightTasks / totalTasks) * 100) : 0;
  }, [history, schedule, last30Days]);

  const circleParams = (radius: number, percent: number) => {
    const circum = 2 * Math.PI * radius;
    const offset = circum - (percent / 100) * circum;
    return { circum, offset };
  };

  const p1 = circleParams(38, monthlyGoalVelocity);
  const p2 = circleParams(28, studyVsWorkout);
  const p3 = circleParams(18, lateNightFocus);

  return (
    <div className="bg-[#0a0a0c]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#00f2fe]/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
      <h3 className="text-lg font-semibold text-gray-200 mb-6 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#00f2fe] shadow-[0_0_8px_#00f2fe]"></span>
        Consistency Metrics
      </h3>
      
      <div className="flex flex-col sm:flex-row items-center gap-8 justify-center">
        <div className="relative w-32 h-32 flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Outer */}
            <circle cx="50" cy="50" r="38" fill="none" stroke="#ffffff0a" strokeWidth="6" />
            <circle cx="50" cy="50" r="38" fill="none" stroke="url(#cyan-grad)" strokeWidth="6" strokeDasharray={p1.circum} strokeDashoffset={p1.offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
            
            {/* Middle */}
            <circle cx="50" cy="50" r="28" fill="none" stroke="#ffffff0a" strokeWidth="6" />
            <circle cx="50" cy="50" r="28" fill="none" stroke="url(#violet-grad)" strokeWidth="6" strokeDasharray={p2.circum} strokeDashoffset={p2.offset} strokeLinecap="round" className="transition-all duration-1000 ease-out delay-100" />
            
            {/* Inner */}
            <circle cx="50" cy="50" r="18" fill="none" stroke="#ffffff0a" strokeWidth="6" />
            <circle cx="50" cy="50" r="18" fill="none" stroke="url(#emerald-grad)" strokeWidth="6" strokeDasharray={p3.circum} strokeDashoffset={p3.offset} strokeLinecap="round" className="transition-all duration-1000 ease-out delay-200" />
            
            <defs>
              <linearGradient id="cyan-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00f2fe" />
                <stop offset="100%" stopColor="#4facfe" />
              </linearGradient>
              <linearGradient id="violet-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#7f00ff" />
                <stop offset="100%" stopColor="#e100ff" />
              </linearGradient>
              <linearGradient id="emerald-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00ff87" />
                <stop offset="100%" stopColor="#60efff" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <LegendItem color="from-[#00f2fe] to-[#4facfe]" label="Monthly Velocity" value={`${monthlyGoalVelocity}%`} />
          <LegendItem color="from-[#7f00ff] to-[#e100ff]" label="Study Adherence" value={`${studyVsWorkout}%`} />
          <LegendItem color="from-[#00ff87] to-[#60efff]" label="Late Night Peak" value={`${lateNightFocus}%`} />
        </div>
      </div>
    </div>
  );
}

function LegendItem({ color, label, value }: { color: string, label: string, value: string }) {
  return (
    <div className="flex justify-between items-center bg-[#ffffff05] rounded-lg p-2 border border-white/5">
      <div className="flex items-center gap-2 text-sm text-gray-300">
        <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${color}`}></div>
        {label}
      </div>
      <div className="font-bold text-white font-mono">{value}</div>
    </div>
  );
}

function WaveGraph({ history, schedule, today }: { history: TrackerHistory, schedule: StudyTask[], today: Date }) {
  const [filter, setFilter] = useState<7 | 30 | 90>(30);
  
  const data = useMemo(() => {
    return Array.from({length: filter}, (_, i) => {
      const d = subDays(today, filter - 1 - i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const rec = history[dateStr];
      let hours = 0;
      if (rec) {
        rec.completedTasks.forEach(tId => {
          const t = schedule.find(s => s.id === tId);
          if (t && t.studyHours) hours += t.studyHours;
        });
      }
      return { date: dateStr, hours };
    });
  }, [filter, history, schedule, today]);

  const maxHours = Math.max(...data.map(d => d.hours), 10); // at least 10 for scale
  
  // Create bezier curve path
  const width = 800;
  const height = 160;
  const points = data.map((d, i) => {
    const x = (i / (filter - 1)) * width;
    const y = height - (d.hours / maxHours) * height;
    return { x, y };
  });

  let pathData = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX = (prev.x + curr.x) / 2;
    pathData += ` C ${cpX},${prev.y} ${cpX},${curr.y} ${curr.x},${curr.y}`;
  }

  const fillPath = `${pathData} L ${width},${height} L 0,${height} Z`;

  const benchmarkY = height - (8.0 / maxHours) * height;

  return (
    <div className="bg-[#0a0a0c]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-4 sm:p-6 shadow-2xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h3 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#7f00ff] shadow-[0_0_8px_#7f00ff]"></span>
          Study Volume
        </h3>
        <div className="flex bg-[#ffffff0a] rounded-lg p-1 border border-white/5">
          {[7, 30, 90].map(days => (
            <button
              key={days}
              onClick={() => setFilter(days as any)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${filter === days ? 'bg-[#333] text-white shadow-md' : 'text-gray-400 hover:text-white'}`}
            >
              {days}D
            </button>
          ))}
        </div>
      </div>

      <div className="w-full h-[180px] relative">
        <svg viewBox={`0 -10 ${width} ${height + 20}`} preserveAspectRatio="none" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="wave-grad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#7f00ff" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#7f00ff" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#e100ff" />
              <stop offset="50%" stopColor="#7f00ff" />
              <stop offset="100%" stopColor="#00f2fe" />
            </linearGradient>
          </defs>
          
          {/* Benchmark line */}
          <line x1="0" y1={benchmarkY} x2={width} y2={benchmarkY} stroke="#ffffff22" strokeWidth="1" strokeDasharray="4 4" />
          <text x={width - 25} y={benchmarkY - 6} fill="#ffffff44" fontSize="10" className="font-mono">8.0h</text>
          
          <path d={fillPath} fill="url(#wave-grad)" />
          <path d={pathData} fill="none" stroke="url(#line-grad)" strokeWidth="3" className="transition-all duration-500 ease-in-out drop-shadow-[0_0_8px_rgba(127,0,255,0.5)]" />
          
          {/* Points for tooltips (desktop only for simple touch handling) */}
          {points.map((p, i) => (
             <circle key={i} cx={p.x} cy={p.y} r="4" fill="#00f2fe" opacity="0" className="hover:opacity-100 transition-opacity cursor-pointer">
               <title>{`${data[i].date}: ${data[i].hours.toFixed(1)} hrs`}</title>
             </circle>
          ))}
        </svg>
      </div>
    </div>
  );
}

function HourHeatStrip({ history, schedule }: { history: TrackerHistory, schedule: StudyTask[] }) {
  // Aggregate completions by hour
  const heatMap = useMemo(() => {
    const hours = Array(24).fill(0);
    let max = 1;
    Object.values(history).forEach(rec => {
      rec.completedTasks.forEach(tId => {
        const task = schedule.find(s => s.id === tId);
        if (task) {
           const start = parseInt(task.startTime.split(':')[0], 10);
           const end = parseInt(task.endTime.split(':')[0], 10);
           const actualEnd = end < start ? end + 24 : end; // midnight crossing
           for(let h = start; h < actualEnd; h++) {
              hours[h % 24]++;
              if (hours[h % 24] > max) max = hours[h % 24];
           }
        }
      });
    });
    return { hours, max };
  }, [history, schedule]);

  return (
    <div className="bg-[#0a0a0c]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-2xl">
      <h3 className="text-lg font-semibold text-gray-200 mb-6 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#00ff87] shadow-[0_0_8px_#00ff87]"></span>
        Focus Distribution (24h)
      </h3>
      
      <div className="flex w-full h-12 rounded-lg overflow-hidden bg-[#111]">
        {heatMap.hours.map((val, h) => {
          const intensity = val / heatMap.max;
          // Colors from black to dark green to neon emerald
          const r = Math.round(10 * (1 - intensity) + 0 * intensity);
          const g = Math.round(10 * (1 - intensity) + 255 * intensity);
          const b = Math.round(12 * (1 - intensity) + 135 * intensity);
          
          return (
            <div 
              key={h} 
              className="flex-1 group relative cursor-crosshair transition-colors duration-300"
              style={{ backgroundColor: `rgb(${r}, ${g}, ${b})` }}
            >
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black/90 text-white text-[10px] px-2 py-1 rounded border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none whitespace-nowrap">
                {`${h.toString().padStart(2, '0')}:00 - High Focus`}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-gray-500 mt-2 font-mono">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:59</span>
      </div>
    </div>
  );
}

function ActivityHeatmap({ history, today }: { history: TrackerHistory, today: Date }) {
  const days = 140; // ~5 months
  
  const cells = useMemo(() => {
    const arr = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = subDays(today, i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const rec = history[dateStr];
      arr.push({
        date: dateStr,
        score: rec ? rec.score : 0,
        dayOfWeek: d.getDay()
      });
    }
    return arr;
  }, [history, today]);

  // GitHub style layout requires rows = 7 (days of week), cols = weeks
  // We need to pad the start to align with Sunday
  const firstDay = subDays(today, days - 1);
  const startPadding = firstDay.getDay(); 
  
  const totalCells = startPadding + cells.length;
  const cols = Math.ceil(totalCells / 7);

  const matrix = Array.from({length: 7}, () => Array(cols).fill(null));
  
  let cellIndex = 0;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < 7; r++) {
      if (c === 0 && r < startPadding) {
        continue; // Empty padding
      }
      if (cellIndex < cells.length) {
        matrix[r][c] = cells[cellIndex];
        cellIndex++;
      }
    }
  }

  const getColor = (score: number) => {
    if (score === 0) return '#161b22';
    if (score < 40) return '#003d4d'; // Dark teal
    if (score < 70) return '#00758f'; // Mid teal
    if (score < 90) return '#00acc1'; // Bright teal
    return '#00f2fe'; // Neon cyan
  };

  return (
    <div className="bg-[#0a0a0c]/80 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-2xl overflow-x-auto custom-scrollbar">
      <h3 className="text-lg font-semibold text-gray-200 mb-6 flex items-center gap-2 sticky left-0">
        <span className="w-2 h-2 rounded-full bg-[#4facfe] shadow-[0_0_8px_#4facfe]"></span>
        Consistency Matrix
      </h3>
      
      <div className="flex gap-2 min-w-max pb-4">
        <div className="flex flex-col gap-1 text-[10px] text-gray-500 font-mono pr-2 pt-4">
          <span className="h-3 leading-3">Sun</span>
          <span className="h-3 leading-3 mt-1">Mon</span>
          <span className="h-3 leading-3 mt-1">Tue</span>
          <span className="h-3 leading-3 mt-1">Wed</span>
          <span className="h-3 leading-3 mt-1">Thu</span>
          <span className="h-3 leading-3 mt-1">Fri</span>
          <span className="h-3 leading-3 mt-1">Sat</span>
        </div>
        <div className="flex flex-col gap-1">
          {matrix.map((row, rIdx) => (
            <div key={rIdx} className="flex gap-1">
              {row.map((cell, cIdx) => {
                if (!cell) return <div key={cIdx} className="w-3 h-3 rounded-sm bg-transparent"></div>;
                return (
                  <div 
                    key={cIdx} 
                    className="w-3 h-3 rounded-sm group relative cursor-pointer hover:ring-1 hover:ring-white transition-all duration-200"
                    style={{ backgroundColor: getColor(cell.score), boxShadow: cell.score >= 90 ? '0 0 6px #00f2fe44' : 'none' }}
                  >
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-black text-white text-[10px] px-2 py-1 rounded border border-white/20 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none whitespace-nowrap shadow-xl">
                      {cell.date}: {cell.score}% completed
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
