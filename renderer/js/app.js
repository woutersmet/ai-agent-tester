// API Configuration
const API_BASE_URL = 'http://localhost:3000/api';

// State
let currentThreadId = null;
let threads = [];
let filteredThreads = [];
let availableCommands = [];
let searchQuery = '';
let isExecuting = false;
let shouldCancel = false;

// DOM Elements
const threadList = document.getElementById('threadList');
const messagesContainer = document.getElementById('messagesContainer');
const threadTitle = document.getElementById('threadTitle');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const commandSelect = document.getElementById('commandSelect');
const newThreadBtn = document.getElementById('newThreadBtn');
const restartBtn = document.getElementById('restartBtn');
const statusText = document.getElementById('statusText');
const apiStatus = document.getElementById('apiStatus');
const searchInput = document.getElementById('searchInput');
const inputWrapper = document.getElementById('inputWrapper');
const waitingState = document.getElementById('waitingState');
const cancelBtn = document.getElementById('cancelBtn');
const deleteThreadBtn = document.getElementById('deleteThreadBtn');

// View elements
const threadsView = document.getElementById('threadsView');
const settingsView = document.getElementById('settingsView');
const helpView = document.getElementById('helpView');
const threadsSidebar = document.getElementById('threadsSidebar');
const navItems = document.querySelectorAll('.nav-item');

