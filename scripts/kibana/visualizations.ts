/**
 * Kibana Visualization Definitions
 *
 * Defines visualizations for session replay data
 */

import type { SavedObject } from './client.js';

const DATA_VIEW_ID = 'session-replay-traces';

export function getFrustrationOverTimeVisualization(): SavedObject {
  return {
    type: 'lens',
    id: 'session-replay-frustration-over-time',
    attributes: {
      title: 'Frustration Events Over Time',
      description: 'Shows rage clicks, dead clicks, hesitation, and thrashing over time',
      visualizationType: 'lnsXY',
      state: {
        datasourceStates: {
          formBased: {
            layers: {
              layer1: {
                columns: {
                  col1: {
                    dataType: 'date',
                    isBucketed: true,
                    label: '@timestamp',
                    operationType: 'date_histogram',
                    params: { interval: 'auto' },
                    scale: 'interval',
                    sourceField: '@timestamp',
                  },
                  col2: {
                    dataType: 'number',
                    isBucketed: false,
                    label: 'Count',
                    operationType: 'count',
                    scale: 'ratio',
                  },
                  col3: {
                    dataType: 'string',
                    isBucketed: true,
                    label: 'Frustration Type',
                    operationType: 'terms',
                    params: { size: 5, orderBy: { type: 'column', columnId: 'col2' }, orderDirection: 'desc' },
                    scale: 'ordinal',
                    sourceField: 'frustration.type',
                  },
                },
                columnOrder: ['col1', 'col3', 'col2'],
                incompleteColumns: {},
              },
            },
          },
        },
        filters: [
          {
            meta: { index: DATA_VIEW_ID },
            query: { exists: { field: 'frustration.type' } },
          },
        ],
        visualization: {
          axisTitlesVisibilitySettings: { x: true, yLeft: true, yRight: true },
          layers: [
            {
              accessors: ['col2'],
              layerId: 'layer1',
              layerType: 'data',
              seriesType: 'line',
              splitAccessor: 'col3',
              xAccessor: 'col1',
            },
          ],
          legend: { isVisible: true, position: 'right' },
          preferredSeriesType: 'line',
          title: 'Frustration Events Over Time',
          valueLabels: 'hide',
        },
      },
      references: [{ id: DATA_VIEW_ID, name: 'indexpattern-datasource-layer-layer1', type: 'index-pattern' }],
    },
  };
}

export function getFrustrationByTypeVisualization(): SavedObject {
  return {
    type: 'lens',
    id: 'session-replay-frustration-by-type',
    attributes: {
      title: 'Frustration Events by Type',
      description: 'Pie chart showing distribution of frustration event types',
      visualizationType: 'lnsPie',
      state: {
        datasourceStates: {
          formBased: {
            layers: {
              layer1: {
                columns: {
                  col1: {
                    dataType: 'string',
                    isBucketed: true,
                    label: 'Frustration Type',
                    operationType: 'terms',
                    params: { size: 10, orderBy: { type: 'column', columnId: 'col2' }, orderDirection: 'desc' },
                    scale: 'ordinal',
                    sourceField: 'frustration.type',
                  },
                  col2: {
                    dataType: 'number',
                    isBucketed: false,
                    label: 'Count',
                    operationType: 'count',
                    scale: 'ratio',
                  },
                },
                columnOrder: ['col1', 'col2'],
                incompleteColumns: {},
              },
            },
          },
        },
        filters: [
          {
            meta: { index: DATA_VIEW_ID },
            query: { exists: { field: 'frustration.type' } },
          },
        ],
        visualization: {
          layers: [
            {
              categoryDisplay: 'default',
              layerId: 'layer1',
              layerType: 'data',
              legendDisplay: 'show',
              metrics: ['col2'],
              nestedLegend: false,
              numberDisplay: 'percent',
              primaryGroups: ['col1'],
            },
          ],
          shape: 'donut',
        },
      },
      references: [{ id: DATA_VIEW_ID, name: 'indexpattern-datasource-layer-layer1', type: 'index-pattern' }],
    },
  };
}

export function getTopFrustrationPagesVisualization(): SavedObject {
  return {
    type: 'lens',
    id: 'session-replay-top-frustration-pages',
    attributes: {
      title: 'Top Pages with Frustration',
      description: 'Bar chart showing pages with most frustration events',
      visualizationType: 'lnsXY',
      state: {
        datasourceStates: {
          formBased: {
            layers: {
              layer1: {
                columns: {
                  col1: {
                    dataType: 'string',
                    isBucketed: true,
                    label: 'Page URL',
                    operationType: 'terms',
                    params: { size: 10, orderBy: { type: 'column', columnId: 'col2' }, orderDirection: 'desc' },
                    scale: 'ordinal',
                    sourceField: 'page.url',
                  },
                  col2: {
                    dataType: 'number',
                    isBucketed: false,
                    label: 'Frustration Events',
                    operationType: 'count',
                    scale: 'ratio',
                  },
                },
                columnOrder: ['col1', 'col2'],
                incompleteColumns: {},
              },
            },
          },
        },
        filters: [
          {
            meta: { index: DATA_VIEW_ID },
            query: { exists: { field: 'frustration.type' } },
          },
        ],
        visualization: {
          axisTitlesVisibilitySettings: { x: true, yLeft: true, yRight: true },
          layers: [
            {
              accessors: ['col2'],
              layerId: 'layer1',
              layerType: 'data',
              seriesType: 'bar_horizontal',
              xAccessor: 'col1',
            },
          ],
          legend: { isVisible: false, position: 'right' },
          preferredSeriesType: 'bar_horizontal',
          title: 'Top Pages with Frustration',
          valueLabels: 'show',
        },
      },
      references: [{ id: DATA_VIEW_ID, name: 'indexpattern-datasource-layer-layer1', type: 'index-pattern' }],
    },
  };
}

