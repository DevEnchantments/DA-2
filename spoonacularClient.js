import axios from 'axios';

// Replace this with your actual Spoonacular API key
const API_KEY = 'ad940a0a2929429b930c1514e6b47c10';
const BASE_URL = 'https://api.spoonacular.com';

// Create an axios instance with default configuration
const spoonacularClient = axios.create({
  baseURL: BASE_URL,
  params: {
    apiKey: API_KEY,
  },
  timeout: 10000, // 10 seconds timeout
});

/**
 * Map internal diet names to Spoonacular API diet names
 * @param {string} internalDiet - Internal diet name from the app
 * @returns {string} - Spoonacular API diet name
 */
const mapDietToSpoonacular = (internalDiet) => {
  const dietMap = {
    'diabetic': 'diabetic',
    'ketogenic': 'keto',
    'vegan': 'vegan',
    'vegetarian': 'vegetarian',
    'paleo': 'paleo',
    'whole30': 'whole30',
    'gluten-free': 'gluten free',
    '': '' // No restrictions
  };
  
  return dietMap[internalDiet] || '';
};

/**
 * Format meal plan parameters for Spoonacular API
 * @param {Object} params - Internal meal plan parameters
 * @returns {Object} - Formatted parameters for Spoonacular API
 */
const formatMealPlanParams = (params) => {
  const formattedParams = {
    timeFrame: params.timeFrame || 'week',
    targetCalories: params.targetCalories || 2000,
  };

  // Add diet parameter if specified
  if (params.diet) {
    const spoonacularDiet = mapDietToSpoonacular(params.diet);
    if (spoonacularDiet) {
      formattedParams.diet = spoonacularDiet;
    }
  }

  // Add exclude parameter if specified
  if (params.exclude) {
    formattedParams.exclude = params.exclude;
  }

  // Add randomization for unique results
  if (params.randomSeed) {
    formattedParams.offset = params.randomSeed % 100;
  }

  return formattedParams;
};

/**
 * NEW: Get detailed recipe information by ID
 * @param {number|string} recipeId - Recipe ID from Spoonacular
 * @param {boolean} includeNutrition - Whether to include nutrition information
 * @returns {Promise<Object>} - Detailed recipe information
 */
export const getRecipeDetails = async (recipeId, includeNutrition = true) => {
  try {
    console.log(`Fetching recipe details for ID: ${recipeId}`);
    
    const params = {
      includeNutrition: includeNutrition,
      addWinePairing: false,
      addTasteData: false,
    };

    const response = await spoonacularClient.get(`/recipes/${recipeId}/information`, {
      params: params
    });

    const recipe = response.data;
    
    // Ensure proper image URL
    if (recipe.image && !recipe.image.startsWith('http')) {
      recipe.image = `https://spoonacular.com/recipeImages/${recipe.image}`;
    }

    console.log(`Successfully fetched recipe details for: ${recipe.title}`);
    return recipe;
  } catch (error) {
    console.error('Error fetching recipe details:', error);
    
    // Check if it's a 404 error (recipe not found)
    if (error.response && error.response.status === 404) {
      throw new Error('Recipe not found');
    }
    
    // Check if it's a rate limit error
    if (error.response && error.response.status === 402) {
      throw new Error('API quota exceeded. Please try again later.');
    }
    
    // For other errors, throw a generic error
    throw new Error('Failed to load recipe details. Please try again.');
  }
};

/**
 * FIXED: Generate a meal plan with proper image URLs
 * @param {Object} params - Meal plan parameters
 * @returns {Promise} - Promise with meal plan
 */
export const generateMealPlan = async (params) => {
  try {
    console.log('Generating meal plan with params:', params);
    
    // Format parameters for Spoonacular API
    const formattedParams = formatMealPlanParams(params);
    console.log('Formatted params for API:', formattedParams);
    
    const response = await spoonacularClient.get('/mealplanner/generate', {
      params: formattedParams,
    });
    
    console.log('Spoonacular API Response:', response.data);
    
    let mealPlan = response.data;
    
    // FIXED: Properly construct full image URLs
    if (mealPlan && mealPlan.week) {
      Object.keys(mealPlan.week).forEach(day => {
        if (mealPlan.week[day].meals) {
          mealPlan.week[day].meals = mealPlan.week[day].meals.map(meal => ({
            ...meal,
            // FIXED: Ensure all images have full Spoonacular URLs
            image: meal.image ? (
              meal.image.startsWith('http') ? 
                meal.image : 
                `https://spoonacular.com/recipeImages/${meal.image}`
            ) : 'https://via.placeholder.com/300x200?text=No+Image',
            // Also add calories if missing
            calories: meal.calories || 0
          }));
        }
      });
    }
    
    console.log('Fixed meal plan with proper image URLs:', mealPlan);
    return mealPlan;
  } catch (error) {
    console.error('Error generating meal plan:', error);
    
    // Return fallback meal plan for development
    return getFallbackMealPlan();
  }
};

