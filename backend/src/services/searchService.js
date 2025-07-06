const Typesense = require('typesense');

class SearchService {
  constructor() {
    this.client = null;
    this.isEnabled = false;
    
    // Only initialize Typesense if all required config is present
    if (process.env.TYPESENSE_API_KEY && 
        process.env.TYPESENSE_HOST && 
        process.env.TYPESENSE_PORT) {
      
      try {
        this.client = new Typesense.Client({
          'api_key': process.env.TYPESENSE_API_KEY,
          'nodes': [{
            'host': process.env.TYPESENSE_HOST,
            'port': process.env.TYPESENSE_PORT,
            'protocol': process.env.TYPESENSE_PROTOCOL || 'http'
          }],
          'connection_timeout_seconds': 2
        });
        this.isEnabled = true;
        console.log('✅ Typesense search service initialized');
      } catch (error) {
        console.warn('⚠️  Typesense initialization failed:', error.message);
        this.isEnabled = false;
      }
    } else {
      console.log('ℹ️  Typesense search service disabled (missing configuration)');
    }

    this.schema = {
      'name': 'projects',
      'fields': [
        { 'name': 'iso', 'type': 'string' },
        { 'name': 'queueid', 'type': 'string'},
        { 'name': 'county', 'type': 'string' },
        { 'name': 'state', 'type': 'string' },
        { 'name': 'gentype', 'type': 'string' },
        { 'name': 'description', 'type': 'string' }
      ]
    };
  }

  async searchProjects(query, page = 1, perPage = 10) {
    if (!this.isEnabled) {
      throw new Error('Search service is not configured. Please set up Typesense configuration.');
    }

    try {
      const searchParameters = {
        'q': query,
        'query_by': 'iso,queueid,gentype,county,state,description',
        'page': page,
        'per_page': perPage
      };

      return await this.client.collections('projects').documents().search(searchParameters);
    } catch (error) {
      console.error('Search error:', error);
      throw new Error('Search service unavailable');
    }
  }

  async indexProject(project) {
    if (!this.isEnabled) {
      throw new Error('Search service is not configured');
    }

    try {
      return await this.client.collections('projects').documents().create(project);
    } catch (error) {
      console.error('Index error:', error);
      throw new Error('Failed to index project');
    }
  }

  async ensureCollection() {
    if (!this.isEnabled) {
      return;
    }

    try {
      // Check if collection exists
      await this.client.collections('projects').retrieve();
      console.log('Projects collection exists');
    } catch (error) {
      if (error.httpStatus === 404) {
        // Create collection if it doesn't exist
        console.log('Creating projects collection');
        await this.client.collections().create(this.schema);
      } else {
        throw error;
      }
    }
  }
}

module.exports = new SearchService();
