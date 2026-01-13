#!/usr/bin/env node
/**
 * Cohort-based load testing script using Playwright
 *
 * Simulates different user behavior patterns to create realistic funnel data:
 * - Happy path users who complete the purchase
 * - Users who rage-click and drop off at cart
 * - Users who dead-click and get confused
 * - Users who encounter errors
 * - Users who thrash around looking for something
 *
 * This creates funnel drop-off patterns that demonstrate root cause analysis.
 */

import { chromium } from 'playwright';

const BASE_URL = process.env.DEMO_URL || 'http://localhost:3000';
const SESSIONS = parseInt(process.env.SESSIONS || '20', 10);
const HEADLESS = process.env.HEADLESS !== 'false';

/**
 * User behavior cohorts - each defines a distinct user journey pattern
 *
 * The distribution creates a realistic funnel:
 * - 25% complete successfully (happy path)
 * - 20% drop at cart with rage clicks (slow button)
 * - 15% drop at products with dead clicks (confusing UI)
 * - 20% drop at checkout with errors
 * - 10% drop at checkout with thrashing (can't find promo code)
 * - 10% drop at cart without frustration (sticker shock)
 */
const BEHAVIOR_COHORTS = [
  // Happy path - completes purchase (25%)
  {
    id: 'happy_path',
    weight: 25,
    users: [
      { id: 'alice', email: 'alice@example.com', name: 'Alice Johnson' },
      { id: 'henry', email: 'henry@example.com', name: 'Henry Wilson' },
    ],
    behavior: {
      completes: true,
      visitPages: ['home', 'products', 'cart', 'checkout'],
      frustration: null,
    },
  },

  // Rage clickers at cart - button seems broken (20%)
  {
    id: 'rage_click_cart',
    weight: 20,
    users: [
      { id: 'bob', email: 'bob@example.com', name: 'Bob Smith' },
      { id: 'frank', email: 'frank@example.com', name: 'Frank Miller' },
    ],
    behavior: {
      completes: false,
      visitPages: ['home', 'products', 'cart'],
      dropOffAt: 'cart',
      frustration: {
        type: 'rage_click',
        element: '#btn-add-cart',
        clicks: 6,
        page: 'cart',
      },
    },
  },

  // Dead clickers - confused by UI (15%)
  {
    id: 'dead_click_confused',
    weight: 15,
    users: [
      { id: 'carol', email: 'carol@example.com', name: 'Carol Williams' },
    ],
    behavior: {
      completes: false,
      visitPages: ['home', 'products'],
      dropOffAt: 'products',
      frustration: {
        type: 'dead_click',
        element: '#dead-click-area',
        clicks: 3,
        page: 'products',
      },
    },
  },

  // Error victims - JS error breaks the page (20%)
  {
    id: 'error_victim',
    weight: 20,
    users: [
      { id: 'david', email: 'david@example.com', name: 'David Brown' },
      { id: 'eve', email: 'eve@example.com', name: 'Eve Davis' },
    ],
    behavior: {
      completes: false,
      visitPages: ['home', 'products', 'cart', 'checkout'],
      dropOffAt: 'checkout',
      frustration: {
        type: 'error',
        page: 'checkout',
      },
    },
  },

  // Thrashers - can't find what they need (10%)
  {
    id: 'thrasher',
    weight: 10,
    users: [
      { id: 'grace', email: 'grace@example.com', name: 'Grace Lee' },
    ],
    behavior: {
      completes: false,
      visitPages: ['home', 'products', 'cart', 'checkout'],
      dropOffAt: 'checkout',
      frustration: {
        type: 'thrashing',
        scrollChanges: 8,
        page: 'checkout',
      },
    },
  },

  // Silent abandoners - no frustration signal, just leave (10%)
  {
    id: 'silent_abandon',
    weight: 10,
    users: [
      { id: 'ivan', email: 'ivan@example.com', name: 'Ivan Petrov' },
    ],
    behavior: {
      completes: false,
      visitPages: ['home', 'products', 'cart'],
      dropOffAt: 'cart',
      frustration: null, // Sticker shock - they just leave
    },
  },
];

