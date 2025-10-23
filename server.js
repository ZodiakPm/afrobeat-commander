const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialiser la base de données
async function initDatabase() {
    try {
        // Créer la table si elle n'existe pas
        await pool.query(`
            CREATE TABLE IF NOT EXISTS app_data (
                id SERIAL PRIMARY KEY,
                key VARCHAR(255) UNIQUE NOT NULL,
                value JSONB NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Créer un index pour améliorer les performances
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_key ON app_data(key)
        `);
        
        console.log('✅ Base de données initialisée');
    } catch (error) {
        console.error('❌ Erreur initialisation DB:', error);
    }
}

// Fonctions utilitaires pour lire/écrire
async function getData(key) {
    try {
        const result = await pool.query(
            'SELECT value FROM app_data WHERE key = $1',
            [key]
        );
        return result.rows.length > 0 ? result.rows[0].value : null;
    } catch (error) {
        console.error('Erreur lecture:', error);
        return null;
    }
}

async function setData(key, value) {
    try {
        await pool.query(
            `INSERT INTO app_data (key, value, updated_at)
             VALUES ($1, $2, CURRENT_TIMESTAMP)
             ON CONFLICT (key)
             DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
            [key, value]
        );
        return true;
    } catch (error) {
        console.error('Erreur écriture:', error);
        return false;
    }
}

async function deleteData(key) {
    try {
        await pool.query('DELETE FROM app_data WHERE key = $1', [key]);
        return true;
    } catch (error) {
        console.error('Erreur suppression:', error);
        return false;
    }
}

// ========== ROUTES API ==========

// Health check
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ status: 'error', database: 'disconnected' });
    }
});

// Get user courant
app.get('/api/current-user/:userId', async (req, res) => {
    const key = `current_user_${req.params.userId}`;
    const user = await getData(key);
    console.log('📱 Get current user:', req.params.userId, '→', user);
    res.json({ user });
});

// Set user courant
app.post('/api/current-user/:userId', async (req, res) => {
    const key = `current_user_${req.params.userId}`;
    const success = await setData(key, req.body.user);
    console.log('💾 Set current user:', req.params.userId, '→', req.body.user);
    res.json({ success, user: req.body.user });
});

// Get disponibilités d'un membre pour un mois
app.get('/api/availability/:member/:year/:month', async (req, res) => {
    const { member, year, month } = req.params;
    const decodedMember = decodeURIComponent(member);
    const key = `availability_${decodedMember}_${year}_${month}`;
    const availability = await getData(key);
    console.log('📅 Get availability:', key, '→', availability ? Object.keys(availability).length : 0, 'days');
    res.json(availability || {});
});

// Set disponibilités d'un membre pour un mois
app.post('/api/availability/:member/:year/:month', async (req, res) => {
    const { member, year, month } = req.params;
    const decodedMember = decodeURIComponent(member);
    const key = `availability_${decodedMember}_${year}_${month}`;
    const success = await setData(key, req.body);
    console.log('💾 Set availability:', key, '→', Object.keys(req.body).length, 'days');
    res.json({ success });
});

// Get toutes les disponibilités (pour planning groupe)
app.get('/api/availability/all/:year/:month', async (req, res) => {
    const { year, month } = req.params;
    const members = ['Lead Guitar', 'Bass', 'Drums', 'Keys', 'Saxophone', 'Vocals'];
    
    console.log('👥 Get all availabilities for', year, month);
    
    const allAvailabilities = {};
    
    for (const member of members) {
        const key = `availability_${member}_${year}_${month}`;
        const availability = await getData(key);
        allAvailabilities[member] = availability || {};
        console.log(`  - ${member}: ${availability ? Object.keys(availability).length : 0} days`);
    }
    
    res.json(allAvailabilities);
});

// Get concerts
app.get('/api/concerts', async (req, res) => {
    const concerts = await getData('concerts');
    res.json(concerts || []);
});

// Add concert
app.post('/api/concerts', async (req, res) => {
    const concerts = await getData('concerts') || [];
    const newConcert = {
        ...req.body,
        addedAt: Date.now()
    };
    concerts.push(newConcert);
    const success = await setData('concerts', concerts);
    console.log('🎵 Add concert:', newConcert.location, newConcert.date);
    res.json({ success, concert: newConcert });
});

// Delete concert
app.delete('/api/concerts/:index', async (req, res) => {
    const concerts = await getData('concerts') || [];
    const index = parseInt(req.params.index);
    
    if (index >= 0 && index < concerts.length) {
        const deleted = concerts[index];
        concerts.splice(index, 1);
        const success = await setData('concerts', concerts);
        console.log('🗑️ Delete concert:', deleted.location);
        res.json({ success });
    } else {
        res.status(400).json({ success: false, error: 'Index invalide' });
    }
});

// Get links
app.get('/api/links', async (req, res) => {
    const links = await getData('links');
    res.json(links || []);
});

// Add link
app.post('/api/links', async (req, res) => {
    const links = await getData('links') || [];
    links.push(req.body);
    const success = await setData('links', links);
    console.log('🔗 Add link:', req.body.name);
    res.json({ success, link: req.body });
});

// Delete link
app.delete('/api/links/:index', async (req, res) => {
    const links = await getData('links') || [];
    const index = parseInt(req.params.index);
    
    if (index >= 0 && index < links.length) {
        const deleted = links[index];
        links.splice(index, 1);
        const success = await setData('links', links);
        console.log('🗑️ Delete link:', deleted.name);
        res.json({ success });
    } else {
        res.status(400).json({ success: false, error: 'Index invalide' });
    }
});

// Démarrer le serveur
async function startServer() {
    await initDatabase();
    app.listen(PORT, () => {
        console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
        console.log(`📊 API disponible sur http://localhost:${PORT}/api`);
        console.log(`💾 Base de données PostgreSQL connectée`);
    });
}

startServer();
