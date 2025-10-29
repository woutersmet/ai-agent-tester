# 🎨 UI Guide - AI Agent Tester

## New Layout Overview

The app now features a **three-column layout** similar to macOS Mail and other native email apps:

```
┌──────────┬─────────────────┬──────────────────────────────────────┐
│          │                 │                                      │
│   NAV    │   THREAD LIST   │        MAIN CONTENT AREA            │
│   BAR    │   (Sidebar)     │                                      │
│          │                 │                                      │
│   💬     │  🤖 Test Cmd    │  ┌────────────────────────────────┐ │
│ Threads  │  ─────────────  │  │                                │ │
│          │  Git Operations │  │  Thread messages appear here   │ │
│   ⚙️     │  ─────────────  │  │                                │ │
│ Settings │  Node.js Check  │  │  • User messages (blue)        │ │
│          │  ─────────────  │  │  • Assistant (gray)            │ │
│          │  File System    │  │  • System output (green)       │ │
│          │  ─────────────  │  │                                │ │
│          │  Custom Script  │  └────────────────────────────────┘ │
│          │                 │                                      │
│          │                 │  [Command ▼] [Execute] [Clear]       │
│          │                 │  ┌────────────────────────────────┐ │
│          │                 │  │ Type message...                │ │
│          │                 │  └────────────────────────────────┘ │
└──────────┴─────────────────┴──────────────────────────────────────┘
```

## Color Scheme

### Navigation Bar (Left)
- **Background**: Dark blue gradient (#2c5282 → #1a365d)
- **Text**: Light blue (#a0c4e8)
- **Active**: White (#ffffff) with lighter background
- **Width**: 70px

### Thread Sidebar (Middle)
- **Background**: Light gray (#f5f5f7)
- **Border**: Light gray (#d1d1d6)
- **Active thread**: Slightly darker with blue left border
- **Hover**: Subtle gray (#ebebed)
- **Width**: 320px

### Main Content (Right)
- **Background**: White (#ffffff)
- **Headers**: Light gray background (#fafafa)
- **Borders**: Light gray (#d1d1d6)
- **Accent**: Blue (#007aff)

## Views

### 1. Threads View (Default)

When you click **💬 Threads** in the navigation:
- Shows thread list sidebar
- Shows conversation messages
- Shows input area with command execution

**Features:**
- Click threads to view conversations
- Execute commands from dropdown
- Send messages (placeholder)
- Refresh threads

### 2. Settings View

When you click **⚙️ Settings** in the navigation:
- Hides thread list sidebar
- Shows settings panel with sections:

**General**
- Application name
- Theme selector (Light/Dark)

**API Configuration**
- API base URL
- Connection status indicator

**Command Execution**
- Enable/disable command execution
- Real-time output toggle
- Custom commands warning

**About**
- Version information
- Electron version
- Node.js version
- Platform info

## Interactive Elements

### Buttons
- **Primary**: Blue background (#007aff)
- **Secondary**: White with gray border
- **Hover**: Darker shade or border highlight
- **Border radius**: 6-8px for modern look

### Input Fields
- **Background**: White
- **Border**: Light gray (#d1d1d6)
- **Focus**: Blue border with subtle shadow
- **Border radius**: 8px

### Messages
- **User**: Blue bubbles, right-aligned
- **Assistant**: Gray bubbles with border, left-aligned
- **System**: Light background with green left border

## Typography

- **Font**: -apple-system (native macOS font)
- **Headers**: 16-24px, weight 600
- **Body**: 13-14px, weight 400
- **Labels**: 11-12px, weight 500

## Status Bar

Bottom bar showing:
- Current status message (left)
- API connection status (right)
- Green dot when connected
- Light gray background (#f5f5f7)

## Responsive Behavior

- Navigation bar: Fixed 70px width
- Thread sidebar: Fixed 320px width (hidden in Settings view)
- Main content: Flexible, takes remaining space
- Minimum window size: 1000x600px

## macOS Integration

- **Title bar**: Hidden inset style
- **Scrollbars**: Native macOS style
- **Colors**: Match macOS Big Sur+ design language
- **Drag regions**: Title bar and sidebars are draggable

## Keyboard Shortcuts

- `Cmd/Ctrl + Enter` - Send message
- Standard macOS shortcuts work (Cmd+C, Cmd+V, etc.)

---

**Enjoy the new clean, macOS-native interface! 🎉**

