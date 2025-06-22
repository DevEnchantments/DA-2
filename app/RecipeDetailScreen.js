import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

// Import the Spoonacular API client
import { getRecipeDetails } from '../spoonacularClient.js';

// Import bookmark service functions
import { addBookmark, isBookmarked, removeBookmark } from '../bookmarkService.js';

const NutrientItem = ({ name, amount, unit, percentOfDailyNeeds }) => (
  <View style={styles.nutrientItem}>
    <Text style={styles.nutrientName}>{name}</Text>
    <View style={styles.nutrientValueContainer}>
      <Text style={styles.nutrientValue}>{amount} {unit}</Text>
      {percentOfDailyNeeds && (
        <Text style={styles.nutrientPercent}>{percentOfDailyNeeds.toFixed(0)}% DV</Text>
      )}
    </View>
  </View>
);

const RecipeDetailScreen = () => {
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const { recipeId } = params;
  
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRecipeBookmarked, setIsRecipeBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);

  useEffect(() => {
    const fetchRecipeDetails = async () => {
      if (!recipeId) {
        setError('Recipe ID is missing');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await getRecipeDetails(recipeId, true);
        setRecipe(data);
      } catch (err) {
        console.error('Error fetching recipe details:', err);
        setError('Failed to load recipe details. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchRecipeDetails();
  }, [recipeId]);

  // Check bookmark status when recipe is loaded
  useEffect(() => {
    const checkBookmarkStatus = async () => {
      if (recipeId) {
        try {
          const bookmarked = await isBookmarked(recipeId);
          setIsRecipeBookmarked(bookmarked);
        } catch (error) {
          console.error('Error checking bookmark status:', error);
        }
      }
    };

    checkBookmarkStatus();
  }, [recipeId]);

  const handleBookmark = async () => {
    if (!recipe) return;

    setBookmarkLoading(true);
    try {
      if (isRecipeBookmarked) {
        // Remove bookmark
        const success = await removeBookmark(recipeId);
        if (success) {
          setIsRecipeBookmarked(false);
          Alert.alert('Removed', 'Recipe removed from bookmarks');
        } else {
          Alert.alert('Error', 'Failed to remove bookmark. Please try again.');
        }
      } else {
        // Add bookmark
        const success = await addBookmark(recipe);
        if (success) {
          setIsRecipeBookmarked(true);
          Alert.alert('Saved', 'Recipe added to bookmarks');
        } else {
          Alert.alert('Error', 'Failed to add bookmark. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setBookmarkLoading(false);
    }
  };

  const handleOpenSourceUrl = () => {
    if (recipe?.sourceUrl) {
      Linking.openURL(recipe.sourceUrl).catch(err => {
        console.error('Error opening URL:', err);
      });
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading recipe details...</Text>
      </SafeAreaView>
    );
  }

  if (error || !recipe) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar barStyle="dark-content" />
        <Ionicons name="alert-circle-outline" size={48} color="#d32f2f" />
        <Text style={styles.errorText}>{error || 'Recipe not found'}</Text>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Extract key nutritional information
  const calories = recipe.nutrition?.nutrients.find(n => n.name === 'Calories');
  const carbs = recipe.nutrition?.nutrients.find(n => n.name === 'Carbohydrates');
  const protein = recipe.nutrition?.nutrients.find(n => n.name === 'Protein');
  const fat = recipe.nutrition?.nutrients.find(n => n.name === 'Fat');
  const sugar = recipe.nutrition?.nutrients.find(n => n.name === 'Sugar');
  const fiber = recipe.nutrition?.nutrients.find(n => n.name === 'Fiber');
  const sodium = recipe.nutrition?.nutrients.find(n => n.name === 'Sodium');

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Recipe Details</Text>
        <TouchableOpacity 
          onPress={handleBookmark}
          disabled={bookmarkLoading}
          style={styles.bookmarkButton}
        >
          {bookmarkLoading ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <Ionicons 
              name={isRecipeBookmarked ? "bookmark" : "bookmark-outline"} 
              size={24} 
              color={isRecipeBookmarked ? "#4CAF50" : "#000"} 
            />
          )}
        </TouchableOpacity>
      </View>
      
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Recipe Image */}
        <Image 
          source={{ uri: recipe.image }} 
          style={styles.recipeImage} 
          resizeMode="cover"
        />
        
        {/* Recipe Title and Quick Info */}
        <View style={styles.titleContainer}>
          <Text style={styles.recipeTitle}>{recipe.title}</Text>
          <View style={styles.quickInfoContainer}>
            <View style={styles.quickInfoItem}>
              <Ionicons name="time-outline" size={18} color="#666" />
              <Text style={styles.quickInfoText}>{recipe.readyInMinutes} min</Text>
            </View>
            <View style={styles.quickInfoItem}>
              <Ionicons name="people-outline" size={18} color="#666" />
              <Text style={styles.quickInfoText}>{recipe.servings} servings</Text>
            </View>
            {recipe.glutenFree && (
              <View style={styles.dietBadge}>
                <Text style={styles.dietBadgeText}>Gluten-Free</Text>
              </View>
            )}
            {recipe.dairyFree && (
              <View style={styles.dietBadge}>
                <Text style={styles.dietBadgeText}>Dairy-Free</Text>
              </View>
            )}
          </View>
        </View>
        
        {/* Diabetic Info Card - Especially important for your app */}
        <View style={styles.diabeticInfoCard}>
          <Text style={styles.diabeticInfoTitle}>Diabetic Information</Text>
          <View style={styles.diabeticInfoContent}>
            <View style={styles.diabeticInfoItem}>
              <Text style={styles.diabeticInfoLabel}>Carbs:</Text>
              <Text style={styles.diabeticInfoValue}>
                {carbs ? `${carbs.amount.toFixed(1)}${carbs.unit}` : 'N/A'}
              </Text>
            </View>
            <View style={styles.diabeticInfoItem}>
              <Text style={styles.diabeticInfoLabel}>Sugar:</Text>
              <Text style={styles.diabeticInfoValue}>
                {sugar ? `${sugar.amount.toFixed(1)}${sugar.unit}` : 'N/A'}
              </Text>
            </View>
            <View style={styles.diabeticInfoItem}>
              <Text style={styles.diabeticInfoLabel}>Glycemic Load:</Text>
              <Text style={styles.diabeticInfoValue}>
                {recipe.glycemicLoad ? recipe.glycemicLoad.toFixed(1) : 'Low'}
              </Text>
            </View>
          </View>
          <Text style={styles.diabeticInfoNote}>
            {carbs && carbs.amount > 30 
              ? 'High in carbs. Consider portion control.' 
              : 'Suitable for a low-carb diabetic diet.'}
          </Text>
        </View>
        
        {/* Nutrition Summary */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Nutrition Summary</Text>
          <View style={styles.nutritionSummary}>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>
                {calories ? calories.amount.toFixed(0) : '0'}
              </Text>
              <Text style={styles.nutritionLabel}>Calories</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>
                {carbs ? carbs.amount.toFixed(1) : '0'}g
              </Text>
              <Text style={styles.nutritionLabel}>Carbs</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>
                {protein ? protein.amount.toFixed(1) : '0'}g
              </Text>
              <Text style={styles.nutritionLabel}>Protein</Text>
            </View>
            <View style={styles.nutritionItem}>
              <Text style={styles.nutritionValue}>
                {fat ? fat.amount.toFixed(1) : '0'}g
              </Text>
              <Text style={styles.nutritionLabel}>Fat</Text>
            </View>
          </View>
        </View>
        
        {/* Ingredients */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Ingredients</Text>
          <View style={styles.ingredientsList}>
            {recipe.extendedIngredients?.map((ingredient, index) => (
              <View key={index} style={styles.ingredientItem}>
                <Image 
                  source={{ 
                    uri: `https://spoonacular.com/cdn/ingredients_100x100/${ingredient.image}`
                  }}
                  style={styles.ingredientImage}
                  resizeMode="contain"
                />
                <Text style={styles.ingredientText}>{ingredient.original}</Text>
              </View>
            ))}
          </View>
        </View>
        
        {/* Instructions */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Instructions</Text>
          {recipe.analyzedInstructions && recipe.analyzedInstructions.length > 0 ? (
            recipe.analyzedInstructions[0].steps.map((step, index) => (
              <View key={index} style={styles.instructionItem}>
                <View style={styles.instructionNumberContainer}>
                  <Text style={styles.instructionNumber}>{step.number}</Text>
                </View>
                <Text style={styles.instructionText}>{step.step}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.noInstructionsText}>
              {recipe.instructions || 'No detailed instructions available. Check the source website for more information.'}
            </Text>
          )}
        </View>
        
        {/* Detailed Nutrition */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Detailed Nutrition</Text>
          <View style={styles.nutrientsList}>
            {recipe.nutrition?.nutrients.slice(0, 12).map((nutrient, index) => (
              <NutrientItem 
                key={index}
                name={nutrient.name}
                amount={nutrient.amount.toFixed(1)}
                unit={nutrient.unit}
                percentOfDailyNeeds={nutrient.percentOfDailyNeeds}
              />
            ))}
          </View>
          
          {/* View More Nutrition Button */}
          <TouchableOpacity style={styles.viewMoreButton}>
            <Text style={styles.viewMoreButtonText}>View Complete Nutrition</Text>
          </TouchableOpacity>
        </View>
        
        {/* Source Attribution */}
        {recipe.sourceName && (
          <View style={styles.sourceContainer}>
            <Text style={styles.sourceText}>
              Recipe from: {recipe.sourceName}
            </Text>
            {recipe.sourceUrl && (
              <TouchableOpacity onPress={handleOpenSourceUrl}>
                <Text style={styles.sourceLink}>View Original</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {/* Bottom Spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  errorText: {
    marginTop: 10,
    color: '#d32f2f',
    fontSize: 16,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#4CAF50',
    borderRadius: 5,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
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
  bookmarkButton: {
    padding: 5,
    minWidth: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
  },
  recipeImage: {
    width: '100%',
    height: 250,
  },
  titleContainer: {
    padding: 15,
    backgroundColor: '#fff',
  },
  recipeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  quickInfoContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  quickInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
    marginBottom: 5,
  },
  quickInfoText: {
    marginLeft: 5,
    color: '#666',
    fontSize: 14,
  },
  dietBadge: {
    backgroundColor: '#e0f2f1',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 5,
  },
  dietBadgeText: {
    color: '#00796b',
    fontSize: 12,
    fontWeight: '500',
  },
  diabeticInfoCard: {
    margin: 15,
    padding: 15,
    backgroundColor: '#e8f5e9',
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  diabeticInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 10,
  },
  diabeticInfoContent: {
    marginBottom: 10,
  },
  diabeticInfoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  diabeticInfoLabel: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  diabeticInfoValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: 'bold',
  },
  diabeticInfoNote: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#555',
  },
  sectionContainer: {
    marginTop: 15,
    padding: 15,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  nutritionSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  nutritionItem: {
    alignItems: 'center',
    flex: 1,
  },
  nutritionValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  nutritionLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  ingredientsList: {
    marginBottom: 10,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  ingredientImage: {
    width: 50,
    height: 50,
    marginTop: 2,
    marginRight: 12,
    backgroundColor: '#fffff',
  },
  ingredientText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  instructionItem: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  instructionNumberContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  instructionNumber: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  instructionText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
    lineHeight: 22,
  },
  noInstructionsText: {
    fontSize: 15,
    color: '#666',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  nutrientsList: {
    marginBottom: 15,
  },
  nutrientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  nutrientName: {
    fontSize: 15,
    color: '#333',
  },
  nutrientValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nutrientValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  nutrientPercent: {
    fontSize: 13,
    color: '#666',
    marginLeft: 8,
  },
  viewMoreButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  viewMoreButtonText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  sourceContainer: {
    margin: 15,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    alignItems: 'center',
  },
  sourceText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  sourceLink: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  bottomSpacing: {
    height: 20,
  },
});

export default RecipeDetailScreen;

