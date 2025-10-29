#!/usr/bin/env node

/**
 * Simple test script to verify the Famous Quotes MCP server works
 * This spawns the server and sends it test requests
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Start the MCP server
const serverPath = join(__dirname, 'famous-quotes-mcp-server.js');
const server = spawn('node', [serverPath]);

let responseBuffer = '';

server.stdout.on('data', (data) => {
  responseBuffer += data.toString();
  
  // Try to parse complete JSON-RPC responses
  const lines = responseBuffer.split('\n');
  responseBuffer = lines.pop(); // Keep incomplete line in buffer
  
  lines.forEach(line => {
    if (line.trim()) {
      try {
        const response = JSON.parse(line);
        console.log('\n✅ Received response:');
        console.log(JSON.stringify(response, null, 2));
      } catch (e) {
        // Not JSON, ignore
      }
    }
  });
});

server.stderr.on('data', (data) => {
  console.log('📋 Server log:', data.toString().trim());
});

server.on('close', (code) => {
  console.log(`\n🛑 Server process exited with code ${code}`);
  process.exit(code);
});

// Wait for server to start
setTimeout(() => {
  console.log('\n🧪 Testing Famous Quotes MCP Server\n');
  console.log('=' .repeat(50));
  
  // Test 1: List tools
  console.log('\n📝 Test 1: Listing available tools...');
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  };
  server.stdin.write(JSON.stringify(listToolsRequest) + '\n');
  
  // Test 2: Get random quote
  setTimeout(() => {
    console.log('\n📝 Test 2: Getting a random quote...');
    const randomQuoteRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: {
        name: 'get_random_quote',
        arguments: {}
      }
    };
    server.stdin.write(JSON.stringify(randomQuoteRequest) + '\n');
  }, 1000);
  
  // Test 3: Search quotes by keyword
  setTimeout(() => {
    console.log('\n📝 Test 3: Searching quotes with keyword "love"...');
    const searchRequest = {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'search_quotes',
        arguments: {
          keyword: 'love'
        }
      }
    };
    server.stdin.write(JSON.stringify(searchRequest) + '\n');
  }, 2000);
  
  // Test 4: Search by author
  setTimeout(() => {
    console.log('\n📝 Test 4: Searching quotes by author "Steve Jobs"...');
    const authorSearchRequest = {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'search_quotes',
        arguments: {
          author: 'Steve Jobs'
        }
      }
    };
    server.stdin.write(JSON.stringify(authorSearchRequest) + '\n');
  }, 3000);
  
  // Test 5: List all authors
  setTimeout(() => {
    console.log('\n📝 Test 5: Listing all authors...');
    const listAuthorsRequest = {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'list_authors',
        arguments: {}
      }
    };
    server.stdin.write(JSON.stringify(listAuthorsRequest) + '\n');
  }, 4000);
  
  // Exit after all tests
  setTimeout(() => {
    console.log('\n' + '='.repeat(50));
    console.log('\n✅ All tests completed! Shutting down server...\n');
    server.kill();
  }, 5000);
  
}, 500);

