/**
 * Kibana Dashboard Definitions (By-Value Format)
 *
 * For Kibana Serverless, visualizations must be embedded inline (by-value)
 * rather than referenced as separate saved objects (by-reference).
 */

import type { SavedObject } from './client.js';
import { randomUUID } from 'crypto';

// Data view for OTLP logs
const DATA_VIEW_ID = 'logs-generic.otel-default';

// Helper to generate consistent UUIDs for layers/columns
function uuid(): string {
  return randomUUID();
}

// Panel builder helpers
interface LensPanel {
  type: 'lens';
  panelIndex: string;
  gridData: { x: number; y: number; w: number; h: number; i: string };
  embeddableConfig: {
    attributes: {
      title: string;
      type: 'lens';
      visualizationType: string;
      references: Array<{ id: string; name: string; type: string }>;
      state: {
        datasourceStates: {
          formBased: {
            layers: Record<string, unknown>;
          };
          indexpattern?: { layers: Record<string, unknown> };
          textBased?: { layers: Record<string, unknown> };
        };
        visualization: Record<string, unknown>;
        query: { language: string; query: string };
        filters: unknown[];
        internalReferences?: unknown[];
        adHocDataViews?: Record<string, unknown>;
      };
    };
    enhancements: Record<string, unknown>;
    hidePanelTitles?: boolean;
    title?: string;
  };
}

function createMetricPanel(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  sourceField: string,
  operationType: 'unique_count' | 'count',
  filter?: { query: string; language: string }
): LensPanel {
  const layerId = uuid();
  const colId = uuid();

  return {
    type: 'lens',
    panelIndex: id,
    gridData: { x, y, w, h, i: id },
    embeddableConfig: {
      attributes: {
        title: '',
        type: 'lens',
        visualizationType: 'lnsMetric',
        references: [
          { id: DATA_VIEW_ID, name: `indexpattern-datasource-layer-${layerId}`, type: 'index-pattern' },
        ],
        state: {
          adHocDataViews: {},
          datasourceStates: {
            formBased: {
              layers: {
                [layerId]: {
                  columnOrder: [colId],
                  columns: {
                    [colId]: {
                      dataType: 'number',
                      isBucketed: false,
                      label: title,
                      operationType,
                      scale: 'ratio',
                      sourceField,
                      params: { emptyAsNull: true },
                    },
                  },
                  ignoreGlobalFilters: false,
                  incompleteColumns: {},
                  sampling: 1,
                },
              },
            },
            indexpattern: { layers: {} },
            textBased: { layers: {} },
          },
          filters: filter
            ? [
                {
                  $state: { store: 'appState' },
                  meta: { alias: null, disabled: false, index: DATA_VIEW_ID, key: sourceField, negate: false, type: 'exists' },
                  query: { exists: { field: filter.query } },
                },
              ]
            : [],
          internalReferences: [],
          query: { language: 'kuery', query: '' },
          visualization: {
            layerId,
            layerType: 'data',
            metricAccessor: colId,
          },
        },
      },
      enhancements: {},
      hidePanelTitles: false,
      title,
    },
  };
}

function createTimeSeriesPanel(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  seriesType: 'line' | 'area' | 'area_stacked' | 'bar',
  valueField: string | null,
  valueOp: 'count' | 'unique_count',
  splitField?: string,
  filterQuery?: string
): LensPanel {
  const layerId = uuid();
  const timeColId = uuid();
  const valueColId = uuid();
  const splitColId = splitField ? uuid() : null;

  const columns: Record<string, unknown> = {
    [timeColId]: {
      dataType: 'date',
      isBucketed: true,
      label: '@timestamp',
      operationType: 'date_histogram',
      params: { interval: 'auto', includeEmptyRows: true },
      scale: 'interval',
      sourceField: '@timestamp',
    },
    [valueColId]: {
      dataType: 'number',
      isBucketed: false,
      label: valueOp === 'unique_count' ? 'Unique Count' : 'Count',
      operationType: valueOp,
      scale: 'ratio',
      sourceField: valueOp === 'unique_count' && valueField ? valueField : '@timestamp',
      params: { emptyAsNull: false },
    },
  };

  const columnOrder = [timeColId];
  if (splitColId && splitField) {
    columns[splitColId] = {
      dataType: 'string',
      isBucketed: true,
      label: splitField,
      operationType: 'terms',
      params: { size: 5, orderBy: { type: 'column', columnId: valueColId }, orderDirection: 'desc' },
      scale: 'ordinal',
      sourceField: splitField,
    };
    columnOrder.push(splitColId);
  }
  columnOrder.push(valueColId);

  return {
    type: 'lens',
    panelIndex: id,
    gridData: { x, y, w, h, i: id },
    embeddableConfig: {
      attributes: {
        title: '',
        type: 'lens',
        visualizationType: 'lnsXY',
        references: [
          { id: DATA_VIEW_ID, name: `indexpattern-datasource-layer-${layerId}`, type: 'index-pattern' },
        ],
        state: {
          adHocDataViews: {},
          datasourceStates: {
            formBased: {
              layers: {
                [layerId]: {
                  columnOrder,
                  columns,
                  ignoreGlobalFilters: false,
                  incompleteColumns: {},
                  sampling: 1,
                },
              },
            },
            indexpattern: { layers: {} },
            textBased: { layers: {} },
          },
          filters: [],
          internalReferences: [],
          query: { language: 'kuery', query: filterQuery || '' },
          visualization: {
            axisTitlesVisibilitySettings: { x: true, yLeft: true, yRight: true },
            layers: [
              {
                accessors: [valueColId],
                layerId,
                layerType: 'data',
                seriesType,
                ...(splitColId ? { splitAccessor: splitColId } : {}),
                xAccessor: timeColId,
              },
            ],
            legend: { isVisible: !!splitField, position: 'right', legendSize: 'auto' },
            preferredSeriesType: seriesType,
            valueLabels: 'hide',
          },
        },
      },
      enhancements: {},
      hidePanelTitles: false,
      title,
    },
  };
}

