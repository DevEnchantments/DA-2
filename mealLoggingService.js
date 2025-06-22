import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where
} from 'firebase/firestore';
import { auth, db } from './configs/firebaseConfig';

/**
 * Save a meal log to Firebase Firestore
 * @param {Object} mealLogData - The meal log data
 * @returns {Promise<string>} - Meal log document ID
 */
export const saveMealLog = async (mealLogData) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    console.log('Saving meal log to Firebase...');

    const mealLog = {
      userId: user.uid,
      mealType: mealLogData.mealType,
      mealData: {
        id: mealLogData.mealData.id,
        title: mealLogData.mealData.title || mealLogData.mealData.name,
        image: mealLogData.mealData.image,
        calories: mealLogData.mealData.calories || mealLogData.mealData.nutrition?.calories || 0,
        prepTime: mealLogData.mealData.readyInMinutes || mealLogData.mealData.prepTime,
        servings: mealLogData.mealData.servings || 1,
      },
      photoUri: mealLogData.photoUri,
      timestamp: Timestamp.now(),
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
      dateString: new Date().toDateString(),
      createdAt: Timestamp.now(),
      // Additional metadata
      deviceTimestamp: mealLogData.timestamp,
      loggedFrom: 'mobile_app',
      status: 'logged'
    };

    console.log('Meal log data to save:', mealLog);

    // Add to the 'mealLogs' collection
    const docRef = await addDoc(collection(db, 'mealLogs'), mealLog);
    
    console.log('Meal log saved with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving meal log:', error);
    throw error;
  }
};

/**
 * Get meal logs for a specific user (supports doctor viewing patient logs)
 * @param {number} limitCount - Number of logs to retrieve (default: 50)
 * @param {string} targetUserId - Optional target user ID (for doctors viewing patient logs)
 * @param {string} dateFilter - Optional date filter (YYYY-MM-DD)
 * @returns {Promise<Array>} - Array of meal logs
 */
export const getUserMealLogs = async (limitCount = 50, targetUserId = null, dateFilter = null) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    // Determine which user's logs to fetch
    const userId = targetUserId || user.uid;
    
    console.log('Getting meal logs for user:', userId);
    console.log('Requested by:', user.uid);
    console.log('Is doctor viewing patient logs:', !!targetUserId);

    let mealLogsQuery = query(
      collection(db, 'mealLogs'),
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );

    // Add date filter if provided
    if (dateFilter) {
      mealLogsQuery = query(
        collection(db, 'mealLogs'),
        where('userId', '==', userId),
        where('date', '==', dateFilter),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
    }

    const querySnapshot = await getDocs(mealLogsQuery);
    const mealLogs = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      mealLogs.push({
        id: doc.id,
        ...data,
        // Convert Firestore Timestamp to JavaScript Date
        timestamp: data.timestamp?.toDate(),
        createdAt: data.createdAt?.toDate(),
      });
    });

    console.log(`Retrieved ${mealLogs.length} meal logs for user ${userId}`);
    return mealLogs;
  } catch (error) {
    console.error('Error getting meal logs:', error);
    return [];
  }
};

/**
 * Get meal logs for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} targetUserId - Optional target user ID (for doctors viewing patient logs)
 * @returns {Promise<Array>} - Array of meal logs for that date
 */
export const getMealLogsForDate = async (date, targetUserId = null) => {
  try {
    return await getUserMealLogs(20, targetUserId, date);
  } catch (error) {
    console.error('Error getting meal logs for date:', error);
    return [];
  }
};

/**
 * Get today's meal logs
 * @param {string} targetUserId - Optional target user ID (for doctors viewing patient logs)
 * @returns {Promise<Array>} - Array of today's meal logs
 */
export const getTodaysMealLogs = async (targetUserId = null) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    return await getMealLogsForDate(today, targetUserId);
  } catch (error) {
    console.error('Error getting today\'s meal logs:', error);
    return [];
  }
};

/**
 * Get meal log statistics for a specific user (supports doctor viewing patient stats)
 * @param {number} days - Number of days to analyze (default: 7)
 * @param {string} targetUserId - Optional target user ID (for doctors viewing patient stats)
 * @returns {Promise<Object>} - Statistics object
 */
export const getMealLogStatistics = async (days = 7, targetUserId = null) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    // Determine which user's stats to calculate
    const userId = targetUserId || user.uid;
    
    console.log('Calculating meal log statistics for user:', userId);
    console.log('Requested by:', user.uid);
    console.log('Days to analyze:', days);

    // Get recent meal logs for the target user
    const recentLogs = await getUserMealLogs(days * 5, targetUserId); // Get more than needed, then filter

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    // Filter logs within the date range
    const logsInRange = recentLogs.filter(log => {
      const logDate = new Date(log.date);
      return logDate >= startDate && logDate <= endDate;
    });

    // Calculate statistics
    const totalLogs = logsInRange.length;
    const averagePerDay = totalLogs / days;
    
    // Count by meal type
    const mealTypeCounts = {
      breakfast: 0,
      lunch: 0,
      dinner: 0
    };

    let totalCalories = 0;

    logsInRange.forEach(log => {
      if (mealTypeCounts.hasOwnProperty(log.mealType)) {
        mealTypeCounts[log.mealType]++;
      }
      totalCalories += log.mealData?.calories || 0;
    });

    const statistics = {
      totalLogs,
      averagePerDay: Math.round(averagePerDay * 10) / 10,
      totalCalories,
      averageCaloriesPerDay: Math.round((totalCalories / days) * 10) / 10,
      mealTypeCounts,
      daysAnalyzed: days,
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      },
      // Additional metadata for doctor viewing
      targetUserId: userId,
      isPatientView: !!targetUserId
    };

    console.log('Meal log statistics for user', userId, ':', statistics);
    return statistics;
  } catch (error) {
    console.error('Error calculating meal log statistics:', error);
    return {
      totalLogs: 0,
      averagePerDay: 0,
      totalCalories: 0,
      averageCaloriesPerDay: 0,
      mealTypeCounts: { breakfast: 0, lunch: 0, dinner: 0 },
      daysAnalyzed: days,
      dateRange: { start: '', end: '' },
      targetUserId: targetUserId || user?.uid,
      isPatientView: !!targetUserId
    };
  }
};

