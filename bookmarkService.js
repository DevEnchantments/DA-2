// bookmarkService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from 'firebase/auth';
import { collection, deleteDoc, doc, getDoc, getDocs, getFirestore, setDoc } from 'firebase/firestore';

// Local storage key for offline access
const BOOKMARKS_KEY = 'digitalDietitian_bookmarkedRecipes';

/**
 * Get the current authenticated user's ID
 * @returns {string|null} User ID or null if not authenticated
 */
const getCurrentUserId = () => {
  const auth = getAuth();
  return auth.currentUser?.uid;
};

/**
 * Add a recipe to user's bookmarks
 * @param {Object} recipe - Recipe object to bookmark
 * @returns {Promise<boolean>} Success status
 */
export const addBookmark = async (recipe) => {
  try {
    const userId = getCurrentUserId();
    
    if (!userId) {
      console.log('No user logged in, saving to local storage only');
      return addLocalBookmark(recipe);
    }
    
    const db = getFirestore();
    const bookmarkRef = doc(db, 'bookmarks', userId, 'recipes', recipe.id.toString());
    
    // Create bookmark data with minimal information needed
    const bookmarkData = {
      id: recipe.id,
      title: recipe.title,
      image: recipe.image,
      calories: recipe.nutrition?.nutrients.find(n => n.name === 'Calories')?.amount || 0,
      dateBookmarked: new Date().toISOString()
    };
    
    // Save to Firestore
    await setDoc(bookmarkRef, bookmarkData);
    
    // Also save to local storage for offline access
    await addLocalBookmark(recipe);
    
    console.log(`Recipe ${recipe.id} bookmarked successfully`);
    return true;
  } catch (error) {
    console.error('Error adding bookmark:', error);
    return false;
  }
};

/**
 * Remove a recipe from user's bookmarks
 * @param {string|number} recipeId - ID of recipe to remove
 * @returns {Promise<boolean>} Success status
 */
export const removeBookmark = async (recipeId) => {
  try {
    const userId = getCurrentUserId();
    
    if (!userId) {
      console.log('No user logged in, removing from local storage only');
      return removeLocalBookmark(recipeId);
    }
    
    const db = getFirestore();
    const bookmarkRef = doc(db, 'bookmarks', userId, 'recipes', recipeId.toString());
    
    // Delete from Firestore
    await deleteDoc(bookmarkRef);
    
    // Also remove from local storage
    await removeLocalBookmark(recipeId);
    
    console.log(`Recipe ${recipeId} removed from bookmarks`);
    return true;
  } catch (error) {
    console.error('Error removing bookmark:', error);
    return false;
  }
};

/**
 * Check if a recipe is bookmarked
 * @param {string|number} recipeId - ID of recipe to check
 * @returns {Promise<boolean>} Whether recipe is bookmarked
 */
export const isBookmarked = async (recipeId) => {
  try {
    const userId = getCurrentUserId();
    
    if (!userId) {
      // If not logged in, check local storage only
      return isLocallyBookmarked(recipeId);
    }
    
    const db = getFirestore();
    const bookmarkRef = doc(db, 'bookmarks', userId, 'recipes', recipeId.toString());
    const bookmarkDoc = await getDoc(bookmarkRef);
    
    return bookmarkDoc.exists();
  } catch (error) {
    console.error('Error checking bookmark status:', error);
    return false;
  }
};

/**
 * Get all bookmarked recipes for current user
 * @returns {Promise<Array>} Array of bookmarked recipes
 */
export const getUserBookmarks = async () => {
  try {
    const userId = getCurrentUserId();
    
    if (!userId) {
      console.log('No user logged in, retrieving from local storage only');
      return getLocalBookmarks();
    }
    
    const db = getFirestore();
    const bookmarksRef = collection(db, 'bookmarks', userId, 'recipes');
    const bookmarksSnapshot = await getDocs(bookmarksRef);
    
    const bookmarks = [];
    bookmarksSnapshot.forEach((doc) => {
      bookmarks.push(doc.data());
    });
    
    // Also update local storage with the latest data
    await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
    
    return bookmarks;
  } catch (error) {
    console.error('Error getting bookmarks:', error);
    // Fall back to local storage if Firestore fails
    return getLocalBookmarks();
  }
};

