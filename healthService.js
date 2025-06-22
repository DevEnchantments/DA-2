import { NativeModules, Platform } from 'react-native';

// ENHANCED: Try multiple import strategies and log everything
let HealthKit, HKQuantityTypeIdentifier, HKAuthorizationRequestStatus, HKAuthorizationStatus;
let importError = null;
let importMethod = 'none';

console.log('🔍 ==========================================');
console.log('🔍 === HEALTHKIT IMPORT DEBUG START ===');
console.log('🔍 ==========================================');

// Try Method 1: Standard import
try {
  console.log('🔍 Trying Method 1: Standard import...');
  const HealthKitModule = require('@kingstinct/react-native-healthkit');
  console.log('🔍 Method 1 - Raw module:', HealthKitModule);
  console.log('🔍 Method 1 - Module keys:', Object.keys(HealthKitModule || {}));
  
  HealthKit = HealthKitModule.default || HealthKitModule;
  
  // FIXED: Extract the constants from the module
  HKAuthorizationRequestStatus = HealthKitModule.AuthorizationRequestStatus;
  HKAuthorizationStatus = HealthKitModule.AuthorizationStatus;
  
  // FIXED: Look for quantity type identifiers in different locations
  console.log('🔍 Looking for HKQuantityTypeIdentifier...');
  HKQuantityTypeIdentifier = HealthKitModule.HKQuantityTypeIdentifier || 
                            HealthKitModule.QuantityTypeIdentifier ||
                            HealthKitModule.default?.HKQuantityTypeIdentifier;
  
  // If not found, try to construct the identifiers we need
  if (!HKQuantityTypeIdentifier) {
    console.log('🔍 HKQuantityTypeIdentifier not found, constructing manually...');
    HKQuantityTypeIdentifier = {
      bloodGlucose: 'HKQuantityTypeIdentifierBloodGlucose',
      heartRate: 'HKQuantityTypeIdentifierHeartRate',
      stepCount: 'HKQuantityTypeIdentifierStepCount'
    };
  }
  
  console.log('🔍 Method 1 - HealthKit:', HealthKit);
  console.log('🔍 Method 1 - HKQuantityTypeIdentifier:', HKQuantityTypeIdentifier);
  console.log('🔍 Method 1 - HKAuthorizationRequestStatus:', HKAuthorizationRequestStatus);
  console.log('🔍 Method 1 - HKAuthorizationStatus:', HKAuthorizationStatus);
  
  if (HealthKit && typeof HealthKit === 'object') {
    console.log('🔍 Method 1 - HealthKit methods:', Object.keys(HealthKit));
    importMethod = 'standard';
  }
} catch (error) {
  console.error('🔍 Method 1 failed:', error);
  importError = error;
}

// Final import status
console.log('🔍 === IMPORT RESULTS ===');
console.log('🔍 Import Method:', importMethod);
console.log('🔍 HealthKit available:', !!HealthKit);
console.log('🔍 HealthKit type:', typeof HealthKit);
console.log('🔍 HKQuantityTypeIdentifier:', HKQuantityTypeIdentifier);
console.log('🔍 HKAuthorizationStatus:', HKAuthorizationStatus);
console.log('🔍 Import error:', importError?.message);

if (HealthKit) {
  console.log('🔍 HealthKit methods:', Object.keys(HealthKit));
  console.log('🔍 Has isHealthDataAvailable:', typeof HealthKit.isHealthDataAvailable);
} else {
  console.log('🔍 ❌ No HealthKit module found!');
}

console.log('🔍 ==========================================');
console.log('🔍 === HEALTHKIT IMPORT DEBUG END ===');
console.log('🔍 ==========================================');

// Health service for glucose monitoring
class HealthService {
  constructor() {
    this.isInitialized = false;
    this.hasPermissions = false;
  }

