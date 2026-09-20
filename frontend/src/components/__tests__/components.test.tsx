import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import LayerControl from '../LayerControl';
import CasePanel from '../CasePanel';

describe('LayerControl component', () => {
  it('renders layer options and toggles them', () => {
    const onToggle = vi.fn();
    const onOpacity = vi.fn();
    render(
      <LayerControl
        layers={{ districts: true, crime: false, infra: false }}
        opacity={0.7}
        onToggle={onToggle}
        onOpacity={onOpacity}
      />
    );

    expect(screen.getByText(/Map Layers/i)).toBeInTheDocument();
    expect(screen.getByText(/District Boundaries/i)).toBeInTheDocument();
    expect(screen.getByText(/Crime Registrations/i)).toBeInTheDocument();
    expect(screen.getByText(/Infrastructure/i)).toBeInTheDocument();

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(3);
    fireEvent.click(checkboxes[1]);
    expect(onToggle).toHaveBeenCalledWith('crime');
  });

  it('handles opacity slider changes', () => {
    const onToggle = vi.fn();
    const onOpacity = vi.fn();
    render(
      <LayerControl
        layers={{ districts: true, crime: false, infra: false }}
        opacity={0.5}
        onToggle={onToggle}
        onOpacity={onOpacity}
      />
    );

    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '0.85' } });
    expect(onOpacity).toHaveBeenCalledWith(0.85);
  });
});

describe('CasePanel component', () => {
  it('renders search input and responds to user input', async () => {
    (globalThis as any).fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ cases: [], count: 0 }),
    });

    render(<CasePanel />);
    const input = screen.getByPlaceholderText(/Search cases/i);
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'Maharashtra' } });
    expect(input).toHaveValue('Maharashtra');
  });
});
