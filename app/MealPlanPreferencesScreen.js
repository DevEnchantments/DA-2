import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const PreferenceSection = ({ title, children }) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const DietOption = ({ title, subtitle, isSelected, onPress }) => (
  <TouchableOpacity 
    style={[styles.optionCard, isSelected && styles.optionCardSelected]} 
    onPress={onPress}
  >
    <View style={styles.optionContent}>
      <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>
        {title}
      </Text>
      <Text style={[styles.optionSubtitle, isSelected && styles.optionSubtitleSelected]}>
        {subtitle}
      </Text>
    </View>
    <View style={[styles.radioButton, isSelected && styles.radioButtonSelected]}>
      {isSelected && <View style={styles.radioButtonInner} />}
    </View>
  </TouchableOpacity>
);

const CalorieSlider = ({ value, onValueChange, min = 1200, max = 3000 }) => {
  const percentage = ((value - min) / (max - min)) * 100;
  
  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderLabels}>
        <Text style={styles.sliderLabel}>{min}</Text>
        <Text style={styles.sliderValue}>{value} calories</Text>
        <Text style={styles.sliderLabel}>{max}</Text>
      </View>
      <View style={styles.sliderTrack}>
        <View style={[styles.sliderFill, { width: `${percentage}%` }]} />
        <TouchableOpacity 
          style={[styles.sliderThumb, { left: `${percentage}%` }]}
          // In a real implementation, you'd add pan gesture handling here
        />
      </View>
      <View style={styles.sliderButtons}>
        <TouchableOpacity 
          style={styles.sliderButton}
          onPress={() => onValueChange(Math.max(min, value - 50))}
        >
          <Ionicons name="remove" size={16} color="#4CAF50" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.sliderButton}
          onPress={() => onValueChange(Math.min(max, value + 50))}
        >
          <Ionicons name="add" size={16} color="#4CAF50" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const MealPlanPreferencesScreen = () => {
  const [selectedDiet, setSelectedDiet] = useState('diabetic');
  const [targetCalories, setTargetCalories] = useState(2000);
  const [excludeIngredients, setExcludeIngredients] = useState('');
  const [timeFrame, setTimeFrame] = useState('week');
  const [includeSnacks, setIncludeSnacks] = useState(false);
  const [vegetarianFriendly, setVegetarianFriendly] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load saved preferences on component mount
  useEffect(() => {
    loadSavedPreferences();
  }, []);

  const loadSavedPreferences = async () => {
    try {
      const savedPrefs = await AsyncStorage.getItem('mealPlanPreferences');
      if (savedPrefs) {
        const prefs = JSON.parse(savedPrefs);
        setSelectedDiet(prefs.diet || 'diabetic');
        setTargetCalories(prefs.targetCalories || 2000);
        setExcludeIngredients(prefs.exclude || '');
        setTimeFrame(prefs.timeFrame || 'week');
        setIncludeSnacks(prefs.includeSnacks || false);
        setVegetarianFriendly(prefs.vegetarianFriendly || false);
        console.log('Loaded saved preferences:', prefs);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  const savePreferences = async (preferences) => {
    try {
      await AsyncStorage.setItem('mealPlanPreferences', JSON.stringify(preferences));
      console.log('Preferences saved:', preferences);
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  };

  const dietOptions = [
    {
      id: 'diabetic',
      title: 'Diabetic-Friendly',
      subtitle: 'Low sugar, balanced carbs for blood sugar control'
    },
    {
      id: 'ketogenic',
      title: 'Ketogenic',
      subtitle: 'High fat, very low carb for ketosis'
    },
    {
      id: 'vegan',
      title: 'Vegan',
      subtitle: 'Plant-based, no animal products'
    },
    {
      id: 'vegetarian',
      title: 'Vegetarian',
      subtitle: 'No meat, includes dairy and eggs'
    },
    {
      id: 'paleo',
      title: 'Paleo',
      subtitle: 'Whole foods, no processed ingredients'
    },
    {
      id: 'whole30',
      title: 'Whole30',
      subtitle: 'Clean eating, no sugar or grains'
    },
    {
      id: 'gluten-free',
      title: 'Gluten-Free',
      subtitle: 'No wheat, barley, or rye'
    },
    {
      id: '',
      title: 'No Restrictions',
      subtitle: 'All types of recipes included'
    }
  ];

  const timeFrameOptions = [
    { id: 'day', title: '1 Day', subtitle: 'Plan for today only' },
    { id: 'week', title: '1 Week', subtitle: 'Full weekly meal plan' },
  ];

  const handleGeneratePlan = async () => {
    setLoading(true);
    
    const preferences = {
      diet: selectedDiet,
      targetCalories,
      exclude: excludeIngredients,
      timeFrame,
      includeSnacks,
      vegetarianFriendly
    };

    try {
      // Save preferences for future use
      await savePreferences(preferences);
      
      // FIXED: Navigate back first, then set params to avoid string "undefined" issue
      router.back();
      
      // Use setTimeout to ensure navigation completes before setting params
      setTimeout(() => {
        router.setParams({
          generateNew: 'true',
          preferences: JSON.stringify(preferences),
          timestamp: Date.now().toString()
        });
      }, 100);
      
      console.log('Generating meal plan with preferences:', preferences);
    } catch (error) {
      console.error('Error handling generate plan:', error);
      Alert.alert('Error', 'Failed to save preferences. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const addCommonAllergy = (allergy) => {
    const current = excludeIngredients.split(',').map(s => s.trim()).filter(s => s);
    if (!current.includes(allergy)) {
      const updated = [...current, allergy].join(', ');
      setExcludeIngredients(updated);
    }
  };

  const commonAllergies = ['Nuts', 'Dairy', 'Eggs', 'Shellfish', 'Soy', 'Gluten'];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meal Plan Preferences</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Diet Type */}
        <PreferenceSection title="🎯 Diet Type">
          {dietOptions.map(option => (
            <DietOption
              key={option.id}
              title={option.title}
              subtitle={option.subtitle}
              isSelected={selectedDiet === option.id}
              onPress={() => setSelectedDiet(option.id)}
            />
          ))}
        </PreferenceSection>

        {/* Daily Calories */}
        <PreferenceSection title="🔥 Daily Calorie Target">
          <CalorieSlider
            value={targetCalories}
            onValueChange={setTargetCalories}
            min={1200}
            max={3000}
          />
          <Text style={styles.calorieNote}>
            Recommended: 1,800-2,200 calories for most adults
          </Text>
        </PreferenceSection>

        {/* Time Frame */}
        <PreferenceSection title="📅 Planning Period">
          {timeFrameOptions.map(option => (
            <DietOption
              key={option.id}
              title={option.title}
              subtitle={option.subtitle}
              isSelected={timeFrame === option.id}
              onPress={() => setTimeFrame(option.id)}
            />
          ))}
        </PreferenceSection>

        {/* Exclude Ingredients */}
        <PreferenceSection title="🚫 Exclude Ingredients">
          <TextInput
            style={styles.textInput}
            placeholder="Enter ingredients to avoid (comma separated)"
            placeholderTextColor="#999"
            value={excludeIngredients}
            onChangeText={setExcludeIngredients}
            multiline
          />
          
          <Text style={styles.allergyLabel}>Common Allergies:</Text>
          <View style={styles.allergyTags}>
            {commonAllergies.map(allergy => (
              <TouchableOpacity
                key={allergy}
                style={styles.allergyTag}
                onPress={() => addCommonAllergy(allergy)}
              >
                <Text style={styles.allergyTagText}>{allergy}</Text>
                <Ionicons name="add" size={14} color="#4CAF50" />
              </TouchableOpacity>
            ))}
          </View>
        </PreferenceSection>

        {/* Additional Options */}
        <PreferenceSection title="⚙️ Additional Options">
          <View style={styles.switchOption}>
            <View style={styles.switchContent}>
              <Text style={styles.switchTitle}>Include Snacks</Text>
              <Text style={styles.switchSubtitle}>Add healthy snack suggestions</Text>
            </View>
            <Switch
              value={includeSnacks}
              onValueChange={setIncludeSnacks}
              trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.switchOption}>
            <View style={styles.switchContent}>
              <Text style={styles.switchTitle}>Vegetarian Friendly</Text>
              <Text style={styles.switchSubtitle}>Prefer plant-based options when possible</Text>
            </View>
            <Switch
              value={vegetarianFriendly}
              onValueChange={setVegetarianFriendly}
              trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
              thumbColor="#fff"
            />
          </View>
        </PreferenceSection>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Generate Button */}
      <View style={styles.bottomContainer}>
        <TouchableOpacity 
          style={[styles.generateButton, loading && styles.generateButtonDisabled]} 
          onPress={handleGeneratePlan}
          disabled={loading}
        >
          <Ionicons name="restaurant" size={20} color="#fff" />
          <Text style={styles.generateButtonText}>
            {loading ? 'Saving...' : 'Generate Meal Plan'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  headerRight: {
    width: 24,
  },
  scrollContainer: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 8,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    marginBottom: 12,
    backgroundColor: '#f8f8f8',
  },
  optionCardSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#4CAF50' + '10',
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  optionTitleSelected: {
    color: '#4CAF50',
  },
  optionSubtitle: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  optionSubtitleSelected: {
    color: '#4CAF50',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  radioButtonSelected: {
    borderColor: '#4CAF50',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4CAF50',
  },
  sliderContainer: {
    marginVertical: 8,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sliderLabel: {
    fontSize: 14,
    color: '#666',
  },
  sliderValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  sliderTrack: {
    height: 6,
    backgroundColor: '#e0e0e0',
    borderRadius: 3,
    position: 'relative',
    marginBottom: 16,
  },
  sliderFill: {
    height: 6,
    backgroundColor: '#4CAF50',
    borderRadius: 3,
  },
  sliderThumb: {
    position: 'absolute',
    top: -6,
    width: 18,
    height: 18,
    backgroundColor: '#4CAF50',
    borderRadius: 9,
    marginLeft: -9,
  },
  sliderButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f8f8f8',
    borderWidth: 2,
    borderColor: '#4CAF50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calorieNote: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 8,
    textAlign: 'center',
  },
  textInput: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f8f8f8',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  allergyLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  allergyTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  allergyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  allergyTagText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  switchOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  switchContent: {
    flex: 1,
  },
  switchTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  switchSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  bottomContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  generateButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  generateButtonDisabled: {
    backgroundColor: '#ccc',
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomPadding: {
    height: 20,
  },
});

export default MealPlanPreferencesScreen;

