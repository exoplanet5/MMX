// Approximate city-centre observer sites across Asia, plus JAXA facilities. Tiers keep the globe readable as it zooms.
const STATIONS = [
  ['misasa', 'Misasa DSS', 36.1333, 138.35, 'Asia/Tokyo', 1.58, 'JAXA 54 m deep-space antenna'],
  ['uchinoura', 'Uchinoura', 31.2519, 131.0819, 'Asia/Tokyo', 0, 'JAXA 34 m antenna'],
  ['tanegashima', 'Tanegashima', 30.4022, 130.975, 'Asia/Tokyo', 0, 'H3 launch site, Yoshinobu complex'],
];

const CITIES = {
  'East Asia': [
    ['Tokyo', 35.6895, 139.6917, 1, 'Asia/Tokyo'], ['Beijing', 39.9042, 116.4074, 1, 'Asia/Shanghai'],
    ['Shanghai', 31.2304, 121.4737, 1, 'Asia/Shanghai'], ['Seoul', 37.5665, 126.978, 1, 'Asia/Seoul'],
    ['Ulaanbaatar', 47.8864, 106.9057, 1, 'Asia/Ulaanbaatar'], ['Hong Kong', 22.3193, 114.1694, 2, 'Asia/Hong_Kong'],
    ['Taipei', 25.033, 121.5654, 2, 'Asia/Taipei'], ['Osaka', 34.6937, 135.5023, 2, 'Asia/Tokyo'],
    ['Sapporo', 43.0618, 141.3545, 2, 'Asia/Tokyo'], ['Fukuoka', 33.5904, 130.4017, 2, 'Asia/Tokyo'],
    ['Busan', 35.1796, 129.0756, 2, 'Asia/Seoul'], ['Pyongyang', 39.0392, 125.7625, 2, 'Asia/Pyongyang'],
    ['Guangzhou', 23.1291, 113.2644, 2, 'Asia/Shanghai'], ['Chengdu', 30.5728, 104.0668, 2, 'Asia/Shanghai'],
    ['Wuhan', 30.5928, 114.3055, 2, 'Asia/Shanghai'], ["Xi'an", 34.3416, 108.9398, 2, 'Asia/Shanghai'],
    ['Harbin', 45.8038, 126.535, 2, 'Asia/Shanghai'], ['Lhasa', 29.652, 91.1721, 2, 'Asia/Shanghai'],
    ['Ürümqi', 43.8256, 87.6168, 2, 'Asia/Shanghai'], ['Nagoya', 35.1815, 136.9066, 3, 'Asia/Tokyo'],
    ['Sendai', 38.2682, 140.8694, 3, 'Asia/Tokyo'], ['Naha', 26.2124, 127.6809, 3, 'Asia/Tokyo'],
    ['Shenzhen', 22.5431, 114.0579, 3, 'Asia/Shanghai'], ['Chongqing', 29.563, 106.5516, 3, 'Asia/Shanghai'],
    ['Kunming', 25.0389, 102.7183, 3, 'Asia/Shanghai'], ['Shenyang', 41.8057, 123.4315, 3, 'Asia/Shanghai'],
    ['Lanzhou', 36.0611, 103.8343, 3, 'Asia/Shanghai'], ['Hangzhou', 30.2741, 120.1551, 3, 'Asia/Shanghai'],
  ],
  'Southeast Asia': [
    ['Bangkok', 13.7563, 100.5018, 1, 'Asia/Bangkok'], ['Singapore', 1.3521, 103.8198, 1, 'Asia/Singapore'],
    ['Jakarta', -6.2088, 106.8456, 1, 'Asia/Jakarta'], ['Manila', 14.5995, 120.9842, 1, 'Asia/Manila'],
    ['Hanoi', 21.0278, 105.8342, 2, 'Asia/Ho_Chi_Minh'], ['Ho Chi Minh City', 10.8231, 106.6297, 2, 'Asia/Ho_Chi_Minh'],
    ['Kuala Lumpur', 3.139, 101.6869, 2, 'Asia/Kuala_Lumpur'], ['Yangon', 16.8409, 96.1735, 2, 'Asia/Yangon'],
    ['Phnom Penh', 11.5564, 104.9282, 3, 'Asia/Phnom_Penh'], ['Vientiane', 17.9757, 102.6331, 3, 'Asia/Vientiane'],
    ['Bandar Seri Begawan', 4.9031, 114.9398, 3, 'Asia/Brunei'], ['Surabaya', -7.2575, 112.7521, 3, 'Asia/Jakarta'],
    ['Davao', 7.1907, 125.4553, 3, 'Asia/Manila'], ['Dili', -8.5569, 125.5603, 3, 'Asia/Dili'],
  ],
  'South Asia': [
    ['New Delhi', 28.6139, 77.209, 1, 'Asia/Kolkata'], ['Mumbai', 19.076, 72.8777, 1, 'Asia/Kolkata'],
    ['Dhaka', 23.8103, 90.4125, 1, 'Asia/Dhaka'], ['Karachi', 24.8607, 67.0011, 1, 'Asia/Karachi'],
    ['Kolkata', 22.5726, 88.3639, 2, 'Asia/Kolkata'], ['Chennai', 13.0827, 80.2707, 2, 'Asia/Kolkata'],
    ['Bengaluru', 12.9716, 77.5946, 2, 'Asia/Kolkata'], ['Lahore', 31.5204, 74.3587, 2, 'Asia/Karachi'],
    ['Islamabad', 33.6844, 73.0479, 2, 'Asia/Karachi'], ['Kathmandu', 27.7172, 85.324, 2, 'Asia/Kathmandu'],
    ['Colombo', 6.9271, 79.8612, 2, 'Asia/Colombo'], ['Kabul', 34.5553, 69.2075, 2, 'Asia/Kabul'],
    ['Hyderabad', 17.385, 78.4867, 3, 'Asia/Kolkata'], ['Thimphu', 27.4728, 89.639, 3, 'Asia/Thimphu'],
    ['Malé', 4.1755, 73.5093, 3, 'Indian/Maldives'],
  ],
  'Central Asia': [
    ['Tashkent', 41.2995, 69.2401, 2, 'Asia/Tashkent'], ['Almaty', 43.222, 76.8512, 2, 'Asia/Almaty'],
    ['Astana', 51.1605, 71.4704, 2, 'Asia/Almaty'], ['Bishkek', 42.8746, 74.5698, 3, 'Asia/Bishkek'],
    ['Dushanbe', 38.5598, 68.787, 3, 'Asia/Dushanbe'], ['Ashgabat', 37.9601, 58.3261, 3, 'Asia/Ashgabat'],
  ],
  'West Asia': [
    ['Tehran', 35.6892, 51.389, 1, 'Asia/Tehran'], ['Riyadh', 24.7136, 46.6753, 1, 'Asia/Riyadh'],
    ['Dubai', 25.2048, 55.2708, 1, 'Asia/Dubai'], ['Istanbul', 41.0082, 28.9784, 1, 'Europe/Istanbul'],
    ['Ankara', 39.9334, 32.8597, 2, 'Europe/Istanbul'], ['Baghdad', 33.3152, 44.3661, 2, 'Asia/Baghdad'],
    ['Doha', 25.2854, 51.531, 3, 'Asia/Qatar'], ['Kuwait City', 29.3759, 47.9774, 3, 'Asia/Kuwait'],
    ['Muscat', 23.588, 58.3829, 3, 'Asia/Muscat'], ['Jeddah', 21.4858, 39.1925, 3, 'Asia/Riyadh'],
    ['Amman', 31.9454, 35.9284, 3, 'Asia/Amman'], ['Beirut', 33.8938, 35.5018, 3, 'Asia/Beirut'],
    ['Baku', 40.4093, 49.8671, 3, 'Asia/Baku'], ['Tbilisi', 41.7151, 44.8271, 3, 'Asia/Tbilisi'],
    ['Yerevan', 40.1792, 44.4991, 3, 'Asia/Yerevan'],
  ],
  'North Asia': [
    ['Novosibirsk', 55.0084, 82.9357, 2, 'Asia/Novosibirsk'], ['Vladivostok', 43.1155, 131.8855, 2, 'Asia/Vladivostok'],
    ['Irkutsk', 52.287, 104.305, 3, 'Asia/Irkutsk'], ['Yakutsk', 62.0355, 129.6755, 3, 'Asia/Yakutsk'],
    ['Yekaterinburg', 56.8389, 60.6057, 3, 'Asia/Yekaterinburg'],
  ],
};

const slug = name => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const PLACES = [
  ...STATIONS.map(([id, name, lat, lon, tz, heightKm, note]) => ({ id, name, lat, lon, tier: 1, tz, heightKm, note, kind: 'station', region: 'JAXA facilities' })),
  ...Object.entries(CITIES).flatMap(([region, rows]) => rows.map(([name, lat, lon, tier, tz]) => ({ id: slug(name), name, lat, lon, tier, tz, heightKm: 0, kind: 'city', region }))),
];

export const DEFAULT_PLACE = 'misasa';
export const placeById = id => PLACES.find(place => place.id === String(id).toLowerCase());
