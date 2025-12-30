#!/usr/bin/env node
/**
 * Start script that orchestrates the demo:
 * 1. Builds the browser-agent package
 * 2. Starts the demo server
 * 3. Optionally runs load tests
 *
 * Usage:
 *   node start.js              # Just start server
 *   node start.js --load       # Start server + run load tests
 *   node start.js --load-only  # Run load tests against existing server
 */

import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Load .env file
function loadEnv() {
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.slice(0, eqIndex);
          const value = trimmed.slice(eqIndex + 1);
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
    console.log('[Config] Loaded .env file');
  } else {
    console.log('[Config] No .env file found, using environment variables');
  }
}

loadEnv();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '../..');

const args = process.argv.slice(2);
const RUN_LOAD = args.includes('--load') || args.includes('-l');
const LOAD_ONLY = args.includes('--load-only');
const HEADLESS = !args.includes('--headed');

async function buildBrowserAgent() {
  console.log('\n[1/3] Building browser-agent...');
  try {
    execSync('pnpm run build', {
      cwd: path.join(PROJECT_ROOT, 'packages/browser-agent'),
      stdio: 'inherit',
    });
    console.log('[1/3] Build complete!\n');
  } catch (error) {
    console.error('[1/3] Build failed!');
    process.exit(1);
  }
}

function startServer() {
  return new Promise((resolve, reject) => {
    console.log('[2/3] Starting demo server...');

    const server = spawn('node', ['server.js'], {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    let started = false;

    server.stdout.on('data', (data) => {
      process.stdout.write(data);
      if (!started && data.toString().includes('Server running')) {
        started = true;
        // Give it a moment to be fully ready
        setTimeout(() => resolve(server), 500);
      }
    });

    server.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    server.on('error', reject);
    server.on('exit', (code) => {
      if (!started) {
        reject(new Error(`Server exited with code ${code}`));
      }
    });

    // Timeout if server doesn't start
    setTimeout(() => {
      if (!started) {
        server.kill();
        reject(new Error('Server startup timeout'));
      }
    }, 10000);
  });
}

async function runLoadTests() {
  console.log('\n[3/3] Running load tests...');

  return new Promise((resolve, reject) => {
    const loadTest = spawn('node', ['load-test.js'], {
      cwd: __dirname,
      stdio: 'inherit',
      env: {
        ...process.env,
        HEADLESS: HEADLESS.toString(),
        ITERATIONS: process.env.ITERATIONS || '3',
      },
    });

    loadTest.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Load test exited with code ${code}`));
      }
    });

    loadTest.on('error', reject);
  });
}

async function main() {
  console.log('='.repeat(60));
  console.log('Session Replay Demo Launcher');
  console.log('='.repeat(60));

  let server = null;

  try {
    if (!LOAD_ONLY) {
      // Step 1: Build
      await buildBrowserAgent();

      // Step 2: Start server
      server = await startServer();
    }

    if (RUN_LOAD || LOAD_ONLY) {
      // Ensure playwright is installed
      console.log('\nEnsuring Playwright is installed...');
      try {
        execSync('npx playwright install chromium', {
          cwd: __dirname,
          stdio: 'inherit',
        });
      } catch (e) {
        console.log('Playwright already installed or install skipped');
      }

      // Step 3: Run load tests
      await runLoadTests();

      // Kill server after tests if we started it
      if (server) {
        console.log('\nStopping server...');
        server.kill();
      }

      console.log('\nDone!');
      process.exit(0);
    } else {
      // Just keep server running
      console.log('\nServer is running. Press Ctrl+C to stop.');
      console.log('Run load tests with: node load-test.js\n');

      // Handle graceful shutdown
      process.on('SIGINT', () => {
        console.log('\nShutting down...');
        if (server) server.kill();
        process.exit(0);
      });
    }
  } catch (error) {
    console.error('\nError:', error.message);
    if (server) server.kill();
    process.exit(1);
  }
}

main();
