/**
 * UI Utilities Module
 * Contains formatting, processing, and utility functions for the AI Agent Tester UI
 */

// ============================================================================
// Time Formatting Utilities
// ============================================================================

/**
 * Format a timestamp as a relative time string (e.g., "5m ago", "2h ago")
 * @param {string|Date} timestamp - ISO timestamp or Date object
 * @returns {string} Formatted relative time string
 */
export function formatTime(timestamp) {
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

/**
 * Format a timestamp as a full date and time string
 * @param {string|Date} timestamp - ISO timestamp or Date object
 * @returns {string} Formatted date and time string
 */
export function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  };
  return date.toLocaleString('en-US', options);
}

// ============================================================================
// HTML Utilities
// ============================================================================

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} HTML-escaped text
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// Response Processing Utilities
// ============================================================================

/**
 * Process curl response: strip headers and format JSON
 * @param {string} output - Raw curl output
 * @returns {Object} Processed response with formatted JSON
 * @returns {string} returns.processed - Processed output text
 * @returns {boolean} returns.hasJson - Whether JSON was detected
 * @returns {string|null} returns.jsonFormatted - Formatted JSON string if detected
 */
export function processCurlResponse(output) {
  // Check if this looks like a curl response with -i flag (includes headers)
  const lines = output.split('\n');

  // Find the first line (HTTP status line)
  let statusLine = '';
  let bodyStartIndex = 0;
  let foundBlankLine = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // First non-empty line is the status line
    if (!statusLine && line && line.startsWith('HTTP/')) {
      statusLine = lines[i];
      continue;
    }

    // Find the blank line that separates headers from body
    if (statusLine && !foundBlankLine) {
      if (line === '') {
        foundBlankLine = true;
        bodyStartIndex = i + 1;
        break;
      }
    }
  }

  // Extract the body
  const bodyText = foundBlankLine ? lines.slice(bodyStartIndex).join('\n').trim() : output;

  // Try to detect and format JSON from the body
  let jsonData = null;
  let jsonFormatted = null;

  try {
    // Try to parse as JSON
    jsonData = JSON.parse(bodyText);
    jsonFormatted = JSON.stringify(jsonData, null, 2);
  } catch (e) {
    // Not valid JSON, that's okay
  }

  // Build the final output
  let finalOutput = '';
  if (statusLine && foundBlankLine) {
    // If we have headers, include the status line
    finalOutput = statusLine + '\n\n';
    // If we have formatted JSON, use that instead of raw body
    if (jsonFormatted) {
      finalOutput += jsonFormatted;
    } else {
      finalOutput += bodyText;
    }
  } else {
    // No headers detected, just use the formatted JSON or original output
    finalOutput = jsonFormatted || output;
  }

  return {
    processed: finalOutput,
    hasJson: jsonData !== null,
    jsonFormatted: jsonFormatted
  };
}

// ============================================================================
// Theme Utilities
// ============================================================================

/**
 * Load theme preference from localStorage and apply it
 */
export function loadThemePreference() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  applyTheme(savedTheme);

  // Update the select element
  const themeSelect = document.getElementById('themeSelect');
  if (themeSelect) {
    themeSelect.value = savedTheme;
  }
}

/**
 * Apply theme to the page
 * @param {string} theme - Theme name ('light' or 'dark')
 */
export function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }
  localStorage.setItem('theme', theme);
}

// ============================================================================
// Status Update Utilities
// ============================================================================

/**
 * Update the status text in the UI
 * @param {string} message - Status message to display
 */
export function updateStatus(message) {
  const statusText = document.getElementById('statusText');
  if (statusText) {
    statusText.textContent = message;
  }
  console.log('Status:', message);
}

/**
 * Update the API health status indicator
 * @param {boolean} isHealthy - Whether the API is healthy
 */
export function updateAPIStatus(isHealthy) {
  const apiStatus = document.getElementById('apiStatus');
  if (!apiStatus) return;

  const indicator = apiStatus.querySelector('.status-indicator');
  if (indicator) {
    if (isHealthy) {
      indicator.style.color = '#4ec9b0';
      apiStatus.title = 'API is healthy';
    } else {
      indicator.style.color = '#f48771';
      apiStatus.title = 'API is not responding';
    }
  }
}

// ============================================================================
// Session Utilities
// ============================================================================

/**
 * Generate a session title based on command ID and user message
 * @param {string} commandId - Command identifier
 * @param {string} userMessage - User's message/input
 * @returns {string} Generated session title
 */
export function generateSessionTitle(commandId, userMessage) {
  const commandTitles = {
    'gemini': 'Chat with Gemini',
    'claude': 'Chat with Claude',
    'chatgpt': 'Chat with ChatGPT',
    'raw-terminal': 'Running Terminal Commands',
    'api-request': 'API Request',
    'ls': 'List Files',
    'whoami': 'Check User',
    'node-version': 'Check Node Version',
    'echo-test': 'Echo Test'
  };

  // If we have a predefined title, use it
  if (commandTitles[commandId]) {
    return commandTitles[commandId];
  }

  // Otherwise, create a title from the command
  if (userMessage && userMessage.length > 0) {
    const truncated = userMessage.length > 30 ? userMessage.substring(0, 30) + '...' : userMessage;
    return `Command: ${truncated}`;
  }

  return `Command: ${commandId}`;
}

// ============================================================================
// LocalStorage Utilities
// ============================================================================

/**
 * Load saved API request values from localStorage
 * @returns {Object} Saved API request values
 */
export function loadApiRequestValues() {
  return {
    url: localStorage.getItem('apiRequestUrl') || '',
    token: localStorage.getItem('apiRequestToken') || '',
    body: localStorage.getItem('apiRequestBody') || '',
    method: localStorage.getItem('apiRequestMethod') || 'GET'
  };
}

/**
 * Save API request values to localStorage
 * @param {Object} values - API request values to save
 * @param {string} values.url - API URL
 * @param {string} values.token - API token
 * @param {string} values.body - Request body
 * @param {string} values.method - HTTP method
 */
export function saveApiRequestValues(values) {
  localStorage.setItem('apiRequestUrl', values.url || '');
  localStorage.setItem('apiRequestToken', values.token || '');
  localStorage.setItem('apiRequestBody', values.body || '');
  localStorage.setItem('apiRequestMethod', values.method || 'GET');
}

