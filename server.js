const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// European station codes database
const stationCodes = {
  'berlin': { id: '8011160', name: 'Berlin Hbf' },
  'hamburg': { id: '8002549', name: 'Hamburg Hbf' },
  'münchen': { id: '8000261', name: 'München Hbf' },
  'munich': { id: '8000261', name: 'München Hbf' },
  'muenchen': { id: '8000261', name: 'München Hbf' },
  'frankfurt': { id: '8000105', name: 'Frankfurt Hbf' },
  'köln': { id: '8000207', name: 'Köln Hbf' },
  'koln': { id: '8000207', name: 'Köln Hbf' },
  'düsseldorf': { id: '8000209', name: 'Düsseldorf Hbf' },
  'duesseldorf': { id: '8000209', name: 'Düsseldorf Hbf' },
  'dortmund': { id: '8000080', name: 'Dortmund Hbf' },
  'dortmund': { id: '8000135', name: 'Dortmund Hbf' },
  'stuttgart': { id: '8000096', name: 'Stuttgart Hbf' },
  'leipzig': { id: '8010085', name: 'Leipzig Hbf' },
  'essen': { id: '8000038', name: 'Essen Hbf' },
  'dresden': { id: '8010086', name: 'Dresden Hbf' },
  'hannover': { id: '8000152', name: 'Hannover Hbf' },
  'nürnberg': { id: '8000284', name: 'Nürnberg Hbf' },
  'nuremberg': { id: '8000284', name: 'Nürnberg Hbf' },
  'wien': { id: '1190100', name: 'Wien Hbf' },
  'vienna': { id: '1190100', name: 'Wien Hbf' },
  'paris': { id: '8727100', name: 'Paris Gare de Lyon' },
  'london': { id: '7000000', name: 'London St. Pancras' },
  'amsterdam': { id: '8400058', name: 'Amsterdam Centraal' },
  'zürich': { id: '8503000', name: 'Zürich HB' },
  'zurich': { id: '8503000', name: 'Zürich HB' },
  'brüssel': { id: '1000010', name: 'Bruxelles Midi' },
  'brussels': { id: '1000010', name: 'Bruxelles Midi' },
  'budapest': { id: '1000001', name: 'Budapest Nyugati' },
  'prag': { id: '1000002', name: 'Praha hlavní nádraží' },
  'prague': { id: '1000002', name: 'Praha hlavní nádraží' },
  'rom': { id: '8000152', name: 'Roma Termini' },
  'rome': { id: '8000152', name: 'Roma Termini' },
  'mailand': { id: '8000152', name: 'Milano Centrale' },
  'milan': { id: '8000152', name: 'Milano Centrale' },
  'madrid': { id: '7900001', name: 'Madrid Atocha' },
  'barcelona': { id: '7900002', name: 'Barcelona Sants' },
  'kopenhagen': { id: '8622430', name: 'København H' },
  'copenhagen': { id: '8622430', name: 'København H' },
  'stockholm': { id: '2400001', name: 'Stockholm Central' },
  'oslo': { id: '5400001', name: 'Oslo S' },
  'warschau': { id: '1200001', name: 'Warszawa Centralna' },
  'warsaw': { id: '1200001', name: 'Warszawa Centralna' }
};

function getStationId(city) {
  // First check hardcoded stations
  let key = city.toLowerCase()
    .replace('ö', 'o')
    .replace('ä', 'a')
    .replace('ü', 'u')
    .replace('ß', 'ss');
  
  if (stationCodes[key]) {
    return stationCodes[key];
  }
  
  // Return null - will trigger dynamic lookup
  return null;
}

// Dynamic station lookup
async function resolveStation(query) {
  // Check hardcoded first
  const hardcoded = getStationId(query);
  if (hardcoded) return hardcoded;
  
  // Search via API
  try {
    const response = await axios.get(
      `https://v6.db.transport.rest/locations?query=${encodeURIComponent(query)}&fuzzy=true&results=1`,
      { timeout: 15000 }
    );
    
    if (response.status === 503) {
      // API rate limited - return null but don't log
      return null;
    }
    
    const station = (response.data || []).find(s => s.type === 'station' && s.products);
    if (station) {
      return { id: station.id, name: station.name };
    }
  } catch (error) {
    if (error.response?.status === 503) {
      // Rate limited - be silent
      return null;
    }
    console.error('Station resolve error:', error.message);
  }
  
  return null;
}

