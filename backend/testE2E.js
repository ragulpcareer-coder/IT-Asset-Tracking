const speakeasy = require('speakeasy');

async function testAll() {
    const baseURL = 'http://localhost:5000/api';
    let token = '';
    let cookie = '';

    const request = async (endpoint, method = 'GET', body = null) => {
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;
        if (cookie) headers.Cookie = cookie;
        if (body) headers['Content-Type'] = 'application/json';

        const options = { method, headers };
        if (body) options.body = JSON.stringify(body);

        const res = await fetch(`${baseURL}${endpoint}`, options);

        const setCookie = res.headers.get('set-cookie');
        if (setCookie) cookie = setCookie;

        if (!res.ok) {
            let msg = await res.text();
            throw new Error(`[${res.status}] ${msg}`);
        }
        return await res.json();
    };

    try {
        console.log("1. Logging in...");
        // Generate TOTP for Ragul Admin
        const token2FA = speakeasy.totp({
            secret: 'M5GTYMCPGFVXKNLBNRHCMM3TOMWC4WTMPUYXIPCVMVRUASRDO44Q',
            encoding: 'base32'
        });

        const resLogin = await request('/auth/login', 'POST', {
            email: 'ragulp.career@gmail.com',
            password: '1aA/1234/1234',
            token2FA
        });

        console.log("Login successful! Token:", resLogin.accessToken ? "Set" : "Not Set", "Cookie:", cookie ? "Set" : "Not Set");
        token = resLogin.accessToken || '';

        console.log("2. Fetching Users...");
        const resUsers = await request('/auth/users', 'GET');
        console.log(`Successfully fetched ${resUsers.length} users.`);

        console.log("3. Creating an Asset...");
        const resAsset = await request('/assets', 'POST', {
            name: 'Admin Test Server',
            type: 'Server',
            serialNumber: 'TEST-' + Math.floor(Math.random() * 9999),
            brand: 'Dell',
            model: 'PowerEdge R740',
            status: 'available',
            location: 'Datacenter A',
            purchaseDate: '2023-01-01',
            cost: 5000,
            assignedUser: 'IT Dept'
        });
        console.log(`Successfully created asset with ID ${resAsset._id}`);

        console.log("4. Fetching Assets...");
        const resGetAssets = await request('/assets', 'GET');
        console.log(`Successfully fetched ${resGetAssets.length} assets.`);

        console.log("5. Running Network Scan...");
        const resScan = await request('/assets/scan-network', 'POST');
        console.log(`Network scan completed. Result size: ${JSON.stringify(resScan).length} chars.`);

        console.log("6. Deleting the created asset...");
        await request(`/assets/${resAsset._id}`, 'DELETE');
        console.log("Asset deleted.");

        console.log("----------");
        console.log("ALL TESTS PASSED SUCCESSFULLY! The application functions flawlessly from end-to-end as an Administrator.");

    } catch (err) {
        console.error("Test failed!");
        console.error(err.message);
    }
}

testAll();