/**
 * Sync local bookmarks with Firestore when user logs in
 * @returns {Promise<boolean>} Success status
 */
export const syncBookmarksOnLogin = async () => {
  try {
    const userId = getCurrentUserId();
    
    if (!userId) {
      console.log('No user logged in, cannot sync');
      return false;
    }
    
    // Get local bookmarks
    const localBookmarks = await getLocalBookmarks();
    
    if (localBookmarks.length === 0) {
      console.log('No local bookmarks to sync');
      return true;
    }
    
    // Upload local bookmarks to Firestore
    const db = getFirestore();
    
    for (const bookmark of localBookmarks) {
      const bookmarkRef = doc(db, 'bookmarks', userId, 'recipes', bookmark.id.toString());
      const bookmarkDoc = await getDoc(bookmarkRef);
      
      // Only add if it doesn't exist in Firestore
      if (!bookmarkDoc.exists()) {
        await setDoc(bookmarkRef, {
          ...bookmark,
          dateBookmarked: bookmark.dateBookmarked || new Date().toISOString()
        });
      }
    }
    
    console.log('Bookmarks synced successfully');
    return true;
  } catch (error) {
    console.error('Error syncing bookmarks:', error);
    return false;
  }
};

// Local storage helper functions

/**
 * Add a recipe to local storage bookmarks
 * @param {Object} recipe - Recipe to bookmark
 * @returns {Promise<boolean>} Success status
 */
const addLocalBookmark = async (recipe) => {
  try {
    const bookmarks = await getLocalBookmarks();
    
    // Check if already bookmarked
    if (bookmarks.some(b => b.id === recipe.id)) {
      return true;
    }
    
    // Create bookmark data with minimal information needed
    const bookmarkData = {
      id: recipe.id,
      title: recipe.title,
      image: recipe.image,
      calories: recipe.nutrition?.nutrients.find(n => n.name === 'Calories')?.amount || 0,
      dateBookmarked: new Date().toISOString()
    };
    
    // Add to array and save
    bookmarks.push(bookmarkData);
    await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(bookmarks));
    
    return true;
  } catch (error) {
    console.error('Error adding local bookmark:', error);
    return false;
  }
};

/**
 * Remove a recipe from local storage bookmarks
 * @param {string|number} recipeId - ID of recipe to remove
 * @returns {Promise<boolean>} Success status
 */
const removeLocalBookmark = async (recipeId) => {
  try {
    const bookmarks = await getLocalBookmarks();
    const updatedBookmarks = bookmarks.filter(b => b.id !== recipeId);
    
    await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(updatedBookmarks));
    return true;
  } catch (error) {
    console.error('Error removing local bookmark:', error);
    return false;
  }
};

/**
 * Check if a recipe is bookmarked in local storage
 * @param {string|number} recipeId - ID of recipe to check
 * @returns {Promise<boolean>} Whether recipe is bookmarked
 */
const isLocallyBookmarked = async (recipeId) => {
  try {
    const bookmarks = await getLocalBookmarks();
    return bookmarks.some(b => b.id === recipeId);
  } catch (error) {
    console.error('Error checking local bookmark status:', error);
    return false;
  }
};

/**
 * Get all bookmarks from local storage
 * @returns {Promise<Array>} Array of bookmarked recipes
 */
const getLocalBookmarks = async () => {
  try {
    const bookmarksJson = await AsyncStorage.getItem(BOOKMARKS_KEY);
    return bookmarksJson ? JSON.parse(bookmarksJson) : [];
  } catch (error) {
    console.error('Error getting local bookmarks:', error);
    return [];
  }
};

export default {
  addBookmark,
  removeBookmark,
  isBookmarked,
  getUserBookmarks,
  syncBookmarksOnLogin
};
