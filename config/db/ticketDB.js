const mongoose = require('mongoose');

const ticketDB = mongoose.createConnection(
    process.env.TICKET_DB
);

ticketDB.on('connected', () => {
    console.log('✅ Ticket DB Connected Successfully');
});

ticketDB.on('error', (err) => {
    console.error('❌ Ticket DB Connection Error:', err.message);
});

ticketDB.on('disconnected', () => {
    console.log('⚠️ Ticket DB Disconnected');
});

module.exports = ticketDB;
