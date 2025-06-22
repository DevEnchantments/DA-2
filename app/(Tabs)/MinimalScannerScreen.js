import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, Alert, Linking } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

const MinimalScannerScreen = () => {
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    // Request permission when component mounts
    if (permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  const handleBarCodeScanned = ({ type, data }) => {
    console.log('[MinimalScanner] Barcode Scanned! Type:', type, 'Data:', data);
    setScanned(true);
    Alert.alert(
      'Minimal Scan Success!',
      `Type: ${type}\nData: ${data}`,
      [{ text: 'OK', onPress: () => setScanned(false) }]
    );
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text>Loading camera permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Camera permission is required.</Text>
        {permission.canAskAgain ? (
          <Button onPress={requestPermission} title="Grant Permission" />
        ) : (
          <Button onPress={() => Linking.openSettings()} title="Open Settings" />
        )}
      </View>
    );
  }

  // Permission granted, show scanner
  return (
    <View style={styles.scannerContainer}>
      <CameraView
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barCodeTypes: ['qr'], // Only QR codes for this minimal test
        }}
        style={StyleSheet.absoluteFillObject}
      />
      <Text style={styles.scannerHelpText}>Scan QR Code (Minimal Test)</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  scannerContainer: {
    flex: 1,
  },
  permissionText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    marginBottom: 20,
  },
  scannerHelpText: {
    position: 'absolute',
    top: 50,
    alignSelf: 'center',
    color: 'white',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 5,
  },
});

export default MinimalScannerScreen;
