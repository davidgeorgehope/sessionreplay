#!/usr/bin/env npx tsx
/**
 * Elastic Dashboard Setup Script
 *
 * Creates Kibana data views, visualizations, and dashboards for session replay data.
 *
 * Usage:
 *   pnpm setup-elastic --kibana-url http://localhost:5601
 *   pnpm setup-elastic --kibana-url http://localhost:5601 --api-key <key>
 */

import { program } from 'commander';
import { KibanaClient } from './kibana/client.js';
import { getAllVisualizations } from './kibana/visualizations.js';
import { getSessionReplayDashboard } from './kibana/dashboards.js';

const DATA_VIEW_ID = 'session-replay-traces';
const DATA_VIEW_TITLE = 'session-replay-traces-*';

interface Options {
  kibanaUrl: string;
  apiKey?: string;
  username?: string;
  password?: string;
  spaceId?: string;
}

async function main() {
  program
    .name('setup-elastic')
    .description('Set up Kibana dashboards for session replay data')
    .requiredOption('--kibana-url <url>', 'Kibana URL (e.g., http://localhost:5601)')
    .option('--api-key <key>', 'Kibana API key for authentication')
    .option('--username <username>', 'Kibana username for basic auth')
    .option('--password <password>', 'Kibana password for basic auth')
    .option('--space-id <id>', 'Kibana space ID (optional)')
    .parse();

  const options = program.opts<Options>();

  console.log('🚀 Session Replay Elastic Setup\n');
  console.log(`Kibana URL: ${options.kibanaUrl}`);
  console.log(`Space: ${options.spaceId || 'default'}\n`);

  const client = new KibanaClient({
    kibanaUrl: options.kibanaUrl,
    apiKey: options.apiKey,
    username: options.username,
    password: options.password,
    spaceId: options.spaceId,
  });

  // Check connection
  console.log('📡 Checking Kibana connection...');
  const connected = await client.checkConnection();
  if (!connected) {
    console.error('❌ Failed to connect to Kibana. Please check the URL and credentials.');
    process.exit(1);
  }
  console.log('✅ Connected to Kibana\n');

  // Create data view
  console.log('📊 Creating data view...');
  try {
    await client.createDataView({
      id: DATA_VIEW_ID,
      name: 'Session Replay Traces',
      title: DATA_VIEW_TITLE,
      timeFieldName: '@timestamp',
    });
    console.log(`✅ Created data view: ${DATA_VIEW_TITLE}\n`);
  } catch (error) {
    console.warn(`⚠️  Data view creation: ${(error as Error).message}`);
    console.log('   Continuing with existing data view...\n');
  }

  // Create visualizations
  console.log('📈 Creating visualizations...');
  const visualizations = getAllVisualizations();

  try {
    const vizResult = await client.bulkCreate(visualizations, true);
    const errors = vizResult.saved_objects.filter((obj) => obj.error);
    if (errors.length > 0) {
      console.warn(`⚠️  Some visualizations had issues:`);
      errors.forEach((err) => {
        console.warn(`   - ${err.id}: ${err.error?.message}`);
      });
    }
    console.log(`✅ Created ${visualizations.length - errors.length} visualizations\n`);
  } catch (error) {
    console.error(`❌ Failed to create visualizations: ${(error as Error).message}`);
    process.exit(1);
  }

  // Create dashboard
  console.log('📋 Creating dashboard...');
  const dashboard = getSessionReplayDashboard();

  try {
    const dashResult = await client.bulkCreate([dashboard], true);
    const errors = dashResult.saved_objects.filter((obj) => obj.error);
    if (errors.length > 0) {
      console.warn(`⚠️  Dashboard had issues:`);
      errors.forEach((err) => {
        console.warn(`   - ${err.id}: ${err.error?.message}`);
      });
    } else {
      console.log(`✅ Created dashboard: Session Replay - User Frustration\n`);
    }
  } catch (error) {
    console.error(`❌ Failed to create dashboard: ${(error as Error).message}`);
    process.exit(1);
  }

  // Print summary
  console.log('━'.repeat(50));
  console.log('\n🎉 Setup complete!\n');
  console.log('Created:');
  console.log(`  📊 Data View: ${DATA_VIEW_TITLE}`);
  console.log(`  📈 Visualizations: ${visualizations.length}`);
  console.log(`  📋 Dashboard: Session Replay - User Frustration`);
  console.log('\nView your dashboard at:');
  const spacePrefix = options.spaceId ? `/s/${options.spaceId}` : '';
  console.log(`  ${options.kibanaUrl}${spacePrefix}/app/dashboards#/view/session-replay-dashboard`);
  console.log();
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
