import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

// Import the Spoonacular API client
import { searchRecipes } from '../spoonacularClient';

// Import bookmark service functions
import { addBookmark, getUserBookmarks, removeBookmark } from '../bookmarkService';

const RecipeCard = ({ recipe, onPress, isBookmarked = false, onBookmarkPress }) => {
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(recipe)}>
      <Image source={{ uri: recipe.image }} style={styles.cardImage} />
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {recipe.title}
        </Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardCalories}>
            {recipe.nutrition?.nutrients?.find(n => n.name === 'Calories')?.amount?.toFixed(0) || 
             recipe.calories || '0'} Cal
          </Text>
          <TouchableOpacity 
            style={styles.bookmarkButton}
            onPress={() => onBookmarkPress && onBookmarkPress(recipe)}
          >
            <Ionicons 
              name={isBookmarked ? "bookmark" : "bookmark-outline"} 
              size={20} 
              color={isBookmarked ? "#4CAF50" : "#666"} 
            />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const CategoryScreen = () => {
  const params = useLocalSearchParams();
  const { categoryTitle, categoryType, searchParams } = params;
  
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [bookmarkedRecipeIds, setBookmarkedRecipeIds] = useState([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMoreRecipes, setHasMoreRecipes] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);

  // Parse search parameters
  const getSearchParams = () => {
    try {
      return searchParams ? JSON.parse(searchParams) : {};
    } catch (error) {
      console.error('Error parsing search params:', error);
      return {};
    }
  };

  // Fetch recipes for the category
  const fetchRecipes = async (offset = 0, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else if (offset === 0) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }
    
    setError(null);
    
    try {
      const params = {
        ...getSearchParams(),
        number: 20, // Load 20 recipes at a time
        offset: offset,
        addRecipeNutrition: true
      };
      
      const result = await searchRecipes(params);
      const newRecipes = result.results || [];
      
      if (offset === 0 || isRefresh) {
        setRecipes(newRecipes);
        setCurrentOffset(20);
      } else {
        setRecipes(prev => [...prev, ...newRecipes]);
        setCurrentOffset(prev => prev + 20);
      }
      
      // Check if there are more recipes to load
      setHasMoreRecipes(newRecipes.length === 20);
      
    } catch (err) {
      console.error('Error fetching recipes:', err);
      setError('Failed to load recipes. Please try again later.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  // Fetch bookmarked recipe IDs
  const fetchBookmarkedIds = async () => {
    try {
      const bookmarks = await getUserBookmarks();
      setBookmarkedRecipeIds(bookmarks.map(bookmark => bookmark.id));
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
    }
  };

  useEffect(() => {
    fetchRecipes();
    fetchBookmarkedIds();
  }, []);

  const handlePressRecipe = (recipe) => {
    router.push({ 
      pathname: "/RecipeDetailScreen", 
      params: { recipeId: recipe.id } 
    });
  };

  const handleBookmarkPress = async (recipe) => {
    try {
      const recipeIsBookmarked = bookmarkedRecipeIds.includes(recipe.id);
      
      if (recipeIsBookmarked) {
        // Remove bookmark
        const success = await removeBookmark(recipe.id);
        if (success) {
          setBookmarkedRecipeIds(prev => prev.filter(id => id !== recipe.id));
          Alert.alert('Removed', 'Recipe removed from bookmarks');
        } else {
          Alert.alert('Error', 'Failed to remove bookmark. Please try again.');
        }
      } else {
        // Add bookmark
        const success = await addBookmark(recipe);
        if (success) {
          setBookmarkedRecipeIds(prev => [...prev, recipe.id]);
          Alert.alert('Saved', 'Recipe added to bookmarks');
        } else {
          Alert.alert('Error', 'Failed to add bookmark. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  const handleRefresh = () => {
    fetchRecipes(0, true);
    fetchBookmarkedIds();
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMoreRecipes) {
      fetchRecipes(currentOffset);
    }
  };

  const renderRecipeItem = ({ item, index }) => (
    <RecipeCard
      recipe={item}
      onPress={handlePressRecipe}
      isBookmarked={bookmarkedRecipeIds.includes(item.id)}
      onBookmarkPress={handleBookmarkPress}
    />
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#4CAF50" />
        <Text style={styles.footerLoaderText}>Loading more recipes...</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading {categoryTitle || 'recipes'}...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {categoryTitle || 'Recipes'}
        </Text>
        <View style={styles.headerRight} />
      </View>
      
      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#d32f2f" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchRecipes()}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : recipes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="restaurant-outline" size={48} color="#ccc" />
          <Text style={styles.emptyTitle}>No Recipes Found</Text>
          <Text style={styles.emptyText}>
            We couldn't find any recipes for this category. Try refreshing or check back later.
          </Text>
        </View>
      ) : (
        <FlatList
          data={recipes}
          renderItem={renderRecipeItem}
          keyExtractor={(item) => item.id.toString()}
          numColumns={2}
          contentContainerStyle={styles.recipesList}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#4CAF50']}
              tintColor="#4CAF50"
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.1}
          ListFooterComponent={renderFooter}
        />
      )}
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
    width: 24, // Same width as back button for centering
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 10,
    marginBottom: 20,
    color: '#d32f2f',
    fontSize: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#4CAF50',
    borderRadius: 5,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 10,
    marginBottom: 5,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  recipesList: {
    padding: 15,
  },
  row: {
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 15,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardImage: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    height: 36,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardCalories: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  bookmarkButton: {
    padding: 4,
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  footerLoaderText: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
  },
});

export default CategoryScreen;

