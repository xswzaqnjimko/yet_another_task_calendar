import React, { useState, useEffect } from 'react';
import { getDatabasePath } from '../services/database';
import './Modal.css';

function AboutModal({ onClose }) {
  const [dbPath, setDbPath] = useState('Loading...');

  useEffect(() => {
    loadDbPath();
  }, []);

  const loadDbPath = async () => {
    try {
      // First try the backend command
      const path = await getDatabasePath();
      if (path) {
        setDbPath(path);
        return;
      }
    } catch (error) {
      console.error('Backend getDatabasePath failed:', error);
    }
    
    // Fallback: show the known location
    setDbPath('~/Library/Application Support/task_grid.db');
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(dbPath);
    alert('Database path copied to clipboard!');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>About Task Grid</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Version</h3>
            <p>Task Grid v0.1.0-beta</p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Database Location</h3>
            <div style={{ 
              background: '#f9f9fb', 
              padding: '12px', 
              borderRadius: '6px',
              wordBreak: 'break-all',
              fontSize: '13px',
              fontFamily: 'monospace'
            }}>
              {dbPath}
            </div>
            <button 
              style={{ marginTop: '8px' }} 
              className="secondary"
              onClick={copyToClipboard}
            >
              Copy Path
            </button>
          </div>

          <div>
            <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Tech Stack</h3>
            <ul style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
              <li>React 18</li>
              <li>Tauri 1.5</li>
              <li>SQLite (local storage)</li>
              <li>Rust backend</li>
            </ul>
          </div>
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default AboutModal;
