import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const NutrientLevelsDetails = () => {
  const { barcode } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [productData, setProductData] = useState(null);
  const [nutrientLevels, setNutrientLevels] = useState([]);
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
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}`);
      const data = await response.json();
      
      if (data.status === 1) {
        setProductData(data.product);
        
        const debugPanels = [];
        const processedLevels = [];
        
        // Method 1 (PRIORITY): Use the product's nutrient_levels property directly
        // This is the most accurate source and matches the Open Food Facts app
        if (data.product.nutrient_levels) {
          debugPanels.push("Using product.nutrient_levels directly");
          
          // Get nutrient values from nutriments for display
          const nutriments = data.product.nutriments || {};
          
          // Process fat
          if (data.product.nutrient_levels.fat) {
            const level = data.product.nutrient_levels.fat;
            const value = nutriments.fat ? `${nutriments.fat}${nutriments.fat_unit || 'g'}` : '';
            const percentage = nutriments.fat_100g ? `(${nutriments.fat_100g}%)` : '';
            
            processedLevels.push({
              nutrient: 'Fat',
              level: level,
              value: percentage || value
            });
          }
          
          // Process saturated fat
          if (data.product.nutrient_levels['saturated-fat']) {
            const level = data.product.nutrient_levels['saturated-fat'];
            const value = nutriments['saturated-fat'] ? 
              `${nutriments['saturated-fat']}${nutriments['saturated-fat_unit'] || 'g'}` : '';
            const percentage = nutriments['saturated-fat_100g'] ? 
              `(${nutriments['saturated-fat_100g']}%)` : '';
            
            processedLevels.push({
              nutrient: 'Saturated fat',
              level: level,
              value: percentage || value
            });
          }
          
          // Process sugars
          if (data.product.nutrient_levels.sugars) {
            const level = data.product.nutrient_levels.sugars;
            const value = nutriments.sugars ? 
              `${nutriments.sugars}${nutriments.sugars_unit || 'g'}` : '';
            const percentage = nutriments.sugars_100g ? 
              `(${nutriments.sugars_100g}%)` : '';
            
            processedLevels.push({
              nutrient: 'Sugars',
              level: level,
              value: percentage || value
            });
          }
          
          // Process salt
          if (data.product.nutrient_levels.salt) {
            const level = data.product.nutrient_levels.salt;
            const value = nutriments.salt ? 
              `${nutriments.salt}${nutriments.salt_unit || 'g'}` : '';
            const percentage = nutriments.salt_100g ? 
              `(${nutriments.salt_100g}%)` : '';
            
            processedLevels.push({
              nutrient: 'Salt',
              level: level,
              value: percentage || value
            });
          }
        }
        
        // If no nutrient levels found yet, try extracting from knowledge panels
        if (processedLevels.length === 0) {
          debugPanels.push("Trying knowledge panels");
          
          // Extract nutrient levels from knowledge panels
          const panels = data.product.knowledge_panels || {};
          
          // Method 2: Try to find the nutrient_levels panel
          const nutrientLevelsPanel = panels.nutrient_levels;
          
          if (nutrientLevelsPanel) {
            debugPanels.push("Found nutrient_levels panel");
            
            // Process elements in the nutrient_levels panel
            if (nutrientLevelsPanel.elements && nutrientLevelsPanel.elements.length > 0) {
              for (const element of nutrientLevelsPanel.elements) {
                // Method 2.1: Panel groups that contain nutrient panels
                if (element.element_type === 'panel_group' && element.panel_group_element) {
                  const panelGroupElement = element.panel_group_element;
                  debugPanels.push(`Found panel group: ${panelGroupElement.panel_group_id || 'unnamed'}`);
                  
                  if (panelGroupElement.panel_ids && panelGroupElement.panel_ids.length > 0) {
                    for (const panelId of panelGroupElement.panel_ids) {
                      debugPanels.push(`Processing panel from group: ${panelId}`);
                      const panel = panels[panelId];
                      
                      if (panel && panel.title_element) {
                        const title = panel.title_element.title || '';
                        const subtitle = panel.title_element.subtitle || '';
                        
                        // Extract nutrient name, level and value from title/subtitle
                        let nutrientName = '';
                        let level = 'unknown';
                        let value = '';
                        
                        // Extract nutrient name
                        if (title.toLowerCase().includes('fat') && !title.toLowerCase().includes('saturated')) {
                          nutrientName = 'Fat';
                        } else if (title.toLowerCase().includes('saturated fat')) {
                          nutrientName = 'Saturated fat';
                        } else if (title.toLowerCase().includes('sugars')) {
                          nutrientName = 'Sugars';
                        } else if (title.toLowerCase().includes('salt')) {
                          nutrientName = 'Salt';
                        }
                        
                        // Extract level
                        if (subtitle.toLowerCase().includes('low')) {
                          level = 'low';
                        } else if (subtitle.toLowerCase().includes('moderate')) {
                          level = 'moderate';
                        } else if (subtitle.toLowerCase().includes('high')) {
                          level = 'high';
                        } else if (panel.evaluation === 'good') {
                          level = 'low';
                        } else if (panel.evaluation === 'moderate') {
                          level = 'moderate';
                        } else if (panel.evaluation === 'bad') {
                          level = 'high';
                        }
                        
                        // Extract value
                        const valueRegex = /\((.*?)\)/;
                        const valueFromSubtitle = subtitle.match(valueRegex);
                        if (valueFromSubtitle) {
                          value = valueFromSubtitle[1];
                        }
                        
                        if (nutrientName && !processedLevels.some(p => p.nutrient === nutrientName)) {
                          processedLevels.push({
                            nutrient: nutrientName,
                            level: level,
                            value: value
                          });
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
        
        // Method 3: Fallback to nutriments data if still no nutrient levels found
        if (processedLevels.length === 0 && data.product.nutriments) {
          debugPanels.push("Falling back to nutriments data");
          const nutriments = data.product.nutriments;
          
          // Common nutrient mappings
          const nutrientMappings = [
            { key: 'fat', name: 'Fat', unit: 'g' },
            { key: 'saturated-fat', name: 'Saturated fat', unit: 'g' },
            { key: 'sugars', name: 'Sugars', unit: 'g' },
            { key: 'salt', name: 'Salt', unit: 'g' }
          ];
          
          for (const mapping of nutrientMappings) {
            if (nutriments[mapping.key] !== undefined) {
              // Determine level based on official Open Food Facts thresholds
              let level = 'unknown';
              const value = nutriments[mapping.key];
              
              // Official Open Food Facts thresholds
              if (mapping.key === 'fat') {
                level = value < 3 ? 'low' : (value < 20 ? 'moderate' : 'high');
              } else if (mapping.key === 'saturated-fat') {
                level = value < 1.5 ? 'low' : (value < 5 ? 'moderate' : 'high');
              } else if (mapping.key === 'sugars') {
                level = value < 5 ? 'low' : (value < 12.5 ? 'moderate' : 'high');
              } else if (mapping.key === 'salt') {
                level = value < 0.3 ? 'low' : (value < 1.5 ? 'moderate' : 'high');
              }
              
              // Get percentage if available
              const percentage = nutriments[`${mapping.key}_100g`] ? 
                `(${nutriments[`${mapping.key}_100g`]}%)` : '';
              
              processedLevels.push({
                nutrient: mapping.name,
                level: level,
                value: percentage || `${value}${mapping.unit}`
              });
            }
          }
          
          // If we have sodium but not salt, convert sodium to salt
          if (nutriments['sodium'] !== undefined && !processedLevels.some(p => p.nutrient === 'Salt')) {
            const sodiumValue = nutriments['sodium'];
            // Convert sodium to salt (salt = sodium * 2.5)
            const saltValue = sodiumValue * 2.5;
            
            // Determine level based on official Open Food Facts thresholds
            let level = saltValue < 0.3 ? 'low' : (saltValue < 1.5 ? 'moderate' : 'high');
            
            processedLevels.push({
              nutrient: 'Salt',
              level: level,
              value: `${saltValue.toFixed(3)}g`
            });
          }
        }
        
        setNutrientLevels(processedLevels);
        setDebugInfo({
          panels: debugPanels,
          levelsFound: processedLevels.length,
          method: debugPanels[0] || 'No method used'
        });
      }
    } catch (e) {
      console.error("Failed to fetch product details:", e);
      setError('Failed to load product details. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };
  
  // Get color based on nutrient level
  const getLevelColor = (level) => {
    switch(level) {
      case 'low':
        return '#7CFC00'; // Bright green
      case 'moderate':
        return '#FFA500'; // Orange
      case 'high':
        return '#FF0000'; // Red
      default:
        return '#CCCCCC'; // Gray for unknown
    }
  };
  
  // Render a nutrient level item
  const renderNutrientLevelItem = (item, index) => {
    const levelColor = getLevelColor(item.level);
    
    return (
      <TouchableOpacity 
        key={index}
        style={styles.nutrientItem}
        activeOpacity={0.7}
      >
        <View style={styles.nutrientItemContent}>
          {/* Left side - Colored circle indicator */}
          <View style={[styles.levelIndicator, { backgroundColor: levelColor }]} />
          
          {/* Middle - Nutrient level text */}
          <Text style={styles.nutrientText}>
            {item.nutrient} in {item.level} quantity {item.value}
          </Text>
          
          {/* Right side - Chevron icon */}
          <Ionicons name="chevron-forward" size={24} color="#999" />
        </View>
      </TouchableOpacity>
    );
  };
  
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading nutrient levels...</Text>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      <Stack.Screen 
        options={{ 
          title: 'Nutrient levels',
          headerStyle: { backgroundColor: '#ffffff' }, // White background
          headerTintColor: '#333333' // Dark text
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
          <Ionicons name="nutrition-outline" size={24} color="#ffffff" />
          <Text style={styles.headerTitle}>Nutrient levels</Text>
        </View>
        
        {/* Nutrient levels list */}
        <View style={styles.nutrientsList}>
          {nutrientLevels && nutrientLevels.length > 0 ? (
            nutrientLevels.map((item, index) => renderNutrientLevelItem(item, index))
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>
                {error || 'No nutrient levels data available for this product.'}
              </Text>
            </View>
          )}
        </View>
      </View>
      
      {/* Debug Information (only in development) */}
      {debugInfo && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>Debug Information:</Text>
          <Text>Detection method: {debugInfo.method}</Text>
          <Text>Detection steps: {debugInfo.panels.join(', ')}</Text>
          <Text>Nutrient levels found: {debugInfo.levelsFound}</Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5', // Light background instead of dark
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5', // Light background
  },
  productNameContainer: {
    padding: 16,
    backgroundColor: '#ffffff', // White background
  },
  productName: {
    fontSize: 16,
    color: '#333333', // Dark text
  },
  mainContent: {
    backgroundColor: '#ffffff', // White background
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
    backgroundColor: '#4CAF50', // Green header to match Health card
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff', // White text on green
    marginLeft: 10,
  },
  nutrientsList: {
    backgroundColor: '#ffffff', // White background
  },
  nutrientItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0', // Light separator
  },
  nutrientItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  levelIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 16,
  },
  nutrientText: {
    flex: 1,
    fontSize: 16,
    color: '#333333', // Dark text
  },
  noDataContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noDataText: {
    color: '#666666', // Medium gray text
    textAlign: 'center',
  },
  debugContainer: {
    padding: 15,
    backgroundColor: '#f0f0ff',
    borderRadius: 8,
    margin: 16,
  },
  debugTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
  }
});

export default NutrientLevelsDetails;
