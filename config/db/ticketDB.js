const mongoose = require('mongoose')

const ticketDB = mongoose.createConnection(
    process.env.TICKET_DB
)
ticketDB.on('connected',()=>{
    console.log('Ticket Db connected')
})

module.exports = ticketDB