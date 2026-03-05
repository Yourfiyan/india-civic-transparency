interface LayerControlProps {
  layers: { districts: boolean; crime: boolean; infra: boolean };
  opacity: number;
  onToggle: (layer: keyof LayerControlProps['layers']) => void;
  onOpacity: (v: number) => void;
}

export default function LayerControl({
  layers,
  opacity,
  onToggle,
  onOpacity,
}: LayerControlProps) {
  return (
    <div className="layer-control">
      <h4>Map Layers</h4>

      <label>
        <input
          type="checkbox"
          checked={layers.districts}
          onChange={() => onToggle('districts')}
        />
        District Boundaries
      </label>

      <label>
        <input
          type="checkbox"
          checked={layers.crime}
          onChange={() => onToggle('crime')}
        />
        Crime Heatmap
      </label>

      <label>
        <input
          type="checkbox"
          checked={layers.infra}
          onChange={() => onToggle('infra')}
        />
        Infrastructure
      </label>

      <div style={{ marginTop: 8 }}>
        <label style={{ display: 'block', marginBottom: 2 }}>
          Opacity: {Math.round(opacity * 100)}%
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={opacity}
          onChange={(e) => onOpacity(Number(e.target.value))}
        />
      </div>
    </div>
  );
}
