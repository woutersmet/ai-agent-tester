const express = require('express');
const { exec, spawn } = require('child_process');
const cors = require('cors');
const os = require('os');
const sessionStorage = require('./sessionStorage');

const app = express();

// Helper function to get proper environment with PATH for spawned processes
function getSpawnEnv() {
  return {
    ...process.env,
    // Add common paths where CLI tools might be installed
    PATH: [
      process.env.PATH,
      '/usr/local/bin',
      '/opt/homebrew/bin',
      '/usr/bin',
      '/bin',
      `${os.homedir()}/.local/bin`,
      `${os.homedir()}/bin`
    ].filter(Boolean).join(':')
  };
}

// Track if session storage has been initialized
let sessionStorageInitialized = false;

// Initialize session storage (will be called when server starts listening)
async function initializeSessionStorage() {
  if (!sessionStorageInitialized) {
    try {
      await sessionStorage.initialize();
      sessionStorageInitialized = true;
    } catch (err) {
      console.error('Failed to initialize session storage:', err);
    }
  }
}

// Export the initialization function so main.js can call it
app.initializeSessionStorage = initializeSessionStorage;

// Middleware
app.use(cors());
app.use(express.json());

// Middleware to ensure session storage is initialized
async function ensureSessionStorage(req, res, next) {
  try {
    await initializeSessionStorage();
    next();
  } catch (error) {
    console.error('Error initializing session storage:', error);
    res.status(500).json({ error: 'Failed to initialize session storage', details: error.message });
  }
}

// Track running processes for cancellation
const runningProcesses = new Map();

// Whitelist of allowed commands for security
const ALLOWED_COMMANDS = {
  'gemini': { cmd: 'gemini', args: ['-p', '{{USER_MESSAGE}}'], supportsTemplate: true, description: 'Use Gemini agent with your prompt', isAgent: true, requiresInput: true },
  'claude': { cmd: 'claude', args: ['-p', '{{USER_MESSAGE}}'], supportsTemplate: true, description: 'Use Claude CLI with your prompt', isAgent: true, requiresInput: true },
  'chatgpt': { cmd: 'codex', args: ['{{USER_MESSAGE}}'], supportsTemplate: true, description: 'Use ChatGPT Codex CLI with your prompt', isAgent: true, requiresInput: true },
  'api-request': { cmd: 'curl', args: [], description: 'Basic API request', isApiRequest: true, requiresInput: true },
  'raw-terminal': { cmd: 'custom', args: [], description: 'Execute raw terminal command', isCustom: true, requiresInput: true },
  'ls': { cmd: 'ls', args: ['-la'], description: 'List files in current folder', requiresInput: false },
  'whoami': { cmd: 'whoami', args: [], description: 'Show current computer user', requiresInput: false },
  'node-version': { cmd: 'node', args: ['--version'], description: 'Show installed version of Node.js', requiresInput: false },
  'echo-test': { cmd: 'echo', args: ['Hello from AI Agent Tester!'], description: 'Echo a test message', requiresInput: false }
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'AI Agent Tester API is running',
    timestamp: new Date().toISOString()
  });
});

// Get list of available commands
app.get('/api/commands', (req, res) => {
  const commands = Object.keys(ALLOWED_COMMANDS).map(key => {
    const cmdConfig = ALLOWED_COMMANDS[key];
    return {
      id: key,
      description: cmdConfig.description || `Execute ${cmdConfig.cmd} ${cmdConfig.args.join(' ')}`,
      isCustom: cmdConfig.isCustom || false,
      isAgent: cmdConfig.isAgent || false,
      isApiRequest: cmdConfig.isApiRequest || false,
      requiresInput: cmdConfig.requiresInput !== false
    };
  });
  res.json({ commands });
});

