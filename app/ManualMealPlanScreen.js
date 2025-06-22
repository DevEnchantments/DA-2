// app/ManualMealPlanScreen.js
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { createManualMealPlan, getPatientById } from '../mealPlanService';
import { searchRecipesByMealType } from '../spoonacularClient';
import { useAuth } from './_layout';

const ManualMealPlanScreen = () => {
  const { patientId } = useLocalSearchParams();
  const { isDoctor } = useAuth();

  // Patient and plan state
  const [patient, setPatient] = useState(null);
  const [duration, setDuration] = useState(7);
  const [currentStep, setCurrentStep] = useState(1); // 1: Breakfasts, 2: Lunches, 3: Dinners
  
  // Meal selection state
  const [selectedBreakfasts, setSelectedBreakfasts] = useState([]);
  const [selectedLunches, setSelectedLunches] = useState([]);
  const [selectedDinners, setSelectedDinners] = useState([]);
  
  // Recipe browsing state
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [currentMealType, setCurrentMealType] = useState('breakfast');
  const [recipes, setRecipes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingRecipes, setLoadingRecipes] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(false);

  const durationOptions = [3, 7, 14, 30];
  const stepTitles = {
    1: 'Select Breakfasts',
    2: 'Select Lunches', 
    3: 'Select Dinners'
  };
  const mealTypeMap = {
    1: 'breakfast',
    2: 'lunch',
    3: 'dinner'
  };

  useEffect(() => {
    if (patientId && isDoctor) {
      loadPatientData();
    }
  }, [patientId, isDoctor]);

  // Reset selections when duration changes
  useEffect(() => {
    setSelectedBreakfasts([]);
    setSelectedLunches([]);
    setSelectedDinners([]);
    setCurrentStep(1);
  }, [duration]);

  // Access control
  if (!isDoctor) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed" size={64} color="#FF5722" />
          <Text style={styles.accessDeniedTitle}>Access Denied</Text>
          <Text style={styles.accessDeniedText}>
            This feature is only available for medical professionals.
          </Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const loadPatientData = async () => {
    try {
      setLoading(true);
      const patientData = await getPatientById(patientId);
      setPatient(patientData);
    } catch (error) {
      console.error('Error loading patient:', error);
      Alert.alert('Error', 'Failed to load patient data. Please try again.');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const loadRecipes = async (mealType, search = '') => {
    try {
      setLoadingRecipes(true);
      console.log(`Loading ${mealType} recipes with search: "${search}"`);
      
      const recipeResults = await searchRecipesByMealType(mealType, search);
      setRecipes(recipeResults);
      
      console.log(`Loaded ${recipeResults.length} ${mealType} recipes`);
    } catch (error) {
      console.error('Error loading recipes:', error);
      Alert.alert('Error', 'Failed to load recipes. Please try again.');
    } finally {
      setLoadingRecipes(false);
    }
  };

  const openRecipeModal = (step) => {
    const mealType = mealTypeMap[step];
    setCurrentMealType(mealType);
    setCurrentStep(step);
    setSearchTerm('');
    setShowRecipeModal(true);
    loadRecipes(mealType);
  };

  const selectRecipe = (recipe) => {
    const currentMealType = mealTypeMap[currentStep];
    
    if (currentStep === 1) {
      if (selectedBreakfasts.length < duration) {
        setSelectedBreakfasts([...selectedBreakfasts, recipe]);
      }
    } else if (currentStep === 2) {
      if (selectedLunches.length < duration) {
        setSelectedLunches([...selectedLunches, recipe]);
      }
    } else if (currentStep === 3) {
      if (selectedDinners.length < duration) {
        setSelectedDinners([...selectedDinners, recipe]);
      }
    }
    
    // Auto-close modal when all meals for current type are selected
    const currentSelections = getCurrentSelections();
    if (currentSelections.length + 1 >= duration) {
      setShowRecipeModal(false);
    }
  };

  const removeRecipe = (step, index) => {
    if (step === 1) {
      const updated = selectedBreakfasts.filter((_, i) => i !== index);
      setSelectedBreakfasts(updated);
    } else if (step === 2) {
      const updated = selectedLunches.filter((_, i) => i !== index);
      setSelectedLunches(updated);
    } else if (step === 3) {
      const updated = selectedDinners.filter((_, i) => i !== index);
      setSelectedDinners(updated);
    }
  };

  const getCurrentSelections = () => {
    if (currentStep === 1) return selectedBreakfasts;
    if (currentStep === 2) return selectedLunches;
    if (currentStep === 3) return selectedDinners;
    return [];
  };

  const goToNextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceedToNext = () => {
    const currentSelections = getCurrentSelections();
    return currentSelections.length === duration;
  };

  const canCreatePlan = () => {
    return selectedBreakfasts.length === duration && 
           selectedLunches.length === duration && 
           selectedDinners.length === duration;
  };

  const calculateTotalNutrition = () => {
    const allMeals = [...selectedBreakfasts, ...selectedLunches, ...selectedDinners];
    
    return allMeals.reduce((total, meal) => ({
      calories: total.calories + (meal.nutrition?.calories || 0),
      protein: total.protein + (meal.nutrition?.protein || 0),
      carbs: total.carbs + (meal.nutrition?.carbs || 0),
      fat: total.fat + (meal.nutrition?.fat || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
  };

  // FIXED: Create meal plan with standardized week structure
  const createMealPlan = async () => {
    try {
      setLoading(true);
      
      // FIXED: Create week structure to match AI meal plans
      const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const weekStructure = {};
      
      for (let day = 1; day <= duration; day++) {
        const dayName = dayNames[day - 1]; // Convert day number to day name
        weekStructure[dayName] = {
          breakfast: selectedBreakfasts[day - 1],
          lunch: selectedLunches[day - 1],
          dinner: selectedDinners[day - 1],
        };
      }

      const mealPlanData = {
        patientId: patientId,
        duration: duration,
        week: weekStructure, // CHANGED: Use 'week' instead of 'meals'
        totalNutrition: calculateTotalNutrition(),
        type: 'manual',
        createdBy: 'doctor'
      };

      console.log('Creating manual meal plan with week structure:', mealPlanData);
      
      const mealPlanId = await createManualMealPlan(mealPlanData);
      
      Alert.alert(
        'Success!',
        `Manual meal plan created successfully for ${patient?.firstName} ${patient?.lastName}!`,
        [
          {
            text: 'OK',
            onPress: () => router.back()
          }
        ]
      );
      
    } catch (error) {
      console.error('Error creating meal plan:', error);
      Alert.alert('Error', error.message || 'Failed to create meal plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderPatientHeader = () => (
    <View style={styles.patientHeader}>
      {patient?.photoUrl ? (
        <Image source={{ uri: patient.photoUrl }} style={styles.patientPhoto} />
      ) : (
        <View style={styles.defaultAvatar}>
          <Ionicons name="person" size={24} color="#4CAF50" />
        </View>
      )}
      <View style={styles.patientInfo}>
        <Text style={styles.patientName}>
          {patient?.firstName} {patient?.lastName}
        </Text>
        <Text style={styles.patientEmail}>{patient?.email}</Text>
      </View>
    </View>
  );

  const renderDurationSelector = () => (
    <View style={styles.durationSection}>
      <Text style={styles.sectionTitle}>Plan Duration</Text>
      <View style={styles.durationOptions}>
        {durationOptions.map((option) => (
          <TouchableOpacity
            key={option}
            style={[
              styles.durationOption,
              duration === option && styles.selectedDuration
            ]}
            onPress={() => setDuration(option)}
          >
            <Text style={[
              styles.durationText,
              duration === option && styles.selectedDurationText
            ]}>
              {option} Days
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStepProgress = () => (
    <View style={styles.stepProgress}>
      <View style={styles.progressHeader}>
        <Text style={styles.stepTitle}>{stepTitles[currentStep]}</Text>
        <Text style={styles.stepCounter}>
          Step {currentStep} of 3
        </Text>
      </View>
      
      <View style={styles.progressBar}>
        {[1, 2, 3].map((step) => (
          <View
            key={step}
            style={[
              styles.progressStep,
              step <= currentStep && styles.activeProgressStep
            ]}
          />
        ))}
      </View>
      
      <Text style={styles.stepDescription}>
        Select {duration} {mealTypeMap[currentStep]} recipes for your {duration}-day plan
      </Text>
    </View>
  );

  const renderMealSelections = () => {
    const currentSelections = getCurrentSelections();
    const needed = duration - currentSelections.length;
    
    return (
      <View style={styles.mealSelections}>
        <View style={styles.selectionHeader}>
          <Text style={styles.selectionTitle}>
            Selected {mealTypeMap[currentStep]}s ({currentSelections.length}/{duration})
          </Text>
          {needed > 0 && (
            <TouchableOpacity
              style={styles.addMealButton}
              onPress={() => openRecipeModal(currentStep)}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.addMealText}>Add {mealTypeMap[currentStep]}</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mealsList}>
          {currentSelections.map((meal, index) => (
            <View key={index} style={styles.selectedMealCard}>
              <Image source={{ uri: meal.image }} style={styles.mealImage} />
              <Text style={styles.mealName} numberOfLines={2}>{meal.name}</Text>
              <Text style={styles.mealCalories}>{Math.round(meal.nutrition?.calories || 0)} cal</Text>
              <TouchableOpacity
                style={styles.removeMealButton}
                onPress={() => removeRecipe(currentStep, index)}
              >
                <Ionicons name="close" size={16} color="#FF6B6B" />
              </TouchableOpacity>
            </View>
          ))}
          
          {needed > 0 && (
            <TouchableOpacity
              style={styles.addMealCard}
              onPress={() => openRecipeModal(currentStep)}
            >
              <Ionicons name="add" size={32} color="#4CAF50" />
              <Text style={styles.addMealCardText}>Add {mealTypeMap[currentStep]}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    );
  };

  const renderNavigationButtons = () => (
    <View style={styles.navigationButtons}>
      {currentStep > 1 && (
        <TouchableOpacity
          style={styles.previousButton}
          onPress={goToPreviousStep}
        >
          <Ionicons name="arrow-back" size={20} color="#4CAF50" />
          <Text style={styles.previousButtonText}>Previous</Text>
        </TouchableOpacity>
      )}
      
      <View style={styles.buttonSpacer} />
      
      {currentStep < 3 ? (
        <TouchableOpacity
          style={[
            styles.nextButton,
            !canProceedToNext() && styles.disabledButton
          ]}
          onPress={goToNextStep}
          disabled={!canProceedToNext()}
        >
          <Text style={styles.nextButtonText}>Next</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[
            styles.createButton,
            !canCreatePlan() && styles.disabledButton
          ]}
          onPress={createMealPlan}
          disabled={!canCreatePlan()}
        >
          <Ionicons name="checkmark" size={20} color="#fff" />
          <Text style={styles.createButtonText}>Create Plan</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderNutritionSummary = () => {
    if (currentStep !== 3 || !canCreatePlan()) return null;
    
    const nutrition = calculateTotalNutrition();
    const dailyAverage = {
      calories: Math.round(nutrition.calories / duration),
      protein: Math.round(nutrition.protein / duration),
      carbs: Math.round(nutrition.carbs / duration),
      fat: Math.round(nutrition.fat / duration),
    };
    
    return (
      <View style={styles.nutritionSummary}>
        <Text style={styles.nutritionTitle}>Daily Average Nutrition</Text>
        <View style={styles.nutritionGrid}>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionValue}>{dailyAverage.calories}</Text>
            <Text style={styles.nutritionLabel}>Calories</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionValue}>{dailyAverage.protein}g</Text>
            <Text style={styles.nutritionLabel}>Protein</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionValue}>{dailyAverage.carbs}g</Text>
            <Text style={styles.nutritionLabel}>Carbs</Text>
          </View>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionValue}>{dailyAverage.fat}g</Text>
            <Text style={styles.nutritionLabel}>Fat</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderRecipeModal = () => (
    <Modal
      visible={showRecipeModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setShowRecipeModal(false)}
          >
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            Select {mealTypeMap[currentStep]} ({getCurrentSelections().length}/{duration})
          </Text>
          <View style={styles.modalHeaderSpacer} />
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search ${mealTypeMap[currentStep]} recipes...`}
            value={searchTerm}
            onChangeText={(text) => {
              setSearchTerm(text);
              loadRecipes(currentMealType, text);
            }}
          />
        </View>

        {loadingRecipes ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4CAF50" />
            <Text style={styles.loadingText}>Loading recipes...</Text>
          </View>
        ) : (
          <FlatList
            data={recipes}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.recipeGrid}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.recipeCard}
                onPress={() => selectRecipe(item)}
              >
                <Image source={{ uri: item.image }} style={styles.recipeImage} />
                <View style={styles.recipeInfo}>
                  <Text style={styles.recipeName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.recipeCalories}>
                    {Math.round(item.nutrition?.calories || 0)} cal
                  </Text>
                  <Text style={styles.recipeTime}>
                    {item.prepTime || 'N/A'} min
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );

  if (loading && !patient) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manual Meal Plan</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content}>
        {/* Patient Header */}
        {renderPatientHeader()}

        {/* Duration Selector */}
        {renderDurationSelector()}

        {/* Step Progress */}
        {renderStepProgress()}

        {/* Meal Selections */}
        {renderMealSelections()}

        {/* Nutrition Summary */}
        {renderNutritionSummary()}
      </ScrollView>

      {/* Navigation Buttons */}
      {renderNavigationButtons()}

      {/* Recipe Modal */}
      {renderRecipeModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  
  // Header styles
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  backButton: {
    padding: 5,
  },
  headerSpacer: {
    width: 34,
  },
  
  // Content styles
  content: {
    flex: 1,
  },
  
  // Patient header styles
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  patientEmail: {
    fontSize: 14,
    color: '#666',
  },
  
  // Duration selector styles
  durationSection: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  durationOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  durationOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
    alignItems: 'center',
  },
  selectedDuration: {
    backgroundColor: '#4CAF50',
  },
  durationText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  selectedDurationText: {
    color: '#fff',
  },
  
  // Step progress styles
  stepProgress: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  stepCounter: {
    fontSize: 14,
    color: '#666',
  },
  progressBar: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  progressStep: {
    flex: 1,
    height: 4,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 2,
    borderRadius: 2,
  },
  activeProgressStep: {
    backgroundColor: '#4CAF50',
  },
  stepDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  
  // Meal selections styles
  mealSelections: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  selectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  addMealButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addMealText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  mealsList: {
    flexDirection: 'row',
  },
  selectedMealCard: {
    width: 120,
    marginRight: 12,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 8,
    position: 'relative',
  },
  mealImage: {
    width: '100%',
    height: 80,
    borderRadius: 6,
    marginBottom: 8,
  },
  mealName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  mealCalories: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '500',
  },
  removeMealButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMealCard: {
    width: 120,
    height: 120,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMealCardText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  
  // Navigation buttons styles
  navigationButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  previousButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  previousButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  buttonSpacer: {
    flex: 1,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: '#ccc',
    borderColor: '#ccc',
  },
  
  // Nutrition summary styles
  nutritionSummary: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  nutritionTitle: {
    fontSize: 16,
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalCloseButton: {
    padding: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalHeaderSpacer: {
    width: 34,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  recipeGrid: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  recipeCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recipeImage: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  recipeInfo: {
    padding: 12,
  },
  recipeName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  recipeCalories: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
    marginBottom: 2,
  },
  recipeTime: {
    fontSize: 12,
    color: '#666',
  },
  
  // Loading and access denied styles
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
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
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
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ManualMealPlanScreen;

