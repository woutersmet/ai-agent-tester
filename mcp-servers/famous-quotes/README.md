# Famous Quotes MCP Server

A simple Model Context Protocol (MCP) server that provides access to famous quotes.

## Installation

```bash
npm install
```

## Running the Server

```bash
npm start
```

Or directly:

```bash
node famous-quotes-mcp-server.js
```

## Testing

Run the test script to verify all tools work:

```bash
npm test
```

## Available Tools

1. **search_quotes** - Search quotes by keyword or author
2. **list_all_quotes** - List all 20 famous quotes in the database
3. **get_random_quote** - Get a random quote
4. **list_authors** - List all unique authors

## Using with Gemini Desktop

Add this to your `~/Library/Application Support/Google/Gemini Desktop/mcp_settings.json`:

```json
{
  "mcpServers": {
    "famous-quotes": {
      "command": "node",
      "args": [
        "/Users/wouter.smet/Projects/ai-agent-tester/mcp-servers/famous-quotes/famous-quotes-mcp-server.js"
      ],
      "env": {}
    }
  }
}
```

**Important**: Replace the path with the actual absolute path to this directory.

## Example Requests

### Get a Random Quote
```json
{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_random_quote","arguments":{}}}
```

### Search by Keyword
```json
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"search_quotes","arguments":{"keyword":"love"}}}
```

### Search by Author
```json
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search_quotes","arguments":{"author":"Steve Jobs"}}}
```

### List All Authors
```json
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"list_authors","arguments":{}}}
```

## Quick Test

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_random_quote","arguments":{}}}' | npm start
```