function createBarPanel(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  groupByField: string,
  valueOp: 'count' | 'unique_count',
  valueField?: string,
  filterQuery?: string,
  horizontal = true
): LensPanel {
  const layerId = uuid();
  const groupColId = uuid();
  const valueColId = uuid();

  return {
    type: 'lens',
    panelIndex: id,
    gridData: { x, y, w, h, i: id },
    embeddableConfig: {
      attributes: {
        title: '',
        type: 'lens',
        visualizationType: 'lnsXY',
        references: [
          { id: DATA_VIEW_ID, name: `indexpattern-datasource-layer-${layerId}`, type: 'index-pattern' },
        ],
        state: {
          adHocDataViews: {},
          datasourceStates: {
            formBased: {
              layers: {
                [layerId]: {
                  columnOrder: [groupColId, valueColId],
                  columns: {
                    [groupColId]: {
                      dataType: 'string',
                      isBucketed: true,
                      label: groupByField,
                      operationType: 'terms',
                      params: { size: 10, orderBy: { type: 'column', columnId: valueColId }, orderDirection: 'desc' },
                      scale: 'ordinal',
                      sourceField: groupByField,
                    },
                    [valueColId]: {
                      dataType: 'number',
                      isBucketed: false,
                      label: valueOp === 'unique_count' ? 'Unique Count' : 'Count',
                      operationType: valueOp,
                      scale: 'ratio',
                      sourceField: valueOp === 'unique_count' && valueField ? valueField : '@timestamp',
                      params: { emptyAsNull: false },
                    },
                  },
                  ignoreGlobalFilters: false,
                  incompleteColumns: {},
                  sampling: 1,
                },
              },
            },
            indexpattern: { layers: {} },
            textBased: { layers: {} },
          },
          filters: [],
          internalReferences: [],
          query: { language: 'kuery', query: filterQuery || '' },
          visualization: {
            axisTitlesVisibilitySettings: { x: true, yLeft: true, yRight: true },
            layers: [
              {
                accessors: [valueColId],
                layerId,
                layerType: 'data',
                seriesType: horizontal ? 'bar_horizontal' : 'bar',
                xAccessor: groupColId,
              },
            ],
            legend: { isVisible: false, position: 'right', legendSize: 'auto' },
            preferredSeriesType: horizontal ? 'bar_horizontal' : 'bar',
            valueLabels: 'show',
          },
        },
      },
      enhancements: {},
      hidePanelTitles: false,
      title,
    },
  };
}

