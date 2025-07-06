import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking
} from 'react-native';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const ProjectDetails = ({ route, navigation }) => {
  const { project: initialProject } = route.params;
  const [user, setUser] = useState(null);
  const [project, setProject] = useState(initialProject);
  const [loading, setLoading] = useState(false);
  const [additionalInfo, setAdditionalInfo] = useState(null);

  const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3002';

  const fetchProjectDetails = async () => {
    if (!project.IsoID || !project.QueueID) return;
    if (!user) {
      console.log('No user authenticated, skipping fetch');
      return;
    }

    setLoading(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `${API_BASE_URL}/api/projects/project-details?isoId=${project.IsoID}&queueId=${project.QueueID}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const detailedProject = await response.json();
        setProject(detailedProject);
        
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
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchProjectDetails();
      }
    });
    return () => unsubscribe();
  }, []);

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

  const handleExternalLink = (url) => {
    if (url) {
      Linking.openURL(url).catch(err => {
        console.error('Error opening URL:', err);
        Alert.alert('Error', 'Could not open the link');
      });
    }
  };

  const renderDetailSection = (title, data) => {
    const validFields = Object.entries(data).filter(([key, value]) => 
      value !== null && value !== undefined && value !== '' && value !== 'N/A'
    );

    if (validFields.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionContent}>
          {validFields.map(([key, value]) => (
            <View key={key} style={styles.detailRow}>
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
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Additional Information</Text>
        <View style={styles.sectionContent}>
          {entries.map(([key, value]) => (
            <View key={key} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{key}:</Text>
              <Text style={styles.detailValue}>{value?.toString() || 'N/A'}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#3B82F6" />
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.projectName}>
            {project.ProjectName || 'Unnamed Project'}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(project.Status) }]}>
            <Text style={styles.statusText}>{project.Status || 'Unknown'}</Text>
          </View>
        </View>
        <Text style={styles.projectSubtitle}>
          Queue ID: {project.QueueID} • ISO: {project.IsoID}
        </Text>
      </View>

      {/* Basic Information */}
      {renderDetailSection('Basic Information', {
        'Interconnecting Entity': project.InterconnectingEntity,
        'Generation Type': project.GenerationType,
        'Capacity (MW)': project.CapacityMW,
        'Summer Capacity (MW)': project.SummerCapacity,
        'Winter Capacity (MW)': project.WinterCapacityMW,
      })}

      {/* Location */}
      {renderDetailSection('Location', {
        'County': project.County,
        'State': project.StateName,
        'Interconnection Location': project.InterconnectionLocation,
        'Transmission Owner': project.TransmissionOwner,
      })}

      {/* Timeline */}
      {renderDetailSection('Timeline', {
        'Queue Date': formatDate(project.QueueDate),
        'Proposed Completion': formatDate(project.ProposedCompletionDate),
        'Actual Completion': formatDate(project.ActualCompletionDate),
        'Withdrawn Date': formatDate(project.WithdrawnDate),
      })}

      {/* Withdrawal Information */}
      {project.WithdrawalComment && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Withdrawal Information</Text>
          <View style={styles.sectionContent}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Withdrawal Date:</Text>
              <Text style={styles.detailValue}>{formatDate(project.WithdrawnDate)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Comment:</Text>
              <Text style={styles.detailValue}>{project.WithdrawalComment}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Additional Information */}
      {renderAdditionalInfo()}

      {/* Actions */}
      <View style={styles.actionsSection}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.actionButtonText}>Back to Dashboard</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={() => {
            // You could implement sharing functionality here
            Alert.alert(
              'Share Project',
              `${project.ProjectName || 'Project'} (${project.QueueID})`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Copy Info', onPress: () => {
                  // Implement copy to clipboard
                  Alert.alert('Info copied to clipboard');
                }}
              ]
            );
          }}
        >
          <Text style={styles.secondaryButtonText}>Share Project</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    right: 16,
    zIndex: 1,
    paddingVertical: 16,
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  projectName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
    marginRight: 12,
  },
  projectSubtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#FFFFFF',
    marginTop: 8,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  sectionContent: {
    gap: 12,
  },
  detailRow: {
    flexDirection: 'column',
    gap: 4,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  detailValue: {
    fontSize: 16,
    color: '#1F2937',
    lineHeight: 24,
  },
  actionsSection: {
    padding: 20,
    gap: 12,
    paddingBottom: 40,
  },
  actionButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  secondaryButtonText: {
    color: '#3B82F6',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProjectDetails;
