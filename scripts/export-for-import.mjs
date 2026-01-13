#!/usr/bin/env node
/**
 * Export dashboard as NDJSON for Kibana import
 *
 * For Kibana Serverless, we use by-value embeddables - all visualizations
 * are embedded inline in the dashboard, no separate saved objects needed.
 */
import { getSessionReplayDashboard } from './kibana/dashboards.js';

const dashboard = getSessionReplayDashboard();
console.log(JSON.stringify(dashboard));
