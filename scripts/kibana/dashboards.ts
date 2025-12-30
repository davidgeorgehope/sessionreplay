/**
 * Kibana Dashboard Definitions
 *
 * Defines the main dashboard for session replay data
 */

import type { SavedObject } from './client.js';

export function getSessionReplayDashboard(): SavedObject {
  return {
    type: 'dashboard',
    id: 'session-replay-dashboard',
    attributes: {
      title: 'Session Replay - User Frustration',
      description: 'Dashboard for monitoring user frustration signals from session replay (OTLP Logs)',
      panelsJSON: JSON.stringify([
        // Row 1: Session activity and events over time
        {
          version: '8.11.0',
          type: 'lens',
          gridData: { x: 0, y: 0, w: 24, h: 12, i: '1' },
          panelIndex: '1',
          embeddableConfig: {},
          panelRefName: 'panel_1',
        },
        {
          version: '8.11.0',
          type: 'lens',
          gridData: { x: 24, y: 0, w: 24, h: 12, i: '2' },
          panelIndex: '2',
          embeddableConfig: {},
          panelRefName: 'panel_2',
        },
        // Row 2: Frustration over time and by type
        {
          version: '8.11.0',
          type: 'lens',
          gridData: { x: 0, y: 12, w: 24, h: 12, i: '3' },
          panelIndex: '3',
          embeddableConfig: {},
          panelRefName: 'panel_3',
        },
        {
          version: '8.11.0',
          type: 'lens',
          gridData: { x: 24, y: 12, w: 24, h: 12, i: '4' },
          panelIndex: '4',
          embeddableConfig: {},
          panelRefName: 'panel_4',
        },
        // Row 3: Frustrated users and top frustration pages
        {
          version: '8.11.0',
          type: 'lens',
          gridData: { x: 0, y: 24, w: 24, h: 12, i: '5' },
          panelIndex: '5',
          embeddableConfig: {},
          panelRefName: 'panel_5',
        },
        {
          version: '8.11.0',
          type: 'lens',
          gridData: { x: 24, y: 24, w: 24, h: 12, i: '6' },
          panelIndex: '6',
          embeddableConfig: {},
          panelRefName: 'panel_6',
        },
        // Row 4: Errors
        {
          version: '8.11.0',
          type: 'lens',
          gridData: { x: 0, y: 36, w: 48, h: 12, i: '7' },
          panelIndex: '7',
          embeddableConfig: {},
          panelRefName: 'panel_7',
        },
      ]),
      optionsJSON: JSON.stringify({
        useMargins: true,
        syncColors: false,
        syncCursor: true,
        syncTooltips: false,
        hidePanelTitles: false,
      }),
      timeRestore: true,
      timeTo: 'now',
      timeFrom: 'now-24h',
      refreshInterval: {
        pause: false,
        value: 30000,
      },
      kibanaSavedObjectMeta: {
        searchSourceJSON: JSON.stringify({
          query: { query: '', language: 'kuery' },
          filter: [],
        }),
      },
    },
    references: [
      {
        name: 'panel_1',
        type: 'lens',
        id: 'session-replay-session-activity',
      },
      {
        name: 'panel_2',
        type: 'lens',
        id: 'session-replay-navigation',
      },
      {
        name: 'panel_3',
        type: 'lens',
        id: 'session-replay-frustration-over-time',
      },
      {
        name: 'panel_4',
        type: 'lens',
        id: 'session-replay-frustration-by-type',
      },
      {
        name: 'panel_5',
        type: 'lens',
        id: 'session-replay-frustrated-users',
      },
      {
        name: 'panel_6',
        type: 'lens',
        id: 'session-replay-top-frustration-pages',
      },
      {
        name: 'panel_7',
        type: 'lens',
        id: 'session-replay-errors',
      },
    ],
  };
}
