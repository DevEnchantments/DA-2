import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

const FoodProcessingDetails = () => {
  const { novaGroup = null, barcode } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [productData, setProductData] = useState(null);
  const [processingMarkers, setProcessingMarkers] = useState([]);
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
        `https://world.openfoodfacts.org/api/v2/product/${scannedBarcode}`
      );
      const json = await response.json();

      if (json.status === 0 || !json.product) {
        setError('Product not found or data is unavailable.');
      } else {
        setProductData(json.product);
        
        // Extract processing markers
        const markers = [];
        
        // Check for additives
        if (json.product.additives_tags && json.product.additives_tags.length > 0) {
          // Extract additives like E150d
          json.product.additives_tags.forEach(additive => {
            const match = additive.match(/en:e(\d+)([a-z]*)/i);
            if (match) {
              const additiveCode = `E${match[1]}${match[2]}`.toUpperCase();
              const additiveName = json.product.additives_original_tags?.find(tag => 
                tag.includes(match[0]))?.replace('en:', '') || '';
              
              markers.push({
                type: 'additive',
                code: additiveCode,
                name: additiveName
              });
            }
          });
        }
        
        // Check for flavorings
        if (json.product.ingredients) {
          const flavoringIngredients = json.product.ingredients.filter(
            ingredient => ingredient.text && 
            (ingredient.text.toLowerCase().includes('flavour') || 
             ingredient.text.toLowerCase().includes('flavor') ||
             ingredient.text.toLowerCase().includes('aroma'))
          );
          
          if (flavoringIngredients.length > 0) {
            markers.push({
              type: 'ingredient',
              name: 'Flavouring'
            });
          }
        }
        
        setProcessingMarkers(markers);
        
        // Debug information
        setDebugInfo({
          novaGroup: json.product.nova_group || 'Not found',
          additives: json.product.additives_tags?.join(', ') || 'None',
          markersFound: markers.length
        });
      }
    } catch (e) {
      console.error("Failed to fetch product details:", e);
      setError('Failed to load product details. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };
  
  // Determine which local asset to use based on the NOVA group
  let novaGroupImage;
  switch(Number(novaGroup)) {
    case 1:
      novaGroupImage = require('../../assets/images/nova-group-1.png');
      break;
    case 2:
      novaGroupImage = require('../../assets/images/nova-group-2.png');
      break;
    case 3:
      novaGroupImage = require('../../assets/images/nova-group-3.png');
      break;
    case 4:
      novaGroupImage = require('../../assets/images/nova-group-4.png');
      break;
    default:
      novaGroupImage = require('../../assets/images/nova-group-unknown.png');
  }
  
  // Get title based on NOVA group
  const getNovaGroupTitle = () => {
    switch(Number(novaGroup)) {
      case 1:
        return "Unprocessed or minimally processed foods";
      case 2:
        return "Processed culinary ingredients";
      case 3:
        return "Processed foods";
      case 4:
        return "Ultra-processed foods";
      default:
        return "Unknown processing level";
    }
  };
  
  // Get description based on NOVA group
  const getNovaGroupDescription = () => {
    switch(Number(novaGroup)) {
      case 1:
        return "These are natural foods with minimal alteration. They include fresh fruits and vegetables, whole grains, nuts, meats, and milk. These foods may be cleaned, portioned, chilled, frozen, or vacuum-packed, but they remain in their natural state without added ingredients.";
      case 2:
        return "These are ingredients extracted from Group 1 foods or from nature through processes like pressing, refining, or milling. They include oils, butter, sugar, and salt. They're not meant to be consumed alone but are used to prepare, season, and cook Group 1 foods.";
      case 3:
        return "These are relatively simple products made by adding Group 2 ingredients to Group 1 foods. They include canned vegetables, fruits in syrup, cheeses, freshly made breads, and canned fish. They're recognizable as modified versions of their original foods.";
      case 4:
        return "These are industrial formulations containing little or no whole foods and often include additives like colors, flavors, sweeteners, and emulsifiers. They're designed to be convenient, hyper-palatable, and highly profitable. Examples include soft drinks, packaged snacks, reconstituted meat products, and pre-prepared frozen dishes.";
      default:
        return "The processing level of this product could not be determined.";
    }
  };
  
  // Get health advice based on NOVA group
  const getHealthAdvice = () => {
    switch(Number(novaGroup)) {
      case 1:
        return "These foods should form the foundation of a healthy diet. They're nutrient-rich and minimally altered from their natural state.";
      case 2:
        return "Use these ingredients in moderation to prepare, season, and cook Group 1 foods. They enhance flavor but should be used sparingly.";
      case 3:
        return "These can be included in balanced diets but should be consumed in moderation alongside plenty of Group 1 foods.";
      case 4:
        return "Limit ultra-processed foods. Limiting ultra-processed foods reduces the risk of noncommunicable chronic diseases. Research links high consumption with obesity, heart disease, diabetes, and certain cancers.";
      default:
        return "Without knowing the processing level, it's best to focus on whole, minimally processed foods as the foundation of your diet.";
    }
  };
  
  // Get processing markers count text
  const getProcessingMarkersText = () => {
    if (Number(novaGroup) === 4) {
      return `${processingMarkers.length} ultra-processing markers`;
    }
    return "";
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text>Loading Food Processing details...</Text>
      </View>
    );
  }
  
  return (
    <ScrollView style={styles.container}>
      <Stack.Screen options={{ title: `Food Processing (NOVA ${novaGroup || 'Unknown'})` }} />
      
      {/* Header with NOVA group image */}
      <View style={styles.header}>
        <Image 
          source={novaGroupImage} 
          style={styles.novaGroupImage}
          resizeMode="contain"
        />
        <Text style={styles.headerTitle}>{getNovaGroupTitle()}</Text>
        {Number(novaGroup) === 4 && (
          <Text style={styles.headerSubtitle}>{getProcessingMarkersText()}</Text>
        )}
      </View>
      
      {/* Health Advice Section */}
      {Number(novaGroup) === 4 && (
        <View style={styles.warningSection}>
          <Text style={styles.warningTitle}>Limit ultra-processed foods</Text>
          <Text style={styles.warningText}>
            Limiting ultra-processed foods reduces the risk of noncommunicable chronic diseases
          </Text>
        </View>
      )}
      
      {/* Processing Markers Section (for NOVA 4) */}
      {Number(novaGroup) === 4 && processingMarkers.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Elements that indicate the product is in the 4 - Ultra processed food and drink products group:
          </Text>
          
          {processingMarkers.map((marker, index) => (
            <View key={index} style={styles.markerRow}>
              <View style={styles.markerCircle}>
                <Text style={styles.markerArrow}>→</Text>
              </View>
              <Text style={styles.markerText}>
                {marker.type === 'additive' 
                  ? `Additive: ${marker.code}${marker.name ? ` - ${marker.name}` : ''}`
                  : `Ingredient: ${marker.name}`
                }
              </Text>
            </View>
          ))}
        </View>
      )}
      
      {/* Description section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What does this classification mean?</Text>
        <Text style={styles.description}>{getNovaGroupDescription()}</Text>
        <Text style={styles.healthAdvice}>{getHealthAdvice()}</Text>
      </View>
      
      {/* About NOVA Classification */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Food products are classified into 4 groups according to their degree of processing:</Text>
        
        <View style={styles.novaGroupRow}>
          <View style={styles.novaGroupCircle}>
            <Text style={styles.novaGroupNumber}>1</Text>
          </View>
          <Text style={styles.novaGroupText}>
            Unprocessed or minimally processed foods
          </Text>
        </View>
        
        <View style={styles.novaGroupRow}>
          <View style={styles.novaGroupCircle}>
            <Text style={styles.novaGroupNumber}>2</Text>
          </View>
          <Text style={styles.novaGroupText}>
            Processed culinary ingredients
          </Text>
        </View>
        
        <View style={styles.novaGroupRow}>
          <View style={styles.novaGroupCircle}>
            <Text style={styles.novaGroupNumber}>3</Text>
          </View>
          <Text style={styles.novaGroupText}>
            Processed foods
          </Text>
        </View>
        
        <View style={styles.novaGroupRow}>
          <View style={styles.novaGroupCircle}>
            <Text style={styles.novaGroupNumber}>4</Text>
          </View>
          <Text style={styles.novaGroupText}>
            Ultra-processed foods
          </Text>
        </View>
      </View>
      
      {/* Classification Basis */}
      <View style={styles.section}>
        <Text style={styles.paragraph}>
          The determination of the group is based on the category of the product and on the ingredients it contains.
        </Text>
      </View>
      
      {/* Debug Information (for development only) */}
      {debugInfo && __DEV__ && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>Debug Information:</Text>
          <Text>NOVA Group: {debugInfo.novaGroup}</Text>
          <Text>Additives: {debugInfo.additives}</Text>
          <Text>Processing markers found: {debugInfo.markersFound}</Text>
        </View>
      )}
      
      {/* About NOVA section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About NOVA Classification</Text>
        <Text style={styles.paragraph}>
          The NOVA classification is a food classification system that categorizes foods according to the extent and purpose of industrial processing, rather than in terms of nutrients.
        </Text>
        <Text style={styles.paragraph}>
          This system was developed by researchers at the University of São Paulo, Brazil, and has been recognized by the Food and Agriculture Organization of the United Nations (FAO) and the Pan American Health Organization (PAHO).
        </Text>
      </View>
      
      {/* Health Implications section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Health Implications</Text>
        <Text style={styles.paragraph}>
          Research has shown that diets high in ultra-processed foods (NOVA Group 4) are associated with:
        </Text>
        <View style={styles.bulletPoints}>
          <Text style={styles.bulletPoint}>• Higher risk of obesity and weight gain</Text>
          <Text style={styles.bulletPoint}>• Increased risk of cardiovascular disease</Text>
          <Text style={styles.bulletPoint}>• Higher risk of type 2 diabetes</Text>
          <Text style={styles.bulletPoint}>• Increased risk of certain cancers</Text>
          <Text style={styles.bulletPoint}>• Higher all-cause mortality</Text>
        </View>
        <Text style={styles.paragraph}>
          Conversely, diets rich in unprocessed or minimally processed foods (NOVA Group 1) are associated with better health outcomes and reduced disease risk.
        </Text>
      </View>
      
      {/* Dietary Recommendations */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dietary Recommendations</Text>
        <Text style={styles.paragraph}>
          Based on the NOVA classification, dietary guidelines recommend:
        </Text>
        <View style={styles.bulletPoints}>
          <Text style={styles.bulletPoint}>• Make unprocessed or minimally processed foods the basis of your diet</Text>
          <Text style={styles.bulletPoint}>• Use processed culinary ingredients in moderation to prepare meals</Text>
          <Text style={styles.bulletPoint}>• Limit consumption of processed foods</Text>
          <Text style={styles.bulletPoint}>• Avoid or minimize consumption of ultra-processed foods</Text>
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
  novaGroupImage: {
    width: 100,
    height: 100,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666666',
    marginTop: 5,
  },
  warningSection: {
    backgroundColor: '#000000',
    padding: 20,
    marginVertical: 10,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginBottom: 10,
  },
  warningText: {
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 24,
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
    color: '#333333',
    marginBottom: 15,
  },
  description: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 24,
    marginBottom: 15,
  },
  healthAdvice: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 24,
    fontWeight: '500',
  },
  markerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  markerCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#DDDDDD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  markerArrow: {
    fontSize: 18,
    color: '#333333',
  },
  markerText: {
    fontSize: 16,
    color: '#333333',
    flex: 1,
  },
  novaGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  novaGroupCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#DDDDDD',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  novaGroupNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
  },
  novaGroupText: {
    fontSize: 16,
    color: '#333333',
    flex: 1,
  },
  paragraph: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 24,
    marginBottom: 15,
  },
  bulletPoints: {
    marginLeft: 10,
    marginBottom: 15,
  },
  bulletPoint: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 24,
    marginBottom: 5,
  },
  debugContainer: {
    margin: 15,
    padding: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
});

export default FoodProcessingDetails;