function createPiePanel(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  groupByField: string,
  filterQuery?: string
): LensPanel {
  const layerId = uuid();
  const groupColId = uuid();
  const valueColId = uuid();

  return {
    type: 'lens',
    panelIndex: id,
    gridData: { x, y, w, h, i: id },
    embeddableConfig: {
      attributes: {
        title: '',
        type: 'lens',
        visualizationType: 'lnsPie',
        references: [
          { id: DATA_VIEW_ID, name: `indexpattern-datasource-layer-${layerId}`, type: 'index-pattern' },
        ],
        state: {
          adHocDataViews: {},
          datasourceStates: {
            formBased: {
              layers: {
                [layerId]: {
                  columnOrder: [groupColId, valueColId],
                  columns: {
                    [groupColId]: {
                      dataType: 'string',
                      isBucketed: true,
                      label: groupByField,
                      operationType: 'terms',
                      params: { size: 10, orderBy: { type: 'column', columnId: valueColId }, orderDirection: 'desc' },
                      scale: 'ordinal',
                      sourceField: groupByField,
                    },
                    [valueColId]: {
                      dataType: 'number',
                      isBucketed: false,
                      label: 'Count',
                      operationType: 'count',
                      scale: 'ratio',
                      sourceField: '@timestamp',
                      params: { emptyAsNull: false },
                    },
                  },
                  ignoreGlobalFilters: false,
                  incompleteColumns: {},
                  sampling: 1,
                },
              },
            },
            indexpattern: { layers: {} },
            textBased: { layers: {} },
          },
          filters: [],
          internalReferences: [],
          query: { language: 'kuery', query: filterQuery || '' },
          visualization: {
            layers: [
              {
                categoryDisplay: 'default',
                layerId,
                layerType: 'data',
                legendDisplay: 'show',
                legendSize: 'auto',
                metrics: [valueColId],
                nestedLegend: false,
                numberDisplay: 'percent',
                primaryGroups: [groupColId],
              },
            ],
            shape: 'donut',
          },
        },
      },
      enhancements: {},
      hidePanelTitles: false,
      title,
    },
  };
}

function createTablePanel(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string
): LensPanel {
  const layerId = uuid();
  const sessionColId = uuid();
  const userColId = uuid();
  const eventsColId = uuid();
  const pageColId = uuid();

  return {
    type: 'lens',
    panelIndex: id,
    gridData: { x, y, w, h, i: id },
    embeddableConfig: {
      attributes: {
        title: '',
        type: 'lens',
        visualizationType: 'lnsDatatable',
        references: [
          { id: DATA_VIEW_ID, name: `indexpattern-datasource-layer-${layerId}`, type: 'index-pattern' },
        ],
        state: {
          adHocDataViews: {},
          datasourceStates: {
            formBased: {
              layers: {
                [layerId]: {
                  columnOrder: [sessionColId, userColId, eventsColId, pageColId],
                  columns: {
                    [sessionColId]: {
                      dataType: 'string',
                      isBucketed: true,
                      label: 'Session ID',
                      operationType: 'terms',
                      params: { size: 20, orderBy: { type: 'column', columnId: eventsColId }, orderDirection: 'desc' },
                      scale: 'ordinal',
                      sourceField: 'attributes.session.id',
                    },
                    [userColId]: {
                      dataType: 'string',
                      isBucketed: true,
                      label: 'User',
                      operationType: 'terms',
                      params: { size: 1, orderBy: { type: 'column', columnId: eventsColId }, orderDirection: 'desc' },
                      scale: 'ordinal',
                      sourceField: 'attributes.user.name',
                    },
                    [eventsColId]: {
                      dataType: 'number',
                      isBucketed: false,
                      label: 'Events',
                      operationType: 'count',
                      scale: 'ratio',
                      sourceField: '@timestamp',
                      params: { emptyAsNull: false },
                    },
                    [pageColId]: {
                      dataType: 'string',
                      isBucketed: true,
                      label: 'Last Page',
                      operationType: 'terms',
                      params: { size: 1, orderBy: { type: 'column', columnId: eventsColId }, orderDirection: 'desc' },
                      scale: 'ordinal',
                      sourceField: 'attributes.page.url',
                    },
                  },
                  ignoreGlobalFilters: false,
                  incompleteColumns: {},
                  sampling: 1,
                },
              },
            },
            indexpattern: { layers: {} },
            textBased: { layers: {} },
          },
          filters: [],
          internalReferences: [],
          query: { language: 'kuery', query: '' },
          visualization: {
            columns: [
              { columnId: sessionColId, isTransposed: false },
              { columnId: userColId, isTransposed: false },
              { columnId: eventsColId, isTransposed: false },
              { columnId: pageColId, isTransposed: false },
            ],
            layerId,
            layerType: 'data',
            rowHeight: 'custom',
            rowHeightLines: 1,
          },
        },
      },
      enhancements: {},
      hidePanelTitles: false,
      title,
    },
  };
}

