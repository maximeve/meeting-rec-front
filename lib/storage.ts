import { supabase } from './supabase';

export interface RecordingData {
  id?: string;
  title: string;
  audio_url: string;
  transcription: string;
  topics: any[];
  duration: number;
  created_at?: string;
}

export async function uploadRecording(
  audioUri: string,
  title: string,
  transcription: string,
  topics: any[],
  duration: number
) {
  try {
    // Upload audio file to Supabase Storage
    const audioFileName = `recordings/${Date.now()}-${title.replace(/[^a-zA-Z0-9]/g, '_')}.wav`;
    
    const { data: audioData, error: audioError } = await supabase.storage
      .from('recordings')
      .upload(audioFileName, {
        uri: audioUri,
        type: 'audio/wav',
        name: audioFileName,
      } as any);

    if (audioError) {
      throw audioError;
    }

    // Get public URL for the audio file
    const { data: { publicUrl } } = supabase.storage
      .from('recordings')
      .getPublicUrl(audioFileName);

    // Save recording metadata to database
    const { data, error } = await supabase
      .from('recordings')
      .insert({
        title,
        audio_url: publicUrl,
        transcription,
        topics,
        duration,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return { data, error: null };
  } catch (error: any) {
    console.error('Error uploading recording:', error);
    return { data: null, error };
  }
}

export async function getRecordings() {
  try {
    const { data, error } = await supabase
      .from('recordings')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return { data, error: null };
  } catch (error: any) {
    console.error('Error fetching recordings:', error);
    return { data: null, error };
  }
}

export async function deleteRecording(id: string) {
  try {
    const { error } = await supabase
      .from('recordings')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }

    return { error: null };
  } catch (error: any) {
    console.error('Error deleting recording:', error);
    return { error };
  }
}
