const fs = require('fs').promises;
const path = require('path');

// Use environment variable for user data path, fallback to current directory for development
const USER_DATA_PATH = process.env.USER_DATA_PATH || path.join(__dirname, '..');
const THREADS_DIR = path.join(USER_DATA_PATH, 'ai-agent-runner-sessions-history');

// Starter thread data (same as current hardcoded data)
const STARTER_THREADS = [
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
      await fs.access(THREADS_DIR);
      console.log('✅ ai-agent-runner-sessions-history folder already exists');
      return;
    } catch (error) {
      // Directory doesn't exist, create it
      console.log('📁 Creating ai-agent-runner-sessions-history folder...');
      await fs.mkdir(THREADS_DIR, { recursive: true });
    }

    // Create starter files with threads grouped by date
    const threadsByDate = {};
    
    for (const thread of STARTER_THREADS) {
      const date = new Date(thread.timestamp);
      const filename = getFilenameForDate(date);
      
      if (!threadsByDate[filename]) {
        threadsByDate[filename] = [];
      }
      threadsByDate[filename].push(thread);
    }

    // Write each date's threads to a file
    for (const [filename, threads] of Object.entries(threadsByDate)) {
      const filepath = path.join(THREADS_DIR, filename);
      await fs.writeFile(filepath, JSON.stringify(threads, null, 2));
      console.log(`✅ Created starter file: ${filename} with ${threads.length} thread(s)`);
    }

    console.log('✅ ai-agent-runner-sessions-history initialized with starter data');
  } catch (error) {
    console.error('❌ Error initializing ai-agent-runner-sessions-history:', error);
    throw error;
  }
}

/**
 * Get all threads from all date files
 * @returns {Promise<Array>} - Array of thread summaries (without messages)
 */
async function getAllThreads() {
  try {
    await fs.access(THREADS_DIR);
  } catch (error) {
    // If directory doesn't exist, initialize it
    await initialize();
  }

  try {
    const files = await fs.readdir(THREADS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse(); // Most recent first
    
    const allThreads = [];
    
    for (const file of jsonFiles) {
      const filepath = path.join(THREADS_DIR, file);
      const content = await fs.readFile(filepath, 'utf-8');
      const threads = JSON.parse(content);
      
      // Add thread summaries (without full messages)
      for (const thread of threads) {
        allThreads.push({
          id: thread.id,
          title: thread.title,
          preview: thread.preview,
          timestamp: thread.timestamp,
          unread: thread.unread || false
        });
      }
    }
    
    return allThreads;
  } catch (error) {
    console.error('Error reading threads:', error);
    return [];
  }
}

/**
 * Get a specific thread by ID
 * @param {number} threadId - The thread ID to find
 * @returns {Promise<Object|null>} - Thread object with messages or null if not found
 */
async function getThreadById(threadId) {
  try {
    await fs.access(THREADS_DIR);
  } catch (error) {
    await initialize();
  }

  try {
    const files = await fs.readdir(THREADS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    for (const file of jsonFiles) {
      const filepath = path.join(THREADS_DIR, file);
      const content = await fs.readFile(filepath, 'utf-8');
      const threads = JSON.parse(content);
      
      const thread = threads.find(t => t.id === threadId);
      if (thread) {
        return thread;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error reading thread:', error);
    return null;
  }
}

/**
 * Save or update a thread
 * @param {Object} thread - Thread object to save
 * @returns {Promise<boolean>} - Success status
 */
async function saveThread(thread) {
  try {
    await fs.access(THREADS_DIR);
  } catch (error) {
    await initialize();
  }

  try {
    const date = new Date(thread.timestamp);
    const filename = getFilenameForDate(date);
    const filepath = path.join(THREADS_DIR, filename);
    
    let threads = [];
    
    // Read existing threads for this date
    try {
      const content = await fs.readFile(filepath, 'utf-8');
      threads = JSON.parse(content);
    } catch (error) {
      // File doesn't exist yet, that's okay
    }
    
    // Find and update or add thread
    const index = threads.findIndex(t => t.id === thread.id);
    if (index >= 0) {
      threads[index] = thread;
    } else {
      threads.push(thread);
    }
    
    // Write back to file
    await fs.writeFile(filepath, JSON.stringify(threads, null, 2));
    console.log(`✅ Saved thread ${thread.id} to ${filename}`);
    return true;
  } catch (error) {
    console.error('Error saving thread:', error);
    return false;
  }
}

/**
 * Add a message to a thread
 * @param {number} threadId - Thread ID
 * @param {Object} message - Message object with role, content, timestamp
 * @returns {Promise<boolean>} - Success status
 */
async function addMessageToThread(threadId, message) {
  try {
    // Find the thread and the file it's in
    const files = await fs.readdir(THREADS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    for (const file of jsonFiles) {
      const filepath = path.join(THREADS_DIR, file);
      const content = await fs.readFile(filepath, 'utf-8');
      const threads = JSON.parse(content);

      const threadIndex = threads.findIndex(t => t.id === threadId);
      if (threadIndex >= 0) {
        const thread = threads[threadIndex];

        // Add message
        if (!thread.messages) {
          thread.messages = [];
        }
        thread.messages.push(message);

        // Update preview with latest message
        thread.preview = message.content.substring(0, 100) + (message.content.length > 100 ? '...' : '');

        // Update timestamp but keep in same file
        thread.timestamp = message.timestamp;

        // Update the thread in the array
        threads[threadIndex] = thread;

        // Write back to the SAME file
        await fs.writeFile(filepath, JSON.stringify(threads, null, 2));
        console.log(`✅ Added message to thread ${threadId} in ${file}`);
        return true;
      }
    }

    console.error(`Thread ${threadId} not found`);
    return false;
  } catch (error) {
    console.error('Error adding message to thread:', error);
    return false;
  }
}

/**
 * Delete a thread by ID
 * @param {number} threadId - Thread ID to delete
 * @returns {Promise<boolean>} - Success status
 */
async function deleteThread(threadId) {
  try {
    await fs.access(THREADS_DIR);
  } catch (error) {
    await initialize();
  }

  try {
    const files = await fs.readdir(THREADS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    for (const file of jsonFiles) {
      const filepath = path.join(THREADS_DIR, file);
      const content = await fs.readFile(filepath, 'utf-8');
      const threads = JSON.parse(content);

      const threadIndex = threads.findIndex(t => t.id === threadId);
      if (threadIndex >= 0) {
        // Remove the thread from the array
        threads.splice(threadIndex, 1);

        // If the file is now empty, delete it
        if (threads.length === 0) {
          await fs.unlink(filepath);
          console.log(`✅ Deleted empty file: ${file}`);
        } else {
          // Otherwise, write the updated threads back to the file
          await fs.writeFile(filepath, JSON.stringify(threads, null, 2));
          console.log(`✅ Deleted thread ${threadId} from ${file}`);
        }

        return true;
      }
    }

    console.error(`Thread ${threadId} not found`);
    return false;
  } catch (error) {
    console.error('Error deleting thread:', error);
    return false;
  }
}

module.exports = {
  initialize,
  getAllThreads,
  getThreadById,
  saveThread,
  addMessageToThread,
  deleteThread,
  THREADS_DIR
};

