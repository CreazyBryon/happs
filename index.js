import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import archiver from 'archiver';

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.resolve('data');
app.use(express.static('public'));
app.use(express.json());

// Ensure data directory exists
fs.mkdir(DATA_DIR, { recursive: true });


function basicAuth(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Restricted"');
    return res.status(401).send('Authentication required.');
  }
  const base64 = auth.split(' ')[1];
  const [user, pass] = Buffer.from(base64, 'base64').toString().split(':');
  // Change these to your desired username and password
  if (user === 'skidata' && pass === 'pass123') {
    return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Restricted"');
  return res.status(401).send('Invalid credentials.');
}

// 1. POST /data: receive any JSON, save to file by time
app.post('/data',basicAuth, async (req, res) => {
  try {
    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    if (jsonFiles.length >= 100) {
      return res.status(429).json({ error: 'File limit reached. Cannot receive more data.' });
    }

    const jsonData = req.body;
    const headers = req.headers;
    const now = new Date();
    // Format: YYYY-MM-DD_HH-mm-ss
    const timestamp = now.toISOString().replace(/[:.]/g, '');
    const localTime = now.toLocaleString();
    const filename = `recv_${timestamp}.json`;
    const filepath = path.join(DATA_DIR, filename);
    const toSave = { "request_local_time":localTime, "request_headers":headers, "request_body": jsonData };


    await fs.writeFile(filepath, JSON.stringify(toSave, null, 2), 'utf-8');
    res.json({ message: 'Data and headers saved', filename });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save file' });
  }
});

// 2. GET /list: list all received JSON files
app.get('/list', async (req, res) => {
  try {
    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    res.json(jsonFiles);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list files' });
  }
});

// 3. GET /data/:name: get one JSON by name
app.get('/data/:name', async (req, res) => {
  const filename = req.params.name;
  const filepath = path.join(DATA_DIR, filename);
  try {
    const data = await fs.readFile(filepath, 'utf-8');
    res.type('application/json').send(data);
  } catch (err) {
    res.status(404).json({ error: 'File not found' });
  }
});

// 4. GET /page: show HTML page of file list with styles
app.get('/page',basicAuth, async (req, res) => {
  try {
    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    const listItems = jsonFiles.map(f => `
  <li class="file-item">
    <a href="/data/${f}" target="_blank">${f}</a>
    <button class="download-btn" onclick="downloadFile('${f}')">Download</button>
    <button class="delete-btn" onclick="confirmDeleteFile('${f}')">Delete</button>
  </li>
`).join('');
const html = `
  <html>
    <head>
      <title>JSON File List</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f7f7f7; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px #ccc; padding: 24px; }
        h1 { text-align: center; color: #333; }
        ul { list-style: none; padding: 0; }
        .file-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
        .file-item:last-child { border-bottom: none; }
        a { color: #0078d4; text-decoration: none; font-weight: 500; }
        a:hover { text-decoration: underline; }
        .delete-btn { background: #e53e3e; color: #fff; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; transition: background 0.2s; }
        .delete-btn:hover { background: #c53030; }
        .download-btn { background: #38a169; color: #fff; border: none; border-radius: 4px; padding: 6px 12px; cursor: pointer; margin-right: 8px; transition: background 0.2s; }
        .download-btn:hover { background: #2f855a; }
        .delete-all-btn { background: #3182ce; color: #fff; border: none; border-radius: 4px; padding: 8px 16px; margin-bottom: 16px; cursor: pointer; transition: background 0.2s; display: block; margin-left: auto; margin-right: auto; }
        .delete-all-btn:hover { background: #2b6cb0; }
      </style>
      <script>
        function confirmDeleteFile(name) {
          if (confirm('Are you sure you want to delete ' + name + '?')) {
            fetch('/data/' + name, { method: 'DELETE' })
              .then(res => res.json())
              .then(() => location.reload());
          }
        }
        function confirmDeleteAll() {
          if (confirm('Are you sure you want to delete ALL files?')) {
            fetch('/data/all', { method: 'DELETE' })
              .then(res => res.json())
              .then(() => location.reload());
          }
        }
        function downloadFile(name) {
          window.open('/download/' + name, '_blank');
        }
      </script>
    </head>
    <body>
      <div class="container">
        <h1>Received JSON Files</h1>
        <button class="delete-all-btn" onclick="confirmDeleteAll()">Delete All Files</button>
        <ul>${listItems}</ul>
      </div>
    </body>
  </html>
`;
    res.send(html);
  } catch (err) {
    res.status(500).send('Failed to list files');
  }
});

// 5. DELETE /data/:name: delete file by name, or all files if name = 'all'
app.delete('/data/:name', async (req, res) => {
  const filename = req.params.name;
  if (filename === 'all') {
    try {
      const files = await fs.readdir(DATA_DIR);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      await Promise.all(jsonFiles.map(f => fs.unlink(path.join(DATA_DIR, f))));
      res.json({ message: 'All files deleted' });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete all files' });
    }
  } else {
    const filepath = path.join(DATA_DIR, filename);
    try {
      await fs.unlink(filepath);
      res.json({ message: `File ${filename} deleted` });
    } catch (err) {
      res.status(404).json({ error: 'File not found or failed to delete' });
    }
  }
});

// 6. GET /download/:name: download a file by name
app.get('/download/:name', async (req, res) => {
  const filename = req.params.name;
  const filepath = path.join(DATA_DIR, filename);
  try {
    await fs.access(filepath);
    res.download(filepath, filename);
  } catch (err) {
    res.status(404).send('File not found');
  }
});

// 7. GET /download/all: download all JSON files as a ZIP
app.get('/downloadall', async (req, res) => {
  try {
    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    if (jsonFiles.length === 0) {
      return res.status(404).send('No files to download');
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="all_json_files.zip"');
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);
    for (const file of jsonFiles) {
      archive.file(path.join(DATA_DIR, file), { name: file });
    }
    archive.finalize();
  } catch (err) {
    res.status(500).send('Failed to create ZIP');
  }
});


app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
