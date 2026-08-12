import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

function SampleButton() {
  return <button type="button">Click me</button>;
}

describe('testing-library wiring', () => {
  it('renders and handles a click', async () => {
    const user = userEvent.setup();
    render(<SampleButton />);
    await user.click(screen.getByRole('button', { name: 'Click me' }));
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
