import { useState, useEffect, useRef } from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  Layers, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Minus,
  DollarSign, ShoppingBag, Users, Truck, BarChart2, Percent, PiggyBank,
  Target, Lightbulb, Download, Printer, Package, UserCheck,
  Calendar, Activity, RefreshCw,
} from 'lucide-react';
import Sidebar from '../components/Sidebar';
import api from '../services/api';
import { exportToPDF } from '../utils/pdfExport';



const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#0f172a',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    color: '#e2e8f0',
    fontSize: '0.85rem',
  },
};

const fmtCurrency = (num) =>
  '৳' + new Intl.NumberFormat('en-BD').format(Math.round(num || 0));
const fmtNumber = (num) => new Intl.NumberFormat('en-BD').format(num || 0);
const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-BD', { month: 'short', day: 'numeric' });

const fmt = (d) => {
  const dt = new Date(d);
  dt.setMinutes(dt.getMinutes() - dt.getTimezoneOffset());
  return dt.toISOString().split('T')[0];
};



function getPresetDates(preset) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'today_vs_yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { p1Start: fmt(today), p1End: fmt(today), p2Start: fmt(yesterday), p2End: fmt(yesterday) };
    }
    case 'this_week_vs_last_week': {
      const dayOfWeek = today.getDay() || 7;
      const thisMonday = new Date(today);
      thisMonday.setDate(today.getDate() - dayOfWeek + 1);
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      const lastSunday = new Date(thisMonday);
      lastSunday.setDate(thisMonday.getDate() - 1);
      return { p1Start: fmt(thisMonday), p1End: fmt(today), p2Start: fmt(lastMonday), p2End: fmt(lastSunday) };
    }
    case 'last_7_vs_prev_7': {
      const end1 = new Date(today);
      end1.setDate(today.getDate() - 1);
      const start1 = new Date(end1);
      start1.setDate(end1.getDate() - 6);
      const end2 = new Date(start1);
      end2.setDate(start1.getDate() - 1);
      const start2 = new Date(end2);
      start2.setDate(end2.getDate() - 6);
      return { p1Start: fmt(start1), p1End: fmt(end1), p2Start: fmt(start2), p2End: fmt(end2) };
    }
    case 'this_month_vs_last_month': {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      return { p1Start: fmt(startOfMonth), p1End: fmt(today), p2Start: fmt(startOfLastMonth), p2End: fmt(endOfLastMonth) };
    }
    case 'last_30_vs_prev_30': {
      const end1 = new Date(today);
      end1.setDate(today.getDate() - 1);
      const start1 = new Date(end1);
      start1.setDate(end1.getDate() - 29);
      const end2 = new Date(start1);
      end2.setDate(start1.getDate() - 1);
      const start2 = new Date(end2);
      start2.setDate(end2.getDate() - 29);
      return { p1Start: fmt(start1), p1End: fmt(end1), p2Start: fmt(start2), p2End: fmt(end2) };
    }
    case 'last_90_vs_prev_90': {
      const end1 = new Date(today);
      end1.setDate(today.getDate() - 1);
      const start1 = new Date(end1);
      start1.setDate(end1.getDate() - 89);
      const end2 = new Date(start1);
      end2.setDate(start1.getDate() - 1);
      const start2 = new Date(end2);
      start2.setDate(end2.getDate() - 89);
      return { p1Start: fmt(start1), p1End: fmt(end1), p2Start: fmt(start2), p2End: fmt(end2) };
    }
    case 'this_year_vs_last_year': {
      const startOfYear = new Date(today.getFullYear(), 0, 1);
      const startOfLastYear = new Date(today.getFullYear() - 1, 0, 1);
      const endOfLastYear = new Date(today.getFullYear() - 1, 11, 31);
      return { p1Start: fmt(startOfYear), p1End: fmt(today), p2Start: fmt(startOfLastYear), p2End: fmt(endOfLastYear) };
    }
    default:
      return null;
  }
}

const PRESETS = [
  { value: 'today_vs_yesterday', label: 'Today vs Yesterday' },
  { value: 'this_week_vs_last_week', label: 'This Week vs Last Week' },
  { value: 'last_7_vs_prev_7', label: 'Last 7 Days vs Previous 7 Days' },
  { value: 'this_month_vs_last_month', label: 'This Month vs Last Month' },
  { value: 'last_30_vs_prev_30', label: 'Last 30 Days vs Previous 30 Days' },
  { value: 'last_90_vs_prev_90', label: 'Last 90 Days vs Previous 90 Days' },
  { value: 'this_year_vs_last_year', label: 'This Year vs Last Year' },
  { value: 'custom', label: 'Custom Date Range' },
];

