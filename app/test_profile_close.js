/**
 * Test Profile Screen Close Functionality
 * 
 * This script tests that the profile screen can be properly closed
 * in all states (loading, error, and success).
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ProfileScreen from './screens/ProfileScreen';

// Mock the dependencies
jest.mock('./firebase', () => ({
  auth: {
    signOut: jest.fn(),
  },
}));

jest.mock('./components', () => ({
  ProfilePicture: ({ user }) => <div testID="profile-picture">{user?.email || 'No user'}</div>,
}));

// Mock fetch to simulate different scenarios
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('ProfileScreen Close Functionality', () => {
  const mockUser = {
    getIdToken: jest.fn().mockResolvedValue('mock-token'),
    email: 'test@example.com',
  };

  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('can close profile screen during loading state', async () => {
    // Mock a slow response to keep it in loading state
    mockFetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

    const { getByTestId } = render(
      <ProfileScreen user={mockUser} onClose={mockOnClose} />
    );

    // Should be in loading state
    expect(getByTestId('profile-close-button')).toBeTruthy();
    expect(getByTestId('profile-done-button')).toBeTruthy();

    // Test close button
    fireEvent.press(getByTestId('profile-close-button'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('can close profile screen during error state', async () => {
    // Mock a 404 error
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    const { getByTestId } = render(
      <ProfileScreen user={mockUser} onClose={mockOnClose} />
    );

    // Wait for error state
    await waitFor(() => {
      expect(getByTestId('profile-close-button')).toBeTruthy();
      expect(getByTestId('profile-done-button')).toBeTruthy();
    });

    // Test close button in error state
    fireEvent.press(getByTestId('profile-close-button'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('can close profile screen during success state', async () => {
    // Mock successful response
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        user: {
          id: 1,
          email: 'test@example.com',
          display_name: 'Test User',
          created_at: '2023-01-01T00:00:00Z',
        },
        settings: {
          email_notifications: true,
          push_notifications: true,
          marketing_emails: false,
          theme: 'light',
          auto_play_voice: true,
          voice_speed: 1.0,
          analytics_enabled: true,
          crash_reporting: true,
        },
      }),
    });

    const { getByTestId } = render(
      <ProfileScreen user={mockUser} onClose={mockOnClose} />
    );

    // Wait for success state
    await waitFor(() => {
      expect(getByTestId('profile-close-button')).toBeTruthy();
      expect(getByTestId('profile-done-button')).toBeTruthy();
    });

    // Test close button in success state
    fireEvent.press(getByTestId('profile-close-button'));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test('handles hardware back button', async () => {
    const { BackHandler } = require('react-native');
    const mockBackHandler = jest.fn();
    BackHandler.addEventListener = jest.fn((event, callback) => {
      mockBackHandler.mockImplementation(callback);
      return { remove: jest.fn() };
    });

    render(<ProfileScreen user={mockUser} onClose={mockOnClose} />);

    // Simulate hardware back button press
    const shouldPreventDefault = mockBackHandler();
    expect(shouldPreventDefault).toBe(true);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
