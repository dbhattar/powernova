const request = require('supertest');
const app = require('../src/app');

describe('Projects API', () => {
  describe('GET /api/projects/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/projects/health')
        .expect(200);
      
      expect(response.body.status).toBe('ok');
      expect(response.body.service).toBe('projects');
    });
  });

  describe('GET /api/projects/projects', () => {
    it('should require authentication', async () => {
      await request(app)
        .get('/api/projects/projects')
        .expect(401);
    });

    it('should return 400 for invalid limit', async () => {
      // Mock authentication middleware for testing
      const mockAuth = jest.fn((req, res, next) => {
        req.user = { uid: 'test-user' };
        next();
      });
      
      app.use('/api/projects', mockAuth);
      
      await request(app)
        .get('/api/projects/projects?limit=1000')
        .expect(400);
    });
  });

  describe('GET /api/projects/search', () => {
    it('should require query parameter', async () => {
      // Mock authentication
      const mockAuth = jest.fn((req, res, next) => {
        req.user = { uid: 'test-user' };
        next();
      });
      
      app.use('/api/projects', mockAuth);
      
      await request(app)
        .get('/api/projects/search')
        .expect(400);
    });
  });

  describe('GET /api/projects/project-details', () => {
    it('should require isoId and queueId parameters', async () => {
      // Mock authentication
      const mockAuth = jest.fn((req, res, next) => {
        req.user = { uid: 'test-user' };
        next();
      });
      
      app.use('/api/projects', mockAuth);
      
      await request(app)
        .get('/api/projects/project-details')
        .expect(400);
    });
  });
});

// Mock database and search services for testing
jest.mock('../src/config/database', () => ({
  query: jest.fn()
}));

jest.mock('../src/services/searchService', () => ({
  searchProjects: jest.fn(),
  ensureCollection: jest.fn()
}));

jest.mock('../src/services/projectsService', () => ({
  getProjects: jest.fn(),
  getProjectDetails: jest.fn(),
  getStateInfo: jest.fn(),
  getCountyMap: jest.fn(),
  getRtoIsoMap: jest.fn()
}));
