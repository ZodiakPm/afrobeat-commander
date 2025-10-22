const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Pour servir le frontend

// Initialiser le fichier de données s'il n'existe pas
async function initDataFile() {
    try {
        await fs.access(DATA_FILE);
    } catch {
        const initialData = {
            availabilities: {},
            concerts: [],
            links: [],
            currentUsers: {}
        };
        await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2));
        console.log('✅ Fichier de données initialisé');
    }
}

// Lire les données
async function readData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Erreur lecture données:', error);
        return {
            availabilities: {},
            concerts: [],
            links: [],
            currentUsers: {}
        };
    }
}

// Écrire les données
async function writeData(data) {
    try {
        await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Erreur écriture données:', error);
        return false;
    }
}

// ========== ROUTES API ==========

// Get toutes les données (pour chargement initial)
app.get('/api/data', async (req, res) => {
    const data = await readData();
    res.json(data);
});

// Get user courant
app.get('/api/current-user/:userId', async (req, res) => {
    const data = await readData();
    const user = data.currentUsers[req.params.userId] || null;
    res.json({ user });
});

// Set user courant
app.post('/api/current-user/:userId', async (req, res) => {
    const data = await readData();
    data.currentUsers[req.params.userId] = req.body.user;
    const success = await writeData(data);
    res.json({ success, user: req.body.user });
});

// Get disponibilités d'un membre pour un mois
app.get('/api/availability/:member/:year/:month', async (req, res) => {
    const { member, year, month } = req.params;
    const key = `${member}_${year}_${month}`;
    const data = await readData();
    const availability = data.availabilities[key] || {};
    res.json(availability);
});

// Set disponibilités d'un membre pour un mois
app.post('/api/availability/:member/:year/:month', async (req, res) => {
    const { member, year, month } = req.params;
    const key = `${member}_${year}_${month}`;
    const data = await readData();
    data.availabilities[key] = req.body;
    const success = await writeData(data);
    res.json({ success });
});

// Get toutes les disponibilités (pour planning groupe)
app.get('/api/availability/all/:year/:month', async (req, res) => {
    const { year, month } = req.params;
    const data = await readData();
    const members = ['Lead Guitar', 'Bass', 'Drums', 'Keys', 'Saxophone', 'Vocals'];
    
    const allAvailabilities = {};
    members.forEach(member => {
        const key = `${member}_${year}_${month}`;
        allAvailabilities[member] = data.availabilities[key] || {};
    });
    
    res.json(allAvailabilities);
});

// Get concerts
app.get('/api/concerts', async (req, res) => {
    const data = await readData();
    res.json(data.concerts);
});

// Add concert
app.post('/api/concerts', async (req, res) => {
    const data = await readData();
    const newConcert = {
        ...req.body,
        addedAt: Date.now()
    };
    data.concerts.push(newConcert);
    const success = await writeData(data);
    res.json({ success, concert: newConcert });
});

// Delete concert
app.delete('/api/concerts/:index', async (req, res) => {
    const data = await readData();
    const index = parseInt(req.params.index);
    if (index >= 0 && index < data.concerts.length) {
        data.concerts.splice(index, 1);
        const success = await writeData(data);
        res.json({ success });
    } else {
        res.status(400).json({ success: false, error: 'Index invalide' });
    }
});

// Get links
app.get('/api/links', async (req, res) => {
    const data = await readData();
    res.json(data.links);
});

// Add link
app.post('/api/links', async (req, res) => {
    const data = await readData();
    data.links.push(req.body);
    const success = await writeData(data);
    res.json({ success, link: req.body });
});

// Delete link
app.delete('/api/links/:index', async (req, res) => {
    const data = await readData();
    const index = parseInt(req.params.index);
    if (index >= 0 && index < data.links.length) {
        data.links.splice(index, 1);
        const success = await writeData(data);
        res.json({ success });
    } else {
        res.status(400).json({ success: false, error: 'Index invalide' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Démarrer le serveur
async function startServer() {
    await initDataFile();
    app.listen(PORT, () => {
        console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
        console.log(`📊 API disponible sur http://localhost:${PORT}/api`);
        console.log(`💾 Données stockées dans: ${DATA_FILE}`);
    });
}

startServer();