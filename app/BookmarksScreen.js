import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

// Import bookmark service functions
import { getUserBookmarks, removeBookmark } from '../bookmarkService';

const BookmarkCard = ({ bookmark, onPress, onRemove }) => {
  const handleLongPress = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Remove from Bookmarks'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 0,
          title: 'Bookmark Options',
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            onRemove(bookmark);
          }
        }
      );
    } else {
      Alert.alert(
        'Remove Bookmark',
        `Remove "${bookmark.title}" from bookmarks?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Remove', style: 'destructive', onPress: () => onRemove(bookmark) }
        ]
      );
    }
  };

  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={() => onPress(bookmark)}
      onLongPress={handleLongPress}
      delayLongPress={500}
    >
      <Image source={{ uri: bookmark.image }} style={styles.cardImage} />
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {bookmark.title}
        </Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardCalories}>
            {bookmark.calories || '0'} Cal
          </Text>
          <View style={styles.bookmarkIndicator}>
            <Ionicons name="bookmark" size={16} color="#4CAF50" />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const BookmarksScreen = () => {
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sortOption, setSortOption] = useState('dateAdded'); // dateAdded, alphabetical, calories

  // Fetch bookmarks
  const fetchBookmarks = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    setError(null);
    
    try {
      const userBookmarks = await getUserBookmarks();
      setBookmarks(userBookmarks);
    } catch (err) {
      console.error('Error fetching bookmarks:', err);
      setError('Failed to load bookmarks. Please try again later.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Use focus effect to refresh bookmarks when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchBookmarks();
    }, [])
  );

  // Sort bookmarks based on selected option
  const getSortedBookmarks = () => {
    const sortedBookmarks = [...bookmarks];
    
    switch (sortOption) {
      case 'alphabetical':
        return sortedBookmarks.sort((a, b) => a.title.localeCompare(b.title));
      case 'calories':
        return sortedBookmarks.sort((a, b) => (a.calories || 0) - (b.calories || 0));
      case 'dateAdded':
      default:
        return sortedBookmarks.sort((a, b) => 
          new Date(b.dateBookmarked || 0) - new Date(a.dateBookmarked || 0)
        );
    }
  };

  const handlePressRecipe = (bookmark) => {
    router.push({ 
      pathname: "/RecipeDetailScreen", 
      params: { recipeId: bookmark.id } 
    });
  };

  const handleRemoveBookmark = async (bookmark) => {
    try {
      const success = await removeBookmark(bookmark.id);
      if (success) {
        setBookmarks(prev => prev.filter(b => b.id !== bookmark.id));
        Alert.alert('Removed', 'Recipe removed from bookmarks');
      } else {
        Alert.alert('Error', 'Failed to remove bookmark. Please try again.');
      }
    } catch (error) {
      console.error('Error removing bookmark:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  };

  const handleRefresh = () => {
    fetchBookmarks(true);
  };

  const handleSortPress = () => {
    const sortOptions = [
      'Cancel',
      'Date Added (Newest First)',
      'Alphabetical (A-Z)',
      'Calories (Low to High)'
    ];
    
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: sortOptions,
          cancelButtonIndex: 0,
          title: 'Sort Bookmarks',
        },
        (buttonIndex) => {
          switch (buttonIndex) {
            case 1:
              setSortOption('dateAdded');
              break;
            case 2:
              setSortOption('alphabetical');
              break;
            case 3:
              setSortOption('calories');
              break;
          }
        }
      );
    } else {
      Alert.alert(
        'Sort Bookmarks',
        'Choose sorting option:',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Date Added', onPress: () => setSortOption('dateAdded') },
          { text: 'Alphabetical', onPress: () => setSortOption('alphabetical') },
          { text: 'Calories', onPress: () => setSortOption('calories') }
        ]
      );
    }
  };

  const renderBookmarkItem = ({ item, index }) => (
    <BookmarkCard
      bookmark={item}
      onPress={handlePressRecipe}
      onRemove={handleRemoveBookmark}
    />
  );

  const getSortDisplayText = () => {
    switch (sortOption) {
      case 'alphabetical':
        return 'A-Z';
      case 'calories':
        return 'Calories';
      case 'dateAdded':
      default:
        return 'Recent';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading your bookmarks...</Text>
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
        <Text style={styles.headerTitle}>Your Bookmarks</Text>
        <TouchableOpacity onPress={handleSortPress} style={styles.sortButton}>
          <Text style={styles.sortButtonText}>{getSortDisplayText()}</Text>
          <Ionicons name="chevron-down" size={16} color="#666" />
        </TouchableOpacity>
      </View>
      
      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color="#d32f2f" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchBookmarks()}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : bookmarks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="bookmark-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No Bookmarks Yet</Text>
          <Text style={styles.emptyText}>
            Start exploring recipes and bookmark your favorites to see them here!
          </Text>
          <TouchableOpacity 
            style={styles.exploreButton}
            onPress={() => router.back()}
          >
            <Text style={styles.exploreButtonText}>Explore Recipes</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.contentContainer}>
          {/* Bookmarks Count */}
          <View style={styles.countContainer}>
            <Text style={styles.countText}>
              {bookmarks.length} recipe{bookmarks.length !== 1 ? 's' : ''} saved
            </Text>
            <Text style={styles.instructionText}>
              Long press to remove bookmarks
            </Text>
          </View>
          
          {/* Bookmarks List */}
          <FlatList
            data={getSortedBookmarks()}
            renderItem={renderBookmarkItem}
            keyExtractor={(item) => item.id.toString()}
            numColumns={2}
            contentContainerStyle={styles.bookmarksList}
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
          />
        </View>
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
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
  },
  sortButtonText: {
    fontSize: 14,
    color: '#666',
    marginRight: 4,
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
    fontSize: 20,
    fontWeight: '600',
    color: '#666',
    marginTop: 15,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  exploreButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
  },
  exploreButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
  },
  countContainer: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  countText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  instructionText: {
    fontSize: 13,
    color: '#666',
  },
  bookmarksList: {
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
  bookmarkIndicator: {
    padding: 2,
  },
});

export default BookmarksScreen;

