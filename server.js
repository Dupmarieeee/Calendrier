const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
// Utilisation du PORT défini par l'hébergeur (Render) ou 3000 par défaut
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

// Configuration CORS permissive pour accepter les requêtes de Vercel/Render
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());

// Initialisation de la base de données si elle n'existe pas
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: [] }, null, 2));
}

// Fonction utilitaire pour lire la DB
const readDB = () => {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return { users: [] };
    }
};

// Fonction utilitaire pour écrire dans la DB
const writeDB = (data) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
};

// Route d'inscription
app.post('/register', (req, res) => {
    const { name, email, password, timezone } = req.body;
    const db = readDB();
    
    // Vérification stricte de l'unicité de l'email
    if (db.users.find(u => u.email === email)) {
        return res.status(400).json({ error: 'Cet adresse email est déjà utilisée.' });
    }

    const newUser = {
        id: Math.random().toString(36).substr(2, 9),
        name,
        email,
        password, // Note: Stocké en clair pour cet exemple strict, à hasher en prod
        timezone,
        data: {
            tasks: [],
            todos: [],
            categories: [
              { id: 'cat-1', name: 'Formation', color: '#c084fc', lightColor: '#f3e8ff' },
              { id: 'cat-2', name: 'Étude de concurrence', color: '#60a5fa', lightColor: '#dbeafe' },
              { id: 'cat-3', name: 'Prospection', color: '#fbbf24', lightColor: '#fef3c7' },
              { id: 'cat-4', name: 'Réseaux sociaux', color: '#4ade80', lightColor: '#dcfce7' },
              { id: 'cat-5', name: 'Sport', color: '#f472b6', lightColor: '#fce7f3' },
            ],
            sleep: { enabled: true, bedtime: '23:30', wakeTime: '07:00' },
            growth: { type: 'fleur', totalPoints: 0, lastPointsUpdate: new Date().toISOString().split('T')[0], streak: 1 }
        }
    };

    db.users.push(newUser);
    writeDB(db);

    const { password: _, ...userWithoutPass } = newUser;
    res.json({ user: userWithoutPass, data: newUser.data });
});

// Route de connexion
app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const db = readDB();
    
    const user = db.users.find(u => u.email === email && u.password === password);
    
    if (!user) {
        return res.status(401).json({ error: 'Email ou mot de passe incorrect.' });
    }

    const { password: _, ...userWithoutPass } = user;
    res.json({ user: userWithoutPass, data: user.data });
});

// Route de synchronisation
app.post('/sync', (req, res) => {
    const { email, data } = req.body;
    const db = readDB();
    
    const userIndex = db.users.findIndex(u => u.email === email);
    
    if (userIndex === -1) {
        return res.status(404).json({ error: 'Utilisateur non trouvé.' });
    }

    // Mise à jour des données
    db.users[userIndex].data = {
        ...db.users[userIndex].data,
        ...data
    };

    writeDB(db);
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Serveur Backend démarré sur le port ${PORT}`);
});