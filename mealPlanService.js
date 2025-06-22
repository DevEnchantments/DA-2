import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { auth, db } from './configs/firebaseConfig';
// NEW: Import Spoonacular client for recipe searching
import { searchRecipesByMealType as spoonacularSearchRecipes } from './spoonacularClient';

/**
 * Get the start of the current week (Sunday)
 * @param {Date} date - Reference date
 * @returns {string} - Week start date in YYYY-MM-DD format
 */
const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  const weekStart = new Date(d.setDate(diff));
  return weekStart.toISOString().split('T')[0];
};

/**
 * ENHANCED: Save meal plan with medical specialist control (Firebase v9)
 * @param {Object} mealPlan - The meal plan data
 * @param {string} doctorId - Optional: Doctor creating the plan
 * @param {string} patientId - Optional: Patient the plan is for
 * @returns {Promise<string>} - Meal plan document ID
 */
export const saveMealPlan = async (mealPlan, doctorId = null, patientId = null) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    // Get current user data to check role
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    const userData = userDoc.data();
    const userType = userData?.userType || 'patient';
    
    console.log('Saving meal plan - User type:', userType);
    
    const mealPlanData = {
      mealPlan,
      createdAt: new Date(),
      updatedAt: new Date(),
      
      // NEW: Medical specialist control fields
      doctorId: doctorId || (userType === 'doctor' ? user.uid : null),
      patientId: patientId || (userType === 'patient' ? user.uid : null),
      status: 'active',
      
      // Medical information
      medicalNotes: '',
      approvedAt: userType === 'doctor' ? new Date() : null,
      approvedBy: userType === 'doctor' ? user.uid : null,
      
      // Enhanced metadata
      createdBy: userType,
      planType: 'ai', // Default to AI-generated
      weekStart: getWeekStart(new Date()),
    };
    
    // Generate meal plan ID based on user type and target
    const currentDate = new Date().toISOString().split('T')[0];
    let mealPlanId;
    
    if (userType === 'doctor' && patientId) {
      // Doctor creating plan for patient
      mealPlanId = `${patientId}_${currentDate}`;
    } else {
      // User creating plan for themselves
      mealPlanId = `${user.uid}_${currentDate}`;
    }
    
    console.log('Generated meal plan ID:', mealPlanId);
    
    const mealPlanRef = doc(db, 'mealPlans', mealPlanId);
    await setDoc(mealPlanRef, mealPlanData);
    
    console.log('Meal plan saved successfully');
    return mealPlanId;
  } catch (error) {
    console.error('Error saving meal plan:', error);
    throw error;
  }
};

/**
 * ADDED: Get meal plan by ID (Firebase v9)
 * @param {string} mealPlanId - The meal plan document ID
 * @returns {Promise<Object|null>} - Meal plan data or null
 */
export const getMealPlan = async (mealPlanId) => {
  try {
    console.log('Getting meal plan by ID:', mealPlanId);
    
    const mealPlanRef = doc(db, 'mealPlans', mealPlanId);
    const mealPlanDoc = await getDoc(mealPlanRef);
    
    if (mealPlanDoc.exists()) {
      const data = mealPlanDoc.data();
      console.log('Meal plan found:', mealPlanId);
      return {
        id: mealPlanDoc.id,
        ...data
      };
    }
    
    console.log('Meal plan not found:', mealPlanId);
    return null;
  } catch (error) {
    console.error('Error getting meal plan:', error);
    return null;
  }
};

/**
 * Update an existing meal plan (Firebase v9)
 * @param {string} mealPlanId - The meal plan document ID
 * @param {Object} updates - The updates to apply
 * @returns {Promise<void>}
 */
export const updateMealPlan = async (mealPlanId, updates) => {
  try {
    const mealPlanRef = doc(db, 'mealPlans', mealPlanId);
    await updateDoc(mealPlanRef, {
      ...updates,
      updatedAt: new Date()
    });
    console.log('Meal plan updated successfully');
  } catch (error) {
    console.error('Error updating meal plan:', error);
    throw error;
  }
};

/**
 * ENHANCED: Get current week's meal plan with medical specialist support
 * @param {string} targetUserId - Optional: Target user ID (for doctors accessing patient plans)
 * @returns {Promise<Object|null>} - Meal plan data or null
 */
