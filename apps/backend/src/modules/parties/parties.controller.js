const PartiesRepository = require('./parties.repository');

class PartiesController {
  async createCustomer(req, res, next) {
    try {
      const { name, phone, email, openingBalance, balanceType, creditLimit, defaultDiscount, customerType, dob, doa, address, note } = req.body;

      if (!name || !phone) {
        return res.status(400).json({ message: 'Name and Phone are required' });
      }

      const customer = await PartiesRepository.createCustomer({
        name,
        contactPerson: name,
        phone,
        email,
        openingBalance: openingBalance ? parseFloat(openingBalance) : 0,
        balanceType: balanceType || 'DEBIT',
        creditLimit: creditLimit ? parseFloat(creditLimit) : 0,
        defaultDiscount: defaultDiscount ? parseFloat(defaultDiscount) : 0,
        customerType: customerType || 'RETAIL',
        dob: dob ? new Date(dob) : null,
        doa: doa ? new Date(doa) : null,
        address,
        note,
        addedBy: req.user.id
      });

      res.status(201).json(customer);
    } catch (error) {
      next(error);
    }
  }

  async getCustomers(req, res, next) {
    try {
      const customers = await PartiesRepository.getAllCustomers();
      res.json(customers);
    } catch (error) {
      next(error);
    }
  }

  async getCustomerById(req, res, next) {
    try {
      const customer = await PartiesRepository.getCustomerById(req.params.id);
      if (!customer) return res.status(404).json({ message: 'Customer not found' });
      res.json(customer);
    } catch (error) {
      next(error);
    }
  }

  async updateCustomer(req, res, next) {
    try {
      const { name, phone, email, openingBalance, balanceType, creditLimit, defaultDiscount, customerType, dob, doa, address, note } = req.body;
      
      const updatedData = {
        name,
        contactPerson: name,
        phone,
        email,
        openingBalance: openingBalance ? parseFloat(openingBalance) : 0,
        balanceType: balanceType || 'DEBIT',
        creditLimit: creditLimit ? parseFloat(creditLimit) : 0,
        defaultDiscount: defaultDiscount ? parseFloat(defaultDiscount) : 0,
        customerType: customerType || 'RETAIL',
        dob: dob ? new Date(dob) : null,
        doa: doa ? new Date(doa) : null,
        address,
        note
      };

      const customer = await PartiesRepository.updateCustomer(req.params.id, updatedData);
      res.json(customer);
    } catch (error) {
      next(error);
    }
  }

  async deleteCustomer(req, res, next) {
    try {
      await PartiesRepository.deleteCustomer(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

  async createSupplier(req, res, next) {
    try {
      const { name, contactPerson, phone, email, openingBalance, balanceType, creditLimit, address, note } = req.body;

      if (!name || !phone) {
        return res.status(400).json({ message: 'Name and Phone are required' });
      }

      const supplier = await PartiesRepository.createSupplier({
        name,
        contactPerson,
        phone,
        email,
        openingBalance: openingBalance ? parseFloat(openingBalance) : 0,
        balanceType: balanceType || 'CREDIT',
        creditLimit: creditLimit ? parseFloat(creditLimit) : 0,
        address,
        note,
        addedBy: req.user.id
      });

      res.status(201).json(supplier);
    } catch (error) {
      next(error);
    }
  }

  async getSuppliers(req, res, next) {
    try {
      const suppliers = await PartiesRepository.getAllSuppliers();
      res.json(suppliers);
    } catch (error) {
      next(error);
    }
  }

  async getSupplierById(req, res, next) {
    try {
      const supplier = await PartiesRepository.getSupplierById(req.params.id);
      if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
      res.json(supplier);
    } catch (error) {
      next(error);
    }
  }

  async updateSupplier(req, res, next) {
    try {
      const { name, contactPerson, phone, email, openingBalance, balanceType, creditLimit, address, note } = req.body;

      const updatedData = {
        name,
        contactPerson,
        phone,
        email,
        openingBalance: openingBalance ? parseFloat(openingBalance) : 0,
        balanceType: balanceType || 'CREDIT',
        creditLimit: creditLimit ? parseFloat(creditLimit) : 0,
        address,
        note
      };

      const supplier = await PartiesRepository.updateSupplier(req.params.id, updatedData);
      res.json(supplier);
    } catch (error) {
      next(error);
    }
  }

  async deleteSupplier(req, res, next) {
    try {
      await PartiesRepository.deleteSupplier(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PartiesController();
