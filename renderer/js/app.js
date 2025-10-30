// Import utilities
import {
  formatTime,
  escapeHtml,
  processCurlResponse,
  loadThemePreference,
  applyTheme,
  updateStatus,
  updateAPIStatus,
  generateSessionTitle,
  loadApiRequestValues,
  saveApiRequestValues
} from './ui-utils.js';

// API Configuration
let API_BASE_URL = 'http://localhost:3000/api'; // Default, will be updated

// State
let currentSessionId = null;
let sessions = [];
let filteredSessions = [];
let availableCommands = [];
let searchQuery = '';
let isExecuting = false;
let shouldCancel = false;

// DOM Elements
const sessionList = document.getElementById('sessionList');
const messagesContainer = document.getElementById('messagesContainer');
const sessionTitle = document.getElementById('sessionTitle');
const sessionTimestamp = document.getElementById('sessionTimestamp');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const commandSelect = document.getElementById('commandSelect');
const newSessionBtn = document.getElementById('newSessionBtn');
const restartBtn = document.getElementById('restartBtn');
const searchInput = document.getElementById('searchInput');
const inputWrapper = document.getElementById('inputWrapper');
const inputWrapperApi = document.getElementById('inputWrapperApi');
const inputWrapperDisabled = document.getElementById('inputWrapperDisabled');
const apiMethodSelect = document.getElementById('apiMethodSelect');
const apiUrlInput = document.getElementById('apiUrlInput');
const apiTokenInput = document.getElementById('apiTokenInput');
const apiBodyInput = document.getElementById('apiBodyInput');
const sendBtnApi = document.getElementById('sendBtnApi');
const sendBtnDisabled = document.getElementById('sendBtnDisabled');
const waitingState = document.getElementById('waitingState');
const cancelBtn = document.getElementById('cancelBtn');
const deleteSessionBtn = document.getElementById('deleteSessionBtn');
const quickActions = document.getElementById('quickActions');

// View elements
const sessionsView = document.getElementById('sessionsView');
const settingsView = document.getElementById('settingsView');
const helpView = document.getElementById('helpView');
const sessionsSidebar = document.getElementById('sessionsSidebar');
const navItems = document.querySelectorAll('.nav-item');

// Initialize app
async function init() {
  console.log('Initializing AI Agent Tester...');

  // Get the server port from Electron
  if (window.electronAPI && window.electronAPI.getServerPort) {
    try {
      const port = await window.electronAPI.getServerPort();
      API_BASE_URL = `http://localhost:${port}/api`;
      console.log(`Using API at ${API_BASE_URL}`);
    } catch (error) {
      console.error('Failed to get server port, using default:', error);
    }
  }

  // Load theme preference first (before rendering)
  loadThemePreference();

  // Check API health
  await checkAPIHealth();

  // Load sessions
  await loadSessions();

  // Load available commands
  await loadCommands();

  // Setup event listeners
  setupEventListeners();

  // Setup keyboard shortcut listener for CMD+N
  if (window.electronAPI && window.electronAPI.onNewSession) {
    window.electronAPI.onNewSession(() => {
      console.log('New session triggered via CMD+N');
      createNewSession();
    });
  }

  // Automatically create a new session on startup
  createNewSession();

  updateStatus('Ready');
}

// Check API health with retry logic
async function checkAPIHealth() {
  const maxRetries = 10;
  const retryDelay = 200;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      const data = await response.json();

      if (data.status === 'ok') {
        updateAPIStatus(true);
        console.log('API is healthy:', data);
        return true;
      }
    } catch (error) {
      console.log(`API health check attempt ${i + 1}/${maxRetries} failed:`, error.message);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  console.error('API health check failed after all retries');
  updateAPIStatus(false);
  return false;
}

// Load sessions from API with retry logic
async function loadSessions() {
  const maxRetries = 5;
  const retryDelay = 300;

  for (let i = 0; i < maxRetries; i++) {
    try {
      updateStatus(`Loading sessions...${i > 0 ? ` (attempt ${i + 1})` : ''}`);
      const response = await fetch(`${API_BASE_URL}/threads`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      sessions = data.threads;
      filteredSessions = sessions;
      renderSessionList();
      updateStatus('Sessions loaded');
      return;
    } catch (error) {
      console.log(`Failed to load sessions (attempt ${i + 1}/${maxRetries}):`, error.message);

      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        console.error('Failed to load sessions after all retries:', error);
        sessionList.innerHTML = '<div class="loading">Failed to load sessions. Please reload the app.</div>';
        updateStatus('Error loading sessions');
      }
    }
  }
}

// Load available commands
async function loadCommands() {
  try {
    const response = await fetch(`${API_BASE_URL}/commands`);
    const data = await response.json();
    availableCommands = data.commands;
    renderCommandSelect();
  } catch (error) {
    console.error('Failed to load commands:', error);
  }
}

// Render session list
function renderSessionList() {
  const sessionsToRender = filteredSessions.length > 0 ? filteredSessions : sessions;

  if (sessionsToRender.length === 0) {
    if (searchQuery) {
      sessionList.innerHTML = '<div class="loading">No sessions match your search</div>';
    } else {
      sessionList.innerHTML = '<div class="loading">No sessions found</div>';
    }
    return;
  }

  sessionList.innerHTML = sessionsToRender.map(session => `
    <div class="session-item ${session.unread ? 'unread' : ''} ${currentSessionId === session.id ? 'active' : ''}"
         data-session-id="${session.id}">
      <div class="session-item-header">
        <div class="session-item-title">
          ${session.unread ? '<span class="unread-indicator"></span>' : ''}
          ${session.title}
        </div>
        <div class="session-item-time">${formatTime(session.timestamp)}</div>
      </div>
      <div class="session-item-preview">${session.preview}</div>
    </div>
  `).join('');

  // Add click listeners
  document.querySelectorAll('.session-item').forEach(item => {
    item.addEventListener('click', () => {
      const sessionId = parseInt(item.dataset.sessionId);
      selectSession(sessionId);
    });
  });
}

// Render command select dropdown
function renderCommandSelect() {
  commandSelect.innerHTML = availableCommands.map(cmd => `
    <option value="${cmd.id}">${cmd.id} - ${cmd.description}</option>
  `).join('');

  // Default to 'gemini' if it exists, otherwise fall back to first command
  if (availableCommands.find(cmd => cmd.id === 'gemini')) {
    commandSelect.value = 'gemini';
    updateInputMode('gemini');
  } else if (availableCommands.length > 0) {
    commandSelect.value = availableCommands[0].id;
    updateInputMode(availableCommands[0].id);
  }
}

