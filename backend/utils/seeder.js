const User = require('../models/User');
const bcrypt = require('bcryptjs');

const seedAdmin = async () => {
    try {
        const adminEmail = 'ragulp.career@gmail.com';
        const adminExists = await User.findOne({ email: adminEmail });

        const adminPassword = '1aA/1234/1234';

        if (adminExists) {
            await User.updateOne(
                { email: adminEmail },
                {
                    $set: {
                        password: adminPassword,
                        role: 'Super Admin',
                        isApproved: true,
                        isActive: true,
                        lockUntil: null,
                        failedLoginAttempts: 0
                        // REMOVAL: do NOT reset twoFactorEnabled here anymore.
                    }
                }
            );
            console.log('✅ [SEED] Admin ragulp.career@gmail.com updated with Super Admin role, new password, and unlocked status.');
            return;
        }

        await User.create({
            name: 'Ragul',
            email: adminEmail,
            password: adminPassword,
            role: 'Super Admin',
            isActive: true,
            isApproved: true,
            failedLoginAttempts: 0,
            lockUntil: null,
            twoFactorEnabled: false
        });

        console.log('✅ [SEED] Default admin ragulp.career@gmail.com created successfully');
    } catch (error) {
        console.error('❌ [SEED] Failed to seed default admin:', error.message);
    }
};

module.exports = { seedAdmin };
