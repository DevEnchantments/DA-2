import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { auth } from '../configs/firebaseConfig';
import { saveMealLog } from '../mealLoggingService';
import { getCurrentWeekMealPlan, getMostRecentMealPlan } from '../mealPlanService';

const MealLoggingScreen = () => {
  // Camera states
  const [permission, requestPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const cameraRef = useRef(null);

  // Meal plan states
  const [todaysMealPlan, setTodaysMealPlan] = useState(null);
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  // Logging states
  const [isLogging, setIsLogging] = useState(false);

  useEffect(() => {
    loadUserAndMealPlan();
  }, []);

  const loadUserAndMealPlan = async () => {
    try {
      // Get current user from Firebase Auth
      const user = auth.currentUser;
      if (user) {
        console.log('Current user loaded from Firebase Auth:', user.uid);
        setCurrentUser(user);
        await loadTodaysMealPlan(user.uid);
      } else {
        console.log('No authenticated user found');
        Alert.alert('Authentication Required', 'Please log in to view your meal plan.');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setLoading(false);
    }
  };

  const loadTodaysMealPlan = async (userId) => {
    try {
      setLoading(true);
      console.log('Loading today\'s meal plan for user:', userId);
      
      // Use the same logic as MealPlanScreen - try recent plan first
      let mealPlan = null;
      
      // Try to get most recent meal plan first (manual or AI)
      const recentPlan = await getMostRecentMealPlan(userId);
      console.log('Recent meal plan result:', recentPlan);
      
      if (recentPlan && recentPlan.id) {
        console.log('Found recent meal plan, loading full data...');
        // Use getCurrentWeekMealPlan to get the full plan data
        const fullPlan = await getCurrentWeekMealPlan();
        console.log('Full meal plan loaded:', fullPlan ? 'Success' : 'Failed');
        
        if (fullPlan) {
          mealPlan = fullPlan;
        }
      } else {
        // If no recent plan, try to get current week plan directly
        console.log('No recent plan found, trying getCurrentWeekMealPlan...');
        mealPlan = await getCurrentWeekMealPlan();
      }
      
      if (mealPlan) {
        console.log('Meal plan found:', mealPlan.id || 'no id');
        console.log('Meal plan structure:', Object.keys(mealPlan));
        
        // Handle both AI and manual meal plan structures
        let weekData = null;
        
        // Check if it's wrapped in a mealPlan object
        if (mealPlan.mealPlan && mealPlan.mealPlan.week) {
          weekData = mealPlan.mealPlan.week;
          console.log('Using nested mealPlan.week structure');
        } 
        // Check if it has week directly
        else if (mealPlan.week) {
          weekData = mealPlan.week;
          console.log('Using direct week structure');
        }
        
        if (weekData) {
          // Get today's day name
          const today = new Date();
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          const todayName = dayNames[today.getDay()];
          
          console.log(`Today is ${todayName} (day ${today.getDay()})`);
          console.log('Available days in meal plan:', Object.keys(weekData));
          
          const todaysPlan = weekData[todayName];
          console.log(`Today's plan for ${todayName}:`, todaysPlan ? 'Found' : 'Not found');
          
          if (todaysPlan) {
            // Handle both AI format (array) and manual format (object)
            let formattedTodaysPlan = null;
            
            if (todaysPlan.meals && Array.isArray(todaysPlan.meals)) {
              // AI format: convert array to breakfast/lunch/dinner
              console.log('Converting AI format (array) to standard format');
              console.log('AI meals array:', todaysPlan.meals);
              formattedTodaysPlan = {
                breakfast: todaysPlan.meals[0] || null,
                lunch: todaysPlan.meals[1] || null,
                dinner: todaysPlan.meals[2] || null,
              };
            } else if (todaysPlan.breakfast || todaysPlan.lunch || todaysPlan.dinner) {
              // Manual format: already has breakfast/lunch/dinner structure
              console.log('Using manual format (object) directly');
              formattedTodaysPlan = {
                breakfast: todaysPlan.breakfast || null,
                lunch: todaysPlan.lunch || null,
                dinner: todaysPlan.dinner || null,
              };
            } else {
              console.log('Unknown meal plan structure for today:', todaysPlan);
            }
            
            if (formattedTodaysPlan) {
              console.log('Final formatted today\'s plan:', formattedTodaysPlan);
              setTodaysMealPlan(formattedTodaysPlan);
            } else {
              console.log('Could not format today\'s plan');
              setTodaysMealPlan(null);
            }
          } else {
            console.log(`No meal plan found for ${todayName}`);
            setTodaysMealPlan(null);
          }
        } else {
          console.log('No week data found in meal plan structure');
          setTodaysMealPlan(null);
        }
      } else {
        console.log('No meal plan found at all');
        setTodaysMealPlan(null);
      }
    } catch (error) {
      console.error('Error loading meal plan:', error);
      Alert.alert('Error', 'Failed to load today\'s meal plan');
      setTodaysMealPlan(null);
    } finally {
      setLoading(false);
    }
  };

  const handleTakePhoto = async () => {
    if (!permission) {
      const permissionResult = await requestPermission();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Camera permission is needed to take photos of your meals.');
        return;
      }
    }

    if (!permission.granted) {
      Alert.alert('Permission Required', 'Camera permission is needed to take photos of your meals.');
      return;
    }

    setShowCamera(true);
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        console.log('Taking picture...');
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
        });
        
        console.log('Photo taken:', photo.uri);
        setCapturedPhoto(photo.uri);
        setShowCamera(false);
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Error', 'Failed to take picture. Please try again.');
      }
    }
  };

  const handleMealSelection = (mealType, mealData) => {
    console.log('Selected meal:', mealType, mealData);
    setSelectedMeal({
      type: mealType,
      data: mealData,
    });
  };

  // FIXED: Enhanced meal logging with better calorie preservation
  const handleLogMeal = async () => {
    if (!capturedPhoto || !selectedMeal) {
      Alert.alert('Incomplete', 'Please take a photo and select a meal from your plan.');
      return;
    }

    try {
      setIsLogging(true);
      console.log('Logging meal...');

      // FIXED: Enhanced calorie extraction for preservation
      const extractCalories = (mealData) => {
        if (mealData.calories) return mealData.calories;
        if (mealData.nutrition?.calories) return mealData.nutrition.calories;
        
        // For Spoonacular API responses
        if (mealData.nutrition && mealData.nutrition.nutrients && Array.isArray(mealData.nutrition.nutrients)) {
          const calorieNutrient = mealData.nutrition.nutrients.find(n => 
            n.name && n.name.toLowerCase().includes('calorie')
          );
          if (calorieNutrient) return calorieNutrient.amount;
        }
        
        // Fallback estimates based on meal type
        const fallbackCalories = {
          breakfast: 350,
          lunch: 500,
          dinner: 600
        };
        
        return fallbackCalories[selectedMeal.type] || 400;
      };

      const extractedCalories = extractCalories(selectedMeal.data);

      // FIXED: Enhanced meal log data with better calorie preservation
      const mealLogData = {
        photoUri: capturedPhoto,
        mealType: selectedMeal.type,
        mealData: {
          ...selectedMeal.data,
          // Ensure calories are preserved in the main data object
          calories: extractedCalories,
          // Also preserve nutrition data if available
          nutrition: selectedMeal.data.nutrition || {
            calories: extractedCalories
          }
        },
        // Also store calories at the top level for easier access
        calories: extractedCalories,
        timestamp: new Date().toISOString(),
      };

      console.log('Enhanced meal log data with calories:', {
        mealType: mealLogData.mealType,
        extractedCalories,
        originalMealData: selectedMeal.data,
        enhancedMealData: mealLogData.mealData
      });

      // Save to Firebase Firestore
      const mealLogId = await saveMealLog(mealLogData);
      console.log('Meal successfully saved with ID:', mealLogId);

      // Show success message with consistent styling
      Alert.alert(
        '✅ Meal Logged Successfully!',
        `Your ${selectedMeal.type} (${extractedCalories} calories) has been logged and saved to your meal history.`,
        [
          {
            text: 'View Meal History',
            onPress: () => {
              router.push('/MealHistoryScreen');
            },
          },
          {
            text: 'Log Another Meal',
            onPress: () => {
              setCapturedPhoto(null);
              setSelectedMeal(null);
            },
          },
          {
            text: 'Done',
            style: 'default',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('Error logging meal:', error);
      Alert.alert(
        '❌ Logging Failed',
        'Failed to save your meal log. Please check your internet connection and try again.',
        [
          { text: 'Try Again', onPress: () => handleLogMeal() },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } finally {
      setIsLogging(false);
    }
  };

  // FIXED: Enhanced calorie extraction and display in meal cards
  const renderMealCard = (mealType, mealData) => {
    if (!mealData) return null;

    const isSelected = selectedMeal?.type === mealType;
    
    // FIXED: Better calorie extraction logic
    const getCalories = () => {
      // Try multiple possible locations for calorie data
      if (mealData.calories) return mealData.calories;
      if (mealData.nutrition?.calories) return mealData.nutrition.calories;
      
      // For Spoonacular API responses
      if (mealData.nutrition && typeof mealData.nutrition === 'object') {
        const nutrition = mealData.nutrition;
        if (nutrition.nutrients && Array.isArray(nutrition.nutrients)) {
          const calorieNutrient = nutrition.nutrients.find(n => 
            n.name && (n.name.toLowerCase().includes('calorie') || 
            n.title?.toLowerCase().includes('calorie'))
          );
          if (calorieNutrient) return calorieNutrient.amount;
        }
      }
      
      // Check if readyInMinutes was mistakenly used as calories
      if (mealData.readyInMinutes && !mealData.calories && mealData.readyInMinutes > 100) {
        // This might actually be calories
        return mealData.readyInMinutes;
      }
      
      // Fallback estimates based on meal type
      const estimatedCalories = {
        breakfast: 350,
        lunch: 500,
        dinner: 600
      };
      
      return estimatedCalories[mealType] || 400; // Default estimate
    };
    
    // Handle different meal data structures
    const mealTitle = mealData.title || mealData.name || `${mealType} meal`;
    const mealImage = mealData.image || 'https://via.placeholder.com/300x200?text=No+Image';
    const mealTime = mealData.readyInMinutes || mealData.prepTime || 'N/A';
    const mealServings = mealData.servings || 1;
    const mealCalories = Math.round(getCalories());
    
    console.log('Meal card calories:', {
      mealType,
      mealTitle,
      extractedCalories: mealCalories,
      originalData: mealData
    });
    
    return (
      <TouchableOpacity
        key={mealType}
        style={[styles.mealCard, isSelected && styles.selectedMealCard]}
        onPress={() => handleMealSelection(mealType, mealData)}
      >
        <View style={styles.mealCardHeader}>
          <Text style={[styles.mealType, isSelected && styles.selectedMealType]}>
            {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
          </Text>
          {isSelected && (
            <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
          )}
        </View>
        
        <Image source={{ uri: mealImage }} style={styles.mealImage} />
        
        <View style={styles.mealDetails}>
          <Text style={[styles.mealTitle, isSelected && styles.selectedMealTitle]}>
            {mealTitle}
          </Text>
          
          <View style={styles.mealMetrics}>
            <View style={styles.metricItem}>
              <Ionicons name="flame" size={14} color="#FF5722" />
              <Text style={styles.metricText}>{mealCalories} cal</Text>
            </View>
            
            {mealTime !== 'N/A' && (
              <View style={styles.metricItem}>
                <Ionicons name="time" size={14} color="#666" />
                <Text style={styles.metricText}>{mealTime} min</Text>
              </View>
            )}
            
            <View style={styles.metricItem}>
              <Ionicons name="people" size={14} color="#666" />
              <Text style={styles.metricText}>{mealServings} serving{mealServings > 1 ? 's' : ''}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
        >
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraHeader}>
              <TouchableOpacity
                style={styles.cameraBackButton}
                onPress={() => setShowCamera(false)}
              >
                <Ionicons name="close" size={30} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.cameraTitle}>Take a photo of your meal</Text>
            </View>
            
            <View style={styles.cameraControls}>
              <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                <View style={styles.captureButtonInner} />
              </TouchableOpacity>
            </View>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Log Your Meal</Text>
          <TouchableOpacity 
            style={styles.historyButton} 
            onPress={() => router.push('/MealHistoryScreen')}
          >
            <Ionicons name="time" size={24} color="#4CAF50" />
          </TouchableOpacity>
        </View>

        {/* Photo Section */}
        <View style={styles.photoSection}>
          <Text style={styles.sectionTitle}>📸 Meal Photo</Text>
          {capturedPhoto ? (
            <View style={styles.photoPreview}>
              <Image source={{ uri: capturedPhoto }} style={styles.previewImage} />
              <TouchableOpacity
                style={styles.retakeButton}
                onPress={() => setCapturedPhoto(null)}
              >
                <Ionicons name="camera" size={20} color="#fff" />
                <Text style={styles.retakeButtonText}>Retake Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.takePhotoButton} onPress={handleTakePhoto}>
              <Ionicons name="camera" size={40} color="#4CAF50" />
              <Text style={styles.takePhotoText}>Take Photo of Your Meal</Text>
              <Text style={styles.takePhotoSubtext}>Tap to open camera</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Meal Selection Section */}
        <View style={styles.mealSelectionSection}>
          <Text style={styles.sectionTitle}>🍽️ Select from Today's Meal Plan</Text>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#4CAF50" />
              <Text style={styles.loadingText}>Loading today's meal plan...</Text>
            </View>
          ) : !todaysMealPlan ? (
            <View style={styles.noMealPlanContainer}>
              <Ionicons name="calendar-outline" size={48} color="#ccc" />
              <Text style={styles.noMealPlanTitle}>No Meal Plan for Today</Text>
              <Text style={styles.noMealPlanText}>
                Create a meal plan first to start logging your meals.
              </Text>
              <TouchableOpacity
                style={styles.createPlanButton}
                onPress={() => router.push('/MealPlanScreen')}
              >
                <Text style={styles.createPlanButtonText}>Create Meal Plan</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.mealCardsContainer}>
              {todaysMealPlan.breakfast && renderMealCard('breakfast', todaysMealPlan.breakfast)}
              {todaysMealPlan.lunch && renderMealCard('lunch', todaysMealPlan.lunch)}
              {todaysMealPlan.dinner && renderMealCard('dinner', todaysMealPlan.dinner)}
            </View>
          )}
        </View>

        {/* Log Button */}
        {capturedPhoto && selectedMeal && (
          <View style={styles.logButtonContainer}>
            <TouchableOpacity
              style={[styles.logButton, isLogging && styles.logButtonDisabled]}
              onPress={handleLogMeal}
              disabled={isLogging}
            >
              {isLogging ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
              )}
              <Text style={styles.logButtonText}>
                {isLogging ? 'Saving Meal Log...' : 'Log Meal'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
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
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSpacer: {
    width: 34,
  },
  historyButton: {
    padding: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  photoSection: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  takePhotoButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  takePhotoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginTop: 10,
  },
  takePhotoSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  photoPreview: {
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 15,
  },
  retakeButton: {
    backgroundColor: '#FF9800',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retakeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  mealSelectionSection: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  noMealPlanContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noMealPlanTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    marginBottom: 8,
  },
  noMealPlanText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  createPlanButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  createPlanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  mealCardsContainer: {
    gap: 15,
  },
  mealCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 15,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedMealCard: {
    borderColor: '#4CAF50',
    backgroundColor: '#f1f8e9',
    shadowColor: '#4CAF50',
    shadowOpacity: 0.3,
  },
  mealCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  mealType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textTransform: 'capitalize',
  },
  selectedMealType: {
    color: '#4CAF50',
  },
  mealImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 10,
  },
  mealDetails: {
    gap: 8,
  },
  mealTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    lineHeight: 20,
  },
  selectedMealTitle: {
    color: '#2e7d32',
  },
  mealMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  logButtonContainer: {
    padding: 20,
  },
  logButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  logButtonDisabled: {
    backgroundColor: '#a5d6a7',
  },
  logButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  // Camera styles
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'space-between',
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
  },
  cameraBackButton: {
    padding: 10,
  },
  cameraTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginRight: 50,
  },
  cameraControls: {
    alignItems: 'center',
    paddingBottom: 50,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
});

export default MealLoggingScreen;