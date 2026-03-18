import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { Worker } from 'worker_threads';
import { jobs, saveJobs } from './jobStore';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
// increase limits for large JSON manual uploads
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const uploadDir = path.join(__dirname, '../uploads');
const outputDir = path.join(__dirname, '../outputs');

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = uuidv4();
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// POST /upload - Upload CSV
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const jobId = uuidv4();
  
  jobs[jobId] = {
    id: jobId,
    status: 'pending',
    progress: 0,
    createdAt: Date.now(),
    title: req.file.originalname,
  };
  saveJobs();

  const inputFilePath = req.file.path;
  const outputFilePath = path.join(outputDir, `${jobId}-result.csv`);

  startWorker(jobId, inputFilePath, outputFilePath);

  res.status(202).json({ jobId, message: 'Processing started' });
});

// POST /upload/json - Process JSON array from Editable Table directly
app.post('/api/upload/json', (req, res) => {
  const { data, title } = req.body;
  if (!data || !Array.isArray(data)) {
    return res.status(400).json({ error: 'Invalid JSON array provided' });
  }

  const jobId = uuidv4();
  jobs[jobId] = {
    id: jobId,
    status: 'pending',
    progress: 0,
    createdAt: Date.now(),
    title: title || 'Manual Entry',
  };
  saveJobs();

  // Create a temporary CSV from the provided JSON to process same as CSV
  const inputFilePath = path.join(uploadDir, `${jobId}-manual.csv`);
  const outputFilePath = path.join(outputDir, `${jobId}-result.csv`);

  const csvContent = ['Department Name,Date,Number of Sales']
    .concat(data.map((row: any) => `${row.department},${row.date || '2023-01-01'},${row.sales || 0}`))
    .join('\n');
    
  fs.writeFileSync(inputFilePath, csvContent);
  startWorker(jobId, inputFilePath, outputFilePath);

  res.status(202).json({ jobId, message: 'Processing started' });
});

function startWorker(jobId: string, inputFilePath: string, outputFilePath: string) {
  const isTs = __filename.endsWith('.ts');
  const workerExt = isTs ? 'ts' : 'js';
  const workerPath = path.join(__dirname, `workers/csvProcessor.${workerExt}`);
  const execArgv = isTs ? ['-r', 'ts-node/register'] : undefined;

  const worker = new Worker(workerPath, {
    workerData: { jobId, inputFilePath, outputFilePath },
    execArgv
  });

  worker.on('message', (message) => {
    if (!jobs[jobId]) return;

    if (message.type === 'progress') {
      jobs[jobId].progress = message.data.progress;
      jobs[jobId].status = 'processing';
      saveJobs();
    } else if (message.type === 'completed') {
      jobs[jobId].status = 'completed';
      jobs[jobId].progress = 100;
      jobs[jobId].downloadUrl = `/api/download/${jobId}`;
      jobs[jobId].metrics = message.data.metrics;
      saveJobs();
    } else if (message.type === 'error') {
      jobs[jobId].status = 'failed';
      jobs[jobId].error = message.data.error;
      saveJobs();
    }
  });

  worker.on('error', (err: any) => {
    if (jobs[jobId]) {
      jobs[jobId].status = 'failed';
      jobs[jobId].error = err?.message || 'Worker processing failed unexpectedly.';
      saveJobs();
    }
  });
}

// GET /status/:id - SSE endpoint
app.get('/api/status/:id', (req, res) => {
  const { id } = req.params;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendUpdate = () => {
    const job = jobs[id];
    if (job) {
      res.write(`data: ${JSON.stringify(job)}\n\n`);
      if (job.status === 'completed' || job.status === 'failed') {
        clearInterval(interval);
        res.end();
      }
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Job not found' })}\n\n`);
      clearInterval(interval);
      res.end();
    }
  };

  const interval = setInterval(sendUpdate, 500);
  sendUpdate(); // Send initial immediately

  req.on('close', () => {
    clearInterval(interval);
  });
});

// Global GET /analysis is removed for privacy. Users retrieve by ID.

// GET /analysis/:id - Get specific job details
app.get('/api/analysis/:id', (req, res) => {
  const { id } = req.params;
  const job = jobs[id];
  
  if (!job) return res.status(404).json({ error: 'Job not found' });
  
  if (job.status === 'completed') {
    const jsonOutputPath = path.join(outputDir, `${id}-result.json`);
    if (fs.existsSync(jsonOutputPath)) {
      const data = JSON.parse(fs.readFileSync(jsonOutputPath, 'utf-8'));
      return res.json({ job, data: data.data });
    }
  }
  
  res.json({ job, data: null });
});

// DELETE /analysis/:id - Remove job and files
app.delete('/api/analysis/:id', (req, res) => {
  const { id } = req.params;
  
  if (!jobs[id]) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // delete files
  const csvOutputPath = path.join(outputDir, `${id}-result.csv`);
  const jsonOutputPath = path.join(outputDir, `${id}-result.json`);
  
  if (fs.existsSync(csvOutputPath)) fs.unlinkSync(csvOutputPath);
  if (fs.existsSync(jsonOutputPath)) fs.unlinkSync(jsonOutputPath);
  
  delete jobs[id];
  saveJobs();
  res.json({ success: true });
});

// GET /download/:id - Download resulting CSV
app.get('/api/download/:id', (req, res) => {
  const { id } = req.params;
  const job = jobs[id];

  if (!job || job.status !== 'completed') {
    return res.status(404).json({ error: 'File not ready or job not found' });
  }

  const outputFilePath = path.join(outputDir, `${id}-result.csv`);
  if (!fs.existsSync(outputFilePath)) {
    return res.status(404).json({ error: 'File missing on disk' });
  }

  res.download(outputFilePath, `aggregated-sales-${id}.csv`);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
