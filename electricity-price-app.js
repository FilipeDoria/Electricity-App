import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import { Moon, Sun } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

const THRESHOLD_PRICE = 0.009; // €/kWh
const YELLOW_THRESHOLD = THRESHOLD_PRICE * 1.25;
const RED_THRESHOLD = THRESHOLD_PRICE * 1.5;

const generatePrices = () => {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    price: Math.random() * 0.015 + 0.005, // Random price between 0.005 and 0.02 €/kWh
  }));
};

const getColor = (price, isDark) => {
  if (price < THRESHOLD_PRICE) return isDark ? '#10B981' : '#059669';
  if (price < YELLOW_THRESHOLD) return isDark ? '#FBBF24' : '#D97706';
  return isDark ? '#EF4444' : '#DC2626';
};

const getTickColor = (price) => {
  if (price < THRESHOLD_PRICE) return '#10B981'; // Green
  if (price < YELLOW_THRESHOLD) return '#FBBF24'; // Yellow
  if (price < RED_THRESHOLD) return '#F59E0B'; // Orange
  return '#EF4444'; // Red
};

const ElectricityPriceApp = () => {
  const [todayPrices, setTodayPrices] = useState(generatePrices());
  const [tomorrowPrices, setTomorrowPrices] = useState(generatePrices());
  const [selectedDay, setSelectedDay] = useState('today');
  const [selectedPrice, setSelectedPrice] = useState(null);
  const [selectedHour, setSelectedHour] = useState(null);
  const [showMWh, setShowMWh] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const chartRef = useRef(null);

  useEffect(() => {
    const currentHour = new Date().getHours();
    setSelectedHour(currentHour);
    setSelectedPrice(todayPrices[currentHour].price);
  }, []);

  const handleDayChange = (day) => {
    setSelectedDay(day);
    const prices = day === 'today' ? todayPrices : tomorrowPrices;
    setSelectedPrice(prices[selectedHour || 0].price);
  };

  const handleChartClick = (data) => {
    if (data && data.activePayload) {
      setSelectedPrice(data.activePayload[0].payload.price);
      setSelectedHour(data.activePayload[0].payload.hour);
    }
  };

  const prices = selectedDay === 'today' ? todayPrices : tomorrowPrices;
  const averagePrice = prices.reduce((sum, price) => sum + price.price, 0) / prices.length;
  const minPrice = Math.min(...prices.map(p => p.price));
  const maxPrice = Math.max(...prices.map(p => p.price));
  const minPriceHour = prices.findIndex(p => p.price === minPrice);
  const maxPriceHour = prices.findIndex(p => p.price === maxPrice);

  const formatPrice = (price) => {
    const convertedPrice = showMWh ? price * 1000 : price;
    return convertedPrice.toFixed(showMWh ? 2 : 4);
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const hour = payload[0].payload.hour;
      return (
        <div className={`${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} p-2 rounded shadow`}>
          <p className="text-sm">{`${hour}:00 - ${(hour + 1) % 24}:00`}</p>
          <p className="text-sm font-bold">{`${formatPrice(payload[0].value)} €/${showMWh ? 'MWh' : 'kWh'}`}</p>
        </div>
      );
    }
    return null;
  };

  const FloatingBubble = ({ minPrice, maxPrice, minPriceHour, maxPriceHour }) => (
    <div className={`absolute bottom-0 left-0 right-0 flex justify-between p-2 ${
      isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'
    } rounded-lg shadow-md`}>
      <div>
        <p className="text-xs">Min {minPriceHour}-{(minPriceHour + 1) % 24} h</p>
        <p className="text-sm font-bold text-green-500">▼ {formatPrice(minPrice)} €/{showMWh ? 'MWh' : 'kWh'}</p>
      </div>
      <div className="text-right">
        <p className="text-xs">Max {maxPriceHour}-{(maxPriceHour + 1) % 24} h</p>
        <p className="text-sm font-bold text-red-500">▲ {formatPrice(maxPrice)} €/{showMWh ? 'MWh' : 'kWh'}</p>
      </div>
    </div>
  );

  const ColorCodedTicks = ({ data, width, height }) => {
    const tickHeight = 4;
    const tickWidth = width / 24;
    
    return (
      <g>
        {data.map((entry, index) => (
          <rect
            key={`tick-${index}`}
            x={index * tickWidth}
            y={height - tickHeight}
            width={tickWidth}
            height={tickHeight}
            fill={getTickColor(entry.price)}
          />
        ))}
      </g>
    );
  };

  return (
    <div className={`max-w-xl mx-auto p-4 ${isDarkMode ? 'bg-black' : 'bg-gray-100'}`}>
      <div className={`${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} rounded-lg shadow-md`}>
        <div className={`flex justify-between items-center p-2 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center space-x-2">
            <span className="text-xs">{showMWh ? '€/MWh' : '€/kWh'}</span>
            <Switch 
              checked={showMWh}
              onCheckedChange={setShowMWh}
              size="sm"
            />
          </div>
          <h1 className="text-lg font-semibold">Day-ahead Market</h1>
          <button
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
            onClick={() => setIsDarkMode(!isDarkMode)}
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
        <div className="p-2">
          <div className="flex justify-center space-x-4 mb-2">
            <button 
              onClick={() => handleDayChange('today')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedDay === 'today'
                  ? (isDarkMode ? 'bg-white text-black' : 'bg-gray-900 text-white')
                  : (isDarkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')
              }`}
            >
              Today
            </button>
            <button 
              onClick={() => handleDayChange('tomorrow')}
              className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedDay === 'tomorrow'
                  ? (isDarkMode ? 'bg-white text-black' : 'bg-gray-900 text-white')
                  : (isDarkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300')
              }`}
            >
              Tomorrow
            </button>
          </div>
          <div className="text-center mb-2">
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {selectedDay === 'today' ? 'Today' : 'Tomorrow'}, {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>day average</p>
            <p className="text-2xl font-bold mt-0">{formatPrice(averagePrice)}</p>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>€ / {showMWh ? 'MWh' : 'kWh'}</p>
          </div>
          <div className="relative" ref={chartRef}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart
                data={prices}
                onClick={handleChartClick}
                margin={{ top: 5, right: 5, left: 0, bottom: 40 }}
              >
                <XAxis 
                  dataKey="hour" 
                  tickFormatter={(hour) => `${hour}h`}
                  interval={0}
                  axisLine={{ stroke: isDarkMode ? '#4B5563' : '#D1D5DB' }}
                  tick={{ fill: isDarkMode ? '#9CA3AF' : '#4B5563', fontSize: 10 }}
                  ticks={[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24]}
                />
                <YAxis 
                  domain={[minPrice, maxPrice]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: isDarkMode ? '#9CA3AF' : '#4B5563', fontSize: 10 }}
                  tickFormatter={(value) => formatPrice(value)}
                  ticks={[minPrice, averagePrice, maxPrice]}
                  width={45}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={averagePrice} stroke={isDarkMode ? '#9CA3AF' : '#4B5563'} strokeDasharray="3 3" />
                {prices.map((entry, index) => (
                  <ReferenceArea
                    key={`area-${index}`}
                    x1={index}
                    x2={index + 1}
                    y1={0}
                    y2={entry.price}
                    fill={getColor(entry.price, isDarkMode)}
                    fillOpacity={0.3}
                  />
                ))}
                <Line 
                  type="monotone" 
                  dataKey="price" 
                  stroke={isDarkMode ? '#10B981' : '#059669'}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6, fill: isDarkMode ? '#10B981' : '#059669' }}
                />
                <ColorCodedTicks data={prices} width={500} height={200} />
              </LineChart>
            </ResponsiveContainer>
            <FloatingBubble 
              minPrice={minPrice}
              maxPrice={maxPrice}
              minPriceHour={minPriceHour}
              maxPriceHour={maxPriceHour}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ElectricityPriceApp;