const CHART_TYPES = [
  { value: 'bar', label: 'Bar Chart' },
  { value: 'line', label: 'Line Chart' },
  { value: 'area', label: 'Area Chart' },
  { value: 'horizontal', label: 'Horizontal Bar' },
  { value: 'radar', label: 'Radar Chart' },
];



const KPI_CONFIG = [
  { key: 'revenue', label: 'Revenue', icon: DollarSign, format: fmtCurrency, higherBetter: true, color: '#3b82f6' },
  { key: 'profit', label: 'Profit', icon: TrendingUp, format: fmtCurrency, higherBetter: true, color: '#10b981' },
  { key: 'orders', label: 'Orders', icon: ShoppingBag, format: fmtNumber, higherBetter: true, color: '#8b5cf6' },
  { key: 'customers', label: 'Customers', icon: Users, format: fmtNumber, higherBetter: true, color: '#f59e0b' },
  { key: 'avg_order_value', label: 'Avg Order Value', icon: Target, format: fmtCurrency, higherBetter: true, color: '#ec4899' },
  { key: 'investment', label: 'Investment', icon: PiggyBank, format: fmtCurrency, higherBetter: false, color: '#f97316' },
  { key: 'delivery', label: 'Delivery Cost', icon: Truck, format: fmtCurrency, higherBetter: false, color: '#06b6d4' },
  { key: 'profit_margin', label: 'Profit Margin', icon: Percent, format: (v) => (v || 0).toFixed(1) + '%', higherBetter: true, color: '#a855f7' },
];

const STATUS_COLORS = {
  delivered: '#10b981',
  pending: '#f59e0b',
  shipped: '#3b82f6',
  processing: '#8b5cf6',
  returned: '#ef4444',
  cancelled: '#6b7280',
};



function SkeletonCard() {
  return (
    <div className="glass-card" style={{ padding: '1.5rem', minHeight: 140 }}>
      <div style={{ width: '60%', height: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 6, marginBottom: 12 }} />
      <div style={{ width: '40%', height: 28, background: 'rgba(255,255,255,0.08)', borderRadius: 6, marginBottom: 16 }} />
      <div style={{ width: '80%', height: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 6 }} />
    </div>
  );
}

function KpiCard({ config, current, previous }) {
  const { label, icon: Icon, format, higherBetter, color } = config;
  const change = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / Math.abs(previous)) * 100;
  const isPositive = change > 0;
  const isGood = isPositive === higherBetter;
  const isNeutral = Math.abs(change) < 0.1;

  const changeColor = isNeutral ? '#94a3b8' : isGood ? '#10b981' : '#ef4444';
  const changeBg = isNeutral ? 'rgba(148,163,184,0.1)' : isGood ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)';
  const ChangeIcon = isNeutral ? Minus : isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <div
      className="glass-card"
      style={{
        padding: '1.25rem 1.5rem',
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.2s, box-shadow 0.2s',
        cursor: 'default',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = `0 8px 30px ${color}20`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '';
      }}
    >
      {}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, opacity: 0.8 }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ background: `${color}18`, padding: '0.4rem', borderRadius: 8 }}>
            <Icon size={16} color={color} />
          </div>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.2rem',
            background: changeBg,
            color: changeColor,
            fontSize: '0.78rem',
            fontWeight: 600,
            padding: '0.2rem 0.5rem',
            borderRadius: 20,
          }}
        >
          <ChangeIcon size={13} />
          {Math.abs(change).toFixed(1)}%
        </div>
      </div>

      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.35rem' }}>
        {format(current)}
      </div>

      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
        Previous: <span style={{ color: '#94a3b8' }}>{format(previous)}</span>
      </div>

      {}
      <div style={{ marginTop: '0.75rem', height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${Math.min(Math.abs(change), 100)}%`,
            background: changeColor,
            borderRadius: 4,
            transition: 'width 0.8s ease',
          }}
        />
      </div>
    </div>
  );
}

function InsightItem({ insight }) {
  const color = insight.type === 'positive' ? '#10b981' : insight.type === 'negative' ? '#ef4444' : '#94a3b8';
  const bg = insight.type === 'positive' ? 'rgba(16,185,129,0.08)' : insight.type === 'negative' ? 'rgba(239,68,68,0.08)' : 'rgba(148,163,184,0.08)';
  const Icon = insight.type === 'positive' ? TrendingUp : insight.type === 'negative' ? TrendingDown : Minus;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        background: bg,
        borderRadius: 10,
        borderLeft: `3px solid ${color}`,
      }}
    >
      <Icon size={16} color={color} style={{ flexShrink: 0 }} />
      <span style={{ fontSize: '0.875rem', color: '#cbd5e1', lineHeight: 1.5 }}>{insight.text}</span>
    </div>
  );
}

function RankTable({ title, data, color, icon: Icon }) {
  return (
    <div className="glass-card" style={{ padding: '1.25rem' }}>
      <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#e2e8f0' }}>
        <Icon size={16} color={color} /> {title}
      </h3>
      {data.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem 0', fontSize: '0.85rem' }}>No data</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {data.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: `${color}20`, color: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                <span style={{ color: '#cbd5e1' }}>{item.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{item.orders} orders</span>
                <span style={{ color: color, fontWeight: 600 }}>{fmtCurrency(item.revenue)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBar({ label, count1, count2, color }) {
  const max = Math.max(count1, count2, 1);
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
        <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'capitalize' }}>{label}</span>
        <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{count1} vs {count2}</span>
      </div>
      <div style={{ display: 'flex', gap: '0.35rem' }}>
        <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${(count1 / max) * 100}%`, height: '100%', background: color, borderRadius: 4, opacity: 0.9, transition: 'width 0.8s ease' }} />
        </div>
        <div style={{ flex: 1, height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ width: `${(count2 / max) * 100}%`, height: '100%', background: color, borderRadius: 4, opacity: 0.5, transition: 'width 0.8s ease' }} />
        </div>
      </div>
    </div>
  );
}



