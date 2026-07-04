const mongoose = require('mongoose');

const connectDB = async () => {
  const conn = await mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize:              10,   // max concurrent connections in the pool
    serverSelectionTimeoutMS: 5000, // fail fast if MongoDB is unreachable
    socketTimeoutMS:          45000,
    family:                   4,    // use IPv4, avoids slow IPv6 lookups on some systems
  });
  return conn.connection.host;
};

module.exports = connectDB;
