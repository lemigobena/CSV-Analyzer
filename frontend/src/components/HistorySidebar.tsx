'use client';

import { useState } from 'react';
import { Trash2, Search, Moon, Sun } from 'lucide-react';

export interface JobHistory {
  id: string;
  status: string;
  progress: number;
  downloadUrl?: string;
  metrics?: { processingTimeMs: number; totalDepartments: number };
  createdAt: number;
  title?: string;
}

interface SidebarProps {
  history: JobHistory[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
  onSearch: (id: string) => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export default function HistorySidebar({ history, activeId, onSelect, onDelete, onSearch, theme, onToggleTheme }: SidebarProps) {
  const [searchInput, setSearchInput] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      onSearch(searchInput.trim());
      setSearchInput('');
    }
  };
  return (
    <div className="sidebar">
      <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>CSV Analyser</h2>
        <button className="btn btn-outline" style={{ padding: '0.4rem' }} onClick={onToggleTheme} title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
      
      <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
        <button 
          className="btn" 
          style={{ width: '100%', marginBottom: '1rem' }} 
          onClick={() => onSelect(null)}
        >
          + New Analysis
        </button>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem' }}>
          <input 
            type="text" 
            placeholder="Search by ID..." 
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            style={{ flex: 1, padding: '0.5rem', borderRadius: '6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
          />
          <button type="submit" className="btn btn-outline" style={{ padding: '0.5rem' }} title="Search">
            <Search size={16} />
          </button>
        </form>
      </div>

      <div className="history-list">
        {history.length === 0 ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', fontSize: '0.9rem' }}>No history found</p>
        ) : (
          history.map(job => (
            <div 
              key={job.id} 
              className={`history-item ${activeId === job.id ? 'active' : ''}`}
              onClick={() => onSelect(job.id)}
            >
              <div className="history-details">
                <h4>{job.title || 'Untitled'}</h4>
                <p>{new Date(job.createdAt).toLocaleString()}</p>
                <p style={{ color: job.status === 'completed' ? 'var(--success)' : (job.status === 'failed' ? 'var(--error)' : '#a5b4fc') }}>
                  {job.status.toUpperCase()}
                </p>
              </div>
              <button 
                className="delete-btn" 
                onClick={(e) => { e.stopPropagation(); onDelete(job.id); }}
                title="Delete Record"
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
