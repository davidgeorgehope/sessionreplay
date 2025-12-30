#!/usr/bin/env node
/**
 * Simple dev server for the demo app
 * Serves static files and injects OTLP configuration
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env file if not already loaded
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
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
  }
}
loadEnv();

const PORT = parseInt(process.env.PORT || '3000', 10);

// OTLP Configuration from environment
const config = {
  endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
    ? `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`
    : 'http://localhost:4318/v1/traces',
  apiKey: extractApiKey(process.env.OTEL_EXPORTER_OTLP_HEADERS),
  serviceName: extractServiceName(process.env.OTEL_RESOURCE_ATTRIBUTES) || 'demo-app',
  debug: true,
};

function extractApiKey(headers) {
  if (!headers) return undefined;
  // Parse "Authorization=ApiKey XXX" format
  const match = headers.match(/Authorization=ApiKey\s+([^\s,]+)/);
  return match ? match[1] : undefined;
}

function extractServiceName(attrs) {
  if (!attrs) return undefined;
  const match = attrs.match(/service\.name=([^,]+)/);
  return match ? match[1] : undefined;
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function serveFile(filePath, res) {
  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404);
        res.end('Not found');
      } else {
        res.writeHead(500);
        res.end('Server error');
      }
      return;
    }

    // Inject config into HTML
    if (ext === '.html') {
      const configScript = `<script>window.__SESSION_REPLAY_CONFIG__ = ${JSON.stringify(config)};</script>`;
      content = content.toString().replace('</head>', `${configScript}\n</head>`);
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  // CORS headers for OTLP
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let urlPath = req.url.split('?')[0];

  // Serve index.html for root
  if (urlPath === '/') {
    urlPath = '/index.html';
  }

  // Resolve file path
  let filePath;
  if (urlPath.startsWith('/packages/')) {
    // Serve from project root for package imports
    filePath = path.join(__dirname, '../..', urlPath);
  } else {
    filePath = path.join(__dirname, urlPath);
  }

  serveFile(filePath, res);
});

server.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('Session Replay Demo Server');
  console.log('='.repeat(60));
  console.log(`Server running at http://localhost:${PORT}`);
  console.log('');
  console.log('OTLP Configuration:');
  console.log(`  Endpoint: ${config.endpoint}`);
  console.log(`  Service:  ${config.serviceName}`);
  console.log(`  API Key:  ${config.apiKey ? '***' + config.apiKey.slice(-8) : '(none)'}`);
  console.log('='.repeat(60));
});
