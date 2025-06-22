import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  deleteMealLog,
  getMealLogStatistics,
  getTodaysMealLogs,
  getUserMealLogs
} from '../mealLoggingService';
import { getPatientById } from '../mealPlanService'; // or wherever this function is
import { useAuth } from './_layout';

const MealHistoryScreen = () => {
  // Get parameters for doctor viewing patient logs
  const params = useLocalSearchParams();
  const { patientId, patientName } = params;
  const { user, isDoctor } = useAuth();
  
  // Determine if viewing patient's logs (doctor mode) or own logs (patient mode)
  const isViewingPatient = patientId && isDoctor;
  const targetUserId = isViewingPatient ? patientId : user?.uid;

  const [patient, setPatient] = useState(null); // For doctor mode
  const [mealLogs, setMealLogs] = useState([]);
  const [todaysLogs, setTodaysLogs] = useState([]);
  const [statistics, setStatistics] = useState({
    totalLogs: 0,
    averagePerDay: 0,
    totalCalories: 0,
    averageCaloriesPerDay: 0,
    mealTypeCounts: { breakfast: 0, lunch: 0, dinner: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('today'); // 'today' or 'history'

  // Load data when screen focuses
  useFocusEffect(
    useCallback(() => {
      loadMealData();
      if (isViewingPatient) {
        loadPatientData();
      }
    }, [targetUserId, isViewingPatient])
  );

  const loadPatientData = async () => {
    if (!isViewingPatient) return;
    
    try {
      console.log(`Loading patient data for: ${patientId}`);
      const patientData = await getPatientById(patientId);
      setPatient(patientData);
    } catch (error) {
      console.error('Error loading patient data:', error);
      Alert.alert('Error', 'Failed to load patient information.');
    }
  };

  const loadMealData = async () => {
    try {
      setLoading(true);
      console.log(`Loading meal history data for user: ${targetUserId}`);

      // Load data in parallel - pass targetUserId to service functions
      const [allLogs, todayLogs, stats] = await Promise.all([
        getUserMealLogs(50, targetUserId), // Get last 50 logs for target user
        getTodaysMealLogs(targetUserId),
        getMealLogStatistics(7, targetUserId), // Last 7 days stats for target user
      ]);

      console.log('Loaded meal data:', {
        allLogs: allLogs.length,
        todayLogs: todayLogs.length,
        stats,
        targetUser: targetUserId
      });

      setMealLogs(allLogs);
      setTodaysLogs(todayLogs);
      setStatistics(stats);
    } catch (error) {
      console.error('Error loading meal data:', error);
      Alert.alert('Error', 'Failed to load meal history. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMealData();
    setRefreshing(false);
  };

  const handleDeleteLog = (logId, mealTitle) => {
    // Only allow deletion if viewing own logs or if doctor has permission
    const canDelete = !isViewingPatient || isDoctor;
    
    if (!canDelete) {
      Alert.alert('Permission Denied', 'You cannot delete this meal log.');
      return;
    }

    const confirmationMessage = isViewingPatient 
      ? `Are you sure you want to delete "${mealTitle}" from ${patient?.firstName}'s log?`
      : `Are you sure you want to delete "${mealTitle}"?`;

    Alert.alert(
      'Delete Meal Log',
      confirmationMessage,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMealLog(logId);
              await loadMealData(); // Refresh data
              Alert.alert('Success', 'Meal log deleted successfully.');
            } catch (error) {
              console.error('Error deleting meal log:', error);
              Alert.alert('Error', 'Failed to delete meal log.');
            }
          }
        }
      ]
    );
  };

  const formatDate = (date) => {
    const today = new Date();
    const logDate = new Date(date);
    const diffTime = Math.abs(today - logDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;
    return logDate.toLocaleDateString();
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getMealTypeIcon = (mealType) => {
    switch (mealType) {
      case 'breakfast': return 'sunny';
      case 'lunch': return 'partly-sunny';
      case 'dinner': return 'moon';
      default: return 'restaurant';
    }
  };

  const getMealTypeColor = (mealType) => {
    switch (mealType) {
      case 'breakfast': return '#FF9800';
      case 'lunch': return '#2196F3';
      case 'dinner': return '#9C27B0';
      default: return '#4CAF50';
    }
  };

  // NEW: Render patient header for doctor view
  const renderPatientHeader = () => {
    if (!isViewingPatient || !patient) return null;

    return (
      <View style={styles.patientHeader}>
        {patient.photoUrl ? (
          <Image source={{ uri: patient.photoUrl }} style={styles.patientPhoto} />
        ) : (
          <View style={styles.defaultAvatar}>
            <Ionicons name="person" size={24} color="#4CAF50" />
          </View>
        )}
        <View style={styles.patientInfo}>
          <Text style={styles.patientName}>
            {patient.firstName} {patient.lastName}
          </Text>
          <Text style={styles.patientEmail}>{patient.email}</Text>
          <View style={styles.viewingBadge}>
            <Ionicons name="eye" size={12} color="#4CAF50" />
            <Text style={styles.viewingBadgeText}>Viewing Patient's Meal History</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderStatistics = () => (
    <View style={styles.statisticsCard}>
      <Text style={styles.statisticsTitle}>
        📊 Last 7 Days Summary
        {isViewingPatient && ` - ${patient?.firstName || 'Patient'}`}
      </Text>
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{statistics.totalLogs}</Text>
          <Text style={styles.statLabel}>Total Logs</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{statistics.averagePerDay}</Text>
          <Text style={styles.statLabel}>Avg/Day</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{Math.round(statistics.totalCalories)}</Text>
          <Text style={styles.statLabel}>Total Cal</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{Math.round(statistics.averageCaloriesPerDay)}</Text>
          <Text style={styles.statLabel}>Avg Cal/Day</Text>
        </View>
      </View>
      
      <View style={styles.mealTypeStats}>
        <Text style={styles.mealTypeStatsTitle}>Meal Type Breakdown</Text>
        <View style={styles.mealTypeGrid}>
          {Object.entries(statistics.mealTypeCounts).map(([type, count]) => (
            <View key={type} style={styles.mealTypeStat}>
              <Ionicons 
                name={getMealTypeIcon(type)} 
                size={20} 
                color={getMealTypeColor(type)} 
              />
              <Text style={styles.mealTypeCount}>{count}</Text>
              <Text style={styles.mealTypeLabel}>{type}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  // FIXED: Enhanced calorie extraction and display
  const renderMealLogItem = ({ item }) => {
    // FIXED: Better calorie extraction logic
    const getCalories = () => {
      // Try multiple possible locations for calorie data
      if (item.mealData?.calories) return item.mealData.calories;
      if (item.mealData?.nutrition?.calories) return item.mealData.nutrition.calories;
      if (item.calories) return item.calories;
      if (item.nutrition?.calories) return item.nutrition.calories;
      
      // If it's from meal logging, calories might be stored differently
      if (item.mealData && typeof item.mealData === 'object') {
        // Check if mealData has nested nutrition info
        const mealData = item.mealData;
        if (mealData.extendedIngredients) {
          // This might be from Spoonacular API - look for nutrition data
          if (mealData.nutrition && mealData.nutrition.nutrients) {
            const calorieNutrient = mealData.nutrition.nutrients.find(n => 
              n.name && n.name.toLowerCase().includes('calorie')
            );
            if (calorieNutrient) return calorieNutrient.amount;
          }
        }
      }
      
      // Fallback estimates based on meal type
      const fallbackCalories = {
        breakfast: 350,
        lunch: 500,
        dinner: 600
      };
      
      return fallbackCalories[item.mealType] || 400;
    };

    const calories = Math.round(getCalories());
    console.log('Meal log item calories:', {
      itemId: item.id,
      mealType: item.mealType,
      extractedCalories: calories,
      mealData: item.mealData
    });

    return (
      <View style={styles.mealLogCard}>
        <View style={styles.mealLogHeader}>
          <View style={styles.mealTypeInfo}>
            <Ionicons 
              name={getMealTypeIcon(item.mealType)} 
              size={24} 
              color={getMealTypeColor(item.mealType)} 
            />
            <View style={styles.mealHeaderText}>
              <Text style={styles.mealTypeName}>
                {item.mealType.charAt(0).toUpperCase() + item.mealType.slice(1)}
              </Text>
              <Text style={styles.mealDateTime}>
                {formatDate(item.timestamp)} • {formatTime(item.timestamp)}
              </Text>
            </View>
          </View>
          {/* Show delete button for own logs or if doctor viewing patient */}
          {(!isViewingPatient || isDoctor) && (
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeleteLog(item.id, item.mealData?.title || 'Meal')}
            >
              <Ionicons name="trash-outline" size={20} color="#FF5722" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.mealContent}>
          <Image 
            source={{ uri: item.photoUri || item.mealData?.image }} 
            style={styles.mealPhoto} 
          />
          <View style={styles.mealDetails}>
            <Text style={styles.mealTitle}>
              {item.mealData?.title || item.mealData?.name || 'Meal'}
            </Text>
            <View style={styles.mealMetrics}>
              <View style={styles.metricItem}>
                <Ionicons name="flame" size={14} color="#FF5722" />
                <Text style={styles.metricText}>
                  {calories} cal
                </Text>
              </View>
              {item.mealData?.prepTime && (
                <View style={styles.metricItem}>
                  <Ionicons name="time" size={14} color="#666" />
                  <Text style={styles.metricText}>{item.mealData.prepTime} min</Text>
                </View>
              )}
              <View style={styles.metricItem}>
                <Ionicons name="people" size={14} color="#666" />
                <Text style={styles.metricText}>
                  {item.mealData?.servings || 1} serving{(item.mealData?.servings || 1) > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
            {/* Show any notes from the meal log */}
            {item.notes && (
              <Text style={styles.mealNotes}>"{item.notes}"</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="restaurant-outline" size={64} color="#ccc" />
      <Text style={styles.emptyStateTitle}>
        {activeTab === 'today' 
          ? (isViewingPatient ? 'No Meals Logged Today' : 'No Meals Logged Today')
          : (isViewingPatient ? 'No Meal History' : 'No Meal History')
        }
      </Text>
      <Text style={styles.emptyStateText}>
        {isViewingPatient 
          ? (activeTab === 'today' 
              ? `${patient?.firstName || 'This patient'} hasn't logged any meals today.`
              : `${patient?.firstName || 'This patient'} hasn't logged any meals yet.`
            )
          : (activeTab === 'today' 
              ? 'Start logging your meals to track your daily nutrition!'
              : 'Your logged meals will appear here as you start tracking your meals.'
            )
        }
      </Text>
      {/* Only show log meal button for own logs, not when viewing patient */}
      {!isViewingPatient && (
        <TouchableOpacity
          style={styles.logMealButton}
          onPress={() => router.push('/MealLoggingScreen')}
        >
          <Ionicons name="camera" size={20} color="#fff" />
          <Text style={styles.logMealButtonText}>Log a Meal</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderTabBar = () => (
    <View style={styles.tabBar}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'today' && styles.activeTab]}
        onPress={() => setActiveTab('today')}
      >
        <Ionicons 
          name="today" 
          size={20} 
          color={activeTab === 'today' ? '#fff' : '#666'} 
        />
        <Text style={[styles.tabText, activeTab === 'today' && styles.activeTabText]}>
          Today ({todaysLogs.length})
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'history' && styles.activeTab]}
        onPress={() => setActiveTab('history')}
      >
        <Ionicons 
          name="time" 
          size={20} 
          color={activeTab === 'history' ? '#fff' : '#666'} 
        />
        <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
          History ({mealLogs.length})
        </Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>
            {isViewingPatient ? 'Loading patient meal history...' : 'Loading meal history...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const currentData = activeTab === 'today' ? todaysLogs : mealLogs;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isViewingPatient ? `${patient?.firstName || 'Patient'}'s Meal History` : 'Meal History'}
        </Text>
        {/* Only show camera button for own logs */}
        {!isViewingPatient && (
          <TouchableOpacity onPress={() => router.push('/MealLoggingScreen')}>
            <Ionicons name="camera" size={24} color="#4CAF50" />
          </TouchableOpacity>
        )}
        {isViewingPatient && <View style={styles.headerSpacer} />}
      </View>

      {/* Patient Header - only for doctor view */}
      {renderPatientHeader()}

      {/* Statistics - only show for history tab */}
      {activeTab === 'history' && statistics.totalLogs > 0 && renderStatistics()}

      {/* Tab Bar */}
      {renderTabBar()}

      {/* Content */}
      <FlatList
        data={currentData}
        keyExtractor={(item) => item.id}
        renderItem={renderMealLogItem}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  headerSpacer: {
    width: 24,
  },
  // NEW: Patient header styles for doctor view
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 15,
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  patientPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  defaultAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  patientEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  viewingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewingBadgeText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  statisticsCard: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginBottom: 10,
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statisticsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  mealTypeStats: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 15,
  },
  mealTypeStatsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  mealTypeGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  mealTypeStat: {
    alignItems: 'center',
  },
  mealTypeCount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  mealTypeLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
    textTransform: 'capitalize',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 10,
    padding: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
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
  listContainer: {
    paddingHorizontal: 15,
    paddingBottom: 20,
  },
  mealLogCard: {
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
  mealLogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mealTypeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealHeaderText: {
    marginLeft: 12,
  },
  mealTypeName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textTransform: 'capitalize',
  },
  mealDateTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
  },
  mealContent: {
    flexDirection: 'row',
  },
  mealPhoto: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 15,
  },
  mealDetails: {
    flex: 1,
    justifyContent: 'space-between',
  },
  mealTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    lineHeight: 20,
  },
  mealMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  // NEW: Style for meal notes
  mealNotes: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
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
    marginBottom: 30,
  },
  logMealButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  logMealButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default MealHistoryScreen;