// Initialize app
async function init() {
  console.log('Initializing AI Agent Tester...');

  // Check API health
  await checkAPIHealth();

  // Load threads
  await loadThreads();

  // Load available commands
  await loadCommands();

  // Setup event listeners
  setupEventListeners();

  // Automatically create a new thread on startup
  createNewThread();

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

// Load threads from API
async function loadThreads() {
  try {
    updateStatus('Loading sessions...');
    const response = await fetch(`${API_BASE_URL}/threads`);
    const data = await response.json();
    threads = data.threads;
    filteredThreads = threads;
    renderThreadList();
    updateStatus('Sessions loaded');
  } catch (error) {
    console.error('Failed to load threads:', error);
    threadList.innerHTML = '<div class="loading">Failed to load sessions</div>';
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

// Render thread list
function renderThreadList() {
  const threadsToRender = filteredThreads.length > 0 ? filteredThreads : threads;

  if (threadsToRender.length === 0) {
    if (searchQuery) {
      threadList.innerHTML = '<div class="loading">No sessions match your search</div>';
    } else {
      threadList.innerHTML = '<div class="loading">No sessions found</div>';
    }
    return;
  }

  threadList.innerHTML = threadsToRender.map(thread => `
    <div class="thread-item ${thread.unread ? 'unread' : ''} ${currentThreadId === thread.id ? 'active' : ''}"
         data-thread-id="${thread.id}">
      <div class="thread-item-header">
        <div class="thread-item-title">
          ${thread.unread ? '<span class="unread-indicator"></span>' : ''}
          ${thread.title}
        </div>
        <div class="thread-item-time">${formatTime(thread.timestamp)}</div>
      </div>
      <div class="thread-item-preview">${thread.preview}</div>
    </div>
  `).join('');

  // Add click listeners
  document.querySelectorAll('.thread-item').forEach(item => {
    item.addEventListener('click', () => {
      const threadId = parseInt(item.dataset.threadId);
      selectThread(threadId);
    });
  });
}

// Render command select dropdown
function renderCommandSelect() {
  commandSelect.innerHTML = availableCommands.map(cmd => `
    <option value="${cmd.id}">${cmd.id} - ${cmd.description}</option>
  `).join('');

  // Default to 'raw-terminal' if it exists
  if (availableCommands.find(cmd => cmd.id === 'raw-terminal')) {
    commandSelect.value = 'raw-terminal';
  }
}

// Select a thread
async function selectThread(threadId) {
  currentThreadId = threadId;

  // Update UI
  document.querySelectorAll('.thread-item').forEach(item => {
    item.classList.remove('active');
    if (parseInt(item.dataset.threadId) === threadId) {
      item.classList.add('active');
      item.classList.remove('unread');
    }
  });

  // Show delete button when a thread is selected
  deleteThreadBtn.classList.remove('hidden');

  // Load thread details
  await loadThreadDetails(threadId);
}

// Load thread details
async function loadThreadDetails(threadId) {
  try {
    updateStatus(`Loading session ${threadId}...`);
    const response = await fetch(`${API_BASE_URL}/threads/${threadId}`);

    if (!response.ok) {
      // Thread might be newly created and not in backend yet
      const localThread = threads.find(t => t.id === threadId);
      if (localThread) {
        threadTitle.textContent = localThread.title;
        messagesContainer.innerHTML = '<div class="loading">No messages in this session yet. Start a conversation!</div>';
        updateStatus('New session ready');
        return;
      }
      throw new Error('Session not found');
    }

    const thread = await response.json();

    threadTitle.textContent = thread.title;
    renderMessages(thread.messages);
    updateStatus('Session loaded');
  } catch (error) {
    console.error('Failed to load thread details:', error);
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
      commandHtml = `<div class="message-command">$ ${escapeHtml(msg.command)}</div>`;
    }

    return `
      <div class="message ${msg.role}">
        <div class="message-role">${msg.role}</div>
        <div class="message-content">${escapeHtml(msg.content)}</div>
        ${commandHtml}
        <div class="message-time">${formatTime(msg.timestamp)}</div>
      </div>
    `;
  }).join('');

  // Scroll to bottom
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Execute command
async function executeCommand() {
  const commandId = commandSelect.value;
  const userMessage = messageInput.value.trim();

  if (!commandId) {
    alert('Please select a command to execute');
    return;
  }

  // For raw-terminal command, require user input
  if (commandId === 'raw-terminal' && !userMessage) {
    alert('Please type a command to execute');
    return;
  }

  if (!currentThreadId) {
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

  // Show waiting state, hide input wrapper
  inputWrapper.classList.add('hidden');
  waitingState.classList.remove('hidden');
  commandSelect.disabled = true;

  try {
    updateStatus(`Executing ${commandId}...`);

    // Clear welcome message if present
    const currentMessages = messagesContainer.innerHTML;
    if (currentMessages.includes('welcome-message')) {
      messagesContainer.innerHTML = '';
    }

    // Immediately add user message to thread
    const userMessageTimestamp = new Date().toISOString();
    const userMessageObj = {
      role: 'user',
      content: userMessage || commandId,
      timestamp: userMessageTimestamp,
      commandId: commandId  // Store command ID for display
    };

    // Determine the raw command that will be executed
    let rawCommand = '';
    if (commandId === 'raw-terminal') {
      rawCommand = userMessage;
    } else {
      // Get command config to build raw command string
      const cmdConfig = availableCommands.find(cmd => cmd.id === commandId);
      if (cmdConfig) {
        rawCommand = commandId; // Fallback to command ID
      }
    }

    const userMessageHtml = `
      <div class="message user">
        <div class="message-role">user</div>
        <div class="message-content">${escapeHtml(userMessageObj.content)}</div>
        ${rawCommand ? `<div class="message-command">$ ${escapeHtml(rawCommand)}</div>` : ''}
        <div class="message-time">${formatTime(userMessageTimestamp)}</div>
      </div>
    `;
    messagesContainer.insertAdjacentHTML('beforeend', userMessageHtml);

    // Save user message to backend
    await saveMessage(currentThreadId, userMessageObj);

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

    // Clear input immediately
    messageInput.value = '';

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
      response = await fetch(`${API_BASE_URL}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ commandId, userMessage, processId }),
        signal: abortController.signal
      });
    }

    result = await response.json();

    // Update raw command display with actual executed command
    if (result.command) {
      // Update the user message object with the command
      userMessageObj.command = result.command;

      // Update the display
      const lastUserMessage = messagesContainer.querySelector('.message.user:last-of-type');
      if (lastUserMessage) {
        const existingCommand = lastUserMessage.querySelector('.message-command');
        if (existingCommand) {
          existingCommand.textContent = `$ ${result.command}`;
        } else {
          const commandDiv = document.createElement('div');
          commandDiv.className = 'message-command';
          commandDiv.textContent = `$ ${result.command}`;
          const timeDiv = lastUserMessage.querySelector('.message-time');
          if (timeDiv) {
            lastUserMessage.insertBefore(commandDiv, timeDiv);
          }
        }
      }

      // Re-save the user message with the command
      await saveMessage(currentThreadId, userMessageObj);
    }

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
    const outputContent = result.success ? result.stdout : (result.stderr || result.error);
    const systemMessageTimestamp = new Date().toISOString();
    const systemMessageObj = {
      role: 'system',
      content: outputContent,
      timestamp: systemMessageTimestamp
    };

    const systemMessageHtml = `
      <div class="message system">
        <div class="message-role">system</div>
        <div class="message-content">${escapeHtml(outputContent)}</div>
        <div class="message-time">${formatTime(systemMessageTimestamp)}</div>
      </div>
    `;
    messagesContainer.insertAdjacentHTML('beforeend', systemMessageHtml);

    // Save system message to backend
    await saveMessage(currentThreadId, systemMessageObj);

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
      // Display error in thread view
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
      await saveMessage(currentThreadId, errorMessageObj);

      updateStatus('Error executing command');
    }
  } finally {
    // Reset UI state
    isExecuting = false;
    shouldCancel = false;
    inputWrapper.classList.remove('hidden');
    waitingState.classList.add('hidden');
    commandSelect.disabled = false;
    messageInput.focus();
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

// Search threads
function searchThreads(query) {
  searchQuery = query.toLowerCase().trim();

  if (!searchQuery) {
    filteredThreads = threads;
  } else {
    filteredThreads = threads.filter(thread => {
      return thread.title.toLowerCase().includes(searchQuery) ||
             thread.preview.toLowerCase().includes(searchQuery);
    });
  }

  renderThreadList();
  updateStatus(searchQuery ? `Found ${filteredThreads.length} session(s)` : 'Ready');
}

// Save thread to backend
async function saveThread(thread) {
  try {
    const response = await fetch(`${API_BASE_URL}/threads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(thread)
    });

    if (!response.ok) {
      console.error('Failed to save thread:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error saving thread:', error);
    return false;
  }
}

// Save message to thread
async function saveMessage(threadId, message) {
  try {
    const response = await fetch(`${API_BASE_URL}/threads/${threadId}/messages`, {
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

// Create new thread
async function createNewThread() {
  // Generate new thread ID
  const newId = threads.length > 0 ? Math.max(...threads.map(t => t.id)) + 1 : 1;

  const newThread = {
    id: newId,
    title: 'New Session',
    preview: 'New session - no messages yet',
    timestamp: new Date().toISOString(),
    unread: false,
    messages: []
  };

  // Save thread to backend
  await saveThread(newThread);

  // Add to threads array at the beginning
  threads.unshift(newThread);

  // Update filtered threads if search is active
  if (searchQuery) {
    searchThreads(searchQuery);
  } else {
    filteredThreads = threads;
  }

  // Render and select the new thread
  renderThreadList();

  // Set up the blank thread view
  currentThreadId = newId;
  threadTitle.textContent = newThread.title;
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
  document.querySelectorAll('.thread-item').forEach(item => {
    item.classList.remove('active');
    if (parseInt(item.dataset.threadId) === newId) {
      item.classList.add('active');
    }
  });

  // Focus on message input
  messageInput.focus();

  updateStatus('Created new session');
  console.log('Created new thread:', newThread);
}

// Delete current thread
async function deleteCurrentThread() {
  if (!currentThreadId) {
    updateStatus('No session selected');
    return;
  }

  // Show confirmation dialog
  const thread = threads.find(t => t.id === currentThreadId);
  const threadName = thread ? thread.title : `Session ${currentThreadId}`;

  const confirmed = confirm(`Are you sure you want to delete "${threadName}"?\n\nThis action cannot be undone.`);

  if (!confirmed) {
    updateStatus('Delete cancelled');
    return;
  }

  try {
    updateStatus(`Deleting session ${currentThreadId}...`);

    const response = await fetch(`${API_BASE_URL}/threads/${currentThreadId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error('Failed to delete thread');
    }

    // Remove from local threads array
    threads = threads.filter(t => t.id !== currentThreadId);

    // Update filtered threads if search is active
    if (searchQuery) {
      searchThreads(searchQuery);
    } else {
      filteredThreads = threads;
    }

    // Clear current thread
    const deletedThreadId = currentThreadId;
    currentThreadId = null;

    // Hide delete button
    deleteThreadBtn.classList.add('hidden');

    // Reset thread view
    threadTitle.textContent = 'Select a session';
    messagesContainer.innerHTML = `
      <div class="welcome-message">
        <div class="welcome-icon">
          <i data-lucide="trash-2" class="welcome-icon-svg"></i>
        </div>
        <h2>Session Deleted</h2>
        <p>The session has been successfully deleted.</p>
      </div>
    `;

    // Re-initialize Lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Render updated thread list
    renderThreadList();

    updateStatus(`Session ${deletedThreadId} deleted successfully`);
    console.log('Deleted thread:', deletedThreadId);
  } catch (error) {
    console.error('Failed to delete thread:', error);
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
  if (viewName === 'threads') {
    threadsView.classList.remove('hidden');
    settingsView.classList.add('hidden');
    helpView.classList.add('hidden');
    threadsSidebar.classList.remove('hidden');
    updateStatus('Sessions view');
  } else if (viewName === 'settings') {
    threadsView.classList.add('hidden');
    settingsView.classList.remove('hidden');
    helpView.classList.add('hidden');
    threadsSidebar.classList.add('hidden');
    updateStatus('Settings view');
    loadSettingsInfo();
  } else if (viewName === 'help') {
    threadsView.classList.add('hidden');
    settingsView.classList.add('hidden');
    helpView.classList.remove('hidden');
    threadsSidebar.classList.add('hidden');
    updateStatus('Help & About');
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

  // Thread view controls
  sendBtn.addEventListener('click', sendMessage);
  clearBtn.addEventListener('click', () => {
    messageInput.value = '';
    commandSelect.value = '';
    updateStatus('Cleared input');
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

  // New thread button
  newThreadBtn.addEventListener('click', createNewThread);

  // Delete thread button
  deleteThreadBtn.addEventListener('click', deleteCurrentThread);

  // Search input
  searchInput.addEventListener('input', (e) => {
    searchThreads(e.target.value);
  });

  // Clear search on Escape key
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      searchThreads('');
    }
  });

  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent default newline behavior
      sendMessage();
    }
    // Shift+Enter will allow default behavior (new line)
  });

  commandSelect.addEventListener('change', () => {
    if (commandSelect.value) {
      updateStatus(`Selected command: ${commandSelect.value}`);
      // Focus message input after selecting a command
      messageInput.focus();
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
}

// Utility functions
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  // Less than 1 minute
  if (diff < 60000) {
    return 'Just now';
  }
  
  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }
  
  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }
  
  // Format as date
  return date.toLocaleDateString();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function updateStatus(message) {
  statusText.textContent = message;
  console.log('Status:', message);
}

function updateAPIStatus(isHealthy) {
  const indicator = apiStatus.querySelector('.status-indicator');
  if (isHealthy) {
    indicator.style.color = '#4ec9b0';
    apiStatus.title = 'API is healthy';
  } else {
    indicator.style.color = '#f48771';
    apiStatus.title = 'API is not responding';
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