/**
 * Delete a meal log
 * @param {string} mealLogId - ID of the meal log to delete
 * @returns {Promise<void>}
 */
export const deleteMealLog = async (mealLogId) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    // TODO: Add permission check to ensure user owns this log or is authorized doctor
    // For now, we'll allow deletion but this should be enhanced with proper permission checks
    
    console.log('Deleting meal log:', mealLogId, 'by user:', user.uid);
    
    await deleteDoc(doc(db, 'mealLogs', mealLogId));
    console.log('Meal log deleted:', mealLogId);
  } catch (error) {
    console.error('Error deleting meal log:', error);
    throw error;
  }
};

/**
 * Get meal logs with advanced filtering options (for doctors)
 * @param {Object} options - Filter options
 * @param {string} options.targetUserId - Target user ID
 * @param {string} options.mealType - Filter by meal type (breakfast, lunch, dinner)
 * @param {string} options.startDate - Start date (YYYY-MM-DD)
 * @param {string} options.endDate - End date (YYYY-MM-DD)
 * @param {number} options.limit - Number of results to return
 * @returns {Promise<Array>} - Array of filtered meal logs
 */
export const getFilteredMealLogs = async (options = {}) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const {
      targetUserId,
      mealType,
      startDate,
      endDate,
      limit: limitCount = 50
    } = options;

    const userId = targetUserId || user.uid;
    
    console.log('Getting filtered meal logs for user:', userId);
    console.log('Filter options:', options);

    // Build query constraints
    const constraints = [
      where('userId', '==', userId),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    ];

    // Add meal type filter if specified
    if (mealType) {
      constraints.splice(1, 0, where('mealType', '==', mealType));
    }

    // Note: Firestore doesn't support range queries with other filters easily
    // So we'll fetch the data and filter by date range in memory for now
    const mealLogsQuery = query(collection(db, 'mealLogs'), ...constraints);
    const querySnapshot = await getDocs(mealLogsQuery);
    
    let mealLogs = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      mealLogs.push({
        id: doc.id,
        ...data,
        timestamp: data.timestamp?.toDate(),
        createdAt: data.createdAt?.toDate(),
      });
    });

    // Apply date range filter if specified
    if (startDate || endDate) {
      mealLogs = mealLogs.filter(log => {
        const logDate = log.date; // YYYY-MM-DD format
        if (startDate && logDate < startDate) return false;
        if (endDate && logDate > endDate) return false;
        return true;
      });
    }

    console.log(`Retrieved ${mealLogs.length} filtered meal logs`);
    return mealLogs;
  } catch (error) {
    console.error('Error getting filtered meal logs:', error);
    return [];
  }
};

/**
 * Get meal log summary for a patient (for doctor dashboard)
 * @param {string} patientId - Patient user ID
 * @param {number} days - Number of days to analyze (default: 30)
 * @returns {Promise<Object>} - Patient meal log summary
 */
export const getPatientMealSummary = async (patientId, days = 30) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    console.log('Getting meal summary for patient:', patientId);

    // Get recent logs and statistics
    const [recentLogs, statistics] = await Promise.all([
      getUserMealLogs(10, patientId), // Last 10 logs
      getMealLogStatistics(days, patientId) // Statistics for specified days
    ]);

    // Get today's logs count
    const todaysLogs = await getTodaysMealLogs(patientId);

    const summary = {
      patientId,
      recentLogsCount: recentLogs.length,
      todaysLogsCount: todaysLogs.length,
      statistics,
      lastLoggedDate: recentLogs.length > 0 ? recentLogs[0].date : null,
      hasRecentActivity: recentLogs.length > 0,
      averageDailyLogs: statistics.averagePerDay,
      totalCaloriesLastWeek: statistics.totalCalories,
      generatedAt: new Date().toISOString()
    };

    console.log('Patient meal summary:', summary);
    return summary;
  } catch (error) {
    console.error('Error getting patient meal summary:', error);
    return {
      patientId,
      recentLogsCount: 0,
      todaysLogsCount: 0,
      statistics: {},
      lastLoggedDate: null,
      hasRecentActivity: false,
      averageDailyLogs: 0,
      totalCaloriesLastWeek: 0,
      generatedAt: new Date().toISOString(),
      error: error.message
    };
  }
};