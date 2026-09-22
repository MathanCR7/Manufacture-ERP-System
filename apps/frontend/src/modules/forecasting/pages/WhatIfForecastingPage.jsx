import React, { useState, useEffect } from 'react';
import {
  Sliders, DollarSign, BarChart3, TrendingUp, Zap, RefreshCw
} from 'lucide-react';
import { api } from '@/lib/axios';
import { Card, CardContent } from '@/components/ui/card';
import ForecastingHeader from '../components/ForecastingHeader';
import useForecastingData from '../hooks/useForecastingData';

export default function WhatIfForecastingPage() {
  const {
    horizonPreset,
    setHorizonPreset,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    loading,
    forecastData,
    refetch
  } = useForecastingData('30');

  // What-If Interactive Simulator State
  const [whatIfPrice, setWhatIfPrice] = useState(0); // -20% to +20%
  const [whatIfDemand, setWhatIfDemand] = useState(0); // 0% to +100%
  const [whatIfInflation, setWhatIfInflation] = useState(0); // 0% to +50%
  const [simulatingWhatIf, setSimulatingWhatIf] = useState(false);
  const [customSimulationResult, setCustomSimulationResult] = useState(null);

  // Run dynamic simulation when sliders change
  const runSimulation = async () => {
    setSimulatingWhatIf(true);
    try {
      const res = await api.post('/forecasting/what-if', {
        priceChangePercent: whatIfPrice,
        demandLiftPercent: whatIfDemand,
        rmInflationPercent: whatIfInflation
      });
      setCustomSimulationResult(res.data?.simulation);
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setSimulatingWhatIf(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      runSimulation();
    }, 250);
    return () => clearTimeout(timer);
  }, [whatIfPrice, whatIfDemand, whatIfInflation]);

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 md:p-6 lg:p-8 space-y-6 text-slate-800 dark:text-slate-100">
      
      {/* HEADER & HORIZON BAR */}
      <ForecastingHeader
        title="What-If Sensitivity Sandbox"
        subtitle="Dynamic sensitivity models for pricing elasticity, marketing surges, and raw material inflation"
        icon={Sliders}
        horizonPreset={horizonPreset}
        setHorizonPreset={setHorizonPreset}
        customStart={customStart}
        setCustomStart={setCustomStart}
        customEnd={customEnd}
        setCustomEnd={setCustomEnd}
        onRefresh={refetch}
        loading={loading}
      />

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Baseline Revenue</span>
              <DollarSign className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              ₹{Number(forecastData?.whatIfScenarioForecasts?.baselines?.revenue || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500">
              Current actual order volume
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Simulated Revenue</span>
              <Sliders className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-indigo-600 dark:text-indigo-400">
              ₹{Number(customSimulationResult?.simulatedRevenue || forecastData?.whatIfScenarioForecasts?.baselines?.revenue || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[11px] text-slate-500">
              Live adjusted volume &amp; pricing
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Baseline Gross Margin</span>
              <BarChart3 className="w-4 h-4 text-slate-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {forecastData?.whatIfScenarioForecasts?.baselines?.grossMarginPercent || 0}%
            </div>
            <div className="text-[11px] text-slate-500">
              ₹{Number(forecastData?.whatIfScenarioForecasts?.baselines?.grossProfit || 0).toLocaleString('en-IN')} gross profit
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Simulated Gross Margin</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {customSimulationResult?.grossMarginPercent !== undefined ? customSimulationResult.grossMarginPercent : (forecastData?.whatIfScenarioForecasts?.baselines?.grossMarginPercent || 0)}%
            </div>
            <div className="text-[11px] text-slate-500">
              ₹{Number(customSimulationResult?.grossProfit || forecastData?.whatIfScenarioForecasts?.baselines?.grossProfit || 0).toLocaleString('en-IN')} simulated profit
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-950">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Net Volume Factor</span>
              <Zap className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {customSimulationResult?.netVolumeMultiplier || 1.0}x
            </div>
            <div className="text-[11px] text-slate-500">
              Elasticity &amp; demand lift impact
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CONTENT AREA */}
      {loading ? (
        <Card className="p-12 text-center border-dashed border-2 border-slate-200 dark:border-slate-800">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Initializing Sensitivity Simulator...</p>
          <p className="text-xs text-slate-500 mt-1">Calibrating price elasticity coefficients and COGS baseline metrics...</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Interactive Simulator Sliders */}
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm p-6 bg-gradient-to-br from-indigo-50/40 to-slate-50/40 dark:from-slate-900/90 dark:to-slate-950 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-600" />
                Interactive "What-If" Sensitivity Simulator
              </h3>
              {simulatingWhatIf && (
                <span className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Recalculating...
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Slider 1: Price Variation */}
              <div className="space-y-2 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Selling Price Adjustment</span>
                  <span className="text-indigo-600 font-bold">{whatIfPrice > 0 ? `+${whatIfPrice}%` : `${whatIfPrice}%`}</span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="20"
                  step="1"
                  value={whatIfPrice}
                  onChange={e => setWhatIfPrice(Number(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400">Models demand response via -1.2 price elasticity.</p>
              </div>

              {/* Slider 2: Demand Lift */}
              <div className="space-y-2 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Campaign / Demand Surge</span>
                  <span className="text-emerald-600 font-bold">+{whatIfDemand}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={whatIfDemand}
                  onChange={e => setWhatIfDemand(Number(e.target.value))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400">Marketing campaign & seasonal volume expansion.</p>
              </div>

              {/* Slider 3: RM Inflation */}
              <div className="space-y-2 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Raw Material Inflation</span>
                  <span className="text-rose-600 font-bold">+{whatIfInflation}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="5"
                  value={whatIfInflation}
                  onChange={e => setWhatIfInflation(Number(e.target.value))}
                  className="w-full accent-rose-600 cursor-pointer"
                />
                <p className="text-[11px] text-slate-400">Input material supply cost shock impact on COGS.</p>
              </div>
            </div>

            {/* Simulation Output Cards */}
            {customSimulationResult && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400 font-medium">Simulated Gross Revenue</span>
                  <div className="text-lg font-bold text-slate-900 dark:text-white">
                    ₹{Number(customSimulationResult.simulatedRevenue).toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400 font-medium">Simulated Production Cost</span>
                  <div className="text-lg font-bold text-slate-900 dark:text-white">
                    ₹{Number(customSimulationResult.simulatedCost).toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400 font-medium">Simulated Gross Profit</span>
                  <div className={`text-lg font-bold ${customSimulationResult.grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    ₹{Number(customSimulationResult.grossProfit).toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
                  <span className="text-xs text-slate-400 font-medium">Simulated Gross Margin</span>
                  <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                    {customSimulationResult.grossMarginPercent}%
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Pre-packaged Scenario Models */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {forecastData?.whatIfScenarioForecasts?.scenarios?.map((sc, idx) => (
              <Card key={idx} className="border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{sc.scenarioName}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                    {sc.parametersChanged.variationPercent}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Projected Revenue:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">₹{sc.projectedRevenue.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Gross Margin Shift:</span>
                    <span className={`font-semibold ${sc.projectedGrossMarginImpactPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {sc.projectedGrossMarginImpactPercent >= 0 ? `+${sc.projectedGrossMarginImpactPercent}%` : `${sc.projectedGrossMarginImpactPercent}%`}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800 leading-relaxed">
                  💡 {sc.recommendation}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
