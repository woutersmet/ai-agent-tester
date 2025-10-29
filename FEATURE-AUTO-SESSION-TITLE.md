# Feature: Automatic Session Title Generation

## Overview
Implemented automatic session title generation based on the first command executed in a session. This provides better context and makes it easier to identify sessions at a glance.

## Changes Made

### 1. New Function: `generateSessionTitle()`

Added a function to generate meaningful session titles based on the command type:

```javascript
function generateSessionTitle(commandId, userMessage) {
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
```

### 2. Updated `executeCommand()` Function

Modified the command execution flow to:
1. Save the user message immediately (already working)
2. Check if the session title is still "New Session"
3. If yes, generate and set a new title based on the command
4. Update the session in the backend
5. Re-render the session list to show the new title

```javascript
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
```

## Behavior

### Title Generation Rules

1. **AI Agent Commands:**
   - `gemini` → "Chat with Gemini"
   - `claude` → "Chat with Claude"
   - `chatgpt` → "Chat with ChatGPT"

2. **Terminal Commands:**
   - `raw-terminal` → "Running Terminal Commands"
   - `ls` → "List Files"
   - `whoami` → "Check User"
   - `node-version` → "Check Node Version"
   - `echo-test` → "Echo Test"

3. **API Requests:**
   - `api-request` → "API Request"

4. **Unknown Commands:**
   - If user message exists: `Command: {first 30 chars}...`
   - Otherwise: `Command: {commandId}`

### When Title is Updated

- **Only on the first command** in a session
- Checks if `session.title === 'New Session'`
- Once updated, the title remains unchanged for subsequent commands
- This ensures the session title reflects the primary purpose/context

### What Gets Updated

1. **Session object:**
   - `title` - Set to generated title
   - `preview` - Set to first 100 characters of command content

2. **UI:**
   - Session title in header
   - Session list (re-rendered to show new title)

3. **Backend:**
   - Session saved to storage with new title

## Example

**Before first command:**
```json
{
  "id": 123,
  "title": "New Session",
  "preview": "New session - no messages yet",
  "messages": []
}
```

**After executing `gemini` command with "how are you":**
```json
{
  "id": 123,
  "title": "Chat with Gemini",
  "preview": "how are you",
  "messages": [
    {
      "role": "user",
      "content": "how are you",
      "timestamp": "2025-10-29T12:47:19.009Z",
      "commandId": "gemini"
    }
  ]
}
```

**After second command (title unchanged):**
```json
{
  "id": 123,
  "title": "Chat with Gemini",  // Still the same!
  "preview": "hi",
  "messages": [
    {
      "role": "user",
      "content": "how are you",
      "timestamp": "2025-10-29T12:47:19.009Z",
      "commandId": "gemini"
    },
    {
      "role": "system",
      "content": "I'm ready to help...",
      "timestamp": "2025-10-29T12:47:27.195Z"
    },
    {
      "role": "user",
      "content": "hi",
      "timestamp": "2025-10-29T12:47:30.800Z",
      "commandId": "gemini"
    }
  ]
}
```

## Benefits

1. **Better Context:** Session titles immediately convey what the session is about
2. **Easier Navigation:** Users can quickly identify sessions in the sidebar
3. **Automatic:** No manual input required from users
4. **Consistent:** Predefined titles for common commands ensure consistency
5. **Persistent:** Title is saved to backend and survives app restarts

## Testing

Tested with multiple scenarios:
- ✅ Gemini command sets title to "Chat with Gemini"
- ✅ Title remains unchanged after subsequent commands
- ✅ User messages are stored immediately
- ✅ Session list updates to show new title
- ✅ Backend storage reflects the updated title

## Files Modified

1. `renderer/js/app.js`
   - Added `generateSessionTitle()` function
   - Updated `executeCommand()` to set title on first command

