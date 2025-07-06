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
      console.log('Search service unavailable, returning mock search results');
      return this.getMockSearchResults(query, page, perPage);
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
      console.log('Returning mock search results due to search service error');
      return this.getMockSearchResults(query, page, perPage);
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

  getMockSearchResults(query, page = 1, perPage = 10) {
    const mockResults = [
      {
        document: {
          id: 'mock1',
          iso: 'CAISO',
          queueid: 'MOCK001',
          county: 'Riverside',
          state: 'California',
          gentype: 'Solar',
          description: 'Demo Solar Project Alpha - 150MW solar installation'
        },
        highlight: {},
        highlights: []
      },
      {
        document: {
          id: 'mock2',
          iso: 'PJM',
          queueid: 'MOCK002',
          county: 'Lancaster',
          state: 'Pennsylvania',
          gentype: 'Wind',
          description: 'Demo Wind Farm Beta - 200MW wind energy project'
        },
        highlight: {},
        highlights: []
      },
      {
        document: {
          id: 'mock3',
          iso: 'ERCOT',
          queueid: 'MOCK003',
          county: 'Travis',
          state: 'Texas',
          gentype: 'Battery Storage',
          description: 'Demo Battery Storage Gamma - 100MW energy storage system'
        },
        highlight: {},
        highlights: []
      },
      {
        document: {
          id: 'mock4',
          iso: 'MISO',
          queueid: 'MOCK004',
          county: 'Cook',
          state: 'Illinois',
          gentype: 'Hydroelectric',
          description: 'Demo Hydroelectric Delta - 75MW hydroelectric facility'
        },
        highlight: {},
        highlights: []
      },
      {
        document: {
          id: 'mock5',
          iso: 'ISONE',
          queueid: 'MOCK005',
          county: 'Barnstable',
          state: 'Massachusetts',
          gentype: 'Offshore Wind',
          description: 'Demo Offshore Wind Epsilon - 400MW offshore wind farm'
        },
        highlight: {},
        highlights: []
      }
    ];

    // Filter results based on query
    const filteredResults = mockResults.filter(result => {
      const searchableText = [
        result.document.iso,
        result.document.queueid,
        result.document.county,
        result.document.state,
        result.document.gentype,
        result.document.description
      ].join(' ').toLowerCase();
      
      return searchableText.includes(query.toLowerCase());
    });

    // Apply pagination
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginatedResults = filteredResults.slice(startIndex, endIndex);

    return {
      facet_counts: [],
      found: filteredResults.length,
      hits: paginatedResults,
      out_of: filteredResults.length,
      page: page,
      request_params: {
        collection_name: 'projects',
        per_page: perPage,
        q: query
      },
      search_cutoff: false,
      search_time_ms: 1
    };
  }
}

module.exports = new SearchService();
