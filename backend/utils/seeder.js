const User = require('../models/User');
const bcrypt = require('bcryptjs');

const seedAdmin = async () => {
    try {
        const adminEmail = 'admin@company.com';
        const adminExists = await User.findOne({ email: adminEmail });

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('Admin@123', salt);

        if (adminExists) {
            await User.updateOne(
                { email: adminEmail },
                { $set: { password: hashedPassword, isActive: true, lockUntil: null, failedLoginAttempts: 0, isTwoFactorEnabled: false } }
            );
            console.log('✅ [SEED] Admin already exists (password & statuses force-reset for access)');
            return;
        }

        await User.create({
            name: 'Super Admin',
            email: adminEmail,
            password: hashedPassword,
            role: 'Super Admin',
            isActive: true,
            isApproved: true,
            failedLoginAttempts: 0,
            lockUntil: null,
            isTwoFactorEnabled: false
        });

        console.log('✅ [SEED] Default admin created successfully');
    } catch (error) {
        console.error('❌ [SEED] Failed to seed default admin:', error.message);
    }
};

module.exports = { seedAdmin };
