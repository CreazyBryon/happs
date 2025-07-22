import express from 'express';
import fs from 'fs/promises';
import path from 'path';

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.resolve('data');

app.use(express.json());

// Ensure data directory exists
fs.mkdir(DATA_DIR, { recursive: true });

// 1. POST /data: receive any JSON, save to file by time
app.post('/data', async (req, res) => {
  const jsonData = req.body;
  const timestamp = Date.now();
  const filename = `${timestamp}.json`;
  const filepath = path.join(DATA_DIR, filename);
  try {
    await fs.writeFile(filepath, JSON.stringify(jsonData, null, 2), 'utf-8');
    res.json({ message: 'Data saved', filename });
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
app.get('/page', async (req, res) => {
  try {
    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    const listItems = jsonFiles.map(f => `
      <li class="file-item">
        <a href="/data/${f}" target="_blank">${f}</a>
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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
