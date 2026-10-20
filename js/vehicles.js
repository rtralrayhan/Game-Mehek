// The Top 100 vehicle catalogue: cars, bikes and boats.
// Stats (speed, acceleration, grip) are worked out from the price so that
// expensive vehicles are always faster.

const VEHICLE_LIST = [
  // ---------- CARS ----------
  ['car', 'Fiat 500', 8000, '#f6d6d6'],
  ['car', 'Honda Civic', 12000, '#3a6fd8'],
  ['car', 'Toyota Corolla', 13000, '#c9ccd1'],
  ['car', 'Volkswagen Golf GTI', 22000, '#d32f2f'],
  ['car', 'Mini Cooper S', 24000, '#2e7d32'],
  ['car', 'Mazda MX-5', 27000, '#b71c1c'],
  ['car', 'Nissan 370Z', 38000, '#ff9800'],
  ['car', 'Ford Focus RS', 32000, '#1e88e5'],
  ['car', 'Subaru WRX STI', 36000, '#1a3fa6'],
  ['car', 'Honda Civic Type R', 42000, '#fafafa'],
  ['car', 'Toyota Supra', 45000, '#ff5722'],
  ['car', 'Chevrolet Camaro SS', 46000, '#fdd835'],
  ['car', 'Ford Mustang GT', 48000, '#0d47a1'],
  ['car', 'Dodge Challenger SRT', 55000, '#6a1b9a'],
  ['car', 'Audi RS3', 58000, '#9e9e9e'],
  ['car', 'BMW M2', 60000, '#29b6f6'],
  ['car', 'Porsche 718 Cayman', 70000, '#ffeb3b'],
  ['car', 'BMW M3', 72000, '#43a047'],
  ['car', 'BMW M4', 78000, '#0288d1'],
  ['car', 'Mercedes-AMG C63', 80000, '#37474f'],
  ['car', 'Tesla Model S Plaid', 90000, '#e53935'],
  ['car', 'BMW M5', 105000, '#263238'],
  ['car', 'Porsche 911 Carrera', 110000, '#eceff1'],
  ['car', 'Mercedes-AMG E63', 110000, '#455a64'],
  ['car', 'Chevrolet Corvette Z06', 110000, '#c62828'],
  ['car', 'Mercedes-AMG GT', 120000, '#bdbdbd'],
  ['car', 'Audi RS6 Avant', 120000, '#546e7a'],
  ['car', 'BMW M8', 130000, '#1565c0'],
  ['car', 'BMW i8', 145000, '#4fc3f7'],
  ['car', 'Mercedes G63 AMG', 160000, '#212121'],
  ['car', 'Audi R8 V10', 170000, '#ff6f00'],
  ['car', 'Porsche Taycan Turbo S', 190000, '#7e57c2'],
  ['car', 'Aston Martin DB11', 210000, '#1b5e20'],
  ['car', 'Porsche 911 Turbo S', 210000, '#616161'],
  ['car', 'Nissan GT-R Nismo', 215000, '#e0e0e0'],
  ['car', 'Mercedes SLS AMG', 220000, '#d50000'],
  ['car', 'Ferrari Roma', 230000, '#c62828'],
  ['car', 'Lamborghini Urus', 230000, '#ffc107'],
  ['car', 'Bentley Continental GT', 230000, '#004d40'],
  ['car', 'Porsche 911 GT3 RS', 240000, '#76ff03'],
  ['car', 'Lamborghini Huracan', 260000, '#64dd17'],
  ['car', 'Ferrari F8 Tributo', 280000, '#e53935'],
  ['car', 'McLaren 720S', 300000, '#ff6d00'],
  ['car', 'Mercedes-AMG GT Black Series', 330000, '#ff9100'],
  ['car', 'Rolls-Royce Cullinan', 340000, '#311b92'],
  ['car', 'Lexus LFA', 500000, '#fafafa'],
  ['car', 'Ford GT', 500000, '#1e88e5'],
  ['car', 'Ferrari SF90 Stradale', 520000, '#d50000'],
  ['car', 'Lamborghini Aventador SVJ', 520000, '#aeea00'],
  ['car', 'Lamborghini Revuelto', 600000, '#ff3d00'],
  ['car', 'McLaren Senna', 1000000, '#ffab00'],
  ['car', 'McLaren P1', 1400000, '#ffd600'],
  ['car', 'Porsche 918 Spyder', 1500000, '#cfd8dc'],
  ['car', 'Rimac Nevera', 2400000, '#00b8d4'],
  ['car', 'Mercedes-AMG ONE', 2700000, '#b0bec5'],
  ['car', 'Pagani Huayra', 2800000, '#5d4037'],
  ['car', 'Ferrari LaFerrari', 3000000, '#b71c1c'],
  ['car', 'Koenigsegg Jesko', 3000000, '#eeeeee'],
  ['car', 'Aston Martin Valkyrie', 3200000, '#00695c'],
  ['car', 'Bugatti Chiron', 3300000, '#1a237e'],
  ['car', 'Lamborghini Sian', 3600000, '#ffd740'],
  ['car', 'Bugatti Bolide', 4500000, '#0d47a1'],
  // ---------- BIKES ----------
  ['bike', 'Kawasaki Ninja 400', 5500, '#00c853'],
  ['bike', 'Yamaha R3', 5500, '#1565c0'],
  ['bike', 'KTM 390 Duke', 6000, '#ff6d00'],
  ['bike', 'Royal Enfield Interceptor', 6500, '#b0bec5'],
  ['bike', 'Honda CBR500R', 7000, '#d50000'],
  ['bike', 'Yamaha MT-09', 10000, '#263238'],
  ['bike', 'Kawasaki Z900', 10000, '#64dd17'],
  ['bike', 'Harley-Davidson Iron 883', 11000, '#212121'],
  ['bike', 'Triumph Street Triple', 12000, '#9e9e9e'],
  ['bike', 'Yamaha R1', 18000, '#0d47a1'],
  ['bike', 'Suzuki Hayabusa', 19000, '#795548'],
  ['bike', 'BMW S1000RR', 22000, '#eceff1'],
  ['bike', 'Aprilia RSV4', 25000, '#311b92'],
  ['bike', 'Honda CBR1000RR-R', 28000, '#c62828'],
  ['bike', 'Ducati Panigale V4', 28000, '#e53935'],
  ['bike', 'MV Agusta F4', 30000, '#b71c1c'],
  ['bike', 'Kawasaki Ninja H2', 30000, '#76ff03'],
  ['bike', 'BMW M1000RR', 35000, '#1e88e5'],
  ['bike', 'Kawasaki Ninja H2R', 58000, '#37474f'],
  ['bike', 'Ducati Superleggera V4', 100000, '#ff1744'],
  // ---------- BOATS ----------
  ['boat', 'Yamaha WaveRunner', 12000, '#2962ff'],
  ['boat', 'Sea-Doo RXP-X', 17000, '#ffea00'],
  ['boat', 'Bass Tracker', 30000, '#2e7d32'],
  ['boat', 'Bayliner VR5', 45000, '#eceff1'],
  ['boat', 'Chaparral 23 SSi', 80000, '#c62828'],
  ['boat', 'Sea Ray SLX', 150000, '#fafafa'],
  ['boat', 'MasterCraft X24', 200000, '#0d47a1'],
  ['boat', 'Formula 350', 400000, '#212121'],
  ['boat', 'Baja Outlaw 35', 500000, '#ff6d00'],
  ['boat', 'Riva Aquarama', 600000, '#8d6e63'],
  ['boat', 'Donzi 38 ZR', 700000, '#ffd600'],
  ['boat', 'Cigarette 41 Nighthawk', 900000, '#d50000'],
  ['boat', 'Midnight Express 43', 1100000, '#263238'],
  ['boat', 'Fountain 47 Lightning', 1200000, '#00b8d4'],
  ['boat', 'Hydroplane Racer', 1500000, '#aa00ff'],
  ['boat', 'Mercedes-AMG Cigarette', 2000000, '#9e9e9e'],
  ['boat', 'Offshore Superboat', 2500000, '#ff3d00'],
  ['boat', 'Lamborghini Tecnomar', 4000000, '#64dd17'],
];