/**
 * Select a cohort based on weighted random distribution
 */
function selectCohort() {
  const totalWeight = BEHAVIOR_COHORTS.reduce((sum, c) => sum + c.weight, 0);
  let random = Math.random() * totalWeight;

  for (const cohort of BEHAVIOR_COHORTS) {
    random -= cohort.weight;
    if (random <= 0) {
      return cohort;
    }
  }
  return BEHAVIOR_COHORTS[0];
}

/**
 * Run a single user session with cohort-defined behavior
 */
async function runSession(browser, sessionNum) {
  const context = await browser.newContext();
  const page = await context.newPage();

  // Select cohort and user
  const cohort = selectCohort();
  const user = cohort.users[sessionNum % cohort.users.length];
  const behavior = cohort.behavior;

  console.log(`\n[Session ${sessionNum}] ${cohort.id}: ${user.name}`);
  console.log(`  Journey: ${behavior.visitPages.join(' -> ')}${behavior.completes ? ' -> PURCHASE' : ` -> DROP @ ${behavior.dropOffAt}`}`);

  // Set up event listeners
  page.on('dialog', async (dialog) => {
    await dialog.dismiss().catch(() => {});
  });

  page.on('pageerror', (error) => {
    console.log(`  [PAGE ERROR] ${error.message}`);
  });

  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();
    if (text.includes('frustration') || text.includes('rage') || text.includes('dead')) {
      console.log(`  [Frustration] ${text}`);
    }
  });

  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('v1/logs') || url.includes('v1/traces')) {
      const status = response.status();
      if (status !== 200) {
        console.log(`  [Network ${status}] ${url.includes('logs') ? 'LOGS' : 'TRACES'}`);
      }
    }
  });

  try {
    // Inject user before page loads
    await page.addInitScript((userData) => {
      window.__SESSION_REPLAY_USER__ = userData;
    }, user);

    // Navigate to demo app (home page)
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Execute the user journey based on cohort behavior
    for (const pageName of behavior.visitPages) {
      // Navigate to page first
      await navigateToPage(page, pageName);
      await page.waitForTimeout(300 + Math.random() * 200);

      // Check if this is where we drop off
      if (!behavior.completes && pageName === behavior.dropOffAt) {
        // Execute frustration behavior ON the drop-off page
        if (behavior.frustration) {
          await executeFrustration(page, behavior.frustration, sessionNum);
        }
        console.log(`  [DROP OFF] at ${pageName}`);
        break;
      }

      // Do normal interactions on this page
      await interactWithPage(page, pageName, sessionNum);
    }

    // Complete purchase if happy path
    if (behavior.completes) {
      await completePurchase(page, sessionNum);
      console.log(`  [SUCCESS] Purchase completed`);
    }

  } catch (error) {
    console.error(`  [ERROR] ${error.message}`);
  } finally {
    await context.close();
  }
}

/**
 * Navigate to a specific page in the demo app
 */
async function navigateToPage(page, pageName) {
  const navMap = {
    home: 'a[href="#home"]',
    products: 'a[href="#products"]',
    cart: 'a[href="#cart"]',
    checkout: 'a[href="#checkout"]',
  };

  if (navMap[pageName]) {
    await page.click(navMap[pageName]).catch(() => {});
    await page.waitForTimeout(200);
  }
}

/**
 * Perform normal interactions on a page
 */
async function interactWithPage(page, pageName, sessionNum) {
  switch (pageName) {
    case 'products':
      // Browse products
      await page.click('#btn-add-cart').catch(() => {});
      await page.waitForTimeout(150);
      await page.click('#btn-wishlist').catch(() => {});
      break;

    case 'cart':
      // Review cart
      await page.click('#btn-add-cart').catch(() => {});
      await page.waitForTimeout(200);
      break;

    case 'checkout':
      // Fill form
      await page.fill('#email', `user${sessionNum}@example.com`).catch(() => {});
      await page.waitForTimeout(100);
      await page.fill('#card-number', '4242424242424242').catch(() => {});
      await page.waitForTimeout(100);
      await page.selectOption('#shipping', 'express').catch(() => {});
      break;
  }
}

