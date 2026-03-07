const User = require('../models/User');
const bcrypt = require('bcryptjs');

const seedAdmin = async () => {
    try {
        const adminEmail = 'ragulp.career@gmail.com';
        let adminExists;

        try {
            adminExists = await User.findOne({ email: adminEmail });
        } catch (decryptError) {
            console.warn('⚠️ [SEED] Decryption failure for existing admin. Secret drift detected. Recreating admin...');
            await User.deleteOne({ email: adminEmail });
            adminExists = null;
        }

        const salt = await bcrypt.genSalt(10);
        const adminPassword = await bcrypt.hash('1aA/1234/1234', salt);

        if (adminExists) {
            await User.updateOne(
                { email: adminEmail },
                {
                    $set: {
                        role: 'Super Admin',
                        isApproved: true,
                        isActive: true,
                        lockUntil: null,
                        failedLoginAttempts: 0
                    }
                }
            );
            console.log('✅ [SEED] Admin ragulp.career@gmail.com updated with Super Admin role and unlocked status.');
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
