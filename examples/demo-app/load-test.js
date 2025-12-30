#!/usr/bin/env node
/**
 * Automated load testing script using Playwright
 * Simulates various user interactions to generate telemetry data
 */

import { chromium } from 'playwright';

const BASE_URL = process.env.DEMO_URL || 'http://localhost:3000';
const ITERATIONS = parseInt(process.env.ITERATIONS || '5', 10);
const HEADLESS = process.env.HEADLESS !== 'false';

// Pool of test users for rotation
const TEST_USERS = [
  { id: 'alice', email: 'alice@example.com', name: 'Alice Smith' },
  { id: 'bob', email: 'bob@example.com', name: 'Bob Johnson' },
  { id: 'carol', email: 'carol@example.com', name: 'Carol Williams' },
  { id: 'david', email: 'david.hope@example.com', name: 'David Hope' },
  { id: 'eve', email: 'eve@example.com', name: 'Eve Davis' },
  { id: 'frank', email: 'frank@example.com', name: 'Frank Miller' },
  { id: 'grace', email: 'grace@example.com', name: 'Grace Lee' },
  { id: 'henry', email: 'henry@example.com', name: 'Henry Wilson' },
];

async function runSession(browser, sessionNum) {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Pick a user for this session (round-robin through the pool)
  const user = TEST_USERS[(sessionNum - 1) % TEST_USERS.length];

  console.log(`\n[Session ${sessionNum}] Starting as ${user.name} (${user.id})...`);

  // Set up dialog handler once at the start
  page.on('dialog', async (dialog) => {
    await dialog.dismiss().catch(() => {});
  });

  // Capture page errors (uncaught exceptions)
  page.on('pageerror', (error) => {
    console.log(`  [PAGE ERROR] ${error.message}`);
  });

  // Capture ALL console messages for debugging
  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();
    // Log errors and warnings always, plus SessionReplay messages
    if (type === 'error' || type === 'warning' || text.includes('SessionReplay') || text.includes('OTLP') || text.includes('Error')) {
      console.log(`  [Browser ${type}] ${text}`);
    }
  });

  // Capture network failures
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (url.includes('v1/logs') || url.includes('v1/traces')) {
      console.log(`  [Network FAIL] ${url}: ${request.failure()?.errorText}`);
    }
  });

  // Capture network responses for OTLP
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('v1/logs') || url.includes('v1/traces')) {
      const status = response.status();
      console.log(`  [Network ${status}] ${url.includes('logs') ? 'LOGS' : 'TRACES'} -> ${status}`);
    }
  });

  try {
    // Inject user before page loads
    await page.addInitScript((userData) => {
      window.__SESSION_REPLAY_USER__ = userData;
    }, user);

    // Navigate to demo app
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    console.log(`[Session ${sessionNum}] Page loaded as ${user.id}`);

    // Test 1: Click tracking
    console.log(`[Session ${sessionNum}] Testing click tracking...`);
    await page.click('#btn-add-cart');
    await page.waitForTimeout(200);
    await page.click('#btn-wishlist');
    await page.waitForTimeout(200);
    await page.click('#btn-buy-now');
    await page.waitForTimeout(500);  // Wait for parent-child spans to complete

    // Test 2: Navigation
    console.log(`[Session ${sessionNum}] Testing navigation...`);
    await page.click('a[href="#products"]');
    await page.waitForTimeout(200);
    await page.click('a[href="#cart"]');
    await page.waitForTimeout(200);
    await page.click('a[href="#checkout"]');
    await page.waitForTimeout(300);

    // Test 3: Form interactions
    console.log(`[Session ${sessionNum}] Testing form behavior...`);
    await page.fill('#email', `user${sessionNum}@example.com`);
    await page.waitForTimeout(100);
    await page.fill('#card-number', '4242424242424242');
    await page.waitForTimeout(100);
    await page.selectOption('#shipping', 'express');
    await page.waitForTimeout(100);
    await page.fill('#notes', `Test order from session ${sessionNum}`);
    await page.waitForTimeout(200);

    // Test 4: Rage clicks (simulate frustrated user)
    console.log(`[Session ${sessionNum}] Testing rage click detection...`);
    for (let i = 0; i < 6; i++) {
      await page.click('#btn-slow-action', { delay: 50 });
    }
    await page.waitForTimeout(500);

    // Test 5: Dead clicks
    console.log(`[Session ${sessionNum}] Testing dead click detection...`);
    await page.click('#dead-click-area');
    await page.waitForTimeout(300);
    await page.click('#dead-click-area');
    await page.waitForTimeout(300);

    // Test 6: Thrashing (rapid scroll direction changes)
    console.log(`[Session ${sessionNum}] Testing thrashing detection...`);
    const scrollArea = await page.$('#scroll-area');
    if (scrollArea) {
      for (let i = 0; i < 8; i++) {
        await scrollArea.evaluate((el, direction) => {
          el.scrollTop = direction === 'down' ? el.scrollHeight : 0;
        }, i % 2 === 0 ? 'down' : 'up');
        await page.waitForTimeout(100);
      }
    }
    await page.waitForTimeout(500);

    // Test 7: Error simulation (randomly)
    if (sessionNum % 2 === 0) {
      console.log(`[Session ${sessionNum}] Simulating errors...`);
      await page.click('#btn-js-error').catch(() => {}); // Ignore error
      await page.waitForTimeout(300);
    }

    // Test 8: Form submission
    console.log(`[Session ${sessionNum}] Submitting form...`);
    await page.click('#btn-submit-order');
    await page.waitForTimeout(500);

    console.log(`[Session ${sessionNum}] Completed successfully`);

  } catch (error) {
    console.error(`[Session ${sessionNum}] Error:`, error.message);
  } finally {
    await context.close();
  }
}

