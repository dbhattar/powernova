import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Chart } from '../components/ui/Chart';
import { Card } from '../components/ui/Card';

export const DashboardScreen = ({ user, conversations, documents, onNavigate }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    recentConversations: 0,
    documentsCount: 0,
    projectsCount: 0,
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

  const onRefresh = async () => {
    setRefreshing(true);
    // Simulate data refresh
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
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
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <Text style={styles.sectionContent}>
          Your recent conversations and document uploads will appear here.
        </Text>
      </View>
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
  sectionContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
