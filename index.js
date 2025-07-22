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

// 4. GET /page: show HTML page of file list
app.get('/page', async (req, res) => {
  try {
    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    const listItems = jsonFiles.map(f => `<li><a href="/data/${f}">${f}</a></li>`).join('');
    const html = `
      <html>
        <head><title>JSON File List</title></head>
        <body>
          <h1>Received JSON Files</h1>
          <ul>${listItems}</ul>
        </body>
      </html>
    `;
    res.send(html);
  } catch (err) {
    res.status(500).send('Failed to list files');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
