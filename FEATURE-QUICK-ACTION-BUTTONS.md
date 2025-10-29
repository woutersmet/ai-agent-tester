# Feature: Quick Action Buttons for CLI Commands

## Overview
Implemented context-aware quick action buttons that appear **below the input area** based on the selected execution type (Gemini, Claude, ChatGPT CLI, or raw-terminal). These small, grey buttons provide quick access to commonly used commands for each CLI tool and execute immediately when clicked.

## Changes Made

### 1. HTML Structure (`renderer/index.html`)

Added a new container for quick action buttons after all input wrappers and waiting state:

```html
<div class="quick-actions hidden" id="quickActions">
  <!-- Quick action buttons will be dynamically inserted here -->
</div>
```

**Location:** Line 160, after the waiting state and below all input areas

### 2. CSS Styling (`renderer/css/styles.css`)

Added styles for the quick action buttons container and buttons:

```css
.quick-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.quick-actions.hidden {
  display: none;
}

.quick-action-btn {
  padding: 4px 10px;
  background-color: #f5f5f7;
  border: 1px solid #d1d1d6;
  border-radius: 4px;
  color: #6e6e73;
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
}

.quick-action-btn:hover {
  background-color: #e8e8ed;
  border-color: #007aff;
  color: #1d1d1f;
}

.quick-action-btn:active {
  transform: scale(0.98);
}
```

**Dark Theme Support:**

```css
body.dark-theme .quick-action-btn {
  background-color: #2d2d2d;
  border-color: #3c3c43;
  color: #86868b;
}

body.dark-theme .quick-action-btn:hover {
  background-color: #3c3c43;
  border-color: #007aff;
  color: #e5e5e7;
}
```

### 3. JavaScript Logic (`renderer/js/app.js`)

#### Added DOM Element Reference (Line 39)
```javascript
const quickActions = document.getElementById('quickActions');
```

#### New Function: `updateQuickActions(commandId)` (Lines 167-214)

This function manages the display and behavior of quick action buttons based on the selected command:

```javascript
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
```

#### Updated `updateInputMode(commandId)` Function (Line 216)

Added a call to `updateQuickActions()` at the beginning of the function:

```javascript
function updateInputMode(commandId) {
  const command = availableCommands.find(cmd => cmd.id === commandId);

  // Update quick actions
  updateQuickActions(commandId);

  // ... rest of the function
}
```

## Behavior

### Command Order and Default Selection

Commands are now ordered as follows:
1. **Gemini** (default selection)
2. Claude
3. ChatGPT
4. API Request
5. Raw Terminal
6. Other utility commands (ls, whoami, node-version, echo-test)

When the application starts, **Gemini is automatically selected** as the default command.

### Quick Action Buttons by CLI Type

1. **Gemini CLI** (`gemini` command selected - DEFAULT)
   - Button: "List MCP & Tools"
   - Command: `gemini mcp list --servers`

2. **Claude CLI** (`claude` command selected)
   - Button: "List MCP & Tools"
   - Command: `claude mcp list`

3. **ChatGPT CLI** (`chatgpt` command selected)
   - Button: "List MCP & Tools"
   - Command: `codex mcp list`

4. **Raw Terminal** (`raw-terminal` command selected)
   - Button: "ls"
   - Command: `ls`
   - Button: "whoami"
   - Command: `whoami`

5. **Other Commands**
   - No quick action buttons displayed

### User Interaction

1. **Button Click Behavior:**
   - When a quick action button is clicked, the associated command is automatically inserted into the message input field
   - **The command is executed immediately** - no need to press Enter or click Send
   - This provides instant execution for common commands

2. **Visual Feedback:**
   - Buttons have a subtle grey appearance to indicate they are helper actions
   - Hover state changes the background color and border to blue
   - Active state provides a slight scale animation for tactile feedback

3. **Responsive Design:**
   - Buttons use `flex-wrap: wrap` to handle multiple buttons gracefully
   - Small font size (11px) and compact padding (4px 10px) keep them unobtrusive
   - `white-space: nowrap` prevents button text from wrapping

### When Quick Actions Appear

- Quick action buttons are shown/hidden automatically when the command selection changes
- They appear **below the input area** at the bottom of the input section
- They are only visible when a supported CLI command (gemini, claude, chatgpt, or raw-terminal) is selected

### Command Display Behavior

