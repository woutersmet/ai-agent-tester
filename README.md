# 🤖 AI Agent Tester

An Electron-based desktop application for macOS that provides an inbox-style interface for testing AI agents with command execution capabilities. Built with Electron, Express.js, and Node.js.

## ✨ Features

- **Inbox-Style Interface**: Gmail-like layout with session list and message view
- **Command Execution**: Safely execute whitelisted shell commands
- **Modern UI**: Dark theme with macOS-native styling
- **Real-time Updates**: Live status indicators and command output
- **Security First**: Whitelisted commands to prevent arbitrary code execution

## 📋 Prerequisites

Before you begin, ensure you have the following installed on your Mac:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **npm** (comes with Node.js)
- **macOS** (10.13 or higher recommended)

To check if you have Node.js and npm installed:

```bash
node --version
npm --version
```

## 🚀 Getting Started

### 1. Navigate to the Project Directory

```bash
cd ai-agent-tester-app-mac
```

### 2. Install Dependencies

Install all required npm packages:

```bash
npm install
```

This will install:
- Electron (for the desktop app)
- Express (for the backend API)
- CORS (for cross-origin requests)

### 3. Run the Application

Start the app in development mode:

```bash
npm start
```

Or with developer tools open:

```bash
npm run dev
```

The application will:
1. Start the Express server on `http://localhost:3000`
2. Launch the Electron window
3. Load the inbox interface

## 🔧 How It Works

### Architecture

1. **Electron Main Process** (`main.js`): 
   - Creates the application window
   - Starts the Express server
   - Manages app lifecycle

2. **Express Backend** (`server/app.js`):
   - Provides REST API endpoints
   - Handles command execution
   - Manages session data

3. **Frontend** (`renderer/`):
   - Displays inbox-style interface
   - Communicates with Express API
   - Renders sessions and messages

### API Endpoints

- `GET /api/health` - Check API status
- `GET /api/threads` - Get all sessions
- `GET /api/threads/:id` - Get specific session details
- `GET /api/commands` - Get available commands
- `POST /api/execute` - Execute a whitelisted command
- `POST /api/execute-custom` - Execute custom command (use with caution)

## 🎨 Using the Application

### Viewing Sessions

1. Launch the app with `npm start`
2. The left sidebar shows a list of conversation sessions
3. Click any session to view its messages in the main panel

### Executing Commands

1. Select a session (or use the input area directly)
2. Choose a command from the dropdown menu
3. Click the "▶️ Execute" button
4. View the command output in the text area

### Keyboard Shortcuts

- `Cmd/Ctrl + Enter` - Send message
- Standard macOS shortcuts work (Cmd+C, Cmd+V, etc.)

## 🛠️ Development

### Running in Development Mode

```bash
npm run dev
```

This opens the app with DevTools enabled for debugging.

### Modifying the UI

- Edit `renderer/index.html` for structure
- Edit `renderer/css/styles.css` for styling
- Edit `renderer/js/app.js` for frontend logic

### Modifying the Backend

- Edit `server/app.js` to add new API endpoints or commands

### Hot Reload

Currently, you need to restart the app to see changes. For auto-reload during development, consider installing:

```bash
npm install --save-dev electron-reload
```

## 📦 Building for Distribution

The app is configured with **electron-builder** to create professional macOS installers (.dmg files).

### Build Commands

```bash
# Build for macOS (creates DMG installers for both Intel and Apple Silicon)
npm run build

# Build DMG only
npm run build:dmg

# Build without packaging (for testing)
npm run build:dir
```

### What Gets Built

Running `npm run build` will create:

- `dist/AI Agent Tester-1.0.0-x64.dmg` - For Intel Macs
- `dist/AI Agent Tester-1.0.0-arm64.dmg` - For Apple Silicon (M1/M2/M3) Macs

### Installing the DMG

1. Double-click the `.dmg` file
2. Drag "AI Agent Tester" to the Applications folder
3. Launch from Applications or Spotlight

### Code Signing (Optional)

For public distribution, you should sign the app with an Apple Developer certificate:

1. Get an Apple Developer account ($99/year)
2. Create a "Developer ID Application" certificate
3. Add to `package.json`:

```json
"build": {
  "mac": {
    "identity": "Developer ID Application: Your Name (TEAM_ID)"
  }
}
```

Without code signing, users will see a security warning on first launch (they can bypass it by right-clicking and selecting "Open").

### Build Configuration

The build configuration is in `package.json` under the `"build"` field. Key settings:

- **appId**: `com.aiagent.tester` - Unique identifier for your app
- **icon**: `build/icon.icns` - App icon (auto-generated from PNG)
- **target**: Builds for both `x64` (Intel) and `arm64` (Apple Silicon)
- **output**: `dist/` directory

## 🐛 Troubleshooting

### Port Already in Use

If port 3000 is already in use, edit `main.js` and change:

```javascript
const PORT = 3000; // Change to another port like 3001
```

### App Won't Start

1. Delete `node_modules` and reinstall:
   ```bash
   rm -rf node_modules
   npm install
   ```

2. Check Node.js version:
   ```bash
   node --version  # Should be v16 or higher
   ```

### Commands Not Executing

1. Check the terminal/console for error messages
2. Verify the command exists in `ALLOWED_COMMANDS`
3. Check file permissions if accessing files

## 📝 TODO / Future Enhancements

- [ ] Implement actual message sending functionality
- [ ] Add new session creation
- [ ] Persist sessions to database
- [ ] Add search functionality
- [ ] Implement real-time command streaming
- [ ] Add command history
- [ ] Support for custom command templates
- [ ] Integration with AI APIs (OpenAI, Anthropic, etc.)
- [ ] Export conversation sessions
- [ ] Dark/Light theme toggle

## 📄 License

MIT License - Feel free to use and modify as needed.

## 🤝 Contributing

This is a starter template. Feel free to fork and customize for your needs!

## 📧 Support

For issues or questions, please check the console logs and terminal output for error messages.

---

**Happy Testing! 🚀**

