const { query } = require('../config/database');
const fs = require('fs');
const path = require('path');

class ProjectsService {
  constructor() {
    // Cache for static data
    this.stateCodes = null;
    this.countyMap = null;
    this.isoRtoMap = null;
    this.dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
  }

  async getProjects(iso = null, offset = 0, limit = 10) {
    try {
      let countQuery, dataQuery;
      let params = [];

      if (iso) {
        countQuery = "SELECT COUNT(*) FROM QueueInfo WHERE UPPER(Status) = 'ACTIVE' AND UPPER(IsoID) = UPPER($1)";
        dataQuery = `SELECT * FROM QueueInfo WHERE UPPER(Status) = 'ACTIVE' AND UPPER(IsoID) = UPPER($1) 
                     ORDER BY QueueDate DESC LIMIT $2 OFFSET $3`;
        params = [iso, limit, offset];
      } else {
        countQuery = "SELECT COUNT(*) FROM QueueInfo WHERE UPPER(Status) = 'ACTIVE'";
        dataQuery = `SELECT * FROM QueueInfo WHERE UPPER(Status) = 'ACTIVE' 
                     ORDER BY QueueDate DESC LIMIT $1 OFFSET $2`;
        params = [limit, offset];
      }

      const countResult = await query(countQuery, iso ? [iso] : []);
      const count = parseInt(countResult.rows[0].count);

      const dataResult = await query(dataQuery, params);
      
      const projects = dataResult.rows.map(row => ({
        IsoID: row.isoid,
        QueueID: row.queueid,
        ProjectName: row.projectname,
        InterconnectingEntity: row.interconnectingentity,
        County: row.county,
        StateName: row.statename,
        InterconnectionLocation: row.interconnectionlocation,
        TransmissionOwner: row.transmissionowner,
        GenerationType: row.generationtype,
        CapacityMW: row.capacitymw,
        SummerCapacity: row.summercapacity,
        WinterCapacityMW: row.wintercapacitymw,
        QueueDate: row.queuedate,
        Status: row.status,
        ProposedCompletionDate: row.proposedcompletiondate,
        WithdrawnDate: row.withdrawndate,
        WithdrawalComment: row.withdrawalcomment,
        ActualCompletionDate: row.actualcompletiondate,
        AdditionalInfo: row.additionalinfo
      }));

      return {
        count,
        results: projects
      };
    } catch (error) {
      console.error('Database query error:', error.message);
      console.log('Returning mock data due to database unavailability');
      
      // Return mock data when database is unavailable
      return this.getMockProjects(iso, offset, limit);
    }
  }

