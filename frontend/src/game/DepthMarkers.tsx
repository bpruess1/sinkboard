import { useMemo } from 'react';
import { TextStyle } from 'pixi.js';

interface DepthMarkersProps {
  height: number;
}

const ZONES = [
  { label: 'Surface', y: 0.08 },
  { label: 'Shallows', y: 0.25 },
  { label: 'Twilight Zone', y: 0.45 },
  { label: 'Midnight Zone', y: 0.65 },
  { label: 'The Abyss', y: 0.88 },
];

export function DepthMarkers({ height }: DepthMarkersProps) {
  const style = useMemo(
    () =>
      new TextStyle({
        fontSize: 12,
        fill: 0xffffff,
        fontFamily: 'system-ui',
        fontStyle: 'italic',
      }),
    []
  );

  return (
    <pixiContainer>
      {ZONES.map((zone) => (
        <pixiText
          key={zone.label}
          text={zone.label}
          {...{ style }}
          x={14}
          y={zone.y * height}
          alpha={0.4}
        />
      ))}
    </pixiContainer>
  );
}
