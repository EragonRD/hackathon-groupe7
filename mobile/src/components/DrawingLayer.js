// Calque d'annotation. Coordonnées NORMALISÉES 0..1 (contrat commun web/mobile) :
// la surface est mesurée via onLayout, et toute conversion pixel<->normalisé passe
// par cette taille réelle (jamais Dimensions.get('window')).
//
// 7 outils : cursor (navigation + curseur distant), pen, eraser, arrow, rect,
// ellipse, text. Rendu Skia pour les traits/formes, <Text> RN pour les textes.
import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { theme } from '../theme';

const STROKE = 3;

// Construit un Path Skia pour une forme donnée, mappé sur la taille réelle (w,h).
function shapeToPath(s, w, h) {
  const p = Skia.Path.Make();
  if (s.tool === 'pen' && s.points?.length) {
    s.points.forEach((pt, j) => {
      const x = pt.x * w;
      const y = pt.y * h;
      if (j === 0) p.moveTo(x, y);
      else p.lineTo(x, y);
    });
  } else if (s.tool === 'rect' && s.from && s.to) {
    const x = Math.min(s.from.x, s.to.x) * w;
    const y = Math.min(s.from.y, s.to.y) * h;
    p.addRect(Skia.XYWHRect(x, y, Math.abs(s.to.x - s.from.x) * w, Math.abs(s.to.y - s.from.y) * h));
  } else if (s.tool === 'ellipse' && s.from && s.to) {
    const x = Math.min(s.from.x, s.to.x) * w;
    const y = Math.min(s.from.y, s.to.y) * h;
    p.addOval(Skia.XYWHRect(x, y, Math.abs(s.to.x - s.from.x) * w, Math.abs(s.to.y - s.from.y) * h));
  } else if (s.tool === 'arrow' && s.from && s.to) {
    const x1 = s.from.x * w;
    const y1 = s.from.y * h;
    const x2 = s.to.x * w;
    const y2 = s.to.y * h;
    p.moveTo(x1, y1);
    p.lineTo(x2, y2);
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const head = 14;
    p.moveTo(x2, y2);
    p.lineTo(x2 - head * Math.cos(ang - Math.PI / 6), y2 - head * Math.sin(ang - Math.PI / 6));
    p.moveTo(x2, y2);
    p.lineTo(x2 - head * Math.cos(ang + Math.PI / 6), y2 - head * Math.sin(ang + Math.PI / 6));
  }
  return p;
}

export default function DrawingLayer({
  draftShapes = [],
  committedShapes = [],
  tool = 'cursor',
  color = theme.ink.red,
  onCommitShape,
  onEraseAt,
  onRequestText,
  onCursor,
}) {
  const [size, setSize] = useState({ w: 1, h: 1 });
  const [draft, setDraft] = useState(null); // forme en cours (aperçu)

  const norm = (e) => ({ x: clamp01(e.x / size.w), y: clamp01(e.y / size.h) });

  const pan = Gesture.Pan()
    .runOnJS(true)
    .onStart((e) => {
      const pt = norm(e);
      if (onCursor) onCursor(pt.x, pt.y);
      if (tool === 'pen') setDraft({ tool: 'pen', color, points: [pt] });
      else if (tool === 'arrow' || tool === 'rect' || tool === 'ellipse')
        setDraft({ tool, color, from: pt, to: pt });
      else if (tool === 'eraser' && onEraseAt) onEraseAt(pt.x, pt.y);
    })
    .onChange((e) => {
      const pt = norm(e);
      if (onCursor) onCursor(pt.x, pt.y);
      if (!draft) {
        if (tool === 'eraser' && onEraseAt) onEraseAt(pt.x, pt.y);
        return;
      }
      if (draft.tool === 'pen') setDraft({ ...draft, points: [...draft.points, pt] });
      else setDraft({ ...draft, to: pt });
    })
    .onEnd(() => {
      if (draft && onCommitShape) onCommitShape(draft);
      setDraft(null);
    });

  const tap = Gesture.Tap()
    .runOnJS(true)
    .onEnd((e) => {
      const pt = norm(e);
      if (tool === 'text' && onRequestText) onRequestText(pt.x, pt.y);
      else if (tool === 'eraser' && onEraseAt) onEraseAt(pt.x, pt.y);
    });

  const gesture = Gesture.Race(pan, tap);

  const allShapes = [...committedShapes, ...draftShapes];
  const texts = allShapes.filter((s) => s.tool === 'text' && s.at);

  return (
    <View
      style={StyleSheet.absoluteFill}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (width && height) setSize({ w: width, h: height });
      }}
    >
      <GestureDetector gesture={gesture}>
        <View style={StyleSheet.absoluteFill}>
          <Canvas style={StyleSheet.absoluteFill}>
            {allShapes.map((s, i) =>
              s.tool === 'text' ? null : (
                <Path
                  key={i}
                  path={shapeToPath(s, size.w, size.h)}
                  color={s.color}
                  style="stroke"
                  strokeWidth={STROKE}
                  strokeJoin="round"
                  strokeCap="round"
                />
              ),
            )}
            {draft && (
              <Path
                path={shapeToPath(draft, size.w, size.h)}
                color={draft.color}
                style="stroke"
                strokeWidth={STROKE}
                strokeJoin="round"
                strokeCap="round"
              />
            )}
          </Canvas>
          {texts.map((s, i) => (
            <Text
              key={`t${i}`}
              style={[
                styles.inkText,
                { left: s.at.x * size.w, top: s.at.y * size.h, color: s.color },
              ]}
            >
              {s.value}
            </Text>
          ))}
        </View>
      </GestureDetector>
    </View>
  );
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

const styles = StyleSheet.create({
  inkText: { position: 'absolute', fontSize: 15, fontWeight: '600' },
});
