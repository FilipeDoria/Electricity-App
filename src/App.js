import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import { Moon, Sun } from 'lucide-react';
import { Switch } from './switch';
import './App.css';

const THRESHOLD_PRICE = 0.009; // €/kWh
const YELLOW_THRESHOLD = THRESHOLD_PRICE * 1.25;
const RED_THRESHOLD = THRESHOLD_PRICE * 1.5;
const EXTRA_TARIFF = 0.065; // €/kWh
const precision = 4; //decimal houses precision

const formatDate = (date) => {
  return date.toISOString().split('T')[0].replace(/-/g, '');
};

const fetchPrices = async (date) => {
  const formattedDate = formatDate(date);
  const originalUrl = `https://www.omie.es/pt/file-download?parents%5B0%5D=marginalpdbcpt&filename=marginalpdbcpt_${formattedDate}.1`;
  const corsProxyUrl = 'https://cors-anywhere.herokuapp.com/';
  const url = corsProxyUrl + originalUrl;
  console.log(url)
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    console.log(response)
    const text = await response.text();
    console.log('Raw API response:', text);

    const lines = text.split('\n');
    const prices = lines.slice(1, -1).map(line => {
      const [year, month, day, hour, ptPrice, esPrice] = line.split(';');
      const ptPriceFloat = parseFloat(ptPrice) / 1000; // Convert to €/kWh
      const esPriceFloat = parseFloat(esPrice) / 1000; // Convert to €/kWh
      if (isNaN(ptPriceFloat) || isNaN(esPriceFloat)) {
        console.warn(`Invalid price for hour ${hour}: ${ptPrice}, ${esPrice}`);
        return null; // or return a default value like { hour: parseInt(hour) - 1, ptPrice: 0, esPrice: 0 }
      }
      return {
        hour: parseInt(hour) - 1, // Adjust hour to 0-23 range
        ptPrice: ptPriceFloat,
        esPrice: esPriceFloat
      };
    }).filter(item => item !== null); // Remove any null entries;
    console.log('Fetched and transformed prices:', prices);
    return prices;
  } catch (error) {
    console.error('Error fetching prices:', error);
    return null;
  }
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

const generateMockPrices = () => {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    ptPrice: Math.random() * 0.15 + 0.05, // Random price between 0.05 and 0.20 €/kWh
    esPrice: Math.random() * 0.15 + 0.05, // Random price between 0.05 and 0.20 €/kWh
  }));
};

