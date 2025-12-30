/**
 * Kibana API Client
 *
 * Handles communication with Kibana Saved Objects API
 */

export interface KibanaClientConfig {
  kibanaUrl: string;
  apiKey?: string;
  username?: string;
  password?: string;
  spaceId?: string;
}

export interface SavedObject {
  type: string;
  id: string;
  attributes: Record<string, unknown>;
  references?: Array<{
    name: string;
    type: string;
    id: string;
  }>;
}

export interface BulkCreateResponse {
  saved_objects: Array<{
    id: string;
    type: string;
    error?: {
      statusCode: number;
      error: string;
      message: string;
    };
  }>;
}

export class KibanaClient {
  private config: KibanaClientConfig;
  private baseUrl: string;

  constructor(config: KibanaClientConfig) {
    this.config = config;
    const spacePrefix = config.spaceId ? `/s/${config.spaceId}` : '';
    this.baseUrl = `${config.kibanaUrl}${spacePrefix}/api`;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'kbn-xsrf': 'true',
    };

    if (this.config.apiKey) {
      headers['Authorization'] = `ApiKey ${this.config.apiKey}`;
    } else if (this.config.username && this.config.password) {
      const credentials = Buffer.from(
        `${this.config.username}:${this.config.password}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    return headers;
  }

  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.kibanaUrl}/api/status`, {
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async createDataView(dataView: {
    id: string;
    name: string;
    title: string;
    timeFieldName?: string;
  }): Promise<void> {
    const response = await fetch(`${this.baseUrl}/data_views/data_view`, {
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
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to create data view: ${response.status} ${text}`);
    }
  }

  async bulkCreate(
    objects: SavedObject[],
    overwrite = true
  ): Promise<BulkCreateResponse> {
    const response = await fetch(
      `${this.baseUrl}/saved_objects/_bulk_create?overwrite=${overwrite}`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(objects),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to bulk create: ${response.status} ${text}`);
    }

    return response.json();
  }

  async importDashboard(dashboardJson: string): Promise<void> {
    const response = await fetch(
      `${this.baseUrl}/kibana/dashboards/import?force=true`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: dashboardJson,
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to import dashboard: ${response.status} ${text}`);
    }
  }
}