/**
 * Calculate nutritional summary for a list of meals
 * @param {Array} meals - Array of meal objects
 * @returns {Promise<Object>} - Nutritional summary
 */
export const calculateNutritionalSummary = async (meals) => {
  try {
    console.log('Calculating nutrition for meals:', meals.length);
    
    if (!meals || meals.length === 0) {
      return {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0
      };
    }

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;

    // Calculate totals from meal data
    meals.forEach(meal => {
      if (meal) {
        // Try different possible nutrition data locations
        const nutrition = meal.nutrition || meal;
        
        totalCalories += parseFloat(nutrition.calories || 0);
        totalProtein += parseFloat(nutrition.protein || 0);
        totalCarbs += parseFloat(nutrition.carbs || nutrition.carbohydrates || 0);
        totalFat += parseFloat(nutrition.fat || 0);
      }
    });

    const summary = {
      calories: totalCalories,
      protein: totalProtein,
      carbs: totalCarbs,
      fat: totalFat
    };

    console.log('Calculated nutrition summary:', summary);
    return summary;
  } catch (error) {
    console.error('Error calculating nutritional summary:', error);
    return {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0
    };
  }
};

/**
 * Find alternative recipes for a given meal
 * @param {Object} currentMeal - Current meal object
 * @param {string} mealType - Type of meal (breakfast, lunch, dinner)
 * @returns {Promise<Array>} - Array of alternative recipes
 */
export const findAlternativeRecipes = async (currentMeal, mealType) => {
  try {
    console.log(`Finding alternatives for ${mealType}:`, currentMeal.title);
    
    const response = await spoonacularClient.get('/recipes/complexSearch', {
      params: {
        type: mealType,
        number: 5,
        addRecipeInformation: true,
        fillIngredients: true,
        excludeIngredients: currentMeal.title // Exclude current meal
      }
    });

    // Fix image URLs for alternatives too
    const alternatives = response.data.results || [];
    return alternatives.map(recipe => ({
      ...recipe,
      image: recipe.image ? (
        recipe.image.startsWith('http') ? 
          recipe.image : 
          `https://spoonacular.com/recipeImages/${recipe.image}`
      ) : 'https://via.placeholder.com/300x200?text=No+Image'
    }));
  } catch (error) {
    console.error('Error finding alternative recipes:', error);
    return [];
  }
};

/**
 * Generate shopping list from meals
 * @param {Array} meals - Array of meal objects
 * @returns {Promise<Array>} - Shopping list items
 */
export const generateShoppingList = async (meals) => {
  try {
    console.log('Generating shopping list for meals:', meals.length);
    
    if (!meals || meals.length === 0) {
      return [];
    }

    const ingredients = new Map();

    // Extract ingredients from all meals
    meals.forEach(meal => {
      if (meal && meal.id) {
        // For Spoonacular meals, we need to get detailed recipe info
        // For now, use basic ingredient extraction
        if (meal.extendedIngredients) {
          meal.extendedIngredients.forEach(ingredient => {
            const name = ingredient.name || ingredient.original;
            const amount = ingredient.amount || 1;
            const unit = ingredient.unit || '';
            
            if (ingredients.has(name)) {
              ingredients.set(name, {
                ...ingredients.get(name),
                amount: ingredients.get(name).amount + amount
              });
            } else {
              ingredients.set(name, {
                name,
                amount,
                unit,
                aisle: ingredient.aisle || 'Other'
              });
            }
          });
        } else {
          // Fallback for meals without detailed ingredients
          const basicIngredients = [
            `Ingredients for ${meal.title || meal.name}`,
          ];
          
          basicIngredients.forEach(ingredient => {
            if (!ingredients.has(ingredient)) {
              ingredients.set(ingredient, {
                name: ingredient,
                amount: 1,
                unit: '',
                aisle: 'Other'
              });
            }
          });
        }
      }
    });

    // Convert Map to Array and group by aisle
    const shoppingList = Array.from(ingredients.values());
    
    // Group by aisle
    const groupedList = shoppingList.reduce((acc, item) => {
      const aisle = item.aisle || 'Other';
      if (!acc[aisle]) {
        acc[aisle] = [];
      }
      acc[aisle].push(item);
      return acc;
    }, {});

    console.log('Generated shopping list:', groupedList);
    return groupedList;
  } catch (error) {
    console.error('Error generating shopping list:', error);
    return {};
  }
};

