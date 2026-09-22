#!/usr/bin/env node

/**
 * Standalone CLI Script to Run the Master Forecasting System Prompt
 * 
 * Usage:
 *   node scripts/run_forecasting_prompt.js
 * 
 * With optional Gemini API Key:
 *   $env:GEMINI_API_KEY="your-gemini-key"; node scripts/run_forecasting_prompt.js
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { extractERPPayload } = require('../src/modules/production/forecastDataExtractor');
const forecastAIService = require('../src/modules/production/forecastAIService');
const prisma = require('../src/database/prisma');

async function main() {
  console.log('================================================================');
  console.log('🚀 MANUFACTURING ERP — MASTER FORECASTING PROMPT RUNNER');
  console.log('================================================================');

  try {
    console.log('\n[1/3] Ingesting & Extracting ERP Database Payload (Section 3)...');
    const payload = await extractERPPayload({
      enterpriseName: 'Manufacturing ERP',
      reportingCurrency: 'INR'
    });

    console.log(`  ✓ Finished Products: ${payload.inventoryData.finishedProducts.length}`);
    console.log(`  ✓ Raw Materials:     ${payload.inventoryData.rawMaterials.length}`);
    console.log(`  ✓ Customer Orders:   ${payload.salesAndOrderData.customerOrders.length}`);
    console.log(`  ✓ Purchase Orders:   ${payload.procurementAndVendorData.purchaseOrders.length}`);
    console.log(`  ✓ Production Batches:${payload.productionBatchData.batches.length}`);
    console.log(`  ✓ Active Staff:      ${payload.workforceData.activeUsers.length}`);

    console.log('\n[2/3] Executing Master Forecasting Prompt across all 7 Domains...');
    const startTime = Date.now();
    const result = await forecastAIService.runForecastingPrompt(payload, {
      apiKey: process.env.GEMINI_API_KEY
    });
    const elapsed = Date.now() - startTime;

    console.log(`  ✓ Execution Engine: ${result.source} (${result.model})`);
    console.log(`  ✓ Duration:         ${elapsed}ms`);

    console.log('\n[3/3] Forecast Results Summary:');
    const data = result.data;
    console.log(`  • Horizon:                   ${data.forecastHorizon?.horizonDays} Days (${data.forecastHorizon?.startDate} to ${data.forecastHorizon?.endDate})`);
    console.log(`  • Stock Forecast Items:      ${data.inventoryStockForecast?.length}`);
    console.log(`  • Workload Hours:            ${data.workforceCapacityForecast?.projectedWorkloadHours}h`);
    console.log(`  • Capacity Utilization:      ${data.workforceCapacityForecast?.capacityUtilizationPercent}%`);
    console.log(`  • Projected Net Cash Impact: ₹${data.cashFlowForecast?.netLiquidityImpact}`);
    console.log(`  • Cash Deficit Risk:         ${data.cashFlowForecast?.cashDeficitRisk ? 'YES ⚠️' : 'NO ✅'}`);
    console.log(`  • Vendor Profiles Tracked:   ${data.vendorLeadTimeForecast?.length}`);
    console.log(`  • Projected Sales Return:    ${data.returnsReverseLogisticsForecast?.projectedSalesReturnRatePercent}%`);

    const outputPath = path.resolve(__dirname, '../forecast_output.json');
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`\n💾 Full Section 2 Output JSON written to:\n   ${outputPath}`);

    console.log('\n================================================================');
    console.log('✅ FORECASTING PROMPT EXECUTION COMPLETED SUCCESSFULLY');
    console.log('================================================================');

  } catch (error) {
    console.error('\n❌ Fatal error executing forecasting prompt:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
