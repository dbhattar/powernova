const express = require('express');
const router = express.Router();

const firebaseService = require('../services/firebaseService');

// POST /api/contact
router.post('/contact', async (req, res) => {
  try {
    const { name, email, message, company } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'All required fields must be filled.' });
    }
    // Save message to Firestore (collection: 'contactMessages')
    await firebaseService.db.collection('contactMessages').add({
      name,
      email,
      company: company || '',
      message,
      createdAt: firebaseService.db.constructor.FieldValue.serverTimestamp ? firebaseService.db.constructor.FieldValue.serverTimestamp() : new Date()
    });
    console.log('Contact form submission saved:', { name, email, company, message });
    return res.status(200).json({ success: true, message: 'Message received.' });
  } catch (err) {
    console.error('Contact form error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
