/**
 * Seed script: populate Firestore `vehicles` collection with common YMM entries
 * used by the headlight lens / auto-parts catalog.
 *
 * Usage:  node scripts/seed-vehicles.cjs
 *
 * Each document = one Year/Make/Model triple.
 * Products reference these via a `fitments` array of objects:
 *   { year, make, model, displayName }
 */

const admin = require('firebase-admin');
const serviceAccount = require('c:/Users/ASUS/Downloads/gen-lang-client-0915949910-firebase-adminsdk-fbsvc-e9858b8e4e.json');

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
db.settings({ databaseId: 'ai-studio-3112dc56-9c5d-41d4-8544-f79c07c29140' });

// ── Core vehicle list (headlight lens focus) ─────────────────────────────────
// Format: [make, model, yearStart, yearEnd]
const RAW = [
  // ─── Japanese ───────────────────────────────────────────────────────────
  // Toyota (15 models)
  ['Toyota', 'Camry', 2007, 2025],
  ['Toyota', 'Corolla', 2007, 2025],
  ['Toyota', 'RAV4', 2007, 2025],
  ['Toyota', 'Highlander', 2008, 2025],
  ['Toyota', 'Land Cruiser', 2008, 2025],
  ['Toyota', 'Hilux', 2005, 2025],
  ['Toyota', 'Prado', 2005, 2025],
  ['Toyota', 'Yaris', 2007, 2024],
  ['Toyota', 'Fortuner', 2009, 2025],
  ['Toyota', 'Innova', 2008, 2025],
  ['Toyota', 'Avalon', 2013, 2025],
  ['Toyota', '4Runner', 2010, 2025],
  ['Toyota', 'Tacoma', 2010, 2025],
  ['Toyota', 'Tundra', 2014, 2025],
  ['Toyota', 'Supra', 2019, 2025],
  // Honda (12 models)
  ['Honda', 'Civic', 2006, 2025],
  ['Honda', 'Accord', 2006, 2025],
  ['Honda', 'CR-V', 2007, 2025],
  ['Honda', 'HR-V', 2015, 2025],
  ['Honda', 'Fit', 2007, 2024],
  ['Honda', 'City', 2008, 2025],
  ['Honda', 'Pilot', 2010, 2025],
  ['Honda', 'Odyssey', 2011, 2025],
  ['Honda', 'Vezel', 2014, 2025],
  ['Honda', 'Jazz', 2008, 2024],
  ['Honda', 'BR-V', 2016, 2025],
  ['Honda', 'WR-V', 2017, 2025],
  // Nissan (12 models)
  ['Nissan', 'Altima', 2007, 2025],
  ['Nissan', 'X-Trail', 2007, 2025],
  ['Nissan', 'Qashqai', 2007, 2025],
  ['Nissan', 'Patrol', 2010, 2025],
  ['Nissan', 'Sentra', 2007, 2025],
  ['Nissan', 'Navara', 2005, 2025],
  ['Nissan', 'Pathfinder', 2008, 2025],
  ['Nissan', 'Juke', 2011, 2024],
  ['Nissan', 'Kicks', 2016, 2025],
  ['Nissan', 'Maxima', 2009, 2023],
  ['Nissan', 'Rogue', 2008, 2025],
  ['Nissan', 'Murano', 2009, 2025],
  // Mazda (8 models)
  ['Mazda', 'Mazda3', 2007, 2025],
  ['Mazda', 'Mazda6', 2007, 2023],
  ['Mazda', 'CX-3', 2016, 2025],
  ['Mazda', 'CX-5', 2012, 2025],
  ['Mazda', 'CX-30', 2020, 2025],
  ['Mazda', 'CX-50', 2023, 2025],
  ['Mazda', 'CX-9', 2007, 2024],
  ['Mazda', 'MX-5', 2006, 2025],
  // Subaru (6 models)
  ['Subaru', 'Outback', 2010, 2025],
  ['Subaru', 'Forester', 2008, 2025],
  ['Subaru', 'Impreza', 2008, 2025],
  ['Subaru', 'XV', 2012, 2025],
  ['Subaru', 'Legacy', 2010, 2024],
  ['Subaru', 'WRX', 2015, 2025],
  // Mitsubishi (6 models)
  ['Mitsubishi', 'Outlander', 2007, 2025],
  ['Mitsubishi', 'Pajero', 2006, 2023],
  ['Mitsubishi', 'ASX', 2010, 2025],
  ['Mitsubishi', 'L200', 2006, 2025],
  ['Mitsubishi', 'Eclipse Cross', 2018, 2025],
  ['Mitsubishi', 'Xpander', 2018, 2025],
  // Suzuki (6 models)
  ['Suzuki', 'Swift', 2005, 2025],
  ['Suzuki', 'Vitara', 2006, 2025],
  ['Suzuki', 'Jimny', 2005, 2025],
  ['Suzuki', 'Ertiga', 2012, 2025],
  ['Suzuki', 'Baleno', 2016, 2025],
  ['Suzuki', 'S-Cross', 2014, 2025],
  // Isuzu (3 models)
  ['Isuzu', 'D-Max', 2007, 2025],
  ['Isuzu', 'MU-X', 2014, 2025],
  ['Isuzu', 'NLR', 2010, 2025],
  // Lexus (6 models)
  ['Lexus', 'RX', 2007, 2025],
  ['Lexus', 'NX', 2015, 2025],
  ['Lexus', 'ES', 2007, 2025],
  ['Lexus', 'IS', 2006, 2025],
  ['Lexus', 'GX', 2010, 2025],
  ['Lexus', 'UX', 2019, 2025],

  // ─── Korean ────────────────────────────────────────────────────────────
  // Hyundai (14 models)
  ['Hyundai', 'Elantra', 2007, 2025],
  ['Hyundai', 'Tucson', 2005, 2025],
  ['Hyundai', 'Santa Fe', 2007, 2025],
  ['Hyundai', 'Sonata', 2006, 2025],
  ['Hyundai', 'Accent', 2006, 2025],
  ['Hyundai', 'Creta', 2015, 2025],
  ['Hyundai', 'Kona', 2018, 2025],
  ['Hyundai', 'i10', 2008, 2025],
  ['Hyundai', 'i20', 2008, 2025],
  ['Hyundai', 'i30', 2007, 2025],
  ['Hyundai', 'Venue', 2020, 2025],
  ['Hyundai', 'Palisade', 2020, 2025],
  ['Hyundai', 'Ioniq 5', 2022, 2025],
  ['Hyundai', 'Staria', 2022, 2025],
  // Kia (12 models)
  ['Kia', 'Sportage', 2005, 2025],
  ['Kia', 'Seltos', 2020, 2025],
  ['Kia', 'K5', 2020, 2025],
  ['Kia', 'Sorento', 2007, 2025],
  ['Kia', 'Cerato', 2007, 2025],
  ['Kia', 'Rio', 2006, 2025],
  ['Kia', 'Carnival', 2006, 2025],
  ['Kia', 'Stonic', 2018, 2025],
  ['Kia', 'Soul', 2010, 2025],
  ['Kia', 'Picanto', 2008, 2025],
  ['Kia', 'EV6', 2022, 2025],
  ['Kia', 'Telluride', 2020, 2025],

  // ─── German ────────────────────────────────────────────────────────────
  // BMW (12 models)
  ['BMW', '1 Series', 2007, 2025],
  ['BMW', '2 Series', 2014, 2025],
  ['BMW', '3 Series', 2005, 2025],
  ['BMW', '4 Series', 2014, 2025],
  ['BMW', '5 Series', 2005, 2025],
  ['BMW', '7 Series', 2009, 2025],
  ['BMW', 'X1', 2010, 2025],
  ['BMW', 'X3', 2005, 2025],
  ['BMW', 'X5', 2005, 2025],
  ['BMW', 'X6', 2008, 2025],
  ['BMW', 'X7', 2019, 2025],
  ['BMW', 'iX3', 2021, 2025],
  // Mercedes-Benz (12 models)
  ['Mercedes-Benz', 'A-Class', 2013, 2025],
  ['Mercedes-Benz', 'C-Class', 2005, 2025],
  ['Mercedes-Benz', 'E-Class', 2005, 2025],
  ['Mercedes-Benz', 'S-Class', 2006, 2025],
  ['Mercedes-Benz', 'GLA', 2014, 2025],
  ['Mercedes-Benz', 'GLB', 2020, 2025],
  ['Mercedes-Benz', 'GLC', 2016, 2025],
  ['Mercedes-Benz', 'GLE', 2006, 2025],
  ['Mercedes-Benz', 'GLS', 2017, 2025],
  ['Mercedes-Benz', 'CLA', 2014, 2025],
  ['Mercedes-Benz', 'Sprinter', 2006, 2025],
  ['Mercedes-Benz', 'V-Class', 2014, 2025],
  // Audi (10 models)
  ['Audi', 'A3', 2005, 2025],
  ['Audi', 'A4', 2005, 2025],
  ['Audi', 'A6', 2005, 2025],
  ['Audi', 'A8', 2010, 2025],
  ['Audi', 'Q3', 2012, 2025],
  ['Audi', 'Q5', 2009, 2025],
  ['Audi', 'Q7', 2006, 2025],
  ['Audi', 'Q8', 2019, 2025],
  ['Audi', 'e-tron', 2019, 2025],
  ['Audi', 'TT', 2007, 2023],
  // Volkswagen (12 models)
  ['Volkswagen', 'Golf', 2005, 2025],
  ['Volkswagen', 'Passat', 2005, 2025],
  ['Volkswagen', 'Tiguan', 2008, 2025],
  ['Volkswagen', 'Polo', 2005, 2025],
  ['Volkswagen', 'Jetta', 2006, 2025],
  ['Volkswagen', 'T-Roc', 2018, 2025],
  ['Volkswagen', 'Touareg', 2005, 2025],
  ['Volkswagen', 'ID.4', 2021, 2025],
  ['Volkswagen', 'Arteon', 2018, 2025],
  ['Volkswagen', 'Taos', 2022, 2025],
  ['Volkswagen', 'Atlas', 2018, 2025],
  ['Volkswagen', 'Amarok', 2010, 2025],
  // Porsche (5 models)
  ['Porsche', 'Cayenne', 2005, 2025],
  ['Porsche', 'Macan', 2014, 2025],
  ['Porsche', 'Panamera', 2010, 2025],
  ['Porsche', '911', 2005, 2025],
  ['Porsche', 'Taycan', 2020, 2025],

  // ─── American ──────────────────────────────────────────────────────────
  // Ford (14 models)
  ['Ford', 'Focus', 2005, 2024],
  ['Ford', 'Escape', 2005, 2025],
  ['Ford', 'Ranger', 2005, 2025],
  ['Ford', 'F-150', 2005, 2025],
  ['Ford', 'Explorer', 2005, 2025],
  ['Ford', 'Mustang', 2005, 2025],
  ['Ford', 'Edge', 2007, 2025],
  ['Ford', 'EcoSport', 2013, 2025],
  ['Ford', 'Bronco', 2021, 2025],
  ['Ford', 'Maverick', 2022, 2025],
  ['Ford', 'Expedition', 2007, 2025],
  ['Ford', 'Transit', 2006, 2025],
  ['Ford', 'Territory', 2019, 2025],
  ['Ford', 'Everest', 2015, 2025],
  // Chevrolet (12 models)
  ['Chevrolet', 'Cruze', 2009, 2024],
  ['Chevrolet', 'Malibu', 2008, 2025],
  ['Chevrolet', 'Equinox', 2010, 2025],
  ['Chevrolet', 'Silverado', 2007, 2025],
  ['Chevrolet', 'Tracker', 2020, 2025],
  ['Chevrolet', 'Onix', 2013, 2025],
  ['Chevrolet', 'Traverse', 2009, 2025],
  ['Chevrolet', 'Tahoe', 2007, 2025],
  ['Chevrolet', 'Colorado', 2012, 2025],
  ['Chevrolet', 'Blazer', 2019, 2025],
  ['Chevrolet', 'Trailblazer', 2021, 2025],
  ['Chevrolet', 'Spark', 2010, 2023],
  // Jeep (6 models)
  ['Jeep', 'Cherokee', 2005, 2025],
  ['Jeep', 'Grand Cherokee', 2005, 2025],
  ['Jeep', 'Wrangler', 2007, 2025],
  ['Jeep', 'Compass', 2007, 2025],
  ['Jeep', 'Renegade', 2015, 2025],
  ['Jeep', 'Gladiator', 2020, 2025],
  // Dodge/Ram (4 models)
  ['Dodge', 'Charger', 2006, 2024],
  ['Dodge', 'Durango', 2011, 2025],
  ['Ram', '1500', 2009, 2025],
  ['Ram', '2500', 2010, 2025],
  // GMC (4 models)
  ['GMC', 'Sierra', 2007, 2025],
  ['GMC', 'Terrain', 2010, 2025],
  ['GMC', 'Acadia', 2007, 2025],
  ['GMC', 'Yukon', 2007, 2025],
  // Tesla (4 models)
  ['Tesla', 'Model 3', 2018, 2025],
  ['Tesla', 'Model Y', 2020, 2025],
  ['Tesla', 'Model S', 2012, 2025],
  ['Tesla', 'Model X', 2016, 2025],

  // ─── French ────────────────────────────────────────────────────────────
  // Peugeot (8 models)
  ['Peugeot', '208', 2012, 2025],
  ['Peugeot', '308', 2008, 2025],
  ['Peugeot', '3008', 2009, 2025],
  ['Peugeot', '5008', 2010, 2025],
  ['Peugeot', '2008', 2013, 2025],
  ['Peugeot', '508', 2011, 2025],
  ['Peugeot', 'Partner', 2008, 2025],
  ['Peugeot', 'Rifter', 2019, 2025],
  // Renault (8 models)
  ['Renault', 'Duster', 2010, 2025],
  ['Renault', 'Clio', 2005, 2025],
  ['Renault', 'Megane', 2005, 2025],
  ['Renault', 'Captur', 2013, 2025],
  ['Renault', 'Kadjar', 2015, 2025],
  ['Renault', 'Koleos', 2008, 2025],
  ['Renault', 'Sandero', 2008, 2025],
  ['Renault', 'Arkana', 2020, 2025],
  // Citroen (5 models)
  ['Citroen', 'C3', 2005, 2025],
  ['Citroen', 'C4', 2005, 2025],
  ['Citroen', 'C5 Aircross', 2019, 2025],
  ['Citroen', 'Berlingo', 2008, 2025],
  ['Citroen', 'C3 Aircross', 2017, 2025],

  // ─── Czech / Scandinavian ──────────────────────────────────────────────
  // Skoda (7 models)
  ['Skoda', 'Octavia', 2005, 2025],
  ['Skoda', 'Kodiaq', 2017, 2025],
  ['Skoda', 'Fabia', 2005, 2025],
  ['Skoda', 'Superb', 2008, 2025],
  ['Skoda', 'Karoq', 2018, 2025],
  ['Skoda', 'Kamiq', 2019, 2025],
  ['Skoda', 'Scala', 2019, 2025],
  // Volvo (7 models)
  ['Volvo', 'XC60', 2009, 2025],
  ['Volvo', 'XC90', 2005, 2025],
  ['Volvo', 'XC40', 2018, 2025],
  ['Volvo', 'S60', 2005, 2025],
  ['Volvo', 'S90', 2017, 2025],
  ['Volvo', 'V60', 2010, 2025],
  ['Volvo', 'V90', 2017, 2025],

  // ─── Italian ───────────────────────────────────────────────────────────
  // Fiat (4 models)
  ['Fiat', '500', 2007, 2025],
  ['Fiat', 'Punto', 2005, 2020],
  ['Fiat', 'Tipo', 2016, 2025],
  ['Fiat', 'Panda', 2005, 2025],
  // Alfa Romeo (3 models)
  ['Alfa Romeo', 'Giulia', 2017, 2025],
  ['Alfa Romeo', 'Stelvio', 2017, 2025],
  ['Alfa Romeo', 'Tonale', 2022, 2025],

  // ─── British ───────────────────────────────────────────────────────────
  // Land Rover (5 models)
  ['Land Rover', 'Range Rover', 2005, 2025],
  ['Land Rover', 'Range Rover Sport', 2005, 2025],
  ['Land Rover', 'Discovery', 2005, 2025],
  ['Land Rover', 'Defender', 2020, 2025],
  ['Land Rover', 'Evoque', 2012, 2025],
  // MINI (3 models)
  ['MINI', 'Cooper', 2005, 2025],
  ['MINI', 'Countryman', 2011, 2025],
  ['MINI', 'Clubman', 2008, 2025],

  // ─── Chinese (popular export) ──────────────────────────────────────────
  ['Geely', 'Coolray', 2019, 2025],
  ['Geely', 'Emgrand', 2010, 2025],
  ['Geely', 'Atlas', 2018, 2025],
  ['Geely', 'Monjaro', 2023, 2025],
  ['Chery', 'Tiggo 4', 2017, 2025],
  ['Chery', 'Tiggo 7', 2017, 2025],
  ['Chery', 'Tiggo 8', 2018, 2025],
  ['Chery', 'Arrizo 5', 2016, 2025],
  ['Chery', 'Omoda 5', 2023, 2025],
  ['Haval', 'H6', 2011, 2025],
  ['Haval', 'H9', 2015, 2025],
  ['Haval', 'Jolion', 2021, 2025],
  ['Haval', 'Dargo', 2022, 2025],
  ['BYD', 'Atto 3', 2022, 2025],
  ['BYD', 'Seal', 2022, 2025],
  ['BYD', 'Song Plus', 2020, 2025],
  ['BYD', 'Dolphin', 2022, 2025],
  ['BYD', 'Han', 2020, 2025],
  ['MG', 'ZS', 2017, 2025],
  ['MG', 'HS', 2018, 2025],
  ['MG', '5', 2020, 2025],
  ['MG', '4', 2022, 2025],
  ['MG', 'RX5', 2016, 2025],
  ['Changan', 'CS75', 2014, 2025],
  ['Changan', 'CS55', 2017, 2025],
  ['Changan', 'UNI-T', 2020, 2025],
  ['Changan', 'UNI-K', 2021, 2025],
  ['GAC', 'GS4', 2015, 2025],
  ['GAC', 'GS8', 2017, 2025],
  ['GAC', 'Emkoo', 2023, 2025],
  ['JAC', 'S3', 2014, 2025],
  ['JAC', 'S7', 2017, 2025],
  ['Great Wall', 'Wingle', 2006, 2025],
  ['Great Wall', 'Poer', 2020, 2025],

  // ─── Indian ────────────────────────────────────────────────────────────
  ['Maruti Suzuki', 'Swift', 2005, 2025],
  ['Maruti Suzuki', 'Baleno', 2015, 2025],
  ['Maruti Suzuki', 'Brezza', 2016, 2025],
  ['Maruti Suzuki', 'Ertiga', 2012, 2025],
  ['Maruti Suzuki', 'Dzire', 2008, 2025],
  ['Maruti Suzuki', 'Alto', 2000, 2025],
  ['Maruti Suzuki', 'Wagon R', 2000, 2025],
  ['Tata', 'Nexon', 2017, 2025],
  ['Tata', 'Harrier', 2019, 2025],
  ['Tata', 'Safari', 2005, 2025],
  ['Tata', 'Punch', 2021, 2025],
  ['Tata', 'Tiago', 2016, 2025],
  ['Mahindra', 'XUV700', 2021, 2025],
  ['Mahindra', 'Scorpio', 2005, 2025],
  ['Mahindra', 'Thar', 2010, 2025],
  ['Mahindra', 'XUV300', 2019, 2025],
  ['Mahindra', 'Bolero', 2000, 2025],

  // ─── Southeast Asian / Middle East popular ─────────────────────────────
  ['Proton', 'X70', 2018, 2025],
  ['Proton', 'X50', 2020, 2025],
  ['Proton', 'Saga', 2005, 2025],
  ['Perodua', 'Myvi', 2005, 2025],
  ['Perodua', 'Axia', 2014, 2025],
  ['Perodua', 'Ativa', 2021, 2025],
  ['Wuling', 'Almaz', 2019, 2025],
  ['Wuling', 'Air EV', 2022, 2025],

  // ─── Additional truck / commercial ────────────────────────────────────
  ['Toyota', 'Hiace', 2005, 2025],
  ['Hyundai', 'Porter', 2005, 2025],
  ['Hyundai', 'Starex', 2005, 2025],
  ['Kia', 'Bongo', 2005, 2025],
  ['Mercedes-Benz', 'Vito', 2005, 2025],
  ['Volkswagen', 'Transporter', 2005, 2025],
  ['Ford', 'Transit Connect', 2006, 2025],
  ['Fiat', 'Ducato', 2006, 2025],
  ['Renault', 'Master', 2006, 2025],
  ['Peugeot', 'Boxer', 2006, 2025],
  ['Citroen', 'Jumper', 2006, 2025],
  ['Iveco', 'Daily', 2006, 2025],

  // ─── Russia / CIS popular ─────────────────────────────────────────────
  ['Lada', 'Vesta', 2015, 2025],
  ['Lada', 'Granta', 2011, 2025],
  ['Lada', 'Niva', 2000, 2025],
  ['Lada', 'XRAY', 2016, 2025],
  ['Lada', 'Largus', 2012, 2025],
  ['UAZ', 'Patriot', 2005, 2025],
  ['UAZ', 'Hunter', 2003, 2025],

  // ─── Latin America popular ────────────────────────────────────────────
  ['Fiat', 'Argo', 2018, 2025],
  ['Fiat', 'Mobi', 2017, 2025],
  ['Fiat', 'Strada', 2004, 2025],
  ['Fiat', 'Toro', 2016, 2025],
  ['Fiat', 'Cronos', 2018, 2025],
  ['Volkswagen', 'Gol', 2000, 2024],
  ['Volkswagen', 'Saveiro', 2000, 2025],
  ['Volkswagen', 'Virtus', 2018, 2025],
  ['Volkswagen', 'T-Cross', 2019, 2025],
  ['Chevrolet', 'S10', 2001, 2025],
  ['Chevrolet', 'Montana', 2004, 2025],
  ['Chevrolet', 'Spin', 2012, 2025],
  ['Toyota', 'Etios', 2013, 2023],
  ['Toyota', 'SW4', 2005, 2025],
  ['Nissan', 'Versa', 2006, 2025],
  ['Nissan', 'March', 2003, 2025],
  ['Renault', 'Kwid', 2016, 2025],
  ['Renault', 'Logan', 2004, 2025],
  ['Hyundai', 'HB20', 2012, 2025],
  ['Hyundai', 'Creta (BR)', 2017, 2025],
  ['Jeep', 'Commander', 2022, 2025],

  // ─── Additional Australian / ASEAN ────────────────────────────────────
  ['Holden', 'Commodore', 2000, 2020],
  ['Holden', 'Colorado', 2008, 2020],
  ['Toyota', 'LandCruiser 70', 2000, 2025],
  ['Toyota', 'Kluger', 2003, 2025],
  ['Mitsubishi', 'Triton', 2005, 2025],
  ['Nissan', 'Navara D40', 2005, 2015],
  ['Ford', 'Wildtrak', 2011, 2025],
];

// Expand [make, model, startYear, endYear] → individual year docs
function expand(raw) {
  const docs = [];
  for (const [make, model, start, end] of raw) {
    for (let y = start; y <= end; y++) {
      docs.push({
        year: y,
        make,
        model,
        displayName: `${y} ${make} ${model}`,
      });
    }
  }
  return docs;
}

async function seed() {
  const vehicles = expand(RAW);
  console.log(`Seeding ${vehicles.length} vehicle entries...`);

  const BATCH_SIZE = 500;
  for (let i = 0; i < vehicles.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = vehicles.slice(i, i + BATCH_SIZE);
    for (const v of chunk) {
      // Deterministic doc ID so re-running is idempotent
      const docId = `${v.year}_${v.make}_${v.model}`.replace(/[\s/]/g, '-').toLowerCase();
      batch.set(db.collection('vehicles').doc(docId), v);
    }
    await batch.commit();
    console.log(`  Committed batch ${Math.floor(i / BATCH_SIZE) + 1} (${chunk.length} docs)`);
  }

  console.log('Done! Vehicle YMM collection seeded.');
}

seed().catch(console.error);
