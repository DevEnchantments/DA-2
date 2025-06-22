import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import {
  assignPatient,
  getAssignedPatients,
  getDoctorStatistics,
  removePatientAssignment,
  searchPatients
} from '../mealPlanService';
import { useAuth } from './_layout';

const PatientManagementScreen = () => {
  // Auth and user state
  const { user, isDoctor } = useAuth();
  
  // Patient management state
  const [assignedPatients, setAssignedPatients] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statistics, setStatistics] = useState({
    totalPatients: 0,
    activeMealPlans: 0,
    patientsWithoutPlans: 0
  });
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('assigned'); // 'assigned' or 'search'

  // Load data when component mounts
  useEffect(() => {
    if (isDoctor) {
      loadDoctorData();
    }
  }, [isDoctor]);

  // Access control - only doctors can access this screen
  if (!isDoctor) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed" size={64} color="#FF5722" />
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedText}>
            This feature is only available for medical professionals.
          </Text>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Load doctor's data (patients and statistics)
  const loadDoctorData = async () => {
    try {
      setLoading(true);
      console.log('Loading doctor data...');
      
      // Load assigned patients and statistics in parallel
      const [patients, stats] = await Promise.all([
        getAssignedPatients(),
        getDoctorStatistics()
      ]);
      
      console.log('Loaded patients:', patients.length);
      console.log('Loaded statistics:', stats);
      
      setAssignedPatients(patients);
      setStatistics(stats);
    } catch (error) {
      console.error('Error loading doctor data:', error);
      Alert.alert('Error', 'Failed to load patient data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Search for patients
  const handleSearch = async (term) => {
    if (!term.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      console.log('Searching for patients:', term);
      
      const results = await searchPatients(term);
      console.log('Search results:', results.length);
      
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching patients:', error);
      Alert.alert('Error', 'Failed to search patients. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  // Assign a patient to the doctor
  const handleAssignPatient = async (patient) => {
    try {
      setLoading(true);
      console.log('Assigning patient:', patient.firstName, patient.lastName);
      
      await assignPatient(patient.id);
      
      // Refresh the assigned patients list
      await loadDoctorData();
      
      // Remove from search results
      setSearchResults(prev => prev.filter(p => p.id !== patient.id));
      
      Alert.alert('Success', `${patient.firstName} ${patient.lastName} has been assigned to you.`);
    } catch (error) {
      console.error('Error assigning patient:', error);
      Alert.alert('Error', 'Failed to assign patient. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Remove patient assignment
  const handleRemovePatient = async (patient) => {
    Alert.alert(
      'Remove Patient',
      `Are you sure you want to remove ${patient.firstName} ${patient.lastName} from your patient list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await removePatientAssignment(patient.id);
              await loadDoctorData();
              Alert.alert('Success', 'Patient removed from your list.');
            } catch (error) {
              console.error('Error removing patient:', error);
              Alert.alert('Error', 'Failed to remove patient. Please try again.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Create meal plan for patient
  const createMealPlan = (patient) => {
    console.log('Creating meal plan for patient:', patient.firstName, patient.lastName);
    router.push({
      pathname: '/MealPlanScreen',
      params: {
        selectedPatientId: patient.id,
        selectedPatientName: `${patient.firstName} ${patient.lastName}`,
        generateNew: 'true'
      }
    });
  };

  // Navigate to manual meal planning
  const createManualMealPlan = (patient) => {
    console.log('Creating manual meal plan for patient:', patient.firstName, patient.lastName);
    router.push({
      pathname: '/ManualMealPlanScreen',
      params: {
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`
      }
    });
  };

  // NEW: Navigate to patient's meal history
  const viewMealHistory = (patient) => {
    console.log('Viewing meal history for patient:', patient.firstName, patient.lastName);
    router.push({
      pathname: '/mealHistoryScreen',
      params: {
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`
      }
    });
  };

  // Refresh data
  const onRefresh = async () => {
    setRefreshing(true);
    await loadDoctorData();
    setRefreshing(false);
  };

  // Render statistics cards
  const renderStatistics = () => (
    <View style={styles.statisticsContainer}>
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{statistics.totalPatients}</Text>
          <Text style={styles.statLabel}>Total Patients</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{statistics.activeMealPlans}</Text>
          <Text style={styles.statLabel}>Active Plans</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{statistics.patientsWithoutPlans}</Text>
          <Text style={styles.statLabel}>Need Plans</Text>
        </View>
      </View>
    </View>
  );

  // UPDATED: Render patient card with meal history button
  const renderPatientCard = (patient, isAssigned = true) => (
    <View key={patient.id} style={styles.patientCard}>
      <View style={styles.patientInfo}>
        <View style={styles.patientAvatar}>
          {patient.photoUrl ? (
            <Image source={{ uri: patient.photoUrl }} style={styles.patientPhoto} />
          ) : (
            <Ionicons name="person" size={24} color="#fff" />
          )}
        </View>
        <View style={styles.patientDetails}>
          <Text style={styles.patientName}>
            {patient.firstName} {patient.lastName}
          </Text>
          <Text style={styles.patientEmail}>{patient.email}</Text>
          {patient.currentMealPlanId && (
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>Has Meal Plan</Text>
            </View>
          )}
        </View>
      </View>
      
      <View style={styles.patientActions}>
        {isAssigned ? (
          <>
            {/* First row of buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.actionButton, styles.aiMealPlanButton]}
                onPress={() => createMealPlan(patient)}
              >
                <Ionicons name="flash" size={16} color="#fff" />
                <Text style={styles.actionButtonText}>AI Plan</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.manualMealPlanButton]}
                onPress={() => createManualMealPlan(patient)}
              >
                <Ionicons name="create" size={16} color="#fff" />
                <Text style={styles.actionButtonText}>Manual</Text>
              </TouchableOpacity>
            </View>
            
            {/* Second row of buttons */}
            <View style={styles.actionRow}>
              {/* NEW: Meal History Button */}
              <TouchableOpacity
                style={[styles.actionButton, styles.mealHistoryButton]}
                onPress={() => viewMealHistory(patient)}
              >
                <Ionicons name="restaurant" size={16} color="#fff" />
                <Text style={styles.actionButtonText}>Meal History</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionButton, styles.removeButton]}
                onPress={() => handleRemovePatient(patient)}
              >
                <Ionicons name="remove-circle" size={16} color="#fff" />
                <Text style={styles.actionButtonText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.assignButton, styles.fullWidthButton]}
            onPress={() => handleAssignPatient(patient)}
          >
            <Ionicons name="add-circle" size={16} color="#fff" />
            <Text style={styles.actionButtonText}>Assign Patient</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // Render assigned patients tab
  const renderAssignedPatients = () => (
    <View style={styles.tabContent}>
      {assignedPatients.length > 0 ? (
        assignedPatients.map(patient => renderPatientCard(patient, true))
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={64} color="#ccc" />
          <Text style={styles.emptyStateTitle}>No Assigned Patients</Text>
          <Text style={styles.emptyStateText}>
            Search for patients to assign them to your care.
          </Text>
        </View>
      )}
    </View>
  );

  // Render search tab
  const renderSearchTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search patients by name or email..."
            value={searchTerm}
            onChangeText={(text) => {
              setSearchTerm(text);
              handleSearch(text);
            }}
            autoCapitalize="none"
          />
          {searching && (
            <ActivityIndicator size="small" color="#4CAF50" style={styles.searchLoader} />
          )}
        </View>
      </View>

      {searchResults.length > 0 ? (
        searchResults.map(patient => renderPatientCard(patient, false))
      ) : searchTerm.trim() ? (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={64} color="#ccc" />
          <Text style={styles.emptyStateTitle}>No Results Found</Text>
          <Text style={styles.emptyStateText}>
            No patients found matching "{searchTerm}".
          </Text>
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={64} color="#ccc" />
          <Text style={styles.emptyStateTitle}>Search Patients</Text>
          <Text style={styles.emptyStateText}>
            Enter a name or email to search for patients.
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Patient Management</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={24} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Statistics */}
        {renderStatistics()}

        {/* Tab Navigation */}
        <View style={styles.tabNavigation}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'assigned' && styles.activeTab]}
            onPress={() => setActiveTab('assigned')}
          >
            <Text style={[styles.tabText, activeTab === 'assigned' && styles.activeTabText]}>
              My Patients ({assignedPatients.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'search' && styles.activeTab]}
            onPress={() => setActiveTab('search')}
          >
            <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>
              Search Patients
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        ) : (
          <>
            {activeTab === 'assigned' && renderAssignedPatients()}
            {activeTab === 'search' && renderSearchTab()}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  scrollView: {
    flex: 1,
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF5722',
    marginTop: 20,
    marginBottom: 10,
  },
  accessDeniedText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  backButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  statisticsContainer: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 15,
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
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
    textAlign: 'center',
  },
  tabNavigation: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 10,
    padding: 5,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#4CAF50',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  tabContent: {
    paddingHorizontal: 20,
  },
  searchContainer: {
    marginBottom: 20,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  searchLoader: {
    marginLeft: 10,
  },
  patientCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  patientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  patientAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  patientPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  patientDetails: {
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  patientEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  statusBadge: {
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  // UPDATED: Patient actions with two rows
  patientActions: {
    gap: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  fullWidthButton: {
    flex: 1,
    minWidth: '100%',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  aiMealPlanButton: {
    backgroundColor: '#4CAF50',
  },
  manualMealPlanButton: {
    backgroundColor: '#FF9800',
  },
  // NEW: Meal History button style
  mealHistoryButton: {
    backgroundColor: '#673AB7', // Purple color for meal history
  },
  removeButton: {
    backgroundColor: '#F44336',
  },
  assignButton: {
    backgroundColor: '#2196F3',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});

export default PatientManagementScreen;