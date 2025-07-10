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

const ProjectStats = ({ projects }) => {
  const totalProjects = projects.length;
  const totalCapacity = projects.reduce((sum, p) => sum + (parseFloat(p.CapacityMW) || 0), 0);
  const avgSize = totalProjects > 0 ? totalCapacity / totalProjects : 0;

  const activeProjects = projects.filter(p => p.Status?.toUpperCase() === 'ACTIVE').length;

  return (
    <View style={styles.statsContainer}>
      <Text style={styles.sectionTitle}>Project Statistics</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalProjects.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Total Projects</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{activeProjects.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Active Projects</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalCapacity.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Total Capacity (MW)</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{avgSize.toFixed(1)}</Text>
          <Text style={styles.statLabel}>Avg. Size (MW)</Text>
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

const ProjectDashboard = ({ navigation, onClose }) => {
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedISO, setSelectedISO] = useState(null);
  const [error, setError] = useState(null);

  const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:9000';

  const fetchProjects = async (iso = null) => {
    if (!user) {
      console.log('No user authenticated, skipping fetch');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const token = await user.getIdToken();
      const url = iso 
        ? `${API_BASE_URL}/api/projects/projects/${iso}?limit=50`
        : `${API_BASE_URL}/api/projects/projects?limit=50`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setProjects(data.results || []);
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
    fetchProjects(iso);
  };

  const handleProjectPress = (project) => {
    navigation.navigate('ProjectDetails', { project });
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Separate effect to fetch projects when user is available
  useEffect(() => {
    if (user) {
      fetchProjects(null); // Fetch all projects initially
    }
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
    <ScrollView style={styles.container}>
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

      {projects.length > 0 && <ProjectStats projects={projects} />}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => fetchProjects(selectedISO)}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.projectsContainer}>
        <Text style={styles.sectionTitle}>
          Projects {selectedISO ? `(${selectedISO})` : '(All ISOs)'}
        </Text>
        
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
      </View>
    </ScrollView>
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
});

export default ProjectDashboard;
