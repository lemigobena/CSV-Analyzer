'use client';

import { useState, useRef } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { UploadCloud, File, AlertCircle, Plus, Trash2 } from 'lucide-react';

interface UploaderProps {
  onSuccess: (jobId: string) => void;
  API_BASE: string;
}

export default function Uploader({ onSuccess, API_BASE }: UploaderProps) {
  const [tab, setTab] = useState<'file' | 'manual'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Manual table state
  const [manualData, setManualData] = useState([{ department: '', date: new Date().toISOString().split('T')[0], sales: 0 }]);
  const [manualTitle, setManualTitle] = useState('Manual Entry');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragActive(e.type === 'dragenter' || e.type === 'dragover');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files?.[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files?.[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (f: File) => {
    if (f.type === 'text/csv' || f.name.endsWith('.csv') || f.name.endsWith('.xlsx')) {
      setFile(f);
      setErrorMsg('');
    } else {
      setErrorMsg('Please upload a valid CSV or XLSX file.');
    }
  };

  const handleFileUpload = async () => {
    if (!file) return;
    setLoading(true);
    setErrorMsg('');

    try {
      if (file.name.endsWith('.xlsx')) {
        // Parse excel to json, then upload
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Ensure the header row corresponds to 'department' and 'sales' 
        // Or simply raw JSON arrays for backend to process
        const json = XLSX.utils.sheet_to_json(worksheet);
        
        // Map excel columns to expected format if needed
        const mappedData = json.map((row: any) => {
           const keys = Object.keys(row);
           const deptKey = keys.find(k => k.toLowerCase().includes('department')) || keys[0];
           const salesKey = keys.find(k => k.toLowerCase().includes('sales')) || keys[1];
           const dateKey = keys.find(k => k.toLowerCase().includes('date')) || keys[2];
           return {
             department: String(row[deptKey] || 'Unknown'),
             date: String(row[dateKey] || new Date().toISOString().split('T')[0]),
             sales: Number(row[salesKey]) || 0
           };
        });

        const response = await axios.post(`${API_BASE}/upload/json`, {
          title: file.name,
          data: mappedData
        });
        onSuccess(response.data.jobId);
      } else {
        // Standard CSV POST
        const formData = new FormData();
        formData.append('file', file);
        const response = await axios.post(`${API_BASE}/upload`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        onSuccess(response.data.jobId);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      // Filter out empty rows
      const validData = manualData.filter(d => d.department.trim() !== '');
      if (validData.length === 0) throw new Error("No valid data to submit");

      const response = await axios.post(`${API_BASE}/upload/json`, {
        title: manualTitle,
        data: validData
      });
      onSuccess(response.data.jobId);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <div className="view-header" style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Start New Analysis</h2>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'file' ? 'active' : ''}`} onClick={() => setTab('file')}>File Upload</button>
        <button className={`tab ${tab === 'manual' ? 'active' : ''}`} onClick={() => setTab('manual')}>Manual Entry</button>
      </div>

      {errorMsg && (
        <div style={{ color: 'var(--error)', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} /> {errorMsg}
        </div>
      )}

      {tab === 'file' && (
        <>
          <div 
            className={`upload-area ${isDragActive ? 'drag-active' : ''}`}
            onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input ref={fileInputRef} type="file" accept=".csv, .xlsx" onChange={handleChange} className="hidden-input" />
            <UploadCloud size={48} className="upload-icon" />
            <p>Drag and drop CSV or Excel (.xlsx) file here, or <strong>click to browse</strong></p>
            {file && (
              <div className="file-name">
                <File size={16} style={{ display: 'inline', marginRight: '6px' }} />
                {file.name}
              </div>
            )}
          </div>
          <button className="btn" onClick={handleFileUpload} disabled={!file || loading} style={{ width: '100%' }}>
            {loading ? 'Processing...' : 'Upload & Process'}
          </button>
        </>
      )}

      {tab === 'manual' && (
        <>
           <div style={{ marginBottom: '1rem' }}>
             <label style={{ display: 'block', fontSize: '0.9rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Analysis Title</label>
             <input type="text" value={manualTitle} onChange={e => setManualTitle(e.target.value)} 
               style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border)' }} />
           </div>

           <div style={{ backgroundColor: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '12px' }}>
             <table className="data-table">
                <thead>
                  <tr>
                    <th>Department Name</th>
                    <th>Date</th>
                    <th>Number of Sales</th>
                    <th style={{ width: '50px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {manualData.map((row, idx) => (
                    <tr key={idx}>
                      <td>
                        <input type="text" placeholder="e.g. Electronics" value={row.department} 
                          onChange={(e) => {
                            const newData = [...manualData];
                            newData[idx].department = e.target.value;
                            setManualData(newData);
                          }} />
                      </td>
                      <td>
                        <input type="date" value={row.date}
                           onChange={(e) => {
                             const newData = [...manualData];
                             newData[idx].date = e.target.value;
                             setManualData(newData);
                           }} />
                      </td>
                      <td>
                        <input type="number" placeholder="0" value={row.sales} 
                          onChange={(e) => {
                            const newData = [...manualData];
                            newData[idx].sales = Number(e.target.value);
                            setManualData(newData);
                          }} />
                      </td>
                      <td>
                        <button className="delete-btn" onClick={() => {
                          const newData = manualData.filter((_, i) => i !== idx);
                          setManualData(newData);
                        }}><Trash2 size={18}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
             </table>
             <button className="btn btn-outline" style={{ marginTop: '1rem', padding: '0.5rem 1rem', fontSize: '0.9rem' }} 
               onClick={() => setManualData([...manualData, { department: '', date: new Date().toISOString().split('T')[0], sales: 0 }])}>
                <Plus size={16} /> Add Row
             </button>
           </div>
           
           <button className="btn" onClick={handleManualSubmit} disabled={loading} style={{ width: '100%', marginTop: '1.5rem' }}>
            {loading ? 'Processing...' : 'Run Analysis'}
          </button>
        </>
      )}
    </div>
  );
}