// Update quick action buttons based on selected command
function updateQuickActions(commandId) {
  // Define quick actions for each command type
  const quickActionsMap = {
    'gemini': [
      { label: 'List MCP & Tools', command: 'gemini mcp list --servers' }
    ],
    'claude': [
      { label: 'List MCP & Tools', command: 'claude mcp list' }
    ],
    'chatgpt': [
      { label: 'List MCP & Tools', command: 'codex mcp list' }
    ],
    'raw-terminal': [
      { label: 'ls', command: 'ls' },
      { label: 'whoami', command: 'whoami' }
    ]
  };

  const actions = quickActionsMap[commandId];

  if (actions && actions.length > 0) {
    // Show quick actions and populate buttons
    quickActions.classList.remove('hidden');
    quickActions.innerHTML = actions.map(action => `
      <button class="quick-action-btn" data-command="${action.command}">
        ${action.label}
      </button>
    `).join('');

    // Add click handlers to quick action buttons
    quickActions.querySelectorAll('.quick-action-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const command = btn.dataset.command;

        // Set the command in the input field
        messageInput.value = command;

        // Execute the command immediately
        await executeCommand();
      });
    });
  } else {
    // Hide quick actions if no actions for this command
    quickActions.classList.add('hidden');
    quickActions.innerHTML = '';
  }
}

// Load saved API request values from localStorage
function loadApiRequestValuesIntoForm() {
  const values = loadApiRequestValues();
  if (values.url) apiUrlInput.value = values.url;
  if (values.token) apiTokenInput.value = values.token;
  if (values.body) apiBodyInput.value = values.body;
  if (values.method) apiMethodSelect.value = values.method;
}

// Save API request values to localStorage
function saveApiRequestValuesFromForm() {
  saveApiRequestValues({
    url: apiUrlInput.value.trim(),
    token: apiTokenInput.value.trim(),
    body: apiBodyInput.value.trim(),
    method: apiMethodSelect.value
  });
}

// Update input mode based on selected command
function updateInputMode(commandId) {
  const command = availableCommands.find(cmd => cmd.id === commandId);

  // Update quick actions
  updateQuickActions(commandId);

  if (!command) {
    // No command selected, show default input
    inputWrapper.classList.remove('hidden');
    inputWrapperApi.classList.add('hidden');
    inputWrapperDisabled.classList.add('hidden');
    return;
  }

  if (command.isApiRequest) {
    // Show API request inputs
    inputWrapper.classList.add('hidden');
    inputWrapperApi.classList.remove('hidden');
    inputWrapperDisabled.classList.add('hidden');

    // Load saved values
    loadApiRequestValuesIntoForm();

    // Hide body input by default (GET is default)
    if (apiMethodSelect.value === 'POST') {
      apiBodyInput.classList.remove('hidden');
    } else {
      apiBodyInput.classList.add('hidden');
    }
    apiUrlInput.focus();
  } else if (command.requiresInput) {
    // Show regular text input
    inputWrapper.classList.remove('hidden');
    inputWrapperApi.classList.add('hidden');
    inputWrapperDisabled.classList.add('hidden');
    messageInput.focus();
  } else {
    // Show disabled placeholder
    inputWrapper.classList.add('hidden');
    inputWrapperApi.classList.add('hidden');
    inputWrapperDisabled.classList.remove('hidden');
  }
}

// Select a session
async function selectSession(sessionId) {
  currentSessionId = sessionId;

  // Update UI
  document.querySelectorAll('.session-item').forEach(item => {
    item.classList.remove('active');
    if (parseInt(item.dataset.sessionId) === sessionId) {
      item.classList.add('active');
      item.classList.remove('unread');
    }
  });

  // Show delete button when a session is selected
  deleteSessionBtn.classList.remove('hidden');

  // Load session details
  await loadSessionDetails(sessionId);
}

// Load session details
async function loadSessionDetails(sessionId) {
  try {
    updateStatus(`Loading session ${sessionId}...`);
    const response = await fetch(`${API_BASE_URL}/threads/${sessionId}`);

    if (!response.ok) {
      // Session might be newly created and not in backend yet
      const localSession = sessions.find(t => t.id === sessionId);
      if (localSession) {
        sessionTitle.textContent = localSession.title;
        sessionTimestamp.textContent = `Started ${formatTime(localSession.timestamp)}`;
        messagesContainer.innerHTML = '<div class="loading">No messages in this session yet. Start a conversation!</div>';
        updateStatus('New session ready');
        return;
      }
      throw new Error('Session not found');
    }

    const session = await response.json();

    sessionTitle.textContent = session.title;
    sessionTimestamp.textContent = `Started ${formatTime(session.timestamp)}`;
    renderMessages(session.messages);
    updateStatus('Session loaded');
  } catch (error) {
    console.error('Failed to load session details:', error);
    messagesContainer.innerHTML = '<div class="loading">Failed to load session</div>';
    updateStatus('Error loading session');
  }
}

