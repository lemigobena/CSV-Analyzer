import fs from 'fs';
import path from 'path';

export interface Job {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  downloadUrl?: string;
  metrics?: {
    processingTimeMs: number;
    totalDepartments: number;
  };
  error?: string;
  createdAt: number;
  title?: string;
}

const HISTORY_FILE = path.join(__dirname, '../../history.json');

export let jobs: Record<string, Job> = {};

export function loadJobs() {
  if (fs.existsSync(HISTORY_FILE)) {
    try {
      const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
      jobs = JSON.parse(data);
    } catch (e) {
      console.error('Failed to load history', e);
      jobs = {};
    }
  }
}

export function saveJobs() {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(jobs, null, 2));
  } catch (e) {
    console.error('Failed to save history', e);
  }
}

// Initial load
loadJobs();