**For Agent Commands (Gemini, Claude, ChatGPT):**
- The user message initially shows only the prompt content
- After the server executes the command, the full command is retrieved and displayed
- Example: User types "hi" → Server executes `gemini -p "hi"` → Display shows `$ gemini -p hi`

**For Raw Terminal:**
- The full command is known immediately and displayed right away
- Example: User types "ls -la" → Display shows `$ ls -la` immediately

**For API Requests:**
- The full curl command is constructed on the frontend and displayed immediately
- Example: GET request to https://api.example.com → Display shows `$ curl -X GET https://api.example.com -i`

## Design Rationale

### Why These Commands?

The "List MCP & Tools" command is essential for users working with Model Context Protocol (MCP) servers:
- **Gemini:** `gemini mcp list --servers` - Lists all configured MCP servers
- **Claude:** `claude mcp list` - Lists all configured MCP servers
- **ChatGPT/Codex:** `codex mcp list` - Lists all configured MCP servers

These commands help users quickly discover what tools and capabilities are available in their AI agent environment.

### Design Choices

1. **Small and Grey:** Buttons are intentionally subtle to avoid cluttering the interface
2. **Context-Aware:** Only show relevant buttons for the selected CLI
3. **Immediate Execution:** Buttons execute commands immediately for faster workflow
4. **Below Input:** Positioned below the input area to avoid interfering with the main input flow
5. **Extensible:** The `quickActionsMap` structure makes it easy to add more quick actions in the future

## Future Enhancements

The current implementation provides a foundation for adding more quick actions:

```javascript
const quickActionsMap = {
  'gemini': [
    { label: 'List MCP & Tools', command: 'gemini mcp list --servers' },
    { label: 'Show Config', command: 'gemini config show' },
    // Add more Gemini quick actions here
  ],
  'claude': [
    { label: 'List MCP & Tools', command: 'claude mcp list' },
    { label: 'Show Version', command: 'claude --version' },
    // Add more Claude quick actions here
  ],
  'raw-terminal': [
    { label: 'ls', command: 'ls' },
    { label: 'whoami', command: 'whoami' },
    { label: 'pwd', command: 'pwd' },
    // Add more terminal quick actions here
  ],
  // ... etc
};
```

## Testing

To test the feature:

1. Start the application: `npm start`
2. Verify that "gemini" is automatically selected as the default command
3. Verify that a "List MCP & Tools" button appears below the input area
4. Click the button and verify that the command executes immediately
5. Select "claude" and test the "List MCP & Tools" button
6. Select "chatgpt" and test the "List MCP & Tools" button
7. Select "raw-terminal" and verify that "ls" and "whoami" buttons appear
8. Click the "ls" button and verify it executes immediately with the full command shown in the user message
9. Click the "whoami" button and verify it executes immediately with the full command shown
10. Test typing a custom command in raw-terminal (e.g., `ls -la`) and verify the full command is displayed
11. Select a different command (e.g., "node-version") and verify that the quick actions are hidden
12. Test in both light and dark themes

## Files Modified

1. **`server/app.js`**
   - Reordered `ALLOWED_COMMANDS` to put Gemini first, followed by Claude, ChatGPT, API Request, then Raw Terminal (Lines 20-31)

2. **`renderer/index.html`**
   - Added `<div class="quick-actions hidden" id="quickActions">` container below all input areas (Line 160)

3. **`renderer/css/styles.css`**
   - Added `.quick-actions` and `.quick-action-btn` styles with `margin-top: 12px`
   - Added dark theme styles for quick action buttons

4. **`renderer/js/app.js`**
   - Added `quickActions` DOM element reference (Line 39)
   - Added `updateQuickActions(commandId)` function with immediate execution (Lines 170-217)
   - Updated `renderCommandSelect()` to default to 'gemini' instead of 'raw-terminal' (Lines 154-168)
   - Updated `updateInputMode(commandId)` to call `updateQuickActions()`
   - **Fixed command display**: Set `rawCommand = ''` for agent commands (gemini, claude, chatgpt) so the full command from server response is displayed (Line 431)

## Benefits

1. **Improved Discoverability:** Users can easily discover important CLI commands
2. **Faster Workflow:** Common commands execute with a single click
3. **Reduced Errors:** Pre-defined commands eliminate typing mistakes
4. **Context-Aware:** Only shows relevant actions for the selected CLI
5. **Extensible:** Easy to add more quick actions in the future
6. **Immediate Execution:** No need to press Enter or click Send - instant results
7. **Terminal Shortcuts:** Quick access to common terminal commands like `ls` and `whoami`

