const ItemSetupRepository = require('./item-setup.repository');

const createCrudController = (methodPrefix, pluralPrefix) => ({
  create: async (req, res, next) => {
    try {
      const data = req.body;
      if (data.ratePerUnit) data.ratePerUnit = parseFloat(data.ratePerUnit);
      if (data.openingStock) data.openingStock = parseFloat(data.openingStock);
      if (data.alertLevel) data.alertLevel = parseFloat(data.alertLevel);
      
      const result = await ItemSetupRepository[`create${methodPrefix}`](data);
      res.status(201).json(result);
    } catch (error) { next(error); }
  },
  getAll: async (req, res, next) => {
    try {
      const results = await ItemSetupRepository[`get${pluralPrefix}`]();
      res.json(results);
    } catch (error) { next(error); }
  },
  getById: async (req, res, next) => {
    try {
      const result = await ItemSetupRepository[`get${methodPrefix}ById`](req.params.id);
      if (!result) return res.status(404).json({ message: 'Not found' });
      res.json(result);
    } catch (error) { next(error); }
  },
  update: async (req, res, next) => {
    try {
      const data = req.body;
      if (data.ratePerUnit) data.ratePerUnit = parseFloat(data.ratePerUnit);
      if (data.openingStock) data.openingStock = parseFloat(data.openingStock);
      if (data.alertLevel) data.alertLevel = parseFloat(data.alertLevel);

      const result = await ItemSetupRepository[`update${methodPrefix}`](req.params.id, data);
      res.json(result);
    } catch (error) { next(error); }
  },
  delete: async (req, res, next) => {
    try {
      await ItemSetupRepository[`delete${methodPrefix}`](req.params.id);
      res.status(204).send();
    } catch (error) { next(error); }
  }
});

class ItemSetupController {
  constructor() {
    this.RMCategory = createCrudController('RMCategory', 'RMCategories');
    this.RawMaterial = createCrudController('RawMaterial', 'RawMaterials');
    this.NonInventoryItem = createCrudController('NonInventoryItem', 'NonInventoryItems');
    this.ProductCategory = createCrudController('ProductCategory', 'ProductCategories');
    this.Product = createCrudController('Product', 'Products');
  }
}

module.exports = new ItemSetupController();
