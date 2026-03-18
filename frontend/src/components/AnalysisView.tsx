'use client';

import { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Download, Printer, ArrowLeft, ArrowUp, ArrowDown, ArrowUpDown, Copy, Check } from 'lucide-react';

interface AnalysisData {
  department: string;
  total: number;
  date?: string;
}

interface AnalysisProps {
  jobId: string;
  title: string;
  data: AnalysisData[];
  metrics?: { processingTimeMs: number; totalDepartments: number };
  onClose: () => void;
  API_BASE: string;
  theme: 'dark' | 'light';
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function AnalysisView({ jobId, title, data, metrics, onClose, API_BASE, theme }: AnalysisProps) {
  const [viewType, setViewType] = useState<'bar' | 'pie' | 'line' | 'table'>('bar');
  const [selectedDepts, setSelectedDepts] = useState<string[]>(data.map(d => d.department));
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pdfOptions, setPdfOptions] = useState({ bar: true, pie: true, line: true, table: true });
  const [sortConfig, setSortConfig] = useState<{ key: 'department' | 'total' | 'date', direction: 'asc' | 'desc' } | null>(null);

  const leaderboard = useMemo(() => {
    const sorted = [...data].sort((a, b) => b.total - a.total);
    if (sorted.length <= 1) return null;
    if (sorted.length > 6) {
      return { top: sorted.slice(0, 3), bottom: sorted.slice(-3).reverse() };
    } else {
      return { top: [sorted[0]], bottom: [sorted[sorted.length - 1]] };
    }
  }, [data]);

