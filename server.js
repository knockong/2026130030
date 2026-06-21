// server.js - Lightweight Node.js backend for Simple Water Tracker with time recording
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const CSV_FILE = 'water_tracker.csv';
const CSV_PATH = path.join(__dirname, CSV_FILE);

// Ensure CSV file exists with header date,time,ml
function ensureCSV() {
  if (!fs.existsSync(CSV_PATH)) {
    fs.writeFileSync(CSV_PATH, 'date,time,ml\n', 'utf8');
  }
}

// Read CSV and return array of records {date, time, ml}
function readCSV() {
  ensureCSV();
  const content = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = content.trim().split(/\r?\n/);
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.split(',');
    if (parts.length === 3) {
      const [date, time, ml] = parts;
      data.push({ date, time, ml: parseInt(ml, 10) });
    } else if (parts.length === 2) { // legacy without time column
      const [date, ml] = parts;
      data.push({ date, time: '', ml: parseInt(ml, 10) });
    }
  }
  return data;
}

// Write CSV with BOM for Excel
function writeCSV(data) {
  data.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });
  const bom = '\ufeff';
  let content = 'date,time,ml\n';
  data.forEach(item => {
    const time = item.time || '';
    content += `${item.date},${time},${item.ml}\n`;
  });
  fs.writeFileSync(CSV_PATH, bom + content, 'utf8');
}

// Helper to generate current time string like am0502
function getCurrentTimeString() {
  const now = new Date();
  const hour24 = now.getHours();
  const ampm = hour24 >= 12 ? 'pm' : 'am';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const hourStr = String(hour12).padStart(2, '0');
  const minuteStr = String(now.getMinutes()).padStart(2, '0');
  return `${ampm}${hourStr}${minuteStr}`;
}

const server = http.createServer((req, res) => {
  const url = req.url;
  const method = req.method;

  // GET all records
  if (url === '/api/data' && method === 'GET') {
    try {
      const data = readCSV();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, data }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // POST a new record (date, time?, ml)
  if (url === '/api/data' && method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { date, time, ml } = payload;
        if (!date || typeof ml !== 'number') {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: 'Invalid payload' }));
          return;
        }
        const recordTime = time && time.length === 6 ? time : getCurrentTimeString();
        const data = readCSV();
        data.push({ date, time: recordTime, ml });
        writeCSV(data);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, data }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Serve static assets
  let filePath = path.join(__dirname, url === '/' ? 'index.html' : url);
  const ext = path.extname(filePath);
  let contentType = 'text/plain';
  switch (ext) {
    case '.html': contentType = 'text/html; charset=utf-8'; break;
    case '.css': contentType = 'text/css'; break;
    case '.js': contentType = 'application/javascript'; break;
    case '.png': contentType = 'image/png'; break;
    case '.jpg':
    case '.jpeg': contentType = 'image/jpeg'; break;
    case '.ico': contentType = 'image/x-icon'; break;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>', 'utf8');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`Data CSV stored at: ${CSV_PATH}`);
});
