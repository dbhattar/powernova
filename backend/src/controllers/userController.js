const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

/**
 * Get user profile with settings
 */
router.get('/profile', async (req, res) => {
  try {
    const { uid } = req.user;
    
    // Get or create user profile
    let userResult = await query(
      'SELECT * FROM users WHERE firebase_uid = $1',
      [uid]
    );
    
    let user;
    if (userResult.rows.length === 0) {
      // Create new user
      const insertResult = await query(
        `INSERT INTO users (firebase_uid, email, display_name, photo_url, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, NOW(), NOW()) 
         RETURNING *`,
        [uid, req.user.email, req.user.name, req.user.picture]
      );
      user = insertResult.rows[0];
    } else {
      user = userResult.rows[0];
      // Update user info if changed
      await query(
        `UPDATE users 
         SET email = $2, display_name = $3, photo_url = $4, updated_at = NOW(), last_login = NOW()
         WHERE firebase_uid = $1`,
        [uid, req.user.email, req.user.name, req.user.picture]
      );
    }
    
    // Get user settings
    const settingsResult = await query(
      'SELECT * FROM user_settings WHERE user_id = $1',
      [user.id]
    );
    
    let settings;
    if (settingsResult.rows.length === 0) {
      // Create default settings
      const defaultSettings = {
        email_notifications: true,
        push_notifications: true,
        marketing_emails: false,
        theme: 'light',
        language: 'en',
        timezone: 'UTC',
        auto_play_voice: true,
        voice_speed: 1.0,
        default_view: 'chat',
        analytics_enabled: true,
        crash_reporting: true,
        custom_settings: {}
      };
      
      const insertSettingsResult = await query(
        `INSERT INTO user_settings (
          user_id, email_notifications, push_notifications, marketing_emails,
          theme, language, timezone, auto_play_voice, voice_speed, default_view,
          analytics_enabled, crash_reporting, custom_settings, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
        RETURNING *`,
        [
          user.id, defaultSettings.email_notifications, defaultSettings.push_notifications,
          defaultSettings.marketing_emails, defaultSettings.theme, defaultSettings.language,
          defaultSettings.timezone, defaultSettings.auto_play_voice, defaultSettings.voice_speed,
          defaultSettings.default_view, defaultSettings.analytics_enabled, defaultSettings.crash_reporting,
          JSON.stringify(defaultSettings.custom_settings)
        ]
      );
      settings = insertSettingsResult.rows[0];
    } else {
      settings = settingsResult.rows[0];
    }
    
    res.json({
      user: {
        id: user.id,
        firebase_uid: user.firebase_uid,
        email: user.email,
        display_name: user.display_name,
        photo_url: user.photo_url,
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_login: user.last_login
      },
      settings: {
        ...settings,
        custom_settings: typeof settings.custom_settings === 'string' 
          ? JSON.parse(settings.custom_settings) 
          : settings.custom_settings
      }
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      error: 'Failed to fetch user profile',
      details: error.message
    });
  }
});

/**
 * Update user settings
 */
router.put('/settings', async (req, res) => {
  try {
    const { uid } = req.user;
    const {
      email_notifications,
      push_notifications,
      marketing_emails,
      theme,
      language,
      timezone,
      auto_play_voice,
      voice_speed,
      default_view,
      analytics_enabled,
      crash_reporting,
      custom_settings
    } = req.body;
    
    // Get user ID
    const userResult = await query(
      'SELECT id FROM users WHERE firebase_uid = $1',
      [uid]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }
    
    const userId = userResult.rows[0].id;
    
    // Update settings
    const updateResult = await query(
      `UPDATE user_settings 
       SET email_notifications = COALESCE($2, email_notifications),
           push_notifications = COALESCE($3, push_notifications),
           marketing_emails = COALESCE($4, marketing_emails),
           theme = COALESCE($5, theme),
           language = COALESCE($6, language),
           timezone = COALESCE($7, timezone),
           auto_play_voice = COALESCE($8, auto_play_voice),
           voice_speed = COALESCE($9, voice_speed),
           default_view = COALESCE($10, default_view),
           analytics_enabled = COALESCE($11, analytics_enabled),
           crash_reporting = COALESCE($12, crash_reporting),
           custom_settings = COALESCE($13, custom_settings),
           updated_at = NOW()
       WHERE user_id = $1
       RETURNING *`,
      [
        userId, email_notifications, push_notifications, marketing_emails,
        theme, language, timezone, auto_play_voice, voice_speed, default_view,
        analytics_enabled, crash_reporting, 
        custom_settings ? JSON.stringify(custom_settings) : null
      ]
    );
    
    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Settings not found'
      });
    }
    
    const settings = updateResult.rows[0];
    
    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: {
        ...settings,
        custom_settings: typeof settings.custom_settings === 'string' 
          ? JSON.parse(settings.custom_settings) 
          : settings.custom_settings
      }
    });
  } catch (error) {
    console.error('Error updating user settings:', error);
    res.status(500).json({
      error: 'Failed to update user settings',
      details: error.message
    });
  }
});

/**
 * Update user profile info
 */
router.put('/profile', async (req, res) => {
  try {
    const { uid } = req.user;
    const { display_name } = req.body;
    
    const updateResult = await query(
      `UPDATE users 
       SET display_name = COALESCE($2, display_name),
           updated_at = NOW()
       WHERE firebase_uid = $1
       RETURNING *`,
      [uid, display_name]
    );
    
    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }
    
    const user = updateResult.rows[0];
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        firebase_uid: user.firebase_uid,
        email: user.email,
        display_name: user.display_name,
        photo_url: user.photo_url,
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_login: user.last_login
      }
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({
      error: 'Failed to update user profile',
      details: error.message
    });
  }
});

/**
 * Delete user account
 */
router.delete('/account', async (req, res) => {
  try {
    const { uid } = req.user;
    
    // Delete user settings first (foreign key constraint)
    await query(
      'DELETE FROM user_settings WHERE user_id = (SELECT id FROM users WHERE firebase_uid = $1)',
      [uid]
    );
    
    // Delete user
    const deleteResult = await query(
      'DELETE FROM users WHERE firebase_uid = $1 RETURNING *',
      [uid]
    );
    
    if (deleteResult.rows.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user account:', error);
    res.status(500).json({
      error: 'Failed to delete user account',
      details: error.message
    });
  }
});

module.exports = router;
