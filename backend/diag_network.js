const findLocalDevices = require('local-devices');

async function testScan() {
    console.log("Starting network scan...");
    try {
        const devices = await findLocalDevices();
        console.log("Found " + devices.length + " devices:");
        console.log(JSON.stringify(devices, null, 2));
    } catch (err) {
        console.error("Scan failed: ", err.message);
    }
}

testScan();