async function runLoadTest() {
  console.log('='.repeat(60));
  console.log('Session Replay Load Test');
  console.log('='.repeat(60));
  console.log(`URL: ${BASE_URL}`);
  console.log(`Iterations: ${ITERATIONS}`);
  console.log(`Headless: ${HEADLESS}`);
  console.log('='.repeat(60));

  const browser = await chromium.launch({ headless: HEADLESS });

  try {
    // Run sessions sequentially for clearer output
    for (let i = 1; i <= ITERATIONS; i++) {
      await runSession(browser, i);
      // Small delay between sessions
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n' + '='.repeat(60));
    console.log(`Load test completed: ${ITERATIONS} sessions`);
    console.log('='.repeat(60));

  } finally {
    await browser.close();
  }
}

// Run concurrent sessions for higher load
async function runConcurrentLoadTest() {
  const CONCURRENT = parseInt(process.env.CONCURRENT || '3', 10);

  console.log('='.repeat(60));
  console.log('Session Replay Concurrent Load Test');
  console.log('='.repeat(60));
  console.log(`URL: ${BASE_URL}`);
  console.log(`Total Sessions: ${ITERATIONS}`);
  console.log(`Concurrent: ${CONCURRENT}`);
  console.log(`Headless: ${HEADLESS}`);
  console.log('='.repeat(60));

  const browser = await chromium.launch({ headless: HEADLESS });

  try {
    const sessions = [];
    let completed = 0;

    for (let i = 1; i <= ITERATIONS; i++) {
      sessions.push(
        runSession(browser, i).then(() => {
          completed++;
          console.log(`Progress: ${completed}/${ITERATIONS}`);
        })
      );

      // Limit concurrency
      if (sessions.length >= CONCURRENT) {
        await Promise.race(sessions);
        // Remove completed promises
        sessions.splice(0, sessions.findIndex(p => p) + 1);
      }
    }

    // Wait for remaining sessions
    await Promise.all(sessions);

    console.log('\n' + '='.repeat(60));
    console.log(`Load test completed: ${ITERATIONS} sessions`);
    console.log('='.repeat(60));

  } finally {
    await browser.close();
  }
}

// Check for concurrent mode
if (process.env.CONCURRENT) {
  runConcurrentLoadTest().catch(console.error);
} else {
  runLoadTest().catch(console.error);
}
