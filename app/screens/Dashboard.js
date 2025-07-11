import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Chart } from '../components/ui/Chart';
import { Card } from '../components/ui/Card';

// Import test data for development
let mockConversations = [];
let mockDocuments = [];
try {
  if (__DEV__) {
    const testData = require('../test/recentActivityTest');
    mockConversations = testData.mockConversations;
    mockDocuments = testData.mockDocuments;
  }
} catch (error) {
  console.log('Test data not available:', error.message);
}

export const DashboardScreen = ({ user, conversations, documents, onNavigate }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [showDebugOptions, setShowDebugOptions] = useState(__DEV__); // Only show in development
  const [dashboardData, setDashboardData] = useState({
    recentConversations: 0,
    documentsCount: 0,
    projectsCount: '...', // Show loading indicator initially
    lmpData: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      values: [45, 52, 48, 61, 55, 67],
    },
  });

  useEffect(() => {
    // Update dashboard data when props change
    setDashboardData(prev => ({
      ...prev,
      recentConversations: conversations?.length || 0,
      documentsCount: documents?.length || 0,
    }));
  }, [conversations, documents]);

  useEffect(() => {
    // Fetch projects count from backend on user change
    fetchProjectsCount();
  }, [user]);

  const fetchProjectsCount = async () => {
    if (!user) return;
    
    try {
      const token = await user.getIdToken();
      const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:9000';
      
      const response = await fetch(`${API_BASE_URL}/api/projects/statistics`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const statistics = await response.json();
        setDashboardData(prev => ({
          ...prev,
          projectsCount: statistics.overview?.totalProjects || 0,
        }));
      }
    } catch (error) {
      console.log('Failed to fetch projects count:', error);
      // Fallback to a reasonable default if the API is not available
      setDashboardData(prev => ({
        ...prev,
        projectsCount: 'N/A',
      }));
    }
  };

  const getRecentConversations = () => {
    if (!conversations || conversations.length === 0) {
      return [];
    }
    
    // Sort by timestamp and take the 5 most recent
    return conversations
      .sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt))
      .slice(0, 5);
  };

  const getRecentDocuments = () => {
    if (!documents || documents.length === 0) {
      return [];
    }
    
    // Sort by timestamp and take the 5 most recent
    return documents
      .sort((a, b) => new Date(b.createdAt || b.uploadDate) - new Date(a.createdAt || a.uploadDate))
      .slice(0, 5);
  };

  const getCombinedRecentActivity = () => {
    const recentConversations = getRecentConversations().map(conv => ({
      ...conv,
      activityType: 'conversation',
      timestamp: conv.timestamp || conv.createdAt
    }));

    const recentDocuments = getRecentDocuments().map(doc => ({
      ...doc,
      activityType: 'document',
      timestamp: doc.createdAt || doc.uploadDate
    }));

    // Combine and sort by timestamp, take top 8 items
    const combined = [...recentConversations, ...recentDocuments]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 8);

    return combined;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Recently';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays <= 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
  };

  const getDocumentIcon = (fileName) => {
    if (!fileName) return 'document-outline';
    
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf':
        return 'document-text-outline';
      case 'doc':
      case 'docx':
        return 'document-outline';
      case 'txt':
        return 'document-text-outline';
      case 'xls':
      case 'xlsx':
        return 'grid-outline';
      case 'ppt':
      case 'pptx':
        return 'easel-outline';
      default:
        return 'document-outline';
    }
  };

  const renderActivityItem = (item, index) => {
    if (item.activityType === 'conversation') {
      return (
        <TouchableOpacity
          key={`conv-${item.id || index}`}
          style={styles.activityItem}
          onPress={() => onNavigate('chat', { conversation: item })}
        >
          <View style={styles.activityIcon}>
            <Ionicons 
              name={item.type === 'voice' ? 'mic' : 'chatbubble-ellipses'} 
              size={16} 
              color="#007AFF" 
            />
          </View>
          <View style={styles.activityContent}>
            <Text style={styles.activityPrompt} numberOfLines={1}>
              {item.prompt || 'Chat message'}
            </Text>
            <Text style={styles.activityResponse} numberOfLines={2}>
              {item.response || 'Response'}
            </Text>
            <View style={styles.activityMeta}>
              <Text style={styles.activityTime}>
                {formatTimestamp(item.timestamp)}
              </Text>
              {item.hasReferences && (
                <View style={styles.activityReferences}>
                  <Ionicons name="document-text" size={12} color="#28A745" />
                  <Text style={styles.activityReferencesText}>
                    {item.sourceDocuments?.length || 0} refs
                  </Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      );
    } else if (item.activityType === 'document') {
      return (
        <TouchableOpacity
          key={`doc-${item.id || index}`}
          style={styles.activityItem}
          onPress={() => onNavigate('documents', { document: item })}
        >
          <View style={[styles.activityIcon, { backgroundColor: '#e8f5e8' }]}>
            <Ionicons 
              name={getDocumentIcon(item.fileName || item.name)} 
              size={16} 
              color="#28A745" 
            />
          </View>
          <View style={styles.activityContent}>
            <Text style={styles.activityPrompt} numberOfLines={1}>
              {item.fileName || item.name || 'Document'}
            </Text>
            <Text style={styles.activityResponse} numberOfLines={1}>
              Uploaded • {formatFileSize(item.size)}
            </Text>
            <View style={styles.activityMeta}>
              <Text style={styles.activityTime}>
                {formatTimestamp(item.timestamp)}
              </Text>
              <View style={styles.activityReferences}>
                <Ionicons name="cloud-upload" size={12} color="#28A745" />
                <Text style={styles.activityReferencesText}>
                  {item.status || 'Ready'}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    }
  };

  const renderRecentActivity = () => {
    const recentActivity = getCombinedRecentActivity();
    
    if (recentActivity.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="time-outline" size={48} color="#ccc" />
          <Text style={styles.emptyStateText}>No recent activity</Text>
          <Text style={styles.emptyStateSubtext}>Start chatting or upload documents to see your activity here</Text>
        </View>
      );
    }

    return recentActivity.map((item, index) => renderActivityItem(item, index));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Refresh projects count
      await fetchProjectsCount();
    } catch (error) {
      console.log('Error refreshing dashboard:', error);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Welcome back, {user?.displayName || 'User'}!</Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <Card 
          title="Conversations" 
          value={dashboardData.recentConversations}
          icon="chatbubble-outline"
          onPress={() => onNavigate('history')}
        />
        <Card 
          title="Documents" 
          value={dashboardData.documentsCount}
          icon="document-text-outline"
          onPress={() => onNavigate('documents')}
        />
        <Card 
          title="Projects" 
          value={dashboardData.projectsCount}
          icon="business-outline"
          onPress={() => onNavigate('projects')}
        />
      </View>

      {/* LMP Chart */}
      <Chart
        data={dashboardData.lmpData}
        title="LMP Trends ($/MWh)"
        type="line"
      />

      {/* Quick Actions */}
      <View style={styles.quickActionsContainer}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <Card 
            title="Ask AI" 
            value="🤖"
            onPress={() => onNavigate('chat')}
            style={styles.quickActionCard}
          />
          <Card 
            title="Upload Doc" 
            value="📄"
            onPress={() => onNavigate('documents')}
            style={styles.quickActionCard}
          />
          <Card 
            title="Search" 
            value="🔍"
            onPress={() => onNavigate('search')}
            style={styles.quickActionCard}
          />
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.contentSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity onPress={() => onNavigate('chat')}>
            <Text style={styles.sectionLink}>View All</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.activityList}>
          {renderRecentActivity()}
        </View>
      </View>

      {/* Debug Section (Development Only) */}
      {showDebugOptions && (
        <View style={styles.debugSection}>
          <Text style={styles.debugTitle}>🔧 Debug Options</Text>
          <TouchableOpacity
            style={styles.debugButton}
            onPress={() => {
              console.log('Current conversations:', conversations);
              console.log('Current documents:', documents);
              console.log('Mock conversations available:', mockConversations.length);
              const recentActivity = getCombinedRecentActivity();
              console.log('Combined recent activity:', recentActivity);
              alert(`Current: ${conversations?.length || 0} conversations, ${documents?.length || 0} documents\nRecent activity: ${recentActivity.length} items\nMock: ${mockConversations.length} conversations available`);
            }}
          >
            <Text style={styles.debugButtonText}>Check Activity Data</Text>
          </TouchableOpacity>
          <Text style={styles.debugInfo}>
            Current conversations: {conversations?.length || 0}
          </Text>
          <Text style={styles.debugInfo}>
            Current documents: {documents?.length || 0}
          </Text>
          <Text style={styles.debugInfo}>
            Combined recent activity: {getCombinedRecentActivity().length} items
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    flexWrap: 'wrap',
  },
  quickActionsContainer: {
    padding: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
  },
  quickActionCard: {
    minWidth: 80,
    margin: 4,
  },
  contentSection: {
    padding: 20,
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  sectionContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  activityList: {
    gap: 12,
  },
  activityItem: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityPrompt: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  activityResponse: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 4,
  },
  activityMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityTime: {
    fontSize: 12,
    color: '#999',
  },
  activityReferences: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activityReferencesText: {
    fontSize: 11,
    color: '#28A745',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    padding: 24,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    fontWeight: '500',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
  debugSection: {
    backgroundColor: '#fff3cd',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffeaa7',
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 8,
  },
  debugButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  debugButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '500',
  },
  debugInfo: {
    fontSize: 12,
    color: '#856404',
    marginBottom: 4,
  },
});
