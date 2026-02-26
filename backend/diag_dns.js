const dns = require('dns').promises;

async function testDnsReverse() {
    const ips = ["10.29.174.123", "10.29.174.176"];
    for (let ip of ips) {
        process.stdout.write("Resolving " + ip + "... ");
        try {
            const hostnames = await dns.reverse(ip);
            console.log(hostnames.length > 0 ? hostnames.join(", ") : "None found");
        } catch (err) {
            console.log("Failed: " + err.message);
        }
    }
}

testDnsReverse();