  async getProjectDetails(isoId, queueId) {
    try {
      const result = await query(
        "SELECT * FROM QueueInfo WHERE UPPER(IsoId) = UPPER($1) AND UPPER(QueueId) = UPPER($2)",
        [isoId, queueId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        IsoID: row.isoid,
        QueueID: row.queueid,
        ProjectName: row.projectname,
        InterconnectingEntity: row.interconnectingentity,
        County: row.county,
        StateName: row.statename,
        InterconnectionLocation: row.interconnectionlocation,
        TransmissionOwner: row.transmissionowner,
        GenerationType: row.generationtype,
        CapacityMW: row.capacitymw,
        SummerCapacity: row.summercapacity,
        WinterCapacityMW: row.wintercapacitymw,
        QueueDate: row.queuedate,
        Status: row.status,
        ProposedCompletionDate: row.proposedcompletiondate,
        WithdrawnDate: row.withdrawndate,
        WithdrawalComment: row.withdrawalcomment,
        ActualCompletionDate: row.actualcompletiondate,
        AdditionalInfo: row.additionalinfo
      };
    } catch (error) {
      console.error('Database query error:', error.message);
      console.log('Returning mock project details due to database unavailability');
      
      // Return mock project details when database is unavailable
      return this.getMockProjectDetails(isoId, queueId);
    }
  }

  async getStateInfo(stateId, countyId = null) {
    try {
      if (!this.stateCodes) {
        const stateCodesPath = path.join(this.dataDir, 'gis', 'state_codes.json');
        if (fs.existsSync(stateCodesPath)) {
          this.stateCodes = JSON.parse(fs.readFileSync(stateCodesPath, 'utf8'));
        } else {
          return { error: 'State codes data not found' };
        }
      }

      const stateInfo = this.stateCodes.find(obj => {
        if (!countyId || countyId === 0) {
          return obj.StateCode === stateId && obj.CountyCode === 0;
        } else {
          return obj.StateCode === stateId && obj.CountyCode === countyId;
        }
      });

      if (!stateInfo) {
        return { error: 'Not found' };
      }

      if (!countyId || countyId === 0) {
        return { state_name: stateInfo.Name };
      } else {
        return { county_name: stateInfo.Name };
      }
    } catch (error) {
      console.error('Error fetching state info:', error);
      throw new Error('Failed to fetch state information');
    }
  }

  async getCountyMap() {
    try {
      if (!this.countyMap) {
        const countyMapPath = path.join(this.dataDir, 'gis', 'cb_2018_us_county_500k', 'us_county.json');
        if (fs.existsSync(countyMapPath)) {
          console.log('Loading county map...');
          this.countyMap = JSON.parse(fs.readFileSync(countyMapPath, 'utf8'));
          console.log('County map loaded');
        } else {
          return { error: 'County map data not found' };
        }
      }
      return this.countyMap;
    } catch (error) {
      console.error('Error loading county map:', error);
      throw new Error('Failed to load county map');
    }
  }

  async getRtoIsoMap(rtoIso = null) {
    try {
      if (!this.isoRtoMap) {
        const isoRtoMapPath = path.join(this.dataDir, 'gis', 'RTO_Regions.geojson');
        if (fs.existsSync(isoRtoMapPath)) {
          console.log('Loading RTO/ISO map...');
          this.isoRtoMap = JSON.parse(fs.readFileSync(isoRtoMapPath, 'utf8'));
          console.log('RTO/ISO map loaded');
        } else {
          return { error: 'RTO/ISO map data not found' };
        }
      }

      if (!rtoIso) {
        return this.isoRtoMap;
      }

      // Filter for specific RTO/ISO
      const result = {
        type: "FeatureCollection",
        name: rtoIso,
        crs: {
          type: "name",
          properties: {
            name: "urn:ogc:def:crs:OGC:1.3:CRS84"
          }
        },
        features: []
      };

      const filteredFeatures = this.isoRtoMap.features.filter(
        feature => feature.properties.RTO_ISO.toLowerCase() === rtoIso.toLowerCase()
      );

      result.features = filteredFeatures;
      return result;
    } catch (error) {
      console.error('Error loading RTO/ISO map:', error);
      throw new Error('Failed to load RTO/ISO map');
    }
  }

  async getProjectStatistics(iso = null) {
    try {
      let params = [];
      let whereClause = '';
      
      if (iso) {
        whereClause = 'WHERE UPPER(IsoID) = UPPER($1)';
        params = [iso];
      }

      // Get comprehensive statistics
      const statsQuery = `
        SELECT 
          COUNT(*) as total_projects,
          COUNT(CASE WHEN UPPER(Status) = 'ACTIVE' THEN 1 END) as active_projects,
          COUNT(CASE WHEN UPPER(Status) = 'WITHDRAWN' THEN 1 END) as withdrawn_projects,
          COUNT(CASE WHEN UPPER(Status) = 'SUSPENDED' THEN 1 END) as suspended_projects,
          SUM(CASE WHEN CapacityMW IS NOT NULL THEN CapacityMW ELSE 0 END) as total_capacity_mw,
          AVG(CASE WHEN CapacityMW IS NOT NULL AND CapacityMW > 0 THEN CapacityMW END) as avg_capacity_mw,
          COUNT(DISTINCT IsoID) as unique_isos,
          COUNT(DISTINCT StateName) as unique_states,
          COUNT(DISTINCT GenerationType) as unique_generation_types
        FROM QueueInfo 
        ${whereClause}
      `;

      const result = await query(statsQuery, params);
      const stats = result.rows[0];

      // Get top generation types
      const genTypesQuery = `
        SELECT 
          GenerationType, 
          COUNT(*) as count,
          SUM(CASE WHEN CapacityMW IS NOT NULL THEN CapacityMW ELSE 0 END) as total_capacity
        FROM QueueInfo 
        ${whereClause}
        ${whereClause ? 'AND' : 'WHERE'} GenerationType IS NOT NULL 
        GROUP BY GenerationType 
        ORDER BY count DESC 
        LIMIT 10
      `;

      const genTypesResult = await query(genTypesQuery, params);

      // Get ISO breakdown if not filtering by ISO
      let isoBreakdown = [];
      if (!iso) {
        const isoQuery = `
          SELECT 
            IsoID, 
            COUNT(*) as count,
            COUNT(CASE WHEN UPPER(Status) = 'ACTIVE' THEN 1 END) as active_count,
            SUM(CASE WHEN CapacityMW IS NOT NULL THEN CapacityMW ELSE 0 END) as total_capacity
          FROM QueueInfo 
          GROUP BY IsoID 
          ORDER BY count DESC
        `;

        const isoResult = await query(isoQuery);
        isoBreakdown = isoResult.rows.map(row => ({
          iso: row.isoid,
          totalProjects: parseInt(row.count),
          activeProjects: parseInt(row.active_count),
          totalCapacity: parseFloat(row.total_capacity) || 0
        }));
      }

      return {
        overview: {
          totalProjects: parseInt(stats.total_projects),
          activeProjects: parseInt(stats.active_projects),
          withdrawnProjects: parseInt(stats.withdrawn_projects),
          suspendedProjects: parseInt(stats.suspended_projects),
          totalCapacityMW: parseFloat(stats.total_capacity_mw) || 0,
          avgCapacityMW: parseFloat(stats.avg_capacity_mw) || 0,
          uniqueISOs: parseInt(stats.unique_isos),
          uniqueStates: parseInt(stats.unique_states),
          uniqueGenerationTypes: parseInt(stats.unique_generation_types)
        },
        generationTypes: genTypesResult.rows.map(row => ({
          type: row.generationtype,
          count: parseInt(row.count),
          totalCapacity: parseFloat(row.total_capacity) || 0
        })),
        isoBreakdown: isoBreakdown
      };
    } catch (error) {
      console.error('Database query error in getProjectStatistics:', error.message);
      console.log('Returning mock statistics due to database unavailability');
      
      // Return mock statistics when database is unavailable
      return this.getMockStatistics(iso);
    }
  }

  getMockProjects(iso = null, offset = 0, limit = 10) {
    const mockProjects = [
      {
        IsoID: 'CAISO',
        QueueID: 'MOCK001',
        ProjectName: 'Demo Solar Project Alpha',
        InterconnectingEntity: 'Demo Solar Company',
        County: 'Riverside',
        StateName: 'California',
        InterconnectionLocation: 'Valley Center Substation',
        TransmissionOwner: 'SDG&E',
        GenerationType: 'Solar',
        CapacityMW: 150.0,
        SummerCapacity: 145.0,
        WinterCapacityMW: 150.0,
        QueueDate: '2023-01-15',
        Status: 'ACTIVE',
        ProposedCompletionDate: '2025-12-31',
        WithdrawnDate: null,
        WithdrawalComment: null,
        ActualCompletionDate: null,
        AdditionalInfo: 'Mock project for demonstration purposes'
      },
      {
        IsoID: 'PJM',
        QueueID: 'MOCK002',
        ProjectName: 'Demo Wind Farm Beta',
        InterconnectingEntity: 'Demo Wind Energy LLC',
        County: 'Lancaster',
        StateName: 'Pennsylvania',
        InterconnectionLocation: 'Conestoga Substation',
        TransmissionOwner: 'PPL Electric',
        GenerationType: 'Wind',
        CapacityMW: 200.0,
        SummerCapacity: 180.0,
        WinterCapacityMW: 200.0,
        QueueDate: '2023-03-20',
        Status: 'ACTIVE',
        ProposedCompletionDate: '2026-06-30',
        WithdrawnDate: null,
        WithdrawalComment: null,
        ActualCompletionDate: null,
        AdditionalInfo: 'Mock project for demonstration purposes'
      },
      {
        IsoID: 'ERCOT',
        QueueID: 'MOCK003',
        ProjectName: 'Demo Battery Storage Gamma',
        InterconnectingEntity: 'Demo Energy Storage Corp',
        County: 'Travis',
        StateName: 'Texas',
        InterconnectionLocation: 'Austin North Substation',
        TransmissionOwner: 'Austin Energy',
        GenerationType: 'Battery Storage',
        CapacityMW: 100.0,
        SummerCapacity: 100.0,
        WinterCapacityMW: 100.0,
        QueueDate: '2023-05-10',
        Status: 'ACTIVE',
        ProposedCompletionDate: '2025-09-15',
        WithdrawnDate: null,
        WithdrawalComment: null,
        ActualCompletionDate: null,
        AdditionalInfo: 'Mock project for demonstration purposes'
      },
      {
        IsoID: 'MISO',
        QueueID: 'MOCK004',
        ProjectName: 'Demo Hydroelectric Delta',
        InterconnectingEntity: 'Demo Hydro Solutions',
        County: 'Cook',
        StateName: 'Illinois',
        InterconnectionLocation: 'Chicago West Substation',
        TransmissionOwner: 'ComEd',
        GenerationType: 'Hydroelectric',
        CapacityMW: 75.0,
        SummerCapacity: 70.0,
        WinterCapacityMW: 75.0,
        QueueDate: '2023-07-01',
        Status: 'ACTIVE',
        ProposedCompletionDate: '2026-12-31',
        WithdrawnDate: null,
        WithdrawalComment: null,
        ActualCompletionDate: null,
        AdditionalInfo: 'Mock project for demonstration purposes'
      },
      {
        IsoID: 'ISONE',
        QueueID: 'MOCK005',
        ProjectName: 'Demo Offshore Wind Epsilon',
        InterconnectingEntity: 'Demo Offshore Wind Co',
        County: 'Barnstable',
        StateName: 'Massachusetts',
        InterconnectionLocation: 'Cape Cod Substation',
        TransmissionOwner: 'Eversource',
        GenerationType: 'Offshore Wind',
        CapacityMW: 400.0,
        SummerCapacity: 380.0,
        WinterCapacityMW: 400.0,
        QueueDate: '2023-09-15',
        Status: 'ACTIVE',
        ProposedCompletionDate: '2027-03-31',
        WithdrawnDate: null,
        WithdrawalComment: null,
        ActualCompletionDate: null,
        AdditionalInfo: 'Mock project for demonstration purposes'
      }
    ];

    // Filter by ISO if specified
    let filteredProjects = mockProjects;
    if (iso) {
      filteredProjects = mockProjects.filter(project => project.IsoID === iso);
    }

    // Apply pagination
    const startIndex = offset;
    const endIndex = offset + limit;
    const paginatedProjects = filteredProjects.slice(startIndex, endIndex);

    return {
      count: filteredProjects.length,
      results: paginatedProjects
    };
  }

  getMockProjectDetails(isoId, queueId) {
    const mockProjects = this.getMockProjects();
    const project = mockProjects.results.find(p => p.IsoID === isoId && p.QueueID === queueId);
    
    if (!project) {
      return {
        IsoID: isoId,
        QueueID: queueId,
        ProjectName: `Mock Project ${queueId}`,
        InterconnectingEntity: 'Demo Energy Company',
        County: 'Demo County',
        StateName: 'Demo State',
        InterconnectionLocation: 'Demo Substation',
        TransmissionOwner: 'Demo Transmission Co',
        GenerationType: 'Solar',
        CapacityMW: 100.0,
        SummerCapacity: 95.0,
        WinterCapacityMW: 100.0,
        QueueDate: '2023-01-01',
        Status: 'ACTIVE',
        ProposedCompletionDate: '2025-12-31',
        WithdrawnDate: null,
        WithdrawalComment: null,
        ActualCompletionDate: null,
        AdditionalInfo: 'Mock project details for demonstration purposes'
      };
    }
    
    return project;
  }

  getMockStatistics(iso = null) {
    const mockStats = {
      overview: {
        totalProjects: iso ? 1250 : 15000,
        activeProjects: iso ? 950 : 11200,
        withdrawnProjects: iso ? 200 : 2800,
        suspendedProjects: iso ? 100 : 1000,
        totalCapacityMW: iso ? 45000 : 425000,
        avgCapacityMW: iso ? 36 : 28.3,
        uniqueISOs: iso ? 1 : 8,
        uniqueStates: iso ? 3 : 35,
        uniqueGenerationTypes: iso ? 8 : 12
      },
      generationTypes: [
        { type: 'Solar', count: iso ? 450 : 6800, totalCapacity: iso ? 15000 : 180000 },
        { type: 'Wind', count: iso ? 380 : 4200, totalCapacity: iso ? 18000 : 185000 },
        { type: 'Battery Storage', count: iso ? 220 : 2100, totalCapacity: iso ? 8000 : 35000 },
        { type: 'Natural Gas', count: iso ? 120 : 1200, totalCapacity: iso ? 2500 : 18000 },
        { type: 'Hybrid', count: iso ? 80 : 700, totalCapacity: iso ? 1500 : 7000 }
      ],
      isoBreakdown: iso ? [] : [
        { iso: 'CAISO', totalProjects: 4200, activeProjects: 3100, totalCapacity: 125000 },
        { iso: 'ERCOT', totalProjects: 3800, activeProjects: 2900, totalCapacity: 110000 },
        { iso: 'PJM', totalProjects: 2100, activeProjects: 1600, totalCapacity: 85000 },
        { iso: 'MISO', totalProjects: 1900, activeProjects: 1400, totalCapacity: 65000 },
        { iso: 'NYISO', totalProjects: 1200, activeProjects: 950, totalCapacity: 25000 },
        { iso: 'SPP', totalProjects: 1100, activeProjects: 850, totalCapacity: 12000 },
        { iso: 'ISONE', totalProjects: 700, activeProjects: 400, totalCapacity: 3000 }
      ]
    };
    return mockStats;
  }
}

module.exports = new ProjectsService();
