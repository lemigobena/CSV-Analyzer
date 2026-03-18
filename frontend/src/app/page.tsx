'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import HistorySidebar, { JobHistory } from '@/components/HistorySidebar';
import Uploader from '@/components/Uploader';
import AnalysisView from '@/components/AnalysisView';

const API_BASE = 'http://localhost:4000/api';

export default function Home() {
  const [history, setHistory] = useState<JobHistory[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('app_theme') as 'dark' | 'light';
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('app_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };
  
  // Modals
  const [deleteModalOpen, setDeleteModalOpen] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  
  // Active job details
  const [jobData, setJobData] = useState<any>(null);
  const [jobDataLoading, setJobDataLoading] = useState(false);
  const [jobError, setJobError] = useState('');

  // SSE tracking
  const [sseProgress, setSseProgress] = useState(0);
  const [sseStatus, setSseStatus] = useState('');

  // Load history from session storage
  const loadHistory = async () => {
    try {
      const stored = sessionStorage.getItem('csv_analysis_history');
      if (!stored) return;
      const ids: string[] = JSON.parse(stored);
      
      const loadedHistory: JobHistory[] = [];
      for (const id of ids) {
        try {
          const res = await axios.get(`${API_BASE}/analysis/${id}`);
          if (res.data?.job) loadedHistory.push(res.data.job);
        } catch (e) {
          // If 404, we might want to remove it from session storage, but we can skip for now
        }
      }
      
      // Sort newest first
      loadedHistory.sort((a, b) => b.createdAt - a.createdAt);
      setHistory(loadedHistory);
    } catch (e) {
      console.error('Failed to load history', e);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const addToSessionHistory = (id: string) => {
    const stored = sessionStorage.getItem('csv_analysis_history');
    const ids: string[] = stored ? JSON.parse(stored) : [];
    if (!ids.includes(id)) {
      ids.push(id);
      sessionStorage.setItem('csv_analysis_history', JSON.stringify(ids));
    }
  };

  const removeFromSessionHistory = (id: string) => {
    const stored = sessionStorage.getItem('csv_analysis_history');
    if (stored) {
      let ids: string[] = JSON.parse(stored);
      ids = ids.filter(i => i !== id);
      sessionStorage.setItem('csv_analysis_history', JSON.stringify(ids));
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteModalOpen(id);
    setDeleteConfirmText('');
  };

  const executeDelete = async () => {
    if (!deleteModalOpen || deleteConfirmText !== deleteModalOpen) return;
    try {
      await axios.delete(`${API_BASE}/analysis/${deleteModalOpen}`);
      if (activeJobId === deleteModalOpen) setActiveJobId(null);
      removeFromSessionHistory(deleteModalOpen);
      loadHistory();
      setDeleteModalOpen(null);
    } catch (e) {
      console.error('Delete failed', e);
    }
  };

  const handleSelectJob = (id: string | null) => {
    setActiveJobId(id);
    setJobData(null);
    setSseProgress(0);
    setSseStatus('');
    setJobError('');
  };

  const handleSearch = async (id: string) => {
    setJobDataLoading(true);
    setJobError('');
    setActiveJobId(id);
    try {
      const res = await axios.get(`${API_BASE}/analysis/${id}`);
      if (res.data?.job) {
        addToSessionHistory(id);
        setJobData(res.data);
        if (res.data.job.status === 'pending' || res.data.job.status === 'processing') {
          startSSE(id);
        }
        loadHistory();
      } else {
        setJobError(`ID Not Found: ${id}`);
      }
    } catch (e: any) {
      if (e.response && e.response.status === 404) {
        setJobError(`ID Not Found: ${id}`);
      } else {
        setJobError(e.response?.data?.error || 'Failed to fetch job data');
      }
    } finally {
      setJobDataLoading(false);
    }
  };

  const fetchJobDetails = async (id: string) => {
    setJobDataLoading(true);
    setJobError('');
    try {
      const res = await axios.get(`${API_BASE}/analysis/${id}`);
      setJobData(res.data);
      if (res.data.job.status === 'pending' || res.data.job.status === 'processing') {
        startSSE(id);
      }
    } catch (e: any) {
      setJobError(e.response?.data?.error || 'Failed to fetch job data');
    } finally {
      setJobDataLoading(false);
    }
  };

  useEffect(() => {
    if (activeJobId && !jobDataLoading && !jobData && !jobError) {
      fetchJobDetails(activeJobId);
    }
  }, [activeJobId]);

  const startSSE = (id: string) => {
    const eventSource = new EventSource(`${API_BASE}/status/${id}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.error) {
        setJobError(data.error);
        eventSource.close();
        return;
      }

      setSseProgress(data.progress);
      setSseStatus(data.status);
      
      if (data.status === 'completed') {
        eventSource.close();
        // Refresh to get full JSON data payload
        fetchJobDetails(id);
        loadHistory(); 
      } else if (data.status === 'failed') {
        setJobError(data.error || 'Processing failed');
        eventSource.close();
        loadHistory();
      }
    };

    eventSource.onerror = () => {
      setJobError('Lost connection to server');
      eventSource.close();
    };
  };

  const onUploadSuccess = (jobId: string) => {
    addToSessionHistory(jobId);
    setActiveJobId(jobId);
    loadHistory();
  };

  return (
    <div className="app-layout">
      <HistorySidebar 
        history={history} 
        activeId={activeJobId} 
        onSelect={handleSelectJob} 
        onDelete={confirmDelete}
        onSearch={handleSearch}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      
      <div className="main-content">
        {!activeJobId ? (
          <div style={{ maxWidth: 800, margin: '0 auto' }}>
            <Uploader onSuccess={onUploadSuccess} API_BASE={API_BASE} />
          </div>
        ) : (
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            {jobDataLoading && !jobData && <p>Loading job data...</p>}
            
            {jobError && (
              <div style={{ color: 'var(--error)', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px' }}>
                <p style={{margin: 0}}>{jobError}</p>
                <button className="btn btn-outline" style={{ marginTop: '1rem' }} onClick={() => handleSelectJob(null)}>Go Back</button>
              </div>
            )}
            
            {!jobDataLoading && jobData && jobData.job.status !== 'completed' && jobData.job.status !== 'failed' && (
              <div className="card text-center">
                <h2>Processing Analysis</h2>
                <div style={{ background: 'rgba(255,255,255,0.1)', height: 8, borderRadius: 4, margin: '2rem 0', overflow: 'hidden' }}>
                  <div style={{ width: `${sseProgress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.3s' }}></div>
                </div>
                <p>{sseStatus === 'pending' ? 'Starting up...' : `Processed ${sseProgress}%`}</p>
              </div>
            )}

            {!jobDataLoading && jobData && jobData.job.status === 'completed' && jobData.data && (
              <AnalysisView 
                jobId={activeJobId} 
                title={jobData.job.title || 'Untitled'} 
                data={jobData.data} 
                metrics={jobData.job.metrics}
                onClose={() => handleSelectJob(null)}
                API_BASE={API_BASE}
                theme={theme}
              />
            )}

            {!jobDataLoading && jobData && jobData.job.status === 'failed' && (
              <div className="card text-center" style={{ color: 'var(--error)' }}>
                <h2>Analysis Failed</h2>
                <p>{jobData.job.error || 'Check server logs for details.'}</p>
                <button className="btn btn-outline" style={{ marginTop: '1rem' }} onClick={() => handleSelectJob(null)}>Go Back</button>
              </div>
            )}
          </div>
        )}
      </div>

      {deleteModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="card" style={{ width: '450px', maxWidth: '90%' }}>
            <h3 style={{ marginTop: 0, color: 'var(--error)' }}>Confirm Deletion</h3>
            <p style={{ color: '#cbd5e1' }}>
              Are you absolutely sure you want to delete this historical record? 
              This action cannot be undone.
            </p>
            <div style={{ margin: '1.5rem 0', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#94a3b8' }}>Please type the ID to confirm:</p>
              <code style={{ display: 'block', marginBottom: '1rem', color: 'var(--primary)', userSelect: 'all' }}>{deleteModalOpen}</code>
              <input 
                type="text" 
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Paste ID here"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: '#1e293b', color: 'white', outline: 'none' }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setDeleteModalOpen(null)}>Cancel</button>
              <button className="btn btn-danger" style={{ flex: 1, cursor: deleteConfirmText !== deleteModalOpen ? 'not-allowed' : 'pointer', opacity: deleteConfirmText !== deleteModalOpen ? 0.5 : 1 }} onClick={executeDelete} disabled={deleteConfirmText !== deleteModalOpen}>
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