/**
 * Search recipes by meal type and optional search term (using Spoonacular API)
 * @param {string} mealType - 'breakfast', 'lunch', or 'dinner'
 * @param {string} searchTerm - Optional search term
 * @param {number} number - Number of recipes to return
 * @returns {Promise<Array>} - Array of recipes from Spoonacular
 */
export const searchRecipesByMealType = async (mealType, searchTerm = '', number = 20) => {
  try {
    console.log(`Searching Spoonacular recipes for ${mealType} with term: "${searchTerm}"`);
    
    const params = {
      type: mealType,
      number: number,
      addRecipeInformation: true,
      fillIngredients: true,
      addRecipeNutrition: true,
    };

    // Add search query if provided
    if (searchTerm.trim()) {
      params.query = searchTerm.trim();
    }

    const response = await spoonacularClient.get('/recipes/complexSearch', {
      params: params
    });

    const recipes = response.data.results || [];
    
    // Format recipes for consistent structure with proper image URLs
    const formattedRecipes = recipes.map(recipe => ({
      id: recipe.id,
      name: recipe.title,
      image: recipe.image ? (
        recipe.image.startsWith('http') ? 
          recipe.image : 
          `https://spoonacular.com/recipeImages/${recipe.image}`
      ) : 'https://via.placeholder.com/300x200?text=No+Image',
      calories: recipe.nutrition?.nutrients?.find(n => n.name === 'Calories')?.amount || 0,
      prepTime: recipe.readyInMinutes || 0,
      ingredients: recipe.extendedIngredients || [],
      instructions: recipe.analyzedInstructions || [],
      nutrition: {
        calories: recipe.nutrition?.nutrients?.find(n => n.name === 'Calories')?.amount || 0,
        protein: recipe.nutrition?.nutrients?.find(n => n.name === 'Protein')?.amount || 0,
        carbs: recipe.nutrition?.nutrients?.find(n => n.name === 'Carbohydrates')?.amount || 0,
        fat: recipe.nutrition?.nutrients?.find(n => n.name === 'Fat')?.amount || 0,
      },
      mealType: mealType,
      difficulty: 'Easy',
      servings: recipe.servings || 1,
    }));

    console.log(`Found ${formattedRecipes.length} recipes for ${mealType} from Spoonacular`);
    return formattedRecipes;
  } catch (error) {
    console.error('Error searching Spoonacular recipes:', error);
    
    // Return fallback recipes
    return getFallbackRecipes(mealType);
  }
};

/**
 * Fallback meal plan for development/testing with proper image URLs
 * @returns {Object} - Fallback meal plan data
 */
