const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "20mb" }));

const username = encodeURIComponent(process.env.MONGODB_USER);
const password = encodeURIComponent(process.env.MONGODB_PASSWORD);

const uri = process.env.MONGODB_URI ||
    `mongodb://${username}:${password}` +
    `@ac-10c3rxa-shard-00-00.grbk3is.mongodb.net:27017,` +
    `ac-10c3rxa-shard-00-01.grbk3is.mongodb.net:27017,` +
    `ac-10c3rxa-shard-00-02.grbk3is.mongodb.net:27017/` +
    `?tls=true&authSource=admin&retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 30000,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 30000
});

let db;

// =========================
// BASIC TEST
// =========================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index10.html"));
});

app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "GramSathi Index10 API is working!"
    });
});

// =========================
// REGISTER USER
// =========================

app.post("/api/register", async (req, res) => {
    try {
        const { name, mobile, email, password } = req.body;

        if (!name || !mobile || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must contain at least 6 characters."
            });
        }

        const users = db.collection("users");

        const existingUser = await users.findOne({
            $or: [
                { email: email.toLowerCase() },
                { mobile: mobile }
            ]
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Email or mobile number already registered."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = {
            name: name,
            mobile: mobile,
            email: email.toLowerCase(),
            password: hashedPassword,
            role: "user",
            createdAt: new Date()
        };

        const result = await users.insertOne(newUser);

        res.status(201).json({
            success: true,
            message: "Account created successfully!",
            user: {
                id: result.insertedId,
                name: newUser.name,
                mobile: newUser.mobile,
                email: newUser.email,
                role: newUser.role
            }
        });

    } catch (error) {
        console.error("Registration failed:", error.message);

        res.status(500).json({
            success: false,
            message: "Registration failed."
        });
    }
});

// =========================
// LOGIN USER
// =========================

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email/mobile and password are required."
            });
        }

        const users = db.collection("users");

        const user = await users.findOne({
            $or: [
                { email: email.toLowerCase() },
                { mobile: email }
            ]
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email/mobile number or password."
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email/mobile number or password."
            });
        }

        res.json({
            success: true,
            message: "Login successful!",
            user: {
                id: user._id,
                name: user.name,
                mobile: user.mobile,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Login failed:", error.message);

        res.status(500).json({
            success: false,
            message: "Login failed."
        });
    }
});

// =========================
// GET COMPLAINTS
// =========================

app.get("/api/complaints", async (req, res) => {
    try {
        const complaints = await db
            .collection("complaints")
            .find({})
            .sort({ _id: -1 })
            .toArray();

        res.json({
            success: true,
            complaints
        });

    } catch (error) {
        console.error("Failed to get complaints:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to get complaints"
        });
    }
});

// =========================
// SAVE COMPLAINT
// =========================

app.post("/api/complaints", async (req, res) => {
    try {
        const complaint = req.body;

        if (!complaint || Object.keys(complaint).length === 0) {
            return res.status(400).json({
                success: false,
                message: "Complaint data is empty"
            });
        }

        const result = await db
            .collection("complaints")
            .insertOne(complaint);

        res.json({
            success: true,
            message: "Complaint saved successfully!",
            id: result.insertedId
        });

    } catch (error) {
        console.error("Complaint save failed:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to save complaint"
        });
    }
});
// UPDATE COMPLAINT
app.put("/api/complaints/:id", async (req, res) => {
    try {
        const complaintId = req.params.id;
        const updates = req.body;

        const result = await db.collection("complaints").updateOne(
            { id: complaintId },
            {
                $set: {
                    ...updates,
                    updatedAt: new Date()
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({
                success: false,
                message: "Complaint not found"
            });
        }

        res.json({
            success: true,
            message: "Complaint updated successfully!"
        });

    } catch (error) {
        console.error("Complaint update failed:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to update complaint"
        });
    }
});

// =========================
// MONGODB CONNECTION
// =========================

async function startServer() {
    try {
        console.log("Connecting directly to MongoDB Atlas...");

        await client.connect();

        await client.db("admin").command({ ping: 1 });

        db = client.db("GramSathiIndex10");

        console.log("MongoDB connected successfully!");
        console.log("Database: GramSathiIndex10");

        app.listen(PORT, () => {
            console.log(
                `Server running on http://localhost:${PORT}`
            );
        });

    } catch (error) {
        console.error("MongoDB connection failed:");
        console.error(error.message);
        process.exit(1);
    }
}

startServer();