import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const NutritionFactsDetails = () => {
  const { barcode } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [productData, setProductData] = useState(null);
  const [nutritionFacts, setNutritionFacts] = useState([]);
  const [calculatorValue, setCalculatorValue] = useState('100');
  const [debugInfo, setDebugInfo] = useState(null);
  
  useEffect(() => {
    fetchProductDetails();
  }, [barcode]);
  
  // Fetch product details from API
  const fetchProductDetails = async () => {
    if (!barcode) {
      setError('No barcode provided');
      setLoading(false);
      return;
    }
    
    try {
      // Use the v2 API which includes the knowledge_panels
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}`);
      const data = await response.json();
      
      if (data.status === 1) {
        setProductData(data.product);
        
        const debugSteps = [];
        let processedNutritionFacts = [];
        
        // Extract nutrition facts from knowledge panels
        if (data.product && data.product.knowledge_panels) {
          debugSteps.push("Found knowledge_panels");
          
          // Get the nutrition_facts_table panel
          const nutritionFactsPanel = data.product.knowledge_panels.nutrition_facts_table;
          
          if (nutritionFactsPanel && nutritionFactsPanel.elements && nutritionFactsPanel.elements.length > 0) {
            debugSteps.push("Found nutrition_facts_table panel");
            
            // Get the first element which should be the table
            const tableElement = nutritionFactsPanel.elements[0];
            
            if (tableElement.element_type === 'table' && tableElement.table_element) {
              debugSteps.push("Found table element");
              
              // Process rows to extract nutrition facts
              const rows = tableElement.table_element.rows;
              if (rows && rows.length > 0) {
                debugSteps.push(`Found ${rows.length} rows`);
                
                rows.forEach((row, index) => {
                  if (row.values && row.values.length >= 2) {
                    const nutrientName = row.values[0].text;
                    const nutrientValue = row.values[1].text;
                    
                    debugSteps.push(`Row ${index}: ${nutrientName}, value: ${nutrientValue}`);
                    
                    processedNutritionFacts.push({
                      nutrient: nutrientName,
                      value: nutrientValue
                    });
                  } else {
                    debugSteps.push(`Row ${index}: Incomplete data, values length: ${row.values ? row.values.length : 0}`);
                  }
                });
              } else {
                debugSteps.push("No rows found in table element");
              }
            } else {
              debugSteps.push("First element is not a table element");
            }
          } else {
            debugSteps.push("No nutrition_facts_table panel found");
          }
        } else {
          debugSteps.push("No knowledge_panels found in product data");
        }
        
        // If no nutrition facts found, try to extract from nutriments
        if (processedNutritionFacts.length === 0 && data.product.nutriments) {
          debugSteps.push("Falling back to nutriments data");
          
          const nutriments = data.product.nutriments;
          
          // Common nutrient mappings
          const nutrientMappings = [
            { key: 'energy-kcal', name: 'Energy', unit: 'kcal' },
            { key: 'fat', name: 'Fat', unit: 'g' },
            { key: 'saturated-fat', name: 'Saturated fat', unit: 'g' },
            { key: 'carbohydrates', name: 'Carbohydrates', unit: 'g' },
            { key: 'sugars', name: 'Sugars', unit: 'g' },
            { key: 'fiber', name: 'Fiber', unit: 'g' },
            { key: 'proteins', name: 'Proteins', unit: 'g' },
            { key: 'salt', name: 'Salt', unit: 'g' }
          ];
          
          for (const mapping of nutrientMappings) {
            if (nutriments[mapping.key] !== undefined) {
              processedNutritionFacts.push({
                nutrient: mapping.name,
                value: `${nutriments[mapping.key]} ${mapping.unit}`
              });
            }
          }
          
          // Add energy in kJ if available
          if (nutriments['energy-kj'] !== undefined) {
            // Find the energy entry and update it
            const energyIndex = processedNutritionFacts.findIndex(item => item.nutrient === 'Energy');
            if (energyIndex !== -1) {
              processedNutritionFacts[energyIndex].value = 
                `${nutriments['energy-kj']} kj\n(${nutriments['energy-kcal']} kcal)`;
            }
          }
        }
        
        // Log the processed nutrition facts for debugging
        console.log('Processed nutrition facts:', JSON.stringify(processedNutritionFacts));
        
        setNutritionFacts(processedNutritionFacts);
        setDebugInfo({
          steps: debugSteps,
          factsFound: processedNutritionFacts.length
        });
      } else {
        setError('Product not found');
      }
    } catch (e) {
      console.error("Failed to fetch product details:", e);
      setError('Failed to load product details. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };
  
  // Dummy function for calculator
  const handleCalculate = () => {
    // This is a dummy function that would be implemented later
    console.log(`Calculate nutrition for ${calculatorValue}g`);
  };
  
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading nutrition facts...</Text>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Nutrition facts',
          headerStyle: { backgroundColor: '#ffffff' }, 
          headerTintColor: '#333333' 
        }} 
      />
      
      {/* Product name subtitle */}
      {productData && (
        <View style={styles.productNameContainer}>
          <Text style={styles.productName}>{productData.product_name}</Text>
        </View>
      )}
      
      {/* Main content */}
      <View style={styles.mainContent}>
        {/* Header with icon */}
        <View style={styles.header}>
          <Ionicons name="scale-outline" size={24} color="#ffffff" />
          <Text style={styles.headerTitle}>Nutrition facts</Text>
        </View>
        
        {/* Nutrition facts table */}
        <View style={styles.tableContainer}>
          {/* Table header - White with dark text */}
          <View style={styles.tableHeader}>
            <View style={styles.nutrientColumn}>
              <Text style={styles.tableHeaderText}>Nutrition facts</Text>
            </View>
            <View style={styles.valueColumn}>
              <Text style={styles.tableHeaderText}>100g</Text>
            </View>
          </View>
          
          {/* Table rows */}
          {nutritionFacts && nutritionFacts.length > 0 ? (
            nutritionFacts.map((item, index) => (
              <View key={index} style={styles.tableRow}>
                <View style={styles.nutrientColumn}>
                  <Text style={styles.nutrientText}>{item.nutrient}</Text>
                </View>
                <View style={styles.valueColumn}>
                  <Text style={styles.valueText}>{item.value}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>
                {error || 'No nutrition facts data available for this product.'}
              </Text>
            </View>
          )}
        </View>
      </View>
      
      {/* Calculator section */}
      <View style={styles.calculatorContainer}>
        <View style={styles.calculatorHeader}>
          <Ionicons name="calculator-outline" size={24} color="#333333" />
          <Text style={styles.calculatorTitle}>
            Calculate nutrition facts for a specific quantity
          </Text>
        </View>
        
        <View style={styles.calculatorContent}>
          <View style={styles.calculatorInputContainer}>
            <TextInput
              style={styles.calculatorInput}
              value={calculatorValue}
              onChangeText={setCalculatorValue}
              keyboardType="numeric"
            />
            <Text style={styles.calculatorUnit}>g</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.calculateButton}
            onPress={handleCalculate}
          >
            <Text style={styles.calculateButtonText}>Calculate</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Debug Information (only in development) */}
      {debugInfo && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>Debug Information:</Text>
          <Text>Detection steps: {debugInfo.steps?.join(', ')}</Text>
          <Text>Nutrition facts found: {debugInfo.factsFound}</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  productNameContainer: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  productName: {
    fontSize: 16,
    color: '#333333',
  },
  mainContent: {
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#4CAF50',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginLeft: 10,
  },
  tableContainer: {
    backgroundColor: '#ffffff',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tableHeaderText: {
    color: '#333333',
    fontWeight: 'bold',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    padding: 12,
    backgroundColor: '#ffffff',
  },
  nutrientColumn: {
    flex: 2,
  },
  valueColumn: {
    flex: 1,
    alignItems: 'flex-start',
  },
  nutrientText: {
    color: '#333333',
  },
  valueText: {
    color: '#333333',
  },
  noDataContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  noDataText: {
    color: '#999999',
    textAlign: 'center',
  },
  calculatorContainer: {
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: 0,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  calculatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  calculatorTitle: {
    fontSize: 16,
    color: '#333333',
    marginLeft: 10,
    flex: 1,
  },
  calculatorContent: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  calculatorInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    flex: 1,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  calculatorInput: {
    color: '#333333',
    padding: 8,
    flex: 1,
  },
  calculatorUnit: {
    color: '#333333',
    marginLeft: 4,
  },
  calculateButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  calculateButtonText: {
    color: '#ffffff',
    fontWeight: 'bold',
  },
  debugContainer: {
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    margin: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  debugTitle: {
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 5,
  }
});

export default NutritionFactsDetails;
