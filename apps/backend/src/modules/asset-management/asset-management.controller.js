const assetService = require('./asset-management.service');
const prisma = require('../../database/prisma');
const { resendDocument } = require('../../utils/communication');

const emailRateLimiter = {
  limits: new Map(),
  check(userId, id, cooldownHours) {
    const now = Date.now();
    const COOLDOWN_MS = cooldownHours * 60 * 60 * 1000;
    const pqKey = `pq_${id}`;
    if (this.limits.has(pqKey)) {
      const timeSince = now - this.limits.get(pqKey);
      if (timeSince < COOLDOWN_MS) {
        return { allowed: false, remainingMs: COOLDOWN_MS - timeSince };
      }
    }
    const userKey = `user_${userId}_pq_${id}`;
    if (this.limits.has(userKey)) {
      const timeSince = now - this.limits.get(userKey);
      if (timeSince < COOLDOWN_MS) {
        return { allowed: false, remainingMs: COOLDOWN_MS - timeSince };
      }
    }
    return { allowed: true };
  },
  set(userId, id) {
    const now = Date.now();
    this.limits.set(`pq_${id}`, now);
    this.limits.set(`user_${userId}_pq_${id}`, now);
  }
};

class AssetManagementController {
  async getAllBudgets(req, res, next) {
    try {
      const budgets = await assetService.getBudgets();
      res.json(budgets);
    } catch (error) {
      next(error);
    }
  }

  async updateBudget(req, res, next) {
    try {
      const { department, allocated } = req.body;
      const budget = await assetService.updateBudget(department, allocated);
      res.json(budget);
    } catch (error) {
      next(error);
    }
  }

  async getAllPRs(req, res, next) {
    try {
      const prs = await assetService.getPRs();
      res.json(prs);
    } catch (error) {
      next(error);
    }
  }

  async getPRById(req, res, next) {
    try {
      const pr = await assetService.getPRById(req.params.id);
      if (!pr) return res.status(404).json({ error: 'PR not found' });
      res.json(pr);
    } catch (error) {
      next(error);
    }
  }

