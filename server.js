// server.js - Quiz Website Backend with MongoDB (FIXED FOR PRODUCTION)
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();

// ============================================
// CORS CONFIGURATION (FIXED FOR PRODUCTION)
// ============================================
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'https://quiz-master-zoo7.onrender.com', // Replace with your actual Render URL
];

// Add your custom domain if you have one
if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, curl, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('❌ CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Serve static files from frontend directory
app.use(express.static('frontend'));

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// ============================================
// MONGODB CONNECTION
// ============================================
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://amitkumarnayak330_db_user:YMwkvBag3LpTT4rJ@cluster0.vppxlxb.mongodb.net/quizmaster?appName=Cluster0';

mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('✅ MongoDB Connected');
    console.log('📊 Database:', mongoose.connection.name);
})
.catch(err => {
    console.error('❌ MongoDB Connection Error:', err);
    process.exit(1);
});

// ============================================
// JWT SECRET (IMPORTANT FOR PRODUCTION)
// ============================================
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    console.warn('⚠️  WARNING: Using default JWT_SECRET in production! Set JWT_SECRET environment variable.');
}

// ============================================
// MONGODB SCHEMAS
// ============================================

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['student', 'teacher'], required: true },
    createdAt: { type: Date, default: Date.now }
});

// Quiz Score Schema
const scoreSchema = new mongoose.Schema({
    username: { type: String, required: true },
    score: { type: Number, required: true },
    total: { type: Number, required: true },
    percentage: { type: Number, required: true },
    categoryScores: {
        general: { score: Number, total: Number, percentage: Number },
        aptitude: { score: Number, total: Number, percentage: Number },
        technical: { score: Number, total: Number, percentage: Number }
    },
    date: { type: Date, default: Date.now }
});

// Question Schema
const questionSchema = new mongoose.Schema({
    category: { type: String, enum: ['general', 'aptitude', 'technical'], required: true },
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    correctAnswer: { type: Number, required: true },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Score = mongoose.model('Score', scoreSchema);
const Question = mongoose.model('Question', questionSchema);

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('Token verification error:', err.message);
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

const isTeacher = (req, res, next) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ error: 'Teacher access required' });
    }
    next();
};

