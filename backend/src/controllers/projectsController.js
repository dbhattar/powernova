const express = require('express');
const router = express.Router();
const projectsService = require('../services/projectsService');
const searchService = require('../services/searchService');

// Get projects with optional ISO filter
router.get('/projects/:iso?', async (req, res) => {
  try {
    const { iso } = req.params;
    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 10;

    // Validate limit to prevent abuse
    if (limit > 100) {
      return res.status(400).json({ error: 'Limit cannot exceed 100' });
    }

    const result = await projectsService.getProjects(iso, offset, limit);
    res.json(result);
  } catch (error) {
    console.error('Error in projects endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get specific project details
router.get('/project-details', async (req, res) => {
  try {
    const { isoId, queueId } = req.query;

    if (!isoId || !queueId) {
      return res.status(400).json({ error: 'isoId and queueId are required' });
    }

    const project = await projectsService.getProjectDetails(isoId, queueId);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(project);
  } catch (error) {
    console.error('Error in project details endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search projects
router.get('/search', async (req, res) => {
  try {
    const { query, page, per_page } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Please specify a search query' });
    }

    const pageNum = parseInt(page) || 1;
    const perPage = parseInt(per_page) || 10;

    // Validate pagination parameters
    if (perPage > 50) {
      return res.status(400).json({ error: 'per_page cannot exceed 50' });
    }

    // Check if search service is enabled
    if (!searchService.isEnabled) {
      return res.status(503).json({ 
        error: 'Search service is not configured. Please set up Typesense configuration.',
        fallback: 'Use /projects endpoint with filters instead'
      });
    }

    const results = await searchService.searchProjects(query, pageNum, perPage);
    res.json(results);
  } catch (error) {
    console.error('Error in search endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get state information
router.get('/state/:stateId', async (req, res) => {
  try {
    const stateId = parseInt(req.params.stateId);
    const countyId = req.query.county_id ? parseInt(req.query.county_id) : null;

    const result = await projectsService.getStateInfo(stateId, countyId);
    res.json(result);
  } catch (error) {
    console.error('Error in state endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get county map data
router.get('/gis/county-map', async (req, res) => {
  try {
    const result = await projectsService.getCountyMap();
    res.json(result);
  } catch (error) {
    console.error('Error in county map endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get RTO/ISO map data
router.get('/gis/rto-iso-map/:rtoIso?', async (req, res) => {
  try {
    const { rtoIso } = req.params;
    const result = await projectsService.getRtoIsoMap(rtoIso);
    res.json(result);
  } catch (error) {
    console.error('Error in RTO/ISO map endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check for projects service
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'projects',
    timestamp: new Date().toISOString() 
  });
});

// Test endpoint (no auth required) - remove this after testing
router.get('/test-db', async (req, res) => {
  try {
    const { query } = require('../config/database');
    await query('SELECT 1 as test');
    res.json({ 
      status: 'ok', 
      database: 'connected',
      message: 'Database connection successful'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      database: 'disconnected',
      message: error.message 
    });
  }
});

module.exports = router;
