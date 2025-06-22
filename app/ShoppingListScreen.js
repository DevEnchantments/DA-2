import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';

const ShoppingItem = ({ item, isChecked, onToggle, onEdit, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedAmount, setEditedAmount] = useState(item.amount?.toString() || '1');
  const [editedUnit, setEditedUnit] = useState(item.unit || '');

  const handleSaveEdit = () => {
    onEdit(item, {
      ...item,
      amount: parseFloat(editedAmount) || 1,
      unit: editedUnit
    });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedAmount(item.amount?.toString() || '1');
    setEditedUnit(item.unit || '');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <View style={styles.editingItem}>
        <View style={styles.editingContent}>
          <Text style={styles.editingItemName}>{item.name}</Text>
          <View style={styles.editingInputs}>
            <TextInput
              style={styles.editingInput}
              value={editedAmount}
              onChangeText={setEditedAmount}
              keyboardType="numeric"
              placeholder="Amount"
            />
            <TextInput
              style={styles.editingInput}
              value={editedUnit}
              onChangeText={setEditedUnit}
              placeholder="Unit"
            />
          </View>
        </View>
        <View style={styles.editingActions}>
          <TouchableOpacity onPress={handleSaveEdit} style={styles.saveButton}>
            <Ionicons name="checkmark" size={20} color="#4CAF50" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCancelEdit} style={styles.cancelButton}>
            <Ionicons name="close" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity 
      style={[styles.shoppingItem, isChecked && styles.shoppingItemChecked]} 
      onPress={onToggle}
    >
      <View style={styles.itemLeft}>
        <TouchableOpacity onPress={onToggle} style={styles.checkbox}>
          <Ionicons 
            name={isChecked ? "checkbox" : "square-outline"} 
            size={24} 
            color={isChecked ? "#4CAF50" : "#666"} 
          />
        </TouchableOpacity>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemName, isChecked && styles.itemNameChecked]}>
            {item.name}
          </Text>
          <Text style={[styles.itemDetails, isChecked && styles.itemDetailsChecked]}>
            {item.amount} {item.unit}
          </Text>
        </View>
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.actionButton}>
          <Ionicons name="pencil" size={16} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onDelete(item)} style={styles.actionButton}>
          <Ionicons name="trash-outline" size={16} color="#d32f2f" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const CategorySection = ({ title, items, checkedItems, onToggleItem, onEditItem, onDeleteItem, icon }) => {
  const getCategoryIcon = (category) => {
    switch (category.toLowerCase()) {
      case 'produce': return '🥬';
      case 'dairy': return '🥛';
      case 'meat': return '🥩';
      case 'pantry': return '🏺';
      default: return '🛒';
    }
  };

  if (items.length === 0) return null;

  return (
    <View style={styles.categorySection}>
      <View style={styles.categoryHeader}>
        <Text style={styles.categoryTitle}>
          {getCategoryIcon(title)} {title.charAt(0).toUpperCase() + title.slice(1)}
        </Text>
        <Text style={styles.categoryCount}>
          {items.filter(item => checkedItems[`${title}-${item.name}`]).length}/{items.length}
        </Text>
      </View>
      {items.map((item, index) => (
        <ShoppingItem
          key={`${title}-${item.name}-${index}`}
          item={item}
          isChecked={checkedItems[`${title}-${item.name}`] || false}
          onToggle={() => onToggleItem(title, item)}
          onEdit={(oldItem, newItem) => onEditItem(title, oldItem, newItem)}
          onDelete={(item) => onDeleteItem(title, item)}
        />
      ))}
    </View>
  );
};

