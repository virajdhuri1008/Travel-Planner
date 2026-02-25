// =======================
// LOAD ENV FIRST
// =======================
require("dotenv").config();

const express = require("express");
const mysql = require("mysql2");
const session = require("express-session");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const OpenAI = require("openai");

const app = express();

// =======================
// GROQ SETUP
// =======================
const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1"
});

// =======================
// MIDDLEWARE
// =======================
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.json());
app.use(express.static("public"));

app.use(session({
    secret: "travel_secret",
    resave: false,
    saveUninitialized: true
}));

// =======================
// DATABASE CONNECTION
// =======================
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "travel_planner"
});

db.connect(err => {
    if (err) {
        console.log("Database connection failed.");
    } else {
        console.log("Connected to MySQL");
    }
});

// =======================
// AUTH ROUTES
// =======================

app.get("/", (req, res) => {
    res.send(`
        <h2>Travel Planner</h2>

        <h3>Register</h3>
        <form method="POST" action="/register">
            Name: <input name="name" required /><br/>
            Email: <input name="email" type="email" required /><br/>
            Password: <input name="password" type="password" required /><br/>
            <button type="submit">Register</button>
        </form>

        <h3>Login</h3>
        <form method="POST" action="/login">
            Email: <input name="email" type="email" required /><br/>
            Password: <input name="password" type="password" required /><br/>
            <button type="submit">Login</button>
        </form>
    `);
});

app.post("/register", async (req, res) => {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    db.query(
        "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
        [name, email, hashedPassword],
        (err) => {
            if (err) return res.send("Email already registered.");
            res.send("Registration successful! <a href='/'>Go Back</a>");
        }
    );
});

app.post("/login", (req, res) => {
    const { email, password } = req.body;

    db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
        if (results.length === 0) return res.send("Invalid login.");

        const match = await bcrypt.compare(password, results[0].password);
        if (!match) return res.send("Invalid login.");

        req.session.user = results[0];
        res.redirect("/dashboard");
    });
});

app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
});

// =======================
// DASHBOARD
// =======================

app.get("/dashboard", (req, res) => {
    if (!req.session.user) return res.redirect("/");

    res.send(`
        <h2>Welcome ${req.session.user.name}</h2>
        <a href="/chat.html">Open AI Travel Planner</a><br/><br/>
        <a href="/logout">Logout</a>
    `);
});

// =======================
// AI CHAT ROUTE (GROQ)
// =======================
app.post("/ai-chat", async (req, res) => {

    const { message } = req.body;

    try {

        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: "You are a professional AI travel planner. Provide detailed day-wise itinerary with hotel suggestions, cost breakdown, timings and insider travel tips."
                },
                {
                    role: "user",
                    content: message
                }
            ],
            temperature: 0.8
        });

        res.json({
            reply: completion.choices[0].message.content
        });

    } catch (error) {
        console.error(error.response?.data || error.message);
        res.status(500).json({ reply: "Error generating response." });
    }
});

// =======================
// START SERVER
// =======================

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
