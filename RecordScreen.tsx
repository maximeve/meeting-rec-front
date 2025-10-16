import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, ScrollView, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

const API_BASE = 'https://meeting-rec-api.vercel.app'; // ⬅️ your Vercel API base

export default function RecordScreen() {
  const insets = useSafeAreaInsets();

  const [recording, setRecording] = React.useState<Audio.Recording | null>(null);
  const [sound, setSound] = React.useState<Audio.Sound | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [serverResult, setServerResult] = React.useState<any>(null);

  function formatTime(seconds: number | undefined) {
    if (typeof seconds !== 'number' || isNaN(seconds)) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // START: begin opname
  async function start() {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') return Alert.alert('Microfoon nodig', 'Sta microfoontoegang toe.');

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        android: {
          extension: '.wav',
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000
        },
        ios: {
          extension: '.wav',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 128000,
          outputFormat: Audio.IOSOutputFormat.LINEARPCM
        },
        web: {}
      } as any);

      await rec.startAsync();
      setRecording(rec);
      setServerResult(null);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Starten mislukt', String(e?.message || e));
    }
  }

  // STOP: stop opname en upload naar Deepgram via jouw API
  async function stop() {
    if (!recording) return;
    try {
      setIsLoading(true);

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI()!;
      setRecording(null);

      // lokale playback (optioneel)
      const s = new Audio.Sound();
      await s.loadAsync({ uri }, {}, true);
      setSound(s);

      // lees audio als base64 en POST naar jouw Vercel API
      const audioBase64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const resp = await fetch(`${API_BASE}/api/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          mime: 'audio/wav',
          lang: 'auto',     // of 'nl'/'en'/'fr'
          summarize: true   // server gebruikt Deepgram built-in summarizer
        })
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      // Verwacht: { ok, full_text, words, bullets: [{text,start}], summary: { bullets } }
      setServerResult(data);
    } catch (e: any) {
      console.error(e);
      Alert.alert('Stop/Upload mislukt', String(e?.message || e));
    } finally {
      setIsLoading(false);
    }
  }

  async function playFrom(seconds: number) {
    if (!sound) return;
    await sound.setPositionAsync(Math.floor(seconds * 1000));
    await sound.playAsync();
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
        <TouchableOpacity
          onPress={recording ? stop : start}
          style={{ backgroundColor: recording ? '#E53935' : '#1E88E5', padding: 16, borderRadius: 12 }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontSize: 18 }}>
            {recording ? 'Stop & Verwerk' : '🎙️ Start opname'}
          </Text>
        </TouchableOpacity>

        {isLoading && (
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <ActivityIndicator />
            <Text>Transcriberen…</Text>
          </View>
        )}

        {serverResult && (
          <ScrollView
            style={{ flex: 1 }}
            contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'automatic' : 'never'}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 8 }}>Samenvatting</Text>
            {(serverResult.summary?.bullets ?? []).map((s: string, i: number) => (
              <Text key={i}>• {s}</Text>
            ))}

            <Text style={{ fontWeight: '700', fontSize: 18, marginTop: 16 }}>Belangrijke punten (tap om te springen)</Text>
            {(serverResult.bullets ?? []).map((b: any, i: number) => (
              <TouchableOpacity
                key={i}
                onPress={() => b.start != null && playFrom(b.start)}
                style={{ padding: 10, borderWidth: 1, borderColor: '#eee', borderRadius: 8, marginBottom: 8 }}
              >
                <Text>
                  {b.start != null ? `▶️ ${formatTime(b.start)} ` : '• '} {b.text}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
