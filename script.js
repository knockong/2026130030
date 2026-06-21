// script.js - Simple Water Tracker functionality
// Persistent storage using localStorage with local CSV server synchronization

const DAILY_GOAL = 2000; // ml
let currentIncrement = 250; // default ml per click (adjustable via UI)
let count = 0;
let serverAvailable = false;
let isSyncing = false;

const drinkBtn = document.getElementById('drinkBtn');
const resetBtn = document.getElementById('resetBtn');
const importBtn = document.getElementById('importBtn');
const exportBtn = document.getElementById('exportBtn');
const fileInput = document.getElementById('fileInput');

const currentSpan = document.getElementById('current');
const goalSpan = document.getElementById('goal');
const progressBar = document.getElementById('progressBar');
const percentageP = document.getElementById('percentage');
const successMsg = document.getElementById('successMsg');
const syncStatusDiv = document.getElementById('syncStatus');

goalSpan.textContent = `${DAILY_GOAL} ml`;

// Helper to get local date string YYYY-MM-DD
function getTodayDateString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Update the sync status indicator in the UI
function updateSyncStatus(status, details = '') {
  if (status === 'online') {
    syncStatusDiv.innerHTML = '<span class="status-dot green"></span>엑셀 동기화 중 (CSV 연동)';
    syncStatusDiv.className = 'sync-status online';
  } else if (status === 'syncing') {
    syncStatusDiv.innerHTML = '<span class="status-dot pulse"></span>동기화하는 중...';
    syncStatusDiv.className = 'sync-status syncing';
  } else {
    syncStatusDiv.innerHTML = '<span class="status-dot orange"></span>로컬 브라우저 저장 모드';
    syncStatusDiv.className = 'sync-status offline';
  }
}

// Load today's count from Server (with localStorage fallback)
async function syncWithServer() {
  if (isSyncing) return;
  isSyncing = true;
  updateSyncStatus('syncing');

  const today = getTodayDateString();

  try {
    const response = await fetch('/api/data');
    if (!response.ok) throw new Error('Server response not OK');
    const json = await response.json();

    if (json.success) {
      serverAvailable = true;
      
      // Sync all server data to localStorage for redundancy
      json.data.forEach(item => {
        localStorage.setItem(`water_${item.date}`, item.ml);
      });

      // Find today's value
      const todayRecord = json.data.find(item => item.date === today);
      count = todayRecord ? todayRecord.ml : 0;
      localStorage.setItem(`water_${today}`, count);

      updateUI(count);
      checkGoal(count);
      updateSyncStatus('online');
    }
  } catch (err) {
    console.warn('Backend server not available, using localStorage:', err.message);
    serverAvailable = false;

    // LocalStorage Fallback
    const stored = localStorage.getItem(`water_${today}`);
    count = stored ? parseInt(stored, 10) : 0;
    
    updateUI(count);
    checkGoal(count);
    updateSyncStatus('offline');
  } finally {
    isSyncing = false;
  updateHistoryTable();
  }
}

// Save today's count to Server (with localStorage fallback)
// Save today's count to Server (with optional time, localStorage fallback)
async function saveCount(newCount, timeStr) {
  const today = getTodayDateString();
  localStorage.setItem(`water_${today}`, newCount);

  if (serverAvailable) {
    try {
      const payload = { date: today, ml: newCount };
      if (timeStr && timeStr.length === 6) {
        payload.time = timeStr;
      }
      const response = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await response.json();
      if (!json.success) {
        console.error('Failed to save to server:', json.error);
      }
    } catch (err) {
      console.error('Failed to send save request to server:', err);
      serverAvailable = false;
      updateSyncStatus('offline');
    }
  }
}

function updateUI(countValue) {
  currentSpan.textContent = `${countValue.toLocaleString()} ml`;
  const percent = Math.min(100, Math.round((countValue / DAILY_GOAL) * 100));
  progressBar.style.width = `${percent}%`;
  percentageP.textContent = `${percent}%`;
  
  // Transition bar color when goal is met
  if (percent >= 100) {
    progressBar.style.background = 'linear-gradient(90deg, #11998e, #38ef7d)';
  } else {
    progressBar.style.background = 'linear-gradient(90deg, #00c6ff, #0072ff)';
  }
}

function checkGoal(countValue) {
  if (countValue >= DAILY_GOAL) {
    successMsg.classList.remove('hidden');
  } else {
    successMsg.classList.add('hidden');
  }
}

// Helper to format time strings like "am1230" or "pm0145" to "12:30" or "01:45"
function formatTime(timeStr) {
  if (!timeStr) return '';
  const ampm = timeStr.slice(0, 2);
  const hour = timeStr.slice(2, 4);
  const minute = timeStr.slice(4, 6);
  // Keep hour as two‑digit, assume 12‑hour clock
  return `${hour}:${minute}`;
}