// Render messages
function renderMessages(messages) {
  if (!messages || messages.length === 0) {
    messagesContainer.innerHTML = '<div class="loading">No messages in this session</div>';
    return;
  }

  messagesContainer.innerHTML = messages.map(msg => {
    let commandHtml = '';
    // Show command for user messages if available
    if (msg.role === 'user' && msg.command) {
      commandHtml = `
        <div class="message-command-wrapper">
          <div class="message-command">$ ${escapeHtml(msg.command)}</div>
        </div>
      `;
    }

    // Process system messages for curl responses and JSON
    let contentHtml = '';
    if (msg.role === 'system' && msg.content) {
      const processed = processCurlResponse(msg.content);
      // Show the processed output (which includes formatted JSON if detected)
      contentHtml = `<div class="message-content">${escapeHtml(processed.processed)}</div>`;
    } else {
      contentHtml = `<div class="message-content">${escapeHtml(msg.content)}</div>`;
    }

    return `
      <div class="message ${msg.role}">
        <div class="message-role">${msg.role}</div>
        ${contentHtml}
        ${commandHtml}
        <div class="message-time">${formatTime(msg.timestamp)}</div>
      </div>
    `;
  }).join('');

  // Initialize lucide icons for the newly rendered messages
  lucide.createIcons();

  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Execute command
async function executeCommand() {
  const commandId = commandSelect.value;
  const userMessage = messageInput.value.trim();
  const apiMethod = apiMethodSelect.value;
  const apiUrl = apiUrlInput.value.trim();
  const apiToken = apiTokenInput.value.trim();
  const apiBody = apiBodyInput.value.trim();

  if (!commandId) {
    alert('Please select a command to execute');
    return;
  }

  // Get command config
  const cmdConfig = availableCommands.find(cmd => cmd.id === commandId);

  // Validate inputs based on command type
  if (cmdConfig && cmdConfig.isApiRequest) {
    if (!apiUrl) {
      alert('Please enter an API URL');
      return;
    }
    if (apiMethod === 'POST' && !apiBody) {
      alert('Please enter a request body for POST requests');
      return;
    }
  } else if (commandId === 'raw-terminal' && !userMessage) {
    alert('Please type a command to execute');
    return;
  }

  if (!currentSessionId) {
    alert('Please select or create a session first');
    return;
  }

  if (isExecuting) {
    return; // Prevent multiple simultaneous executions
  }

  // Set executing state
  isExecuting = true;
  shouldCancel = false;

  // Generate unique process ID for cancellation
  const processId = `proc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Create AbortController for fetch cancellation
  const abortController = new AbortController();

  // Show waiting state, hide all input wrappers
  inputWrapper.classList.add('hidden');
  inputWrapperApi.classList.add('hidden');
  inputWrapperDisabled.classList.add('hidden');
  waitingState.classList.remove('hidden');
  commandSelect.disabled = true;

  try {
    updateStatus(`Executing ${commandId}...`);

    // Clear welcome message if present
    const currentMessages = messagesContainer.innerHTML;
    if (currentMessages.includes('welcome-message')) {
      messagesContainer.innerHTML = '';
    }

    // Immediately add user message to session
    const userMessageTimestamp = new Date().toISOString();

    // Build content and raw command based on command type
    let content = '';
    let rawCommand = '';

    if (cmdConfig && cmdConfig.isApiRequest) {
      // Save API request values to localStorage
      saveApiRequestValuesFromForm();

      content = `${apiMethod} ${apiUrl}`;
      // Build curl command with optional token and body
      rawCommand = `curl -X ${apiMethod}`;
      if (apiToken) {
        rawCommand += ` -H "Authorization: Bearer ${apiToken}"`;
      }
      if (apiMethod === 'POST' && apiBody) {
        rawCommand += ` -H "Content-Type: application/json" -d '${apiBody}'`;
      }
      rawCommand += ` ${apiUrl} -i`;
    } else if (commandId === 'raw-terminal') {
      content = userMessage;
      rawCommand = userMessage;
    } else if (cmdConfig && cmdConfig.isAgent) {
      // For agent commands (gemini, claude, chatgpt), construct the full command
      content = userMessage || commandId;

      // Build the command string based on the command type
      if (commandId === 'gemini') {
        rawCommand = `gemini -p "${userMessage}"`;
      } else if (commandId === 'claude') {
        rawCommand = `claude -p "${userMessage}"`;
      } else if (commandId === 'chatgpt') {
        rawCommand = `codex "${userMessage}"`;
      } else {
        rawCommand = `${commandId} "${userMessage}"`;
      }
    } else {
      content = userMessage || commandId;
      rawCommand = commandId;
    }

    const userMessageObj = {
      role: 'user',
      content: content,
      timestamp: userMessageTimestamp,
      commandId: commandId  // Store command ID for display
    };

    const commandHtml = rawCommand ? `
      <div class="message-command-wrapper">
        <div class="message-command">$ ${escapeHtml(rawCommand)}</div>
      </div>
    ` : '';

    const userMessageHtml = `
      <div class="message user">
        <div class="message-role">user</div>
        <div class="message-content">${escapeHtml(userMessageObj.content)}</div>
        ${commandHtml}
        <div class="message-time">${formatTime(userMessageTimestamp)}</div>
      </div>
    `;
    messagesContainer.insertAdjacentHTML('beforeend', userMessageHtml);

    // Initialize lucide icons for the newly added message
    lucide.createIcons();

    // Save user message to backend
    const userMessageSaved = await saveMessage(currentSessionId, userMessageObj);
    if (!userMessageSaved) {
      console.error('Failed to save user message to backend');
      // Continue anyway - message is shown in UI
    }

    // Update session title if this is the first command (title is still "New Session")
    const currentSession = sessions.find(s => s.id === currentSessionId);
    if (currentSession && currentSession.title === 'New Session') {
      const newTitle = generateSessionTitle(commandId, userMessage);
      currentSession.title = newTitle;
      currentSession.preview = content.substring(0, 100) + (content.length > 100 ? '...' : '');

      // Update the UI
      sessionTitle.textContent = newTitle;

      // Save updated session to backend
      const sessionSaved = await saveSession(currentSession);
      if (!sessionSaved) {
        console.error('Failed to update session title');
      }

      // Re-render session list to show new title
      renderSessionList();
    }

    // Add "thinking..." message
    const thinkingMessageHtml = `
      <div class="message assistant thinking" id="thinkingMessage">
        <div class="message-role">assistant</div>
        <div class="message-content">
          <span class="thinking-dots">thinking</span><span class="dots">...</span>
        </div>
      </div>
    `;
    messagesContainer.insertAdjacentHTML('beforeend', thinkingMessageHtml);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Clear inputs immediately (but keep API request values for reuse)
    messageInput.value = '';
    // Don't clear API request values - they are remembered in localStorage
    // apiUrlInput.value = '';
    // apiTokenInput.value = '';
    // apiBodyInput.value = '';

    // Store abort controller and process ID for cancellation
    window.currentAbortController = abortController;
    window.currentProcessId = processId;

    // Execute the command - use custom endpoint for raw-terminal
    let response, result;
    if (commandId === 'raw-terminal') {
      response = await fetch(`${API_BASE_URL}/execute-custom`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ command: userMessage, processId }),
        signal: abortController.signal
      });
    } else {
      const requestBody = { commandId, userMessage, processId };

      // Add API request parameters if applicable
      if (cmdConfig && cmdConfig.isApiRequest) {
        requestBody.apiMethod = apiMethod;
        requestBody.apiUrl = apiUrl;
        if (apiToken) {
          requestBody.apiToken = apiToken;
        }
        if (apiMethod === 'POST' && apiBody) {
          requestBody.apiBody = apiBody;
        }
      }

      response = await fetch(`${API_BASE_URL}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: abortController.signal
      });
    }

    result = await response.json();

    // Check if cancelled before proceeding
    if (shouldCancel) {
      // Remove thinking message
      const thinkingMsg = document.getElementById('thinkingMessage');
      if (thinkingMsg) thinkingMsg.remove();
      updateStatus('Command cancelled');
      return;
    }

    // Simulate "thinking" - wait at least 1 second before showing output
    // Skip delay for agent commands (gemini, claude, chatgpt) and raw-terminal
    const isAgentCommand = result.isAgent || commandId === 'raw-terminal';
    if (!isAgentCommand) {
      const thinkingDelay = new Promise(resolve => setTimeout(resolve, 1000));
      await thinkingDelay;

      // Check again if cancelled after thinking delay
      if (shouldCancel) {
        // Remove thinking message
        const thinkingMsg = document.getElementById('thinkingMessage');
        if (thinkingMsg) thinkingMsg.remove();
        updateStatus('Command cancelled');
        return;
      }
    }

    // Remove thinking message
    const thinkingMsg = document.getElementById('thinkingMessage');
    if (thinkingMsg) thinkingMsg.remove();

    // Add system message with output
    // Show stdout if available, otherwise stderr, otherwise error message
    // Many CLIs write errors to stdout, not stderr
    const outputContent = result.stdout || result.stderr || result.error || 'No output';
    const systemMessageTimestamp = new Date().toISOString();
    const systemMessageObj = {
      role: 'system',
      content: outputContent,
      timestamp: systemMessageTimestamp
    };

    // Process the output for curl responses and JSON
    const processed = processCurlResponse(outputContent);

    // Show the processed output (which includes formatted JSON if detected)
    const systemMessageHtml = `
      <div class="message system">
        <div class="message-role">system</div>
        <div class="message-content">${escapeHtml(processed.processed)}</div>
        <div class="message-time">${formatTime(systemMessageTimestamp)}</div>
      </div>
    `;
    messagesContainer.insertAdjacentHTML('beforeend', systemMessageHtml);

    // Save system message to backend
    const systemMessageSaved = await saveMessage(currentSessionId, systemMessageObj);
    if (!systemMessageSaved) {
      console.error('Failed to save system message to backend');
      // Show warning to user
      updateStatus('Warning: Message not saved to history');
    }

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    if (result.success) {
      updateStatus('Command executed successfully');
    } else {
      updateStatus('Command execution failed');
    }
  } catch (error) {
    console.error('Failed to execute command:', error);

    // Check if it was an abort error (cancellation)
    if (error.name === 'AbortError' || shouldCancel) {
      // Remove thinking message
      const thinkingMsg = document.getElementById('thinkingMessage');
      if (thinkingMsg) thinkingMsg.remove();
      updateStatus('Command cancelled');
      return;
    }

    if (!shouldCancel) {
      // Display error in session view
      const errorMessageTimestamp = new Date().toISOString();
      const errorMessageObj = {
        role: 'system',
        content: `Error: ${error.message}`,
        timestamp: errorMessageTimestamp
      };

      const errorMessageHtml = `
        <div class="message system">
          <div class="message-role">error</div>
          <div class="message-content">Error: ${escapeHtml(error.message)}</div>
          <div class="message-time">${formatTime(errorMessageTimestamp)}</div>
        </div>
      `;
      messagesContainer.insertAdjacentHTML('beforeend', errorMessageHtml);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      // Save error message to backend
      const errorMessageSaved = await saveMessage(currentSessionId, errorMessageObj);
      if (!errorMessageSaved) {
        console.error('Failed to save error message to backend');
      }

      updateStatus('Error executing command');
    }
  } finally {
    // Reset UI state
    isExecuting = false;
    shouldCancel = false;
    waitingState.classList.add('hidden');
    commandSelect.disabled = false;

    // Restore the appropriate input mode
    updateInputMode(commandSelect.value);
  }
}