  const handleCopyId = () => {
    navigator.clipboard.writeText(jobId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredData = useMemo(() => {
    return data.filter(d => selectedDepts.includes(d.department));
  }, [data, selectedDepts]);

  const sortedTableData = useMemo(() => {
    let sortableItems = [...filteredData];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const valA = a[sortConfig.key] ?? '';
        const valB = b[sortConfig.key] ?? '';
        if (valA < valB) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (valA > valB) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [filteredData, sortConfig]);

  const requestSort = (key: 'department' | 'total' | 'date') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: 'department' | 'total' | 'date') => {
    if (sortConfig?.key !== key) return <ArrowUpDown size={16} style={{ opacity: 0.3, marginLeft: '8px', verticalAlign: 'middle' }} />;
    return sortConfig.direction === 'asc' 
      ? <ArrowUp size={16} color="#818cf8" style={{ marginLeft: '8px', verticalAlign: 'middle' }} /> 
      : <ArrowDown size={16} color="#818cf8" style={{ marginLeft: '8px', verticalAlign: 'middle' }} />;
  };

  const handleToggleDept = (dept: string) => {
    if (selectedDepts.includes(dept)) {
      setSelectedDepts(selectedDepts.filter(d => d !== dept));
    } else {
      setSelectedDepts([...selectedDepts, dept]);
    }
  };

  const handleDownloadPDF = async () => {
    setShowPdfModal(true);
  };

  const confirmDownloadPDF = async () => {
    setIsExporting(true);
    
    // Give UI a moment to show loading state before intense CPU blocking task
    setTimeout(async () => {
      const element = document.getElementById('pdf-export');
      if (!element) {
        setIsExporting(false);
        return;
      }
      
      const html2pdf = (await import('html2pdf.js')).default;
      
      const opt = {
        margin: 10,
        filename: `Analysis-${title.replace(/[^a-z0-9]/gi, '_')}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: theme === 'dark' ? '#131521' : '#ffffff' },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' as const },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };
      
      await html2pdf().set(opt).from(element).save();
      
      setIsExporting(false);
      setShowPdfModal(false);
    }, 150);
  };

  const handleDownloadCSV = () => {
    window.location.href = `${API_BASE}/download/${jobId}`;
  };

  return (
    <div className="card">
      <div className="view-header" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '1rem' }}>
        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button className="btn btn-outline" style={{ padding: '0.5rem' }} onClick={onClose} title="Go Back">
              <ArrowLeft size={20} />
            </button>
            <h2 style={{ margin: 0 }}>Analysis: {title}</h2>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-outline" onClick={handleDownloadCSV}>
              <Download size={18} /> CSV
            </button>
            <button className="btn btn-success" onClick={handleDownloadPDF}>
              <Printer size={18} /> PDF
            </button>
          </div>
        </div>
        <div style={{ 
          fontSize: '0.9rem', 
          color: theme === 'dark' ? '#94a3b8' : '#475569', 
          background: theme === 'dark' ? 'rgba(0,0,0,0.2)' : '#f1f5f9', 
          padding: '0.75rem 1rem', 
          borderRadius: '6px', 
          width: '100%', 
          border: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#cbd5e1'}`, 
          display: 'flex', 
          alignItems: 'center' 
        }}>
          <strong>Save this ID to view later:</strong> 
          <code 
            onClick={handleCopyId}
            style={{ 
              userSelect: 'all', color: 'var(--primary)', fontWeight: 'bold', marginLeft: '0.5rem', 
              padding: '0.2rem 0.5rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '4px',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', transition: 'all 0.2s',
              border: theme === 'light' ? '1px solid rgba(99, 102, 241, 0.2)' : 'none'
            }}
            title="Click to copy"
          >
            {jobId} {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
          </code>
        </div>
      </div>

      <div className="checkbox-list" style={{ marginTop: '0.5rem' }}>
        <strong style={{ width: '100%', marginBottom: '0.5rem', display: 'block', color: theme === 'dark' ? 'white' : 'black' }}>Compare Departments:</strong>
        {data.map(d => (
          <label key={d.department} className="checkbox-item" style={{ color: theme === 'dark' ? '#cbd5e1' : '#1e293b' }}>
            <input 
              type="checkbox" 
              checked={selectedDepts.includes(d.department)} 
              onChange={() => handleToggleDept(d.department)}
            />
            {d.department}
          </label>
        ))}
      </div>

      <div className="tabs">
        <button className={`tab ${viewType === 'bar' ? 'active' : ''}`} onClick={() => setViewType('bar')}>Bar Chart</button>
        <button className={`tab ${viewType === 'pie' ? 'active' : ''}`} onClick={() => setViewType('pie')}>Pie Chart</button>
        <button className={`tab ${viewType === 'line' ? 'active' : ''}`} onClick={() => setViewType('line')}>Line Chart</button>
        <button className={`tab ${viewType === 'table' ? 'active' : ''}`} onClick={() => setViewType('table')}>Data Table</button>
      </div>

      <div id="report" className="pdf-container">
        {metrics && (
          <div className="metrics" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="metric-card">
                <h3>{(metrics.processingTimeMs / 1000).toFixed(2)}s</h3>
                <p>Processing Time</p>
              </div>
              <div className="metric-card">
                <h3>{metrics.totalDepartments}</h3>
                <p>Total Formatted Depts</p>
              </div>
            </div>
            
            {leaderboard && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ background: theme === 'dark' ? 'rgba(16, 185, 129, 0.05)' : '#f0fdf4', borderRadius: '8px', padding: '1rem', border: `1px solid ${theme === 'dark' ? 'rgba(16, 185, 129, 0.2)' : '#bbf7d0'}` }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#10b981' }}>Top Seller{leaderboard.top.length > 1 ? 's' : ''}</h4>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', color: theme === 'dark' ? '#cbd5e1' : '#475569', fontSize: '0.9rem' }}>
                    {leaderboard.top.map(d => <li key={`top-${d.department}`}><strong>{d.department}</strong> ({d.total.toLocaleString()})</li>)}
                  </ul>
                </div>
                <div style={{ background: theme === 'dark' ? 'rgba(239, 68, 68, 0.05)' : '#fef2f2', borderRadius: '8px', padding: '1rem', border: `1px solid ${theme === 'dark' ? 'rgba(239, 68, 68, 0.2)' : '#fecaca'}` }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#ef4444' }}>Lowest Seller{leaderboard.bottom.length > 1 ? 's' : ''}</h4>
                  <ul style={{ margin: 0, paddingLeft: '1.2rem', color: theme === 'dark' ? '#cbd5e1' : '#475569', fontSize: '0.9rem' }}>
                    {leaderboard.bottom.map(d => <li key={`bot-${d.department}`}><strong>{d.department}</strong> ({d.total.toLocaleString()})</li>)}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}

        {viewType === 'bar' && (
          <div style={{ height: 400, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
                <XAxis dataKey="department" stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} />
                <YAxis stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} />
                <Tooltip 
                  cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }} 
                  contentStyle={{ backgroundColor: theme === 'dark' ? '#131521' : '#ffffff', border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`, color: theme === 'dark' ? '#fff' : '#000' }} 
                />
                <Bar dataKey="total" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {viewType === 'pie' && (
          <div style={{ height: 400, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={filteredData} dataKey="total" nameKey="department" cx="50%" cy="50%" outerRadius={150} fill="#8884d8" label={({ name }) => name}>
                  {filteredData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#131521' : '#ffffff', border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`, color: theme === 'dark' ? '#fff' : '#000' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {viewType === 'line' && (
          <div style={{ height: 400, width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredData}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
                <XAxis dataKey="department" stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} />
                <YAxis stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} />
                <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#131521' : '#ffffff', border: `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`, color: theme === 'dark' ? '#fff' : '#000' }} />
                <Line type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={3} dot={{ r: 6 }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {viewType === 'table' && (
           <table className="data-table">
             <thead>
               <tr>
                 <th onClick={() => requestSort('department')} style={{ cursor: 'pointer', userSelect: 'none', background: sortConfig?.key === 'department' ? 'rgba(99, 102, 241, 0.15)' : (theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f1f5f9'), color: sortConfig?.key === 'department' ? '#818cf8' : (theme === 'dark' ? 'white' : '#0f172a'), transition: 'all 0.2s', padding: '12px' }}>
                   Department {renderSortIcon('department')}
                 </th>
                 <th onClick={() => requestSort('date')} style={{ cursor: 'pointer', userSelect: 'none', background: sortConfig?.key === 'date' ? 'rgba(99, 102, 241, 0.15)' : (theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f1f5f9'), color: sortConfig?.key === 'date' ? '#818cf8' : (theme === 'dark' ? 'white' : '#0f172a'), transition: 'all 0.2s', padding: '12px' }}>
                   Last Sold Date {renderSortIcon('date')}
                 </th>
                 <th onClick={() => requestSort('total')} style={{ cursor: 'pointer', userSelect: 'none', background: sortConfig?.key === 'total' ? 'rgba(99, 102, 241, 0.15)' : (theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f1f5f9'), color: sortConfig?.key === 'total' ? '#818cf8' : (theme === 'dark' ? 'white' : '#0f172a'), transition: 'all 0.2s', padding: '12px' }}>
                   Total Sales {renderSortIcon('total')}
                 </th>
               </tr>
             </thead>
             <tbody>
               {sortedTableData.length === 0 && (
                 <tr>
                   <td colSpan={3} style={{ textAlign: 'center', padding: '2rem', color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>No departments selected</td>
                 </tr>
               )}
               {sortedTableData.map(d => (
                 <tr key={d.department}>
                   <td>{d.department}</td>
                   <td>{d.date || 'N/A'}</td>
                   <td>{d.total.toLocaleString()}</td>
                 </tr>
               ))}
             </tbody>
           </table>
        )}
      </div>

      {showPdfModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div className="card" style={{ width: '400px', maxWidth: '90%' }}>
            <h3 style={{ marginTop: 0 }}>Select Views to Export</h3>
            
            {isExporting ? (
              <div style={{ margin: '3rem 0', textAlign: 'center' }}>
                <h3 style={{ color: 'white', marginBottom: '1rem' }}>Compiling PDF...</h3>
                <div style={{ background: 'rgba(255,255,255,0.1)', height: '6px', width: '100%', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
                   <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '50%', background: 'var(--primary)', animation: 'slideBar 1s infinite linear' }} />
                </div>
                <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '1rem' }}>This may take a few seconds.</p>
                <style>{`
                  @keyframes slideBar {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(200%); }
                  }
                `}</style>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', margin: '1.5rem 0' }}>
                  <label className="checkbox-item">
                    <input type="checkbox" checked={pdfOptions.bar && pdfOptions.pie && pdfOptions.line && pdfOptions.table} 
                      onChange={(e) => setPdfOptions({ bar: e.target.checked, pie: e.target.checked, line: e.target.checked, table: e.target.checked })} />
                    <strong>Select All</strong>
                  </label>
                  <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '0' }} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem' }}>
                    <label className="checkbox-item">
                      <input type="checkbox" checked={pdfOptions.bar} onChange={(e) => setPdfOptions({ ...pdfOptions, bar: e.target.checked })} />
                      Bar Chart
                    </label>
                    <label className="checkbox-item">
                      <input type="checkbox" checked={pdfOptions.pie} onChange={(e) => setPdfOptions({ ...pdfOptions, pie: e.target.checked })} />
                      Pie Chart
                    </label>
                    <label className="checkbox-item">
                      <input type="checkbox" checked={pdfOptions.line} onChange={(e) => setPdfOptions({ ...pdfOptions, line: e.target.checked })} />
                      Line Chart
                    </label>
                    <label className="checkbox-item">
                      <input type="checkbox" checked={pdfOptions.table} onChange={(e) => setPdfOptions({ ...pdfOptions, table: e.target.checked })} />
                      Data Table
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                  <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowPdfModal(false)}>Cancel</button>
                  <button className="btn" style={{ flex: 1 }} onClick={confirmDownloadPDF} disabled={!pdfOptions.bar && !pdfOptions.pie && !pdfOptions.table}>
                    Download PDF
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Hidden compilation component for high-quality off-screen PDF Snapshotting */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', pointerEvents: 'none' }}>
         <div id="pdf-export" style={{ width: '800px', padding: '20px', background: theme === 'dark' ? '#131521' : '#ffffff', color: theme === 'dark' ? 'white' : 'black' }}>
            <h1 style={{ textAlign: 'center', marginBottom: '20px' }}>Analysis: {title}</h1>
            
            {leaderboard && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '40px' }}>
                <div style={{ background: theme === 'dark' ? 'rgba(16, 185, 129, 0.05)' : '#f0fdf4', borderRadius: '8px', padding: '20px', border: `1px solid ${theme === 'dark' ? 'rgba(16, 185, 129, 0.2)' : '#bbf7d0'}` }}>
                  <h2 style={{ margin: '0 0 10px 0', color: '#10b981' }}>Top Seller{leaderboard.top.length > 1 ? 's' : ''}</h2>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: theme === 'dark' ? '#cbd5e1' : '#475569', fontSize: '1.2rem' }}>
                    {leaderboard.top.map(d => <li key={`pdf-top-${d.department}`}><strong>{d.department}</strong> ({d.total.toLocaleString()})</li>)}
                  </ul>
                </div>
                <div style={{ background: theme === 'dark' ? 'rgba(239, 68, 68, 0.05)' : '#fef2f2', borderRadius: '8px', padding: '20px', border: `1px solid ${theme === 'dark' ? 'rgba(239, 68, 68, 0.2)' : '#fecaca'}` }}>
                  <h2 style={{ margin: '0 0 10px 0', color: '#ef4444' }}>Lowest Seller{leaderboard.bottom.length > 1 ? 's' : ''}</h2>
                  <ul style={{ margin: 0, paddingLeft: '20px', color: theme === 'dark' ? '#cbd5e1' : '#475569', fontSize: '1.2rem' }}>
                    {leaderboard.bottom.map(d => <li key={`pdf-bot-${d.department}`}><strong>{d.department}</strong> ({d.total.toLocaleString()})</li>)}
                  </ul>
                </div>
              </div>
            )}

            <div className="html2pdf__page-break" />
            
            {pdfOptions.bar && (
              <div style={{ marginBottom: '40px' }}>
                <h2 style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b', marginBottom: '20px' }}>Bar Chart Overview</h2>
                <BarChart width={760} height={400} data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
                  <XAxis dataKey="department" stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} />
                  <YAxis stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} />
                  <Bar dataKey="total" fill="#6366f1" radius={[4, 4, 0, 0]} label={{ position: 'top', fill: theme === 'dark' ? '#94a3b8' : '#64748b' }} />
                </BarChart>
                <div className="html2pdf__page-break" />
              </div>
            )}

            {pdfOptions.pie && (
              <div style={{ marginBottom: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <h2 style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b', marginBottom: '20px', width: '100%' }}>Pie Chart Breakdown</h2>
                <PieChart width={760} height={400}>
                  <Pie data={filteredData} dataKey="total" nameKey="department" cx="50%" cy="50%" outerRadius={150} fill="#8884d8" label={({ name }) => name}>
                    {filteredData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
                <div className="html2pdf__page-break" />
              </div>
            )}

            {pdfOptions.line && (
              <div style={{ marginBottom: '40px' }}>
                <h2 style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b', marginBottom: '20px' }}>Line Chart Trend</h2>
                <LineChart width={760} height={400} data={filteredData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} />
                  <XAxis dataKey="department" stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} />
                  <YAxis stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} />
                  <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={3} dot={{ r: 6 }} />
                </LineChart>
                <div className="html2pdf__page-break" />
              </div>
            )}

            {pdfOptions.table && (
              <div>
                <h2 style={{ color: theme === 'dark' ? '#94a3b8' : '#64748b', marginBottom: '20px' }}>Data Table</h2>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: theme === 'dark' ? 'white' : 'black' }}>
                  <thead>
                    <tr style={{ background: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f1f5f9' }}>
                      <th style={{ padding: '12px', borderBottom: `2px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}` }}>Department</th>
                      <th style={{ padding: '12px', borderBottom: `2px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}` }}>Date</th>
                      <th style={{ padding: '12px', borderBottom: `2px solid ${theme === 'dark' ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}` }}>Total Sales</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTableData.map((d, i) => (
                      <tr key={d.department} style={{ borderBottom: `1px solid ${theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#e2e8f0'}`, background: i % 2 === 0 ? 'transparent' : (theme === 'dark' ? 'rgba(255,255,255,0.02)' : '#f8fafc') }}>
                        <td style={{ padding: '12px' }}>{d.department}</td>
                        <td style={{ padding: '12px' }}>{d.date || 'N/A'}</td>
                        <td style={{ padding: '12px' }}>{d.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
         </div>
      </div>

    </div>
  );
}
