import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

test('renders DHIS2 User Manager header', () => {
  render(<App />);
  expect(screen.getByText(/DHIS2 User Manager/i)).toBeInTheDocument();
});

test('toggles between import and export tabs', () => {
  render(<App />);
  const importTab = screen.getByText(/Import Users/i);
  const exportTab = screen.getByText(/Export Users/i);

  expect(importTab).toHaveAttribute('aria-selected', 'true');
  fireEvent.click(exportTab);
  expect(exportTab).toHaveAttribute('aria-selected', 'true');
});

test('displays file upload input', () => {
  render(<App />);
  expect(screen.getByLabelText(/Upload JSON or CSV file/i)).toBeInTheDocument();
});

test('displays filter toggle button on mobile', () => {
  render(<App />);
  expect(screen.getByText(/Show Filters/i)).toBeInTheDocument();
});

test('displays activity log', () => {
  render(<App />);
  expect(screen.getByText(/No activity yet/i)).toBeInTheDocument();
});