/**
 * Kibana Dashboard Definitions (By-Value Format)
 *
 * For Kibana Serverless, visualizations must be embedded inline (by-value)
 * rather than referenced as separate saved objects (by-reference).
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
import { randomUUID } from 'crypto';
// Data view for OTLP logs
var DATA_VIEW_ID = 'logs-generic.otel-default';
// Helper to generate consistent UUIDs for layers/columns
function uuid() {
    return randomUUID();
}
function createMetricPanel(id, x, y, w, h, title, sourceField, operationType, filter) {
    var _a, _b;
    var layerId = uuid();
    var colId = uuid();
    return {
        type: 'lens',
        panelIndex: id,
        gridData: { x: x, y: y, w: w, h: h, i: id },
        embeddableConfig: {
            attributes: {
                title: title,
                type: 'lens',
                visualizationType: 'lnsMetric',
                references: [
                    { id: DATA_VIEW_ID, name: "indexpattern-datasource-layer-".concat(layerId), type: 'index-pattern' },
                ],
                state: {
                    datasourceStates: {
                        formBased: {
                            layers: (_a = {},
                                _a[layerId] = {
                                    columnOrder: [colId],
                                    columns: (_b = {},
                                        _b[colId] = {
                                            dataType: 'number',
                                            isBucketed: false,
                                            label: title,
                                            operationType: operationType,
                                            scale: 'ratio',
                                            sourceField: sourceField,
                                            params: { emptyAsNull: true },
                                        },
                                        _b),
                                    incompleteColumns: {},
                                    sampling: 1,
                                },
                                _a),
                        },
                        indexpattern: { layers: {} },
                        textBased: { layers: {} },
                    },
                    visualization: {
                        layerId: layerId,
                        layerType: 'data',
                        metricAccessor: colId,
                    },
                    query: { language: 'kuery', query: '' },
                    filters: filter
                        ? [
                            {
                                meta: { index: DATA_VIEW_ID, key: sourceField, type: 'exists' },
                                query: { exists: { field: filter.query } },
                            },
                        ]
                        : [],
                    internalReferences: [],
                    adHocDataViews: {},
                },
            },
            enhancements: {},
            hidePanelTitles: false,
        },
    };
}
function createTimeSeriesPanel(id, x, y, w, h, title, seriesType, valueField, valueOp, splitField, filterQuery) {
    var _a, _b;
    var layerId = uuid();
    var timeColId = uuid();
    var valueColId = uuid();
    var splitColId = splitField ? uuid() : null;
    var columns = (_a = {},
        _a[timeColId] = {
            dataType: 'date',
            isBucketed: true,
            label: '@timestamp',
            operationType: 'date_histogram',
            params: { interval: 'auto', includeEmptyRows: true },
            scale: 'interval',
            sourceField: '@timestamp',
        },
        _a[valueColId] = __assign(__assign({ dataType: 'number', isBucketed: false, label: valueOp === 'unique_count' ? 'Unique Count' : 'Count', operationType: valueOp, scale: 'ratio' }, (valueField && valueOp === 'unique_count' ? { sourceField: valueField } : {})), { params: { emptyAsNull: false } }),
        _a);
    var columnOrder = [timeColId];
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
        gridData: { x: x, y: y, w: w, h: h, i: id },
        embeddableConfig: {
            attributes: {
                title: title,
                type: 'lens',
                visualizationType: 'lnsXY',
                references: [
                    { id: DATA_VIEW_ID, name: "indexpattern-datasource-layer-".concat(layerId), type: 'index-pattern' },
                ],
                state: {
                    datasourceStates: {
                        formBased: {
                            layers: (_b = {},
                                _b[layerId] = {
                                    columnOrder: columnOrder,
                                    columns: columns,
                                    incompleteColumns: {},
                                    sampling: 1,
                                },
                                _b),
                        },
                        indexpattern: { layers: {} },
                        textBased: { layers: {} },
                    },
                    visualization: {
                        axisTitlesVisibilitySettings: { x: true, yLeft: true, yRight: true },
                        layers: [
                            __assign(__assign({ accessors: [valueColId], layerId: layerId, layerType: 'data', seriesType: seriesType }, (splitColId ? { splitAccessor: splitColId } : {})), { xAccessor: timeColId }),
                        ],
                        legend: { isVisible: !!splitField, position: 'right' },
                        preferredSeriesType: seriesType,
                        valueLabels: 'hide',
                    },
                    query: { language: 'kuery', query: filterQuery || '' },
                    filters: [],
                    internalReferences: [],
                    adHocDataViews: {},
                },
            },
            enhancements: {},
            hidePanelTitles: false,
        },
    };
}
function createBarPanel(id, x, y, w, h, title, groupByField, valueOp, valueField, filterQuery, horizontal) {
    var _a, _b;
    if (horizontal === void 0) { horizontal = true; }
    var layerId = uuid();
    var groupColId = uuid();
    var valueColId = uuid();
    return {
        type: 'lens',
        panelIndex: id,
        gridData: { x: x, y: y, w: w, h: h, i: id },
        embeddableConfig: {
            attributes: {
                title: title,
                type: 'lens',
                visualizationType: 'lnsXY',
                references: [
                    { id: DATA_VIEW_ID, name: "indexpattern-datasource-layer-".concat(layerId), type: 'index-pattern' },
                ],
                state: {
                    datasourceStates: {
                        formBased: {
                            layers: (_a = {},
                                _a[layerId] = {
                                    columnOrder: [groupColId, valueColId],
                                    columns: (_b = {},
                                        _b[groupColId] = {
                                            dataType: 'string',
                                            isBucketed: true,
                                            label: groupByField,
                                            operationType: 'terms',
                                            params: { size: 10, orderBy: { type: 'column', columnId: valueColId }, orderDirection: 'desc' },
                                            scale: 'ordinal',
                                            sourceField: groupByField,
                                        },
                                        _b[valueColId] = __assign(__assign({ dataType: 'number', isBucketed: false, label: valueOp === 'unique_count' ? 'Unique Count' : 'Count', operationType: valueOp, scale: 'ratio' }, (valueField && valueOp === 'unique_count' ? { sourceField: valueField } : {})), { params: { emptyAsNull: false } }),
                                        _b),
                                    incompleteColumns: {},
                                    sampling: 1,
                                },
                                _a),
                        },
                        indexpattern: { layers: {} },
                        textBased: { layers: {} },
                    },
                    visualization: {
                        axisTitlesVisibilitySettings: { x: true, yLeft: true, yRight: true },
                        layers: [
                            {
                                accessors: [valueColId],
                                layerId: layerId,
                                layerType: 'data',
                                seriesType: horizontal ? 'bar_horizontal' : 'bar',
                                xAccessor: groupColId,
                            },
                        ],
                        legend: { isVisible: false, position: 'right' },
                        preferredSeriesType: horizontal ? 'bar_horizontal' : 'bar',
                        valueLabels: 'show',
                    },
                    query: { language: 'kuery', query: filterQuery || '' },
                    filters: [],
                    internalReferences: [],
                    adHocDataViews: {},
                },
            },
            enhancements: {},
            hidePanelTitles: false,
        },
    };
}
function createPiePanel(id, x, y, w, h, title, groupByField, filterQuery) {
    var _a, _b;
    var layerId = uuid();
    var groupColId = uuid();
    var valueColId = uuid();
    return {
        type: 'lens',
        panelIndex: id,
        gridData: { x: x, y: y, w: w, h: h, i: id },
        embeddableConfig: {
            attributes: {
                title: title,
                type: 'lens',
                visualizationType: 'lnsPie',
                references: [
                    { id: DATA_VIEW_ID, name: "indexpattern-datasource-layer-".concat(layerId), type: 'index-pattern' },
                ],
                state: {
                    datasourceStates: {
                        formBased: {
                            layers: (_a = {},
                                _a[layerId] = {
                                    columnOrder: [groupColId, valueColId],
                                    columns: (_b = {},
                                        _b[groupColId] = {
                                            dataType: 'string',
                                            isBucketed: true,
                                            label: groupByField,
                                            operationType: 'terms',
                                            params: { size: 10, orderBy: { type: 'column', columnId: valueColId }, orderDirection: 'desc' },
                                            scale: 'ordinal',
                                            sourceField: groupByField,
                                        },
                                        _b[valueColId] = {
                                            dataType: 'number',
                                            isBucketed: false,
                                            label: 'Count',
                                            operationType: 'count',
                                            scale: 'ratio',
                                            params: { emptyAsNull: false },
                                        },
                                        _b),
                                    incompleteColumns: {},
                                    sampling: 1,
                                },
                                _a),
                        },
                        indexpattern: { layers: {} },
                        textBased: { layers: {} },
                    },
                    visualization: {
                        layers: [
                            {
                                categoryDisplay: 'default',
                                layerId: layerId,
                                layerType: 'data',
                                legendDisplay: 'show',
                                metrics: [valueColId],
                                nestedLegend: false,
                                numberDisplay: 'percent',
                                primaryGroups: [groupColId],
                            },
                        ],
                        shape: 'donut',
                    },
                    query: { language: 'kuery', query: filterQuery || '' },
                    filters: [],
                    internalReferences: [],
                    adHocDataViews: {},
                },
            },
            enhancements: {},
            hidePanelTitles: false,
        },
    };
}
function createTablePanel(id, x, y, w, h, title) {
    var _a, _b;
    var layerId = uuid();
    var sessionColId = uuid();
    var userColId = uuid();
    var eventsColId = uuid();
    var pageColId = uuid();
    return {
        type: 'lens',
        panelIndex: id,
        gridData: { x: x, y: y, w: w, h: h, i: id },
        embeddableConfig: {
            attributes: {
                title: title,
                type: 'lens',
                visualizationType: 'lnsDatatable',
                references: [
                    { id: DATA_VIEW_ID, name: "indexpattern-datasource-layer-".concat(layerId), type: 'index-pattern' },
                ],
                state: {
                    datasourceStates: {
                        formBased: {
                            layers: (_a = {},
                                _a[layerId] = {
                                    columnOrder: [sessionColId, userColId, eventsColId, pageColId],
                                    columns: (_b = {},
                                        _b[sessionColId] = {
                                            dataType: 'string',
                                            isBucketed: true,
                                            label: 'Session ID',
                                            operationType: 'terms',
                                            params: { size: 20, orderBy: { type: 'column', columnId: eventsColId }, orderDirection: 'desc' },
                                            scale: 'ordinal',
                                            sourceField: 'attributes.session.id',
                                        },
                                        _b[userColId] = {
                                            dataType: 'string',
                                            isBucketed: true,
                                            label: 'User',
                                            operationType: 'terms',
                                            params: { size: 1, orderBy: { type: 'column', columnId: eventsColId }, orderDirection: 'desc' },
                                            scale: 'ordinal',
                                            sourceField: 'attributes.user.name',
                                        },
                                        _b[eventsColId] = {
                                            dataType: 'number',
                                            isBucketed: false,
                                            label: 'Events',
                                            operationType: 'count',
                                            scale: 'ratio',
                                            params: { emptyAsNull: false },
                                        },
                                        _b[pageColId] = {
                                            dataType: 'string',
                                            isBucketed: true,
                                            label: 'Last Page',
                                            operationType: 'terms',
                                            params: { size: 1, orderBy: { type: 'column', columnId: eventsColId }, orderDirection: 'desc' },
                                            scale: 'ordinal',
                                            sourceField: 'attributes.page.url',
                                        },
                                        _b),
                                    incompleteColumns: {},
                                    sampling: 1,
                                },
                                _a),
                        },
                        indexpattern: { layers: {} },
                        textBased: { layers: {} },
                    },
                    visualization: {
                        columns: [
                            { columnId: sessionColId, isTransposed: false },
                            { columnId: userColId, isTransposed: false },
                            { columnId: eventsColId, isTransposed: false },
                            { columnId: pageColId, isTransposed: false },
                        ],
                        layerId: layerId,
                        layerType: 'data',
                    },
                    query: { language: 'kuery', query: '' },
                    filters: [],
                    internalReferences: [],
                    adHocDataViews: {},
                },
            },
            enhancements: {},
            hidePanelTitles: false,
        },
    };
}
export function getSessionReplayDashboard() {
    var _a;
    // Generate panel IDs
    var ids = {
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
    var panels = [
        // Row 0: Metrics
        createMetricPanel(ids.totalSessions, 0, 0, 8, 4, 'Total Sessions', 'attributes.session.id', 'unique_count'),
        createMetricPanel(ids.frustratedSessions, 8, 0, 8, 4, 'Frustrated Sessions', 'attributes.session.id', 'unique_count', { query: 'attributes.frustration.type', language: 'kuery' }),
        // Row 1: Time series
        createTimeSeriesPanel(ids.sessionsOverTime, 0, 4, 24, 10, 'Active Sessions', 'area', 'attributes.session.id', 'unique_count'),
        createTimeSeriesPanel(ids.eventsOverTime, 24, 4, 24, 10, 'Events by Category', 'area_stacked', null, 'count', 'attributes.event.category'),
        // Row 2: Frustration analysis
        createTimeSeriesPanel(ids.frustrationOverTime, 0, 14, 24, 10, 'Frustration Over Time', 'line', null, 'count', 'attributes.frustration.type', 'attributes.frustration.type: *'),
        createPiePanel(ids.frustrationByType, 24, 14, 24, 10, 'Frustration by Type', 'attributes.frustration.type', 'attributes.frustration.type: *'),
        // Row 3: Hotspots
        createBarPanel(ids.rageClickHotspots, 0, 24, 24, 10, 'Rage Click Hotspots', 'attributes.target.semantic_name', 'count', undefined, 'attributes.frustration.type: rage_click'),
        createBarPanel(ids.pageFlow, 24, 24, 24, 10, 'Page Flow', 'attributes.page.url', 'unique_count', 'attributes.session.id'),
        // Row 4: Users and pages
        createBarPanel(ids.topFrustratedUsers, 0, 34, 24, 10, 'Top Frustrated Users', 'attributes.user.id', 'count', undefined, 'attributes.frustration.type: *'),
        createBarPanel(ids.topFrustrationPages, 24, 34, 24, 10, 'Top Frustration Pages', 'attributes.page.url', 'count', undefined, 'attributes.frustration.type: *'),
        // Row 5: Session explorer
        createTablePanel(ids.sessionExplorer, 0, 44, 48, 14, 'Session Explorer'),
        // Row 6: Errors
        createBarPanel(ids.errorsByPage, 0, 58, 48, 10, 'Errors by Page', 'attributes.page.url', 'count', undefined, 'attributes.event.category: user.error', false),
    ];
    // Control group for user filter
    var controlPanels = (_a = {},
        _a[ids.userControl] = {
            grow: false,
            order: 0,
            type: 'optionsListControl',
            width: 'medium',
            explicitInput: {
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
        _a);
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
        references: [],
    };
}