export function getErrorsVisualization(): SavedObject {
  return {
    type: 'lens',
    id: 'session-replay-errors',
    attributes: {
      title: 'JavaScript Errors by Page',
      description: 'Shows error frequency by page URL',
      visualizationType: 'lnsXY',
      state: {
        datasourceStates: {
          formBased: {
            layers: {
              layer1: {
                columns: {
                  col1: {
                    dataType: 'string',
                    isBucketed: true,
                    label: 'Page URL',
                    operationType: 'terms',
                    params: { size: 10, orderBy: { type: 'column', columnId: 'col2' }, orderDirection: 'desc' },
                    scale: 'ordinal',
                    sourceField: 'error.context.page_url',
                  },
                  col2: {
                    dataType: 'number',
                    isBucketed: false,
                    label: 'Error Count',
                    operationType: 'count',
                    scale: 'ratio',
                  },
                },
                columnOrder: ['col1', 'col2'],
                incompleteColumns: {},
              },
            },
          },
        },
        filters: [
          {
            meta: { index: DATA_VIEW_ID },
            query: { exists: { field: 'error.type' } },
          },
        ],
        visualization: {
          axisTitlesVisibilitySettings: { x: true, yLeft: true, yRight: true },
          layers: [
            {
              accessors: ['col2'],
              layerId: 'layer1',
              layerType: 'data',
              seriesType: 'bar',
              xAccessor: 'col1',
            },
          ],
          legend: { isVisible: false, position: 'right' },
          preferredSeriesType: 'bar',
          title: 'JavaScript Errors by Page',
          valueLabels: 'show',
        },
      },
      references: [{ id: DATA_VIEW_ID, name: 'indexpattern-datasource-layer-layer1', type: 'index-pattern' }],
    },
  };
}

export function getNavigationVisualization(): SavedObject {
  return {
    type: 'lens',
    id: 'session-replay-navigation',
    attributes: {
      title: 'Page Views Over Time',
      description: 'Shows navigation events over time',
      visualizationType: 'lnsXY',
      state: {
        datasourceStates: {
          formBased: {
            layers: {
              layer1: {
                columns: {
                  col1: {
                    dataType: 'date',
                    isBucketed: true,
                    label: '@timestamp',
                    operationType: 'date_histogram',
                    params: { interval: 'auto' },
                    scale: 'interval',
                    sourceField: '@timestamp',
                  },
                  col2: {
                    dataType: 'number',
                    isBucketed: false,
                    label: 'Count',
                    operationType: 'count',
                    scale: 'ratio',
                  },
                  col3: {
                    dataType: 'string',
                    isBucketed: true,
                    label: 'Navigation Type',
                    operationType: 'terms',
                    params: { size: 5, orderBy: { type: 'column', columnId: 'col2' }, orderDirection: 'desc' },
                    scale: 'ordinal',
                    sourceField: 'navigation.type',
                  },
                },
                columnOrder: ['col1', 'col3', 'col2'],
                incompleteColumns: {},
              },
            },
          },
        },
        filters: [
          {
            meta: { index: DATA_VIEW_ID },
            query: { exists: { field: 'navigation.type' } },
          },
        ],
        visualization: {
          axisTitlesVisibilitySettings: { x: true, yLeft: true, yRight: true },
          layers: [
            {
              accessors: ['col2'],
              layerId: 'layer1',
              layerType: 'data',
              seriesType: 'area_stacked',
              splitAccessor: 'col3',
              xAccessor: 'col1',
            },
          ],
          legend: { isVisible: true, position: 'right' },
          preferredSeriesType: 'area_stacked',
          title: 'Page Views Over Time',
          valueLabels: 'hide',
        },
      },
      references: [{ id: DATA_VIEW_ID, name: 'indexpattern-datasource-layer-layer1', type: 'index-pattern' }],
    },
  };
}

export function getAllVisualizations(): SavedObject[] {
  return [
    getFrustrationOverTimeVisualization(),
    getFrustrationByTypeVisualization(),
    getTopFrustrationPagesVisualization(),
    getErrorsVisualization(),
    getNavigationVisualization(),
  ];
}
