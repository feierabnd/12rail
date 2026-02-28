const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.get('/api/search', async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) {
    return res.status(400).json({ error: 'Please provide from and to parameters' });
  }
  try {
    const apiKey = '5ae2e3f221c38a28805f1982e5b2c29879f5a2ded3a2d68a53f85a4';
    const [fromRes, toRes] = await Promise.all([
      axios.get(`https://api.opentripmap.org/api/places/text?name=${encodeURIComponent(from)}&apikey=${apiKey}&format=json&limit=1`),
      axios.get(`https://api.opentripmap.org/api/places/text?name=${encodeURIComponent(to)}&apikey=${apiKey}&format=json&limit=1`)
    ]);
    if (!fromRes.data.length || !toRes.data.length) {
      return res.json({ connections: [], message: 'Locations not found' });
    }
    const connections = [
      { id: 1, from, to, duration: '4h 30m', distance: '650 km', transport: 'ICE', provider: 'DB', departure: '10:00', arrival: '14:30' },
      { id: 2, from, to, duration: '5h 15m', distance: '680 km', transport: 'IC', provider: 'DB', departure: '12:30', arrival: '17:45' }
    ];
    res.json({ connections });
  } catch (error) {
    res.json({ connections: [], message: 'Search error', error: error.message });
  }
});

app.get('/api/cities', (req, res) => {
  res.json([
    { name: 'Berlin', country: 'Germany' },
    { name: 'Paris', country: 'France' },
    { name: 'London', country: 'UK' },
    { name: 'Amsterdam', country: 'Netherlands' },
    { name: 'Vienna', country: 'Austria' }
  ]);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`12rail running on http://localhost:${PORT}`);
});
