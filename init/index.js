const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const User = require("../models/User");
const Internship = require("../models/Internship");

const initialCandidates = require("./userData");
const initialInternships = require("./internshipData");

const MONGODB_URI = process.env.ATLASDB_URL;

async function seedDatabase() {
    try {
        if (!MONGODB_URI) {
            throw new Error("ATLASDB_URL is undefined. Double-check the key name inside your .env file.");
        }

        console.log("Connecting to MongoDB Atlas...");
        await mongoose.connect(MONGODB_URI);
        console.log("Connected to MongoDB Atlas!");

        await User.deleteMany({});
        await Internship.deleteMany({});

        await User.insertMany(initialCandidates);
        await Internship.insertMany(initialInternships);

        console.log("Successfully seeded database!");
    } catch (error) {
        console.error("Seeding Error:", error);
    } finally {
        await mongoose.connection.close();
        console.log("Database connection closed.");
    }
}

seedDatabase();