function makeStats(type, price) {
  const t = Math.max(0, Math.min(1, (Math.log10(price) - 3.7) / (6.65 - 3.7)));
  if (type === 'bike') {
    return { top: 260 + t * 520, accel: 260 + t * 520, grip: 0.8 + t * 0.12, steer: 3.4, size: [26, 9] };
  }
  if (type === 'boat') {
    return { top: 230 + t * 420, accel: 150 + t * 300, grip: 0.35 + t * 0.25, steer: 2.2, size: [44, 18] };
  }
  return { top: 240 + t * 430, accel: 180 + t * 440, grip: 0.65 + t * 0.3, steer: 2.7, size: [40, 20] };
}

const VEHICLES = VEHICLE_LIST.map(([type, name, price, color], i) => ({
  id: i,
  type,
  name,
  price,
  color,
  rank: 0,
  ...makeStats(type, price),
}));

// Rank by price so the shop really is a "Top 100" list.
[...VEHICLES].sort((a, b) => b.price - a.price).forEach((v, i) => (v.rank = i + 1));

function vehicleByName(name) {
  return VEHICLES.find((v) => v.name === name);
}

function money(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

// km/h shown on the speedometer (pixels per second -> km/h)
function kmh(pxPerSec) {
  return Math.round(pxPerSec * 0.55);
}
