const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');
const pm2 = require('pm2');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

let botCounter = 1; // to create unique bot names

// Connect to pm2
function pm2Connect() {
  return new Promise((resolve, reject) => {
    pm2.connect(err => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// Disconnect pm2
function pm2Disconnect() {
  pm2.disconnect();
}

// Deploy and run bot
app.post('/deploy', async (req, res) => {
  try {
    const { code, zipUrl } = req.body;
    if (!code && !zipUrl) {
      return res.status(400).json({ error: 'Code or zipUrl required' });
  }
    // Create unique bot name
    const botName = `bot${botCounter++}`;

    // Prepare temp folder for this bot
    const botDir = path.join(tempDir, botName);
    if (!fs.existsSync(botDir)) fs.mkdirSync(botDir, { recursive: true });

    // Save code or unzip project
    if (code) {
      // Save code to script.js
      fs.writeFileSync(path.join(botDir, 'script.js'), code);
      // Write package.json with extracted dependencies if needed
      // For simplicity, assuming user provides package.json in zip or we install later
    } else if (zipUrl) {
      // Download and unzip code - left as exercise or add your existing unzip logic here
      // For now returning error to add unzip logic
      return res.status(501).json({ error: 'Zip URL deploy not implemented in this update' });
    }

    // Connect to pm2
    await pm2Connect();

    // Install dependencies once
    exec('npm install', { cwd: botDir }, (installErr) => {
      if (installErr) {
        pm2Disconnect();
        return res.status(500).json({ error: 'Dependency install failed', details: installErr.message });
      }

      // Start bot with pm2 (auto restart enabled)
      pm2.start({
        name: botName,
        script: path.join(botDir, 'script.js'),
        cwd: botDir,
        autorestart: true,
        }, (startErr, proc) => {
        pm2Disconnect();
        if (startErr) return res.status(500).json({ error: 'Failed to start bot', details: startErr.message });

        res.json({ message: 'Bot deployed and running', botName });
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
});

// List running bots
app.get('/bots', (req, res) => {
  pm2.connect(err => {
    if (err) return res.status(500).json({ error: 'PM2 connect error', details: err.message });

    pm2.list((listErr, list) => {
      pm2.disconnect();
      if (listErr) return res.status(500).json({ error: 'Failed to list bots', details: listErr.message });

      const bots = list
        .filter(proc => proc.name.startsWith('bot'))
        .map(proc => ({
          name: proc.name,
          pid: proc.pid,
          status: proc.pm2_env.status,
          restart_count: proc.pm2_env.restart_time
        }));

      res.json({ bots });
    });
  });
});

// Get logs of a bot
app.get('/logs/:botName', (req, res) => {
  const { botName } = req.params;

  pm2.connect(err => {
    if (err) return res.status(500).json({ error: 'PM2 connect error', details: err.message });

    pm2.describe(botName, (descErr, processDescription) => {
      pm2.disconnect();
      return res.status(404).json({ error: 'Bot not found' });
      

      // Tail logs logic depends on pm2 logs storage, here just example with pm2 logs
      // For real-time logs, you'd use pm2 logs stream or files
      // Here we return a placeholder
      res.json({ message: `Logs fetching for{botName} is not implemented, implement log streaming or file read.` });
    });
  });
});

// Stop a bot
app.post('/stop', (req, res) => {
  const { botName } = req.body;
  if (!botName) return res.status(400).json({ error: 'botName is required' });

  pm2.connect(err => {
    if (err) return res.status(500).json({ error: 'PM2 connect error', details: err.message });

    pm2.stop(botName, (stopErr) => {
      pm2.disconnect();
      if (stopErr) return res.status(404).json({ error: 'Failed to stop bot or bot not found', details: stopErr.message });
      res.json({ message: `botName stopped successfully` });
    });
  });
});

// Node version info endpoint
app.get('/node-version', (req, res) => 
  exec('node -v', (err, stdout) => {
    if (err) { return res.status(500).json({ error: 'Failed to get Node.js version' });
  }
    res.json({ nodeVersion: stdout.trim() });
      });
  );

app.listen(PORT, () => console.log(`Backend API running on port{PORT}`));
