#!/usr/bin/env node

/**
 * PowerNOVA Typesense Sync Script
 * 
 * This script syncs project data from PostgreSQL QueueInfo table to Typesense
 * for fast search functionality.
 * 
 * Usage:
 *   node scripts/sync-typesense.js [command]
 * 
 * Commands:
 *   setup     - Drop existing collection and create new one with data
 *   sync      - Sync data to existing collection (create if doesn't exist)
 *   drop      - Drop the collection
 *   status    - Check Typesense connection and collection status
 * 
 * Environment Variables:
 *   TYPESENSE_API_KEY - Typesense API key
 *   TYPESENSE_HOST - Typesense host (default: localhost)
 *   TYPESENSE_PORT - Typesense port (default: 8108)
 *   TYPESENSE_PROTOCOL - Protocol (default: http)
 *   POWERNOVA_* - Database connection parameters
 */

const Typesense = require('typesense');
const { query } = require('../src/config/database');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Typesense client configuration
const typesenseConfig = {
  apiKey: process.env.TYPESENSE_API_KEY || 'powernova-api-key',
  nodes: [{
    host: process.env.TYPESENSE_HOST || 'localhost',
    port: process.env.TYPESENSE_PORT || '8108',
    protocol: process.env.TYPESENSE_PROTOCOL || 'http'
  }],
  connectionTimeoutSeconds: 5
};

// Don't create client at module level - create it in functions when needed
// const client = new Typesense.Client(typesenseConfig);

// Collection schema
const projectsSchema = {
  name: 'projects',
  fields: [
    { name: 'iso', type: 'string', facet: true },
    { name: 'queueid', type: 'string' },
    { name: 'project_name', type: 'string', optional: true },
    { name: 'interconnecting_entity', type: 'string', optional: true },
    { name: 'county', type: 'string', facet: true, optional: true },
    { name: 'state', type: 'string', facet: true, optional: true },
    { name: 'gentype', type: 'string', facet: true, optional: true },
    { name: 'capacity_mw', type: 'float', optional: true },
    { name: 'status', type: 'string', facet: true, optional: true },
    { name: 'description', type: 'string', optional: true },
    { name: 'queue_date', type: 'string', optional: true },
    { name: 'proposed_completion_date', type: 'string', optional: true }
  ]
};

async function checkTypesenseConnection() {
  try {
    const client = new Typesense.Client(typesenseConfig);
    const health = await client.health.retrieve();
    console.log('✅ Typesense connection successful');
    console.log(`📊 Typesense status: OK`);
    return true;
  } catch (error) {
    console.error('❌ Typesense connection failed:', error.message);
    console.error('💡 Make sure Typesense is running: docker-compose up typesense');
    return false;
  }
}

async function dropCollection() {
  try {
    const client = new Typesense.Client(typesenseConfig);
    await client.collections('projects').delete();
    console.log('🗑️  Collection "projects" dropped successfully');
    return true;
  } catch (error) {
    if (error.httpStatus === 404) {
      console.log('ℹ️  Collection "projects" does not exist');
      return true;
    }
    console.error('❌ Failed to drop collection:', error.message);
    return false;
  }
}

async function createCollection() {
  try {
    const client = new Typesense.Client(typesenseConfig);
    await client.collections().create(projectsSchema);
    console.log('✅ Collection "projects" created successfully');
    return true;
  } catch (error) {
    if (error.httpStatus === 409) {
      console.log('ℹ️  Collection "projects" already exists');
      return true;
    }
    console.error('❌ Failed to create collection:', error.message);
    return false;
  }
}