function calculateDuration(departure, arrival) {
  const [depH, depM] = departure.split(':').map(Number);
  const [arrH, arrM] = arrival.split(':').map(Number);
  let mins = (arrH * 60 + arrM) - (depH * 60 + depM);
  if (mins < 0) mins += 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

app.get('/api/search', async (req, res) => {
  const { from, to, date, time } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: 'Please provide from and to parameters' });
  }

  // Resolve stations dynamically
  let fromStation = getStationId(from);
  let toStation = getStationId(to);
  
  // If not found in hardcoded list, search dynamically
  if (!fromStation) {
    fromStation = await resolveStation(from);
  }
  if (!toStation) {
    toStation = await resolveStation(to);
  }

  if (!fromStation || !toStation) {
    return res.json({ 
      connections: [], 
      error: `Station not found: "${!fromStation ? from : to}". Try a different spelling.`
    });
  }

  // Build departure time parameter
  let departureParam = '';
  let useScheduled = false;
  if (date) {
    // Format: YYYYMMDD or YYYYMMDDTHHMM
    const [year, month, day] = date.split('-');
    const timeStr = time ? time.replace(':', '') : '0000';
    departureParam = `&departure=${year}${month}${day}T${timeStr}`;
    useScheduled = true;
  }

  try {
    console.log(`Searching: ${fromStation.name} -> ${toStation.name}${departureParam ? ' (scheduled)' : ''}`);
    
    let response;
    try {
      response = await axios.get(
        `https://v6.db.transport.rest/journeys?from=${fromStation.id}&to=${toStation.id}&results=10${departureParam}`,
        { timeout: 30000 }
      );
    } catch (scheduledError) {
      // If scheduled query fails, retry without date/time
      if (useScheduled && (scheduledError.response?.status === 500 || scheduledError.response?.status === 503)) {
        console.log('Scheduled query failed, retrying without date...');
        response = await axios.get(
          `https://v6.db.transport.rest/journeys?from=${fromStation.id}&to=${toStation.id}&results=10`,
          { timeout: 30000 }
        );
      } else {
        throw scheduledError;
      }
    }

    const journeys = response.data.journeys || [];
    
    if (journeys.length === 0) {
      return res.json({ connections: [], message: 'No connections found' });
    }

    const connections = journeys.slice(0, 10).map((journey, index) => {
      const legs = journey.legs.filter(leg => leg.mode !== 'walking');
      
      // Get all train segments
      const segments = legs.map((leg, i) => {
        const departure = leg.departure ? leg.departure.split('T')[1].substring(0, 5) : 'N/A';
        const arrival = leg.arrival ? leg.arrival.split('T')[1].substring(0, 5) : 'N/A';
        const duration = calculateDuration(departure, arrival);
        
        return {
          number: i + 1,
          transport: leg.line?.productName || leg.line?.name || 'Train',
          line: leg.line?.name || '',
          from: leg.origin?.name || '',
          to: leg.destination?.name || '',
          departure,
          arrival,
          duration,
          platform: leg.departurePlatform || leg.plannedDeparturePlatform || ''
        };
      });

      // Calculate total journey time
      const firstDeparture = segments[0]?.departure || 'N/A';
      const lastArrival = segments[segments.length - 1]?.arrival || 'N/A';
      const totalDuration = calculateDuration(firstDeparture, lastArrival);
      
      // Count transfers
      const transfers = segments.length - 1;
      const transferInfo = transfers === 0 ? 'Direct' : `${transfers} Transfer${transfers > 1 ? 's' : ''}: ${segments.slice(0, -1).map(s => s.to).join(' → ')}`;
      
      return {
        id: index + 1,
        from: fromStation.name,
        to: toStation.name,
        totalDuration,
        transfers: transferInfo,
        segments,
        departure: firstDeparture,
        arrival: lastArrival
      };
    });

    res.json({ connections });
  } catch (error) {
    console.error('API Error:', error.message);
    res.json({ 
      connections: [], 
      message: 'API temporarily unavailable. Please try again later.',
      error: error.message
    });
  }
});

app.get('/api/stations', async (req, res) => {
  const { search } = req.query;
  
  if (!search || search.length < 2) {
    return res.json([]);
  }
  
  try {
    const response = await axios.get(
      `https://v6.db.transport.rest/locations?query=${encodeURIComponent(search)}&fuzzy=true&results=10`,
      { timeout: 15000 }
    );
    
    if (response.status === 503) {
      return res.json([]);
    }
    
    const stations = (response.data || [])
      .filter(s => s.type === 'station' && s.products)
      .filter(s => s.products.nationalExpress || s.products.national || s.products.regionalExpress)
      .map(s => ({
        id: s.id,
        name: s.name,
        latitude: s.location?.latitude,
        longitude: s.location?.longitude
      }));
    
    res.json(stations.slice(0, 10));
  } catch (error) {
    console.error('Station search error:', error.message);
    res.json([]);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`12rail running on http://localhost:${PORT}`);
});
