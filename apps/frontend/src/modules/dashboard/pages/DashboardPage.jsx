import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Package, Beaker, Users, Building2, TrendingUp, AlertCircle, Clock } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await api.get('/dashboard/summary');
      return response.data;
    }
  });

  if (isLoading) {
    return <div className="p-8 space-y-6"><Skeleton className="h-[200px] w-full" /><Skeleton className="h-[400px] w-full" /></div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/50 p-4 rounded-lg border border-red-200">
          <h3 className="font-bold">Failed to load dashboard</h3>
          <p>{error.message}</p>
          <p className="text-sm mt-2 opacity-80">Did you restart your backend server after the schema updates?</p>
        </div>
      </div>
    );
  }

  const {
    topMetrics,
    moneyFlowData,
    accountBalanceData,
    runningProductions,
    runningCustomerOrders,
    lowRmStock,
    expireProducts,
    supplierReceivables,
    customerPayables
  } = data;

  const CustomPieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-800 p-2 shadow-md border border-slate-100 dark:border-slate-700 rounded text-sm">
          <p className="font-medium text-slate-800 dark:text-slate-200">{`${payload[0].name} : ${payload[0].value}%`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6 p-2 pb-16">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Dashboard</h1>
        <div className="text-sm text-slate-500 dark:text-slate-400">Welcome back to Manufacture ERP</div>
      </div>

      {/* 1. Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-sm border-slate-200 dark:border-slate-800 dark:bg-[#111827]">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Product</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{topMetrics.totalProduct.toFixed(2)}</h3>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full">
              <Package className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-slate-200 dark:border-slate-800 dark:bg-[#111827]">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total RM</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{topMetrics.totalRm.toFixed(2)}</h3>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full">
              <Beaker className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 dark:border-slate-800 dark:bg-[#111827]">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Supplier</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{topMetrics.totalSupplier.toFixed(2)}</h3>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full">
              <Building2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 dark:border-slate-800 dark:bg-[#111827]">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Customer</p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{topMetrics.totalCustomer.toFixed(2)}</h3>
            </div>
            <div className="p-3 bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 2. Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-slate-200 dark:border-slate-800 dark:bg-[#111827]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2 text-slate-500 dark:text-slate-400" />
              Money Flow Comparison (Six Month)
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={moneyFlowData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                <RechartsTooltip cursor={{fill: '#1e293b'}} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="Purchases" fill="#818cf8" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="SupplierPayments" fill="#a78bfa" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Expenses" fill="#c084fc" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 dark:border-slate-800 dark:bg-[#111827]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2 text-slate-500 dark:text-slate-400" />
              Account Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={accountBalanceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {accountBalanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} stroke="transparent" />
                  ))}
                </Pie>
                <RechartsTooltip content={<CustomPieTooltip />} />
                <Legend iconType="circle" layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 3. Running Productions & Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-slate-200 dark:border-slate-800 dark:bg-[#111827]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center">
              <Clock className="w-4 h-4 mr-2 text-slate-500 dark:text-slate-400" />
              Running Productions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-slate-100 dark:border-slate-700/50 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                  <TableRow className="dark:border-slate-700/50">
                    <TableHead className="text-xs font-semibold dark:text-slate-300">Reference No</TableHead>
                    <TableHead className="text-xs font-semibold dark:text-slate-300">Product</TableHead>
                    <TableHead className="text-xs font-semibold dark:text-slate-300">Start Date</TableHead>
                    <TableHead className="text-xs font-semibold dark:text-slate-300">Production Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runningProductions.map((p, i) => (
                    <TableRow key={i} className="dark:border-slate-700/50">
                      <TableCell className="font-mono text-xs dark:text-slate-300">{p.referenceNo}</TableCell>
                      <TableCell className="text-sm dark:text-slate-300">{p.product}</TableCell>
                      <TableCell className="text-sm text-slate-500 dark:text-slate-400">{new Date(p.startDate).toLocaleDateString()}</TableCell>
                      <TableCell className="text-sm font-medium text-slate-700 dark:text-slate-200">{p.productionCost}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 dark:border-slate-800 dark:bg-[#111827]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center">
              <Users className="w-4 h-4 mr-2 text-slate-500 dark:text-slate-400" />
              Running Customer Order
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-slate-100 dark:border-slate-700/50 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                  <TableRow className="dark:border-slate-700/50">
                    <TableHead className="text-xs font-semibold dark:text-slate-300">Reference No</TableHead>
                    <TableHead className="text-xs font-semibold dark:text-slate-300">Customers</TableHead>
                    <TableHead className="text-xs font-semibold dark:text-slate-300">Delivery Date</TableHead>
                    <TableHead className="text-xs font-semibold text-right dark:text-slate-300">Total Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runningCustomerOrders.map((o, i) => (
                    <TableRow key={i} className="dark:border-slate-700/50">
                      <TableCell className="font-mono text-xs dark:text-slate-300">{o.referenceNo}</TableCell>
                      <TableCell className="text-sm dark:text-slate-300">{o.customers}</TableCell>
                      <TableCell className="text-sm text-slate-500 dark:text-slate-400">{o.deliveryDate}</TableCell>
                      <TableCell className="text-sm text-right font-medium text-slate-700 dark:text-slate-200">{o.totalAmount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 4. Inventory Warnings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-slate-200 dark:border-slate-800 dark:bg-[#111827]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center text-amber-600 dark:text-amber-500">
              <AlertCircle className="w-4 h-4 mr-2" />
              Low Raw Materials in Stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-slate-100 dark:border-slate-700/50 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                  <TableRow className="dark:border-slate-700/50">
                    <TableHead className="text-xs font-semibold dark:text-slate-300">Code</TableHead>
                    <TableHead className="text-xs font-semibold dark:text-slate-300">Material Name</TableHead>
                    <TableHead className="text-xs font-semibold text-right dark:text-slate-300">Current Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowRmStock.map((rm, i) => (
                    <TableRow key={i} className="dark:border-slate-700/50">
                      <TableCell className="font-mono text-xs dark:text-slate-300">{rm.code}</TableCell>
                      <TableCell className="text-sm dark:text-slate-300">{rm.name}</TableCell>
                      <TableCell className="text-sm text-right text-red-600 dark:text-red-400 font-medium">{rm.currentStock}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 dark:border-slate-800 dark:bg-[#111827]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center text-red-600 dark:text-red-500">
              <AlertCircle className="w-4 h-4 mr-2" />
              Close to Expire Finished Product
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-slate-100 dark:border-slate-700/50 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                  <TableRow className="dark:border-slate-700/50">
                    <TableHead className="text-xs font-semibold dark:text-slate-300">Production</TableHead>
                    <TableHead className="text-xs font-semibold dark:text-slate-300">Name</TableHead>
                    <TableHead className="text-xs font-semibold dark:text-slate-300">Expiry Date</TableHead>
                    <TableHead className="text-xs font-semibold text-right dark:text-slate-300">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expireProducts.map((p, i) => (
                    <TableRow key={i} className="dark:border-slate-700/50">
                      <TableCell className="font-mono text-xs dark:text-slate-300">{p.production}</TableCell>
                      <TableCell className="text-sm dark:text-slate-300">{p.name}</TableCell>
                      <TableCell className="text-sm text-slate-500 dark:text-slate-400">{p.expiryDate}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-900/50 text-[10px] uppercase">
                          {p.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5. Finance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-slate-200 dark:border-slate-800 dark:bg-[#111827]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center">
              <Building2 className="w-4 h-4 mr-2 text-slate-500 dark:text-slate-400" />
              Supplier Receivables
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-slate-100 dark:border-slate-700/50 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                  <TableRow className="dark:border-slate-700/50">
                    <TableHead className="text-xs font-semibold dark:text-slate-300">Date</TableHead>
                    <TableHead className="text-xs font-semibold dark:text-slate-300">Supplier</TableHead>
                    <TableHead className="text-xs font-semibold text-right dark:text-slate-300">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplierReceivables.map((s, i) => (
                    <TableRow key={i} className="dark:border-slate-700/50">
                      <TableCell className="text-sm text-slate-500 dark:text-slate-400">{s.date}</TableCell>
                      <TableCell className="text-sm dark:text-slate-300">{s.supplier}</TableCell>
                      <TableCell className="text-sm text-right font-medium text-emerald-600 dark:text-emerald-400">{s.amount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 dark:border-slate-800 dark:bg-[#111827]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-800 dark:text-slate-200 flex items-center">
              <Users className="w-4 h-4 mr-2 text-slate-500 dark:text-slate-400" />
              Customer Payable
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-slate-100 dark:border-slate-700/50 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                  <TableRow className="dark:border-slate-700/50">
                    <TableHead className="text-xs font-semibold dark:text-slate-300">Reference No</TableHead>
                    <TableHead className="text-xs font-semibold dark:text-slate-300">Date</TableHead>
                    <TableHead className="text-xs font-semibold dark:text-slate-300">Customers</TableHead>
                    <TableHead className="text-xs font-semibold text-right dark:text-slate-300">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customerPayables.map((c, i) => (
                    <TableRow key={i} className="dark:border-slate-700/50">
                      <TableCell className="font-mono text-xs dark:text-slate-300">{c.referenceNo}</TableCell>
                      <TableCell className="text-sm text-slate-500 dark:text-slate-400">{c.date}</TableCell>
                      <TableCell className="text-sm dark:text-slate-300">{c.customer}</TableCell>
                      <TableCell className="text-sm text-right font-medium text-red-600 dark:text-red-400">{c.amount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
