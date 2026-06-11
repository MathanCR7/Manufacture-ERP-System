const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/auth.middleware');
const { search } = require('./search.controller');
const { searchHsn, getChapters } = require('./hsn.controller');

router.use(authMiddleware);
router.get('/', search);
router.get('/hsn', searchHsn);
router.get('/hsn/chapters', getChapters);

module.exports = router;
