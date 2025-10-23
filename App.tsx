// App.tsx
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import RecordScreen from './RecordScreen';
import ReviewScreen from './ReviewScreen';

export type RootStackParamList = {
  Record: undefined;
  Review: {
    audioUri: string;
    audioDuration: number;
    serverResult: any;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" translucent backgroundColor="transparent" />
        <Stack.Navigator screenOptions={{ headerShown: true }}>
          <Stack.Screen name="Record" component={RecordScreen} options={{ title: 'Record' }} />
          <Stack.Screen name="Review" component={ReviewScreen} options={{ title: 'Review' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
