import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Video from 'react-native-video';
import { getToken } from '../auth';

const HLS_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function SecureVideo({ contentId, onProgress, onEnd, paused, seekTo, onReadyForDisplay }) {
  const [token, setToken] = useState(null);

  useEffect(() => {
    getToken().then(setToken);
  }, []);

  if (!token) return null;

  const src = `${HLS_URL}/videos/${contentId}/index.m3u8`;

  return (
    <Video
      source={{
        uri: src,
        headers: {
          Authorization: `Bearer ${token}`
        }
      }}
      style={StyleSheet.absoluteFill}
      paused={paused}
      onProgress={onProgress}
      onEnd={onEnd}
      onReadyForDisplay={onReadyForDisplay}
      resizeMode="contain"
      progressUpdateInterval={100}
      controls={false}
      ref={seekTo}
    />
  );
}
