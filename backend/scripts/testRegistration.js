async function testRegistration() {
    try {
        console.log("Testing Registration on Local API...");
        const res = await fetch('http://localhost:5000/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: "Agent Test",
                email: "agent@test.com",
                password: "AgentSecurePassword123!"
            })
        });

        const data = await res.json();
        console.log("Registration Response:", res.status, data);

        if (data.accessToken) {
            console.log("Registration returned token! Testing /auth/me...");
            const meRes = await fetch('http://localhost:5000/api/auth/me', {
                headers: { 'Authorization': `Bearer ${data.accessToken}` }
            });
            const meData = await meRes.json();
            console.log("Me Response:", meRes.status, meData);
        }
    } catch (e) {
        console.error("Test Error:", e.message);
    }
}

testRegistration();
