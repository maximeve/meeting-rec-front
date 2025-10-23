import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Platform, Dimensions, TextInput } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Path, Circle } from 'react-native-svg';
import { RootStackParamList } from './App';

const API_BASE = 'https://meeting-rec-api-git-main-maximeves-projects.vercel.app';

type ReviewScreenRouteProp = RouteProp<RootStackParamList, 'Review'>;
type ReviewScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Review'>;

export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<ReviewScreenNavigationProp>();
  const route = useRoute<ReviewScreenRouteProp>();
  
  // Get props from navigation params
  const { audioUri, audioDuration, serverResult } = route.params || {};
  
  const [sound, setSound] = React.useState<Audio.Sound | null>(null);
  const [audioProgress, setAudioProgress] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [waveformData, setWaveformData] = React.useState<number[]>([]);
  const [recordingTitle, setRecordingTitle] = React.useState('');
  const [showTitleInput, setShowTitleInput] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [currentServerResult, setCurrentServerResult] = React.useState(serverResult);

  // Initialize audio and waveform when component mounts
  React.useEffect(() => {
    initializeAudio();
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [audioUri]);

  async function initializeAudio() {
    try {
      const s = new Audio.Sound();
      await s.loadAsync({ uri: audioUri }, {}, true);
      await s.setIsMutedAsync(false);
      await s.setVolumeAsync(1.0);
      
      setSound(s);
      setAudioProgress(0);
      
      // Generate waveform data
      const waveform = generateWaveformData(audioDuration / 1000);
      setWaveformData(waveform);
    } catch (error) {
      console.error('Failed to initialize audio:', error);
    }
  }

  // Progress tracking effect
  React.useEffect(() => {
    if (!sound || !isPlaying) return;

    const interval = setInterval(async () => {
      if (sound) {
        const status = await sound.getStatusAsync();
        const position = (status as any).positionMillis || 0;
        setAudioProgress(position);
        
        // Check if audio finished
        if ((status as any).didJustFinish) {
          setIsPlaying(false);
          setAudioProgress(0);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [sound, isPlaying]);

  function formatTime(seconds: number | undefined) {
    if (typeof seconds !== 'number' || isNaN(seconds)) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // Generate mock waveform data
  function generateWaveformData(duration: number) {
    const dataPoints = Math.min(100, Math.floor(duration / 0.1));
    const data = [];
    for (let i = 0; i < dataPoints; i++) {
      data.push(Math.random() * 0.8 + 0.1);
    }
    return data;
  }

  // Seek to specific position
  async function seekTo(position: number) {
    if (!sound) return;
    await sound.setPositionAsync(position);
    setAudioProgress(position);
  }

  // Handle waveform touch
  function handleWaveformTouch(event: any) {
    if (!sound || !audioDuration) return;
    
    const screenWidth = Dimensions.get('window').width - 32;
    const touchX = event.nativeEvent.locationX;
    const progress = Math.max(0, Math.min(1, touchX / screenWidth));
    const newPosition = progress * audioDuration;
    
    seekTo(newPosition);
  }

  // Waveform component
  function WaveformComponent() {
    if (waveformData.length === 0) return null;

    const screenWidth = Dimensions.get('window').width - 32;
    const barWidth = screenWidth / waveformData.length;
    const maxHeight = 60;
    const progress = audioDuration > 0 ? audioProgress / audioDuration : 0;

    return (
      <TouchableOpacity 
        style={{ height: 80, justifyContent: 'center', marginVertical: 16 }}
        onPress={handleWaveformTouch}
        activeOpacity={0.7}
      >
        <Svg height={80} width={screenWidth}>
          {waveformData.map((amplitude, index) => {
            const barHeight = amplitude * maxHeight;
            const x = index * barWidth;
            const y = (maxHeight - barHeight) / 2;
            const isPlayed = index / waveformData.length < progress;
            
            return (
              <Path
                key={index}
                d={`M${x} ${y + barHeight} L${x} ${y}`}
                stroke={isPlayed ? '#1E88E5' : '#E0E0E0'}
                strokeWidth={Math.max(1, barWidth * 0.8)}
                strokeLinecap="round"
              />
            );
          })}
          
          {/* Progress indicator */}
          <Circle
            cx={progress * screenWidth}
            cy={maxHeight / 2}
            r={4}
            fill="#1E88E5"
          />
        </Svg>
      </TouchableOpacity>
    );
  }

  async function playFrom(seconds: number) {
    if (!sound) return;
    await sound.setPositionAsync(Math.floor(seconds * 1000));
    await sound.setIsMutedAsync(false);
    await sound.setVolumeAsync(1.0);
    await sound.playAsync();
  }

  async function togglePlayPause() {
    if (!sound) return;
    const status = await sound.getStatusAsync();
    
    if ((status as any).isPlaying) {
      await sound.pauseAsync();
      setIsPlaying(false);
    } else {
      const position = (status as any).positionMillis || 0;
      const duration = (status as any).durationMillis || 0;
      
      if ((status as any).didJustFinish || position >= duration - 100) {
        await sound.setPositionAsync(0);
        setAudioProgress(0);
      }
      await sound.playAsync();
      setIsPlaying(true);
    }
  }

  async function upload() {
    if (!audioUri) return;
    try {
      setIsLoading(true);
      console.log('Starting upload to:', `${API_BASE}/api/transcribe`);
      
      const audioBase64 = await FileSystem.readAsStringAsync(audioUri, { encoding: 'base64' });
      console.log('Audio size:', Math.round(audioBase64.length * 3 / 4 / 1024), 'KB');
      
      const requestBody = { audioBase64, mime: 'audio/wav', lang: 'auto', summarize: true };
      console.log('Request body size:', JSON.stringify(requestBody).length, 'chars');
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      const resp = await fetch(`${API_BASE}/api/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log('Response status:', resp.status, resp.statusText);
      console.log('Response headers:', Object.fromEntries(resp.headers.entries()));
      
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        console.error('Server error response:', text);
        throw new Error(`HTTP ${resp.status}: ${text}`);
      }
      
      const data = await resp.json();
      console.log('Server response:', data);
      
      if (!data?.ok) {
        throw new Error(String(data?.error || 'Transcribe failed'));
      }
      setCurrentServerResult(data);
    } catch (e: any) {
      console.error('Upload error:', e);
      
      let errorMessage = e?.message || e;
      if (e.name === 'AbortError') {
        errorMessage = 'Request timed out after 60 seconds. The server might be overloaded.';
      } else if (e.message?.includes('Network request failed')) {
        errorMessage = 'Network error. Check your internet connection and server URL.';
      }
      
      Alert.alert('Upload Failed', `${errorMessage}\n\nCheck console for details.`);
    } finally {
      setIsLoading(false);
    }
  }

  function handleBack() {
    navigation.goBack();
  }

  function handleSave(title: string) {
    // TODO: Implement save functionality
    Alert.alert('Success', 'Recording saved successfully!');
    handleBack();
  }

  function handleDiscard() {
    handleBack();
  }

  async function handleSaveRecording() {
    if (!recordingTitle.trim()) {
      Alert.alert('Error', 'Please enter a title for your recording');
      return;
    }
    handleSave(recordingTitle);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={['top', 'bottom']}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <View
        style={{
          flex: 1,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingHorizontal: 16,
          gap: 16
        }}
      >
        {/* Header */}
        <View style={{ alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Recording Review</Text>
        </View>

        {/* Waveform at the top */}
        <WaveformComponent />
        
        {/* Time display */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ fontSize: 14, color: '#666' }}>
            {formatTime(audioProgress / 1000)}
          </Text>
          <Text style={{ fontSize: 14, color: '#666' }}>
            {formatTime(audioDuration / 1000)}
          </Text>
        </View>

        {/* Audio controls */}
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <TouchableOpacity onPress={togglePlayPause} style={{ backgroundColor: isPlaying ? '#E53935' : '#1E88E5', padding: 20, borderRadius: 35 }}>
            <Text style={{ color: 'white', fontSize: 24 }}>
              {isPlaying ? '⏸️' : '▶️'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Title input for saving */}
        {showTitleInput && (
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Recording Title</Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: '#ddd',
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                backgroundColor: '#f9f9f9'
              }}
              placeholder="Enter a title for your recording"
              value={recordingTitle}
              onChangeText={setRecordingTitle}
            />
          </View>
        )}

        {/* Action buttons */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {!showTitleInput ? (
            <>
              {!currentServerResult ? (
                <TouchableOpacity onPress={upload} style={{ backgroundColor: '#1E88E5', padding: 12, borderRadius: 10, flex: 1 }}>
                  <Text style={{ color: 'white', textAlign: 'center' }}>Upload to Deepgram</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={() => setShowTitleInput(true)} style={{ backgroundColor: '#4CAF50', padding: 12, borderRadius: 10, flex: 1 }}>
                  <Text style={{ color: 'white', textAlign: 'center' }}>Save Recording</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleDiscard} style={{ backgroundColor: '#9E9E9E', padding: 12, borderRadius: 10, flex: 1 }}>
                <Text style={{ color: 'white', textAlign: 'center' }}>Delete</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={handleSaveRecording} style={{ backgroundColor: '#4CAF50', padding: 12, borderRadius: 10, flex: 1 }}>
                <Text style={{ color: 'white', textAlign: 'center' }}>Save Recording</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowTitleInput(false)} style={{ backgroundColor: '#9E9E9E', padding: 12, borderRadius: 10, flex: 1 }}>
                <Text style={{ color: 'white', textAlign: 'center' }}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {isLoading && (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <ActivityIndicator />
            <Text>Processing…</Text>
          </View>
        )}

        {currentServerResult && (
          <ScrollView
            style={{ flex: 1 }}
            contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'automatic' : 'never'}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {/* Full transcription text */}
            <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 8 }}>Transcription</Text>
            <Text style={{ fontSize: 16, lineHeight: 24, marginBottom: 16, backgroundColor: '#f5f5f5', padding: 12, borderRadius: 8 }}>
              {currentServerResult.full_text || 'No transcription available'}
            </Text>

            {/* Summary bullets */}
            {currentServerResult.summary && currentServerResult.summary.bullets && currentServerResult.summary.bullets.length > 0 && (
              <>
                <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 8 }}>Summary</Text>
                <View style={{ backgroundColor: '#f0f8ff', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                  {currentServerResult.summary.bullets.map((bullet: string, i: number) => (
                    <View key={i} style={{ flexDirection: 'row', marginBottom: 8 }}>
                      <Text style={{ fontSize: 16, color: '#1976d2', marginRight: 8 }}>•</Text>
                      <Text style={{ fontSize: 16, lineHeight: 24, flex: 1 }}>
                        {bullet}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Topics with timestamps */}
            {currentServerResult.topics && currentServerResult.topics.length > 0 && (
              <>
                <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 8 }}>Topics Discussed</Text>
                {currentServerResult.topics.map((topic: any, i: number) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => playFrom(topic.start_time)}
                    style={{ 
                      padding: 12, 
                      borderWidth: 1, 
                      borderColor: '#e0e0e0', 
                      borderRadius: 8, 
                      marginBottom: 8,
                      backgroundColor: '#f9f9f9'
                    }}
                  >
                    <Text style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                      {formatTime(topic.start_time)} - {formatTime(topic.end_time)}
                    </Text>
                    <Text style={{ fontSize: 14, marginBottom: 6 }}>
                      {topic.text}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                      {topic.topics.map((t: any, j: number) => (
                        <View
                          key={j}
                          style={{
                            backgroundColor: '#e3f2fd',
                            padding: 4,
                            borderRadius: 4,
                            marginRight: 4,
                            marginBottom: 4
                          }}
                        >
                          <Text style={{ fontSize: 12, color: '#1976d2' }}>
                            {t.topic}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
