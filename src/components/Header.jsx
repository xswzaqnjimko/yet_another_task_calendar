import React, { useState } from 'react';
import { translations } from '../services/utils';
import { exportAllData } from '../services/export';
import AboutModal from './AboutModal';
import './Header.css';

function Header({
  language,
  rowDensity,
  columnWidth,
  onLanguageChange,
  onDensityChange,
  onColumnWidthChange,
  onAddTask,
  onViewTasks,
  onLoadDemo,
  activeTimers,
  tasks,
  privacyMode,
  spotlightTaskId,
  onTogglePrivacy,
  onClearSpotlight
}) {
  const t = translations[language];
  const [aboutOpen, setAboutOpen] = useState(false);

  const handleExport = async () => {
    try {
      await exportAllData();
      alert('Exported tasks.csv and occurrences.csv!');
    } catch (error) {
      alert('Export failed: ' + error.message);
    }
  };

  return (
    <div className="header">
      <div className="header-title">
        <h1>📅 {t.appTitle}</h1>
        <button 
          className="demo-btn" 
          onClick={onLoadDemo}
          title="Load sample demo tasks"
        >
          📦 Load Demo
        </button>
        {(activeTimers && activeTimers.length > 0) ? (
          <div className="active-timer-label">
            <div><b>Now timing:</b></div>
            {activeTimers.map((tm) => {
              const tk = (tasks || []).find(t => t.id === tm.taskId);
              const name = (privacyMode && privacyMode !== 'normal') ? '🔒 Hidden' : (tk?.name || tm.taskId);
              return (
                <div key={`${tm.taskId}-${tm.date}`} style={{ lineHeight: '1.25' }}>
                  {name} - {tm.date}
                </div>
              );
            })}
          </div>
        ) : null}

        {privacyMode && privacyMode !== 'normal' ? (
          <div className="privacy-badge" title="Privacy / Screenshot mode is ON">
            🔒 Privacy {privacyMode === 'spotlight' ? ' (Spotlight)' : ''}
          </div>
        ) : null}
      </div>
      
      <div className="header-controls">
        <select 
          value={language} 
          onChange={(e) => onLanguageChange(e.target.value)}
        >
          <option value="en">English</option>
          <option value="zh">简体中文</option>
        </select>

        <select 
          value={rowDensity} 
          onChange={(e) => onDensityChange(e.target.value)}
        >
          <option value="normal">{t.normalRows}</option>
          <option value="thin">{t.thinRows}</option>
          <option value="fat">{t.fatRows}</option>
        </select>

        <select 
          value={columnWidth} 
          onChange={(e) => onColumnWidthChange(e.target.value)}
        >
          <option value="fixed">Fixed Width</option>
          <option value="auto">Full Text</option>
        </select>

        <button onClick={onAddTask}>{t.addTask}</button>
        <button
          className={privacyMode && privacyMode !== 'normal' ? 'privacy-on' : 'secondary'}
          onClick={() => onTogglePrivacy && onTogglePrivacy()}
          title="Privacy / Screenshot mode (blur text for safe screenshots)"
        >
          🔒 Privacy
        </button>

        {privacyMode === 'spotlight' ? (
          <button
            className="secondary"
            onClick={() => onClearSpotlight && onClearSpotlight()}
            title="Exit spotlight (return to Blur All)"
          >
            ◀︎ Exit Spotlight
          </button>
        ) : null}
        <button className="secondary" onClick={handleExport}>{t.exportCSV}</button>
        <button className="secondary" onClick={() => setAboutOpen(true)}>ℹ️ About</button>
        <button className="secondary" onClick={onViewTasks}>📋 Tasks</button>
      </div>

      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
    </div>
  );
}

export default Header;