// ============================================
// AUTH ROUTES
// ============================================

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        
        // Validation
        if (!username || !password || !role) {
            return res.status(400).json({ error: 'All fields required' });
        }
        
        if (password.length < 4) {
            return res.status(400).json({ error: 'Password must be at least 4 characters' });
        }
        
        if (!['student', 'teacher'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        
        // Check if user exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create user
        const user = new User({
            username,
            password: hashedPassword,
            role
        });
        
        await user.save();
        
        // Generate token with expiration
        const token = jwt.sign(
            { username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        
        console.log('✅ User registered:', username, 'Role:', role);
        
        res.status(201).json({
            message: 'User created successfully',
            token,
            user: { username: user.username, role: user.role }
        });
        
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Login (FIXED - Now includes expiresIn)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password, role } = req.body;
        
        console.log('🔐 Login attempt:', { username, role });
        
        // Find user
        const user = await User.findOne({ username, role });
        if (!user) {
            console.log('❌ User not found:', username, role);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Check password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            console.log('❌ Invalid password for:', username);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Generate token with expiration (FIXED)
        const token = jwt.sign(
            { username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' } // IMPORTANT: This was missing!
        );
        
        console.log('✅ Login successful:', username);
        
        res.json({
            message: 'Login successful',
            token,
            user: { username: user.username, role: user.role }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error during login' });
    }
});

// ============================================
// QUESTION ROUTES (TEACHER ONLY)
// ============================================

// Get all questions by category
app.get('/api/questions/:category', authenticateToken, async (req, res) => {
    try {
        const { category } = req.params;
        const questions = await Question.find({ category }).sort({ createdAt: -1 });
        res.json(questions);
    } catch (error) {
        console.error('Get questions error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all questions (all categories)
app.get('/api/questions', authenticateToken, async (req, res) => {
    try {
        const general = await Question.find({ category: 'general' });
        const aptitude = await Question.find({ category: 'aptitude' });
        const technical = await Question.find({ category: 'technical' });
        
        res.json({ general, aptitude, technical });
    } catch (error) {
        console.error('Get all questions error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add question (Teacher only)
app.post('/api/questions', authenticateToken, isTeacher, async (req, res) => {
    try {
        const { category, question, options, correctAnswer } = req.body;
        
        // Validation
        if (!category || !question || !options || correctAnswer === undefined) {
            return res.status(400).json({ error: 'All fields required' });
        }
        
        if (options.length !== 4) {
            return res.status(400).json({ error: 'Must provide exactly 4 options' });
        }
        
        if (correctAnswer < 0 || correctAnswer > 3) {
            return res.status(400).json({ error: 'Correct answer must be between 0 and 3' });
        }
        
        const newQuestion = new Question({
            category,
            question,
            options,
            correctAnswer,
            createdBy: req.user.username
        });
        
        await newQuestion.save();
        
        console.log('✅ Question added by:', req.user.username);
        
        res.status(201).json({
            message: 'Question added successfully',
            question: newQuestion
        });
        
    } catch (error) {
        console.error('Add question error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update question (Teacher only)
app.put('/api/questions/:id', authenticateToken, isTeacher, async (req, res) => {
    try {
        const { id } = req.params;
        const { question, options, correctAnswer } = req.body;
        
        const updatedQuestion = await Question.findByIdAndUpdate(
            id,
            { question, options, correctAnswer },
            { new: true }
        );
        
        if (!updatedQuestion) {
            return res.status(404).json({ error: 'Question not found' });
        }
        
        res.json({
            message: 'Question updated successfully',
            question: updatedQuestion
        });
        
    } catch (error) {
        console.error('Update question error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete question (Teacher only)
app.delete('/api/questions/:id', authenticateToken, isTeacher, async (req, res) => {
    try {
        const { id } = req.params;
        
        const deletedQuestion = await Question.findByIdAndDelete(id);
        
        if (!deletedQuestion) {
            return res.status(404).json({ error: 'Question not found' });
        }
        
        res.json({ message: 'Question deleted successfully' });
        
    } catch (error) {
        console.error('Delete question error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// SCORE ROUTES
// ============================================

// Submit score (Student only)
app.post('/api/scores', authenticateToken, async (req, res) => {
    try {
        const { score, total, percentage, categoryScores } = req.body;
        
        if (req.user.role !== 'student') {
            return res.status(403).json({ error: 'Only students can submit scores' });
        }
        
        const newScore = new Score({
            username: req.user.username,
            score,
            total,
            percentage,
            categoryScores
        });
        
        await newScore.save();
        
        console.log('✅ Score submitted:', req.user.username, score + '/' + total);
        
        res.status(201).json({
            message: 'Score submitted successfully',
            score: newScore
        });
        
    } catch (error) {
        console.error('Submit score error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get user's scores
app.get('/api/scores/user/:username', authenticateToken, async (req, res) => {
    try {
        const { username } = req.params;
        
        // Users can only view their own scores unless they're a teacher
        if (req.user.role !== 'teacher' && req.user.username !== username) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const scores = await Score.find({ username }).sort({ date: -1 });
        res.json(scores);
        
    } catch (error) {
        console.error('Get user scores error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all students' scores (Teacher only)
app.get('/api/scores/all', authenticateToken, isTeacher, async (req, res) => {
    try {
        const scores = await Score.find().sort({ date: -1 });
        
        // Group by username
        const studentScores = {};
        scores.forEach(score => {
            if (!studentScores[score.username]) {
                studentScores[score.username] = [];
            }
            studentScores[score.username].push(score);
        });
        
        res.json(studentScores);
        
    } catch (error) {
        console.error('Get all scores error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get leaderboard
app.get('/api/leaderboard', authenticateToken, async (req, res) => {
    try {
        const scores = await Score.find()
            .sort({ percentage: -1, date: -1 })
            .limit(10);
        
        res.json(scores);
        
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// STUDENT ROUTES (Teacher access)
// ============================================

// Get all students (Teacher only)
app.get('/api/students', authenticateToken, isTeacher, async (req, res) => {
    try {
        const students = await User.find({ role: 'student' })
            .select('-password')
            .sort({ createdAt: -1 });
        
        res.json(students);
        
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// HEALTH CHECK ENDPOINT
// ============================================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
        environment: process.env.NODE_ENV || 'development'
    });
});

// ============================================
// SEED DEFAULT QUESTIONS (ONE-TIME SETUP)
// ============================================

app.post('/api/seed-questions', async (req, res) => {
    try {
        const count = await Question.countDocuments();
        
        if (count > 0) {
            return res.json({ message: 'Questions already exist', count });
        }
        
        const defaultQuestions = [
            // General Knowledge
            { category: 'general', question: 'What is the capital of France?', options: ['London', 'Berlin', 'Paris', 'Madrid'], correctAnswer: 2, createdBy: 'system' },
            { category: 'general', question: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Saturn'], correctAnswer: 1, createdBy: 'system' },
            { category: 'general', question: 'Who painted the Mona Lisa?', options: ['Van Gogh', 'Picasso', 'Da Vinci', 'Michelangelo'], correctAnswer: 2, createdBy: 'system' },
            { category: 'general', question: 'What is the largest ocean on Earth?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correctAnswer: 3, createdBy: 'system' },
            { category: 'general', question: 'In which year did World War II end?', options: ['1943', '1944', '1945', '1946'], correctAnswer: 2, createdBy: 'system' },
            
            // Aptitude
            { category: 'aptitude', question: 'If 5x + 3 = 18, what is x?', options: ['2', '3', '4', '5'], correctAnswer: 1, createdBy: 'system' },
            { category: 'aptitude', question: 'What is 15% of 200?', options: ['20', '25', '30', '35'], correctAnswer: 2, createdBy: 'system' },
            { category: 'aptitude', question: 'A train travels 60 km in 45 minutes. What is its speed in km/h?', options: ['60', '70', '80', '90'], correctAnswer: 2, createdBy: 'system' },
            { category: 'aptitude', question: 'If a book costs $12 and is on 25% discount, what is the final price?', options: ['$8', '$9', '$10', '$11'], correctAnswer: 1, createdBy: 'system' },
            { category: 'aptitude', question: 'What comes next: 2, 6, 12, 20, ?', options: ['28', '30', '32', '34'], correctAnswer: 1, createdBy: 'system' },
            
            // Technical
            { category: 'technical', question: 'What does HTML stand for?', options: ['Hyper Text Markup Language', 'High Tech Modern Language', 'Home Tool Markup Language', 'Hyperlinks Text Mark Language'], correctAnswer: 0, createdBy: 'system' },
            { category: 'technical', question: 'Which language is known as the language of the web?', options: ['Python', 'Java', 'JavaScript', 'C++'], correctAnswer: 2, createdBy: 'system' },
            { category: 'technical', question: 'What does CSS stand for?', options: ['Computer Style Sheets', 'Cascading Style Sheets', 'Creative Style System', 'Colorful Style Sheets'], correctAnswer: 1, createdBy: 'system' },
            { category: 'technical', question: 'What is the time complexity of binary search?', options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'], correctAnswer: 1, createdBy: 'system' },
            { category: 'technical', question: 'Which protocol is used for secure web communication?', options: ['HTTP', 'FTP', 'HTTPS', 'SMTP'], correctAnswer: 2, createdBy: 'system' }
        ];
        
        await Question.insertMany(defaultQuestions);
        
        console.log('✅ Default questions seeded');
        
        res.json({ message: 'Default questions seeded successfully', count: defaultQuestions.length });
        
    } catch (error) {
        console.error('Seed questions error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// ERROR HANDLING
// ============================================

// 404 Handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Frontend available at http://localhost:${PORT}`);
    console.log(`📡 API endpoints available at http://localhost:${PORT}/api`);
    console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`⏰ Server started at: ${new Date().toISOString()}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received, closing server gracefully');
    mongoose.connection.close();
    process.exit(0);
});