const App = () => {
  const [todayPrices, setTodayPrices] = useState([]);
  const [tomorrowPrices, setTomorrowPrices] = useState([]);
  const [selectedDay, setSelectedDay] = useState('today');
  const [selectedPrice, setSelectedPrice] = useState(null);
  const [selectedHour, setSelectedHour] = useState(null);
  const [showMWh, setShowMWh] = useState(false);
  const [includeTariff, setIncludeTariff] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showEsPrices, setShowEsPrices] = useState(false);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const chartRef = useRef(null);
  const [useGeneratedData, setUseGeneratedData] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        let todayData, tomorrowData;

        if (useGeneratedData) {
          todayData = generateMockPrices();
          tomorrowData = generateMockPrices();
        } else {
          const today = new Date();
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
    
          todayData = await fetchPrices(today);
          tomorrowData = await fetchPrices(tomorrow);
        }
    
        if (todayData) setTodayPrices(todayData);
        if (tomorrowData) setTomorrowPrices(tomorrowData);
        
        if (!todayData && !tomorrowData) {
          setError("No price data is currently available.");
        } else {
          setError(null);
        }  

        const currentHour = new Date().getHours();
        setSelectedHour(currentHour);
        setSelectedPrice(todayData ? todayData[currentHour].ptPrice : null);
    
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to fetch price data.");
        setIsLoading(false);
      }
    };
  
    fetchData();
  }, [useGeneratedData]);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  const handleDayChange = (day) => {
    setSelectedDay(day);
    const prices = day === 'today' ? todayPrices : tomorrowPrices;
    setSelectedPrice(prices[selectedHour || 0]?.ptPrice);
  };

  const handleChartClick = (data) => {
    if (data && data.activePayload) {
      setSelectedPrice(data.activePayload[0].payload.ptPrice);
      setSelectedHour(data.activePayload[0].payload.hour);
    }
  };

  const prices = selectedDay === 'today' ? todayPrices : tomorrowPrices;
  const adjustedPrices = includeTariff ? prices.map(p => ({ ...p, ptPrice: p.ptPrice + EXTRA_TARIFF, esPrice: p.esPrice + EXTRA_TARIFF })) : prices;

  const averagePrice = adjustedPrices.length > 0 
    ? adjustedPrices.reduce((sum, price) => sum + price.ptPrice, 0) / adjustedPrices.length
    : 0;

  const ptMinPrice = adjustedPrices.length > 0 ? Math.min(...adjustedPrices.map(p => p.ptPrice)) : 0;
  const ptMaxPrice = adjustedPrices.length > 0 ? Math.max(...adjustedPrices.map(p => p.ptPrice)) : 0;
  const minPriceHour = adjustedPrices.findIndex(p => p.ptPrice === ptMinPrice);
  const maxPriceHour = adjustedPrices.findIndex(p => p.ptPrice === ptMaxPrice);
  
  // Add Spanish market calculations here
  const esAveragePrice = adjustedPrices.length > 0 
    ? adjustedPrices.reduce((sum, price) => sum + price.esPrice, 0) / adjustedPrices.length 
    : 0;
  const esMinPrice = adjustedPrices.length > 0 ? Math.min(...adjustedPrices.map(p => p.esPrice)) : 0;
  const esMaxPrice = adjustedPrices.length > 0 ? Math.max(...adjustedPrices.map(p => p.esPrice)) : 0;
  const esMinPriceHour = adjustedPrices.findIndex(p => p.esPrice === esMinPrice);
  const esMaxPriceHour = adjustedPrices.findIndex(p => p.esPrice === esMaxPrice);


  console.log('Average Price PT:', averagePrice.toFixed(precision));

  console.log('Min Price PT :', ptMinPrice, 'Max Price PT:', ptMaxPrice);
  console.log('Min Price Hour PT:', minPriceHour, 'Max Price Hour PT:', maxPriceHour);
  console.log('Min Price ES :', esMinPrice, 'Max Price ES:', esMaxPrice);
  console.log('Min Price Hour ES:', minPriceHour, 'Max Price Hour ES:', maxPriceHour);

  const formatPrice = (price, precision = 4) => {
    if (isNaN(price)) return 'N/A';
    const convertedPrice = showMWh ? price * 1000 : price;
    return convertedPrice.toFixed(precision);
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const hour = payload[0].payload.hour;
      const ptPrice = payload[0].payload.ptPrice;
      const esPrice = payload[0].payload.esPrice;
      return (
        <div className={`${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} p-2 rounded shadow`}>
          <p className="text-sm">{`${hour}:00 - ${(hour + 1) % 24}:00`}</p>
          <p className="text-sm font-bold">{`PT: ${formatPrice(ptPrice)} €/${showMWh ? 'MWh' : 'kWh'}`}</p>
          {showEsPrices && <p className="text-sm font-bold">{`ES: ${formatPrice(esPrice)} €/${showMWh ? 'MWh' : 'kWh'}`}</p>}
        </div>
      );
    }
    return null;
  };

  const FloatingBubble = ({ ptMinPrice, ptMaxPrice, minPriceHour, maxPriceHour, esMinPrice, esMaxPrice, esMinPriceHour, esMaxPriceHour }) => (
    <div className={`absolute bottom-0 left-0 right-0 flex justify-between p-2 ${
      isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'
    } rounded-lg shadow-md`} style={{ bottom: '-60px' }}>  
      <div>
        <p className="text-xs">PT Min {minPriceHour}-{(minPriceHour + 1) % 24} h</p>
        <p className="text-sm font-bold text-green-500">▼ {formatPrice(ptMinPrice)} €/{showMWh ? 'MWh' : 'kWh'}</p>
        {showEsPrices && (
          <>
            <p className="text-xs">ES Min {esMinPriceHour}-{(esMinPriceHour + 1) % 24} h</p>
            <p className="text-sm font-bold text-green-500">▼ {formatPrice(esMinPrice)} €/{showMWh ? 'MWh' : 'kWh'}</p>
          </>
        )}
      </div>
      <div className="text-right">
        <p className="text-xs">PT Max {maxPriceHour}-{(maxPriceHour + 1) % 24} h</p>
        <p className="text-sm font-bold text-red-500">▲ {formatPrice(ptMaxPrice)} €/{showMWh ? 'MWh' : 'kWh'}</p>
        {showEsPrices && (
          <>
            <p className="text-xs">ES Max {esMaxPriceHour}-{(esMaxPriceHour + 1) % 24} h</p>
            <p className="text-sm font-bold text-red-500">▲ {formatPrice(esMaxPrice)} €/{showMWh ? 'MWh' : 'kWh'}</p>
          </>
        )}
      </div>
    </div>
  );

  const getFormattedDate = (day) => {
    const date = new Date();
    if (day === 'tomorrow') {
      date.setDate(date.getDate() + 1);
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

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
            fill={getTickColor(entry.ptPrice)}
          />
        ))}
      </g>
    );
  };

  const CustomXAxis = () => (
    <XAxis
      dataKey="hour"
      tickFormatter={(hour) => `${hour}`}
      ticks={[0, 4, 8, 12, 16, 20, 23]}
      domain={[0, 23]}
      type="number"
      axisLine={{ stroke: isDarkMode ? '#4B5563' : '#D1D5DB' }}
      tick={{ fill: isDarkMode ? '#9CA3AF' : '#4B5563', fontSize: 10 }}
    />
  );

  const CustomYAxis = () => {
    const maxPrice = Math.max(ptMaxPrice, showEsPrices ? esMaxPrice : 0);
    return (
      <YAxis
        domain={[0, (dataMax) => Math.ceil(dataMax * 1.1 * 100) / 100]}
        axisLine={false}
        tickLine={false}
        tick={{ fill: isDarkMode ? '#9CA3AF' : '#4B5563', fontSize: 10 }}
        tickFormatter={(value) => formatPrice(value, 2)}
        width={60}
        tickCount={5}
      />
    );
  };

  const CustomReferenceLine = ({
    y = averagePrice,
    stroke = isDarkMode ? '#9CA3AF' : '#4B5563',
    strokeDasharray = "3 3"
  }) => (
    <ReferenceLine
      y={y}
      stroke={stroke}
      strokeDasharray={strokeDasharray}
    />
  );

  const CustomReferenceArea = ({
    x1 = 0,
    x2 = 1,
    y1 = 0,
    y2 = 0,
    fill = getColor(0, isDarkMode),
    fillOpacity = 0.3
  }) => (
    <ReferenceArea
      x1={x1}
      x2={x2}
      y1={y1}
      y2={y2}
      fill={fill}
      fillOpacity={fillOpacity}
    />
  );

  return (
    <div className={`max-w-xl mx-auto p-4 ${isDarkMode ? 'bg-black' : 'bg-gray-100'}`}>
      <div className={`${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} rounded-lg shadow-md`}>
        <div className={`flex justify-between items-center p-2 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold">{showMWh ? '€/MWh' : '€/kWh'}</span>
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
              {getFormattedDate(selectedDay)}
            </p>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1`}>day average</p>
            <p className="text-2xl font-bold mt-0">{formatPrice(averagePrice)}</p>
            <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>€ / {showMWh ? 'MWh' : 'kWh'}</p>
          </div>
          {error ? (
            <div className="text-red-500 text-center">{error}</div>
          ) : (
            <div className="relative" ref={chartRef}>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={adjustedPrices}
                  onClick={handleChartClick}
                  margin={{ top: 5, right: 5, left: 0, bottom: 60 }}
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
                    domain={[ptMinPrice, ptMaxPrice]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: isDarkMode ? '#9CA3AF' : '#4B5563', fontSize: 10 }}
                    tickFormatter={(value) => formatPrice(value)}
                    ticks={[ptMinPrice, averagePrice, ptMaxPrice]}
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
                    dataKey="ptPrice" 
                    stroke={isDarkMode ? '#10B981' : '#059669'}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6, fill: isDarkMode ? '#10B981' : '#059669' }}
                  />
                  {showEsPrices && (
                    <Line 
                      type="monotone" 
                      dataKey="esPrice" 
                      stroke={isDarkMode ? '#EF4444' : '#DC2626'}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 6, fill: isDarkMode ? '#EF4444' : '#DC2626' }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
              <div className="absolute bottom-0 left-0 right-0" style={{ bottom: '40px' }}>
                <FloatingBubble 
                  ptMinPrice={ptMinPrice}
                  ptMaxPrice={ptMaxPrice}
                  minPriceHour={minPriceHour}
                  maxPriceHour={maxPriceHour}
                  esMinPrice={esMinPrice}
                  esMaxPrice={esMaxPrice}
                  esMinPriceHour={esMinPriceHour}
                  esMaxPriceHour={esMaxPriceHour}
                />
              </div>
            </div>
          )}
          <div className="mt-7 flex flex-col space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold">Include Tariff</span>
                <Switch 
                  checked={includeTariff}
                  onCheckedChange={setIncludeTariff}
                  size="sm"
                />
              </div>
              <span className="text-xs">{includeTariff ? `+${EXTRA_TARIFF.toFixed(precision)} €/kWh` : 'Excluded'}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold">Show Spanish Prices</span>
                <Switch 
                  checked={showEsPrices}
                  onCheckedChange={setShowEsPrices}
                  size="sm"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold">Use Generated Data</span>
                <Switch 
                  checked={useGeneratedData}
                  onCheckedChange={setUseGeneratedData}
                  size="sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;