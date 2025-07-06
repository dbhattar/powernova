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
        countQuery = "SELECT COUNT(*) FROM QueueInfo WHERE UPPER(Status) = 'ACTIVE' AND IsoID = $1";
        dataQuery = `SELECT * FROM QueueInfo WHERE UPPER(Status) = 'ACTIVE' AND IsoID = $1 
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
      console.error('Error fetching projects:', error);
      throw new Error('Failed to fetch projects');
    }
  }

  async getProjectDetails(isoId, queueId) {
    try {
      const result = await query(
        "SELECT * FROM QueueInfo WHERE IsoId = $1 AND QueueId = $2",
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
      console.error('Error fetching project details:', error);
      throw new Error('Failed to fetch project details');
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
}

module.exports = new ProjectsService();