const AddItemModal = ({ visible, onClose, onAdd, categories }) => {
  const [itemName, setItemName] = useState('');
  const [itemAmount, setItemAmount] = useState('1');
  const [itemUnit, setItemUnit] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('other');

  const handleAdd = () => {
    if (!itemName.trim()) {
      Alert.alert('Error', 'Please enter an item name.');
      return;
    }

    const newItem = {
      name: itemName.trim(),
      amount: parseFloat(itemAmount) || 1,
      unit: itemUnit.trim(),
      original: `${itemAmount} ${itemUnit} ${itemName}`.trim()
    };

    onAdd(selectedCategory, newItem);
    
    // Reset form
    setItemName('');
    setItemAmount('1');
    setItemUnit('');
    setSelectedCategory('other');
    onClose();
  };

  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Add Item</Text>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>
        
        <View style={styles.modalForm}>
          <Text style={styles.formLabel}>Item Name</Text>
          <TextInput
            style={styles.formInput}
            value={itemName}
            onChangeText={setItemName}
            placeholder="Enter item name"
            autoFocus
          />
          
          <View style={styles.formRow}>
            <View style={styles.formColumn}>
              <Text style={styles.formLabel}>Amount</Text>
              <TextInput
                style={styles.formInput}
                value={itemAmount}
                onChangeText={setItemAmount}
                placeholder="1"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.formColumn}>
              <Text style={styles.formLabel}>Unit</Text>
              <TextInput
                style={styles.formInput}
                value={itemUnit}
                onChangeText={setItemUnit}
                placeholder="cups, lbs, etc."
              />
            </View>
          </View>
          
          <Text style={styles.formLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categorySelector}>
            {categories.map(category => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryOption,
                  selectedCategory === category && styles.categoryOptionSelected
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text style={[
                  styles.categoryOptionText,
                  selectedCategory === category && styles.categoryOptionTextSelected
                ]}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        
        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.cancelModalButton} onPress={onClose}>
            <Text style={styles.cancelModalButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addModalButton} onPress={handleAdd}>
            <Text style={styles.addModalButtonText}>Add Item</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const ShoppingListScreen = () => {
  const params = useLocalSearchParams();
  const [shoppingList, setShoppingList] = useState({
    produce: [],
    dairy: [],
    meat: [],
    pantry: [],
    other: []
  });
  const [checkedItems, setCheckedItems] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    // Parse shopping list from params if provided
    if (params.shoppingList) {
      try {
        const parsedList = JSON.parse(params.shoppingList);
        setShoppingList(parsedList);
      } catch (error) {
        console.error('Error parsing shopping list:', error);
        Alert.alert('Error', 'Failed to load shopping list.');
      }
    }
  }, [params.shoppingList]);

  const handleToggleItem = (category, item) => {
    const key = `${category}-${item.name}`;
    setCheckedItems(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleEditItem = (category, oldItem, newItem) => {
    setShoppingList(prev => ({
      ...prev,
      [category]: prev[category].map(item => 
        item.name === oldItem.name ? newItem : item
      )
    }));
  };

  const handleDeleteItem = (category, item) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to remove "${item.name}" from your shopping list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setShoppingList(prev => ({
              ...prev,
              [category]: prev[category].filter(i => i.name !== item.name)
            }));
            
            // Remove from checked items
            const key = `${category}-${item.name}`;
            setCheckedItems(prev => {
              const newChecked = { ...prev };
              delete newChecked[key];
              return newChecked;
            });
          }
        }
      ]
    );
  };

  const handleAddItem = (category, item) => {
    setShoppingList(prev => ({
      ...prev,
      [category]: [...prev[category], item]
    }));
  };

  const handleClearChecked = () => {
    const checkedCount = Object.values(checkedItems).filter(Boolean).length;
    if (checkedCount === 0) {
      Alert.alert('No Items', 'No checked items to clear.');
      return;
    }

    Alert.alert(
      'Clear Checked Items',
      `Remove ${checkedCount} checked item${checkedCount > 1 ? 's' : ''} from your shopping list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            // Remove checked items from shopping list
            const newShoppingList = { ...shoppingList };
            Object.keys(checkedItems).forEach(key => {
              if (checkedItems[key]) {
                const [category, itemName] = key.split('-');
                newShoppingList[category] = newShoppingList[category].filter(
                  item => item.name !== itemName
                );
              }
            });
            
            setShoppingList(newShoppingList);
            setCheckedItems({});
          }
        }
      ]
    );
  };

  const getTotalItems = () => {
    return Object.values(shoppingList).reduce((total, items) => total + items.length, 0);
  };

  const getCheckedCount = () => {
    return Object.values(checkedItems).filter(Boolean).length;
  };

  const categories = ['produce', 'dairy', 'meat', 'pantry', 'other'];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shopping List</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)}>
          <Ionicons name="add" size={24} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>📝 Shopping Summary</Text>
          <View style={styles.summaryStats}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{getTotalItems()}</Text>
              <Text style={styles.summaryLabel}>Total Items</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{getCheckedCount()}</Text>
              <Text style={styles.summaryLabel}>Completed</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{getTotalItems() - getCheckedCount()}</Text>
              <Text style={styles.summaryLabel}>Remaining</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={() => setShowAddModal(true)}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.addButtonText}>Add Item</Text>
        </TouchableOpacity>
        
        {getCheckedCount() > 0 && (
          <TouchableOpacity 
            style={styles.clearButton} 
            onPress={handleClearChecked}
          >
            <Ionicons name="trash-outline" size={18} color="#d32f2f" />
            <Text style={styles.clearButtonText}>Clear Checked</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Shopping List */}
      {getTotalItems() === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="basket-outline" size={64} color="#ccc" />
          <Text style={styles.emptyTitle}>No Items Yet</Text>
          <Text style={styles.emptySubtitle}>
            Add items to your shopping list or generate one from a meal plan!
          </Text>
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addButtonText}>Add First Item</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {categories.map(category => (
            <CategorySection
              key={category}
              title={category}
              items={shoppingList[category]}
              checkedItems={checkedItems}
              onToggleItem={handleToggleItem}
              onEditItem={handleEditItem}
              onDeleteItem={handleDeleteItem}
            />
          ))}
          <View style={styles.bottomPadding} />
        </ScrollView>
      )}

      {/* Add Item Modal */}
      <AddItemModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddItem}
        categories={categories}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  summaryContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  summaryCard: {
    backgroundColor: '#f8f8f8',
    borderRadius: 12,
    padding: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
  },
  actionContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    gap: 12,
  },
  addButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flex: 1,
    gap: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  clearButton: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d32f2f',
    flex: 1,
    gap: 6,
  },
  clearButtonText: {
    color: '#d32f2f',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollContainer: {
    flex: 1,
  },
  categorySection: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  categoryCount: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
  },
  shoppingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8f8f8',
  },
  shoppingItemChecked: {
    opacity: 0.6,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  itemNameChecked: {
    textDecorationLine: 'line-through',
    color: '#999',
  },
  itemDetails: {
    fontSize: 12,
    color: '#666',
  },
  itemDetailsChecked: {
    color: '#999',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    padding: 8,
  },
  editingItem: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    marginVertical: 4,
  },
  editingContent: {
    marginBottom: 12,
  },
  editingItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  editingInputs: {
    flexDirection: 'row',
    gap: 8,
  },
  editingInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#fff',
    fontSize: 14,
  },
  editingActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 6,
    padding: 8,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalForm: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
    marginTop: 12,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#f8f8f8',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formColumn: {
    flex: 1,
  },
  categorySelector: {
    marginTop: 8,
  },
  categoryOption: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  categoryOptionSelected: {
    backgroundColor: '#4CAF50',
  },
  categoryOptionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  categoryOptionTextSelected: {
    color: '#fff',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelModalButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelModalButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  addModalButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addModalButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  bottomPadding: {
    height: 20,
  },
});

export default ShoppingListScreen;