import { Worker } from 'worker_threads';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('CSV Processor Worker', () => {
  let inputFilePath: string;
  let outputFilePath: string;

  beforeAll(() => {
    inputFilePath = path.join(os.tmpdir(), `test-input-${Date.now()}.csv`);
    outputFilePath = path.join(os.tmpdir(), `test-output-${Date.now()}.csv`);
    
    // Sample from requirements + invalid rows
    const csvData = `Department Name,Date,Number of Sales
Electronics,2023-08-01,100
Clothing,2023-08-01,200
Electronics,2023-08-02,150
InvalidRow,2023-Bad,Nothing
`;
    fs.writeFileSync(inputFilePath, csvData);
  });

  afterAll(() => {
    if (fs.existsSync(inputFilePath)) fs.unlinkSync(inputFilePath);
    if (fs.existsSync(outputFilePath)) fs.unlinkSync(outputFilePath);
  });

  it('should process CSV and aggregate sales correctly', (done) => {
    const worker = new Worker(path.join(__dirname, '../workers/csvProcessor.ts'), {
      workerData: {
        jobId: 'test-job',
        inputFilePath,
        outputFilePath,
      },
      execArgv: ['-r', 'ts-node/register'] // Allow worker to run TypeScript directly
    });

    let completed = false;
    
    worker.on('message', (msg) => {
      if (msg.type === 'completed') {
        completed = true;
        try {
          expect(msg.data.metrics.totalDepartments).toBe(2); // Since invalid is skipped if NaN
          
          const result = fs.readFileSync(outputFilePath, 'utf-8');
          expect(result).toContain('Electronics,250');
          expect(result).toContain('Clothing,200');
          expect(result).not.toContain('InvalidRow'); // NaN sales should skip
          done();
        } catch (err) {
          done(err);
        }
      } else if (msg.type === 'error') {
        done(new Error(msg.data.error));
      }
    });

    worker.on('error', (err) => {
      done(err);
    });
  });
});
