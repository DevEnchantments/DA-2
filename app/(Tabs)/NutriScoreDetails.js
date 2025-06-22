import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

const NutriScoreDetails = () => {
  const { grade = 'unknown', barcode } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scoreData, setScoreData] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  
  useEffect(() => {
    if (barcode) {
      fetchProductDetails(barcode);
    } else {
      setLoading(false);
    }
  }, [barcode]);
  
  const fetchProductDetails = async (scannedBarcode) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${scannedBarcode}?fields=knowledge_panels`
      );
      const json = await response.json();

      if (json.status === 0 || !json.product) {
        setError('Product not found or data is unavailable.');
      } else {
        // Extract score calculation data
        const panels = json.product.knowledge_panels || {};
        
        // Find all Nutri-Score component panels
        const negativeComponentPanels = {};
        const positiveComponentPanels = {};
        
        // Debug information
        const allPanelKeys = Object.keys(panels);
        const nutriscoreComponentKeys = allPanelKeys.filter(key => key.startsWith('nutriscore_component_'));
        
        // Categorize components into negative and positive
        nutriscoreComponentKeys.forEach(key => {
          const panel = panels[key];
          if (!panel || !panel.title_element || !panel.title_element.subtitle) return;
          
          // Extract component name from key (e.g., "nutriscore_component_energy" -> "energy")
          const componentName = key.replace('nutriscore_component_', '');
          
          // Extract points from subtitle format like "3/10 points (176kJ)"
          const subtitle = panel.title_element.subtitle;
          const match = subtitle.match(/(\d+)\/(\d+)\s+points\s+\(([^)]+)\)/);
          
          if (match) {
            const componentData = {
              points: parseInt(match[1], 10),
              total: parseInt(match[2], 10),
              value: match[3],
              // Store original panel title to use as display name
              displayName: panel.title || componentName.charAt(0).toUpperCase() + componentName.slice(1).replace(/_/g, ' ')
            };
            
            // Categorize as negative or positive component based on common knowledge
            if (['energy', 'sugars', 'saturated_fat', 'salt', 'non_nutritive_sweeteners'].includes(componentName)) {
              negativeComponentPanels[componentName] = componentData;
            } else if (['proteins', 'fiber', 'fruits_vegetables_legumes'].includes(componentName)) {
              positiveComponentPanels[componentName] = componentData;
            } else {
              // For any new or unknown components, check if they're in a negative or positive group
              // This is a fallback for future API changes
              if (key.includes('negative') || componentName.includes('negative')) {
                negativeComponentPanels[componentName] = componentData;
              } else if (key.includes('positive') || componentName.includes('positive')) {
                positiveComponentPanels[componentName] = componentData;
              } else {
                // Default to negative if we can't determine (most Nutri-Score components are negative)
                negativeComponentPanels[componentName] = componentData;
              }
            }
          }
        });
        
        // Calculate totals
        let negativePoints = 0;
        let totalNegativePoints = 0;
        Object.values(negativeComponentPanels).forEach(component => {
          negativePoints += component.points || 0;
          totalNegativePoints += component.total || 0;
        });
        
        let positivePoints = 0;
        let totalPositivePoints = 0;
        Object.values(positiveComponentPanels).forEach(component => {
          positivePoints += component.points || 0;
          totalPositivePoints += component.total || 0;
        });
        
        setScoreData({
          negativeComponents: {
            total: `${negativePoints}/${totalNegativePoints}`,
            components: negativeComponentPanels
          },
          positiveComponents: {
            total: `${positivePoints}/${totalPositivePoints}`,
            components: positiveComponentPanels
          }
        });
        
        setDebugInfo({
          allPanels: allPanelKeys.join(', '),
          nutriscoreComponents: nutriscoreComponentKeys.join(', '),
          negativeComponentsFound: Object.keys(negativeComponentPanels).length,
          positiveComponentsFound: Object.keys(positiveComponentPanels).length
        });
      }
    } catch (e) {
      console.error("Failed to fetch product details:", e);
      setError('Failed to load product details. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };
  
  // Determine which local asset to use based on the grade
  let nutriScoreImage;
  switch(grade.toLowerCase()) {
    case 'a':
      nutriScoreImage = require('../../assets/images/nutriscore_a.png');
      break;
    case 'b':
      nutriScoreImage = require('../../assets/images/nutriscore_b.png');
      break;
    case 'c':
      nutriScoreImage = require('../../assets/images/nutriscore_c.png');
      break;
    case 'd':
      nutriScoreImage = require('../../assets/images/nutriscore_d.png');
      break;
    case 'e':
      nutriScoreImage = require('../../assets/images/nutriscore_e.png');
      break;
    default:
      nutriScoreImage = require('../../assets/images/nutriscore_unknown.png');
  }
  
  // Get description based on grade
  const getGradeDescription = () => {
    switch(grade.toLowerCase()) {
      case 'a':
        return "Excellent nutritional quality. This product is high in nutrients and fiber, low in saturated fat, sugar, and salt.";
      case 'b':
        return "Good nutritional quality. This product has a good balance of nutrients, though not as optimal as grade A products.";
      case 'c':
        return "Average nutritional quality. This product has a fair balance of nutrients but may be higher in certain elements like sugar, salt, or fat.";
      case 'd':
        return "Below average nutritional quality. This product is likely high in sugar, salt, or fat, and lower in beneficial nutrients.";
      case 'e':
        return "Lower nutritional quality. This product is high in sugar, salt, or fat, and low in beneficial nutrients and fiber.";
      default:
        return "The nutritional quality of this product could not be determined.";
    }
  };
  
  // Render point indicators (colored squares) with multi-row support
  const renderPointIndicators = (points, total, color) => {
    const indicators = [];
    
    // Convert points and total to numbers if they're strings
    const pointsNum = typeof points === 'string' ? parseInt(points, 10) : points;
    const totalNum = typeof total === 'string' ? parseInt(total, 10) : total;
    
    // Maximum squares per row
    const maxPerRow = 10;
    
    // Calculate how many rows we need
    const rows = Math.ceil(totalNum / maxPerRow);
    
    // Create rows of indicators
    for (let row = 0; row < rows; row++) {
      const rowIndicators = [];
      const startIdx = row * maxPerRow;
      const endIdx = Math.min(startIdx + maxPerRow, totalNum);
      
      for (let i = startIdx; i < endIdx; i++) {
        rowIndicators.push(
          <View 
            key={i} 
            style={[
              styles.pointIndicator, 
              { backgroundColor: i < pointsNum ? color : '#e0e0e0' }
            ]}
          />
        );
      }
      
      indicators.push(
        <View key={`row-${row}`} style={styles.pointIndicatorsRow}>
          {rowIndicators}
        </View>
      );
    }
    
    return (
      <View style={styles.pointIndicatorsContainer}>
        {indicators}
      </View>
    );
  };
  
  // Render a component row in the calculation card
  const renderComponentRow = (label, points, total, value, color) => {
    return (
      <View style={styles.componentRow}>
        <View style={styles.componentIndicators}>
          {renderPointIndicators(points, total, color)}
        </View>
        <View style={styles.componentInfo}>
          <Text style={styles.componentLabel}>{label}</Text>
          <Text style={styles.componentPoints}>
            {points}/{total} points ({value})
          </Text>
        </View>
      </View>
    );
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text>Loading Nutri-Score details...</Text>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: `Nutri-Score ${grade.toUpperCase()}` }} />
      
      {/* Header with Nutri-Score image */}
      <View style={styles.header}>
        <Image 
          source={nutriScoreImage} 
          style={styles.nutriScoreImage}
          resizeMode="contain"
        />
        <Text style={styles.headerTitle}>Nutri-Score {grade.toUpperCase()}</Text>
      </View>
      
      {/* Description section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What does this score mean?</Text>
        <Text style={styles.description}>{getGradeDescription()}</Text>
      </View>
      
      {/* Score Calculation Card */}
      {scoreData && (
        <>
          {/* Negative Points Section */}
          <View style={styles.calculationCard}>
            <View style={styles.calculationHeader}>
              <Text style={styles.calculationHeaderText}>
                Negative points: {scoreData.negativeComponents.total}
              </Text>
            </View>
            
            {/* Dynamically render all available negative components */}
            {Object.entries(scoreData.negativeComponents.components).map(([key, component]) => (
              <View key={key}>
                {renderComponentRow(
                  component.displayName,
                  component.points,
                  component.total,
                  component.value,
                  '#FF5252' // Red color for negative components
                )}
              </View>
            ))}
            
            {/* Show message if no negative components found */}
            {Object.keys(scoreData.negativeComponents.components).length === 0 && (
              <View style={styles.noComponentsMessage}>
                <Text style={styles.noComponentsText}>
                  No negative component details available for this product.
                </Text>
              </View>
            )}
          </View>
          
          {/* Positive Points Section */}
          <View style={styles.calculationCard}>
            <View style={styles.calculationHeader}>
              <Text style={styles.calculationHeaderText}>
                Positive points: {scoreData.positiveComponents.total}
              </Text>
            </View>
            
            {/* Dynamically render all available positive components */}
            {Object.entries(scoreData.positiveComponents.components).map(([key, component]) => (
              <View key={key}>
                {renderComponentRow(
                  component.displayName,
                  component.points,
                  component.total,
                  component.value,
                  '#4CAF50' // Green color for positive components
                )}
              </View>
            ))}
            
            {/* Show message if no positive components found */}
            {Object.keys(scoreData.positiveComponents.components).length === 0 && (
              <View style={styles.noComponentsMessage}>
                <Text style={styles.noComponentsText}>
                  No positive component details available for this product.
                </Text>
              </View>
            )}
          </View>
        </>
      )}
      
      {error && (
        <View style={styles.errorSection}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorSubtext}>
            Score calculation details could not be loaded.
          </Text>
        </View>
      )}
      
      {/* Debug Information (for development only) */}
      {debugInfo && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>Debug Information:</Text>
          <Text>Negative components found: {debugInfo.negativeComponentsFound}</Text>
          <Text>Positive components found: {debugInfo.positiveComponentsFound}</Text>
        </View>
      )}
      
      {/* About Nutri-Score section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About Nutri-Score</Text>
        <Text style={styles.paragraph}>
          Nutri-Score is a nutrition label that converts the nutritional value of products into a simple code consisting of 5 letters, each with its own color.
        </Text>
        <Text style={styles.paragraph}>
          The score ranges from A (dark green) to E (dark orange/red), with A being the most nutritionally favorable option and E being the least.
        </Text>
      </View>
      
      {/* How it's calculated section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How it's calculated</Text>
        <Text style={styles.paragraph}>
          Nutri-Score is calculated by assessing both negative and positive aspects of the food:
        </Text>
        <View style={styles.bulletPoints}>
          <Text style={styles.bulletPoint}>• Negative points: energy, sugars, saturated fatty acids, and sodium</Text>
          <Text style={styles.bulletPoint}>• Positive points: protein, fiber, fruits, vegetables, legumes, and nuts</Text>
        </View>
        <Text style={styles.paragraph}>
          The final score is determined by subtracting the positive points from the negative points, resulting in a grade from A to E.
        </Text>
      </View>
      
      {/* New calculation note */}
      <View style={styles.noteSection}>
        <Text style={styles.noteTitle}>New Calculation Method</Text>
        <Text style={styles.paragraph}>
          The Nutri-Score calculation was updated in 2023 to better reflect nutritional science. The new method:
        </Text>
        <View style={styles.bulletPoints}>
          <Text style={styles.bulletPoint}>• Gives better scores to fatty fish and oils rich in unsaturated fats</Text>
          <Text style={styles.bulletPoint}>• Rewards whole grain products rich in fiber</Text>
          <Text style={styles.bulletPoint}>• Penalizes products high in salt or sugar more severely</Text>
          <Text style={styles.bulletPoint}>• Differentiates between red meat and poultry</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    backgroundColor: '#ffffff',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eeeeee',
  },
  nutriScoreImage: {
    width: 200,
    height: 100,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
  },
  section: {
    backgroundColor: '#ffffff',
    padding: 20,
    marginVertical: 10,
    marginHorizontal: 15,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333333',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#555555',
  },
  calculationCard: {
    backgroundColor: '#ffffff',
    marginVertical: 10,
    marginHorizontal: 15,
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  calculationHeader: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  calculationHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  componentRow: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  componentIndicators: {
    flex: 1,
    marginRight: 10,
  },
  componentInfo: {
    flex: 2,
  },
  componentLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 5,
  },
  componentPoints: {
    fontSize: 14,
    color: '#666666',
  },
  pointIndicatorsContainer: {
    flexDirection: 'column',
  },
  pointIndicatorsRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  pointIndicator: {
    width: 10,
    height: 10,
    borderRadius: 2,
    marginRight: 2,
  },
  errorSection: {
    backgroundColor: '#fff0f0',
    padding: 20,
    margin: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  errorSubtext: {
    color: '#666666',
    textAlign: 'center',
  },
  noComponentsMessage: {
    padding: 15,
    alignItems: 'center',
  },
  noComponentsText: {
    color: '#999999',
    fontStyle: 'italic',
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    color: '#555555',
    marginBottom: 10,
  },
  bulletPoints: {
    marginVertical: 10,
    paddingLeft: 10,
  },
  bulletPoint: {
    fontSize: 16,
    lineHeight: 24,
    color: '#555555',
    marginBottom: 5,
  },
  noteSection: {
    backgroundColor: '#f9f9e0',
    padding: 20,
    margin: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffd54f',
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333333',
  },
  debugContainer: {
    padding: 15,
    backgroundColor: '#f0f0ff',
    borderRadius: 8,
    margin: 15,
  },
  debugTitle: {
    fontWeight: 'bold',
    marginBottom: 5,
  }
});

export default NutriScoreDetails;