export default function Compare({ user, onLogout }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const contentRef = useRef(null);

  const savedPreset = localStorage.getItem('compare_preset') || 'this_month_vs_last_month';
  const [preset, setPreset] = useState(savedPreset);

  const [p1Start, setP1Start] = useState('');
  const [p1End, setP1End] = useState('');
  const [p2Start, setP2Start] = useState('');
  const [p2End, setP2End] = useState('');

  const [chartType, setChartType] = useState('bar');


  useEffect(() => {
    if (preset === 'custom') return;
    const dates = getPresetDates(preset);
    if (dates) {
      setP1Start(dates.p1Start);
      setP1End(dates.p1End);
      setP2Start(dates.p2Start);
      setP2End(dates.p2End);
    }
    localStorage.setItem('compare_preset', preset);
  }, [preset]);


  useEffect(() => {
    if (p1Start && p1End && p2Start && p2End) {
      fetchComparison();
    }
  }, [p1Start, p1End, p2Start, p2End]);

  async function fetchComparison() {
    setLoading(true);
    setError('');
    try {
      const res = await api.analytics.compare(p1Start, p1End, p2Start, p2End);
      setData(res);
    } catch (err) {
      console.error(err);
      setError('Failed to load comparison data. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleExportPDF() {
    setIsExporting(true);
    try {
      await exportToPDF(contentRef, `Comparison_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  const hasData = data && (data.period1.orders > 0 || data.period2.orders > 0);



  const renderChart = () => {
    if (!data?.chartData) return null;
    const { chartData } = data;
    const hasAny = chartData.some((d) => d['Period A'] > 0 || d['Period B'] > 0);
    if (!hasAny) return <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>No data for selected periods.</div>;

    const commonXAxis = (
      <XAxis dataKey="metric" stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} />
    );
    const commonYAxis = (
      <YAxis stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={55} />
    );
    const commonTooltip = <Tooltip {...TOOLTIP_STYLE} formatter={(val, name) => [fmtCurrency(val), name === 'Period A' ? 'Current' : 'Previous']} />;
    const commonLegend = (
      <Legend
        formatter={(val) => (
          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{val === 'Period A' ? 'Current Period' : 'Previous Period'}</span>
        )}
      />
    );
    const commonGrid = <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />;

    if (chartType === 'radar') {
      return (
        <ResponsiveContainer width="100%" height={380}>
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
            <PolarGrid stroke="rgba(255,255,255,0.1)" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: '#94a3b8', fontSize: 10 }} />
            <Radar name="Period A" dataKey="Period A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.5} />
            <Radar name="Period B" dataKey="Period B" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
            {commonTooltip}
            {commonLegend}
          </RadarChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'area') {
      return (
        <ResponsiveContainer width="100%" height={380}>
          <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            {commonGrid}
            {commonXAxis}
            {commonYAxis}
            {commonTooltip}
            {commonLegend}
            <defs>
              <linearGradient id="gradA" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradB" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" name="Period A" dataKey="Period A" stroke="#3b82f6" fill="url(#gradA)" strokeWidth={2.5} />
            <Area type="monotone" name="Period B" dataKey="Period B" stroke="#10b981" fill="url(#gradB)" strokeWidth={2.5} />
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            {commonGrid}
            {commonXAxis}
            {commonYAxis}
            {commonTooltip}
            {commonLegend}
            <Line type="monotone" name="Period A" dataKey="Period A" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 5 }} activeDot={{ r: 7 }} />
            <Line type="monotone" name="Period B" dataKey="Period B" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', r: 5 }} activeDot={{ r: 7 }} />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'horizontal') {
      return (
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
            {commonGrid}
            <XAxis type="number" stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <YAxis dataKey="metric" type="category" stroke="#475569" tick={{ fill: '#94a3b8', fontSize: 12 }} tickLine={false} axisLine={false} width={80} />
            {commonTooltip}
            {commonLegend}
            <Bar name="Period A" dataKey="Period A" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={16} />
            <Bar name="Period B" dataKey="Period B" fill="#10b981" radius={[0, 4, 4, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      );
    }


    return (
      <ResponsiveContainer width="100%" height={380}>
        <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          {commonGrid}
          {commonXAxis}
          {commonYAxis}
          {commonTooltip}
          {commonLegend}
          <Bar name="Period A" dataKey="Period A" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={28} />
          <Bar name="Period B" dataKey="Period B" fill="#10b981" radius={[4, 4, 0, 0]} barSize={28} />
        </BarChart>
      </ResponsiveContainer>
    );
  };



  const renderDailyTrend = () => {
    if (!data?.dailyTrend) return null;
    const { period1, period2 } = data.dailyTrend;
    if (period1.length === 0 && period2.length === 0) return null;


    const maxLen = Math.max(period1.length, period2.length);
    const merged = [];
    for (let i = 0; i < maxLen; i++) {
      merged.push({
        day: `Day ${i + 1}`,
        current: period1[i]?.revenue || 0,
        previous: period2[i]?.revenue || 0,
      });
    }

    return (
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={merged} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} width={50} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(val) => [fmtCurrency(val)]} />
          <Legend formatter={(val) => <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{val}</span>} />
          <defs>
            <linearGradient id="trendGradA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="trendGradB" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" name="Current Period" dataKey="current" stroke="#3b82f6" fill="url(#trendGradA)" strokeWidth={2.5} dot={false} />
          <Area type="monotone" name="Previous Period" dataKey="previous" stroke="#10b981" fill="url(#trendGradB)" strokeWidth={2} strokeDasharray="6 3" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    );
  };



  return (
    <div className="app-layout">
      <Sidebar user={user} onLogout={onLogout} />

      <div className="main-area" ref={contentRef}>
        {}
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Layers size={28} color="#3b82f6" />
              Comparative Analysis
            </h1>
            <p>Compare business performance across time periods</p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={handleExportPDF} disabled={isExporting || !hasData} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
              <Download size={15} /> {isExporting ? 'Exporting…' : 'Export PDF'}
            </button>
            <button className="btn btn-secondary" onClick={handlePrint} disabled={!hasData} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
              <Printer size={15} /> Print
            </button>
          </div>
        </div>

        {}
        <div
          className="glass-card"
          style={{
            padding: '1rem 1.5rem',
            marginBottom: '1.5rem',
            display: 'flex',
            gap: '1rem',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '1 1 220px' }}>
            <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.35rem', fontWeight: 500 }}>
              <Calendar size={12} style={{ marginRight: 4, verticalAlign: -1 }} />
              Comparison Type
            </label>
            <select
              className="form-input"
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              style={{ width: '100%', padding: '0.55rem 1rem' }}
            >
              {PRESETS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {preset === 'custom' && (
            <>
              <div style={{ flex: '1 1 140px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#3b82f6', marginBottom: '0.35rem', fontWeight: 500 }}>Current Start</label>
                <input type="date" className="form-input" value={p1Start} onChange={(e) => setP1Start(e.target.value)} style={{ width: '100%' }} />
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#3b82f6', marginBottom: '0.35rem', fontWeight: 500 }}>Current End</label>
                <input type="date" className="form-input" value={p1End} onChange={(e) => setP1End(e.target.value)} style={{ width: '100%' }} />
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#10b981', marginBottom: '0.35rem', fontWeight: 500 }}>Previous Start</label>
                <input type="date" className="form-input" value={p2Start} onChange={(e) => setP2Start(e.target.value)} style={{ width: '100%' }} />
              </div>
              <div style={{ flex: '1 1 140px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#10b981', marginBottom: '0.35rem', fontWeight: 500 }}>Previous End</label>
                <input type="date" className="form-input" value={p2End} onChange={(e) => setP2End(e.target.value)} style={{ width: '100%' }} />
              </div>
            </>
          )}

          {}
          {!loading && data && preset !== 'custom' && (
            <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', gap: '1.5rem', paddingBottom: '0.3rem' }}>
              <span><span style={{ color: '#3b82f6' }}>●</span> {data.period1.label}</span>
              <span><span style={{ color: '#10b981' }}>●</span> {data.period2.label}</span>
            </div>
          )}
        </div>

        {}
        {error && (
          <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center', marginBottom: '1.5rem', borderLeft: '3px solid #ef4444' }}>
            <p style={{ color: '#f87171', marginBottom: '0.75rem' }}>{error}</p>
            <button className="btn btn-secondary" onClick={fetchComparison} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}

        {}
        {loading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {}
        {!loading && data && !hasData && (
          <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <BarChart2 size={56} color="var(--text-muted)" style={{ marginBottom: '1.5rem' }} />
            <h2 style={{ fontSize: '1.3rem', marginBottom: '0.75rem' }}>No Data Available</h2>
            <p style={{ color: 'var(--text-secondary)', maxWidth: 440, margin: '0 auto', lineHeight: 1.7 }}>
              There are no orders in either of the selected periods. Try selecting a wider date range or upload your sales data first.
            </p>
          </div>
        )}

        {}
        {!loading && hasData && (
          <>
            {}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                gap: '1rem',
                marginBottom: '1.5rem',
              }}
            >
              {KPI_CONFIG.map((cfg) => (
                <KpiCard
                  key={cfg.key}
                  config={cfg}
                  current={data.period1[cfg.key] ?? 0}
                  previous={data.period2[cfg.key] ?? 0}
                />
              ))}
            </div>

            {}
            <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#e2e8f0' }}>
                  <Activity size={18} color="#8b5cf6" />
                  Performance Comparison
                </h2>
                <select
                  className="form-input"
                  value={chartType}
                  onChange={(e) => setChartType(e.target.value)}
                  style={{ width: 150, padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                >
                  {CHART_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>{ct.label}</option>
                  ))}
                </select>
              </div>
              {renderChart()}
            </div>

            {}
            {data.insights && data.insights.length > 0 && (
              <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#e2e8f0' }}>
                  <Lightbulb size={18} color="#f59e0b" />
                  Business Insights
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {data.insights.map((insight, i) => (
                    <InsightItem key={i} insight={insight} />
                  ))}
                </div>
              </div>
            )}

            {}
            {data.dailyTrend && (data.dailyTrend.period1.length > 0 || data.dailyTrend.period2.length > 0) && (
              <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#e2e8f0' }}>
                  <BarChart2 size={18} color="#06b6d4" />
                  Daily Sales Trend
                </h2>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '1rem' }}>
                  Solid line = Current Period · Dashed line = Previous Period
                </p>
                {renderDailyTrend()}
              </div>
            )}

            {}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>

              {}
              <RankTable
                title="Top Products (Current)"
                data={data.topProducts?.period1 || []}
                color="#3b82f6"
                icon={Package}
              />

              {}
              <RankTable
                title="Top Products (Previous)"
                data={data.topProducts?.period2 || []}
                color="#10b981"
                icon={Package}
              />

              {}
              <RankTable
                title="Top Customers (Current)"
                data={data.topCustomers?.period1 || []}
                color="#8b5cf6"
                icon={UserCheck}
              />

              {}
              <RankTable
                title="Top Customers (Previous)"
                data={data.topCustomers?.period2 || []}
                color="#f59e0b"
                icon={UserCheck}
              />
            </div>

            {}
            {data.statusBreakdown && (
              <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#e2e8f0' }}>
                  <ShoppingBag size={18} color="#ec4899" />
                  Order Status Comparison
                </h2>
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', fontSize: '0.78rem', color: '#94a3b8' }}>
                  <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, marginRight: 4, opacity: 0.9, background: '#94a3b8' }} /> Current</span>
                  <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, marginRight: 4, opacity: 0.5, background: '#94a3b8' }} /> Previous</span>
                </div>
                {(() => {
                  const allStatuses = new Set([
                    ...Object.keys(data.statusBreakdown.period1 || {}),
                    ...Object.keys(data.statusBreakdown.period2 || {}),
                  ]);
                  return [...allStatuses].map((status) => (
                    <StatusBar
                      key={status}
                      label={status}
                      count1={data.statusBreakdown.period1?.[status] || 0}
                      count2={data.statusBreakdown.period2?.[status] || 0}
                      color={STATUS_COLORS[status] || '#94a3b8'}
                    />
                  ));
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
