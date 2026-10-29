const jwt = require('jsonwebtoken');
const axios = require('axios');
const prisma = require('../../database/prisma');
const env = require('../../config/env');

const BASE_URL = 'http://localhost:5000/api/production/standard';
const JWT_SECRET = env.JWT_SECRET || 'secret';

function createToken(userId, role, username) {
  return jwt.sign(
    { id: userId, username, role, name: username },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Standard Production Batches API Integration', () => {
  let adminHeaders;
  let staffHeaders;
  let masterUser;
  let batchId;
  let mouldsRes;

  beforeAll(async () => {
    masterUser = await prisma.user.findFirst({ where: { role: 'MAIN_MASTER' } }) || await prisma.user.findFirst();
    const staffUser = await prisma.user.findFirst({ where: { role: 'PRODUCTION_STAFF' } }) || masterUser;

    const adminToken = createToken(masterUser.id, 'MAIN_MASTER', masterUser.username);
    const staffToken = createToken(staffUser.id, 'PRODUCTION_STAFF', staffUser.username);

    adminHeaders = { Authorization: `Bearer ${adminToken}` };
    staffHeaders = { Authorization: `Bearer ${staffToken}` };
  });

  it('1. GET /moulds returns active verified moulds', async () => {
    mouldsRes = await axios.get(`${BASE_URL}/moulds`, { headers: adminHeaders });
    expect(mouldsRes.status).toBe(200);
    expect(mouldsRes.data.success).toBe(true);
    expect(mouldsRes.data.moulds.length).toBeGreaterThanOrEqual(6);
  });

  it('2. GET /raw-materials-catalog returns materials with live DB UOMs and batches', async () => {
    const res = await axios.get(`${BASE_URL}/raw-materials-catalog`, { headers: adminHeaders });
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(Array.isArray(res.data.data)).toBe(true);
    if (res.data.data.length > 0) {
      const first = res.data.data[0];
      expect(first).toHaveProperty('unitId');
      expect(first).toHaveProperty('density_g_per_ml');
      expect(first).toHaveProperty('currentStock');
    }
  });

  it('3. GET /products-catalog returns products with base category and stock', async () => {
    const res = await axios.get(`${BASE_URL}/products-catalog`, { headers: adminHeaders });
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(Array.isArray(res.data.data)).toBe(true);
  });

  it('4. POST / creates draft batch', async () => {
    const createRes = await axios.post(`${BASE_URL}`, {
      shift: 'Morning',
      quantity: 2000,
      totalPlannedQty: 2000,
      note: 'Jest Integration Test Draft'
    }, { headers: adminHeaders });

    expect(createRes.status).toBe(201);
    expect(createRes.data.success).toBe(true);
    batchId = createRes.data.id;
    expect(batchId).toBeDefined();
  });

  it('5. POST /:id/start validates mandatory fields and starts production', async () => {
    // Missing fields validation
    try {
      await axios.post(`${BASE_URL}/${batchId}/start`, {}, { headers: adminHeaders });
      throw new Error('Should have failed with 422');
    } catch (err) {
      expect(err.response?.status).toBe(422);
      expect(err.response?.data?.missingFields?.length).toBeGreaterThan(0);
    }

    // Lookup base and template
    const base = await prisma.baseMaster.findFirst() || { id: '00000000-0000-0000-0000-000000000001' };
    const template = await prisma.productionTemplate.findFirst() || { id: '00000000-0000-0000-0000-000000000002' };

    await axios.put(`${BASE_URL}/${batchId}/draft`, {
      startDate: new Date().toISOString().split('T')[0],
      shift: 'Morning',
      baseId: base.id,
      templateId: template.id
    }, { headers: adminHeaders });

    const startRes = await axios.post(`${BASE_URL}/${batchId}/start`, {}, { headers: adminHeaders });
    expect(startRes.status).toBe(200);
    expect(startRes.data.batch?.status).toBe('In Progress');
  });

  it('6. PUT /:id/process executes merge and evaporation (Reference test values)', async () => {
    const processRes = await axios.put(`${BASE_URL}/${batchId}/process`, {
      mergeStage: 'Before freezing',
      evaporationPct: 5.0,
      lines: [
        { rawMaterialName: 'Milk', uom: 'l', density: 1.0, requiredQty: 100, takenQty: 100, evaporates: true, merged: true },
        { rawMaterialName: 'Sugar', uom: 'kg', density: 1.0, requiredQty: 20, takenQty: 20, evaporates: false, merged: true },
        { rawMaterialName: 'SMP', uom: 'kg', density: 1.0, requiredQty: 8, takenQty: 8, evaporates: true, merged: true },
        { rawMaterialName: 'Stabilizer', uom: 'kg', density: 1.0, requiredQty: 0.5, takenQty: 0.5, evaporates: true, merged: true },
        { rawMaterialName: 'Essence', uom: 'l', density: 1.0, requiredQty: 0.2, takenQty: 0.2, evaporates: true, merged: true }
      ]
    }, { headers: adminHeaders });

    expect(processRes.status).toBe(200);
    const data = processRes.data.data;
    expect(data.totalBeforeEvapMl).toBe(128700);
    expect(data.evaporatedMl).toBe(5435);
    expect(data.mixAfterEvapMl).toBe(123265);
  });

  it('7. PUT /:id/allocations runs sequential finished product allocations', async () => {
    const mouldSG = mouldsRes.data.moulds.find(m => m.mould_code === 'IM-0001');
    const mouldSB = mouldsRes.data.moulds.find(m => m.mould_code === 'IM-0004');
    const product = await prisma.finishedProduct.findFirst();

    const allocRes = await axios.put(`${BASE_URL}/${batchId}/allocations`, {
      allocations: [
        {
          seq: 1,
          productId: product?.id,
          useMould: true,
          mouldId: mouldSG?.id,
          capacityMl: 50,
          cavities: 50,
          trays: 40,
          wasteMode: 'PERCENT',
          wasteValue: 2.0
        },
        {
          seq: 2,
          productId: product?.id,
          useMould: true,
          mouldId: mouldSB?.id,
          capacityMl: 60,
          cavities: 30,
          trays: 12,
          wasteMode: 'PERCENT',
          wasteValue: 3.0
        }
      ]
    }, { headers: adminHeaders });

    expect(allocRes.status).toBe(200);
    const allocs = allocRes.data.data.allocations;
    expect(allocs[0].goodPieces).toBe(1960);
    expect(allocs[0].mixLeftAfterThisProduct).toBe(23265);
    expect(allocs[1].goodPieces).toBe(349);
    expect(allocs[1].mixLeftAfterThisProduct).toBe(1665);
  });

  it('8. GET /:id role-protected costing breakdown and live DB UOMs', async () => {
    const adminDetailRes = await axios.get(`${BASE_URL}/${batchId}`, { headers: adminHeaders });
    expect(adminDetailRes.status).toBe(200);
    expect(adminDetailRes.data.costingSummary).not.toBeNull();
    expect(adminDetailRes.data.costingHidden).toBe(false);

    const staffDetailRes = await axios.get(`${BASE_URL}/${batchId}`, { headers: staffHeaders });
    expect(staffDetailRes.status).toBe(200);
    expect(staffDetailRes.data.costingSummary).toBeNull();
    expect(staffDetailRes.data.costingHidden).toBe(true);
  });
});
