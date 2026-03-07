require("dotenv").config();
const mongoose = require("mongoose");
const assetController = require("./controllers/assetController");

async function test() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB.");

    const req = {};
    const res = {
        status: function (code) {
            console.log("STATUS:", code);
            return this;
        },
        json: function (data) {
            console.log("JSON RESPONSE:", data);
            return this;
        }
    };

    await assetController.getSecurityAlerts(req, res);
    process.exit(0);
}

test().catch(console.error);