async function syncProjectData() {
  try {
    const client = new Typesense.Client(typesenseConfig);
    console.log('📡 Fetching project data from PostgreSQL...');
    
    const sql = `
      SELECT 
        IsoID, QueueID, ProjectName, InterconnectingEntity, 
        County, StateName, GenerationType, CapacityMW, Status,
        AdditionalInfo, QueueDate, ProposedCompletionDate
      FROM QueueInfo 
      ORDER BY IsoID, QueueID
    `;
    
    const result = await query(sql);
    const projects = result.rows;
    
    console.log(`📊 Found ${projects.length} projects to sync`);
    
    if (projects.length === 0) {
      console.log('⚠️  No projects found in database. Run queue population first:');
      console.log('   npm run populate-queue-data populate CAISO');
      return false;
    }

    // Convert database rows to Typesense documents
    const documents = projects.map((project, index) => {
      // Create searchable description from available fields
      const descriptionParts = [
        project.projectname,
        project.interconnectingentity,
        project.generationtype,
        project.county,
        project.statename
      ].filter(Boolean);
      
      return {
        id: `${project.isoid}-${project.queueid}`,
        iso: project.isoid || '',
        queueid: project.queueid || '',
        project_name: project.projectname || '',
        interconnecting_entity: project.interconnectingentity || '',
        county: project.county || '',
        state: project.statename || '',
        gentype: project.generationtype || '',
        capacity_mw: parseFloat(project.capacitymw) || 0,
        status: project.status || '',
        description: descriptionParts.join(' '),
        queue_date: project.queuedate ? project.queuedate.toISOString().split('T')[0] : '',
        proposed_completion_date: project.proposedcompletiondate ? 
          project.proposedcompletiondate.toISOString().split('T')[0] : ''
      };
    });

    console.log('💾 Importing documents to Typesense...');
    
    // Import in batches for better performance
    const batchSize = 100;
    let imported = 0;
    let failed = 0;
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      
      try {
        const results = await client.collections('projects').documents().import(batch, {
          action: 'upsert'
        });
        
        // Count successful imports
        const batchImported = results.filter(r => r.success === true).length;
        const batchFailed = results.filter(r => r.success === false).length;
        
        imported += batchImported;
        failed += batchFailed;
        
        const progress = Math.round(((i + batch.length) / documents.length) * 100);
        console.log(`📈 Progress: ${progress}% (${imported} imported, ${failed} failed)`);
        
      } catch (error) {
        console.error(`❌ Batch import failed:`, error.message);
        failed += batch.length;
      }
    }
    
    console.log(`\n🎉 Sync completed!`);
    console.log(`   ✅ Successfully imported: ${imported} documents`);
    if (failed > 0) {
      console.log(`   ❌ Failed to import: ${failed} documents`);
    }
    
    return true;
    
  } catch (error) {
    console.error('❌ Failed to sync project data:', error.message);
    return false;
  }
}

async function getCollectionStatus() {
  try {
    const client = new Typesense.Client(typesenseConfig);
    const collection = await client.collections('projects').retrieve();
    console.log('📊 Collection Status:');
    console.log(`   Name: ${collection.name}`);
    console.log(`   Documents: ${collection.num_documents}`);
    console.log(`   Fields: ${collection.fields.length}`);
    
    // Show some example documents
    const docs = await client.collections('projects').documents().search({
      q: '*',
      per_page: 3
    });
    
    console.log(`\n📄 Sample documents (${docs.hits.length} shown):`);
    docs.hits.forEach((hit, index) => {
      const doc = hit.document;
      console.log(`   ${index + 1}. ${doc.iso}-${doc.queueid}: ${doc.project_name || 'Unnamed'} (${doc.gentype || 'Unknown type'})`);
    });
    
    return true;
  } catch (error) {
    if (error.httpStatus === 404) {
      console.log('ℹ️  Collection "projects" does not exist');
      return false;
    }
    console.error('❌ Failed to get collection status:', error.message);
    return false;
  }
}

async function main() {
  const command = process.argv[2] || 'sync';
  
  console.log(`🚀 PowerNOVA Typesense Sync Tool`);
  console.log(`Command: ${command}\n`);
  
  // Check Typesense connection first
  const connected = await checkTypesenseConnection();
  if (!connected) {
    process.exit(1);
  }
  
  switch (command.toLowerCase()) {
    case 'setup':
      console.log('🔄 Setting up Typesense collection...');
      await dropCollection();
      await createCollection();
      await syncProjectData();
      break;
      
    case 'sync':
      console.log('🔄 Syncing project data...');
      await createCollection(); // Create if doesn't exist
      await syncProjectData();
      break;
      
    case 'drop':
      console.log('🗑️  Dropping collection...');
      await dropCollection();
      break;
      
    case 'status':
      console.log('📊 Checking collection status...');
      await getCollectionStatus();
      break;
      
    default:
      console.log(`❌ Unknown command: ${command}`);
      console.log(`Available commands: setup, sync, drop, status`);
      process.exit(1);
  }
  
  console.log('\n✨ Done!');
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
}

module.exports = {
  checkTypesenseConnection,
  dropCollection,
  createCollection,
  syncProjectData,
  getCollectionStatus
};
