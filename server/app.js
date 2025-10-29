const express = require('express');
const { exec, spawn } = require('child_process');
const cors = require('cors');
const threadStorage = require('./threadStorage');

const app = express();

// Initialize thread storage on startup
threadStorage.initialize().catch(err => {
  console.error('Failed to initialize thread storage:', err);
});

// Middleware
app.use(cors());
app.use(express.json());

// Track running processes for cancellation
const runningProcesses = new Map();

// Whitelist of allowed commands for security
const ALLOWED_COMMANDS = {
  'raw-terminal': { cmd: 'custom', args: [], description: 'Execute raw terminal command', isCustom: true, requiresInput: true },
  'gemini': { cmd: 'gemini', args: ['-p', '{{USER_MESSAGE}}'], supportsTemplate: true, description: 'Use Gemini agent with your prompt', isAgent: true, requiresInput: true },
  'claude': { cmd: 'claude', args: ['-p', '{{USER_MESSAGE}}'], supportsTemplate: true, description: 'Use Claude CLI with your prompt', isAgent: true, requiresInput: true },
  'chatgpt': { cmd: 'chatgpt', args: ['{{USER_MESSAGE}}'], supportsTemplate: true, description: 'Use ChatGPT CLI with your prompt', isAgent: true, requiresInput: true },
  'ls': { cmd: 'ls', args: ['-la'], description: 'List files in current folder', requiresInput: false },
  'date': { cmd: 'date', args: [], description: 'Show current date and time', requiresInput: false },
  'whoami': { cmd: 'whoami', args: [], description: 'Show current computer user', requiresInput: false },
  'node-version': { cmd: 'node', args: ['--version'], description: 'Show installed version of Node.js', requiresInput: false },
  'echo-test': { cmd: 'echo', args: ['Hello from AI Agent Tester!'], description: 'Echo a test message', requiresInput: false },
  'api-request': { cmd: 'curl', args: [], description: 'Basic API request', isApiRequest: true, requiresInput: true }
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
  const { commandId, customArgs, userMessage, processId, apiMethod, apiUrl } = req.body;

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
    const curlArgs = ['-X', method, apiUrl, '-i'];

    console.log(`Executing API request: curl ${curlArgs.join(' ')}`);

    const childProcess = spawn('curl', curlArgs);
    let stdout = '';
    let stderr = '';
    let responseSent = false;

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

  const childProcess = spawn(cmd, finalArgs);
  let stdout = '';
  let stderr = '';
  let responseSent = false;

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

  const childProcess = exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
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

// Get threads from file storage
app.get('/api/threads', async (req, res) => {
  try {
    const threads = await threadStorage.getAllThreads();
    res.json({ threads });
  } catch (error) {
    console.error('Error fetching threads:', error);
    res.status(500).json({ error: 'Failed to fetch threads' });
  }
});

// Get thread details
app.get('/api/threads/:id', async (req, res) => {
  try {
    const threadId = parseInt(req.params.id);
    const thread = await threadStorage.getThreadById(threadId);

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    res.json(thread);
  } catch (error) {
    console.error('Error fetching thread details:', error);
    res.status(500).json({ error: 'Failed to fetch thread details' });
  }
});

// Save or create a thread
app.post('/api/threads', async (req, res) => {
  try {
    const thread = req.body;

    if (!thread.id || !thread.title) {
      return res.status(400).json({ error: 'Thread must have id and title' });
    }

    // Ensure thread has required fields
    if (!thread.timestamp) {
      thread.timestamp = new Date().toISOString();
    }
    if (!thread.messages) {
      thread.messages = [];
    }
    if (!thread.preview) {
      thread.preview = 'New thread - no messages yet';
    }

    const success = await threadStorage.saveThread(thread);

    if (success) {
      res.json({ success: true, thread });
    } else {
      res.status(500).json({ error: 'Failed to save thread' });
    }
  } catch (error) {
    console.error('Error saving thread:', error);
    res.status(500).json({ error: 'Failed to save thread' });
  }
});

// Add a message to a thread
app.post('/api/threads/:id/messages', async (req, res) => {
  try {
    const threadId = parseInt(req.params.id);
    const message = req.body;

    if (!message.role || !message.content) {
      return res.status(400).json({ error: 'Message must have role and content' });
    }

    // Ensure message has timestamp
    if (!message.timestamp) {
      message.timestamp = new Date().toISOString();
    }

    const success = await threadStorage.addMessageToThread(threadId, message);

    if (success) {
      res.json({ success: true, message });
    } else {
      res.status(500).json({ error: 'Failed to add message to thread' });
    }
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// Delete a thread
app.delete('/api/threads/:id', async (req, res) => {
  try {
    const threadId = parseInt(req.params.id);

    if (isNaN(threadId)) {
      return res.status(400).json({ error: 'Invalid thread ID' });
    }

    const success = await threadStorage.deleteThread(threadId);

    if (success) {
      res.json({ success: true, message: 'Thread deleted successfully' });
    } else {
      res.status(404).json({ error: 'Thread not found' });
    }
  } catch (error) {
    console.error('Error deleting thread:', error);
    res.status(500).json({ error: 'Failed to delete thread' });
  }
});

module.exports = app;