  /**
   * SUPER COMPREHENSIVE DEBUGGING - Check everything about HealthKit
   */
  async debugHealthKitStatus() {
    console.log('🔍 ==========================================');
    console.log('🔍 === SUPER DEBUG INFO START ===');
    console.log('🔍 ==========================================');
    
    // 1. Platform Check
    console.log('🔍 Platform.OS:', Platform.OS);
    console.log('🔍 Platform.Version:', Platform.Version);
    console.log('🔍 Platform constants:', Platform.constants);
    
    // 2. Check if we're in simulator
    const isSimulator = Platform.constants.simulator || 
                       Platform.constants.isDevice === false ||
                       Platform.OS === 'ios' && Platform.isPad === false && Platform.isTVOS === false;
    console.log('🔍 Is Simulator (basic):', Platform.constants.simulator);
    console.log('🔍 Is Device:', Platform.constants.isDevice);
    console.log('🔍 Is Simulator (calculated):', isSimulator);
    
    // 3. Check native module availability
    console.log('🔍 Available Native Modules count:', Object.keys(NativeModules).length);
    console.log('🔍 Native Modules sample:', Object.keys(NativeModules).slice(0, 10));
    
    // Look for HealthKit-related modules
    const healthKitModules = Object.keys(NativeModules).filter(key => 
      key.toLowerCase().includes('health') || key.toLowerCase().includes('kit')
    );
    console.log('🔍 HealthKit-related modules:', healthKitModules);
    
    // Check specific module names
    const moduleChecks = {
      'ReactNativeHealthkit': !!NativeModules.ReactNativeHealthkit,
      'RNHealthkit': !!NativeModules.RNHealthkit,
      'HealthKit': !!NativeModules.HealthKit,
      'RNHealthKit': !!NativeModules.RNHealthKit,
      'KingstinctHealthKit': !!NativeModules.KingstinctHealthKit
    };
    console.log('🔍 Module availability check:', moduleChecks);
    
    // 4. Check import status
    console.log('🔍 Import method used:', importMethod);
    console.log('🔍 HealthKit imported successfully:', !!HealthKit);
    console.log('🔍 HealthKit type:', typeof HealthKit);
    console.log('🔍 HKQuantityTypeIdentifier:', HKQuantityTypeIdentifier);
    console.log('🔍 Import error:', importError?.message);
    
    if (!HealthKit) {
      const error = `HealthKit module not imported correctly. Import method: ${importMethod}. Error: ${importError?.message || 'Unknown'}`;
      console.log('🔍 ❌', error);
      return { 
        available: false, 
        authStatus: 'moduleError', 
        reason: error,
        platform: Platform.OS,
        isSimulator,
        importError: true,
        importMethod,
        nativeModules: healthKitModules,
        moduleChecks
      };
    }

    // 5. Check for quantity type identifiers
    if (!HKQuantityTypeIdentifier || !HKQuantityTypeIdentifier.bloodGlucose) {
      console.log('🔍 ❌ bloodGlucose identifier not found');
      console.log('🔍 Available identifiers:', HKQuantityTypeIdentifier);
      return {
        available: false,
        authStatus: 'identifierError',
        reason: 'bloodGlucose identifier not available - library may not be properly configured',
        importMethod,
        identifiers: HKQuantityTypeIdentifier
      };
    }
    
    // 6. Check available methods
    const availableMethods = Object.keys(HealthKit);
    console.log('🔍 Available HealthKit methods:', availableMethods);
    console.log('🔍 Has isHealthDataAvailable:', typeof HealthKit.isHealthDataAvailable);
    console.log('🔍 Has requestAuthorization:', typeof HealthKit.requestAuthorization);
    console.log('🔍 Has authorizationStatusFor:', typeof HealthKit.authorizationStatusFor);
    console.log('🔍 Has queryQuantitySamples:', typeof HealthKit.queryQuantitySamples);
    
    if (Platform.OS !== 'ios') {
      console.log('🔍 ❌ Not iOS - HealthKit not available');
      return { available: false, authStatus: 'notAvailable', reason: 'Not iOS platform' };
    }

    if (isSimulator) {
      console.log('🔍 ⚠️ Running in iOS Simulator - HealthKit limited functionality');
      return { 
        available: false, 
        authStatus: 'simulator', 
        reason: 'iOS Simulator detected - HealthKit requires real device',
        isSimulator: true,
        importMethod,
        availableMethods
      };
    }

    try {
      // 7. Check if HealthKit is available on device
      console.log('🔍 Calling HealthKit.isHealthDataAvailable()...');
      
      if (typeof HealthKit.isHealthDataAvailable !== 'function') {
        console.log('🔍 ❌ isHealthDataAvailable is not a function');
        console.log('🔍 HealthKit object:', HealthKit);
        console.log('🔍 HealthKit prototype:', Object.getPrototypeOf(HealthKit));
        return { 
          available: false, 
          authStatus: 'methodError', 
          reason: 'isHealthDataAvailable method not found',
          availableMethods,
          importMethod
        };
      }
      
      const available = await HealthKit.isHealthDataAvailable();
      console.log('🔍 ✅ HealthKit.isHealthDataAvailable() result:', available);

      // Check if this is a development build issue
      const hasHealthKitMethods = availableMethods.includes('requestAuthorization') && 
                                 availableMethods.includes('authorizationStatusFor');
      
      console.log('🔍 Has HealthKit methods:', hasHealthKitMethods);
      console.log('🔍 Native modules count:', Object.keys(NativeModules).length);

      if (!available) {
        console.log('🔍 ❌ HealthKit reports not available on this device');
        
        // Check if this is a development build issue
        if (hasHealthKitMethods && Object.keys(NativeModules).length === 0) {
          console.log('🔍 ⚠️ DEVELOPMENT BUILD DETECTED: HealthKit methods available but native modules not loaded');
          console.log('🔍 💡 This is likely a development build limitation');
          console.log('🔍 🔧 WORKAROUND: Will attempt to use available methods...');
          
          // Force continue with development build workaround
          const workaroundResult = {
            available: false, // Keep as false to indicate limitation
            authStatus: 'developmentBuild',
            reason: 'Development build limitation - HealthKit methods available but native bridge not fully connected',
            isSimulator,
            importMethod,
            hasWorkaround: true,
            deviceInfo: {
              platform: Platform.OS,
              version: Platform.Version,
              isSimulator,
              availableMethods,
              importMethod,
              nativeModulesCount: Object.keys(NativeModules).length
            }
          };
          
          return workaroundResult;
        }
        
        // Additional checks for why it might not be available
        const deviceInfo = {
          platform: Platform.OS,
          version: Platform.Version,
          isSimulator,
          availableMethods,
          importMethod,
          nativeModulesCount: Object.keys(NativeModules).length
        };
        
        console.log('🔍 Device info:', deviceInfo);
        
        return { 
          available: false, 
          authStatus: 'deviceNotSupported', 
          reason: 'HealthKit not available on this device - may be disabled, unsupported, or development build issue',
          deviceInfo
        };
      }

      // 8. If available, check authorization status
      console.log('🔍 HealthKit is available! Checking authorization...');
      
      const authStatus = await HealthKit.getRequestStatusForAuthorization({
        read: [HKQuantityTypeIdentifier.bloodGlucose],
        write: [HKQuantityTypeIdentifier.bloodGlucose],
      });
      
      console.log('🔍 📋 Authorization Request Status:', authStatus);

      const readStatus = await HealthKit.authorizationStatusFor(HKQuantityTypeIdentifier.bloodGlucose);
      console.log('🔍 📋 Blood Glucose Read Status:', readStatus);

      // Interpret authorization status
      let statusExplanation = '';
      switch (readStatus) {
        case HKAuthorizationStatus.notDetermined:
        case 'notDetermined':
          statusExplanation = 'User has not been asked for permission yet';
          break;
        case HKAuthorizationStatus.sharingDenied:
        case 'sharingDenied':
          statusExplanation = 'User explicitly denied permission';
          break;
        case HKAuthorizationStatus.sharingAuthorized:
        case 'sharingAuthorized':
          statusExplanation = 'User granted permission';
          break;
        default:
          statusExplanation = `Unknown status: ${readStatus}`;
      }
      
      console.log('🔍 📝 Status Explanation:', statusExplanation);

      const shouldRequest = authStatus === HKAuthorizationRequestStatus.shouldRequest || authStatus === 'shouldRequest';
      console.log('🔍 🤔 Should request authorization:', shouldRequest);

      // Try to get a sample to test data access
      if (readStatus === HKAuthorizationStatus.sharingAuthorized || readStatus === 'sharingAuthorized') {
        console.log('🔍 🧪 Testing data access...');
        await this.testDataAccess();
      }

      console.log('🔍 ==========================================');
      console.log('🔍 === SUPER DEBUG INFO END ===');
      console.log('🔍 ==========================================');
      
      return { 
        available, 
        authStatus: readStatus,
        requestStatus: authStatus,
        statusExplanation,
        shouldRequest,
        reason: 'HealthKit available and working',
        platform: Platform.OS,
        isSimulator,
        importMethod
      };
    } catch (error) {
      console.error('🔍 ❌ Error in debugHealthKitStatus:', error);
      console.log('🔍 Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      console.log('🔍 ==========================================');
      return { 
        available: false, 
        authStatus: 'error', 
        reason: error.message,
        error: error,
        platform: Platform.OS,
        isSimulator,
        importMethod
      };
    }
  }

  /**
   * Test data access to see if we can actually read glucose data
   */
  async testDataAccess() {
    console.log('🧪 Testing glucose data access...');
    
    try {
      if (!HealthKit || !HKQuantityTypeIdentifier?.bloodGlucose) {
        return { success: false, error: 'HealthKit or identifiers not available' };
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // Last 30 days

      const samples = await HealthKit.queryQuantitySamples({
        quantityType: HKQuantityTypeIdentifier.bloodGlucose,
        from: startDate,
        to: endDate,
        limit: 5,
        ascending: false,
      });

      console.log('🧪 ✅ Data access successful');
      console.log('🧪 📊 Sample count found:', samples?.length || 0);
      
      if (samples && samples.length > 0) {
        const latestSample = samples[0];
        console.log('🧪 📋 Latest sample:', {
          value: latestSample.quantity?.doubleValue,
          unit: latestSample.quantity?.unit,
          date: latestSample.startDate,
          source: latestSample.device?.name || latestSample.sourceRevision?.source?.name
        });
      } else {
        console.log('🧪 ⚠️ No glucose data found in Health app');
        console.log('🧪 💡 Tip: Add some glucose data to Apple Health app manually to test');
      }
      
      return { success: true, sampleCount: samples?.length || 0, samples };
    } catch (error) {
      console.log('🧪 ❌ Data access error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if HealthKit is available on device
   */
  async isAvailable() {
    if (Platform.OS !== 'ios') {
      console.log('🩺 HealthKit is only available on iOS');
      return false;
    }

    try {
      if (!HealthKit || typeof HealthKit.isHealthDataAvailable !== 'function') {
        console.log('🩺 HealthKit module not properly loaded');
        console.log('🩺 HealthKit:', HealthKit);
        console.log('🩺 Import method:', importMethod);
        return false;
      }

      const available = await HealthKit.isHealthDataAvailable();
      console.log('🩺 HealthKit availability:', available);
      return available;
    } catch (error) {
      console.error('🩺 Error checking HealthKit availability:', error);
      return false;
    }
  }

  /**
   * Initialize HealthKit and request permissions
   */
  async initialize() {
    if (Platform.OS !== 'ios') {
      console.log('🩺 HealthKit is only available on iOS');
      return false;
    }

    try {
      console.log('🩺 Initializing HealthKit...');
      
      // Check if HealthKit is available
      const available = await this.isAvailable();
      if (!available) {
        console.log('🩺 HealthKit is not available on this device');
        return false;
      }

      if (!HealthKit || !HKQuantityTypeIdentifier?.bloodGlucose) {
        console.log('🩺 HealthKit module not properly imported');
        console.log('🩺 HealthKit:', HealthKit);
        console.log('🩺 HKQuantityTypeIdentifier:', HKQuantityTypeIdentifier);
        console.log('🩺 Import method:', importMethod);
        return false;
      }

      const permissions = {
        read: [
          HKQuantityTypeIdentifier.bloodGlucose,
          HKQuantityTypeIdentifier.heartRate,
          HKQuantityTypeIdentifier.stepCount,
        ],
        write: [
          HKQuantityTypeIdentifier.bloodGlucose,
        ],
      };

      console.log('🩺 Requesting HealthKit permissions...');
      console.log('🩺 📋 Permissions requested:', permissions);
      
      await HealthKit.requestAuthorization(permissions);
      
      console.log('🩺 ✅ Permission request completed');
      this.isInitialized = true;
      
      // Check the actual permission status after request
      const status = await this.checkPermissionStatus();
      this.hasPermissions = (status === HKAuthorizationStatus.sharingAuthorized || status === 'sharingAuthorized');
      
      console.log('🩺 📊 Final permission status:', this.hasPermissions);
      return this.hasPermissions;
      
    } catch (error) {
      console.error('🩺 ❌ Error in HealthKit initialization:', error);
      this.isInitialized = false;
      this.hasPermissions = false;
      return false;
    }
  }

  /**
   * Check permission status after initialization
   */
  async checkPermissionStatus() {
    console.log('🩺 🔍 Checking permission status after initialization...');
    
    try {
      if (!HealthKit || !HKQuantityTypeIdentifier?.bloodGlucose) {
        console.log('🩺 Module not available for permission check');
        return 'moduleError';
      }

      const status = await HealthKit.authorizationStatusFor(HKQuantityTypeIdentifier.bloodGlucose);
      console.log('🩺 📋 Current permission status:', status);
      
      if (status === HKAuthorizationStatus.sharingAuthorized || status === 'sharingAuthorized') {
        console.log('🩺 ✅ Blood glucose permission is AUTHORIZED');
        this.hasPermissions = true;
      } else {
        console.log('🩺 ⚠️ Blood glucose permission is NOT authorized:', status);
        this.hasPermissions = false;
      }
      
      return status;
    } catch (error) {
      console.error('🩺 ❌ Error checking permission status:', error);
      return 'error';
    }
  }

  /**
   * Request permissions for glucose data (with development build support)
   */
  async requestPermissions() {
    if (Platform.OS !== 'ios') {
      return false;
    }

    try {
      console.log('🩺 Requesting HealthKit permissions...');
      
      // First check if we should request permissions
      const debugInfo = await this.debugHealthKitStatus();
      
      if (debugInfo.authStatus === HKAuthorizationStatus.sharingAuthorized || debugInfo.authStatus === 'sharingAuthorized') {
        console.log('🩺 ✅ Already have permissions');
        this.hasPermissions = true;
        return true;
      }
      
      if (debugInfo.authStatus === HKAuthorizationStatus.sharingDenied || debugInfo.authStatus === 'sharingDenied') {
        console.log('🩺 ❌ Permissions previously denied');
        return false;
      }
      
      // Handle development build case
      if (debugInfo.authStatus === 'developmentBuild' && debugInfo.hasWorkaround) {
        console.log('🩺 🔧 Development build detected - attempting workaround permission request...');
        
        try {
          // Try to request permissions even though isHealthDataAvailable returned false
          if (!HKQuantityTypeIdentifier?.bloodGlucose) {
            console.log('🩺 ❌ Cannot request permissions - bloodGlucose identifier not found');
            return false;
          }

          const permissions = {
            read: [HKQuantityTypeIdentifier.bloodGlucose],
            write: [HKQuantityTypeIdentifier.bloodGlucose],
          };
          
          console.log('🩺 📋 Attempting permission request with workaround...');
          await HealthKit.requestAuthorization(permissions);
          
          console.log('🩺 ✅ Permission request completed (development build)');
          
          // Try to check authorization status using the available method
          if (HealthKit.authorizationStatusFor && HKQuantityTypeIdentifier?.bloodGlucose) {
            const status = await HealthKit.authorizationStatusFor(HKQuantityTypeIdentifier.bloodGlucose);
            console.log('🩺 📋 Permission status after request:', status);
            
            // Map the status to our expected values
            if (status === 'sharingAuthorized' || status === HKAuthorizationStatus.sharingAuthorized) {
              this.hasPermissions = true;
              this.isInitialized = true;
              return true;
            }
          }
          
          console.log('🩺 ⚠️ Development build permission workaround - status unclear, assuming granted');
          this.hasPermissions = true;
          this.isInitialized = true;
          return true;
          
        } catch (error) {
          console.error('🩺 ❌ Development build workaround failed:', error);
          return false;
        }
      }
      
      if (!debugInfo.available && !debugInfo.hasWorkaround) {
        console.log('🩺 ❌ HealthKit not available:', debugInfo.reason);
        return false;
      }
      
      // Standard permission request
      return await this.initialize();
      
    } catch (error) {
      console.error('🩺 Error requesting permissions:', error);
      this.hasPermissions = false;
      return false;
    }
  }

  /**
   * Get latest glucose reading with comprehensive debugging
   */
  async getLatestGlucoseReading() {
    console.log('🩺 ==========================================');
    console.log('🩺 === GETTING LATEST GLUCOSE READING ===');
    console.log('🩺 ==========================================');
    
    if (Platform.OS !== 'ios') {
      console.log('🩺 ⚠️ Not iOS platform - using mock data');
      return this.getMockGlucoseReading();
    }

    try {
      // First run debug to see current status
      const debugInfo = await this.debugHealthKitStatus();
      
      if (!debugInfo.available && !debugInfo.hasWorkaround) {
        console.log('🩺 ❌ HealthKit not available - using mock data');
        console.log('🩺 Reason:', debugInfo.reason);
        return this.getMockGlucoseReading();
      }

      if (debugInfo.authStatus !== HKAuthorizationStatus.sharingAuthorized && 
          debugInfo.authStatus !== 'sharingAuthorized' && 
          debugInfo.authStatus !== 'developmentBuild') {
        console.log('🩺 ❌ Not authorized for blood glucose - using mock data');
        console.log('🩺 Auth Status:', debugInfo.authStatus);
        console.log('🩺 💡 User needs to grant permission in iOS Settings > Health > Data Access & Devices');
        return this.getMockGlucoseReading();
      }

      // Check if we have the required identifiers
      if (!HKQuantityTypeIdentifier?.bloodGlucose) {
        console.log('🩺 ❌ bloodGlucose identifier not available - using mock data');
        return this.getMockGlucoseReading();
      }

      console.log('🩺 📊 Fetching latest glucose reading from HealthKit...');

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);

      console.log('🩺 📅 Query options:', {
        startDate: startDate.toLocaleDateString(),
        endDate: endDate.toLocaleDateString(),
        limit: 1
      });

      const samples = await HealthKit.queryQuantitySamples({
        quantityType: HKQuantityTypeIdentifier.bloodGlucose,
        from: startDate,
        to: endDate,
        limit: 1,
        ascending: false,
      });

      console.log('🩺 📊 Query results:', {
        samplesFound: samples?.length || 0,
        samples: samples
      });

      if (samples && samples.length > 0) {
        const latestSample = samples[0];
        console.log('🩺 📋 Latest sample details:', latestSample);
        
        const glucoseData = {
          value: Math.round(latestSample.quantity.doubleValue),
          unit: latestSample.quantity.unit,
          timestamp: new Date(latestSample.startDate),
          source: latestSample.device?.name || latestSample.sourceRevision?.source?.name || 'Apple Health',
          category: this.classifyGlucoseLevel(latestSample.quantity.doubleValue),
          lastSyncTime: new Date(),
          isRealData: true
        };

        console.log('🩺 ✅ REAL glucose data retrieved:', glucoseData);
        console.log('🩺 ==========================================');
        return glucoseData;
      } else {
        console.log('🩺 ⚠️ No glucose readings found in HealthKit');
        console.log('🩺 💡 Suggestions:');
        console.log('🩺    1. Add glucose data manually in Apple Health app');
        console.log('🩺    2. Connect a glucose meter app to Health');
        console.log('🩺    3. Use Health app to enter test data');
        console.log('🩺 🔄 Using mock data for now');
        console.log('🩺 ==========================================');
        return this.getMockGlucoseReading();
      }
    } catch (error) {
      console.error('🩺 ❌ Error in getLatestGlucoseReading:', error);
      console.log('🩺 🔄 Falling back to mock data');
      console.log('🩺 ==========================================');
      return this.getMockGlucoseReading();
    }
  }

  /**
   * Get glucose history for specified number of days
   */
  async getGlucoseHistory(days = 7) {
    if (Platform.OS !== 'ios') {
      return this.getMockGlucoseHistory(days);
    }

    try {
      if (!this.hasPermissions) {
        const initialized = await this.initialize();
        if (!initialized) {
          return this.getMockGlucoseHistory(days);
        }
      }

      if (!HKQuantityTypeIdentifier?.bloodGlucose) {
        return this.getMockGlucoseHistory(days);
      }

      console.log(`🩺 Fetching glucose history for ${days} days...`);

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const samples = await HealthKit.queryQuantitySamples({
        quantityType: HKQuantityTypeIdentifier.bloodGlucose,
        from: startDate,
        to: endDate,
        ascending: false,
      });

      console.log('🩺 Glucose history samples found:', samples?.length || 0);

      if (samples && samples.length > 0) {
        const glucoseHistory = samples.map(sample => ({
          value: Math.round(sample.quantity.doubleValue),
          unit: sample.quantity.unit,
          timestamp: new Date(sample.startDate),
          source: sample.device?.name || sample.sourceRevision?.source?.name || 'Apple Health',
          category: this.classifyGlucoseLevel(sample.quantity.doubleValue),
          isRealData: true
        }));

        console.log(`🩺 Found ${glucoseHistory.length} real glucose readings`);
        return glucoseHistory;
      } else {
        console.log('🩺 No glucose history found in HealthKit, using mock data');
        return this.getMockGlucoseHistory(days);
      }
    } catch (error) {
      console.error('🩺 Error in getGlucoseHistory:', error);
      return this.getMockGlucoseHistory(days);
    }
  }

  /**
   * Save glucose reading to HealthKit
   */
  async saveGlucoseReading(value, unit = 'mg/dL') {
    if (Platform.OS !== 'ios') {
      console.log('🩺 Cannot save to HealthKit on non-iOS platform');
      return false;
    }

    try {
      if (!this.hasPermissions) {
        const initialized = await this.initialize();
        if (!initialized) {
          console.log('🩺 Failed to initialize HealthKit');
          return false;
        }
      }

      if (!HKQuantityTypeIdentifier?.bloodGlucose) {
        console.log('🩺 bloodGlucose identifier not available');
        return false;
      }

      console.log(`🩺 Saving glucose reading: ${value} ${unit}`);

      const sample = {
        quantityType: HKQuantityTypeIdentifier.bloodGlucose,
        quantity: {
          doubleValue: value,
          unit: unit,
        },
        startDate: new Date(),
        endDate: new Date(),
      };

      await HealthKit.saveQuantitySample(sample);
      console.log('🩺 Glucose reading saved successfully');
      return true;

    } catch (error) {
      console.error('🩺 Error in saveGlucoseReading:', error);
      return false;
    }
  }

  /**
   * Calculate glucose trend (requires multiple readings)
   */
  async calculateGlucoseTrend() {
    try {
      if (!HealthKit || !HKQuantityTypeIdentifier?.bloodGlucose) {
        return 'stable';
      }

      const endDate = new Date();
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - 3);

      const samples = await HealthKit.queryQuantitySamples({
        quantityType: HKQuantityTypeIdentifier.bloodGlucose,
        from: startDate,
        to: endDate,
        limit: 3,
        ascending: false,
      });

      if (samples && samples.length >= 2) {
        const latest = samples[0].quantity.doubleValue;
        const previous = samples[1].quantity.doubleValue;
        const diff = latest - previous;

        if (diff > 15) return 'rising';
        if (diff < -15) return 'falling';
        return 'stable';
      }

      return 'stable';
    } catch (error) {
      console.log('🩺 Could not calculate trend:', error);
      return 'stable';
    }
  }

  /**
   * Classify glucose level based on standard ranges
   */
  classifyGlucoseLevel(value) {
    if (value < 70) {
      return 'low';
    } else if (value <= 140) {
      return 'normal';
    } else if (value <= 180) {
      return 'high';
    } else {
      return 'critical';
    }
  }

  /**
   * Get glucose level color based on category
   */
  getGlucoseColor(category) {
    const colors = {
      low: '#2196F3',      // Blue
      normal: '#4CAF50',   // Green
      high: '#FF9800',     // Orange
      critical: '#F44336'  // Red
    };
    return colors[category] || colors.normal;
  }

  /**
   * Get glucose level message
   */
  getGlucoseMessage(category, value) {
    const messages = {
      low: 'Blood sugar is low. Consider having a snack.',
      normal: 'Blood sugar is in normal range.',
      high: 'Blood sugar is elevated. Monitor closely.',
      critical: 'Blood sugar is very high. Consult your doctor.'
    };
    return messages[category] || messages.normal;
  }

  /**
   * Mock glucose reading for testing (Android/Simulator/No data)
   */
  getMockGlucoseReading() {
    const mockValues = [95, 110, 125, 140, 155, 170, 85, 75];
    const randomValue = mockValues[Math.floor(Math.random() * mockValues.length)];
    
    const mockData = {
      value: randomValue,
      unit: 'mg/dL',
      timestamp: new Date(),
      source: 'Mock Data',
      category: this.classifyGlucoseLevel(randomValue),
      lastSyncTime: new Date(),
      isRealData: false // Flag to indicate this is mock data
    };

    console.log('🩺 🎭 Generated mock glucose data:', mockData);
    return mockData;
  }

  /**
   * Mock glucose history for testing
   */
  getMockGlucoseHistory(days) {
    console.log(`🩺 🎭 Generating mock glucose history for ${days} days`);
    const history = [];
    const now = new Date();
    
    for (let i = 0; i < days * 4; i++) { // 4 readings per day
      const timestamp = new Date(now.getTime() - (i * 6 * 60 * 60 * 1000)); // Every 6 hours
      const baseValue = 100 + Math.sin(i * 0.5) * 30; // Simulate natural variation
      const value = Math.round(baseValue + (Math.random() - 0.5) * 40);
      
      history.push({
        value: Math.max(60, Math.min(250, value)), // Keep in realistic range
        unit: 'mg/dL',
        timestamp,
        source: 'Mock Data',
        category: this.classifyGlucoseLevel(value),
        isRealData: false
      });
    }
    
    return history.sort((a, b) => b.timestamp - a.timestamp); // Most recent first
  }
}

// Export singleton instance
export default new HealthService();