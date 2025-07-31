import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { API_BASE_URL } from '../config/constants';
const { width, height } = Dimensions.get('window');

const ISOSelector = ({ selectedISO, onISOChange }) => {
  const isos = ['CAISO', 'PJM', 'ERCOT', 'MISO', 'ISONE', 'NYISO', 'SPP'];

  return (
    <View style={styles.isoContainer}>
      <Text style={styles.sectionTitle}>Select ISO/RTO</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.isoScrollView}
      >
        <View style={styles.isoButtonContainer}>
          {isos.map((iso) => (
            <TouchableOpacity
              key={iso}
              style={[
                styles.isoButton,
                selectedISO === iso && styles.isoButtonSelected
              ]}
              onPress={() => onISOChange(selectedISO === iso ? null : iso)}
            >
              <Text style={[
                styles.isoButtonText,
                selectedISO === iso && styles.isoButtonTextSelected
              ]}>
                {iso}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const ProjectStats = ({ statistics, loading }) => {
  if (loading || !statistics) {
    return (
      <View style={styles.statsContainer}>
        <Text style={styles.sectionTitle}>Project Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <ActivityIndicator size="small" color="#3B82F6" />
            <Text style={styles.statLabel}>Loading...</Text>
          </View>
        </View>
      </View>
    );
  }

  const { overview } = statistics;

  return (
    <View style={styles.statsContainer}>
      <Text style={styles.sectionTitle}>Project Statistics</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{overview.totalProjects.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Total Projects</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{overview.activeProjects.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Active Projects</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{Math.round(overview.totalCapacityMW).toLocaleString()}</Text>
          <Text style={styles.statLabel}>Total Capacity (MW)</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{overview.avgCapacityMW.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Avg. Size (MW)</Text>
        </View>
      </View>
      
      {/* Additional stats row */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{overview.withdrawnProjects.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Withdrawn</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{overview.suspendedProjects.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Suspended</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{overview.uniqueStates}</Text>
          <Text style={styles.statLabel}>States</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{overview.uniqueGenerationTypes}</Text>
          <Text style={styles.statLabel}>Gen Types</Text>
        </View>
      </View>
    </View>
  );
};

const ProjectItem = ({ project, onPress }) => {
  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE':
        return '#10B981';
      case 'WITHDRAWN':
        return '#EF4444';
      case 'SUSPENDED':
        return '#F59E0B';
      default:
        return '#6B7280';
    }
  };

  return (
    <TouchableOpacity style={styles.projectItem} onPress={() => onPress(project)}>
      <View style={styles.projectHeader}>
        <Text style={styles.projectName} numberOfLines={2}>
          {project.ProjectName || 'Unnamed Project'}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(project.Status) }]}>
          <Text style={styles.statusText}>{project.Status || 'Unknown'}</Text>
        </View>
      </View>
      
      <View style={styles.projectDetails}>
        <Text style={styles.projectDetail}>
          <Text style={styles.projectLabel}>Queue ID:</Text> {project.QueueID}
        </Text>
        <Text style={styles.projectDetail}>
          <Text style={styles.projectLabel}>ISO:</Text> {project.IsoID}
        </Text>
        <Text style={styles.projectDetail}>
          <Text style={styles.projectLabel}>Type:</Text> {project.GenerationType || 'N/A'}
        </Text>
        <Text style={styles.projectDetail}>
          <Text style={styles.projectLabel}>Capacity:</Text> {project.CapacityMW || 'N/A'} MW
        </Text>
        <Text style={styles.projectDetail}>
          <Text style={styles.projectLabel}>Location:</Text> {project.County}, {project.StateName}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const PaginationControls = ({ currentPage, totalProjects, projectsPerPage, onPageChange, loading }) => {
  const totalPages = Math.ceil(totalProjects / projectsPerPage);
  const startProject = (currentPage - 1) * projectsPerPage + 1;
  const endProject = Math.min(currentPage * projectsPerPage, totalProjects);

  if (totalPages <= 1) return null;

  return (
    <View style={styles.paginationContainer}>
      <View style={styles.paginationInfo}>
        <Text style={styles.paginationText}>
          Showing {startProject}-{endProject} of {totalProjects.toLocaleString()} projects
        </Text>
      </View>
      
      <View style={styles.paginationControls}>
        <TouchableOpacity
          style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
          onPress={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1 || loading}
        >
          <Ionicons name="chevron-back" size={18} color={currentPage === 1 ? "#9CA3AF" : "#3B82F6"} />
          <Text style={[styles.paginationButtonText, currentPage === 1 && styles.paginationButtonTextDisabled]}>
            Previous
          </Text>
        </TouchableOpacity>

        <View style={styles.pageIndicator}>
          <Text style={styles.pageText}>
            Page {currentPage} of {totalPages}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.paginationButton, currentPage === totalPages && styles.paginationButtonDisabled]}
          onPress={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || loading}
        >
          <Text style={[styles.paginationButtonText, currentPage === totalPages && styles.paginationButtonTextDisabled]}>
            Next
          </Text>
          <Ionicons name="chevron-forward" size={18} color={currentPage === totalPages ? "#9CA3AF" : "#3B82F6"} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const ProjectDashboard = ({ navigation, onClose }) => {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [selectedISO, setSelectedISO] = useState(null);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProjects, setTotalProjects] = useState(0);
  const [selectedProject, setSelectedProject] = useState(null);
  const [showProjectDetails, setShowProjectDetails] = useState(false);
  const [projectDetailsLoading, setProjectDetailsLoading] = useState(false);
  const [additionalInfo, setAdditionalInfo] = useState(null);
  const projectsPerPage = 50;


  const fetchStatistics = async (iso = null) => {
    setStatsLoading(true);
    try {
      const url = iso 
        ? `${API_BASE_URL}/api/projects/statistics/${iso}`
        : `${API_BASE_URL}/api/projects/statistics`;
      
      const headers = {
        'Content-Type': 'application/json',
      };

      // Add auth token if user is logged in
      if (user) {
        const token = await user.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setStatistics(data);
    } catch (err) {
      console.error('Error fetching statistics:', err);
      // Don't show error for statistics - it's supplementary info
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchProjects = async (iso = null, page = 1) => {
    setLoading(true);
    setError(null);
    
    try {
      const offset = (page - 1) * projectsPerPage;
      const url = iso 
        ? `${API_BASE_URL}/api/projects/projects/${iso}?limit=${projectsPerPage}&offset=${offset}`
        : `${API_BASE_URL}/api/projects/projects?limit=${projectsPerPage}&offset=${offset}`;
      
      const headers = {
        'Content-Type': 'application/json',
      };

      // Add auth token if user is logged in
      if (user) {
        const token = await user.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setProjects(data.results || []);
      setTotalProjects(data.count || 0);
    } catch (err) {
      console.error('Error fetching projects:', err);
      setError(err.message);
      Alert.alert('Error', 'Failed to load projects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleISOChange = (iso) => {
    setSelectedISO(iso);
    setCurrentPage(1);
    fetchProjects(iso, 1);
    fetchStatistics(iso);
  };

  const handleProjectPress = async (project) => {
    setSelectedProject(project);
    setShowProjectDetails(true);
    
    // Fetch additional project details
    await fetchProjectDetails(project);
  };

  const fetchProjectDetails = async (project) => {
    if (!project.IsoID || !project.QueueID) return;

    setProjectDetailsLoading(true);
    try {
      const headers = {
        'Content-Type': 'application/json',
      };

      // Add auth token if user is logged in
      if (user) {
        const token = await user.getIdToken();
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${API_BASE_URL}/api/projects/project-details?isoId=${project.IsoID}&queueId=${project.QueueID}`,
        { headers }
      );

      if (response.ok) {
        const detailedProject = await response.json();
        setSelectedProject(detailedProject);
        
        // Parse additional info if available
        if (detailedProject.AdditionalInfo) {
          try {
            const parsed = typeof detailedProject.AdditionalInfo === 'string' 
              ? JSON.parse(detailedProject.AdditionalInfo)
              : detailedProject.AdditionalInfo;
            setAdditionalInfo(parsed);
          } catch (e) {
            console.log('Could not parse additional info:', e);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching project details:', error);
    } finally {
      setProjectDetailsLoading(false);
    }
  };

  const closeProjectDetails = () => {
    setShowProjectDetails(false);
    setSelectedProject(null);
    setAdditionalInfo(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE':
        return '#10B981';
      case 'WITHDRAWN':
        return '#EF4444';
      case 'SUSPENDED':
        return '#F59E0B';
      case 'COMPLETED':
        return '#8B5CF6';
      default:
        return '#6B7280';
    }
  };

  const renderDetailSection = (title, data) => {
    const validFields = Object.entries(data).filter(([key, value]) => 
      value !== null && value !== undefined && value !== '' && value !== 'N/A'
    );

    if (validFields.length === 0) return null;

    return (
      <View style={styles.detailSection}>
        <Text style={styles.detailSectionTitle}>{title}</Text>
        <View style={styles.detailSectionContent}>
          {validFields.map(([key, value], index) => (
            <View key={key} style={[styles.detailRow, index < validFields.length - 1 && styles.detailRowWithBorder]}>
              <Text style={styles.detailLabel}>{key.replace(/([A-Z])/g, ' $1').trim()}:</Text>
              <Text style={styles.detailValue}>{value?.toString() || 'N/A'}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderAdditionalInfo = () => {
    if (!additionalInfo || typeof additionalInfo !== 'object') return null;

    const entries = Object.entries(additionalInfo).filter(([key, value]) => 
      value !== null && value !== undefined && value !== '' && key !== 'id'
    );

    if (entries.length === 0) return null;

    return (
      <View style={styles.detailSection}>
        <Text style={styles.detailSectionTitle}>Additional Information</Text>
        <View style={styles.detailSectionContent}>
          {entries.map(([key, value], index) => (
            <View key={key} style={[styles.detailRow, index < entries.length - 1 && styles.detailRowWithBorder]}>
              <Text style={styles.detailLabel}>{key}:</Text>
              <Text style={styles.detailValue}>{value?.toString() || 'N/A'}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= Math.ceil(totalProjects / projectsPerPage)) {
      setCurrentPage(newPage);
      fetchProjects(selectedISO, newPage);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Fetch initial data when user is available
  useEffect(() => {
      fetchProjects(null, 1);
      fetchStatistics(null);
  }, [user]);

  if (loading && projects.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Loading projects...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        {/* Main Dashboard Area */}
        <View style={[styles.dashboardArea, showProjectDetails && styles.dashboardAreaWithPanel]}>
          <ScrollView style={styles.scrollContainer}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Power Project Dashboard</Text>
            <Text style={styles.subtitle}>
              Explore interconnection queues across ISOs and RTOs
            </Text>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={styles.searchButton}
              onPress={() => navigation.navigate('ProjectSearch')}
            >
              <Text style={styles.searchButtonText}>Search</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ISOSelector selectedISO={selectedISO} onISOChange={handleISOChange} />

      <ProjectStats statistics={statistics} loading={statsLoading} />

      {/* Sign-in prompt for enhanced features */}
      {!user && (
        <View style={styles.signInPrompt}>
          <Ionicons name="star-outline" size={24} color="#007AFF" />
          <Text style={styles.signInPromptTitle}>Unlock Premium Features</Text>
          <Text style={styles.signInPromptText}>
            Sign in to access AI chat, document analysis, personalized dashboards, and more!
          </Text>
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => {
              fetchProjects(selectedISO, currentPage);
              fetchStatistics(selectedISO);
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.projectsContainer}>
        <Text style={styles.sectionTitle}>
          Projects {selectedISO ? `(${selectedISO})` : '(All ISOs)'}
        </Text>
        
        {totalProjects > 0 && (
          <PaginationControls
            currentPage={currentPage}
            totalProjects={totalProjects}
            projectsPerPage={projectsPerPage}
            onPageChange={handlePageChange}
            loading={loading}
          />
        )}
        
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color="#3B82F6" />
          </View>
        )}

        {projects.length === 0 && !loading && (
          <Text style={styles.noProjectsText}>
            No projects found. Try selecting a different ISO.
          </Text>
        )}

        {projects.map((project, index) => (
          <ProjectItem
            key={`${project.IsoID}-${project.QueueID}-${index}`}
            project={project}
            onPress={handleProjectPress}
          />
        ))}

        <PaginationControls 
          currentPage={currentPage}
          totalProjects={totalProjects}
          projectsPerPage={projectsPerPage}
          onPageChange={handlePageChange}
          loading={loading}
        />
      </View>
        </ScrollView>
      </View>

      {/* Side Panel for Project Details */}
      {showProjectDetails && (
        <View style={styles.detailsPanel}>
          <View style={styles.detailsHeader}>
            <View style={styles.detailsHeaderContent}>
              <Text style={styles.detailsTitle}>
                {selectedProject?.GenerationProjectName || selectedProject?.ProjectName || 'Unnamed Project'}
              </Text>
              <TouchableOpacity onPress={() => setShowProjectDetails(false)} style={styles.detailsCloseButton}>
                <Ionicons name="close" size={24} color="#007AFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.detailsHeaderInfo}>
              <Text style={styles.detailsSubtitle}>
                Queue ID: {selectedProject?.QueueID} • ISO: {selectedProject?.IsoID}
              </Text>
              <View style={[styles.detailsStatusBadge, { backgroundColor: getStatusColor(selectedProject?.ProjectStatus || selectedProject?.Status) }]}>
                <Text style={styles.detailsStatusText}>{selectedProject?.ProjectStatus || selectedProject?.Status || 'Unknown'}</Text>
              </View>
            </View>
          </View>

          <ScrollView style={styles.detailsContent}>
            {projectDetailsLoading && (
              <View style={styles.detailsLoadingOverlay}>
                <ActivityIndicator size="small" color="#3B82F6" />
                <Text style={styles.detailsLoadingText}>Loading details...</Text>
              </View>
            )}

            {selectedProject && (
              <>
                {/* Basic Information */}
                {renderDetailSection('Basic Information', {
                  'Max Capacity (MW)': selectedProject.MaxCapacityMW,
                  'Summer Capacity (MW)': selectedProject.SummerCapacityMW,
                  'Winter Capacity (MW)': selectedProject.WinterCapacityMW,
                  'Fuel Type': selectedProject.FuelType,
                  'Technology Type': selectedProject.TechnologyType,
                  'Generation Type': selectedProject.GenerationType,
                })}

                {/* Location */}
                {renderDetailSection('Location', {
                  'County': selectedProject.County,
                  'State': selectedProject.State || selectedProject.StateName,
                  'Zip Code': selectedProject.ZipCode,
                  'Point of Interconnection': selectedProject.PointOfInterconnection,
                  'Transmission Owner': selectedProject.TransmissionOwner,
                })}

                {/* Interconnection Details */}
                {renderDetailSection('Interconnection Details', {
                  'Interconnection Service Type': selectedProject.InterconnectionServiceType,
                  'Voltage Level': selectedProject.VoltageLevel ? `${selectedProject.VoltageLevel} kV` : null,
                  'Interconnecting Entity': selectedProject.InterconnectingEntity,
                })}

                {/* Timeline */}
                {renderDetailSection('Timeline', {
                  'Queue Date': formatDate(selectedProject.QueueDate),
                  'Commercial Operation Date': formatDate(selectedProject.CommercialOperationDate),
                  'Initial Synchronization Date': formatDate(selectedProject.InitialSynchronizationDate),
                  'Withdrawn Date': formatDate(selectedProject.WithdrawnDate),
                })}

                {/* Withdrawal Information */}
                {selectedProject.WithdrawalComment && (
                  <View style={styles.detailSection}>
                    <Text style={styles.detailSectionTitle}>Withdrawal Information</Text>
                    <View style={styles.detailSectionContent}>
                      <Text style={styles.withdrawalComment}>{selectedProject.WithdrawalComment}</Text>
                    </View>
                  </View>
                )}

                {/* Additional Information */}
                {renderAdditionalInfo()}
              </>
            )}
          </ScrollView>
        </View>
      )}
    </View>
  </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 20,
    paddingTop: 40,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerText: {
    flex: 1,
    marginRight: 16,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  searchButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  isoContainer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  isoScrollView: {
    marginHorizontal: -20,
  },
  isoButtonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
  },
  isoButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    minWidth: 80,
    alignItems: 'center',
  },
  isoButtonSelected: {
    backgroundColor: '#1D4ED8',
    borderWidth: 2,
    borderColor: '#DC2626',
  },
  isoButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  isoButtonTextSelected: {
    color: '#FFFFFF',
  },
  statsContainer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: (width - 64) / 2,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3B82F6',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
  projectsContainer: {
    padding: 20,
  },
  projectItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  projectName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    marginRight: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  projectDetails: {
    gap: 4,
  },
  projectDetail: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  projectLabel: {
    fontWeight: '600',
    color: '#1F2937',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  loadingOverlay: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  noProjectsText: {
    textAlign: 'center',
    fontSize: 16,
    color: '#6B7280',
    fontStyle: 'italic',
    paddingVertical: 32,
  },
  errorContainer: {
    padding: 20,
    backgroundColor: '#FEF2F2',
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  // Pagination styles
  paginationContainer: {
    backgroundColor: '#F9FAFB',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  paginationInfo: {
    alignItems: 'center',
    marginBottom: 12,
  },
  paginationText: {
    fontSize: 14,
    color: '#6B7280',
  },
  paginationControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    gap: 4,
  },
  paginationButtonDisabled: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  paginationButtonText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  paginationButtonTextDisabled: {
    color: '#9CA3AF',
  },
  // Sign-in prompt styles
  signInPrompt: {
    backgroundColor: '#F0F8FF',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    alignItems: 'center',
    gap: 8,
  },
  signInPromptTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  signInPromptText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
    lineHeight: 20,
  },
  // Layout styles
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  dashboardArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  dashboardAreaWithPanel: {
    flex: 0.6, // Takes 60% of width when panel is open
  },
  scrollContainer: {
    flex: 1,
  },
  // Side panel styles
  detailsPanel: {
    flex: 0.4, // Takes 40% of width
    backgroundColor: '#FFFFFF',
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  detailsHeader: {
    padding: 20,
    paddingTop: 40,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  detailsHeaderContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    marginRight: 12,
  },
  detailsCloseButton: {
    padding: 8,
  },
  detailsHeaderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailsSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
  },
  detailsStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  detailsStatusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  detailsContent: {
    flex: 1,
    padding: 20,
  },
  detailsLoadingOverlay: {
    alignItems: 'center',
    padding: 20,
  },
  detailsLoadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#6B7280',
  },
  detailSection: {
    marginBottom: 20,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  detailSectionContent: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
  },
  detailRowWithBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  detailValue: {
    flex: 1,
    fontSize: 14,
    color: '#1F2937',
    textAlign: 'right',
  },
  withdrawalComment: {
    fontSize: 14,
    color: '#1F2937',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
});

export default ProjectDashboard;
