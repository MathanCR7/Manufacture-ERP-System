const poService = require('./po.service');

class POController {
  async getAllPOs(req, res, next) {
    try {
      const pos = await poService.getAllPOs();
      res.json(pos);
    } catch (error) {
      next(error);
    }
  }

  async getPOById(req, res, next) {
    try {
      const po = await poService.getPOById(req.params.id);
      if (!po) return res.status(404).json({ error: 'PO not found' });
      res.json(po);
    } catch (error) {
      next(error);
    }
  }

  async createPO(req, res, next) {
    try {
      const newPO = await poService.createPO(req.body, req.user.id);
      res.status(201).json(newPO);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new POController();
