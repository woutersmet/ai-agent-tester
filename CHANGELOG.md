# Changelog

## Version 1.1.0 - UI Redesign

### Major Changes

#### 🎨 White Theme
- Changed from dark theme to light/white theme for better macOS integration
- Updated all colors to use macOS-style light palette
- Blue accent color (#007aff) for interactive elements
- Improved contrast and readability

#### 🧭 Navigation Sidebar
- Added left navigation bar with dark blue gradient background
- Two navigation items: "Threads" 💬 and "Settings" ⚙️
- Active state indication with lighter background
- Smooth view switching

#### ⚙️ Settings View
- New dedicated settings screen
- Sections for:
  - General settings (app name, theme)
  - API configuration (base URL, status)
  - Command execution preferences
  - About information (version, platform)
- Save and reset buttons (placeholder functionality)

### Layout Structure

```
┌─────┬──────────┬────────────────────────────┐
│ Nav │ Threads  │ Main Content               │
│ Bar │ Sidebar  │                            │
│     │          │                            │
│ 💬  │ Thread 1 │ Messages / Settings        │
│ ⚙️  │ Thread 2 │                            │
│     │ Thread 3 │                            │
│     │ ...      │                            │
└─────┴──────────┴────────────────────────────┘
```

### Visual Updates

- **Navigation Bar**: Dark blue (#2c5282 to #1a365d gradient)
- **Sidebar**: Light gray (#f5f5f7)
- **Main Content**: White (#ffffff)
- **Borders**: Light gray (#d1d1d6)
- **Buttons**: Blue (#007aff) with hover states
- **Messages**: 
  - User: Blue bubbles
  - Assistant: Light gray with border
  - System: Light background with green accent

### Behavior Changes

- Clicking "Threads" shows thread list and conversation view
- Clicking "Settings" hides thread list and shows settings panel
- Status bar updates to reflect current view
- Smooth transitions between views

### Files Modified

- `renderer/index.html` - Added navigation sidebar and settings view
- `renderer/css/styles.css` - Complete theme overhaul to white/light
- `renderer/js/app.js` - Added view switching logic

---

## Version 1.0.0 - Initial Release

- Electron + Express.js architecture
- Inbox-style interface
- Command execution with whitelisting
- Mock thread data
- Dark theme UI