/**
 * Execute frustration behavior based on cohort definition
 */
async function executeFrustration(page, frustration, sessionNum) {
  console.log(`  [Frustrating] ${frustration.type} on ${frustration.element || frustration.page}`);

  switch (frustration.type) {
    case 'rage_click':
      // Rapid clicks on element
      for (let i = 0; i < frustration.clicks; i++) {
        await page.click(frustration.element, { delay: 50 }).catch(() => {});
      }
      await page.waitForTimeout(300);
      break;

    case 'dead_click':
      // Click on non-interactive element multiple times
      for (let i = 0; i < frustration.clicks; i++) {
        await page.click(frustration.element).catch(() => {});
        await page.waitForTimeout(200);
      }
      break;

    case 'error':
      // Trigger a JavaScript error
      await page.click('#btn-js-error').catch(() => {});
      await page.waitForTimeout(300);
      break;

    case 'thrashing':
      // Rapid scroll direction changes on window (ThrashingDetector listens to window)
      for (let i = 0; i < frustration.scrollChanges; i++) {
        await page.evaluate((direction) => {
          window.scrollTo(0, direction === 'down' ? document.body.scrollHeight : 0);
        }, i % 2 === 0 ? 'down' : 'up');
        await page.waitForTimeout(100);
      }
      await page.waitForTimeout(300);
      break;
  }
}

/**
 * Complete the purchase flow
 */
async function completePurchase(page, sessionNum) {
  // Ensure we're on checkout
  await navigateToPage(page, 'checkout');

  // Fill form if not already filled
  await page.fill('#email', `happy${sessionNum}@example.com`).catch(() => {});
  await page.fill('#card-number', '4242424242424242').catch(() => {});
  await page.selectOption('#shipping', 'express').catch(() => {});
  await page.fill('#notes', `Completed order #${sessionNum}`).catch(() => {});

  // Submit
  await page.click('#btn-submit-order').catch(() => {});
  await page.waitForTimeout(500);
}

/**
 * Main load test runner
 */
async function runLoadTest() {
  console.log('='.repeat(70));
  console.log('Session Replay - Cohort-Based Load Test');
  console.log('='.repeat(70));
  console.log(`URL: ${BASE_URL}`);
  console.log(`Sessions: ${SESSIONS}`);
  console.log(`Headless: ${HEADLESS}`);
  console.log('');
  console.log('Behavior Cohorts:');
  for (const cohort of BEHAVIOR_COHORTS) {
    const outcome = cohort.behavior.completes
      ? 'completes purchase'
      : `drops at ${cohort.behavior.dropOffAt}`;
    const frustration = cohort.behavior.frustration
      ? ` with ${cohort.behavior.frustration.type}`
      : '';
    console.log(`  ${cohort.weight}% - ${cohort.id}: ${outcome}${frustration}`);
  }
  console.log('='.repeat(70));

  const browser = await chromium.launch({ headless: HEADLESS });

  // Track cohort distribution
  const cohortCounts = {};

  try {
    for (let i = 1; i <= SESSIONS; i++) {
      await runSession(browser, i);
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log('\n' + '='.repeat(70));
    console.log(`Load test completed: ${SESSIONS} sessions`);
    console.log('');
    console.log('Expected funnel (approximate):');
    console.log(`  Home:     ${SESSIONS} sessions`);
    console.log(`  Products: ~${Math.round(SESSIONS * 0.9)} sessions (10% never leave home)`);
    console.log(`  Cart:     ~${Math.round(SESSIONS * 0.65)} sessions (25% drop at products)`);
    console.log(`  Checkout: ~${Math.round(SESSIONS * 0.45)} sessions (30% drop at cart)`);
    console.log(`  Purchase: ~${Math.round(SESSIONS * 0.25)} sessions (25% complete)`);
    console.log('='.repeat(70));

  } finally {
    await browser.close();
  }
}

runLoadTest().catch(console.error);
