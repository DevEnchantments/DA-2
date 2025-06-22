import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  Image,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const CategoryCard = ({ icon, title, subtitle, searchParams, iconColor = "#4CAF50" }) => {
  const handlePress = () => {
    const searchParamsString = JSON.stringify(searchParams);
    
    router.push({ 
      pathname: "/CategoryScreen", 
      params: { 
        categoryTitle: title,
        categoryType: title.toLowerCase().replace(/\s+/g, '_'),
        searchParams: searchParamsString
      } 
    });
  };

  return (
    <TouchableOpacity style={styles.categoryCard} onPress={handlePress}>
      <View style={[styles.categoryIconContainer, { backgroundColor: iconColor + '20' }]}>
        <Ionicons name={icon} size={28} color={iconColor} />
      </View>
      <Text style={styles.categoryTitle}>{title}</Text>
      <Text style={styles.categorySubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
};

const IngredientFilter = ({ ingredient, isSelected, onPress }) => {
  return (
    <TouchableOpacity 
      style={[styles.filterTab, isSelected && styles.filterTabSelected]} 
      onPress={onPress}
    >
      <View style={[styles.filterImageContainer, isSelected && styles.filterImageSelected]}>
        <Image 
          source={{ uri: `https://spoonacular.com/cdn/ingredients_100x100/${ingredient.image}` }}
          style={styles.filterImage}
          resizeMode="contain"
        />
      </View>
      <Text style={[styles.filterLabel, isSelected && styles.filterLabelSelected]}>
        {ingredient.name}
      </Text>
    </TouchableOpacity>
  );
};

const RecipesScreen = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIngredients, setSelectedIngredients] = useState([]);

  const ingredientFilters = [
    { id: 'butter', name: 'Butter', image: 'butter.jpg' },
    { id: 'garlic', name: 'Garlic', image: 'garlic.png' },
    { id: 'tomato', name: 'Tomato', image: 'tomato.png' },
    { id: 'avocado', name: 'Avocado', image: 'avocado.jpg' },
    { id: 'milk', name: 'Milk', image: 'milk.png' },
    { id: 'eggs', name: 'Eggs', image: 'egg.png' },
    { id: 'chicken', name: 'Chicken', image: 'chicken-breasts.jpg' },
    { id: 'cheese', name: 'Cheese', image: 'cheddar-cheese.jpg' },
    { id: 'carrot', name: 'Carrot', image: 'carrots.jpg' },
    { id: 'basil', name: 'Basil', image: 'fresh-basil.jpg' },
  ];

  const handleIngredientToggle = (ingredientId) => {
    setSelectedIngredients(prev => {
      if (prev.includes(ingredientId)) {
        // Remove if already selected
        return prev.filter(id => id !== ingredientId);
      } else {
        // Add if not selected
        return [...prev, ingredientId];
      }
    });
  };

  const handleSearch = () => {
    const searchParams = {
      addRecipeNutrition: true
    };

    // Add search query if provided
    if (searchQuery.trim() !== '') {
      searchParams.query = searchQuery.trim();
    }

    // Add selected ingredients if any
    if (selectedIngredients.length > 0) {
      searchParams.includeIngredients = selectedIngredients.join(',');
    }

    // If no search query and no ingredients selected, don't search
    if (searchQuery.trim() === '' && selectedIngredients.length === 0) {
      return;
    }
    
    const searchParamsString = JSON.stringify(searchParams);
    
    let categoryTitle = '';
    if (searchQuery.trim() !== '' && selectedIngredients.length > 0) {
      categoryTitle = `Search: "${searchQuery.trim()}" with ${selectedIngredients.join(', ')}`;
    } else if (searchQuery.trim() !== '') {
      categoryTitle = `Search: "${searchQuery.trim()}"`;
    } else {
      categoryTitle = `Recipes with ${selectedIngredients.join(', ')}`;
    }
    
    router.push({ 
      pathname: "/CategoryScreen", 
      params: { 
        categoryTitle: categoryTitle,
        categoryType: 'search',
        searchParams: searchParamsString
      } 
    });
  };

  const handleSearchSubmit = () => {
    handleSearch();
  };

  const clearAllFilters = () => {
    setSelectedIngredients([]);
    setSearchQuery('');
  };

  const categories = [
    {
      icon: "leaf-outline",
      title: "Low Carb Options",
      subtitle: "Under 30g carbs",
      searchParams: { 
        diet: 'diabetic',
        maxCarbs: 30,
        addRecipeNutrition: true 
      }
    },
    {
      icon: "heart-outline",
      title: "Diabetic-Friendly",
      subtitle: "Blood sugar friendly",
      searchParams: { 
        diet: 'diabetic',
        addRecipeNutrition: true 
      }
    },
    {
      icon: "flame-outline",
      title: "Keto Recipes",
      subtitle: "High fat, low carb",
      searchParams: { 
        diet: 'ketogenic',
        addRecipeNutrition: true 
      }
    },
    {
      icon: "fitness-outline",
      title: "Heart Healthy",
      subtitle: "Good for your heart",
      searchParams: { 
        diet: 'whole30',
        addRecipeNutrition: true 
      }
    },
    {
      icon: "leaf",
      title: "Vegan Options",
      subtitle: "Plant-based meals",
      searchParams: { 
        diet: 'vegan',
        addRecipeNutrition: true 
      }
    },
    {
      icon: "ban-outline",
      title: "Gluten-Free",
      subtitle: "No gluten ingredients",
      searchParams: { 
        intolerances: 'gluten',
        addRecipeNutrition: true 
      }
    },
    {
      icon: "water-outline",
      title: "Dairy-Free",
      subtitle: "No dairy products",
      searchParams: { 
        intolerances: 'dairy',
        addRecipeNutrition: true 
      }
    },
    {
      icon: "barbell-outline",
      title: "High Protein",
      subtitle: "Protein-rich meals",
      searchParams: { 
        minProtein: 20,
        addRecipeNutrition: true 
      }
    },
    {
      icon: "time-outline",
      title: "Quick & Easy",
      subtitle: "Under 30 minutes",
      searchParams: { 
        maxReadyTime: 30,
        addRecipeNutrition: true 
      }
    },
    {
      icon: "restaurant-outline",
      title: "One-Pot Meals",
      subtitle: "Minimal cleanup",
      searchParams: { 
        type: 'main course',
        equipment: 'pot',
        addRecipeNutrition: true 
      }
    },
    {
      icon: "calendar-outline",
      title: "Meal Prep Friendly",
      subtitle: "Make ahead meals",
      searchParams: { 
        type: 'main course',
        addRecipeNutrition: true 
      }
    }
  ];

  const renderCategoryItem = ({ item, index }) => (
    <CategoryCard
      icon={item.icon}
      title={item.title}
      subtitle={item.subtitle}
      searchParams={item.searchParams}
      iconColor="#4CAF50"
    />
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recipes</Text>
        <View style={styles.headerRight} />
      </View>
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <View style={[
            styles.searchBar, 
            (searchQuery.length > 0 || selectedIngredients.length > 0) && styles.searchBarWithButton
          ]}>
            <Ionicons name="search" size={20} color="#4CAF50" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search recipes, ingredients, cuisine..."
              placeholderTextColor="#81C784"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
            />
            {(searchQuery.length > 0 || selectedIngredients.length > 0) && (
              <TouchableOpacity 
                onPress={clearAllFilters}
                style={styles.clearButton}
              >
                <Ionicons name="close-circle" size={20} color="#666" />
              </TouchableOpacity>
            )}
          </View>
          {(searchQuery.length > 0 || selectedIngredients.length > 0) && (
            <TouchableOpacity 
              style={styles.searchIconButton}
              onPress={handleSearch}
            >
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Ingredient Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScrollContent}
        >
          {ingredientFilters.map((ingredient) => (
            <IngredientFilter
              key={ingredient.id}
              ingredient={ingredient}
              isSelected={selectedIngredients.includes(ingredient.id)}
              onPress={() => handleIngredientToggle(ingredient.id)}
            />
          ))}
        </ScrollView>
        {selectedIngredients.length > 0 && (
          <View style={styles.selectedFiltersInfo}>
            <Text style={styles.selectedFiltersText}>
              {selectedIngredients.length} ingredient{selectedIngredients.length > 1 ? 's' : ''} selected
            </Text>
          </View>
        )}
      </View>
      
      {/* Categories Grid */}
      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <Text style={styles.pageTitle}>Recipe Categories</Text>
          <Text style={styles.pageSubtitle}>Discover healthy recipes tailored to your dietary needs</Text>
          
          <FlatList
            data={categories}
            renderItem={renderCategoryItem}
            keyExtractor={(item, index) => index.toString()}
            numColumns={2}
            contentContainerStyle={styles.categoriesGrid}
            columnWrapperStyle={styles.row}
            scrollEnabled={false}
          />
        </View>
      </ScrollView>
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
  searchContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: '100%',
  },
  searchBarWithButton: {
    width: '87%',
    marginRight: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 4,
  },
  clearButton: {
    marginLeft: 8,
    padding: 2,
  },
  searchIconButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filtersScrollContent: {
    paddingHorizontal: 15,
    gap: 12,
  },
  filterTab: {
    alignItems: 'center',
    marginRight: 4,
  },
  filterImageContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterImageSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#ffffff',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  filterImage: {
    width: 32,
    height: 32,
  },
  filterLabel: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  filterLabelSelected: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  selectedFiltersInfo: {
    paddingHorizontal: 15,
    paddingTop: 8,
  },
  selectedFiltersText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  scrollContainer: {
    flex: 1,
  },
  container: {
    padding: 20,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  pageSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  categoriesGrid: {
    paddingBottom: 20,
  },
  row: {
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  categoryIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  categorySubtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default RecipesScreen;

  