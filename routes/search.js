const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const { authenticate } = require('../middleware/auth');

// Routes
router.get('/global',
  authenticate,
  searchController.globalSearch
);

router.get('/doctors',
  authenticate,
  searchController.searchDoctors
);

module.exports = router;