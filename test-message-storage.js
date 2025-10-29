#!/usr/bin/env node

/**
 * Test script to verify message storage is working correctly
 */

const API_BASE_URL = 'http://localhost:3000/api';

async function testMessageStorage() {
  console.log('🧪 Testing message storage...\n');

  try {
    // Step 1: Create a new session
    console.log('1️⃣  Creating new session...');
    const newSession = {
      id: Date.now(), // Use timestamp as unique ID
      title: 'Test Session',
      preview: 'Testing message storage',
      timestamp: new Date().toISOString(),
      unread: false,
      messages: []
    };

    const createResponse = await fetch(`${API_BASE_URL}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSession)
    });

    if (!createResponse.ok) {
      throw new Error(`Failed to create session: ${await createResponse.text()}`);
    }

    console.log(`✅ Created session with ID: ${newSession.id}\n`);

    // Step 2: Add a user message
    console.log('2️⃣  Adding user message...');
    const userMessage = {
      role: 'user',
      content: 'Hello, this is a test message',
      timestamp: new Date().toISOString()
    };

    const userMsgResponse = await fetch(`${API_BASE_URL}/threads/${newSession.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userMessage)
    });

    if (!userMsgResponse.ok) {
      throw new Error(`Failed to add user message: ${await userMsgResponse.text()}`);
    }

    console.log('✅ Added user message\n');

    // Step 3: Add a system message
    console.log('3️⃣  Adding system message...');
    const systemMessage = {
      role: 'system',
      content: 'This is a system response',
      timestamp: new Date().toISOString()
    };

    const sysMsgResponse = await fetch(`${API_BASE_URL}/threads/${newSession.id}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(systemMessage)
    });

    if (!sysMsgResponse.ok) {
      throw new Error(`Failed to add system message: ${await sysMsgResponse.text()}`);
    }

    console.log('✅ Added system message\n');

    // Step 4: Retrieve the session and verify messages
    console.log('4️⃣  Retrieving session to verify messages...');
    const getResponse = await fetch(`${API_BASE_URL}/threads/${newSession.id}`);

    if (!getResponse.ok) {
      throw new Error(`Failed to retrieve session: ${await getResponse.text()}`);
    }

    const retrievedSession = await getResponse.json();
    console.log(`✅ Retrieved session with ${retrievedSession.messages.length} messages\n`);

    // Verify messages
    if (retrievedSession.messages.length !== 2) {
      throw new Error(`Expected 2 messages, but got ${retrievedSession.messages.length}`);
    }

    if (retrievedSession.messages[0].role !== 'user') {
      throw new Error(`Expected first message to be from user, but got ${retrievedSession.messages[0].role}`);
    }

    if (retrievedSession.messages[1].role !== 'system') {
      throw new Error(`Expected second message to be from system, but got ${retrievedSession.messages[1].role}`);
    }

    console.log('✅ All messages verified successfully!\n');
    console.log('📊 Test Results:');
    console.log(`   Session ID: ${retrievedSession.id}`);
    console.log(`   Title: ${retrievedSession.title}`);
    console.log(`   Messages: ${retrievedSession.messages.length}`);
    console.log(`   Message 1: ${retrievedSession.messages[0].role} - "${retrievedSession.messages[0].content}"`);
    console.log(`   Message 2: ${retrievedSession.messages[1].role} - "${retrievedSession.messages[1].content}"`);
    console.log('\n✅ TEST PASSED! Message storage is working correctly.\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED!');
    console.error(`   Error: ${error.message}\n`);
    process.exit(1);
  }
}

// Run the test
testMessageStorage();