// Execute a whitelisted command
app.post('/api/execute', (req, res) => {
  const { commandId, customArgs, userMessage, processId, apiMethod, apiUrl, apiToken, apiBody } = req.body;

  if (!commandId || !ALLOWED_COMMANDS[commandId]) {
    return res.status(400).json({
      error: 'Invalid command',
      availableCommands: Object.keys(ALLOWED_COMMANDS)
    });
  }

  const { cmd, args, supportsTemplate, isAgent, isApiRequest } = ALLOWED_COMMANDS[commandId];

  // Handle API request command specially
  if (isApiRequest && commandId === 'api-request') {
    if (!apiUrl) {
      return res.status(400).json({
        error: 'API URL is required for api-request command'
      });
    }

    const method = apiMethod || 'GET';
    const curlArgs = ['-X', method];

    // Add Authorization header if token is provided
    if (apiToken) {
      curlArgs.push('-H', `Authorization: Bearer ${apiToken}`);
    }

    // Add body for POST requests
    if (method === 'POST' && apiBody) {
      curlArgs.push('-H', 'Content-Type: application/json');
      curlArgs.push('-d', apiBody);
    }

    curlArgs.push(apiUrl, '-i');

    console.log(`Executing API request: curl ${curlArgs.join(' ')}`);

    const childProcess = spawn('curl', curlArgs, { env: getSpawnEnv() });
    let stdout = '';
    let stderr = '';
    let responseSent = false;

    // Close stdin immediately to prevent the process from hanging
    childProcess.stdin.end();

    // Store process for cancellation
    if (processId) {
      runningProcesses.set(processId, childProcess);
    }

    childProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    childProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    childProcess.on('close', (code) => {
      // Remove from running processes
      if (processId) {
        runningProcesses.delete(processId);
      }

      if (responseSent) {
        return; // Response already sent
      }
      responseSent = true;

      res.json({
        success: code === 0,
        exitCode: code,
        stdout: stdout,
        stderr: stderr,
        command: `curl ${curlArgs.join(' ')}`,
        isAgent: false
      });
    });

    childProcess.on('error', (error) => {
      // Remove from running processes
      if (processId) {
        runningProcesses.delete(processId);
      }

      if (responseSent) {
        return; // Response already sent
      }
      responseSent = true;

      res.status(500).json({
        success: false,
        error: error.message,
        command: `curl ${curlArgs.join(' ')}`
      });
    });

    return;
  }

  // If command supports template and userMessage is provided, substitute it
  let finalArgs = customArgs || args;
  if (supportsTemplate && userMessage) {
    finalArgs = finalArgs.map(arg =>
      arg === '{{USER_MESSAGE}}' ? userMessage : arg
    );
  }

  console.log(`Executing: ${cmd} ${finalArgs.join(' ')}`);

  const childProcess = spawn(cmd, finalArgs, { env: getSpawnEnv() });
  let stdout = '';
  let stderr = '';
  let responseSent = false;

  // Close stdin immediately to prevent the process from hanging
  // Many CLI tools (like claude, gemini, chatgpt) wait for stdin to close
  childProcess.stdin.end();

  // Store process for cancellation
  if (processId) {
    runningProcesses.set(processId, childProcess);
  }

  childProcess.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  childProcess.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  childProcess.on('close', (code) => {
    // Remove from running processes
    if (processId) {
      runningProcesses.delete(processId);
    }

    if (responseSent) {
      return; // Response already sent
    }
    responseSent = true;

    res.json({
      success: code === 0,
      exitCode: code,
      stdout: stdout,
      stderr: stderr,
      command: `${cmd} ${finalArgs.join(' ')}`,
      isAgent: isAgent || false
    });
  });

  childProcess.on('error', (error) => {
    // Remove from running processes
    if (processId) {
      runningProcesses.delete(processId);
    }

    if (responseSent) {
      return; // Response already sent
    }
    responseSent = true;

    res.status(500).json({
      success: false,
      error: error.message,
      command: `${cmd} ${finalArgs.join(' ')}`,
      isAgent: isAgent || false
    });
  });
});

// Cancel a running command
app.post('/api/cancel', (req, res) => {
  const { processId } = req.body;

  if (!processId) {
    return res.status(400).json({ error: 'Process ID is required' });
  }

  const childProcess = runningProcesses.get(processId);
  if (childProcess) {
    childProcess.kill();
    runningProcesses.delete(processId);
    console.log(`Cancelled process: ${processId}`);
    res.json({ success: true, message: 'Process cancelled' });
  } else {
    res.status(404).json({ error: 'Process not found or already completed' });
  }
});

// Execute custom command (DANGEROUS - use with caution)
app.post('/api/execute-custom', (req, res) => {
  const { command, processId } = req.body;

  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }

  console.log(`Executing custom command: ${command}`);
  console.warn('⚠️  WARNING: Executing custom command without validation!');

  const childProcess = exec(command, {
    timeout: 30000,
    env: getSpawnEnv(),
    shell: process.platform === 'darwin' ? '/bin/zsh' : true
  }, (error, stdout, stderr) => {
    // Remove from running processes
    if (processId) {
      runningProcesses.delete(processId);
    }

    if (error) {
      // Check if it was killed (cancelled)
      if (error.killed || error.signal === 'SIGTERM') {
        return; // Don't send response, already handled
      }
      return res.status(500).json({
        success: false,
        error: error.message,
        stderr: stderr,
        command: command
      });
    }

    res.json({
      success: true,
      stdout: stdout,
      stderr: stderr,
      command: command
    });
  });

  // Store process for cancellation
  if (processId) {
    runningProcesses.set(processId, childProcess);
  }
});

// Get sessions from file storage
app.get('/api/threads', ensureSessionStorage, async (req, res) => {
  try {
    const sessions = await sessionStorage.getAllSessions();
    res.json({ threads: sessions });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get session details
app.get('/api/threads/:id', ensureSessionStorage, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    const session = await sessionStorage.getSessionById(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session);
  } catch (error) {
    console.error('Error fetching session details:', error);
    res.status(500).json({ error: 'Failed to fetch session details' });
  }
});

// Save or create a session
app.post('/api/threads', ensureSessionStorage, async (req, res) => {
  try {
    const session = req.body;

    if (!session.id || !session.title) {
      return res.status(400).json({ error: 'Session must have id and title' });
    }

    // Ensure session has required fields
    if (!session.timestamp) {
      session.timestamp = new Date().toISOString();
    }
    if (!session.messages) {
      session.messages = [];
    }
    if (!session.preview) {
      session.preview = 'New session - no messages yet';
    }

    const success = await sessionStorage.saveSession(session);

    if (success) {
      res.json({ success: true, thread: session });
    } else {
      res.status(500).json({ error: 'Failed to save session' });
    }
  } catch (error) {
    console.error('Error saving session:', error);
    res.status(500).json({ error: 'Failed to save session' });
  }
});

// Add a message to a session
app.post('/api/threads/:id/messages', ensureSessionStorage, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);
    const message = req.body;

    if (!message.role || !message.content) {
      return res.status(400).json({ error: 'Message must have role and content' });
    }

    // Ensure message has timestamp
    if (!message.timestamp) {
      message.timestamp = new Date().toISOString();
    }

    const success = await sessionStorage.addMessageToSession(sessionId, message);

    if (success) {
      res.json({ success: true, message });
    } else {
      res.status(500).json({ error: 'Failed to add message to session' });
    }
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// Delete a session
app.delete('/api/threads/:id', ensureSessionStorage, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.id);

    if (isNaN(sessionId)) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    const success = await sessionStorage.deleteSession(sessionId);

    if (success) {
      res.json({ success: true, message: 'Session deleted successfully' });
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

module.exports = app;