// Send message - now executes the selected command
async function sendMessage() {
  const commandId = commandSelect.value;
  const userMessage = messageInput.value.trim();

  // Validate that either a command is selected or input is typed
  if (!commandId && !userMessage) {
    alert('Type or select a command to send it for execution');
    return;
  }

  // Send button now executes the command
  await executeCommand();
}

// Search sessions
function searchSessions(query) {
  searchQuery = query.toLowerCase().trim();

  if (!searchQuery) {
    filteredSessions = sessions;
  } else {
    filteredSessions = sessions.filter(session => {
      return session.title.toLowerCase().includes(searchQuery) ||
             session.preview.toLowerCase().includes(searchQuery);
    });
  }

  renderSessionList();
  updateStatus(searchQuery ? `Found ${filteredSessions.length} session(s)` : 'Ready');
}

// Save session to backend
async function saveSession(session) {
  try {
    const response = await fetch(`${API_BASE_URL}/threads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(session)
    });

    if (!response.ok) {
      console.error('Failed to save session:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error saving session:', error);
    return false;
  }
}

// Save message to session
async function saveMessage(sessionId, message) {
  try {
    const response = await fetch(`${API_BASE_URL}/threads/${sessionId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      console.error('Failed to save message:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error saving message:', error);
    return false;
  }
}

// Create new session
async function createNewSession() {
  // Generate new session ID
  const newId = sessions.length > 0 ? Math.max(...sessions.map(t => t.id)) + 1 : 1;

  const newSession = {
    id: newId,
    title: 'New Session',
    preview: 'New session - no messages yet',
    timestamp: new Date().toISOString(),
    unread: false,
    messages: []
  };

  // Save session to backend
  const saved = await saveSession(newSession);

  if (!saved) {
    console.error('Failed to save new session to backend');
    updateStatus('Error: Failed to create session');
    alert('Failed to create new session. Please try again.');
    return;
  }

  // Add to sessions array at the beginning
  sessions.unshift(newSession);

  // Update filtered sessions if search is active
  if (searchQuery) {
    searchSessions(searchQuery);
  } else {
    filteredSessions = sessions;
  }

  // Render and select the new session
  renderSessionList();

  // Set up the blank session view
  currentSessionId = newId;
  sessionTitle.textContent = newSession.title;
  messagesContainer.innerHTML = `
    <div class="welcome-message">
      <div class="welcome-icon">
        <i data-lucide="rocket" class="welcome-icon-svg"></i>
      </div>
      <h2>Welcome to AI Agent Tester</h2>
      <p>Start typing a message below to begin the conversation.</p>
      <div class="feature-list">
        <div class="feature-item">
          <i data-lucide="message-square" class="feature-icon"></i>
          <span>View conversation sessions</span>
        </div>
        <div class="feature-item">
          <i data-lucide="zap" class="feature-icon"></i>
          <span>Execute commands safely</span>
        </div>
        <div class="feature-item">
          <i data-lucide="search" class="feature-icon"></i>
          <span>Test AI agent responses</span>
        </div>
      </div>
    </div>
  `;

  // Re-initialize Lucide icons for the dynamically added content
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Update active state in UI
  document.querySelectorAll('.session-item').forEach(item => {
    item.classList.remove('active');
    if (parseInt(item.dataset.sessionId) === newId) {
      item.classList.add('active');
    }
  });

  // Focus on message input
  messageInput.focus();

  updateStatus('Created new session');
  console.log('Created new session:', newSession);
}

// Delete current session
async function deleteCurrentSession() {
  if (!currentSessionId) {
    updateStatus('No session selected');
    return;
  }

  // Get session details
  const session = sessions.find(t => t.id === currentSessionId);
  const sessionName = session ? session.title : `Session ${currentSessionId}`;

  // Check if session has messages - only show confirmation if it has messages
  let hasMessages = false;
  if (session && session.messages && session.messages.length > 0) {
    hasMessages = true;
  }

  // Show confirmation dialog only if session has messages
  if (hasMessages) {
    const confirmed = confirm(`Are you sure you want to delete "${sessionName}"?\n\nThis action cannot be undone.`);

    if (!confirmed) {
      updateStatus('Delete cancelled');
      return;
    }
  }

  try {
    updateStatus(`Deleting session ${currentSessionId}...`);

    // Find the index of the current session before deleting
    const sessionsToSearch = filteredSessions.length > 0 ? filteredSessions : sessions;
    const currentIndex = sessionsToSearch.findIndex(t => t.id === currentSessionId);

    const response = await fetch(`${API_BASE_URL}/threads/${currentSessionId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Failed to delete session');
    }

    // Store the deleted session ID
    const deletedSessionId = currentSessionId;

    // Remove from local sessions array
    sessions = sessions.filter(t => t.id !== currentSessionId);

    // Update filtered sessions if search is active
    if (searchQuery) {
      searchSessions(searchQuery);
    } else {
      filteredSessions = sessions;
    }

    // Render updated session list
    renderSessionList();

    // Select the next session (or previous if at the end)
    const updatedSessionsToSearch = filteredSessions.length > 0 ? filteredSessions : sessions;

    if (updatedSessionsToSearch.length > 0) {
      // Try to select the session at the same index (which is now the next older session)
      // If we deleted the last session, select the new last session
      const nextIndex = Math.min(currentIndex, updatedSessionsToSearch.length - 1);
      const nextSession = updatedSessionsToSearch[nextIndex];

      if (nextSession) {
        await selectSession(nextSession.id);
      }
    } else {
      // No sessions left
      currentSessionId = null;
      deleteSessionBtn.classList.add('hidden');
      sessionTitle.textContent = 'No sessions';
      messagesContainer.innerHTML = `
        <div class="welcome-message">
          <div class="welcome-icon">
            <i data-lucide="inbox" class="welcome-icon-svg"></i>
          </div>
          <h2>No Sessions</h2>
          <p>Create a new session to get started.</p>
        </div>
      `;

      // Re-initialize Lucide icons
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    }

    updateStatus(`Session ${deletedSessionId} deleted successfully`);
    console.log('Deleted session:', deletedSessionId);
  } catch (error) {
    console.error('Failed to delete session:', error);
    updateStatus('Error deleting session');
    alert('Failed to delete session. Please try again.');
  }
}

// Switch between views
function switchView(viewName) {
  // Update navigation items
  navItems.forEach(item => {
    if (item.dataset.view === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Show/hide views
  if (viewName === 'sessions') {
    sessionsView.classList.remove('hidden');
    settingsView.classList.add('hidden');
    helpView.classList.add('hidden');
    sessionsSidebar.classList.remove('hidden');
    updateStatus('Sessions view');
  } else if (viewName === 'settings') {
    sessionsView.classList.add('hidden');
    settingsView.classList.remove('hidden');
    helpView.classList.add('hidden');
    sessionsSidebar.classList.add('hidden');
    updateStatus('Settings view');
    loadSettingsInfo();
  } else if (viewName === 'help') {
    sessionsView.classList.add('hidden');
    settingsView.classList.add('hidden');
    helpView.classList.remove('hidden');
    sessionsSidebar.classList.add('hidden');
    updateStatus('Help & About');
    loadHelpInfo();
  }
}

// Load help information (version info for About section)
async function loadHelpInfo() {
  // Load version info if available
  if (window.electronAPI) {
    try {
      const version = await window.electronAPI.getAppVersion();
      const versionEl = document.getElementById('electronVersion');
      if (versionEl) versionEl.textContent = version;
    } catch (error) {
      console.error('Failed to load version info:', error);
    }
  }

  // Set Node.js version
  const nodeVersionEl = document.getElementById('nodeVersion');
  if (nodeVersionEl) {
    nodeVersionEl.textContent = 'v20.x (via Electron)';
  }

  // Load MCP server status
  await updateMcpServerStatus();
}

// Update MCP server status
async function updateMcpServerStatus() {
  if (!window.electronAPI || !window.electronAPI.getMcpServerStatus) {
    return;
  }

  try {
    const status = await window.electronAPI.getMcpServerStatus();
    const statusEl = document.getElementById('mcpServerStatus');
    const startBtn = document.getElementById('startMcpBtn');
    const stopBtn = document.getElementById('stopMcpBtn');
    const configSection = document.getElementById('mcpConfigSection');
    const configCode = document.getElementById('mcpConfigCode');

    if (status.running) {
      statusEl.textContent = 'Running';
      statusEl.className = 'mcp-status-text running';
      startBtn.disabled = true;
      stopBtn.disabled = false;

      // Show configuration with actual path
      if (configSection && configCode) {
        const config = {
          "mcpServers": {
            "famous-quotes": {
              "command": "node",
              "args": [status.path],
              "env": {}
            }
          }
        };
        configCode.textContent = JSON.stringify(config, null, 2);
        configSection.classList.remove('hidden');
      }
    } else {
      statusEl.textContent = 'Stopped';
      statusEl.className = 'mcp-status-text stopped';
      startBtn.disabled = false;
      stopBtn.disabled = true;

      // Hide configuration when stopped
      if (configSection) {
        configSection.classList.add('hidden');
      }
    }
  } catch (error) {
    console.error('Failed to get MCP server status:', error);
  }
}

// Start MCP server
async function startMcpServer() {
  if (!window.electronAPI || !window.electronAPI.startMcpServer) {
    return;
  }

  const statusEl = document.getElementById('mcpServerStatus');
  statusEl.textContent = 'Starting...';
  statusEl.className = 'mcp-status-text';

  try {
    const result = await window.electronAPI.startMcpServer();

    if (result.success) {
      await updateMcpServerStatus();
      updateStatus('MCP server started successfully');
    } else {
      statusEl.textContent = 'Failed to start';
      statusEl.className = 'mcp-status-text stopped';
      updateStatus(`Failed to start MCP server: ${result.error}`);
    }
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    statusEl.textContent = 'Error';
    statusEl.className = 'mcp-status-text stopped';
    updateStatus('Error starting MCP server');
  }
}

// Stop MCP server
async function stopMcpServer() {
  if (!window.electronAPI || !window.electronAPI.stopMcpServer) {
    return;
  }

  const statusEl = document.getElementById('mcpServerStatus');
  statusEl.textContent = 'Stopping...';
  statusEl.className = 'mcp-status-text';

  try {
    const result = await window.electronAPI.stopMcpServer();

    if (result.success) {
      await updateMcpServerStatus();
      updateStatus('MCP server stopped');
    } else {
      updateStatus(`Failed to stop MCP server: ${result.error}`);
      await updateMcpServerStatus();
    }
  } catch (error) {
    console.error('Failed to stop MCP server:', error);
    updateStatus('Error stopping MCP server');
    await updateMcpServerStatus();
  }
}

// Load settings information
async function loadSettingsInfo() {
  // Load version info if available
  if (window.electronAPI) {
    try {
      const version = await window.electronAPI.getAppVersion();
      const versionEl = document.getElementById('electronVersion');
      if (versionEl) versionEl.textContent = version;
    } catch (error) {
      console.error('Failed to load version info:', error);
    }
  }

  // Set Node.js version
  const nodeVersionEl = document.getElementById('nodeVersion');
  if (nodeVersionEl) {
    nodeVersionEl.textContent = 'v20.x (via Electron)';
  }

  // Check CLI versions
  await checkCliVersions();

  // Load Gemini settings
  await loadGeminiSettings();

  // Load Claude settings
  await loadClaudeSettings();

  // Load ChatGPT settings
  await loadChatGPTSettings();

  // Load MCP server status
  await updateMcpServerStatus();

  // Load saved theme preference
  loadThemePreference();
}

// Load Gemini CLI settings
async function loadGeminiSettings() {
  const geminiContent = document.getElementById('geminiSettingsContent');
  const geminiMcpServers = document.getElementById('geminiMcpServers');
  if (!geminiContent) return;

  if (!window.electronAPI || !window.electronAPI.getGeminiSettings) {
    geminiContent.innerHTML = '<p class="loading-text">Gemini settings not available in this environment.</p>';
    if (geminiMcpServers) geminiMcpServers.innerHTML = '';
    return;
  }

  try {
    const result = await window.electronAPI.getGeminiSettings();

    if (result.found) {
      // Parse and display MCP servers
      if (geminiMcpServers) {
        renderMcpServers(result.settings, geminiMcpServers, 'gemini');
      }

      // Display the settings as formatted JSON
      const jsonString = JSON.stringify(result.settings, null, 2);
      geminiContent.innerHTML = `<pre class="gemini-settings-json">${escapeHtml(jsonString)}</pre>`;
    } else {
      // Show installation message
      if (geminiMcpServers) geminiMcpServers.innerHTML = '';
      geminiContent.innerHTML = `
        <div class="gemini-not-found">
          <p><strong>Gemini CLI not found</strong></p>
          <p>It looks like the Gemini CLI hasn't been installed yet.</p>
          <p>To install Gemini CLI, please follow the instructions at:</p>
          <p><a href="https://github.com/google-gemini/gemini-cli" target="_blank" rel="noopener noreferrer">https://github.com/google-gemini/gemini-cli</a></p>
        </div>
      `;
    }
  } catch (error) {
    console.error('Failed to load Gemini settings:', error);
    geminiContent.innerHTML = '<p class="loading-text">Error loading Gemini settings.</p>';
    if (geminiMcpServers) geminiMcpServers.innerHTML = '';
  }
}

// Load Claude CLI settings
async function loadClaudeSettings() {
  const claudeContent = document.getElementById('claudeSettingsContent');
  const claudeMcpServers = document.getElementById('claudeMcpServers');
  if (!claudeContent) return;

  if (!window.electronAPI || !window.electronAPI.getClaudeSettings) {
    claudeContent.innerHTML = '<p class="loading-text">Claude settings not available in this environment.</p>';
    if (claudeMcpServers) claudeMcpServers.innerHTML = '';
    return;
  }

  try {
    const result = await window.electronAPI.getClaudeSettings();

    if (result.found) {
      // Parse and display MCP servers
      if (claudeMcpServers) {
        renderMcpServers(result.settings, claudeMcpServers, 'claude');
      }

      // Display the settings as formatted JSON
      const jsonString = JSON.stringify(result.settings, null, 2);
      claudeContent.innerHTML = `<pre class="gemini-settings-json">${escapeHtml(jsonString)}</pre>`;
    } else {
      // Show installation message
      if (claudeMcpServers) claudeMcpServers.innerHTML = '';
      claudeContent.innerHTML = `
        <div class="gemini-not-found">
          <p><strong>Claude CLI not found</strong></p>
          <p>It looks like the Claude CLI hasn't been installed yet or the settings file doesn't exist.</p>
          <p>Settings should be located at: <code>~/.claude.json</code></p>
        </div>
      `;
    }
  } catch (error) {
    console.error('Failed to load Claude settings:', error);
    claudeContent.innerHTML = '<p class="loading-text">Error loading Claude settings.</p>';
    if (claudeMcpServers) claudeMcpServers.innerHTML = '';
  }
}

// Load ChatGPT Codex CLI settings
async function loadChatGPTSettings() {
  const chatgptContent = document.getElementById('chatgptSettingsContent');
  const chatgptMcpServers = document.getElementById('chatgptMcpServers');
  if (!chatgptContent) return;

  if (!window.electronAPI || !window.electronAPI.getChatGPTSettings) {
    chatgptContent.innerHTML = '<p class="loading-text">ChatGPT Codex settings not available in this environment.</p>';
    if (chatgptMcpServers) chatgptMcpServers.innerHTML = '';
    return;
  }

  try {
    const result = await window.electronAPI.getChatGPTSettings();

    if (result.found) {
      // Parse and display MCP servers (only if not TOML)
      if (chatgptMcpServers && !result.isToml) {
        renderMcpServers(result.settings, chatgptMcpServers, 'chatgpt');
      } else if (chatgptMcpServers) {
        chatgptMcpServers.innerHTML = '<p class="mcp-no-servers">MCP server parsing not supported for TOML format</p>';
      }

      // Display the settings - handle TOML format
      if (result.isToml) {
        chatgptContent.innerHTML = `<pre class="gemini-settings-json">${escapeHtml(result.settings)}</pre>`;
      } else {
        const jsonString = JSON.stringify(result.settings, null, 2);
        chatgptContent.innerHTML = `<pre class="gemini-settings-json">${escapeHtml(jsonString)}</pre>`;
      }
    } else {
      // Show installation message
      if (chatgptMcpServers) chatgptMcpServers.innerHTML = '';
      chatgptContent.innerHTML = `
        <div class="gemini-not-found">
          <p><strong>ChatGPT Codex CLI not found</strong></p>
          <p>It looks like the ChatGPT Codex CLI hasn't been installed yet or the settings file doesn't exist.</p>
          <p>Settings should be located at: <code>~/.codex/config.toml</code></p>
        </div>
      `;
    }
  } catch (error) {
    console.error('Failed to load ChatGPT Codex settings:', error);
    chatgptContent.innerHTML = '<p class="loading-text">Error loading ChatGPT Codex settings.</p>';
    if (chatgptMcpServers) chatgptMcpServers.innerHTML = '';
  }
}

// Render MCP servers from settings
function renderMcpServers(settings, container, agentType) {
  // Try to find MCP servers in the settings
  let mcpServers = null;

  // Different agents store MCP servers in different places
  if (agentType === 'gemini') {
    mcpServers = settings.mcpServers || settings.mcp_servers;
  } else if (agentType === 'claude') {
    mcpServers = settings.mcpServers || settings.mcp_servers;
  } else if (agentType === 'chatgpt') {
    mcpServers = settings.mcpServers || settings.mcp_servers;
  }

  if (!mcpServers || Object.keys(mcpServers).length === 0) {
    container.innerHTML = '<p class="mcp-no-servers">No MCP servers configured</p>';
    return;
  }

  // Build HTML for MCP servers in card format
  let html = '<div class="mcp-servers-container">';
  html += '<h4 class="mcp-servers-title">MCP Servers</h4>';

  let serverIndex = 0;
  for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
    const serverId = `mcp-server-${agentType}-${serverIndex}`;

    // Determine command/URL
    let commandOrUrl = 'N/A';
    if (serverConfig.command) {
      const args = serverConfig.args || [];
      commandOrUrl = args.length > 0 ? args.join(' ') : serverConfig.command;
    } else if (serverConfig.url) {
      commandOrUrl = serverConfig.url;
    }

    // Determine type (stdio, http, sse, etc.)
    let type = 'stdio'; // default
    if (serverConfig.type) {
      type = serverConfig.type;
    } else if (serverConfig.transport) {
      type = serverConfig.transport.type || 'stdio';
    }

    // Determine transport info
    let transportType = 'N/A';
    let transportUrl = 'N/A';
    if (serverConfig.transport) {
      transportType = serverConfig.transport.type || 'N/A';
      transportUrl = serverConfig.transport.url || 'N/A';
    } else if (serverConfig.url) {
      transportType = 'http';
      transportUrl = serverConfig.url;
    } else if (serverConfig.command) {
      transportType = 'stdio';
      transportUrl = 'N/A';
    }

    html += `
      <div class="mcp-server-card" id="${serverId}">
        <div class="mcp-server-header">
          <div class="mcp-server-info">
            <div class="mcp-server-name">${escapeHtml(serverName)}</div>
            <div class="mcp-server-details">
              <div class="mcp-server-detail">
                <span class="mcp-server-detail-label">Command/URL:</span>
                <span class="mcp-server-detail-value">${escapeHtml(commandOrUrl)}</span>
              </div>
              <div class="mcp-server-detail">
                <span class="mcp-server-detail-label">Type:</span>
                <span class="mcp-server-detail-value">${escapeHtml(type)}</span>
              </div>
              <div class="mcp-server-detail">
                <span class="mcp-server-detail-label">Transport:</span>
                <span class="mcp-server-detail-value">${escapeHtml(transportType)}${transportUrl !== 'N/A' ? ' - ' + escapeHtml(transportUrl) : ''}</span>
              </div>
            </div>
          </div>
          <div class="mcp-server-actions">
            <button class="mcp-test-btn" onclick="testMcpServer('${escapeHtml(serverName)}', ${escapeHtml(JSON.stringify(serverConfig))}, '${serverId}')">
              <span class="mcp-test-btn-text">Testing...</span>
            </button>
          </div>
        </div>
        <div class="mcp-test-result-container"></div>
        <div class="mcp-tools-container" style="display: none;">
          <div class="mcp-tools-header">
            <a href="#" class="mcp-tools-toggle" onclick="toggleMcpTools('${serverId}'); return false;">Show Tools</a>
          </div>
          <div class="mcp-tools-content" style="display: none;"></div>
        </div>
      </div>
    `;

    serverIndex++;
  }

  html += '</div>';
  container.innerHTML = html;

  // Auto-test all servers
  serverIndex = 0;
  for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
    const serverId = `mcp-server-${agentType}-${serverIndex}`;
    testMcpServer(serverName, serverConfig, serverId);
    serverIndex++;
  }
}

// Test an MCP server and list tools
async function testMcpServer(serverName, serverConfig, serverId) {
  const serverCard = document.getElementById(serverId);
  if (!serverCard) return;

  const resultContainer = serverCard.querySelector('.mcp-test-result-container');
  const toolsContainer = serverCard.querySelector('.mcp-tools-container');
  const toolsContent = serverCard.querySelector('.mcp-tools-content');
  const button = serverCard.querySelector('.mcp-test-btn');
  const buttonText = button.querySelector('.mcp-test-btn-text');

  // Update button state
  button.disabled = true;
  buttonText.textContent = 'Testing...';

  try {
    // Check if this is a transport-based server
    if (serverConfig.transport && serverConfig.transport.type === 'sse') {
      // For SSE servers, test with a simple HTTP request
      const url = serverConfig.transport.url;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream'
        }
      });

      if (response.ok) {
        resultContainer.innerHTML = `
          <div class="mcp-test-result success">
✓ SSE server connected
          </div>
        `;
        buttonText.textContent = '✓ Connected';
        button.classList.add('success');

        // For SSE servers, we can't easily list tools, so just show success
        toolsContainer.style.display = 'none';
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return;
    }

    // For stdio servers - initialize and list tools
    const command = serverConfig.command;
    const args = serverConfig.args || [];

    if (!command) {
      throw new Error('No command specified for MCP server');
    }

    // Step 1: Initialize
    const initRequest = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "ai-agent-tester",
          version: "1.0.0"
        }
      }
    });

    // Step 2: List tools
    const listToolsRequest = JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {}
    });

    // Combine both requests
    const fullCommand = `(echo '${initRequest}' && echo '${listToolsRequest}') | ${command} ${args.join(' ')}`;

    const response = await fetch(`${API_BASE_URL}/execute-custom`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        command: fullCommand,
        processId: `mcp-test-${Date.now()}`
      })
    });

    const result = await response.json();

    if (result.success && result.stdout) {
      // Parse JSON responses
      const lines = result.stdout.split('\n').filter(line => line.trim());
      let initResponse = null;
      let toolsResponse = null;

      // Try to find both responses
      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.id === 1) initResponse = json;
          if (json.id === 2) toolsResponse = json;
        } catch (e) {
          // Skip non-JSON lines
        }
      }

      if (initResponse && initResponse.result) {
        const serverInfo = initResponse.result.serverInfo || {};
        resultContainer.innerHTML = `
          <div class="mcp-test-result success">
✓ ${serverInfo.name || serverName} v${serverInfo.version || '?'}
          </div>
        `;
        buttonText.textContent = '✓ Connected';
        button.classList.add('success');

        // Show tools if available
        if (toolsResponse && toolsResponse.result && toolsResponse.result.tools) {
          const tools = toolsResponse.result.tools;
          if (tools.length > 0) {
            toolsContainer.style.display = 'block';

            // Build tools table
            let toolsHtml = '<table class="mcp-tools-table">';
            toolsHtml += '<thead><tr><th>Tool Name</th><th>Description</th><th>Parameters</th></tr></thead>';
            toolsHtml += '<tbody>';

            for (const tool of tools) {
              const params = tool.inputSchema && tool.inputSchema.properties
                ? Object.keys(tool.inputSchema.properties).join(', ')
                : 'None';

              toolsHtml += `<tr>`;
              toolsHtml += `<td class="mcp-tool-name">${escapeHtml(tool.name)}</td>`;
              toolsHtml += `<td class="mcp-tool-description">${escapeHtml(tool.description || 'No description')}</td>`;
              toolsHtml += `<td class="mcp-tool-params">${escapeHtml(params)}</td>`;
              toolsHtml += `</tr>`;
            }

            toolsHtml += '</tbody></table>';
            toolsContent.innerHTML = toolsHtml;
          }
        }
      } else {
        throw new Error('Invalid response from server');
      }
    } else {
      const errorMsg = result.error || result.stderr || 'Unknown error';
      throw new Error(errorMsg);
    }
  } catch (error) {
    resultContainer.innerHTML = `
      <div class="mcp-test-result error">
✗ ${escapeHtml(error.message)}
      </div>
    `;
    buttonText.textContent = '✗ Failed';
    button.classList.add('error');
    toolsContainer.style.display = 'none';
  } finally {
    button.disabled = false;
  }
}

// Toggle MCP tools visibility
function toggleMcpTools(serverId) {
  const serverCard = document.getElementById(serverId);
  if (!serverCard) return;

  const toolsContent = serverCard.querySelector('.mcp-tools-content');
  const toolsToggle = serverCard.querySelector('.mcp-tools-toggle');

  if (toolsContent.style.display === 'none') {
    toolsContent.style.display = 'block';
    toolsToggle.textContent = 'Hide Tools';
  } else {
    toolsContent.style.display = 'none';
    toolsToggle.textContent = 'Show Tools';
  }
}

// Make functions available globally
window.testMcpServer = testMcpServer;
window.toggleMcpTools = toggleMcpTools;

// Switch settings tabs
function switchSettingsTab(tabName) {
  // Update tab buttons
  const tabs = document.querySelectorAll('.settings-tab');
  tabs.forEach(tab => {
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Update tab content
  const tabContents = document.querySelectorAll('.settings-tab-content');
  tabContents.forEach(content => {
    if (content.id === `${tabName}Tab`) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });
}

// Check CLI versions and update pills
async function checkCliVersions() {
  // Check Claude version
  checkCliVersion('claude', 'claudeVersionPill', window.electronAPI.checkClaudeVersion);

  // Check Gemini version
  checkCliVersion('gemini', 'geminiVersionPill', window.electronAPI.checkGeminiVersion);

  // Check Codex version
  checkCliVersion('codex', 'codexVersionPill', window.electronAPI.checkCodexVersion);
}

async function checkCliVersion(cliName, pillId, checkFunction) {
  const pill = document.getElementById(pillId);
  if (!pill) return;

  if (!window.electronAPI || !checkFunction) {
    pill.classList.remove('checking');
    pill.classList.add('not-installed');
    pill.querySelector('.version-text').textContent = 'Not available';
    return;
  }

  try {
    const result = await checkFunction();

    pill.classList.remove('checking');

    if (result.installed) {
      pill.classList.add('installed');
      pill.classList.remove('not-installed');
      pill.querySelector('.version-text').textContent = result.version;
    } else {
      pill.classList.add('not-installed');
      pill.classList.remove('installed');
      pill.querySelector('.version-text').textContent = 'Not installed';
    }
  } catch (error) {
    console.error(`Failed to check ${cliName} version:`, error);
    pill.classList.remove('checking');
    pill.classList.add('not-installed');
    pill.querySelector('.version-text').textContent = 'Error';
  }
}

// Open file in VS Code
async function openInVSCode(filePath) {
  try {
    // Expand tilde to home directory using IPC
    const expandedPath = await window.electronAPI.expandPath(filePath);

    // Create vscode:// URL - VS Code will handle opening the file
    const vscodeUrl = `vscode://file${expandedPath}`;

    console.log(`Opening file in VS Code: ${vscodeUrl}`);

    // Use window.open to trigger the vscode:// protocol
    window.open(vscodeUrl, '_blank');
  } catch (error) {
    console.error('Failed to open file in VS Code:', error);
    updateStatus('Failed to open file in VS Code');
  }
}


// Setup event listeners
function setupEventListeners() {
  // Navigation
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const viewName = item.dataset.view;
      switchView(viewName);
    });
  });

  // Settings tabs
  const settingsTabs = document.querySelectorAll('.settings-tab');
  settingsTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      switchSettingsTab(tabName);
    });
  });

  // Session view controls
  sendBtn.addEventListener('click', sendMessage);
  sendBtnApi.addEventListener('click', sendMessage);
  sendBtnDisabled.addEventListener('click', sendMessage);

  // API method change handler - show/hide body input for POST
  apiMethodSelect.addEventListener('change', (e) => {
    if (e.target.value === 'POST') {
      apiBodyInput.classList.remove('hidden');
    } else {
      apiBodyInput.classList.add('hidden');
    }
  });

  clearBtn.addEventListener('click', () => {
    messageInput.value = '';
    // Don't clear API request values - they are remembered
    // apiUrlInput.value = '';
    // apiTokenInput.value = '';
    // apiBodyInput.value = '';
    // Don't clear the command selector - only clear the text input
    updateStatus('Cleared input');
    messageInput.focus();
  });

  // Cancel button
  cancelBtn.addEventListener('click', async () => {
    shouldCancel = true;
    updateStatus('Cancelling...');

    // Abort the fetch request
    if (window.currentAbortController) {
      window.currentAbortController.abort();
    }

    // Also send cancel request to backend to kill the process
    if (window.currentProcessId) {
      try {
        await fetch(`${API_BASE_URL}/cancel`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ processId: window.currentProcessId })
        });
      } catch (error) {
        console.error('Failed to cancel process:', error);
      }
    }
  });

  // New session button
  newSessionBtn.addEventListener('click', createNewSession);

  // Delete session button
  deleteSessionBtn.addEventListener('click', deleteCurrentSession);

  // Theme select change handler
  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
      applyTheme(e.target.value);
      updateStatus(`Theme changed to ${e.target.value}`);
    });
  }

  // Search input
  searchInput.addEventListener('input', (e) => {
    searchSessions(e.target.value);
  });

  // Clear search on Escape key
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      searchSessions('');
    }
  });

  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent default newline behavior
      sendMessage();
    }
    // Shift+Enter will allow default behavior (new line)
  });

  // API URL input - Enter key to send
  apiUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendMessage();
    }
  });

  commandSelect.addEventListener('change', () => {
    if (commandSelect.value) {
      updateStatus(`Selected command: ${commandSelect.value}`);
      updateInputMode(commandSelect.value);
    }
  });

  // Handle Enter key on command dropdown
  commandSelect.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // If a command is selected, focus the input or send if input has content
      if (commandSelect.value) {
        const userMessage = messageInput.value.trim();
        if (userMessage || commandSelect.value !== 'raw-terminal') {
          sendMessage();
        } else {
          messageInput.focus();
        }
      }
    }
  });

  // Restart button
  restartBtn.addEventListener('click', async () => {
    updateStatus('Restarting app...');
    try {
      await window.electronAPI.restartApp();
    } catch (error) {
      console.error('Failed to restart app:', error);
      updateStatus('Failed to restart');
    }
  });

  // MCP Server buttons
  const startMcpBtn = document.getElementById('startMcpBtn');
  const stopMcpBtn = document.getElementById('stopMcpBtn');

  if (startMcpBtn) {
    startMcpBtn.addEventListener('click', startMcpServer);
  }

  if (stopMcpBtn) {
    stopMcpBtn.addEventListener('click', stopMcpServer);
  }

  // VS Code links - delegate event listener for dynamically added links
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('vscode-link')) {
      e.preventDefault();
      const filePath = e.target.getAttribute('data-file');
      if (filePath) {
        openInVSCode(filePath);
      }
    }
  });
}



// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

