/**
 * Kibana API Client
 *
 * Handles communication with Kibana Saved Objects API
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var KibanaClient = /** @class */ (function () {
    function KibanaClient(config) {
        this.config = config;
        var spacePrefix = config.spaceId ? "/s/".concat(config.spaceId) : '';
        this.baseUrl = "".concat(config.kibanaUrl).concat(spacePrefix, "/api");
    }
    KibanaClient.prototype.getHeaders = function () {
        var headers = {
            'Content-Type': 'application/json',
            'kbn-xsrf': 'true',
        };
        if (this.config.apiKey) {
            headers['Authorization'] = "ApiKey ".concat(this.config.apiKey);
        }
        else if (this.config.username && this.config.password) {
            var credentials = Buffer.from("".concat(this.config.username, ":").concat(this.config.password)).toString('base64');
            headers['Authorization'] = "Basic ".concat(credentials);
        }
        return headers;
    };
    KibanaClient.prototype.checkConnection = function () {
        return __awaiter(this, void 0, void 0, function () {
            var response, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, fetch("".concat(this.config.kibanaUrl, "/api/status"), {
                                headers: this.getHeaders(),
                            })];
                    case 1:
                        response = _b.sent();
                        return [2 /*return*/, response.ok];
                    case 2:
                        _a = _b.sent();
                        return [2 /*return*/, false];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    KibanaClient.prototype.createDataView = function (dataView) {
        return __awaiter(this, void 0, void 0, function () {
            var response, text;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch("".concat(this.baseUrl, "/data_views/data_view"), {
                            method: 'POST',
                            headers: this.getHeaders(),
                            body: JSON.stringify({
                                data_view: {
                                    id: dataView.id,
                                    name: dataView.name,
                                    title: dataView.title,
                                    timeFieldName: dataView.timeFieldName || '@timestamp',
                                },
                                override: true,
                            }),
                        })];
                    case 1:
                        response = _a.sent();
                        if (!!response.ok) return [3 /*break*/, 3];
                        return [4 /*yield*/, response.text()];
                    case 2:
                        text = _a.sent();
                        throw new Error("Failed to create data view: ".concat(response.status, " ").concat(text));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    KibanaClient.prototype.bulkCreate = function (objects_1) {
        return __awaiter(this, arguments, void 0, function (objects, overwrite) {
            var response, text;
            if (overwrite === void 0) { overwrite = true; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch("".concat(this.baseUrl, "/saved_objects/_bulk_create?overwrite=").concat(overwrite), {
                            method: 'POST',
                            headers: this.getHeaders(),
                            body: JSON.stringify(objects),
                        })];
                    case 1:
                        response = _a.sent();
                        if (!!response.ok) return [3 /*break*/, 3];
                        return [4 /*yield*/, response.text()];
                    case 2:
                        text = _a.sent();
                        throw new Error("Failed to bulk create: ".concat(response.status, " ").concat(text));
                    case 3: return [2 /*return*/, response.json()];
                }
            });
        });
    };
    KibanaClient.prototype.importDashboard = function (dashboardJson) {
        return __awaiter(this, void 0, void 0, function () {
            var response, text;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch("".concat(this.baseUrl, "/kibana/dashboards/import?force=true"), {
                            method: 'POST',
                            headers: this.getHeaders(),
                            body: dashboardJson,
                        })];
                    case 1:
                        response = _a.sent();
                        if (!!response.ok) return [3 /*break*/, 3];
                        return [4 /*yield*/, response.text()];
                    case 2:
                        text = _a.sent();
                        throw new Error("Failed to import dashboard: ".concat(response.status, " ").concat(text));
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    return KibanaClient;
}());
export { KibanaClient };
