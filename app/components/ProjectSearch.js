import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const { width } = Dimensions.get('window');

const ProjectSearch = ({ navigation, onClose }) => {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalFound, setTotalFound] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:9000';

  const searchProjects = async (query, page = 1) => {
    if (!query.trim()) {
      Alert.alert('Search Error', 'Please enter a search term');
      return;
    }

    if (!user) {
      Alert.alert('Authentication Error', 'Please sign in to search projects');
      return;
    }

    setLoading(true);
    
    try {
      const token = await user.getIdToken();
      const response = await fetch(
        `${API_BASE_URL}/api/projects/search?query=${encodeURIComponent(query)}&page=${page}&per_page=20`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 503) {
          throw new Error('Search service is not available. Please use the project dashboard instead.');
        }
        throw new Error(`Search failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (page === 1) {
        setSearchResults(data.hits || []);
      } else {
        setSearchResults(prev => [...prev, ...(data.hits || [])]);
      }
      
      setTotalFound(data.found || 0);
      setCurrentPage(page);
      setHasSearched(true);
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Search Error', error.message);
      
      // If search is not available, offer alternative
      if (error.message.includes('not available')) {
        Alert.alert(
          'Search Unavailable',
          'The search service is not configured. Would you like to browse projects instead?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Browse Projects', onPress: () => navigation.navigate('ProjectDashboard') }
          ]
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    searchProjects(searchQuery, 1);
  };

  const loadMore = () => {
    if (!loading && searchResults.length < totalFound) {
      searchProjects(searchQuery, currentPage + 1);
    }
  };

  const getProjectStatus = (project) => {
    if (!project.document || !project.document.description) {
      return 'Unknown';
    }

    try {
      const desc = JSON.parse(project.document.description);
      const iso = project.document.iso?.toUpperCase();
      
      switch (iso) {
        case 'CAISO':
          return desc['Interconnection Agreement Status'] || 'Unknown';
        case 'ERCOT':
          return desc['GIM Study Phase'] || 'Unknown';
        case 'MISO':
          return desc['studyPhase'] || 'Unknown';
        case 'SPP':
          return desc['Status (Original)'] || 'Unknown';
        case 'NYISO':
          return desc['Availability of Studies'] || 'Unknown';
        case 'PJM':
        default:
          return 'Unknown';
      }
    } catch {
      return 'Unknown';
    }
  };

  const SearchResultItem = ({ item, onPress }) => {
    const project = item.document;
    const status = getProjectStatus(item);

    return (
      <TouchableOpacity style={styles.resultItem} onPress={() => onPress(project)}>
        <View style={styles.resultHeader}>
          <Text style={styles.resultTitle} numberOfLines={2}>
            Project {project.queueid}
          </Text>
          <View style={styles.isoBadge}>
            <Text style={styles.isoText}>{project.iso}</Text>
          </View>
        </View>
        
        <View style={styles.resultDetails}>
          <Text style={styles.resultDetail}>
            <Text style={styles.resultLabel}>Queue ID:</Text> {project.queueid}
          </Text>
          <Text style={styles.resultDetail}>
            <Text style={styles.resultLabel}>Location:</Text> {project.county}, {project.state}
          </Text>
          <Text style={styles.resultDetail}>
            <Text style={styles.resultLabel}>Type:</Text> {project.gentype}
          </Text>
          <Text style={styles.resultDetail}>
            <Text style={styles.resultLabel}>Status:</Text> {status}
          </Text>
        </View>
        
        <Text style={styles.scoreText}>
          Match Score: {Math.round((item.text_match_info?.score || 0) * 100)}%
        </Text>
      </TouchableOpacity>
    );
  };

  const handleResultPress = (project) => {
    // Convert search result format to project details format
    const projectData = {
      IsoID: project.iso,
      QueueID: project.queueid,
      ProjectName: `Project ${project.queueid}`,
      County: project.county,
      StateName: project.state,
      GenerationType: project.gentype,
      Status: 'Active', // Default status
    };
    
    navigation.navigate('ProjectDetails', { project: projectData });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Project Search</Text>
            <Text style={styles.subtitle}>
              Search across power generation projects in all ISO/RTO regions
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search projects by name, location, type, or queue ID..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity 
            style={styles.searchButton}
            onPress={handleSearch}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.searchButtonText}>Search</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Results */}
      <ScrollView 
        style={styles.resultsContainer}
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
          
          if (isCloseToBottom && !loading && searchResults.length < totalFound) {
            loadMore();
          }
        }}
        scrollEventThrottle={400}
      >
        {hasSearched && (
          <View style={styles.resultsSummary}>
            <Text style={styles.resultsText}>
              {totalFound > 0 
                ? `Found ${totalFound} project${totalFound === 1 ? '' : 's'} for "${searchQuery}"`
                : `No projects found for "${searchQuery}"`
              }
            </Text>
          </View>
        )}

        {searchResults.map((item, index) => (
          <SearchResultItem
            key={`${item.document.iso}-${item.document.queueid}-${index}`}
            item={item}
            onPress={handleResultPress}
          />
        ))}

        {loading && searchResults.length > 0 && (
          <View style={styles.loadingMore}>
            <ActivityIndicator color="#3B82F6" />
            <Text style={styles.loadingText}>Loading more results...</Text>
          </View>
        )}

        {hasSearched && searchResults.length === 0 && !loading && (
          <View style={styles.noResults}>
            <Text style={styles.noResultsText}>
              No projects found matching your search.
            </Text>
            <Text style={styles.noResultsSubtext}>
              Try different keywords or browse all projects instead.
            </Text>
            <TouchableOpacity 
              style={styles.browseButton}
              onPress={() => navigation.navigate('ProjectDashboard')}
            >
              <Text style={styles.browseButtonText}>Browse All Projects</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  searchContainer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchInputContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
  },
  searchButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    flex: 1,
    padding: 20,
  },
  resultsSummary: {
    marginBottom: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#EBF8FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BEE3F8',
  },
  resultsText: {
    fontSize: 16,
    color: '#2B6CB0',
    fontWeight: '500',
  },
  resultItem: {
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
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    marginRight: 12,
  },
  isoBadge: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  isoText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  resultDetails: {
    gap: 4,
    marginBottom: 8,
  },
  resultDetail: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  resultLabel: {
    fontWeight: '600',
    color: '#1F2937',
  },
  scoreText: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  loadingMore: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginBottom: 8,
  },
  noResultsSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  browseButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  browseButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProjectSearch;
