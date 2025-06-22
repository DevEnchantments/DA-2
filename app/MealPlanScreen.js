import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import {
  findAlternativeRecipes,
  generateMealPlan,
  generateShoppingList
} from '../spoonacularClient';

// Import meal plan service functions
import {
  getAssignedPatients,
  getCurrentWeekMealPlan,
  getMostRecentMealPlan,
  updateMealPlan
} from '../mealPlanService';

// Import Firestore functions
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../configs/firebaseConfig';

// Import auth context for role checking
import { useAuth } from './_layout';

// FIXED: Enhanced MealCard component with fire icon for calories
const MealCard = ({ meal, mealType, dayName, onPress, onSwap, canSwap = true }) => {
  // FIXED: Better calorie extraction logic
  const getCalories = () => {
    // Try multiple possible locations for calorie data
    if (meal.calories) return meal.calories;
    if (meal.nutrition?.calories) return meal.nutrition.calories;
    
    // For Spoonacular API responses
    if (meal.nutrition && typeof meal.nutrition === 'object') {
      const nutrition = meal.nutrition;
      if (nutrition.nutrients && Array.isArray(nutrition.nutrients)) {
        const calorieNutrient = nutrition.nutrients.find(n => 
          n.name && (n.name.toLowerCase().includes('calorie') || 
          n.title?.toLowerCase().includes('calorie'))
        );
        if (calorieNutrient) return calorieNutrient.amount;
      }
    }
    
    // Check if readyInMinutes was mistakenly used as calories
    if (meal.readyInMinutes && !meal.calories && meal.readyInMinutes > 100) {
      // This might actually be calories
      return meal.readyInMinutes;
    }
    
    // Fallback estimates based on meal type
    const estimatedCalories = {
      breakfast: 350,
      lunch: 500,
      dinner: 600
    };
    
    return estimatedCalories[mealType?.toLowerCase()] || 400;
  };

  const calories = Math.round(getCalories());
  const prepTime = meal.readyInMinutes || meal.prepTime || 'N/A';

  console.log('MealCard calories:', {
    mealType,
    mealTitle: meal.title || meal.name,
    extractedCalories: calories,
    originalData: meal
  });

  return (
    <TouchableOpacity style={styles.mealCard} onPress={onPress}>
      <View style={styles.mealImageContainer}>
        <Image 
          source={{ uri: meal.image || 'https://via.placeholder.com/100x80' }}
          style={styles.mealImage}
          resizeMode="cover"
        />
        <View style={styles.mealTypeOverlay}>
          <Text style={styles.mealTypeText}>{mealType}</Text>
        </View>
        {canSwap && (
          <TouchableOpacity onPress={onSwap} style={styles.swapButton}>
            <Ionicons name="refresh" size={14} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.mealInfo}>
        <Text style={styles.mealTitle} numberOfLines={2}>
          {meal.title || meal.name}
        </Text>
        {/* FIXED: Added fire icon with proper calorie display */}
        <View style={styles.mealMetrics}>
          <View style={styles.metricItem}>
            <Ionicons name="flame" size={14} color="#FF5722" />
            <Text style={styles.mealCalories}>{calories} cal</Text>
          </View>
          <View style={styles.metricItem}>
            <Ionicons name="time" size={14} color="#666" />
            <Text style={styles.mealTime}>{prepTime} min</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const MealPlanScreen = () => {
  // Consolidated state
  const [state, setState] = useState({
    mealPlan: null,
    mealPlanId: null,
    mealPlanType: 'ai',
    loading: false,
    refreshing: false,
    nutritionSummary: null,
    isLoadingExisting: true,
    currentPreferences: null,
    hasInitialLoad: false,
    assignedPatients: [],
    selectedPatient: null,
    loadingPatients: false,
  });
  
  // Role-based data
  const { user, isDoctor, isPatient, userType, userData } = useAuth();
  
  // Refs to prevent infinite loops and multiple generations
  const isGeneratingRef = useRef(false);
  const nutritionCalculatedRef = useRef(false);
  const cleanupRef = useRef(null);

  // Get navigation parameters
  const params = useLocalSearchParams();

  // Cleanup function
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        clearTimeout(cleanupRef.current);
      }
    };
  }, []);

  // Helper function to update state
  const updateState = (updates) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  // Error handling helper
  const handleError = (error, operation) => {
    console.error(`Error in ${operation}:`, error);
    Alert.alert('Error', `Failed to ${operation}. Please try again.`);
  };

  // Helper function to get week start
  const getWeekStart = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    const weekStart = new Date(d.setDate(diff));
    return weekStart.toISOString().split('T')[0];
  };

  // Handle meal press for navigation to recipe details
  const handleMealPress = (meal) => {
    console.log('Meal pressed:', meal);
    
    // Check if meal has the required ID for navigation
    if (meal.id) {
      router.push({
        pathname: '/RecipeDetailScreen',
        params: { 
          recipeId: meal.id.toString() 
        }
      });
    } else if (meal.recipeId) {
      // Sometimes the ID might be stored as recipeId
      router.push({
        pathname: '/RecipeDetailScreen',
        params: { 
          recipeId: meal.recipeId.toString() 
        }
      });
    } else {
      // Fallback - show alert if no ID is available
      Alert.alert(
        'Recipe Details', 
        'Recipe details are not available for this meal.',
        [{ text: 'OK' }]
      );
      console.log('No recipe ID found in meal object:', meal);
    }
  };

  // FIXED: Separate effects for better control
  useFocusEffect(
    useCallback(() => {
      const initializeScreen = async () => {
        try {
          // Handle force refresh first
          if (params.forceRefresh === 'true') {
            console.log('Force refresh triggered from PatientManagementScreen');
            await loadExistingMealPlan(true);
            router.setParams({ forceRefresh: undefined });
            return;
          }

          // Initialize doctor patients if doctor
          if (isDoctor) {
            await loadDoctorPatients();
          }
        } catch (error) {
          handleError(error, 'initialize screen');
        }
      };

      initializeScreen();
    }, [isDoctor, params.forceRefresh])
  );

  // FIXED: Separate effect for handling patient selection from navigation params
  useEffect(() => {
    const handlePatientSelection = async () => {
      if (!isDoctor) return;
      
      // Handle patient selection from navigation parameters
      if (params.selectedPatientId && params.selectedPatientName) {
        console.log('Processing patient selection from params:', params.selectedPatientId, params.selectedPatientName);
        
        // Wait for patients to be loaded
        if (state.assignedPatients.length === 0 && !state.loadingPatients) {
          console.log('Patients not loaded yet, waiting...');
          return;
        }
        
        // Find the patient in assigned patients
        const patient = state.assignedPatients.find(p => p.id === params.selectedPatientId);
        
        if (patient) {
          console.log('Found patient from params:', patient.firstName, patient.lastName);
          updateState({ selectedPatient: patient });
        } else {
          // Create patient object from params if not found in assigned patients
          console.log('Patient not found in assigned list, creating from params');
          const patientFromParams = {
            id: params.selectedPatientId,
            firstName: params.selectedPatientName.split(' ')[0] || 'Unknown',
            lastName: params.selectedPatientName.split(' ').slice(1).join(' ') || '',
          };
          updateState({ selectedPatient: patientFromParams });
        }
        
        // Clear the navigation params to prevent re-processing
        router.setParams({ 
          selectedPatientId: undefined, 
          selectedPatientName: undefined,
          generateNew: undefined 
        });
      }
    };

    handlePatientSelection();
  }, [params.selectedPatientId, params.selectedPatientName, state.assignedPatients.length, state.loadingPatients, isDoctor]);

  // FIXED: Separate effect for loading meal plan when patient is selected
  useEffect(() => {
    const loadMealPlan = async () => {
      if (isDoctor) {
        // For doctors, only load when a patient is selected
        if (state.selectedPatient && state.selectedPatient !== 'myself') {
          console.log('Loading meal plan for selected patient:', state.selectedPatient.firstName);
          await loadExistingMealPlan(params.generateNew === 'true');
          updateState({ hasInitialLoad: true });
        } else if (state.selectedPatient === 'myself') {
          console.log('Loading meal plan for doctor themselves');
          await loadExistingMealPlan(params.generateNew === 'true');
          updateState({ hasInitialLoad: true });
        }
      } else {
        // For patients, load their own meal plan if not already loaded
        if (!state.hasInitialLoad) {
          console.log('Loading meal plan for patient user');
          await loadExistingMealPlan(params.generateNew === 'true');
          updateState({ hasInitialLoad: true });
        }
      }
    };

    loadMealPlan();
  }, [state.selectedPatient, isDoctor, params.generateNew]);

  // Load doctor's assigned patients
  const loadDoctorPatients = async () => {
    if (!isDoctor) return;
    
    try {
      updateState({ loadingPatients: true });
      console.log('Loading doctor patients...');
      const patients = await getAssignedPatients();
      
      updateState({ 
        assignedPatients: patients,
        loadingPatients: false,
        selectedPatient: state.selectedPatient || 'myself'
      });
      
      console.log('Loaded patients:', patients.length);
    } catch (error) {
      handleError(error, 'load doctor patients');
      updateState({ loadingPatients: false });
    }
  };

  const loadSavedPreferences = async () => {
    try {
      const savedPreferences = await AsyncStorage.getItem('mealPlanPreferences');
      if (savedPreferences) {
        const preferences = JSON.parse(savedPreferences);
        updateState({ currentPreferences: preferences });
        console.log('Loaded saved preferences:', preferences);
        return preferences;
      }
      return null;
    } catch (error) {
      console.error('Error loading saved preferences:', error);
      return null;
    }
  };

  // FIXED: Updated loadExistingMealPlan function to better handle target user
  const loadExistingMealPlan = async (forceAI = false) => {
    try {
      updateState({ isLoadingExisting: true });
      console.log('Loading existing meal plan... Force AI:', forceAI);
      
      // Load saved preferences
      await loadSavedPreferences();
      
      // Determine target user ID more reliably
      let targetPatientId = null;
      if (isDoctor) {
        if (state.selectedPatient && state.selectedPatient !== 'myself' && state.selectedPatient.id) {
          targetPatientId = state.selectedPatient.id;
          console.log('Loading meal plan for doctor\'s selected patient:', targetPatientId);
        } else {
          console.log('Loading meal plan for doctor themselves');
          targetPatientId = null; // Doctor's own meal plan
        }
      } else {
        console.log('Loading meal plan for patient user');
        targetPatientId = null; // Patient's own meal plan
      }
      
      let existingPlan = null;
      
      if (!forceAI) {
        // Try to get most recent meal plan first
        existingPlan = await getMostRecentMealPlan(targetPatientId);
        if (existingPlan) {
          console.log('Found recent meal plan:', existingPlan.id);
        }
      }
      
      if (!existingPlan) {
        // Fallback to weekly AI meal plan
        const currentDate = new Date().toISOString().split('T')[0];
        const mealPlanId = `${targetPatientId || user.uid}_${currentDate}`;
        
        console.log('Looking for weekly meal plan with ID:', mealPlanId);
        
        const mealPlanRef = doc(db, 'mealPlans', mealPlanId);
        const mealPlanDoc = await getDoc(mealPlanRef);
        
        if (mealPlanDoc.exists()) {
          const data = mealPlanDoc.data();
          console.log('Found weekly meal plan');
          existingPlan = {
            id: mealPlanDoc.id,
            ...data
          };
        }
      }

      if (existingPlan) {
        await processMealPlan(existingPlan);
      } else {
        console.log('No existing meal plan found');
        updateState({
          mealPlan: null,
          mealPlanId: null,
          mealPlanType: 'ai',
          nutritionSummary: null
        });
      }
    } catch (error) {
      handleError(error, 'load existing meal plan');
    } finally {
      updateState({ isLoadingExisting: false });
    }
  };

  // FIXED: Separated meal plan processing logic
  const processMealPlan = async (existingPlan) => {
    try {
      console.log('Processing meal plan:', existingPlan.id);
      
      // Determine plan type
      let planType = 'ai';
      if (existingPlan.type === 'manual' || existingPlan.planType === 'manual') {
        planType = 'manual';
      } else if (existingPlan.id && existingPlan.id.includes('_manual_')) {
        planType = 'manual';
      }
      
      console.log('Detected plan type:', planType);
      
      updateState({
        mealPlanType: planType,
        mealPlanId: existingPlan.id
      });
      
      if (planType === 'manual') {
        await processManualMealPlan(existingPlan);
      } else {
        await processAIMealPlan(existingPlan);
      }
    } catch (error) {
      handleError(error, 'process meal plan');
    }
  };

  const processManualMealPlan = async (existingPlan) => {
    console.log('Processing manual meal plan...');
    
    let manualMealPlan = null;
    
    if (existingPlan.week) {
      manualMealPlan = { week: existingPlan.week };
    } else if (existingPlan.mealPlan && existingPlan.mealPlan.week) {
      manualMealPlan = existingPlan.mealPlan;
    } else {
      manualMealPlan = existingPlan;
    }
    
    updateState({ mealPlan: manualMealPlan });
    
    // Set nutrition summary from stored data
    if (existingPlan.dailyAverageNutrition) {
      console.log('Setting nutrition from dailyAverageNutrition:', existingPlan.dailyAverageNutrition);
      updateState({ nutritionSummary: existingPlan.dailyAverageNutrition });
    }
  };

  const processAIMealPlan = async (existingPlan) => {
    console.log('Processing AI meal plan...');
    const aiMealPlan = existingPlan.mealPlan || existingPlan;
    
    if (aiMealPlan?.week) {
      const convertedWeek = {};
      Object.keys(aiMealPlan.week).forEach(day => {
        const dayData = aiMealPlan.week[day];
        
        if (dayData.meals && Array.isArray(dayData.meals)) {
          // Convert array to breakfast/lunch/dinner structure
          convertedWeek[day] = {
            breakfast: dayData.meals[0] || null,
            lunch: dayData.meals[1] || null,
            dinner: dayData.meals[2] || null,
            nutrients: dayData.nutrients || null
          };
        } else {
          // Already in correct format
          convertedWeek[day] = dayData;
        }
      });
      
      const convertedPlan = { ...aiMealPlan, week: convertedWeek };
      updateState({ mealPlan: convertedPlan });
      
      // Calculate nutrition summary for AI plans
      await calculateNutritionSummaryForPlan(convertedPlan);
    } else {
      updateState({ mealPlan: aiMealPlan });
    }
  };

  const generateNewMealPlan = async (preferences = null) => {
    console.log('=== generateNewMealPlan called ===');
    
    // Prevent multiple simultaneous generations
    if (isGeneratingRef.current) {
      console.log('Already generating meal plan, skipping...');
      return;
    }

    try {
      isGeneratingRef.current = true;
      updateState({ loading: true });
      nutritionCalculatedRef.current = false;

      // Use passed preferences or current preferences or load from storage
      let finalPreferences = preferences || state.currentPreferences;
      if (!finalPreferences) {
        finalPreferences = await loadSavedPreferences();
      }

      if (!finalPreferences) {
        Alert.alert(
          'No Preferences Set',
          'Please set your meal preferences first.',
          [
            {
              text: 'Set Preferences',
              onPress: () => router.push('/MealPlanPreferencesScreen')
            },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
        return;
      }

      // Add randomization to prevent same meal plans
      const randomizedPreferences = {
        ...finalPreferences,
        randomSeed: Math.floor(Math.random() * 10000),
        userId: user?.uid || 'anonymous',
        patientId: state.selectedPatient?.id || 'self',
        timestamp: Date.now()
      };

      console.log('Generating meal plan with randomized preferences:', randomizedPreferences);
      const generatedPlan = await generateMealPlan(randomizedPreferences);

      if (generatedPlan && generatedPlan.week) {
        updateState({ 
          mealPlan: generatedPlan,
          mealPlanType: 'ai'
        });
        
        // Calculate nutrition summary immediately
        await calculateNutritionSummaryForPlan(generatedPlan);

        // Save the meal plan
        await saveMealPlanToFirebase(generatedPlan);
        
        // FIXED: Use proper timeout cleanup
        cleanupRef.current = setTimeout(() => {
          loadExistingMealPlan(true);
        }, 500);
      } else {
        throw new Error('Failed to generate meal plan');
      }
    } catch (error) {
      handleError(error, 'generate meal plan');
      await loadExistingMealPlan();
    } finally {
      updateState({ loading: false });
      isGeneratingRef.current = false;
    }
  };

  const saveMealPlanToFirebase = async (generatedPlan) => {
    try {
      let targetPatientId = null;
      if (isDoctor && state.selectedPatient !== 'myself' && state.selectedPatient?.id) {
        targetPatientId = state.selectedPatient.id;
      }
      const doctorId = isDoctor ? user.uid : null;
      
      console.log('Saving meal plan for:', { targetPatientId, doctorId });
      
      const currentDate = new Date().toISOString().split('T')[0];
      const aiMealPlanId = `${targetPatientId || user.uid}_${currentDate}`;
      
      const mealPlanData = {
        mealPlan: generatedPlan,
        createdAt: new Date(),
        updatedAt: new Date(),
        doctorId: doctorId,
        patientId: targetPatientId || user.uid,
        status: 'active',
        medicalNotes: '',
        approvedAt: doctorId ? new Date() : null,
        approvedBy: doctorId,
        createdBy: doctorId ? 'doctor' : 'patient',
        planType: 'ai',
        weekStart: getWeekStart(new Date()),
      };
      
      const mealPlanRef = doc(db, 'mealPlans', aiMealPlanId);
      await setDoc(mealPlanRef, mealPlanData);
      
      updateState({ mealPlanId: aiMealPlanId });
      console.log('AI meal plan saved with ID:', aiMealPlanId);
    } catch (error) {
      handleError(error, 'save meal plan to Firebase');
    }
  };

  // FIXED: Improved nutrition calculation
  const calculateNutritionSummaryForPlan = async (plan) => {
    try {
      console.log('Calculating nutrition summary for plan...');
      
      if (nutritionCalculatedRef.current) {
        console.log('Nutrition already calculated, skipping...');
        return;
      }

      let totalCalories = 0;
      let totalProtein = 0;
      let totalCarbs = 0;
      let totalFat = 0;
      let daysProcessed = 0;
      
      if (plan.week) {
        // Try to get nutrition from the original stored meal plan first
        const existingPlan = await getCurrentWeekMealPlan(
          isDoctor && state.selectedPatient !== 'myself' && state.selectedPatient?.id ? state.selectedPatient.id : null
        );
        
        const weekData = (existingPlan?.mealPlan?.week) || plan.week;
        
        Object.keys(weekData).forEach(day => {
          const dayData = weekData[day];
          if (dayData.nutrients) {
            totalCalories += parseFloat(dayData.nutrients.calories || 0);
            totalProtein += parseFloat(dayData.nutrients.protein || 0);
            totalCarbs += parseFloat(dayData.nutrients.carbohydrates || dayData.nutrients.carbs || 0);
            totalFat += parseFloat(dayData.nutrients.fat || 0);
            daysProcessed++;
          }
        });
      }
      
      console.log(`Processed nutrition for ${daysProcessed} days`);
      
      if (daysProcessed > 0) {
        const nutrition = {
          calories: totalCalories / daysProcessed,
          protein: totalProtein / daysProcessed,
          carbs: totalCarbs / daysProcessed,
          fat: totalFat / daysProcessed
        };
        
        console.log('Final calculated daily average nutrition:', nutrition);
        updateState({ nutritionSummary: nutrition });
        nutritionCalculatedRef.current = true;
      } else {
        updateState({
          nutritionSummary: { calories: 0, protein: 0, carbs: 0, fat: 0 }
        });
      }
    } catch (error) {
      handleError(error, 'calculate nutrition summary');
      updateState({
        nutritionSummary: { calories: 0, protein: 0, carbs: 0, fat: 0 }
      });
    }
  };

  const handleSwapMeal = async (dayName, mealType, currentMeal) => {
    try {
      updateState({ loading: true });
      console.log(`Swapping ${mealType} for ${dayName}`);
      
      const alternatives = await findAlternativeRecipes(currentMeal, mealType);
      
      if (alternatives && alternatives.length > 0) {
        const newMeal = alternatives[0];
        
        // Update the meal plan
        const updatedPlan = { ...state.mealPlan };
        updatedPlan.week[dayName][mealType] = newMeal;
        
        updateState({ mealPlan: updatedPlan });
        
        // Update in database
        if (state.mealPlanId) {
          await updateMealPlan(state.mealPlanId, updatedPlan);
        }
        
        // Recalculate nutrition
        nutritionCalculatedRef.current = false;
        await calculateNutritionSummaryForPlan(updatedPlan);
      }
    } catch (error) {
      handleError(error, 'swap meal');
    } finally {
      updateState({ loading: false });
    }
  };

  const handleGenerateShoppingList = async () => {
    try {
      if (!state.mealPlan) {
        Alert.alert('No Meal Plan', 'Please generate a meal plan first.');
        return;
      }

      updateState({ loading: true });
      console.log('Generating shopping list for meal plan...');
      
      const allMeals = [];
      
      if (state.mealPlan.week) {
        Object.keys(state.mealPlan.week).forEach(day => {
          const dayMeals = state.mealPlan.week[day];
          if (dayMeals.breakfast) allMeals.push(dayMeals.breakfast);
          if (dayMeals.lunch) allMeals.push(dayMeals.lunch);
          if (dayMeals.dinner) allMeals.push(dayMeals.dinner);
        });
      }
      
      if (allMeals.length === 0) {
        Alert.alert('No Meals', 'No meals found in the current meal plan.');
        return;
      }

      const rawShoppingList = await generateShoppingList(allMeals);
      
      // Convert shopping list to expected format
      const convertedShoppingList = {
        produce: [],
        dairy: [],
        meat: [],
        pantry: [],
        other: []
      };
      
      if (rawShoppingList && typeof rawShoppingList === 'object') {
        Object.keys(rawShoppingList).forEach(category => {
          const items = rawShoppingList[category];
          if (Array.isArray(items)) {
            let targetCategory = 'other';
            const lowerCategory = category.toLowerCase();
            
            if (lowerCategory.includes('produce') || lowerCategory.includes('vegetable') || lowerCategory.includes('fruit')) {
              targetCategory = 'produce';
            } else if (lowerCategory.includes('dairy') || lowerCategory.includes('milk') || lowerCategory.includes('cheese')) {
              targetCategory = 'dairy';
            } else if (lowerCategory.includes('meat') || lowerCategory.includes('protein') || lowerCategory.includes('fish')) {
              targetCategory = 'meat';
            } else if (lowerCategory.includes('pantry') || lowerCategory.includes('grain') || lowerCategory.includes('spice')) {
              targetCategory = 'pantry';
            }
            
            convertedShoppingList[targetCategory].push(...items);
          }
        });
      }
      
      // Navigate to shopping list screen
      router.push({
        pathname: '/ShoppingListScreen',
        params: { 
          shoppingList: JSON.stringify(convertedShoppingList),
          mealPlanId: state.mealPlanId 
        }
      });
    } catch (error) {
      handleError(error, 'generate shopping list');
    } finally {
      updateState({ loading: false });
    }
  };

  const navigateToPreferences = () => {
    router.push('/MealPlanPreferencesScreen');
  };

  const onRefresh = async () => {
    updateState({ refreshing: true });
    await loadExistingMealPlan();
    updateState({ refreshing: false });
  };

  const renderDayCard = (dayName, dayMeals) => {
    const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    
    return (
      <View key={dayName} style={styles.dayCard}>
        <Text style={styles.dayTitle}>{capitalizedDay}</Text>
        <View style={styles.mealsContainer}>
          {dayMeals.breakfast && (
            <MealCard
              meal={dayMeals.breakfast}
              mealType="Breakfast"
              dayName={dayName}
              onPress={() => handleMealPress(dayMeals.breakfast)}
              onSwap={() => handleSwapMeal(dayName, 'breakfast', dayMeals.breakfast)}
              canSwap={state.mealPlanType === 'ai'}
            />
          )}
          {dayMeals.lunch && (
            <MealCard
              meal={dayMeals.lunch}
              mealType="Lunch"
              dayName={dayName}
              onPress={() => handleMealPress(dayMeals.lunch)}
              onSwap={() => handleSwapMeal(dayName, 'lunch', dayMeals.lunch)}
              canSwap={state.mealPlanType === 'ai'}
            />
          )}
          {dayMeals.dinner && (
            <MealCard
              meal={dayMeals.dinner}
              mealType="Dinner"
              dayName={dayName}
              onPress={() => handleMealPress(dayMeals.dinner)}
              onSwap={() => handleSwapMeal(dayName, 'dinner', dayMeals.dinner)}
              canSwap={state.mealPlanType === 'ai'}
            />
          )}
        </View>
      </View>
    );
  };

  const renderPatientSelector = () => {
    if (!isDoctor || state.loadingPatients) {
      return null;
    }

    return (
      <View style={styles.patientSelector}>
        <Text style={styles.selectorTitle}>Select Patient</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.patientList}>
          <TouchableOpacity
            style={[
              styles.patientCard,
              state.selectedPatient === 'myself' && styles.selectedPatientCard
            ]}
            onPress={() => updateState({ selectedPatient: 'myself' })}
          >
            <View style={styles.patientAvatar}>
              <Ionicons name="person" size={20} color="#fff" />
            </View>
            <Text style={[
              styles.patientName,
              state.selectedPatient === 'myself' && styles.selectedPatientName
            ]}>
              Myself
            </Text>
          </TouchableOpacity>

          {state.assignedPatients.map((patient) => (
            <TouchableOpacity
              key={patient.id}
              style={[
                styles.patientCard,
                state.selectedPatient?.id === patient.id && styles.selectedPatientCard
              ]}
              onPress={() => updateState({ selectedPatient: patient })}
            >
              <View style={styles.patientAvatar}>
                {patient.photoUrl ? (
                  <Image source={{ uri: patient.photoUrl }} style={styles.patientPhoto} />
                ) : (
                  <Ionicons name="person" size={20} color="#fff" />
                )}
              </View>
              <Text style={[
                styles.patientName,
                state.selectedPatient?.id === patient.id && styles.selectedPatientName
              ]}>
                {patient.firstName} {patient.lastName}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderActionButtons = () => {
    if (!state.mealPlan) return null;

    return (
      <View style={styles.actionButtons}>
        {state.mealPlanType === 'ai' ? (
          <TouchableOpacity
            style={[styles.actionButton, styles.regenerateButton]}
            onPress={() => generateNewMealPlan()}
            disabled={state.loading}
          >
            {state.loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="refresh" size={20} color="#fff" />
            )}
            <Text style={styles.actionButtonText}>
              {state.loading ? 'Generating...' : 'Regenerate'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, styles.generateAIButton]}
            onPress={() => generateNewMealPlan()}
            disabled={state.loading}
          >
            {state.loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="sparkles" size={20} color="#fff" />
            )}
            <Text style={styles.actionButtonText}>
              {state.loading ? 'Generating...' : 'Generate AI Plan'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[
            styles.actionButton, 
            styles.shoppingButton,
            state.mealPlanType === 'manual' && !state.loading && styles.fullWidthButton
          ]}
          onPress={handleGenerateShoppingList}
          disabled={state.loading}
        >
          <Ionicons name="list" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Shopping List</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmptyState = () => {
    const patientName = state.selectedPatient === 'myself' ? 'yourself' : 
                      state.selectedPatient ? `${state.selectedPatient.firstName} ${state.selectedPatient.lastName}` : 'this user';
    
    return (
      <View style={styles.emptyState}>
        <Ionicons name="restaurant-outline" size={64} color="#ccc" />
        <Text style={styles.emptyStateTitle}>No Meal Plan</Text>
        <Text style={styles.emptyStateText}>
          No meal plan found for {patientName}. Generate a new meal plan to get started.
        </Text>
        <TouchableOpacity style={styles.generateButton} onPress={() => generateNewMealPlan()}>
          <Text style={styles.generateButtonText}>Generate Meal Plan</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (state.isLoadingExisting) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading meal plan...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {state.mealPlanType === 'manual' ? 'Manual Meal Plan' : 'My Meal Plan'}
        </Text>
        <View style={styles.headerActions}>
          {isDoctor && (
            <TouchableOpacity onPress={() => router.push('/PatientManagementScreen')}>
              <Ionicons name="people-outline" size={24} color="#4CAF50" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={navigateToPreferences}>
            <Ionicons name="settings-outline" size={24} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Patient Selector for Doctors */}
      {renderPatientSelector()}

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={state.refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Nutrition Summary */}
        {state.nutritionSummary && (
          <View style={styles.nutritionCard}>
            <Text style={styles.nutritionTitle}>Daily Average Nutrition</Text>
            <View style={styles.nutritionGrid}>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{Math.round(state.nutritionSummary.calories || 0)}</Text>
                <Text style={styles.nutritionLabel}>Calories</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{Math.round(state.nutritionSummary.protein || 0)}g</Text>
                <Text style={styles.nutritionLabel}>Protein</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{Math.round(state.nutritionSummary.carbs || 0)}g</Text>
                <Text style={styles.nutritionLabel}>Carbs</Text>
              </View>
              <View style={styles.nutritionItem}>
                <Text style={styles.nutritionValue}>{Math.round(state.nutritionSummary.fat || 0)}g</Text>
                <Text style={styles.nutritionLabel}>Fat</Text>
              </View>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        {renderActionButtons()}

        {/* Meal Plan Content */}
        {state.mealPlan && state.mealPlan.week ? (
          <View style={styles.mealPlanContainer}>
            {Object.keys(state.mealPlan.week).map(dayName => 
              renderDayCard(dayName, state.mealPlan.week[dayName])
            )}
          </View>
        ) : (
          renderEmptyState()
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
  headerActions: {
    flexDirection: 'row',
    gap: 15,
  },
  patientSelector: {
    backgroundColor: '#fff',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  selectorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
    paddingHorizontal: 20,
  },
  patientList: {
    paddingHorizontal: 15,
  },
  patientCard: {
    alignItems: 'center',
    marginHorizontal: 5,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f8f8f8',
    minWidth: 80,
  },
  selectedPatientCard: {
    backgroundColor: '#4CAF50',
  },
  patientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  patientPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  patientName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
    textAlign: 'center',
  },
  selectedPatientName: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  nutritionCard: {
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
  nutritionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 15,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 10,
    gap: 8,
  },
  fullWidthButton: {
    flex: 1,
  },
  regenerateButton: {
    backgroundColor: '#4CAF50',
  },
  generateAIButton: {
    backgroundColor: '#FF9800',
  },
  shoppingButton: {
    backgroundColor: '#4CAF50',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  mealPlanContainer: {
    paddingHorizontal: 20,
  },
  dayCard: {
    backgroundColor: '#fff',
    marginBottom: 20,
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dayTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
    textAlign: 'center',
  },
  mealsContainer: {
    gap: 10,
  },
  mealCard: {
    flexDirection: 'row',
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  mealImageContainer: {
    position: 'relative',
    marginRight: 15,
  },
  mealImage: {
    width: 80,
    height: 60,
    borderRadius: 8,
  },
  mealTypeOverlay: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mealTypeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  swapButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mealInfo: {
    flex: 1,
  },
  mealTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  // FIXED: Enhanced meal metrics with fire icon
  mealMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mealCalories: {
    fontSize: 12,
    color: '#FF5722',
    fontWeight: '600',
  },
  mealTime: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 24,
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
  generateButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MealPlanScreen;