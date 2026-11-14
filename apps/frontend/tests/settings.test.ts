import { describe, expect, it, beforeEach } from 'vitest';
import {
  profileSchema,
  passwordSchema,
} from '@/components/settings/schemas';
import { useSettingsStore } from '@/store/useSettingsStore';

describe('Settings schemas', () => {
  it('validates a complete profile payload', () => {
    const result = profileSchema.safeParse({
      name: 'Facundo',
      email: 'facundo@example.com',
      age: '28',
      weight: '75.5',
      targetWeight: '72',
      height: '178',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email and out-of-range height', () => {
    const result = profileSchema.safeParse({
      name: 'Facundo',
      email: 'not-an-email',
      age: '',
      weight: '',
      targetWeight: '',
      height: '300',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain('email');
      expect(fields).toContain('height');
    }
  });

  it('validates matching password confirmation', () => {
    const mismatch = passwordSchema.safeParse({
      currentPassword: 'old-password',
      newPassword: 'new-password-123',
      confirmPassword: 'different-password',
    });
    expect(mismatch.success).toBe(false);

    const valid = passwordSchema.safeParse({
      currentPassword: 'old-password',
      newPassword: 'new-password-123',
      confirmPassword: 'new-password-123',
    });
    expect(valid.success).toBe(true);
  });
});

describe('useSettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      notifications: {
        daily: true,
        streak: true,
        achievements: false,
        weekly: false,
      },
      selectedPlan: 'free',
    });
  });

  it('toggles and updates notification preferences', () => {
    useSettingsStore.getState().setNotification('achievements', true);
    expect(useSettingsStore.getState().notifications.achievements).toBe(true);

    useSettingsStore.getState().toggleNotification('daily');
    expect(useSettingsStore.getState().notifications.daily).toBe(false);
  });

  it('updates selected membership plan', () => {
    useSettingsStore.getState().setSelectedPlan('pro');
    expect(useSettingsStore.getState().selectedPlan).toBe('pro');
  });
});
