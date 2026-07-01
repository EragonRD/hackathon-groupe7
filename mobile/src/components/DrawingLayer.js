import React, { useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Canvas, Path, Circle, Rect, Skia } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

export default function DrawingLayer({ shapes, currentTool, currentColor, onAddShape, onClear }) {
  const [currentPath, setCurrentPath] = useState(null);
  
  const pan = Gesture.Pan()
    .onStart((e) => {
      if (currentTool !== 'pen') return;
      const { width, height } = Dimensions.get('window'); // Ideally passed via onLayout
      const x = e.x / width;
      const y = e.y / height;
      const p = Skia.Path.Make();
      p.moveTo(e.x, e.y);
      setCurrentPath({ path: p, color: currentColor, points: [{x, y}] });
    })
    .onChange((e) => {
      if (currentTool !== 'pen' || !currentPath) return;
      const { width, height } = Dimensions.get('window');
      const x = e.x / width;
      const y = e.y / height;
      currentPath.path.lineTo(e.x, e.y);
      setCurrentPath({ ...currentPath, points: [...currentPath.points, {x, y}] });
    })
    .onEnd(() => {
      if (currentTool !== 'pen' || !currentPath) return;
      onAddShape({
        tool: 'pen',
        color: currentColor,
        points: currentPath.points
      });
      setCurrentPath(null);
    });

  return (
    <View style={StyleSheet.absoluteFill}>
      <GestureDetector gesture={pan}>
        <View style={StyleSheet.absoluteFill}>
          <Canvas style={StyleSheet.absoluteFill}>
            {shapes.map((s, i) => {
              if (s.tool === 'pen' && s.points) {
                const p = Skia.Path.Make();
                // We'd need the real view dimensions here to map 0..1 to pixels
                // For simplicity assuming full screen width/height for now, but usually needs layout
                const { width, height } = Dimensions.get('window');
                s.points.forEach((pt, j) => {
                  if (j === 0) p.moveTo(pt.x * width, pt.y * height);
                  else p.lineTo(pt.x * width, pt.y * height);
                });
                return <Path key={i} path={p} color={s.color} style="stroke" strokeWidth={3} />;
              }
              return null;
            })}
            {currentPath && (
              <Path path={currentPath.path} color={currentPath.color} style="stroke" strokeWidth={3} />
            )}
          </Canvas>
        </View>
      </GestureDetector>
    </View>
  );
}
