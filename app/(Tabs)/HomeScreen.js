import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";

// UPDATED: Import react-native-vision-camera
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';

// FIXED: Import HealthService instead of direct react-native-health
import HealthService from '../../healthService';

// Import bookmark service functions
import { getUserBookmarks } from "../../bookmarkService";

// FIXED: Import meal plan service for testing (Firebase v9)
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from "../../configs/firebaseConfig";
import { getCurrentWeekMealPlan, saveMealPlan } from "../../mealPlanService";

// Import useAuth to check user type
import { useAuth } from "../_layout";

const RecipeCard = ({ recipe, onPress, showBookmarkButton = true, isBookmarked = false, onBookmarkPress }) => {
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(recipe)}>
      <Image source={{ uri: recipe.image }} style={styles.cardImage} />
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {recipe.title}
        </Text>
        <Text style={styles.cardCalories}>
          {recipe.nutrition?.nutrients?.find(n => n.name === 'Calories')?.amount?.toFixed(0) || 
           recipe.calories || '0'} Cal
        </Text>
      </View>
      {showBookmarkButton && (
        <TouchableOpacity 
          style={styles.bookmarkButton}
          onPress={() => onBookmarkPress && onBookmarkPress(recipe)}
        >
          <Ionicons 
            name={isBookmarked ? "bookmark" : "bookmark-outline"} 
            size={20} 
            color={isBookmarked ? "#4CAF50" : "#333"} 
          />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const BookmarksSection = ({ bookmarks, loading, error, onViewMore, onPressRecipe }) => {
  return (
    <View style={styles.recipeSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your Bookmarks</Text>
        {bookmarks.length > 0 && (
          <TouchableOpacity onPress={onViewMore}>
            <View style={styles.viewMoreContainer}>
              <Text style={styles.viewMoreText}>View All</Text>
              <Ionicons name="chevron-forward" size={16} color="#666" />
            </View>
          </TouchableOpacity>
        )}
      </View>
      
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Loading bookmarks...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : bookmarks.length === 0 ? (
        <View style={styles.emptyBookmarksContainer}>
          <Ionicons name="bookmark-outline" size={48} color="#ccc" />
          <Text style={styles.emptyBookmarksTitle}>No Bookmarks Yet</Text>
          <Text style={styles.emptyBookmarksText}>
            Start exploring recipes and bookmark your favorites to see them here!
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cardScrollView}
        >
          {bookmarks.map(bookmark => (
            <RecipeCard
              key={bookmark.id}
              recipe={bookmark}
              onPress={onPressRecipe}
              showBookmarkButton={false} // Don't show bookmark button in bookmarks section
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const FeatureCard = ({ icon, title, subtitle, onPress, iconColor = "#4CAF50" }) => {
  return (
    <TouchableOpacity style={styles.featureCard} onPress={onPress}>
      <View style={[styles.featureIconContainer, { backgroundColor: iconColor + '20' }]}>
        <Ionicons name={icon} size={28} color={iconColor} />
      </View>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );
};

// IMPROVED: Glucose Widget Component with Better Production Support
const GlucoseWidget = () => {
  const [glucose, setGlucose] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trend, setTrend] = useState('stable');
  const [hasPermissions, setHasPermissions] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [showDebug, setShowDebug] = useState(false);
  const [debugLoading, setDebugLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const loadGlucose = async () => {
    try {
      console.log('🩺 Loading glucose data...');
      setLoading(true);
      setErrorMessage(null);
      
      // First run debug to understand the situation
      const debugInfo = await HealthService.debugHealthKitStatus();
      console.log('🩺 Debug info:', debugInfo);
      setDebugInfo(debugInfo);
      
      // Handle different scenarios based on debug info
      if (debugInfo.authStatus === 'developmentBuild') {
        console.log('🩺 Development build detected');
        setErrorMessage('Development build detected. HealthKit requires a production build.');
        setHasPermissions(false);
        setGlucose(null);
        return;
      }
      
      if (debugInfo.authStatus === 'simulator') {
        console.log('🩺 iOS Simulator detected');
        setErrorMessage('HealthKit requires a physical iOS device. Simulators are not supported.');
        setHasPermissions(false);
        setGlucose(null);
        return;
      }
      
      if (debugInfo.authStatus === 'moduleError') {
        console.log('🩺 HealthKit module error');
        setErrorMessage('HealthKit module not properly installed. Please check your setup.');
        setHasPermissions(false);
        setGlucose(null);
        return;
      }
      
      if (!debugInfo.available && !debugInfo.hasWorkaround) {
        console.log('🩺 HealthKit not available');
        setErrorMessage(`HealthKit not available: ${debugInfo.reason}`);
        setHasPermissions(false);
        setGlucose(null);
        return;
      }
      
      // Check if we already have permissions
      if (debugInfo.authStatus === 'sharingAuthorized') {
        console.log('🩺 Already have permissions, loading data...');
        setHasPermissions(true);
        HealthService.hasPermissions = true;
        HealthService.isInitialized = true;
        
        const reading = await HealthService.getLatestGlucoseReading();
        console.log('🩺 Latest glucose reading:', reading);
        
        if (reading) {
          setGlucose(reading);
          
          // Get trend
          const glucoseTrend = await HealthService.calculateGlucoseTrend();
          setTrend(glucoseTrend);
        }
      } else {
        // Need to request permissions
        console.log('🩺 Need to request permissions');
        setHasPermissions(false);
        setGlucose(null);
      }
    } catch (error) {
      console.error('🩺 Glucose loading error:', error);
      setErrorMessage(`Error: ${error.message}`);
      setHasPermissions(false);
      setGlucose(null);
    } finally {
      setLoading(false);
    }
  };

  const runFullDebug = async () => {
    setDebugLoading(true);
    try {
      console.log('🔧 Starting comprehensive HealthKit debug...');
      
      const basicDebug = await HealthService.debugHealthKitStatus();
      setDebugInfo(basicDebug);
      console.log('🔧 Full debug info:', basicDebug);
      
      // Show debug info automatically if there are issues
      if (!basicDebug.available || basicDebug.isSimulator || basicDebug.authStatus === 'developmentBuild') {
        setShowDebug(true);
      }
      
    } catch (error) {
      console.error('🔧 Debug error:', error);
      Alert.alert('Debug Error', error.message);
    } finally {
      setDebugLoading(false);
    }
  };

  const requestPermissions = async () => {
    try {
      console.log('🩺 Requesting HealthKit permissions...');
      setLoading(true);
      setErrorMessage(null);
      
      const success = await HealthService.requestPermissions();
      console.log('🩺 Permission request result:', success);
      
      if (success) {
        setHasPermissions(true);
        await loadGlucose();
        Alert.alert(
          'HealthKit Connected!',
          'Your glucose data will now sync from the Health app.\n\nTo add test data:\n1. Open Health app\n2. Browse → Vitals → Blood Glucose\n3. Tap "Add Data" and enter a value\n4. Return here and tap refresh'
        );
      }
    } catch (error) {
      console.error('🩺 Permission request error:', error);
      
      let title = 'HealthKit Error';
      let message = error.message;
      let buttons = [{ text: 'OK' }];
      
      // Handle specific error types
      if (error.message.includes('Development build')) {
        title = 'Development Build Detected';
        message = 'HealthKit requires a production build to work properly.\n\nPlease:\n• Build for release/production\n• Test on a physical device\n• Ensure proper entitlements are configured';
        buttons = [
          { text: 'Use Mock Data', onPress: () => {
            const mockReading = HealthService.getMockGlucoseReading();
            setGlucose(mockReading);
            setHasPermissions(true);
            setLoading(false);
            setErrorMessage(null);
          }},
          { text: 'Debug', onPress: runFullDebug },
          { text: 'OK' }
        ];
      } else if (error.message.includes('Simulator')) {
        title = 'iOS Simulator Detected';
        message = 'HealthKit requires a physical iOS device. Simulators are not supported.\n\nPlease test on a real iPhone or iPad.';
        buttons = [
          { text: 'Use Mock Data', onPress: () => {
            const mockReading = HealthService.getMockGlucoseReading();
            setGlucose(mockReading);
            setHasPermissions(true);
            setLoading(false);
            setErrorMessage(null);
          }},
          { text: 'OK' }
        ];
      } else if (error.message.includes('denied')) {
        title = 'Permission Denied';
        message = 'HealthKit permissions were denied.\n\nTo enable:\n1. Open iOS Settings\n2. Go to Health > Data Access & Devices\n3. Find your app and enable permissions';
        buttons = [
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
          { text: 'Try Again', onPress: requestPermissions },
          { text: 'Use Mock Data', onPress: () => {
            const mockReading = HealthService.getMockGlucoseReading();
            setGlucose(mockReading);
            setHasPermissions(true);
            setLoading(false);
            setErrorMessage(null);
          }}
        ];
      } else {
        buttons = [
          { text: 'Use Mock Data', onPress: () => {
            const mockReading = HealthService.getMockGlucoseReading();
            setGlucose(mockReading);
            setHasPermissions(true);
            setLoading(false);
            setErrorMessage(null);
          }},
          { text: 'Debug', onPress: runFullDebug },
          { text: 'Try Again', onPress: requestPermissions },
          { text: 'Cancel' }
        ];
      }
      
      setErrorMessage(error.message);
      
      Alert.alert(title, message, buttons);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGlucose();
  }, []);

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'rising': return 'trending-up';
      case 'falling': return 'trending-down';
      default: return 'remove';
    }
  };

  const getTrendColor = (trend) => {
    switch (trend) {
      case 'rising': return '#FF9800';
      case 'falling': return '#2196F3';
      default: return '#4CAF50';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'sharingAuthorized':
      case true:
        return '#4CAF50';
      case 'sharingDenied':
      case false:
        return '#F44336';
      case 'notDetermined':
        return '#FF9800';
      case 'simulator':
        return '#9C27B0';
      case 'developmentBuild':
        return '#FF5722';
      case 'moduleError':
      case 'deviceNotSupported':
        return '#FF5722';
      default:
        return '#9E9E9E';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'sharingAuthorized':
        return '✅ Authorized';
      case 'sharingDenied':
        return '❌ Denied';
      case 'notDetermined':
        return '⚠️ Not Determined';
      case 'simulator':
        return '📱 Simulator';
      case 'developmentBuild':
        return '🔧 Dev Build';
      case 'moduleError':
        return '🔧 Module Error';
      case 'deviceNotSupported':
        return '❌ Not Supported';
      case true:
        return '✅ True';
      case false:
        return '❌ False';
      default:
        return `❓ ${status}`;
    }
  };

  if (loading) {
    return (
      <View style={styles.glucoseWidget}>
        <ActivityIndicator size="small" color="#4CAF50" />
        <Text style={styles.glucoseLoadingText}>Loading glucose data...</Text>
      </View>
    );
  }

  // Show error message if there's a critical issue
  if (errorMessage && !glucose) {
    return (
      <View style={styles.glucoseWidget}>
        <View style={styles.glucoseErrorContainer}>
          <Ionicons name="warning" size={32} color="#FF9800" />
          <Text style={styles.glucoseErrorTitle}>HealthKit Issue</Text>
          <Text style={styles.glucoseErrorMessage}>{errorMessage}</Text>
          
          {debugInfo?.authStatus === 'developmentBuild' && (
            <View style={styles.errorHint}>
              <Text style={styles.errorHintText}>
                💡 For development: Use mock data or build for production
              </Text>
            </View>
          )}
          
          {debugInfo?.authStatus === 'simulator' && (
            <View style={styles.errorHint}>
              <Text style={styles.errorHintText}>
                💡 Switch to a physical iOS device to test HealthKit
              </Text>
            </View>
          )}
          
          <View style={styles.errorActions}>
            <TouchableOpacity 
              style={[styles.debugButton, { backgroundColor: '#4CAF50' }]} 
              onPress={() => {
                const mockReading = HealthService.getMockGlucoseReading();
                setGlucose(mockReading);
                setHasPermissions(true);
                setErrorMessage(null);
              }}
            >
              <Ionicons name="play" size={16} color="#fff" />
              <Text style={styles.debugButtonText}>Use Mock Data</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.debugButton, { backgroundColor: '#2196F3' }]} 
              onPress={runFullDebug}
              disabled={debugLoading}
            >
              {debugLoading ? (
                <ActivityIndicator size={16} color="#fff" />
              ) : (
                <Ionicons name="bug" size={16} color="#fff" />
              )}
              <Text style={styles.debugButtonText}>
                {debugLoading ? 'Running...' : 'Debug'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Show debug info if available */}
        {showDebug && debugInfo && (
          <ScrollView style={styles.debugOutput}>
            <Text style={styles.debugSectionTitle}>🔍 Debug Summary</Text>
            <Text style={styles.debugText}>Platform: {debugInfo.platform}</Text>
            
            <Text style={styles.debugSectionTitle}>🏥 HealthKit Status</Text>
            <View style={styles.debugStatusRow}>
              <Text style={styles.debugText}>Available: </Text>
              <Text style={[styles.debugStatusText, { color: getStatusColor(debugInfo.available) }]}>
                {getStatusText(debugInfo.available)}
              </Text>
            </View>
            
            <View style={styles.debugStatusRow}>
              <Text style={styles.debugText}>Auth Status: </Text>
              <Text style={[styles.debugStatusText, { color: getStatusColor(debugInfo.authStatus) }]}>
                {getStatusText(debugInfo.authStatus)}
              </Text>
            </View>
            
            {debugInfo.reason && (
              <Text style={styles.debugText}>Reason: {debugInfo.reason}</Text>
            )}
            
            <Text style={styles.debugSectionTitle}>💡 Solution</Text>
            {debugInfo.authStatus === 'developmentBuild' ? (
              <Text style={styles.debugTroubleshoot}>
                • Build the app for production/release mode
              </Text>
            ) : debugInfo.authStatus === 'simulator' ? (
              <Text style={styles.debugTroubleshoot}>
                • Switch to a real iOS device (iPhone/iPad)
              </Text>
            ) : (
              <Text style={styles.debugTroubleshoot}>
                • Check iOS Settings → Health → Data Access & Devices
              </Text>
            )}
          </ScrollView>
        )}
        
        <TouchableOpacity 
          style={[styles.debugButton, styles.debugButtonSmall, { backgroundColor: '#FF9800', alignSelf: 'center', marginTop: 8 }]} 
          onPress={() => setShowDebug(!showDebug)}
        >
          <Ionicons name={showDebug ? "eye-off" : "eye"} size={16} color="#fff" />
          <Text style={styles.debugButtonText}>{showDebug ? 'Hide Debug' : 'Show Debug'}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show connect button if no permissions
  if (!hasPermissions || !glucose) {
    return (
      <View style={styles.glucoseWidget}>
        <TouchableOpacity style={styles.glucoseNoDataContainer} onPress={requestPermissions}>
          <Ionicons name="fitness" size={32} color="#4CAF50" />
          <Text style={styles.glucoseNoDataTitle}>Connect to Health App</Text>
          <Text style={styles.glucoseNoDataSubtitle}>
            Tap to sync your glucose data from Apple Health
          </Text>
          <View style={styles.connectButton}>
            <Text style={styles.connectButtonText}>Connect Now</Text>
            <Ionicons name="chevron-forward" size={16} color="#4CAF50" />
          </View>
        </TouchableOpacity>
        
        <View style={styles.debugControls}>
          <TouchableOpacity 
            style={[styles.debugButton, styles.debugButtonSmall]} 
            onPress={runFullDebug}
            disabled={debugLoading}
          >
            {debugLoading ? (
              <ActivityIndicator size={16} color="#fff" />
            ) : (
              <Ionicons name="bug" size={16} color="#fff" />
            )}
            <Text style={styles.debugButtonText}>
              {debugLoading ? 'Running...' : 'Debug'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.debugButton, styles.debugButtonSmall, { backgroundColor: '#4CAF50' }]} 
            onPress={() => {
              const mockReading = HealthService.getMockGlucoseReading();
              setGlucose(mockReading);
              setHasPermissions(true);
            }}
          >
            <Ionicons name="play" size={16} color="#fff" />
            <Text style={styles.debugButtonText}>Mock Data</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Show glucose data
  return (
    <View style={[styles.glucoseWidget, { borderLeftColor: HealthService.getGlucoseColor(glucose.category) }]}>
      <TouchableOpacity onPress={loadGlucose}>
        <View style={styles.glucoseHeader}>
          <View style={styles.glucoseValueContainer}>
            <Text style={styles.glucoseValue}>{glucose.value}</Text>
            <Text style={styles.glucoseUnit}>{glucose.unit}</Text>
          </View>
          <View style={styles.glucoseTrendContainer}>
            <Ionicons 
              name={getTrendIcon(trend)} 
              size={20} 
              color={getTrendColor(trend)} 
            />
            <Text style={[styles.glucoseTrend, { color: getTrendColor(trend) }]}>
              {trend}
            </Text>
          </View>
        </View>
        
        <View style={styles.glucoseDetails}>
          <Text style={[styles.glucoseCategory, { color: HealthService.getGlucoseColor(glucose.category) }]}>
            {glucose.category.toUpperCase()}
          </Text>
          <Text style={styles.glucoseTime}>
            {glucose.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        
        <Text style={styles.glucoseMessage}>
          {HealthService.getGlucoseMessage(glucose.category, glucose.value)}
        </Text>
        
        <View style={styles.glucoseSource}>
          <Text style={styles.glucoseSourceText}>
            {glucose.isRealData ? '📱 Real Data' : '🎭 Mock Data'} • {glucose.source}
          </Text>
        </View>
        
        <View style={styles.refreshHint}>
          <Ionicons name="refresh" size={12} color="#999" />
          <Text style={styles.refreshText}>Tap to refresh</Text>
        </View>
      </TouchableOpacity>

      {/* Optional debug controls for production (can be removed) */}
      {__DEV__ && (
        <View style={styles.debugControls}>
          <TouchableOpacity 
            style={[styles.debugButton, styles.debugButtonSmall]} 
            onPress={runFullDebug}
            disabled={debugLoading}
          >
            {debugLoading ? (
              <ActivityIndicator size={16} color="#fff" />
            ) : (
              <Ionicons name="bug" size={16} color="#fff" />
            )}
            <Text style={styles.debugButtonText}>
              {debugLoading ? 'Running...' : 'Debug'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const HomeScreen = () => {
  const { user, isPatient, isDoctor } = useAuth();
  
  const [showScanner, setShowScanner] = useState(false);
  const [manualBarcode, setManualBarcode] = useState("");
  
  // UPDATED: Vision Camera hooks
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back', {
    physicalDevices: ['wide-angle-camera'] // Explicitly avoid ultra-wide
  });
  
  // Bookmarks state
  const [bookmarks, setBookmarks] = useState([]);
  const [loadingBookmarks, setLoadingBookmarks] = useState(true);
  const [bookmarksError, setBookmarksError] = useState(null);

  // UPDATED: Vision Camera barcode scanner
  const codeScanner = useCodeScanner({
    codeTypes: [
      'qr',
      'ean-13',
      'ean-8', 
      'code-128',
      'code-39',
      'upc-a',
      'upc-e',
      'code-93',
      'codabar',
      'itf'
    ],
    onCodeScanned: (codes) => {
      console.log('📱 Barcode(s) scanned!', codes);
      
      if (codes.length > 0) {
        const firstCode = codes[0];
        console.log(`Type: ${firstCode.type}`);
        console.log(`Value: ${firstCode.value}`);
        
        // Validate barcode data
        if (!firstCode.value || firstCode.value.trim() === '') {
          console.log('❌ Empty barcode data');
          Alert.alert('Scan Error', 'No barcode data detected. Please try again.');
          return;
        }

        // Basic barcode validation for product codes
        const barcodeValue = firstCode.value.trim();
        if (!/^[0-9]+$/.test(barcodeValue)) {
          console.log('❌ Invalid barcode format:', barcodeValue);
          Alert.alert(
            'Invalid Barcode', 
            `Scanned: ${barcodeValue}\n\nThis doesn't appear to be a valid product barcode. Product barcodes should only contain numbers.`,
            [
              { text: 'Try Again', style: 'cancel' },
              { text: 'Search Anyway', onPress: () => {
                setShowScanner(false);
                router.push({ pathname: "/(Tabs)/ProductDetailScreen", params: { barcode: barcodeValue } });
              }},
              { text: 'Cancel', onPress: () => setShowScanner(false) }
            ]
          );
          return;
        }

        console.log('✅ Valid barcode, navigating to product details');
        setShowScanner(false);
        router.push({ pathname: "/(Tabs)/ProductDetailScreen", params: { barcode: barcodeValue } });
      }
    }
  });

  // FIXED: Database test function for Firebase v9
  const testDatabaseSetup = async () => {
    try {
      console.log('🧪 Testing database setup...');
      
      // Debug: Check what we imported
      console.log('🔍 Debug - auth:', auth);
      console.log('🔍 Debug - db:', db);
      console.log('🔍 Debug - auth.currentUser:', auth?.currentUser);
      
      if (!auth) {
        throw new Error('Auth is undefined - check Firebase config import');
      }
      
      if (!db) {
        throw new Error('Database is undefined - check Firebase config import');
      }
      
      Alert.alert('Database Test', 'Starting database test... Check console for results.');
      
      // Test 1: Check user authentication
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated - please log in first');
      }
      
      console.log('✅ User authenticated:', user.uid);
      
      // Test 2: Try to access Firestore using v9 syntax
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      const userData = userDoc.data();
      console.log('✅ User data:', userData);
      console.log('✅ User type:', userData?.userType);
      
      // Test 3: Try saving a meal plan
      const testPlan = { 
        week: { 
          monday: { 
            meals: [
              { id: 'test1', title: 'Test Breakfast', type: 'breakfast' }
            ] 
          } 
        } 
      };
      const planId = await saveMealPlan(testPlan);
      console.log('✅ Meal plan saved with ID:', planId);
      
      // Test 4: Try loading the meal plan
      const loadedPlan = await getCurrentWeekMealPlan();
      console.log('✅ Meal plan loaded:', loadedPlan ? 'Success' : 'Not found');
      console.log('✅ Loaded plan data:', loadedPlan);
      
      console.log('🎉 Database setup test completed successfully!');
      Alert.alert(
        'Database Test Complete', 
        `✅ User type: ${userData?.userType || 'Not set'}\n✅ Meal plan saved: ${planId}\n✅ Meal plan loaded: ${loadedPlan ? 'Success' : 'Failed'}\n\nCheck console for detailed logs.`
      );
    } catch (error) {
      console.error('❌ Database test failed:', error);
      Alert.alert('Database Test Failed', `Error: ${error.message}\n\nCheck console for details.`);
    }
  };

  // Fetch bookmarks with focus effect to refresh when returning to screen
  useFocusEffect(
    useCallback(() => {
      const fetchBookmarks = async () => {
        setLoadingBookmarks(true);
        setBookmarksError(null);
        try {
          const userBookmarks = await getUserBookmarks();
          setBookmarks(userBookmarks);
        } catch (err) {
          console.error('Error fetching bookmarks:', err);
          setBookmarksError('Failed to load bookmarks.');
        } finally {
          setLoadingBookmarks(false);
        }
      };

      fetchBookmarks();
    }, [])
  );

  const handleScanButtonPress = async () => {
    console.log('📱 Scan button pressed');
    
    if (!hasPermission) {
      console.log('📱 Requesting camera permission...');
      const permissionResult = await requestPermission();
      if (!permissionResult) {
        Alert.alert(
          "Permission Required",
          "Camera permission is needed to scan barcodes.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
    }
    
    if (!device) {
      Alert.alert("Camera Error", "No camera device available.");
      return;
    }
    
    console.log('📱 Opening scanner...');
    setShowScanner(true);
  };

  const handleManualSearch = () => {
    if (manualBarcode.trim() === "") {
      Alert.alert("Input Error", "Please enter a barcode number.");
      return;
    }
    // this's basically barcode validation
    if (!/^[0-9]+$/.test(manualBarcode.trim())) {
        Alert.alert("Input Error", "Barcode should only contain numbers.");
        return;
    }
    router.push({ pathname: "/(Tabs)/ProductDetailScreen", params: { barcode: manualBarcode.trim() } });
    setManualBarcode(""); // after search we clear the input
  };

  const handlePressRecipe = (recipe) => {
    // Navigate to recipe details screen
    router.push({ 
      pathname: "/RecipeDetailScreen", 
      params: { recipeId: recipe.id } 
    });
  };

  const handleViewAllBookmarks = () => {
    // Navigate to bookmarks screen
    router.push({ pathname: "/BookmarksScreen" });
  };

  const handleRecipesPress = () => {
    // Navigate to recipes screen
    router.push({ pathname: "/RecipesScreen" });
  };

  const handleMealPlanPress = () => {
    // Navigate to meal plan screen
    router.push({ pathname: "/MealPlanScreen" });
  };

  // NEW: Handle meal logging press
  const handleMealLoggingPress = () => {
    // Navigate to meal logging screen
    router.push({ pathname: "/MealLoggingScreen" });
  };

  if (showScanner) {
    if (!hasPermission) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.loadingText}>Requesting camera permission...</Text>
        </View>
      );
    }
    
    if (!device) {
      return (
        <View style={styles.centered}>
          <Ionicons name="camera-outline" size={64} color="#ccc" />
          <Text style={styles.permissionText}>No camera device available.</Text>
          <TouchableOpacity style={styles.cancelButton} onPress={() => setShowScanner(false)}>
            <Text style={styles.cancelButtonText}>Cancel Scan</Text>
          </TouchableOpacity>
        </View>
      );
    }
    
    return (
      <View style={styles.scannerContainer}>
        <Camera
          style={StyleSheet.absoluteFillObject}
          device={device}
          isActive={true}
          codeScanner={codeScanner}
        />
        
        {/* Scanner overlay */}
        <View style={styles.scannerOverlay}>
          <View style={styles.scannerTopOverlay} />
          <View style={styles.scannerMiddleRow}>
            <View style={styles.scannerSideOverlay} />
            <View style={styles.scannerWindow}>
              <View style={styles.scannerFrame} />
              <Text style={styles.scannerFrameText}>Position barcode here</Text>
            </View>
            <View style={styles.scannerSideOverlay} />
          </View>
          <View style={styles.scannerBottomOverlay}>
            <Text style={styles.scannerHelpText}>
              Hold your device steady and position the barcode within the frame
            </Text>
            <Text style={styles.scannerSubText}>
              QR codes and product barcodes supported
            </Text>
          </View>
        </View>
        
        {/* Cancel button */}
        <View style={styles.scannerControls}>
          <TouchableOpacity 
            style={styles.cancelScanButton} 
            onPress={() => {
              console.log('📱 Cancel scan pressed');
              setShowScanner(false);
            }}
          >
            <Ionicons name="close" size={24} color="#fff" />
            <Text style={styles.cancelScanText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>Welcome to Digital Dietitian!</Text>
        <Text style={styles.subtitle}>Scan a product or enter its barcode.</Text>

        {/* IMPROVED: Glucose Widget Section with Better Production Support */}
        {isPatient && (
          <View style={styles.glucoseSection}>
            <Text style={styles.sectionTitle}>Blood Glucose</Text>
            <GlucoseWidget />
          </View>
        )}

        {/* Database Test Button (can be removed in production) */}
        {__DEV__ && (
          <View style={styles.testButtonContainer}>
            <TouchableOpacity style={styles.testButton} onPress={testDatabaseSetup}>
              <Ionicons name="flask" size={20} color="#fff" />
              <Text style={styles.testButtonText}>Test Database Setup</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.manualInputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Enter barcode manually"
            value={manualBarcode}
            onChangeText={setManualBarcode}
            keyboardType="numeric"
          />
          <Button title="Search Barcode" onPress={handleManualSearch} />
        </View>

        <View style={styles.scanButtonContainer}>
          <Button title="Scan Barcode with Camera" onPress={handleScanButtonPress} />
        </View>
        
        {/* Feature Cards Section */}
        <View style={styles.featuresContainer}>
          <Text style={styles.featuresHeader}>Explore</Text>
          <View style={styles.featuresGrid}>
            <FeatureCard
              icon="restaurant"
              title="Recipes"
              subtitle="Cook, eat, log, repeat"
              onPress={handleRecipesPress}
              iconColor="#4CAF50"
            />
            <FeatureCard
              icon="calendar"
              title="Meal Plans"
              subtitle="Weekly meal planning"
              onPress={handleMealPlanPress}
              iconColor="#FF9800"
            />
            <FeatureCard
              icon="camera"
              title="Log Meal"
              subtitle="Photo-based meal tracking"
              onPress={handleMealLoggingPress}
              iconColor="#9C27B0"
            />
          </View>
        </View>
        
        {/* Bookmarks Section */}
        <View style={styles.recipesContainer}>
          <BookmarksSection 
            bookmarks={bookmarks}
            loading={loadingBookmarks}
            error={bookmarksError}
            onViewMore={handleViewAllBookmarks}
            onPressRecipe={handlePressRecipe}
          />
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
    color: '#666',
  },
  cancelButton: {
    backgroundColor: '#FF6347',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  
  // Glucose Widget Styles
  glucoseSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  glucoseWidget: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  glucoseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  glucoseValueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  glucoseValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
  },
  glucoseUnit: {
    fontSize: 16,
    color: '#666',
    marginLeft: 4,
  },
  glucoseTrendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  glucoseTrend: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  glucoseDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  glucoseCategory: {
    fontSize: 14,
    fontWeight: '600',
  },
  glucoseTime: {
    fontSize: 12,
    color: '#666',
  },
  glucoseMessage: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  glucoseLoadingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  glucoseNoDataContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  glucoseNoDataTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  glucoseNoDataSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  connectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    marginRight: 4,
  },
  glucoseSource: {
    alignItems: 'center',
    marginTop: 8,
  },
  glucoseSourceText: {
    fontSize: 10,
    color: '#999',
    fontStyle: 'italic',
  },
  refreshHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  refreshText: {
    fontSize: 10,
    color: '#999',
    marginLeft: 4,
  },
  
  // Error handling styles
  glucoseErrorContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  glucoseErrorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 12,
    marginBottom: 8,
  },
  glucoseErrorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  errorHint: {
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    width: '100%',
  },
  errorHintText: {
    fontSize: 12,
    color: '#E65100',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  errorActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  
  // Debug Styles
  debugControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    gap: 8,
  },
  debugButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  debugButtonSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  debugOutput: {
    maxHeight: 200,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  debugSectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
  },
  debugStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  debugText: {
    fontSize: 10,
    color: '#666',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 1,
  },
  debugStatusText: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  debugTroubleshoot: {
    fontSize: 9,
    color: '#666',
    marginBottom: 2,
    paddingLeft: 4,
  },
  
  testButtonContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  testButton: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  manualInputContainer: {
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  scanButtonContainer: {
    marginBottom: 30,
  },
  
  // Scanner styles
  scannerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scannerTopOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scannerMiddleRow: {
    flexDirection: 'row',
    height: 250,
  },
  scannerSideOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  scannerWindow: {
    width: 250,
    height: 250,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerFrame: {
    width: 220,
    height: 220,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  scannerFrameText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  scannerBottomOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  scannerHelpText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  scannerSubText: {
    color: '#ccc',
    fontSize: 14,
    textAlign: 'center',
  },
  scannerControls: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelScanButton: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
  },
  cancelScanText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  
  // Feature cards styles
  featuresContainer: {
    marginBottom: 30,
  },
  featuresHeader: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  featureIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
    textAlign: 'center',
  },
  featureSubtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  
  // Recipes/Bookmarks section styles
  recipesContainer: {
    marginBottom: 20,
  },
  recipeSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewMoreText: {
    fontSize: 14,
    color: '#666',
    marginRight: 4,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#FF6347',
    fontSize: 16,
    textAlign: 'center',
  },
  emptyBookmarksContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyBookmarksTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyBookmarksText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  cardScrollView: {
    paddingRight: 20,
  },
  card: {
    width: 200,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardImage: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  cardCalories: {
    fontSize: 12,
    color: '#666',
  },
  bookmarkButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    padding: 6,
  },
});

export default HomeScreen;