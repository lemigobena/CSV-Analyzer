import { parentPort, workerData } from 'worker_threads';
import fs from 'fs';
import csvParser from 'csv-parser';

const { jobId, inputFilePath, outputFilePath } = workerData;

async function processCsv() {
  try {
    const departmentData: Record<string, { total: number, date: string }> = {};
    const totalBytes = fs.statSync(inputFilePath).size;
    let bytesProcessed = 0;
    let lastReportedProgress = 0;
    const startTime = Date.now();

    const readStream = fs.createReadStream(inputFilePath);
    
    // To track progress, we listen to data chunks on the stream
    readStream.on('data', (chunk) => {
      bytesProcessed += chunk.length;
      const progress = Math.min(99, Math.round((bytesProcessed / totalBytes) * 100));
      
      // Throttle progress reports (only report if it increased by at least 5%)
      if (progress >= lastReportedProgress + 5) {
        lastReportedProgress = progress;
        parentPort?.postMessage({
          type: 'progress',
          data: { progress }
        });
      }
    });

    readStream
      .pipe(csvParser({ headers: ['department', 'date', 'sales'], skipLines: 0 }))
      .on('data', (row) => {
        // Since we force headers to ['department', 'date', 'sales'],
        // row.department is column 0, row.sales is column 2
        
        const rawDept = typeof row.department === 'string' ? row.department.trim() : null;
        // Normalize department names (e.g. "electronics" -> "Electronics")
        const dept = rawDept ? rawDept.split(/\s+/).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : null;
        
        const rawDate = typeof row.date === 'string' ? row.date.trim() : 'N/A';
        const sales = parseInt(row.sales, 10);
        
        // Skip invalid rows (e.g. the original header row if it existed)
        if (!dept || isNaN(sales)) return;
        
        if (!departmentData[dept]) {
          departmentData[dept] = { total: 0, date: rawDate === 'Date' ? 'N/A' : rawDate };
        }
        departmentData[dept].total += sales;

        // Track the latest valid date
        if (rawDate && rawDate !== 'Date' && rawDate !== 'N/A' && rawDate > departmentData[dept].date) {
            departmentData[dept].date = rawDate;
        }
      })
      .on('end', () => {
        // Finished aggregating, now write output manually to avoid bringing large libraries
        const outputStream = fs.createWriteStream(outputFilePath);
        outputStream.write(`Department Name,Total Number of Sales\n`);
        
        const departments = Object.keys(departmentData);
        const jsonData: { department: string, total: number, date: string }[] = [];

        for (const dept of departments) {
          // Escape quotes in department name if any
          const cleanDept = dept.includes(',') ? `"${dept.replace(/"/g, '""')}"` : dept;
          const total = departmentData[dept].total;
          outputStream.write(`${cleanDept},${total}\n`);
          jsonData.push({ department: dept, total, date: departmentData[dept].date });
        }
        
        outputStream.end();

        // Write JSON data
        const jsonOutputPath = outputFilePath.replace('.csv', '.json');
        fs.writeFileSync(jsonOutputPath, JSON.stringify({ data: jsonData }));

        outputStream.on('finish', () => {
          const processingTimeMs = Date.now() - startTime;
          parentPort?.postMessage({
            type: 'completed',
            data: {
              metrics: {
                processingTimeMs,
                totalDepartments: departments.length
              }
            }
          });
        });

      })
      .on('error', (err) => {
        parentPort?.postMessage({
          type: 'error',
          data: { error: err.message }
        });
      });
      
  } catch (error: any) {
    parentPort?.postMessage({
      type: 'error',
      data: { error: error.message }
    });
  }
}

processCsv();
