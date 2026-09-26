const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

mongoose.connect(process.env.ATLASDB_URL).then(async () => {
    const users = await User.find({'resumeVersions.0': {$exists: true}});
    console.log('Total users with resumes:', users.length);
    for (let u of users) {
        console.log('User:', u.email);
        for (let r of u.resumeVersions) {
            console.log('  Resume:', r.fileName, 'TextLen:', r.text ? r.text.length : 0);
        }
    }
    process.exit(0);
});