  async createPR(req, res, next) {
    try {
      const pr = await assetService.createPR(req.body, req.user.id);
      res.status(201).json(pr);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async approvePR(req, res, next) {
    try {
      const pr = await assetService.approvePR(req.params.id, req.user.name);
      res.json(pr);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getAllPQs(req, res, next) {
    try {
      const pqs = await assetService.getPQs();
      res.json(pqs);
    } catch (error) {
      next(error);
    }
  }

  async getPQById(req, res, next) {
    try {
      const pq = await assetService.getPQById(req.params.id);
      if (!pq) return res.status(404).json({ error: 'PQ not found' });
      res.json(pq);
    } catch (error) {
      next(error);
    }
  }

  async createPQ(req, res, next) {
    try {
      const pq = await assetService.createPQ({
        ...req.body,
        actorId: req.user.id,
        actorRole: req.user.role
      });
      res.status(201).json(pq);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async updatePQ(req, res, next) {
    try {
      const pq = await assetService.updatePQ(req.params.id, req.body);
      res.json(pq);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getPQComparison(req, res, next) {
    try {
      const comp = await assetService.getPQComparison(req.params.prNo);
      res.json(comp);
    } catch (error) {
      next(error);
    }
  }

  async getAllPOs(req, res, next) {
    try {
      const pos = await assetService.getPOs();
      res.json(pos);
    } catch (error) {
      next(error);
    }
  }

  async getPOById(req, res, next) {
    try {
      const po = await assetService.getPOById(req.params.id);
      if (!po) return res.status(404).json({ error: 'PO not found' });
      res.json(po);
    } catch (error) {
      next(error);
    }
  }

  async createPO(req, res, next) {
    try {
      const po = await assetService.createPO(req.body, req.user.id);
      res.status(201).json(po);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getAllGRPOs(req, res, next) {
    try {
      const grpos = await assetService.getGRPOs();
      res.json(grpos);
    } catch (error) {
      next(error);
    }
  }

  async createGRPO(req, res, next) {
    try {
      const grpo = await assetService.createGRPO({
        ...req.body,
        actorId: req.user.id,
        actorRole: req.user.role
      });
      res.status(201).json(grpo);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getAllInvoices(req, res, next) {
    try {
      const invoices = await assetService.getInvoices();
      res.json(invoices);
    } catch (error) {
      next(error);
    }
  }

  async createInvoice(req, res, next) {
    try {
      const invoice = await assetService.createAPInvoice({
        ...req.body,
        actorId: req.user.id,
        actorRole: req.user.role
      });
      res.status(201).json(invoice);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async createAsset(req, res, next) {
    try {
      const asset = await assetService.capitalizeManualAsset(req.body, req.user.id, req.user.role);
      res.status(201).json(asset);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getAllAssets(req, res, next) {
    try {
      const assets = await assetService.getAssets();
      res.json(assets);
    } catch (error) {
      next(error);
    }
  }

  async getAssetById(req, res, next) {
    try {
      const asset = await assetService.getAssetById(req.params.id);
      if (!asset) return res.status(404).json({ error: 'Asset not found' });
      res.json(asset);
    } catch (error) {
      next(error);
    }
  }

  async getAssetDepreciation(req, res, next) {
    try {
      const { id } = req.params;
      const { date } = req.query;
      const dep = await assetService.getAssetDepreciation(id, date);
      res.json(dep);
    } catch (error) {
      next(error);
    }
  }

  async decommissionAsset(req, res, next) {
    try {
      const asset = await assetService.decommissionAsset(req.params.id, req.user.id, req.user.role);
      res.json(asset);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async markInvoicePaid(req, res, next) {
    try {
      const { pdfBase64 } = req.body;
      const invoice = await assetService.markInvoicePaid(req.params.id, req.user.id, req.user.role, pdfBase64);
      res.json(invoice);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getReports(req, res, next) {
    try {
      const { type, date } = req.query;
      const rep = await assetService.getReports(type, date);
      res.json(rep);
    } catch (error) {
      next(error);
    }
  }

  async searchAssetMaster(req, res, next) {
    try {
      const { search } = req.query;
      const results = await assetService.searchAssetMaster(search);
      res.json(results);
    } catch (error) {
      next(error);
    }
  }

  async getAiHsnCode(req, res, next) {
    try {
      const { name } = req.query;
      const result = await assetService.getAiHsnCode(name);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async createAssetMaster(req, res, next) {
    try {
      const result = await assetService.createAssetMaster(req.body);
      res.status(201).json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
  async verifyGSTIN(req, res, next) {
    try {
      const result = await assetService.verifyGSTIN(req.params.gstin);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async updatePR(req, res, next) {
    try {
      const result = await assetService.updatePR(req.params.id, req.body);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deletePR(req, res, next) {
    try {
      const result = await assetService.deletePR(req.params.id);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deletePQ(req, res, next) {
    try {
      const result = await assetService.deletePQ(req.params.id);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async updatePO(req, res, next) {
    try {
      const result = await assetService.updatePO(req.params.id, req.body);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deletePO(req, res, next) {
    try {
      const result = await assetService.deletePO(req.params.id);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateGRPO(req, res, next) {
    try {
      const result = await assetService.updateGRPO(req.params.id, req.body);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteGRPO(req, res, next) {
    try {
      const result = await assetService.deleteGRPO(req.params.id);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateInvoice(req, res, next) {
    try {
      const result = await assetService.updateInvoice(req.params.id, req.body);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deleteInvoice(req, res, next) {
    try {
      const result = await assetService.deleteInvoice(req.params.id);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getCommunicationLogs(req, res, next) {
    try {
      const { documentType, documentNo } = req.params;
      const logs = await prisma.communicationLog.findMany({
        where: {
          documentType,
          documentNo
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      res.json(logs);
    } catch (error) {
      next(error);
    }
  }

  async resendCommunication(req, res, next) {
    try {
      const { documentType, documentId, pdfBase64 } = req.body;
      if (!documentType || !documentId) {
        return res.status(400).json({ error: 'documentType and documentId are required' });
      }
      const result = await resendDocument(documentType, documentId, pdfBase64);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async sendQuotationRequests(req, res, next) {
    try {
      const results = await assetService.sendQuotationRequests(req.body, req.user.id);
      res.status(201).json({ success: true, data: results });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getPublicQuotation(req, res, next) {
    try {
      const { pqId, token } = req.params;
      const result = await assetService.getPublicPQ(pqId, token);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async submitPublicQuotation(req, res, next) {
    try {
      const { pqId, token } = req.params;
      const result = await assetService.submitPublicPQ(pqId, token, req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async requestResubmission(req, res, next) {
    try {
      const { pqId, token } = req.params;
      const result = await assetService.requestResubmission(pqId, token);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async resendSupplierLink(req, res, next) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || 'system';
      const checkResult = emailRateLimiter.check(userId, id, 6);

      if (!checkResult.allowed) {
        const remainingMs = checkResult.remainingMs;
        const remainingMins = Math.ceil(remainingMs / (60 * 1000));
        const hours = Math.floor(remainingMins / 60);
        const mins = remainingMins % 60;
        const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        return res.status(429).json({
          success: false,
          error: `Email send rate limit reached. Please wait ${timeStr} before re-sending for this quotation.`
        });
      }

      const result = await assetService.resendSupplierLink(id);
      emailRateLimiter.set(userId, id);
      res.json({ success: true, data: result });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}

module.exports = new AssetManagementController();
