import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import RecordScreen from './RecordScreen'; // of waar jouw screen staat

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <RecordScreen />
    </SafeAreaProvider>
  );
}