export const getCurrentWeekMealPlan = async (targetUserId = null) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    // Determine which user's meal plan to fetch
    let userId = targetUserId || user.uid;
    
    // If targetUserId is provided, verify access permissions
    if (targetUserId && targetUserId !== user.uid) {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      const userData = userDoc.data();
      
      if (userData?.userType !== 'doctor') {
        throw new Error('Only doctors can access other users\' meal plans');
      }
      
      console.log('Doctor accessing patient meal plan:', targetUserId);
    }
    
    console.log('Getting meal plan for user:', userId);
    
    // ENHANCED: Try to get most recent meal plan first (manual or AI)
    const recentPlan = await getMostRecentMealPlan(userId);
    if (recentPlan) {
      console.log('Found recent meal plan:', recentPlan.id);
      return recentPlan;
    }
    
    // Fallback to weekly AI meal plan
    const currentDate = new Date().toISOString().split('T')[0];
    const mealPlanId = `${userId}_${currentDate}`;
    
    console.log('Looking for weekly meal plan with ID:', mealPlanId);
    
    const mealPlanRef = doc(db, 'mealPlans', mealPlanId);
    const mealPlanDoc = await getDoc(mealPlanRef);
    
    if (mealPlanDoc.exists()) {
      const data = mealPlanDoc.data();
      console.log('Found weekly meal plan');
      return {
        id: mealPlanDoc.id,
        ...data
      };
    }
    
    console.log('No meal plan found for current week');
    return null;
  } catch (error) {
    console.error('Error getting current week meal plan:', error);
    return null;
  }
};

/**
 * ENHANCED: Get most recent meal plan (manual or AI)
 * @param {string} userId - User ID to get meal plan for
 * @returns {Promise<Object|null>} - Most recent meal plan or null
 */
export const getMostRecentMealPlan = async (userId) => {
  try {
    console.log('Getting most recent meal plan for user:', userId);
    
    if (!userId) {
      console.log('No userId provided to getMostRecentMealPlan');
      return null;
    }
    
    // Query for most recent meal plan
    const mealPlansQuery = query(
      collection(db, 'mealPlans'),
      where('patientId', '==', userId),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    
    const mealPlansSnap = await getDocs(mealPlansQuery);
    
    if (!mealPlansSnap.empty) {
      const doc = mealPlansSnap.docs[0];
      const data = doc.data();
      console.log('Found most recent meal plan:', doc.id, 'Type:', data.type || data.planType || 'ai');
      return {
        id: doc.id,
        ...data
      };
    }
    
    console.log('No recent meal plans found');
    return null;
  } catch (error) {
    console.error('Error getting most recent meal plan:', error);
    return null;
  }
};

/**
 * FIXED: Get doctor's assigned patients
 * @returns {Promise<Array>} - Array of assigned patients
 */
export const getAssignedPatients = async (doctorId = null) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    const targetDoctorId = doctorId || user.uid;
    
    // Get current user data to verify doctor role
    const userDocRef = doc(db, 'users', targetDoctorId);
    const userDoc = await getDoc(userDocRef);
    const userData = userDoc.data();
    
    if (userData?.userType !== 'doctor') {
      return [];
    }
    
    console.log('Getting assigned patients for doctor:', targetDoctorId);
    
    // FIXED: Query doctorPatientAssignments collection (not doctorPatients)
    const assignmentsQuery = query(
      collection(db, 'doctorPatientAssignments'),
      where('doctorId', '==', targetDoctorId)
    );
    const assignmentsSnap = await getDocs(assignmentsQuery);
    
    if (assignmentsSnap.empty) {
      console.log('No patients assigned to this doctor');
      return [];
    }
    
    // Get patient details
    const patientIds = assignmentsSnap.docs.map(doc => doc.data().patientId);
    const patients = [];
    
    for (const patientId of patientIds) {
      try {
        const patientDocRef = doc(db, 'users', patientId);
        const patientDoc = await getDoc(patientDocRef);
        
        if (patientDoc.exists()) {
          const patientData = patientDoc.data();
          
          // Check if patient has a current meal plan
          const mealPlan = await getMostRecentMealPlan(patientId);
          
          patients.push({
            id: patientDoc.id,
            firstName: patientData.firstName || '',
            lastName: patientData.lastName || '',
            email: patientData.email || '',
            photoUrl: patientData.photoUrl || null,
            assignedDoctorId: patientData.assignedDoctorId || null,
            currentMealPlanId: mealPlan?.id || null,
            userType: patientData.userType,
            createdAt: patientData.createdAt,
          });
        }
      } catch (error) {
        console.error(`Error loading patient ${patientId}:`, error);
      }
    }
    
    console.log(`Loaded ${patients.length} assigned patients`);
    return patients;
  } catch (error) {
    console.error('Error loading assigned patients:', error);
    return [];
  }
};