export function getSessionReplayDashboard(): SavedObject {
  // Generate panel IDs
  const ids = {
    totalSessions: uuid(),
    frustratedSessions: uuid(),
    sessionsOverTime: uuid(),
    eventsOverTime: uuid(),
    frustrationOverTime: uuid(),
    frustrationByType: uuid(),
    rageClickHotspots: uuid(),
    pageFlow: uuid(),
    topFrustratedUsers: uuid(),
    topFrustrationPages: uuid(),
    sessionExplorer: uuid(),
    errorsByPage: uuid(),
    userControl: uuid(),
  };

  const panels: unknown[] = [
    // Row 0: Metrics
    createMetricPanel(ids.totalSessions, 0, 0, 8, 4, 'Total Sessions', 'attributes.session.id', 'unique_count'),
    createMetricPanel(ids.frustratedSessions, 8, 0, 8, 4, 'Frustrated Sessions', 'attributes.session.id', 'unique_count', { query: 'attributes.frustration.type', language: 'kuery' }),

    // Row 1: Time series
    createTimeSeriesPanel(ids.sessionsOverTime, 0, 4, 24, 10, 'Active Sessions', 'area', 'attributes.session.id', 'unique_count'),
    createTimeSeriesPanel(ids.eventsOverTime, 24, 4, 24, 10, 'Events by Category', 'area_stacked', null, 'count', 'attributes.event.category'),

    // Row 2: Frustration analysis
    createTimeSeriesPanel(ids.frustrationOverTime, 0, 14, 24, 10, 'Frustration Over Time', 'line', null, 'count', 'attributes.frustration.type', 'attributes.frustration.type: *'),
    createPiePanel(ids.frustrationByType, 24, 14, 24, 10, 'Frustration by Type', 'attributes.frustration.type', 'attributes.frustration.type: *'),

    // Row 3: Hotspots & Funnel
    createBarPanel(ids.rageClickHotspots, 0, 24, 24, 10, 'Rage Click Hotspots', 'attributes.target.semantic_name', 'count', undefined, 'attributes.frustration.type: rage_click'),
    createBarPanel(ids.pageFlow, 24, 24, 24, 10, 'Session Funnel (by Page)', 'attributes.page.url', 'unique_count', 'attributes.session.id', 'attributes.event.category: user.navigation'),

    // Row 4: Users and pages
    createBarPanel(ids.topFrustratedUsers, 0, 34, 24, 10, 'Top Frustrated Users', 'attributes.user.id', 'count', undefined, 'attributes.frustration.type: *'),
    createBarPanel(ids.topFrustrationPages, 24, 34, 24, 10, 'Top Frustration Pages', 'attributes.page.url', 'count', undefined, 'attributes.frustration.type: *'),

    // Row 5: Session explorer
    createTablePanel(ids.sessionExplorer, 0, 44, 48, 14, 'Session Explorer'),

    // Row 6: Errors
    createBarPanel(ids.errorsByPage, 0, 58, 48, 10, 'Errors by Page', 'attributes.page.url', 'count', undefined, 'attributes.event.category: user.error', false),
  ];

  // Control group for user filter
  const controlPanels = {
    [ids.userControl]: {
      grow: false,
      order: 0,
      type: 'optionsListControl',
      width: 'medium',
      explicitInput: {
        id: ids.userControl,
        dataViewId: DATA_VIEW_ID,
        fieldName: 'attributes.user.id',
        title: 'User',
        exclude: false,
        existsSelected: false,
        selectedOptions: [],
        searchTechnique: 'prefix',
        sort: { by: '_count', direction: 'desc' },
      },
    },
  };

  // Generate dashboard-level references from panel references
  const dashboardReferences: Array<{ id: string; name: string; type: string }> = [];
  for (const panel of panels as LensPanel[]) {
    const panelRefs = panel.embeddableConfig.attributes.references;
    for (const ref of panelRefs) {
      dashboardReferences.push({
        id: ref.id,
        name: `${panel.panelIndex}:${ref.name}`,
        type: ref.type,
      });
    }
  }

  return {
    type: 'dashboard',
    id: 'session-replay-dashboard',
    attributes: {
      title: 'Session Replay - User Frustration',
      description: 'Dashboard for monitoring user frustration signals from session replay',
      panelsJSON: JSON.stringify(panels),
      optionsJSON: JSON.stringify({
        useMargins: true,
        syncColors: false,
        syncCursor: true,
        syncTooltips: false,
        hidePanelTitles: false,
      }),
      controlGroupInput: {
        chainingSystem: 'HIERARCHICAL',
        controlStyle: 'oneLine',
        ignoreParentSettingsJSON: JSON.stringify({
          ignoreFilters: false,
          ignoreQuery: false,
          ignoreTimerange: false,
          ignoreValidations: false,
        }),
        panelsJSON: JSON.stringify(controlPanels),
        showApplySelections: false,
      },
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
    references: dashboardReferences,
    coreMigrationVersion: '8.8.0',
    typeMigrationVersion: '10.3.0',
    managed: false,
  };
}