const getFallbackMealPlan = () => {
  return {
    week: {
      monday: {
        meals: [
          {
            id: 643514,
            title: "Fresh Herb Omelette",
            image: "https://spoonacular.com/recipeImages/Fresh-Herb-Omelette-643514.jpg",
            readyInMinutes: 45,
            servings: 1,
            calories: 350
          },
          {
            id: 639320,
            title: "Chorizo and egg bake",
            image: "https://spoonacular.com/recipeImages/Chorizo-and-egg-bake-639320.jpg",
            readyInMinutes: 30,
            servings: 3,
            calories: 450
          },
          {
            id: 1697585,
            title: "Cabbage and Sausage Casserole",
            image: "https://spoonacular.com/recipeImages/cabbage-and-sausage-casserole-1697585.jpg",
            readyInMinutes: 165,
            servings: 2,
            calories: 500
          }
        ],
        nutrients: {
          calories: 1300,
          carbohydrates: 40,
          fat: 100,
          protein: 80
        }
      },
      tuesday: {
        meals: [
          {
            id: 643515,
            title: "Scrambled Eggs with Toast",
            image: "https://spoonacular.com/recipeImages/Fresh-Herb-Omelette-643514.jpg",
            readyInMinutes: 15,
            servings: 1,
            calories: 300
          },
          {
            id: 639321,
            title: "Grilled Chicken Salad",
            image: "https://spoonacular.com/recipeImages/Chorizo-and-egg-bake-639320.jpg",
            readyInMinutes: 25,
            servings: 1,
            calories: 400
          },
          {
            id: 1697586,
            title: "Beef Stir Fry",
            image: "https://spoonacular.com/recipeImages/cabbage-and-sausage-casserole-1697585.jpg",
            readyInMinutes: 30,
            servings: 2,
            calories: 550
          }
        ],
        nutrients: {
          calories: 1250,
          carbohydrates: 35,
          fat: 95,
          protein: 85
        }
      },
      // Add other days with similar structure...
      wednesday: {
        meals: [
          {
            id: 643516,
            title: "Avocado Toast",
            image: "https://spoonacular.com/recipeImages/Fresh-Herb-Omelette-643514.jpg",
            readyInMinutes: 10,
            servings: 1,
            calories: 280
          },
          {
            id: 639322,
            title: "Turkey Wrap",
            image: "https://spoonacular.com/recipeImages/Chorizo-and-egg-bake-639320.jpg",
            readyInMinutes: 15,
            servings: 1,
            calories: 380
          },
          {
            id: 1697587,
            title: "Salmon with Vegetables",
            image: "https://spoonacular.com/recipeImages/cabbage-and-sausage-casserole-1697585.jpg",
            readyInMinutes: 35,
            servings: 1,
            calories: 520
          }
        ],
        nutrients: {
          calories: 1180,
          carbohydrates: 30,
          fat: 85,
          protein: 90
        }
      }
    }
  };
};

/**
 * Get fallback recipes for a specific meal type with proper image URLs
 * @param {string} mealType - Type of meal
 * @returns {Array} - Fallback recipes
 */
const getFallbackRecipes = (mealType) => {
  const fallbackRecipes = {
    breakfast: [
      {
        id: 1,
        name: "Scrambled Eggs",
        image: "https://via.placeholder.com/300x200?text=Scrambled+Eggs",
        calories: 300,
        prepTime: 10,
        nutrition: { calories: 300, protein: 20, carbs: 5, fat: 25 },
        mealType: "breakfast"
      },
      {
        id: 2,
        name: "Oatmeal with Berries",
        image: "https://via.placeholder.com/300x200?text=Oatmeal",
        calories: 250,
        prepTime: 5,
        nutrition: { calories: 250, protein: 8, carbs: 45, fat: 5 },
        mealType: "breakfast"
      }
    ],
    lunch: [
      {
        id: 3,
        name: "Grilled Chicken Salad",
        image: "https://via.placeholder.com/300x200?text=Chicken+Salad",
        calories: 400,
        prepTime: 20,
        nutrition: { calories: 400, protein: 35, carbs: 15, fat: 20 },
        mealType: "lunch"
      },
      {
        id: 4,
        name: "Turkey Sandwich",
        image: "https://via.placeholder.com/300x200?text=Turkey+Sandwich",
        calories: 350,
        prepTime: 5,
        nutrition: { calories: 350, protein: 25, carbs: 30, fat: 15 },
        mealType: "lunch"
      }
    ],
    dinner: [
      {
        id: 5,
        name: "Grilled Salmon",
        image: "https://via.placeholder.com/300x200?text=Grilled+Salmon",
        calories: 500,
        prepTime: 25,
        nutrition: { calories: 500, protein: 40, carbs: 10, fat: 30 },
        mealType: "dinner"
      },
      {
        id: 6,
        name: "Beef Stir Fry",
        image: "https://via.placeholder.com/300x200?text=Beef+Stir+Fry",
        calories: 450,
        prepTime: 30,
        nutrition: { calories: 450, protein: 35, carbs: 25, fat: 25 },
        mealType: "dinner"
      }
    ]
  };

  return fallbackRecipes[mealType] || [];
};

export default spoonacularClient;