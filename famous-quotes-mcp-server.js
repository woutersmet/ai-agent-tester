#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

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

// Create server instance
const server = new Server(
  {
    name: "famous-quotes-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  console.error("[MCP Server] ListTools request received");
  return {
    tools: [
      {
        name: "search_quotes",
        description: "Search for famous quotes by keyword or author name. Returns matching quotes with their authors.",
        inputSchema: {
          type: "object",
          properties: {
            keyword: {
              type: "string",
              description: "Keyword to search for in the quote text (optional)",
            },
            author: {
              type: "string",
              description: "Author name to filter by (optional)",
            },
          },
        },
      },
      {
        name: "list_all_quotes",
        description: "List all available famous quotes in the database",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "get_random_quote",
        description: "Get a random famous quote",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "list_authors",
        description: "List all unique authors in the quotes database",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  console.error(`[MCP Server] Tool called: ${name}`);
  console.error(`[MCP Server] Arguments:`, JSON.stringify(args, null, 2));

  try {
    let result;

    if (name === "search_quotes") {
      const keyword = args.keyword?.toLowerCase();
      const author = args.author?.toLowerCase();

      let filteredQuotes = QUOTES;

      if (keyword) {
        filteredQuotes = filteredQuotes.filter(q => 
          q.quote.toLowerCase().includes(keyword)
        );
      }

      if (author) {
        filteredQuotes = filteredQuotes.filter(q => 
          q.author.toLowerCase().includes(author)
        );
      }

      if (filteredQuotes.length === 0) {
        result = {
          content: [
            {
              type: "text",
              text: `No quotes found matching your search criteria.${keyword ? `\nKeyword: "${args.keyword}"` : ""}${author ? `\nAuthor: "${args.author}"` : ""}`,
            },
          ],
        };
      } else {
        const quotesText = filteredQuotes
          .map((q, i) => `${i + 1}. "${q.quote}"\n   — ${q.author}`)
          .join("\n\n");
        
        result = {
          content: [
            {
              type: "text",
              text: `Found ${filteredQuotes.length} quote(s):\n\n${quotesText}`,
            },
          ],
        };
      }
    } else if (name === "list_all_quotes") {
      const quotesText = QUOTES
        .map((q, i) => `${i + 1}. "${q.quote}"\n   — ${q.author}`)
        .join("\n\n");
      
      result = {
        content: [
          {
            type: "text",
            text: `All Famous Quotes (${QUOTES.length} total):\n\n${quotesText}`,
          },
        ],
      };
    } else if (name === "get_random_quote") {
      const randomQuote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
      
      result = {
        content: [
          {
            type: "text",
            text: `"${randomQuote.quote}"\n— ${randomQuote.author}`,
          },
        ],
      };
    } else if (name === "list_authors") {
      const uniqueAuthors = [...new Set(QUOTES.map(q => q.author))].sort();
      const authorsText = uniqueAuthors
        .map((author, i) => `${i + 1}. ${author}`)
        .join("\n");
      
      result = {
        content: [
          {
            type: "text",
            text: `Authors in database (${uniqueAuthors.length} total):\n\n${authorsText}`,
          },
        ],
      };
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }

    console.error(`[MCP Server] Response:`, JSON.stringify(result, null, 2));
    return result;

  } catch (error) {
    console.error(`[MCP Server] Error:`, error.message);
    throw error;
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[MCP Server] Famous Quotes MCP server running on stdio");
}

main().catch((error) => {
  console.error("[MCP Server] Fatal error:", error);
  process.exit(1);
});