/**
 * NEW: Assign a patient to the doctor
 * @param {string} patientId - Patient's user ID
 * @returns {Promise<void>}
 */
export const assignPatient = async (patientId) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    console.log('Assigning patient:', patientId, 'to doctor:', currentUser.uid);

    // Check if assignment already exists
    const assignmentsRef = collection(db, 'doctorPatientAssignments');
    const existingQuery = query(
      assignmentsRef,
      where('doctorId', '==', currentUser.uid),
      where('patientId', '==', patientId)
    );
    const existingSnapshot = await getDocs(existingQuery);

    if (!existingSnapshot.empty) {
      console.log('Patient already assigned to this doctor');
      return;
    }

    // Create new assignment
    await addDoc(assignmentsRef, {
      doctorId: currentUser.uid,
      patientId: patientId,
      assignedAt: Timestamp.now(),
      isActive: true,
    });

    console.log('Patient assigned successfully');
  } catch (error) {
    console.error('Error assigning patient:', error);
    throw error;
  }
};

/**
 * NEW: Remove patient assignment
 * @param {string} patientId - Patient's user ID
 * @returns {Promise<void>}
 */
export const removePatientAssignment = async (patientId) => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    console.log('Removing patient assignment:', patientId, 'from doctor:', currentUser.uid);

    // Find and delete the assignment
    const assignmentsRef = collection(db, 'doctorPatientAssignments');
    const q = query(
      assignmentsRef,
      where('doctorId', '==', currentUser.uid),
      where('patientId', '==', patientId)
    );
    const querySnapshot = await getDocs(q);

    const batch = writeBatch(db);
    querySnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log('Patient assignment removed successfully');
  } catch (error) {
    console.error('Error removing patient assignment:', error);
    throw error;
  }
};

/**
 * NEW: SEARCH PATIENTS FUNCTION - This was missing!
 * @param {string} searchTerm - Search term for patient name or email
 * @returns {Promise<Array>} - Array of matching patients
 */
export const searchPatients = async (searchTerm) => {
  try {
    console.log('Searching for patients with term:', searchTerm);
    
    if (!searchTerm || searchTerm.trim().length < 2) {
      return [];
    }
    
    // Query users collection for patients
    const usersRef = collection(db, 'users');
    
    // Get all patients first (we'll filter in JavaScript due to Firestore limitations)
    const q = query(
      usersRef,
      where('userType', '==', 'patient'),
      limit(50) // Reasonable limit to avoid too many results
    );
    
    const querySnapshot = await getDocs(q);
    const patients = [];
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      
      // Create searchable text
      const firstName = (data.firstName || '').toLowerCase();
      const lastName = (data.lastName || '').toLowerCase();
      const email = (data.email || '').toLowerCase();
      const fullName = `${firstName} ${lastName}`.trim();
      const search = searchTerm.toLowerCase().trim();
      
      // Check if search term matches any field
      if (firstName.includes(search) || 
          lastName.includes(search) || 
          fullName.includes(search) || 
          email.includes(search)) {
        
        patients.push({
          id: doc.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          email: data.email || '',
          photoUrl: data.photoUrl || null,
          userType: data.userType,
          createdAt: data.createdAt,
          // Add any other patient fields you need
        });
      }
    });
    
    // Sort results by relevance (exact matches first, then partial matches)
    patients.sort((a, b) => {
      const aFullName = `${a.firstName} ${a.lastName}`.toLowerCase();
      const bFullName = `${b.firstName} ${b.lastName}`.toLowerCase();
      const searchLower = searchTerm.toLowerCase();
      
      // Exact name matches first
      if (aFullName === searchLower && bFullName !== searchLower) return -1;
      if (bFullName === searchLower && aFullName !== searchLower) return 1;
      
      // Email matches next
      if (a.email.toLowerCase() === searchLower && b.email.toLowerCase() !== searchLower) return -1;
      if (b.email.toLowerCase() === searchLower && a.email.toLowerCase() !== searchLower) return 1;
      
      // Then by name starting with search term
      if (aFullName.startsWith(searchLower) && !bFullName.startsWith(searchLower)) return -1;
      if (bFullName.startsWith(searchLower) && !aFullName.startsWith(searchLower)) return 1;
      
      // Finally alphabetical
      return aFullName.localeCompare(bFullName);
    });
    
    console.log(`Found ${patients.length} patients matching "${searchTerm}"`);
    return patients;
    
  } catch (error) {
    console.error('Error searching patients:', error);
    throw error;
  }
};

