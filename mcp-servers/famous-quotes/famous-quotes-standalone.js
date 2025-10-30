#!/usr/bin/env node

/**
 * Famous Quotes MCP Server - Standalone Version (No Dependencies)
 * 
 * This is a minimal implementation of the Model Context Protocol (MCP)
 * that works over stdio without requiring any external dependencies.
 */

// Famous quotes database
const QUOTES = [
  { quote: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { quote: "Innovation distinguishes between a leader and a follower.", author: "Steve Jobs" },
  { quote: "Be yourself; everyone else is already taken.", author: "Oscar Wilde" },
  { quote: "Two things are infinite: the universe and human stupidity; and I'm not sure about the universe.", author: "Albert Einstein" },
  { quote: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
  { quote: "Life is what happens when you're busy making other plans.", author: "John Lennon" },
  { quote: "The future belongs to those who believe in the beauty of their dreams.", author: "Eleanor Roosevelt" },
  { quote: "It is during our darkest moments that we must focus to see the light.", author: "Aristotle" },
  { quote: "The only impossible journey is the one you never begin.", author: "Tony Robbins" },
  { quote: "In this life we cannot do great things. We can only do small things with great love.", author: "Mother Teresa" },
  { quote: "The way to get started is to quit talking and begin doing.", author: "Walt Disney" },
  { quote: "Don't let yesterday take up too much of today.", author: "Will Rogers" },
  { quote: "You learn more from failure than from success. Don't let it stop you. Failure builds character.", author: "Unknown" },
  { quote: "It's not whether you get knocked down, it's whether you get up.", author: "Vince Lombardi" },
  { quote: "People who are crazy enough to think they can change the world, are the ones who do.", author: "Rob Siltanen" },
  { quote: "Knowing is not enough; we must apply. Wishing is not enough; we must do.", author: "Johann Wolfgang Von Goethe" },
  { quote: "Whether you think you can or you think you can't, you're right.", author: "Henry Ford" },
  { quote: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { quote: "I have not failed. I've just found 10,000 ways that won't work.", author: "Thomas Edison" },
  { quote: "The only limit to our realization of tomorrow will be our doubts of today.", author: "Franklin D. Roosevelt" }
];

// Log to stderr (stdout is reserved for JSON-RPC messages)
function log(message) {
  console.error(`[MCP Server] ${message}`);
}

// Send a JSON-RPC response
function sendResponse(id, result) {
  const response = {
    jsonrpc: "2.0",
    id: id,
    result: result
  };
  console.log(JSON.stringify(response));
}

// Send a JSON-RPC error
function sendError(id, code, message) {
  const response = {
    jsonrpc: "2.0",
    id: id,
    error: {
      code: code,
      message: message
    }
  };
  console.log(JSON.stringify(response));
}

// Handle initialize request
function handleInitialize(id) {
  log("Received initialize request");
  sendResponse(id, {
    protocolVersion: "2024-11-05",
    capabilities: {
      tools: {}
    },
    serverInfo: {
      name: "famous-quotes-mcp-server",
      version: "1.0.0"
    }
  });
}

// Handle tools/list request
function handleListTools(id) {
  log("Received tools/list request");
  sendResponse(id, {
    tools: [
      {
        name: "search_quotes",
        description: "Search for famous quotes by keyword or author name. Returns matching quotes with their authors.",
        inputSchema: {
          type: "object",
          properties: {
            keyword: {
              type: "string",
              description: "Keyword to search for in the quote text (optional)"
            },
            author: {
              type: "string",
              description: "Author name to filter by (optional)"
            }
          }
        }
      },
      {
        name: "list_all_quotes",
        description: "List all available famous quotes in the database",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "get_random_quote",
        description: "Get a random famous quote",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "list_authors",
        description: "List all unique authors in the quotes database",
        inputSchema: {
          type: "object",
          properties: {}
        }
      }
    ]
  });
}

// Handle tools/call request
function handleCallTool(id, params) {
  const toolName = params.name;
  const args = params.arguments || {};

  log(`Received tools/call request for tool: ${toolName}`);

  try {
    let result;

    switch (toolName) {
      case "search_quotes":
        result = searchQuotes(args.keyword, args.author);
        break;

      case "list_all_quotes":
        result = listAllQuotes();
        break;

      case "get_random_quote":
        result = getRandomQuote();
        break;

      case "list_authors":
        result = listAuthors();
        break;

      default:
        sendError(id, -32601, `Unknown tool: ${toolName}`);
        return;
    }

    sendResponse(id, {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    });
  } catch (error) {
    log(`Error executing tool ${toolName}: ${error.message}`);
    sendError(id, -32603, `Error executing tool: ${error.message}`);
  }
}

// Tool implementations
function searchQuotes(keyword, author) {
  let results = QUOTES;

  if (keyword) {
    const keywordLower = keyword.toLowerCase();
    results = results.filter(q => q.quote.toLowerCase().includes(keywordLower));
  }

  if (author) {
    const authorLower = author.toLowerCase();
    results = results.filter(q => q.author.toLowerCase().includes(authorLower));
  }

  return {
    count: results.length,
    quotes: results
  };
}

function listAllQuotes() {
  return {
    count: QUOTES.length,
    quotes: QUOTES
  };
}

function getRandomQuote() {
  const randomIndex = Math.floor(Math.random() * QUOTES.length);
  return QUOTES[randomIndex];
}

function listAuthors() {
  const authors = [...new Set(QUOTES.map(q => q.author))].sort();
  return {
    count: authors.length,
    authors: authors
  };
}

// Process incoming JSON-RPC messages
function processMessage(message) {
  try {
    const request = JSON.parse(message);
    const { id, method, params } = request;

    log(`Processing method: ${method}`);

    switch (method) {
      case "initialize":
        handleInitialize(id);
        break;

      case "tools/list":
        handleListTools(id);
        break;

      case "tools/call":
        handleCallTool(id, params);
        break;

      case "notifications/initialized":
        // Client acknowledges initialization, no response needed
        log("Client initialized");
        break;

      default:
        log(`Unknown method: ${method}`);
        sendError(id, -32601, `Method not found: ${method}`);
    }
  } catch (error) {
    log(`Error processing message: ${error.message}`);
    sendError(null, -32700, "Parse error");
  }
}

// Main: Read from stdin line by line
log("Famous Quotes MCP Server starting (standalone version)...");
log("Listening for JSON-RPC messages on stdin");

let buffer = '';

process.stdin.setEncoding('utf8');

process.stdin.on('data', (chunk) => {
  buffer += chunk;
  
  // Process complete lines
  let newlineIndex;
  while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    
    if (line) {
      processMessage(line);
    }
  }
});

process.stdin.on('end', () => {
  log("stdin closed, shutting down");
  process.exit(0);
});

process.on('SIGTERM', () => {
  log("Received SIGTERM, shutting down");
  process.exit(0);
});

process.on('SIGINT', () => {
  log("Received SIGINT, shutting down");
  process.exit(0);
});

