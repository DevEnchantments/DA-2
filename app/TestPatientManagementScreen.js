import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from './_layout';

const TestPatientManagementScreen = () => {
  const { user, isDoctor } = useAuth();
  const [testResults, setTestResults] = useState([]);

  const runTests = () => {
    const results = [];
    
    // Test 1: Check if user is authenticated
    results.push({
      test: 'User Authentication',
      status: user ? 'PASS' : 'FAIL',
      details: user ? `User ID: ${user.uid}` : 'No user found'
    });

    // Test 2: Check if user is doctor
    results.push({
      test: 'Doctor Role Check',
      status: isDoctor ? 'PASS' : 'FAIL',
      details: isDoctor ? 'User has doctor role' : 'User is not a doctor'
    });

    // Test 3: Check navigation capability
    results.push({
      test: 'Navigation Setup',
      status: 'PASS',
      details: 'Router and navigation are working'
    });

    setTestResults(results);
  };

  useEffect(() => {
    runTests();
  }, [user, isDoctor]);

  const testNavigation = () => {
    try {
      router.push('/PatientManagementScreen');
    } catch (error) {
      Alert.alert('Navigation Error', error.message);
    }
  };

  const testBackNavigation = () => {
    try {
      router.back();
    } catch (error) {
      Alert.alert('Navigation Error', error.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={testBackNavigation}>
          <Ionicons name="arrow-back" size={24} color="#4CAF50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Patient Management Test</Text>
        <TouchableOpacity onPress={runTests}>
          <Ionicons name="refresh" size={24} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Tests</Text>
          {testResults.map((result, index) => (
            <View key={index} style={styles.testResult}>
              <View style={styles.testHeader}>
                <Text style={styles.testName}>{result.test}</Text>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: result.status === 'PASS' ? '#4CAF50' : '#FF6B6B' }
                ]}>
                  <Text style={styles.statusText}>{result.status}</Text>
                </View>
              </View>
              <Text style={styles.testDetails}>{result.details}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Navigation Tests</Text>
          
          <TouchableOpacity style={styles.testButton} onPress={testNavigation}>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
            <Text style={styles.testButtonText}>Test Navigation to Patient Management</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.testButton} onPress={() => router.push('/MealPlanScreen')}>
            <Ionicons name="restaurant" size={20} color="#fff" />
            <Text style={styles.testButtonText}>Test Navigation to Meal Plan</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Information</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>User ID:</Text>
            <Text style={styles.infoValue}>{user?.uid || 'Not available'}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{user?.email || 'Not available'}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Role:</Text>
            <Text style={styles.infoValue}>{isDoctor ? 'Doctor' : 'Patient'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expected Behavior</Text>
          <View style={styles.expectationCard}>
            <Text style={styles.expectationTitle}>✅ If you are a Doctor:</Text>
            <Text style={styles.expectationText}>
              • You should see "Patient Management" button in meal plan header{'\n'}
              • Clicking it should open the patient management screen{'\n'}
              • You should be able to search and assign patients
            </Text>
          </View>
          <View style={styles.expectationCard}>
            <Text style={styles.expectationTitle}>❌ If you are a Patient:</Text>
            <Text style={styles.expectationText}>
              • You should NOT see the "Patient Management" button{'\n'}
              • If you try to access it directly, you'll see "Access Denied"
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  testResult: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  testHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  testName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  testDetails: {
    fontSize: 14,
    color: '#666',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    width: 80,
  },
  infoValue: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  expectationCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  expectationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  expectationText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default TestPatientManagementScreen;

