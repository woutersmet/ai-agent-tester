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
const API_BASE_URL = 'http://localhost:3000/api';

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

// Check API health
async function checkAPIHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    const data = await response.json();
    
    if (data.status === 'ok') {
      updateAPIStatus(true);
      console.log('API is healthy:', data);
    }
  } catch (error) {
    console.error('API health check failed:', error);
    updateAPIStatus(false);
  }
}

// Load sessions from API
async function loadSessions() {
  try {
    updateStatus('Loading sessions...');
    const response = await fetch(`${API_BASE_URL}/threads`);
    const data = await response.json();
    sessions = data.threads;
    filteredSessions = sessions;
    renderSessionList();
    updateStatus('Sessions loaded');
  } catch (error) {
    console.error('Failed to load sessions:', error);
    sessionList.innerHTML = '<div class="loading">Failed to load sessions</div>';
    updateStatus('Error loading sessions');
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
  if (!geminiContent) return;

  if (!window.electronAPI || !window.electronAPI.getGeminiSettings) {
    geminiContent.innerHTML = '<p class="loading-text">Gemini settings not available in this environment.</p>';
    return;
  }

  try {
    const result = await window.electronAPI.getGeminiSettings();

    if (result.found) {
      // Display the settings as formatted JSON
      const jsonString = JSON.stringify(result.settings, null, 2);
      geminiContent.innerHTML = `<pre class="gemini-settings-json">${escapeHtml(jsonString)}</pre>`;
    } else {
      // Show installation message
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
  }
}

// Load Claude CLI settings
async function loadClaudeSettings() {
  const claudeContent = document.getElementById('claudeSettingsContent');
  if (!claudeContent) return;

  if (!window.electronAPI || !window.electronAPI.getClaudeSettings) {
    claudeContent.innerHTML = '<p class="loading-text">Claude settings not available in this environment.</p>';
    return;
  }

  try {
    const result = await window.electronAPI.getClaudeSettings();

    if (result.found) {
      // Display the settings as formatted JSON
      const jsonString = JSON.stringify(result.settings, null, 2);
      claudeContent.innerHTML = `<pre class="gemini-settings-json">${escapeHtml(jsonString)}</pre>`;
    } else {
      // Show installation message
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
  }
}

// Load ChatGPT Codex CLI settings
async function loadChatGPTSettings() {
  const chatgptContent = document.getElementById('chatgptSettingsContent');
  if (!chatgptContent) return;

  if (!window.electronAPI || !window.electronAPI.getChatGPTSettings) {
    chatgptContent.innerHTML = '<p class="loading-text">ChatGPT Codex settings not available in this environment.</p>';
    return;
  }

  try {
    const result = await window.electronAPI.getChatGPTSettings();

    if (result.found) {
      // Display the settings - handle TOML format
      if (result.isToml) {
        chatgptContent.innerHTML = `<pre class="gemini-settings-json">${escapeHtml(result.settings)}</pre>`;
      } else {
        const jsonString = JSON.stringify(result.settings, null, 2);
        chatgptContent.innerHTML = `<pre class="gemini-settings-json">${escapeHtml(jsonString)}</pre>`;
      }
    } else {
      // Show installation message
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
}



// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