// Update history table UI
function updateHistoryTable() {
  const tbody = document.getElementById('recordTableBody');
  tbody.innerHTML = '';
  const populateFromLocal = () => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('water_'));
    keys.sort().reverse(); // newest first
    keys.forEach(k => {
      const date = k.replace('water_', '');
      const ml = localStorage.getItem(k);
      const tr = document.createElement('tr');
      const tdDate = document.createElement('td'); tdDate.textContent = date;
      const tdTime = document.createElement('td'); tdTime.textContent = '';
      const tdMl = document.createElement('td'); tdMl.textContent = ml;
      tr.append(tdDate, tdTime, tdMl);
      tbody.appendChild(tr);
    });
  };
  if (serverAvailable) {
    fetch('/api/data')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          data.data.forEach(item => {
            const tr = document.createElement('tr');
            const tdDate = document.createElement('td'); tdDate.textContent = item.date;
            const tdTime = document.createElement('td'); tdTime.textContent = formatTime(item.time);
            const tdMl = document.createElement('td'); tdMl.textContent = item.ml;
            tr.append(tdDate, tdTime, tdMl);
            tbody.appendChild(tr);
          });
        } else {
          populateFromLocal();
        }
      })
      .catch(() => populateFromLocal());
  } else {
    populateFromLocal();
  }
}


// Unit Selection Handling
const unitButtons = document.querySelectorAll('.unitBtn');
unitButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    unitButtons.forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    currentIncrement = parseInt(btn.dataset.value, 10);
  });
});

// Event Handlers
drinkBtn.addEventListener('click', async () => {
  // Get selected time values
  const ampm = document.getElementById('amPmSelect').value;
  const hour = String(document.getElementById('hourInput').value).padStart(2, '0');
  const minute = String(document.getElementById('minuteInput').value).padStart(2, '0');
  const timeStr = `${ampm}${hour}${minute}`;
  count += currentIncrement;
  updateUI(count);
  checkGoal(count);
  await saveCount(count, timeStr);
  updateHistoryTable();
});

resetBtn.addEventListener('click', async () => {
  if (confirm('오늘 마신 기록을 처음부터 다시 시작할까요?')) {
    count = 0;
    updateUI(count);
    checkGoal(count);
    await saveCount(count);
    updateHistoryTable();
    
    // Reset increment selection to default (250 ml)
    unitButtons.forEach(b => b.classList.remove('selected'));
    const defaultBtn = Array.from(unitButtons).find(b => b.dataset.value === '250');
    if (defaultBtn) {
      defaultBtn.classList.add('selected');
      currentIncrement = 250;
    }
  }
});

// Manual CSV Export (Download)
exportBtn.addEventListener('click', async () => {
  if (serverAvailable) {
    try {
      const resp = await fetch('/api/data');
      const json = await resp.json();
      if (json.success) {
        const header = 'date,time,ml\n';
        const rows = json.data.map(item => `${item.date},${item.time || ''},${item.ml}`).join('\n') + '\n';
        const csvContent = header + rows;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'water_tracker_export.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }
    } catch (e) {
      console.warn('Export fallback due to server error:', e);
    }
  }
  // Fallback: export from localStorage without time
  const header = 'date,time,ml\n';
  let rows = '';
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('water_')) {
      const date = key.replace('water_', '');
      const ml = localStorage.getItem(key);
      rows += `${date},,${ml}\n`;
    }
  }
  const csvContent = header + rows;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', 'water_tracker_backup.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

// Manual CSV Import
importBtn.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (event) => {
    const text = event.target.result;
    const lines = text.trim().split(/\r?\n/);
    lines.shift(); // remove header

    const promises = [];
    const today = getTodayDateString();

    lines.forEach(line => {
      const parts = line.split(',');
      // Support both legacy (date,ml) and new (date,time,ml) formats
      const date = parts[0];
      let time = '';
      let mlStr = '';
      if (parts.length === 3) {
        time = parts[1];
        mlStr = parts[2];
      } else if (parts.length === 2) {
        mlStr = parts[1];
      }
      const parsed = parseInt(mlStr, 10);
      if (date && !isNaN(parsed)) {
        localStorage.setItem(`water_${date}`, parsed);
        if (date === today) {
          count = parsed;
        }
        // If server is online, push to server too (include time if available)
        if (serverAvailable) {
          const payload = { date, ml: parsed };
          if (time) payload.time = time;
          const promise = fetch('/api/data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }).catch(err => console.error('Import error syncing to server:', err));
          promises.push(promise);
        }
      }
    });

    if (promises.length > 0) {
      await Promise.all(promises);
    }
    
    // Final sync and update UI
    await syncWithServer();
    alert('CSV 데이터를 성공적으로 불러왔습니다!');
  };
  reader.readAsText(file);
});

// Initialize on Load
syncWithServer();

// Auto-sync when window is focused (e.g. returning from Excel)
window.addEventListener('focus', syncWithServer);

// Auto-sync periodically every 5 seconds
setInterval(syncWithServer, 5000);

