const fs = require('fs').promises;
const path = require('path');

// Use environment variable for user data path, fallback to current directory for development
const USER_DATA_PATH = process.env.USER_DATA_PATH || path.join(__dirname, '..');
const SESSIONS_DIR = path.join(USER_DATA_PATH, 'ai-agent-runner-sessions-history');

// Starter session data (same as current hardcoded data)
const STARTER_SESSIONS = [
  {
    id: 1,
    title: 'Test Command Execution',
    preview: 'Testing basic shell commands...',
    timestamp: '2024-01-15T10:30:00Z',
    unread: true,
    messages: [
      { role: 'user', content: 'Run ls command', timestamp: '2024-01-15T10:30:00Z' },
      { role: 'assistant', content: 'Executing ls -la...', timestamp: '2024-01-15T10:30:05Z' },
      { role: 'system', content: 'Command output:\ntotal 24\ndrwxr-xr-x  5 user  staff  160 Jan 15 10:30 .\ndrwxr-xr-x  8 user  staff  256 Jan 15 10:29 ..', timestamp: '2024-01-15T10:30:06Z' }
    ]
  },
  {
    id: 2,
    title: 'Git Operations',
    preview: 'Running git status and branch commands',
    timestamp: '2024-01-15T09:15:00Z',
    unread: false,
    messages: [
      { role: 'user', content: 'Check git status', timestamp: '2024-01-15T09:15:00Z' },
      { role: 'assistant', content: 'Running git status...', timestamp: '2024-01-15T09:15:02Z' },
      { role: 'system', content: 'On branch main\nYour branch is up to date with origin/main', timestamp: '2024-01-15T09:15:03Z' }
    ]
  },
  {
    id: 3,
    title: 'Node.js Version Check',
    preview: 'Checking Node and npm versions',
    timestamp: '2024-01-14T16:45:00Z',
    unread: false,
    messages: [
      { role: 'user', content: 'What version of Node.js is installed?', timestamp: '2024-01-14T16:45:00Z' },
      { role: 'assistant', content: 'Checking Node.js version...', timestamp: '2024-01-14T16:45:01Z' },
      { role: 'system', content: 'v20.10.0', timestamp: '2024-01-14T16:45:02Z' }
    ]
  },
  {
    id: 4,
    title: 'File System Operations',
    preview: 'Listing directories and files',
    timestamp: '2024-01-14T14:20:00Z',
    unread: false,
    messages: [
      { role: 'user', content: 'List all files in current directory', timestamp: '2024-01-14T14:20:00Z' },
      { role: 'assistant', content: 'Listing files...', timestamp: '2024-01-14T14:20:01Z' }
    ]
  },
  {
    id: 5,
    title: 'Custom Script Execution',
    preview: 'Running custom bash scripts',
    timestamp: '2024-01-13T11:00:00Z',
    unread: false,
    messages: [
      { role: 'user', content: 'Run my custom script', timestamp: '2024-01-13T11:00:00Z' },
      { role: 'assistant', content: 'Executing script...', timestamp: '2024-01-13T11:00:02Z' }
    ]
  }
];

/**
 * Get the filename for a given date
 * @param {Date} date - The date to get filename for
 * @returns {string} - Filename in format YYYY-MM-DD.json
 */
function getFilenameForDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}.json`;
}

/**
 * Get the date from a filename
 * @param {string} filename - Filename in format YYYY-MM-DD.json
 * @returns {Date|null} - Date object or null if invalid
 */
function getDateFromFilename(filename) {
  const match = filename.match(/^(\d{4})-(\d{2})-(\d{2})\.json$/);
  if (!match) return null;
  return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
}

/**
 * Initialize the ai-agent-runner-sessions-history folder with starter data if it doesn't exist
 */
async function initialize() {
  try {
    // Check if directory exists
    try {
      await fs.access(SESSIONS_DIR);
      console.log('✅ ai-agent-runner-sessions-history folder already exists');
      return;
    } catch (error) {
      // Directory doesn't exist, create it
      console.log('📁 Creating ai-agent-runner-sessions-history folder...');
      await fs.mkdir(SESSIONS_DIR, { recursive: true });
    }

    // Create starter files with sessions grouped by date
    const sessionsByDate = {};
    
    for (const session of STARTER_SESSIONS) {
      const date = new Date(session.timestamp);
      const filename = getFilenameForDate(date);
      
      if (!sessionsByDate[filename]) {
        sessionsByDate[filename] = [];
      }
      sessionsByDate[filename].push(session);
    }

    // Write each date's sessions to a file
    for (const [filename, sessions] of Object.entries(sessionsByDate)) {
      const filepath = path.join(SESSIONS_DIR, filename);
      await fs.writeFile(filepath, JSON.stringify(sessions, null, 2));
      console.log(`✅ Created starter file: ${filename} with ${sessions.length} session(s)`);
    }

    console.log('✅ ai-agent-runner-sessions-history initialized with starter data');
  } catch (error) {
    console.error('❌ Error initializing ai-agent-runner-sessions-history:', error);
    throw error;
  }
}

/**
 * Get all sessions from all date files
 * @returns {Promise<Array>} - Array of session summaries (without messages)
 */
async function getAllSessions() {
  try {
    await fs.access(SESSIONS_DIR);
  } catch (error) {
    // If directory doesn't exist, initialize it
    await initialize();
  }

  try {
    const files = await fs.readdir(SESSIONS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse(); // Most recent first
    
    const allSessions = [];
    
    for (const file of jsonFiles) {
      const filepath = path.join(SESSIONS_DIR, file);
      const content = await fs.readFile(filepath, 'utf-8');
      const sessions = JSON.parse(content);
      
      // Add session summaries (without full messages)
      for (const session of sessions) {
        allSessions.push({
          id: session.id,
          title: session.title,
          preview: session.preview,
          timestamp: session.timestamp,
          unread: session.unread || false
        });
      }
    }
    
    return allSessions;
  } catch (error) {
    console.error('Error reading sessions:', error);
    return [];
  }
}

/**
 * Get a specific session by ID
 * @param {number} sessionId - The session ID to find
 * @returns {Promise<Object|null>} - Session object with messages or null if not found
 */
async function getSessionById(sessionId) {
  try {
    await fs.access(SESSIONS_DIR);
  } catch (error) {
    await initialize();
  }

  try {
    const files = await fs.readdir(SESSIONS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    for (const file of jsonFiles) {
      const filepath = path.join(SESSIONS_DIR, file);
      const content = await fs.readFile(filepath, 'utf-8');
      const sessions = JSON.parse(content);
      
      const session = sessions.find(s => s.id === sessionId);
      if (session) {
        return session;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error reading session:', error);
    return null;
  }
}

/**
 * Save or update a session
 * @param {Object} session - Session object to save
 * @returns {Promise<boolean>} - Success status
 */
async function saveSession(session) {
  try {
    await fs.access(SESSIONS_DIR);
  } catch (error) {
    await initialize();
  }

  try {
    const date = new Date(session.timestamp);
    const filename = getFilenameForDate(date);
    const filepath = path.join(SESSIONS_DIR, filename);

    let sessions = [];

    // Read existing sessions for this date
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      sessions = JSON.parse(content);
      console.log(`📖 Read ${sessions.length} existing sessions from ${filename}`);
    } catch (error) {
      // File doesn't exist yet, that's okay
      console.log(`📄 Creating new file ${filename}`);
    }

    // Find and update or add session
    const index = sessions.findIndex(s => s.id === session.id);
    if (index >= 0) {
      console.log(`🔄 Updating existing session ${session.id} in ${filename}`);
      sessions[index] = session;
    } else {
      console.log(`➕ Adding new session ${session.id} to ${filename}`);
      sessions.push(session);
    }

    // Write back to file
    await fs.writeFile(filepath, JSON.stringify(sessions, null, 2));
    console.log(`✅ Saved session ${session.id} to ${filename} (file now has ${sessions.length} sessions)`);
    return true;
  } catch (error) {
    console.error('❌ Error saving session:', error);
    return false;
  }
}

/**
 * Add a message to a session
 * @param {number} sessionId - Session ID
 * @param {Object} message - Message object with role, content, timestamp
 * @returns {Promise<boolean>} - Success status
 */
async function addMessageToSession(sessionId, message) {
  try {
    // Ensure directory exists
    try {
      await fs.access(SESSIONS_DIR);
    } catch (error) {
      await initialize();
    }

    // Find the session and the file it's in
    const files = await fs.readdir(SESSIONS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    console.log(`🔍 Searching for session ${sessionId} in ${jsonFiles.length} files`);

    for (const file of jsonFiles) {
      const filepath = path.join(SESSIONS_DIR, file);
      const content = await fs.readFile(filepath, 'utf-8');
      const sessions = JSON.parse(content);

      const sessionIndex = sessions.findIndex(s => s.id === sessionId);
      if (sessionIndex >= 0) {
        const session = sessions[sessionIndex];

        // Add message
        if (!session.messages) {
          session.messages = [];
        }
        session.messages.push(message);

        // Update preview with latest message
        session.preview = message.content.substring(0, 100) + (message.content.length > 100 ? '...' : '');

        // Update timestamp but keep in same file
        session.timestamp = message.timestamp;

        // Update the session in the array
        sessions[sessionIndex] = session;

        // Write back to the SAME file
        await fs.writeFile(filepath, JSON.stringify(sessions, null, 2));
        console.log(`✅ Added message to session ${sessionId} in ${file} (now has ${session.messages.length} messages)`);
        return true;
      }
    }

    console.error(`❌ Session ${sessionId} not found in any of the ${jsonFiles.length} files`);
    console.error(`   Files searched: ${jsonFiles.join(', ')}`);
    return false;
  } catch (error) {
    console.error('❌ Error adding message to session:', error);
    return false;
  }
}

/**
 * Delete a session by ID
 * @param {number} sessionId - Session ID to delete
 * @returns {Promise<boolean>} - Success status
 */
async function deleteSession(sessionId) {
  try {
    await fs.access(SESSIONS_DIR);
  } catch (error) {
    await initialize();
  }

  try {
    const files = await fs.readdir(SESSIONS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    for (const file of jsonFiles) {
      const filepath = path.join(SESSIONS_DIR, file);
      const content = await fs.readFile(filepath, 'utf-8');
      const sessions = JSON.parse(content);

      const sessionIndex = sessions.findIndex(s => s.id === sessionId);
      if (sessionIndex >= 0) {
        // Remove the session from the array
        sessions.splice(sessionIndex, 1);

        // If the file is now empty, delete it
        if (sessions.length === 0) {
          await fs.unlink(filepath);
          console.log(`✅ Deleted empty file: ${file}`);
        } else {
          // Otherwise, write the updated sessions back to the file
          await fs.writeFile(filepath, JSON.stringify(sessions, null, 2));
          console.log(`✅ Deleted session ${sessionId} from ${file}`);
        }

        return true;
      }
    }

    console.error(`Session ${sessionId} not found`);
    return false;
  } catch (error) {
    console.error('Error deleting session:', error);
    return false;
  }
}

module.exports = {
  initialize,
  getAllSessions,
  getSessionById,
  saveSession,
  addMessageToSession,
  deleteSession,
  SESSIONS_DIR
};