/**
 * Get patient statistics for doctor dashboard
 * @returns {Promise<Object>} - Statistics object
 */
export const getDoctorStatistics = async () => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    const patients = await getAssignedPatients();
    
    // Count active meal plans (both AI and manual)
    let activeMealPlans = 0;
    
    for (const patient of patients) {
      const mealPlan = await getCurrentWeekMealPlan(patient.id);
      if (mealPlan) {
        activeMealPlans++;
      }
    }
    
    return {
      totalPatients: patients.length,
      activeMealPlans,
      patientsWithoutPlans: patients.length - activeMealPlans
    };
  } catch (error) {
    console.error('Error loading doctor statistics:', error);
    return {
      totalPatients: 0,
      activeMealPlans: 0,
      patientsWithoutPlans: 0
    };
  }
};

/**
 * ADDED: Calculate nutritional summary from meals array
 * @param {Array} meals - Array of meal objects
 * @returns {Promise<Object>} - Nutrition summary
 */
export const calculateNutritionalSummary = async (meals) => {
  try {
    console.log('Calculating nutrition for', meals.length, 'meals');
    
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
    
    meals.forEach(meal => {
      if (meal) {
        // Handle different nutrition data structures
        const nutrition = meal.nutrition || meal;
        
        totalCalories += nutrition.calories || meal.calories || 0;
        totalProtein += nutrition.protein || meal.protein || 0;
        totalCarbs += nutrition.carbs || nutrition.carbohydrates || meal.carbs || 0;
        totalFat += nutrition.fat || meal.fat || 0;
        
        console.log(`Meal: ${meal.title || meal.name}, Calories: ${nutrition.calories || meal.calories || 0}`);
      }
    });
    
    const summary = {
      calories: Math.round(totalCalories),
      protein: Math.round(totalProtein),
      carbs: Math.round(totalCarbs),
      fat: Math.round(totalFat)
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
 * Get assigned doctor for current patient
 * @returns {Promise<Object|null>} - Doctor information or null
 */
export const getPatientDoctor = async () => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    // Get current user data
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    const userData = userDoc.data();
    
    if (userData?.userType !== 'patient' || !userData?.assignedDoctorId) {
      return null;
    }
    
    // Get doctor information
    const doctorDocRef = doc(db, 'users', userData.assignedDoctorId);
    const doctorDoc = await getDoc(doctorDocRef);
    
    if (doctorDoc.exists()) {
      const doctorData = doctorDoc.data();
      return {
        id: doctorDoc.id,
        firstName: doctorData.firstName || '',
        lastName: doctorData.lastName || '',
        email: doctorData.email || '',
        specialization: doctorData.specialization || 'General Practice'
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error loading patient doctor:', error);
    return null;
  }
};

/**
 * UPDATED: Search recipes by meal type using Spoonacular API
 * @param {string} mealType - 'breakfast', 'lunch', or 'dinner'
 * @param {string} searchTerm - Optional search term
 * @returns {Promise<Array>} - Array of recipes from Spoonacular
 */
export const searchRecipesByMealType = async (mealType, searchTerm = '') => {
  try {
    console.log(`Searching Spoonacular recipes for ${mealType} with term: "${searchTerm}"`);
    
    // Use Spoonacular API instead of Firestore
    const recipes = await spoonacularSearchRecipes(mealType, searchTerm, 20);
    
    console.log(`Found ${recipes.length} recipes for ${mealType} from Spoonacular`);
    return recipes;
  } catch (error) {
    console.error('Error searching Spoonacular recipes:', error);
    
    // Return empty array on error - Spoonacular service handles fallbacks
    return [];
  }
};

/**
 * Get patient by ID (for doctors)
 * @param {string} patientId - Patient's user ID
 * @returns {Promise<Object|null>} - Patient data or null
 */
export const getPatientById = async (patientId) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    // Get current user data to verify doctor role
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    const userData = userDoc.data();
    
    if (userData?.userType !== 'doctor') {
      throw new Error('Only doctors can access patient data');
    }
    
    // Verify doctor-patient relationship
    const assignmentQuery = query(
      collection(db, 'doctorPatientAssignments'),
      where('doctorId', '==', user.uid),
      where('patientId', '==', patientId)
    );
    const assignmentSnap = await getDocs(assignmentQuery);
    
    if (assignmentSnap.empty) {
      throw new Error('Patient not assigned to this doctor');
    }
    
    // Get patient data
    const patientDocRef = doc(db, 'users', patientId);
    const patientDoc = await getDoc(patientDocRef);
    
    if (!patientDoc.exists()) {
      throw new Error('Patient not found');
    }
    
    const patientData = patientDoc.data();
    return {
      id: patientDoc.id,
      firstName: patientData.firstName || '',
      lastName: patientData.lastName || '',
      email: patientData.email || '',
      photoUrl: patientData.photoUrl || null,
      assignedDoctorId: patientData.assignedDoctorId || null,
      medicalConditions: patientData.medicalConditions || [],
      dietaryRestrictions: patientData.dietaryRestrictions || [],
      currentMealPlanId: patientData.currentMealPlanId || null,
    };
  } catch (error) {
    console.error('Error getting patient by ID:', error);
    throw error;
  }
};

/**
 * FIXED: Create manual meal plan with standardized week structure
 * @param {Object} mealPlanData - Manual meal plan data
 * @returns {Promise<string>} - Meal plan document ID
 */
export const createManualMealPlan = async (mealPlanData) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    // Get current user data to verify doctor role
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    const userData = userDoc.data();
    
    if (userData?.userType !== 'doctor') {
      throw new Error('Only doctors can create manual meal plans');
    }
    
    console.log('Creating manual meal plan with week structure:', mealPlanData);
    
    // Generate meal plan ID
    const currentDate = new Date().toISOString().split('T')[0];
    const mealPlanId = `${mealPlanData.patientId}_manual_${currentDate}_${Date.now()}`;
    
    // Prepare meal plan document with enhanced structure
    const mealPlanDoc = {
      // Basic info
      id: mealPlanId,
      patientId: mealPlanData.patientId,
      doctorId: user.uid,
      type: 'manual',
      
      // Plan details
      duration: mealPlanData.duration,
      startDate: currentDate,
      endDate: (() => {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + mealPlanData.duration);
        return endDate.toISOString().split('T')[0];
      })(),
      
      // FIXED: Week structure to match AI meal plans
      week: mealPlanData.week, // CHANGED: Use 'week' instead of 'meals'
      
      // Metadata
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'doctor',
      approvedAt: new Date(),
      approvedBy: user.uid,
      status: 'active',
      
      // Enhanced nutrition data
      totalNutrition: mealPlanData.totalNutrition,
      dailyAverageNutrition: {
        calories: Math.round(mealPlanData.totalNutrition.calories / mealPlanData.duration),
        protein: Math.round(mealPlanData.totalNutrition.protein / mealPlanData.duration),
        carbs: Math.round(mealPlanData.totalNutrition.carbs / mealPlanData.duration),
        fat: Math.round(mealPlanData.totalNutrition.fat / mealPlanData.duration),
      },
      
      // Plan metadata
      planType: 'manual',
      mealCount: mealPlanData.duration * 3, // Total number of meals
    };
    
    // Save to Firestore
    const mealPlanRef = doc(db, 'mealPlans', mealPlanId);
    await setDoc(mealPlanRef, mealPlanDoc);
    
    // Update patient's current meal plan reference
    const patientRef = doc(db, 'users', mealPlanData.patientId);
    await updateDoc(patientRef, {
      currentMealPlanId: mealPlanId,
      lastMealPlanUpdate: new Date(),
    });
    
    console.log('Manual meal plan created successfully with week structure:', mealPlanId);
    return mealPlanId;
  } catch (error) {
    console.error('Error creating manual meal plan:', error);
    throw error;
  }
};